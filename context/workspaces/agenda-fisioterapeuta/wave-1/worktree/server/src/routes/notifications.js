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

  const { enabled, reminder_48h, reminder_2h, confirmation_request, canal, custom_message } = req.body;

  db.prepare(`
    UPDATE notification_settings
    SET
      enabled = COALESCE(?, enabled),
      reminder_48h = COALESCE(?, reminder_48h),
      reminder_2h = COALESCE(?, reminder_2h),
      confirmation_request = COALESCE(?, confirmation_request),
      canal = COALESCE(?, canal),
      custom_message = COALESCE(?, custom_message),
      updated_at = datetime('now')
    WHERE therapist_id = ?
  `).run(
    enabled !== undefined ? (enabled ? 1 : 0) : null,
    reminder_48h !== undefined ? (reminder_48h ? 1 : 0) : null,
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

export default router;
