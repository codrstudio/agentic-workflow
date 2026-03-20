import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import {
  ensureSettings,
  scheduleNotifications,
  processPendingNotifications,
} from '../notification-engine.js';

const router = Router();
router.use(requireAuth);

// GET /notification-settings
router.get('/settings', (req, res) => {
  const therapistId = req.therapistId;
  ensureSettings(therapistId);
  const settings = db
    .prepare('SELECT * FROM notification_settings WHERE therapist_id = ?')
    .get(therapistId);
  res.json(settings);
});

// PUT /notification-settings
router.put('/settings', (req, res) => {
  const therapistId = req.therapistId;
  ensureSettings(therapistId);

  const { enabled, reminder_48h, reminder_24h, reminder_2h, confirmation_request, canal, custom_message } = req.body;

  db.prepare(`
    UPDATE notification_settings
    SET
      enabled = COALESCE(?, enabled),
      reminder_48h = COALESCE(?, reminder_48h),
      reminder_24h = COALESCE(?, reminder_24h),
      reminder_2h = COALESCE(?, reminder_2h),
      confirmation_request = COALESCE(?, confirmation_request),
      canal = COALESCE(?, canal),
      custom_message = COALESCE(?, custom_message),
      updated_at = datetime('now')
    WHERE therapist_id = ?
  `).run(
    enabled !== undefined ? (enabled ? 1 : 0) : null,
    reminder_48h !== undefined ? (reminder_48h ? 1 : 0) : null,
    reminder_24h !== undefined ? (reminder_24h ? 1 : 0) : null,
    reminder_2h !== undefined ? (reminder_2h ? 1 : 0) : null,
    confirmation_request !== undefined ? (confirmation_request ? 1 : 0) : null,
    canal ?? null,
    custom_message !== undefined ? custom_message : null,
    therapistId
  );

  const updated = db
    .prepare('SELECT * FROM notification_settings WHERE therapist_id = ?')
    .get(therapistId);
  res.json(updated);
});

// GET /notifications?appointment_id=
router.get('/', (req, res) => {
  const therapistId = req.therapistId;
  const { appointment_id } = req.query;

  let rows;
  if (appointment_id) {
    rows = db.prepare(`
      SELECT n.*
      FROM notifications n
      JOIN appointments a ON a.id = n.appointment_id
      WHERE a.therapist_id = ? AND n.appointment_id = ?
      ORDER BY n.scheduled_at ASC
    `).all(therapistId, appointment_id);
  } else {
    rows = db.prepare(`
      SELECT n.*
      FROM notifications n
      JOIN appointments a ON a.id = n.appointment_id
      WHERE a.therapist_id = ?
      ORDER BY n.scheduled_at DESC
      LIMIT 200
    `).all(therapistId);
  }

  res.json(rows);
});

// POST /notifications/schedule — trigger scheduling now (useful for testing)
router.post('/schedule', (req, res) => {
  const result = scheduleNotifications(req.therapistId);
  res.json(result);
});

// POST /notifications/process — trigger processing now (useful for testing / manual send)
router.post('/process', (req, res) => {
  const result = processPendingNotifications();
  res.json(result);
});

// GET /notifications/stats?period=week|month — F-023 Notification Stats
router.get('/stats', (req, res) => {
  const therapistId = req.therapistId;
  const period = req.query.period === 'month' ? 'month' : 'week';
  const days = period === 'month' ? 30 : 7;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .replace('T', ' ')
    .slice(0, 19);

  // Notification delivery stats
  const notifStats = db.prepare(`
    SELECT
      COUNT(*) AS total_sent,
      SUM(CASE WHEN n.status = 'delivered' THEN 1 ELSE 0 END) AS total_delivered,
      SUM(CASE WHEN n.status = 'failed' THEN 1 ELSE 0 END) AS total_failed
    FROM notifications n
    JOIN appointments a ON a.id = n.appointment_id
    WHERE a.therapist_id = ?
      AND n.status IN ('sent', 'delivered', 'failed')
      AND n.sent_at >= ?
  `).get(therapistId, since);

  // Appointments that had at least one notification sent in the period
  const apptStats = db.prepare(`
    SELECT
      COUNT(DISTINCT a.id) AS total_appointments_with_notifications,
      SUM(CASE WHEN a.status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_appointments,
      SUM(CASE WHEN a.status = 'no_show' THEN 1 ELSE 0 END) AS no_shows
    FROM appointments a
    WHERE a.therapist_id = ?
      AND EXISTS (
        SELECT 1 FROM notifications n
        WHERE n.appointment_id = a.id
          AND n.status IN ('sent', 'delivered')
          AND n.sent_at >= ?
      )
  `).get(therapistId, since);

  const total = apptStats.total_appointments_with_notifications || 0;
  const confirmed = apptStats.confirmed_appointments || 0;
  const confirmation_rate = total > 0 ? Math.round((confirmed / total) * 100) / 100 : 0;

  res.json({
    period,
    total_sent: notifStats.total_sent || 0,
    total_delivered: notifStats.total_delivered || 0,
    total_failed: notifStats.total_failed || 0,
    total_appointments_with_notifications: total,
    confirmed_appointments: confirmed,
    no_shows: apptStats.no_shows || 0,
    confirmation_rate,
  });
});

// POST /notifications/send-now/:appointment_id — F-022 Manual Reminder
router.post('/send-now/:appointment_id', (req, res) => {
  const therapistId = req.therapistId;
  const appointmentId = Number(req.params.appointment_id);

  if (!appointmentId) {
    return res.status(400).json({ error: 'appointment_id inválido' });
  }

  // Validate appointment belongs to this therapist
  const appointment = db.prepare(`
    SELECT a.*, p.email AS patient_email, p.nome AS patient_nome
    FROM appointments a
    LEFT JOIN patients p ON p.id = a.patient_id
    WHERE a.id = ? AND a.therapist_id = ?
  `).get(appointmentId, therapistId);

  if (!appointment) {
    return res.status(404).json({ error: 'Agendamento não encontrado' });
  }

  // Reject cancelled appointments
  if (appointment.status === 'cancelled') {
    return res.status(422).json({ error: 'Não é possível enviar lembrete para agendamento cancelado' });
  }

  // Reject past appointments
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const apptDatetime = appointment.datetime;
  if (apptDatetime <= now) {
    return res.status(422).json({ error: 'Não é possível enviar lembrete para agendamento já passado' });
  }

  // Create a manual notification and mark as sent immediately
  const insert = db.prepare(`
    INSERT INTO notifications
      (appointment_id, patient_id, tipo, canal, status, scheduled_at, sent_at)
    VALUES (?, ?, 'custom', 'email', 'sent', ?, ?)
  `);

  const result = insert.run(appointmentId, appointment.patient_id, now, now);

  console.log(
    `[NotificationEngine] MANUAL SEND email → ${appointment.patient_email || '(no email)'} | appt=${appointment.datetime}`
  );

  res.json({
    success: true,
    notification_id: result.lastInsertRowid,
    patient: appointment.patient_nome || null,
    message: 'Lembrete enviado com sucesso',
  });
});

export default router;
