import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /waitlist — list active (waiting + notified) entries for this therapist
router.get('/', (req, res) => {
  const therapistId = req.therapistId;

  const rows = db.prepare(`
    SELECT w.*, s.nome AS service_nome, s.duracao AS service_duracao
    FROM waitlist_entry w
    LEFT JOIN services s ON s.id = w.service_id
    WHERE w.therapist_id = ?
      AND w.status IN ('waiting', 'notified')
    ORDER BY w.created_at ASC
  `).all(therapistId);

  const parsed = rows.map(r => ({
    ...r,
    preferred_dates: JSON.parse(r.preferred_dates || '[]'),
    preferred_times: JSON.parse(r.preferred_times || '[]'),
  }));

  res.json(parsed);
});

// POST /waitlist/notify — manually notify the next waiting entry (or a specific entry by id)
router.post('/notify', (req, res) => {
  const therapistId = req.therapistId;
  const { id } = req.body;

  let entry;
  if (id) {
    entry = db.prepare(
      `SELECT w.*, s.nome AS service_nome
       FROM waitlist_entry w
       LEFT JOIN services s ON s.id = w.service_id
       WHERE w.id = ? AND w.therapist_id = ?`
    ).get(id, therapistId);
    if (!entry) return res.status(404).json({ error: 'Entrada não encontrada' });
    if (entry.status !== 'waiting' && entry.status !== 'notified') {
      return res.status(422).json({ error: 'Entrada não está em estado notificável' });
    }
  } else {
    // Notify the oldest waiting entry for this therapist
    entry = db.prepare(
      `SELECT w.*, s.nome AS service_nome
       FROM waitlist_entry w
       LEFT JOIN services s ON s.id = w.service_id
       WHERE w.therapist_id = ? AND w.status = 'waiting'
       ORDER BY w.created_at ASC
       LIMIT 1`
    ).get(therapistId);
    if (!entry) return res.status(404).json({ error: 'Nenhuma entrada aguardando na fila' });
  }

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  db.prepare(
    `UPDATE waitlist_entry SET status = 'notified', notified_at = ?, updated_at = ? WHERE id = ?`
  ).run(now, now, entry.id);

  // Simulate email send (wave 1 — no real SMTP)
  console.log(
    `[Waitlist] NOTIFY email → ${entry.patient_email || '(no email)'} | patient=${entry.patient_name} | service=${entry.service_nome || 'qualquer'}`
  );

  res.json({
    success: true,
    id: entry.id,
    patient_name: entry.patient_name,
    patient_email: entry.patient_email,
    status: 'notified',
    message: 'Paciente notificado com sucesso',
  });
});

// DELETE /waitlist/:id — remove entry from waitlist
router.delete('/:id', (req, res) => {
  const therapistId = req.therapistId;
  const { id } = req.params;

  const entry = db.prepare(
    'SELECT id FROM waitlist_entry WHERE id = ? AND therapist_id = ?'
  ).get(id, therapistId);

  if (!entry) return res.status(404).json({ error: 'Entrada não encontrada' });

  db.prepare('DELETE FROM waitlist_entry WHERE id = ?').run(id);

  res.json({ ok: true });
});

export default router;
