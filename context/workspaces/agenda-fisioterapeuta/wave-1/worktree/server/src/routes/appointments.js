import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { createOrGetConfirmationToken } from '../notification-engine.js';

const router = Router();
router.use(requireAuth);

// Check for time conflicts (excluding a specific appointment id when editing)
function hasConflict(therapistId, datetime, duration, excludeId = null) {
  const startMs = new Date(datetime).getTime();
  const endMs = startMs + duration * 60 * 1000;

  const rows = db.prepare(`
    SELECT id, datetime, duration FROM appointments
    WHERE therapist_id = ?
      AND status NOT IN ('cancelled', 'no_show')
      ${excludeId ? 'AND id != ?' : ''}
  `).all(...(excludeId ? [therapistId, excludeId] : [therapistId]));

  for (const row of rows) {
    const s = new Date(row.datetime).getTime();
    const e = s + row.duration * 60 * 1000;
    if (startMs < e && endMs > s) return true;
  }
  return false;
}

// GET /appointments?date_from=&date_to=
router.get('/', (req, res) => {
  const { date_from, date_to } = req.query;
  const therapistId = req.therapistId;

  let sql = `
    SELECT a.*, p.nome as patient_nome, p.telefone as patient_telefone,
      CASE
        WHEN a.status = 'confirmed' THEN 'confirmed'
        WHEN (SELECT COUNT(*) FROM confirmation_tokens ct WHERE ct.appointment_id = a.id AND ct.used_at IS NULL) > 0 THEN 'pending'
        ELSE 'no_response'
      END as confirmation_status
    FROM appointments a
    LEFT JOIN patients p ON p.id = a.patient_id
    WHERE a.therapist_id = ?
  `;
  const params = [therapistId];

  if (date_from) {
    sql += ' AND a.datetime >= ?';
    params.push(date_from);
  }
  if (date_to) {
    sql += ' AND a.datetime <= ?';
    params.push(date_to + 'T23:59:59');
  }

  sql += ' ORDER BY a.datetime ASC';

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// POST /appointments
router.post('/', (req, res) => {
  const { patient_id, datetime, duration = 60, status = 'scheduled', notes } = req.body;
  const therapistId = req.therapistId;

  if (!datetime) {
    return res.status(400).json({ error: 'Data/hora é obrigatória' });
  }

  if (hasConflict(therapistId, datetime, duration)) {
    return res.status(409).json({ error: 'Conflito de horário: já existe um agendamento neste período' });
  }

  const result = db.prepare(`
    INSERT INTO appointments (therapist_id, patient_id, datetime, duration, status, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'therapist')
  `).run(therapistId, patient_id || null, datetime, duration, status, notes || null);

  const created = db.prepare(`
    SELECT a.*, p.nome as patient_nome, p.telefone as patient_telefone
    FROM appointments a
    LEFT JOIN patients p ON p.id = a.patient_id
    WHERE a.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(created);
});

// PUT /appointments/:id
router.put('/:id', (req, res) => {
  const therapistId = req.therapistId;
  const { id } = req.params;

  const existing = db.prepare(
    'SELECT * FROM appointments WHERE id = ? AND therapist_id = ?'
  ).get(id, therapistId);

  if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });

  const {
    patient_id,
    datetime,
    duration,
    status,
    notes,
  } = req.body;

  const newDatetime = datetime ?? existing.datetime;
  const newDuration = duration ?? existing.duration;

  if (hasConflict(therapistId, newDatetime, newDuration, Number(id))) {
    return res.status(409).json({ error: 'Conflito de horário: já existe um agendamento neste período' });
  }

  db.prepare(`
    UPDATE appointments SET
      patient_id = ?,
      datetime = ?,
      duration = ?,
      status = ?,
      notes = ?,
      updated_at = datetime('now')
    WHERE id = ? AND therapist_id = ?
  `).run(
    patient_id !== undefined ? (patient_id || null) : existing.patient_id,
    newDatetime,
    newDuration,
    status ?? existing.status,
    notes !== undefined ? (notes || null) : existing.notes,
    id,
    therapistId
  );

  const updated = db.prepare(`
    SELECT a.*, p.nome as patient_nome, p.telefone as patient_telefone
    FROM appointments a
    LEFT JOIN patients p ON p.id = a.patient_id
    WHERE a.id = ?
  `).get(id);

  res.json(updated);
});

// DELETE /appointments/:id — sets status to cancelled
router.delete('/:id', (req, res) => {
  const therapistId = req.therapistId;
  const { id } = req.params;

  const existing = db.prepare(
    'SELECT * FROM appointments WHERE id = ? AND therapist_id = ?'
  ).get(id, therapistId);

  if (!existing) return res.status(404).json({ error: 'Agendamento não encontrado' });

  db.prepare(`
    UPDATE appointments SET status = 'cancelled', updated_at = datetime('now')
    WHERE id = ? AND therapist_id = ?
  `).run(id, therapistId);

  res.json({ ok: true, status: 'cancelled' });
});

// POST /appointments/:id/confirmation-token — gerar/obter token de confirmação
router.post('/:id/confirmation-token', (req, res) => {
  const therapistId = req.therapistId;
  const { id } = req.params;

  const appt = db.prepare(
    'SELECT id FROM appointments WHERE id = ? AND therapist_id = ?'
  ).get(id, therapistId);

  if (!appt) return res.status(404).json({ error: 'Agendamento não encontrado' });

  const token = createOrGetConfirmationToken(Number(id));
  const confirmUrl = `/public/confirm/${token}`;
  res.json({ token, confirm_url: confirmUrl });
});

export default router;
