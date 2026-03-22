import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const VALID_METHODS  = ['cash', 'pix', 'card', 'transfer'];
const VALID_STATUSES = ['pending', 'paid', 'partial', 'waived'];

// GET /payments?patient_id=&date_from=&date_to=&method=&page=&page_size=
router.get('/', (req, res) => {
  const therapistId = req.therapistId;
  const { patient_id, date_from, date_to, method, page, page_size } = req.query;

  let sql = `
    SELECT p.*, a.datetime AS appointment_datetime,
           pat.nome AS patient_nome,
           s.nome AS service_nome
    FROM payment p
    JOIN appointments a ON a.id = p.appointment_id
    LEFT JOIN patients pat ON pat.id = p.patient_id
    LEFT JOIN services s ON s.id = a.service_id
    WHERE a.therapist_id = ?
  `;
  const params = [therapistId];

  if (patient_id) { sql += ' AND p.patient_id = ?'; params.push(patient_id); }
  if (date_from)  { sql += ' AND a.datetime >= ?';  params.push(date_from); }
  if (date_to)    { sql += ' AND a.datetime <= ?';  params.push(date_to + 'T23:59:59'); }
  if (method && VALID_METHODS.includes(method)) { sql += ' AND p.method = ?'; params.push(method); }

  sql += ' ORDER BY a.datetime DESC';

  const pageNum  = Math.max(1, parseInt(page, 10) || 1);
  const pageSize = Math.min(200, Math.max(1, parseInt(page_size, 10) || 50));

  const countSql = sql.replace(
    /SELECT p\.\*, a\.datetime.*FROM payment p/s,
    'SELECT COUNT(*) AS total FROM payment p'
  );
  const total = db.prepare(countSql).get(...params)?.total ?? 0;

  sql += ` LIMIT ? OFFSET ?`;
  params.push(pageSize, (pageNum - 1) * pageSize);

  res.json({ data: db.prepare(sql).all(...params), total, page: pageNum, page_size: pageSize });
});

// POST /payments
router.post('/', (req, res) => {
  const therapistId = req.therapistId;
  const { appointment_id, patient_id, amount, method, status = 'paid', paid_at, notes } = req.body;

  if (!appointment_id) {
    return res.status(400).json({ error: 'appointment_id é obrigatório' });
  }
  if (amount == null || isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Valor deve ser um número positivo' });
  }
  if (!VALID_METHODS.includes(method)) {
    return res.status(400).json({ error: 'Método inválido. Use: cash, pix, card, transfer' });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  const appt = db.prepare(
    'SELECT id, patient_id FROM appointments WHERE id = ? AND therapist_id = ?'
  ).get(appointment_id, therapistId);
  if (!appt) return res.status(404).json({ error: 'Agendamento não encontrado' });

  const resolvedPatientId = patient_id ?? appt.patient_id ?? null;

  const result = db.prepare(`
    INSERT INTO payment (appointment_id, patient_id, amount, method, status, paid_at, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(appointment_id, resolvedPatientId, Number(amount), method, status, paid_at || null, notes || null);

  res.status(201).json(db.prepare('SELECT * FROM payment WHERE id = ?').get(result.lastInsertRowid));
});

// PUT /payments/:id
router.put('/:id', (req, res) => {
  const therapistId = req.therapistId;
  const { id } = req.params;

  const existing = db.prepare(`
    SELECT p.* FROM payment p
    JOIN appointments a ON a.id = p.appointment_id
    WHERE p.id = ? AND a.therapist_id = ?
  `).get(id, therapistId);
  if (!existing) return res.status(404).json({ error: 'Pagamento não encontrado' });

  const { amount, method, status, paid_at, notes } = req.body;

  if (amount !== undefined && (isNaN(Number(amount)) || Number(amount) <= 0)) {
    return res.status(400).json({ error: 'Valor deve ser um número positivo' });
  }
  if (method !== undefined && !VALID_METHODS.includes(method)) {
    return res.status(400).json({ error: 'Método inválido' });
  }
  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  db.prepare(`
    UPDATE payment SET
      amount   = ?,
      method   = ?,
      status   = ?,
      paid_at  = ?,
      notes    = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    amount  !== undefined ? Number(amount) : existing.amount,
    method  ?? existing.method,
    status  ?? existing.status,
    paid_at !== undefined ? paid_at : existing.paid_at,
    notes   !== undefined ? notes   : existing.notes,
    id
  );

  res.json(db.prepare('SELECT * FROM payment WHERE id = ?').get(id));
});

export default router;
