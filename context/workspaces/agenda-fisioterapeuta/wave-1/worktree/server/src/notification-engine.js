/**
 * Notification Engine — F-018
 *
 * Responsibilities:
 * 1. Schedule notifications for future appointments
 * 2. Process pending notifications (simulate email send in wave 1)
 *
 * Design: pure functions operating on the db, exported for use by
 * the route layer and for testing without starting a real timer.
 */

import db from './db.js';
import { randomBytes } from 'crypto';

// --- Confirmation token helpers ---

/**
 * Create a confirmation token for an appointment if one doesn't exist yet.
 * Returns the token string.
 */
export function createOrGetConfirmationToken(appointmentId) {
  const existing = db.prepare(
    'SELECT token FROM confirmation_tokens WHERE appointment_id = ? AND used_at IS NULL'
  ).get(appointmentId);
  if (existing) return existing.token;

  const token = randomBytes(20).toString('hex');
  db.prepare(
    'INSERT INTO confirmation_tokens (token, appointment_id) VALUES (?, ?)'
  ).run(token, appointmentId);
  return token;
}

// --- Helpers ---

function addHours(isoDatetime, hours) {
  const d = new Date(isoDatetime);
  d.setHours(d.getHours() + hours);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function nowISO() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/**
 * Ensure notification_settings row exists for therapist.
 * Idempotent — safe to call multiple times.
 */
export function ensureSettings(therapistId) {
  db.prepare(`
    INSERT OR IGNORE INTO notification_settings
      (therapist_id, enabled, reminder_48h, reminder_24h, reminder_2h, confirmation_request, canal)
    VALUES (?, 1, 1, 1, 1, 1, 'email')
  `).run(therapistId);
}

/**
 * Schedule notifications for all future appointments that are missing them.
 *
 * For each appointment:
 *  - If settings.reminder_48h: create a reminder_48h notification scheduled 48h before
 *  - If settings.reminder_2h:  create a reminder_2h  notification scheduled 2h  before
 *  - If settings.confirmation_request: create confirmation_request scheduled 48h before
 *
 * The UNIQUE(appointment_id, tipo) constraint prevents duplicates.
 */
export function scheduleNotifications(therapistId) {
  ensureSettings(therapistId);

  const settings = db
    .prepare('SELECT * FROM notification_settings WHERE therapist_id = ?')
    .get(therapistId);

  if (!settings || !settings.enabled) return { scheduled: 0 };

  const now = nowISO();

  // Appointments in the future for this therapist
  const appointments = db.prepare(`
    SELECT a.id, a.patient_id, a.datetime
    FROM appointments a
    WHERE a.therapist_id = ?
      AND a.datetime > ?
      AND a.status NOT IN ('cancelled', 'completed')
  `).all(therapistId, now);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO notifications
      (appointment_id, patient_id, tipo, canal, status, scheduled_at)
    VALUES (?, ?, ?, ?, 'pending', ?)
  `);

  let scheduled = 0;

  const insertMany = db.transaction((appts) => {
    for (const appt of appts) {
      const dt = appt.datetime.replace(' ', 'T');
      if (settings.reminder_48h) {
        const r = insert.run(appt.id, appt.patient_id, 'reminder_48h', settings.canal, addHours(dt, -48));
        scheduled += r.changes;
      }
      if (settings.reminder_24h) {
        const r = insert.run(appt.id, appt.patient_id, 'reminder_24h', settings.canal, addHours(dt, -24));
        scheduled += r.changes;
      }
      if (settings.reminder_2h) {
        const r = insert.run(appt.id, appt.patient_id, 'reminder_2h', settings.canal, addHours(dt, -2));
        scheduled += r.changes;
      }
      if (settings.confirmation_request) {
        const r = insert.run(appt.id, appt.patient_id, 'confirmation_request', settings.canal, addHours(dt, -48));
        scheduled += r.changes;
        // Ensure confirmation token exists for this appointment
        createOrGetConfirmationToken(appt.id);
      }
    }
  });

  insertMany(appointments);
  return { scheduled };
}

/**
 * Process pending notifications whose scheduled_at <= now.
 *
 * In wave 1 the "email" channel is simulated: we log the send and mark as sent.
 * A real SMTP integration would go in simulateSend().
 */
function simulateSend(notification, patient, appointment) {
  // Wave 1: simulate email send (no real SMTP)
  console.log(
    `[NotificationEngine] SEND email → ${patient?.email || '(no email)'} | tipo=${notification.tipo} | appt=${appointment?.datetime}`
  );
  return { success: true };
}

export function processPendingNotifications() {
  const now = nowISO();

  const pending = db.prepare(`
    SELECT n.*, p.email AS patient_email, p.nome AS patient_name,
           a.datetime AS appt_datetime
    FROM notifications n
    LEFT JOIN patients p ON p.id = n.patient_id
    LEFT JOIN appointments a ON a.id = n.appointment_id
    WHERE n.status = 'pending'
      AND n.scheduled_at <= ?
  `).all(now);

  const markSent = db.prepare(`
    UPDATE notifications SET status = 'sent', sent_at = ? WHERE id = ?
  `);
  const markFailed = db.prepare(`
    UPDATE notifications SET status = 'failed', error_message = ? WHERE id = ?
  `);

  let sent = 0;
  let failed = 0;

  for (const notif of pending) {
    const patient = { email: notif.patient_email, nome: notif.patient_name };
    const appointment = { datetime: notif.appt_datetime };
    const result = simulateSend(notif, patient, appointment);
    if (result.success) {
      markSent.run(now, notif.id);
      sent++;
    } else {
      markFailed.run(result.error || 'unknown error', notif.id);
      failed++;
    }
  }

  return { sent, failed };
}

// --- Background scheduler ---

let _intervalHandle = null;

/**
 * Start the background job that:
 *   1. Schedules notifications for all therapists' future appointments
 *   2. Processes pending notifications due now
 *
 * intervalMs defaults to 60 000 (1 minute).
 */
export function startScheduler(intervalMs = 60_000) {
  if (_intervalHandle) return; // already running

  const tick = () => {
    try {
      // Get all therapist IDs
      const therapists = db.prepare('SELECT id FROM therapists').all();
      for (const t of therapists) {
        scheduleNotifications(t.id);
      }
      processPendingNotifications();
    } catch (err) {
      console.error('[NotificationEngine] tick error:', err.message);
    }
  };

  // Run immediately, then on interval
  tick();
  _intervalHandle = setInterval(tick, intervalMs);
  console.log(`[NotificationEngine] Scheduler started (interval=${intervalMs}ms)`);
}

export function stopScheduler() {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }
}
