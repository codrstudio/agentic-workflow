import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// ── Helpers (copied from slots.js to avoid circular imports) ──────────────────

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function subtractRange(ranges, blockStart, blockEnd) {
  const result = [];
  for (const [start, end] of ranges) {
    if (blockEnd <= start || blockStart >= end) {
      result.push([start, end]);
    } else {
      if (start < blockStart) result.push([start, blockStart]);
      if (end > blockEnd) result.push([blockEnd, end]);
    }
  }
  return result;
}

function mergeRanges(ranges) {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const merged = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const [start, end] = sorted[i];
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

function countSlotsForRanges(ranges, duration, interval) {
  let count = 0;
  for (const [rangeStart, rangeEnd] of ranges) {
    let slotStart = rangeStart;
    while (slotStart + duration <= rangeEnd) {
      count++;
      slotStart += duration + interval;
    }
  }
  return count;
}

function computeTotalSlotsForPeriod(therapistId, dateFrom, dateTo) {
  const therapist = db.prepare(
    'SELECT session_duration, session_interval FROM therapists WHERE id = ?'
  ).get(therapistId);
  if (!therapist) return 0;

  const duration = therapist.session_duration || 60;
  const interval = therapist.session_interval || 0;

  const availabilityBlocks = db.prepare(
    'SELECT dia_semana, hora_inicio, hora_fim FROM availability WHERE therapist_id = ? AND ativo = 1'
  ).all(therapistId);

  const overrides = db.prepare(
    'SELECT data, tipo, hora_inicio, hora_fim FROM availability_override WHERE therapist_id = ? AND data >= ? AND data <= ?'
  ).all(therapistId, dateFrom, dateTo);

  const overrideMap = {};
  for (const ov of overrides) {
    if (!overrideMap[ov.data]) overrideMap[ov.data] = [];
    overrideMap[ov.data].push(ov);
  }

  let totalSlots = 0;
  const from = new Date(dateFrom + 'T12:00:00Z');
  const to = new Date(dateTo + 'T12:00:00Z');

  for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    const dayStr = d.toISOString().slice(0, 10);
    const dayOfWeek = d.getUTCDay();

    const blocks = availabilityBlocks.filter(b => b.dia_semana === dayOfWeek);
    let ranges = blocks.map(b => [timeToMinutes(b.hora_inicio), timeToMinutes(b.hora_fim)]);
    ranges = mergeRanges(ranges);

    for (const ov of (overrideMap[dayStr] || [])) {
      if (ov.tipo === 'bloqueio') {
        if (!ov.hora_inicio && !ov.hora_fim) {
          ranges = [];
        } else {
          ranges = subtractRange(ranges, timeToMinutes(ov.hora_inicio), timeToMinutes(ov.hora_fim));
        }
      } else if (ov.tipo === 'liberacao' && ov.hora_inicio && ov.hora_fim) {
        ranges.push([timeToMinutes(ov.hora_inicio), timeToMinutes(ov.hora_fim)]);
        ranges = mergeRanges(ranges);
      }
    }

    totalSlots += countSlotsForRanges(ranges, duration, interval);
  }

  return totalSlots;
}

// ── GET /financial/summary?period=month&date=YYYY-MM ─────────────────────────

router.get('/summary', (req, res) => {
  const therapistId = req.therapistId;
  const { period = 'month', date } = req.query;

  if (period !== 'month') {
    return res.status(400).json({ error: 'period inválido. Use: month' });
  }
  if (!date || !/^\d{4}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date é obrigatório no formato YYYY-MM' });
  }

  const [year, month] = date.split('-').map(Number);
  const dateFrom = `${date}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${date}-${String(lastDay).padStart(2, '0')}`;

  // Appointments in period
  const appointments = db.prepare(`
    SELECT id, status FROM appointments
    WHERE therapist_id = ? AND date(datetime) >= ? AND date(datetime) <= ?
  `).all(therapistId, dateFrom, dateTo);

  const sessoes_realizadas = appointments.filter(a => a.status === 'completed').length;
  const sessoes_canceladas = appointments.filter(a => a.status === 'cancelled').length;
  const no_shows = appointments.filter(a => a.status === 'no_show').length;
  const slots_ocupados = appointments.filter(a => a.status !== 'cancelled').length;

  // Payments in period
  const payments = db.prepare(`
    SELECT p.amount, p.status, p.appointment_id FROM payment p
    JOIN appointments a ON a.id = p.appointment_id
    WHERE a.therapist_id = ? AND date(a.datetime) >= ? AND date(a.datetime) <= ?
  `).all(therapistId, dateFrom, dateTo);

  const receita_total = payments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0);

  const receita_esperada = payments
    .reduce((sum, p) => sum + p.amount, 0);

  const ticket_medio = sessoes_realizadas > 0 ? receita_total / sessoes_realizadas : 0;

  // Inadimplência: completed appointments without a 'paid' payment
  const completedIds = appointments.filter(a => a.status === 'completed').map(a => a.id);
  let inadimplencia = 0;
  if (completedIds.length > 0) {
    const paidSet = new Set(
      payments
        .filter(p => p.status === 'paid' && completedIds.includes(p.appointment_id))
        .map(p => p.appointment_id)
    );
    inadimplencia = completedIds.filter(id => !paidSet.has(id)).length;
  }

  // Taxa de ocupação
  const slots_disponiveis = computeTotalSlotsForPeriod(therapistId, dateFrom, dateTo);
  const taxa_ocupacao = slots_disponiveis > 0
    ? Math.round((slots_ocupados / slots_disponiveis) * 10000) / 10000
    : 0;

  res.json({
    period,
    date,
    receita_total,
    receita_esperada,
    sessoes_realizadas,
    sessoes_canceladas,
    no_shows,
    slots_ocupados,
    slots_disponiveis,
    taxa_ocupacao,
    ticket_medio,
    inadimplencia,
  });
});

// ── GET /financial/daily?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD ─────────────

router.get('/daily', (req, res) => {
  const therapistId = req.therapistId;
  const { date_from, date_to } = req.query;

  if (!date_from || !date_to) {
    return res.status(400).json({ error: 'date_from e date_to são obrigatórios (YYYY-MM-DD)' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date_from) || !/^\d{4}-\d{2}-\d{2}$/.test(date_to)) {
    return res.status(400).json({ error: 'Datas devem estar no formato YYYY-MM-DD' });
  }
  if (date_from > date_to) {
    return res.status(400).json({ error: 'date_from deve ser anterior ou igual a date_to' });
  }

  const rows = db.prepare(`
    SELECT date(a.datetime) AS date, SUM(p.amount) AS revenue
    FROM payment p
    JOIN appointments a ON a.id = p.appointment_id
    WHERE a.therapist_id = ?
      AND p.status = 'paid'
      AND date(a.datetime) >= ?
      AND date(a.datetime) <= ?
    GROUP BY date(a.datetime)
    ORDER BY date(a.datetime)
  `).all(therapistId, date_from, date_to);

  res.json(rows.map(r => ({ date: r.date, revenue: r.revenue || 0 })));
});

// ── GET /financial/pending?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD ───────────
// Completed appointments without a fully-paid payment (no payment OR status != 'paid')

router.get('/pending', (req, res) => {
  const therapistId = req.therapistId;
  const { date_from, date_to } = req.query;

  let whereExtra = '';
  const params = [therapistId];

  if (date_from) {
    whereExtra += ' AND date(a.datetime) >= ?';
    params.push(date_from);
  }
  if (date_to) {
    whereExtra += ' AND date(a.datetime) <= ?';
    params.push(date_to);
  }

  const rows = db.prepare(`
    SELECT
      a.id            AS appointment_id,
      a.datetime      AS appointment_datetime,
      a.status        AS appointment_status,
      pat.id          AS patient_id,
      pat.nome        AS patient_nome,
      p.id            AS payment_id,
      p.amount        AS payment_amount,
      p.status        AS payment_status,
      s.nome          AS service_nome,
      s.preco         AS service_preco
    FROM appointments a
    LEFT JOIN patients pat ON pat.id = a.patient_id
    LEFT JOIN services s   ON s.id  = a.service_id
    LEFT JOIN payment p    ON p.appointment_id = a.id
    WHERE a.therapist_id = ?
      AND a.status = 'completed'
      AND (p.id IS NULL OR p.status != 'paid')
      ${whereExtra}
    ORDER BY a.datetime DESC
    LIMIT 50
  `).all(...params);

  // Compute saldo_restante for each row
  const result = rows.map(row => {
    const expected = row.service_preco ?? 0;
    const paid = (row.payment_status === 'partial' && row.payment_amount != null)
      ? row.payment_amount
      : 0;
    return { ...row, saldo_restante: expected - paid };
  });

  res.json(result);
});

export default router;
