import { Router } from 'express';
import { randomBytes } from 'crypto';
import db from '../db.js';

const router = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getClinicBySlug(slug) {
  return db.prepare(
    'SELECT * FROM clinic_page WHERE slug = ? AND ativa = 1'
  ).get(slug);
}

function parseClinicPage(page) {
  return {
    ...page,
    servicos_visiveis: JSON.parse(page.servicos_visiveis || '[]'),
    ativa: page.ativa === 1,
  };
}

// ─── Slot calculation helpers (public) ───────────────────────────────────────

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
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

function calculateSlots(therapistId, date, duration, interval) {
  const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay();

  const blocks = db.prepare(
    'SELECT hora_inicio, hora_fim FROM availability WHERE therapist_id = ? AND dia_semana = ? AND ativo = 1'
  ).all(therapistId, dayOfWeek);

  let ranges = blocks.map(b => [timeToMinutes(b.hora_inicio), timeToMinutes(b.hora_fim)]);
  ranges = mergeRanges(ranges);

  const overrides = db.prepare(
    'SELECT tipo, hora_inicio, hora_fim FROM availability_override WHERE therapist_id = ? AND data = ?'
  ).all(therapistId, date);

  for (const ov of overrides) {
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

  const appointments = db.prepare(
    `SELECT datetime, duration FROM appointments
     WHERE therapist_id = ? AND date(datetime) = ? AND status NOT IN ('cancelled')`
  ).all(therapistId, date);

  const aptRanges = appointments.map(apt => {
    const timePart = apt.datetime.substring(11, 16);
    const start = timeToMinutes(timePart);
    return [start, start + apt.duration];
  });

  const slots = [];
  for (const [rangeStart, rangeEnd] of ranges) {
    let slotStart = rangeStart;
    while (slotStart + duration <= rangeEnd) {
      const slotEnd = slotStart + duration;
      const available = !aptRanges.some(([aptStart, aptEnd]) => slotStart < aptEnd && slotEnd > aptStart);
      slots.push({ start: minutesToTime(slotStart), end: minutesToTime(slotEnd), available });
      slotStart = slotEnd + interval;
    }
  }
  return slots;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// ─── Confirmation Flow (F-020) ────────────────────────────────────────────────

// GET /public/confirm/:token — exibe dados do agendamento para confirmação/cancelamento
router.get('/confirm/:token', (req, res) => {
  const { token } = req.params;

  const row = db.prepare(
    `SELECT ct.token, ct.appointment_id, ct.action, ct.used_at,
            a.datetime, a.duration, a.status, a.notes,
            t.name AS therapist_name,
            cs.clinic_name,
            p.nome AS patient_name
     FROM confirmation_tokens ct
     JOIN appointments a ON a.id = ct.appointment_id
     JOIN therapists t ON t.id = a.therapist_id
     LEFT JOIN clinic_settings cs ON cs.id = 1
     LEFT JOIN patients p ON p.id = a.patient_id
     WHERE ct.token = ?`
  ).get(token);

  if (!row) {
    return res.status(404).json({ error: 'Token inválido ou não encontrado' });
  }

  if (row.used_at) {
    return res.status(410).json({
      error: 'Token já utilizado',
      action: row.action,
      used_at: row.used_at,
    });
  }

  res.json({
    token: row.token,
    appointment_id: row.appointment_id,
    datetime: row.datetime,
    duration: row.duration,
    status: row.status,
    notes: row.notes,
    therapist_name: row.therapist_name,
    clinic_name: row.clinic_name || row.therapist_name,
    patient_name: row.patient_name,
  });
});

// POST /public/confirm/:token — confirmar ou cancelar agendamento
router.post('/confirm/:token', (req, res) => {
  const { token } = req.params;
  const { action } = req.body;

  if (!action || !['confirm', 'cancel'].includes(action)) {
    return res.status(400).json({ error: 'action deve ser "confirm" ou "cancel"' });
  }

  const row = db.prepare(
    'SELECT * FROM confirmation_tokens WHERE token = ?'
  ).get(token);

  if (!row) {
    return res.status(404).json({ error: 'Token inválido ou não encontrado' });
  }

  if (row.used_at) {
    return res.status(410).json({ error: 'Token já utilizado', action: row.action });
  }

  const newStatus = action === 'confirm' ? 'confirmed' : 'cancelled';
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);

  db.transaction(() => {
    db.prepare(
      'UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?'
    ).run(newStatus, now, row.appointment_id);

    db.prepare(
      'UPDATE confirmation_tokens SET action = ?, used_at = ? WHERE token = ?'
    ).run(action, now, token);
  })();

  res.json({ success: true, action, status: newStatus });
});

// ─── Reschedule Flow (F-026) ──────────────────────────────────────────────────

// GET /public/reschedule/:token — exibe agendamento atual e slots disponíveis
router.get('/reschedule/:token', (req, res) => {
  const { token } = req.params;
  const { date } = req.query;

  const booking = db.prepare(
    `SELECT b.booking_token, b.patient_name,
            a.id AS appointment_id, a.datetime, a.duration, a.status,
            a.therapist_id,
            t.name AS therapist_name, t.session_duration, t.session_interval,
            cs.clinic_name
     FROM bookings b
     JOIN appointments a ON a.id = b.appointment_id
     JOIN therapists t ON t.id = a.therapist_id
     LEFT JOIN clinic_settings cs ON cs.id = 1
     WHERE b.booking_token = ?`
  ).get(token);

  if (!booking) {
    return res.status(404).json({ error: 'Token inválido ou não encontrado' });
  }

  if (booking.status === 'cancelled') {
    return res.status(410).json({ error: 'Agendamento cancelado' });
  }

  if (booking.status === 'completed') {
    return res.status(410).json({ error: 'Agendamento já realizado' });
  }

  // Check cancellation policy window
  const policy = db.prepare(
    'SELECT janela_horas, ativa FROM cancellation_policy WHERE therapist_id = ?'
  ).get(booking.therapist_id);

  const appointmentTime = new Date(booking.datetime.replace(' ', 'T'));
  const now = new Date();
  const hoursUntilAppointment = (appointmentTime - now) / (1000 * 60 * 60);

  const janela = policy?.ativa ? policy.janela_horas : 0;
  const withinWindow = janela === 0 || hoursUntilAppointment > janela;

  const response = {
    booking_token: booking.booking_token,
    appointment_id: booking.appointment_id,
    datetime: booking.datetime,
    duration: booking.duration,
    status: booking.status,
    patient_name: booking.patient_name,
    therapist_name: booking.therapist_name,
    clinic_name: booking.clinic_name || booking.therapist_name,
    can_reschedule: withinWindow,
    janela_horas: janela,
  };

  // If date requested, return slots for that date
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const duration = booking.duration || booking.session_duration || 60;
    const interval = booking.session_interval || 0;
    // Exclude current appointment from slot blocking so its time shows as available
    const slotsRaw = calculateSlotsExcluding(booking.therapist_id, date, duration, interval, booking.appointment_id);
    response.slots = slotsRaw;
    response.slots_date = date;
  }

  res.json(response);
});

// POST /public/reschedule/:token — executa reagendamento para novo horário
router.post('/reschedule/:token', (req, res) => {
  const { token } = req.params;
  const { date, time, reason } = req.body;

  if (!date || !time) {
    return res.status(400).json({ error: 'Campos obrigatórios: date (YYYY-MM-DD), time (HH:MM)' });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return res.status(400).json({ error: 'Formato inválido. Use date=YYYY-MM-DD e time=HH:MM' });
  }

  const booking = db.prepare(
    `SELECT b.booking_token, b.patient_name,
            a.id AS appointment_id, a.datetime, a.duration, a.status,
            a.therapist_id,
            t.session_duration, t.session_interval
     FROM bookings b
     JOIN appointments a ON a.id = b.appointment_id
     JOIN therapists t ON t.id = a.therapist_id
     WHERE b.booking_token = ?`
  ).get(token);

  if (!booking) {
    return res.status(404).json({ error: 'Token inválido ou não encontrado' });
  }

  if (booking.status === 'cancelled') {
    return res.status(410).json({ error: 'Agendamento cancelado' });
  }

  if (booking.status === 'completed') {
    return res.status(410).json({ error: 'Agendamento já realizado' });
  }

  // Check cancellation policy window
  const policy = db.prepare(
    'SELECT janela_horas, ativa FROM cancellation_policy WHERE therapist_id = ?'
  ).get(booking.therapist_id);

  const appointmentTime = new Date(booking.datetime.replace(' ', 'T'));
  const now = new Date();
  const hoursUntilAppointment = (appointmentTime - now) / (1000 * 60 * 60);

  const janela = policy?.ativa ? policy.janela_horas : 0;
  if (janela > 0 && hoursUntilAppointment <= janela) {
    return res.status(403).json({
      error: `Reagendamento não permitido. A política exige aviso de pelo menos ${janela} hora(s) de antecedência`,
      janela_horas: janela,
    });
  }

  // Validate new slot availability (excluding current appointment)
  const duration = booking.duration || booking.session_duration || 60;
  const interval = booking.session_interval || 0;
  const slots = calculateSlotsExcluding(booking.therapist_id, date, duration, interval, booking.appointment_id);
  const slot = slots.find(s => s.start === time);

  if (!slot) {
    return res.status(400).json({ error: 'Horário não disponível' });
  }

  if (!slot.available) {
    return res.status(409).json({ error: 'Horário já ocupado' });
  }

  const newDatetime = `${date} ${time}`;
  const oldDatetime = booking.datetime;
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

  db.transaction(() => {
    db.prepare(
      'UPDATE appointments SET datetime = ?, status = ?, updated_at = ? WHERE id = ?'
    ).run(newDatetime, 'scheduled', nowStr, booking.appointment_id);

    db.prepare(
      `INSERT INTO reschedule_log (appointment_id, old_datetime, new_datetime, reason, initiated_by)
       VALUES (?, ?, ?, ?, 'patient')`
    ).run(booking.appointment_id, oldDatetime, newDatetime, reason || null);
  })();

  res.json({
    success: true,
    appointment_id: booking.appointment_id,
    old_datetime: oldDatetime,
    new_datetime: newDatetime,
  });
});

// ─── Slot helper that excludes a specific appointment (for reschedule) ────────

function calculateSlotsExcluding(therapistId, date, duration, interval, excludeAppointmentId) {
  const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay();

  const blocks = db.prepare(
    'SELECT hora_inicio, hora_fim FROM availability WHERE therapist_id = ? AND dia_semana = ? AND ativo = 1'
  ).all(therapistId, dayOfWeek);

  let ranges = blocks.map(b => [timeToMinutes(b.hora_inicio), timeToMinutes(b.hora_fim)]);
  ranges = mergeRanges(ranges);

  const overrides = db.prepare(
    'SELECT tipo, hora_inicio, hora_fim FROM availability_override WHERE therapist_id = ? AND data = ?'
  ).all(therapistId, date);

  for (const ov of overrides) {
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

  const appointments = db.prepare(
    `SELECT datetime, duration FROM appointments
     WHERE therapist_id = ? AND date(datetime) = ? AND status NOT IN ('cancelled') AND id != ?`
  ).all(therapistId, date, excludeAppointmentId);

  const aptRanges = appointments.map(apt => {
    const timePart = apt.datetime.substring(11, 16);
    const start = timeToMinutes(timePart);
    return [start, start + apt.duration];
  });

  const slots = [];
  for (const [rangeStart, rangeEnd] of ranges) {
    let slotStart = rangeStart;
    while (slotStart + duration <= rangeEnd) {
      const slotEnd = slotStart + duration;
      const available = !aptRanges.some(([aptStart, aptEnd]) => slotStart < aptEnd && slotEnd > aptStart);
      slots.push({ start: minutesToTime(slotStart), end: minutesToTime(slotEnd), available });
      slotStart = slotEnd + interval;
    }
  }
  return slots;
}

// ─── Booking token lookup ─────────────────────────────────────────────────────

// GET /public/booking/:token — consultar status do booking pelo token
// Must be defined BEFORE /:clinic_slug to avoid route conflict
router.get('/booking/:token', (req, res) => {
  const { token } = req.params;

  const booking = db.prepare(
    `SELECT b.booking_token, b.patient_name, b.patient_phone, b.patient_email,
            b.criado_via, b.created_at,
            a.datetime, a.duration, a.status, a.notes,
            t.name AS therapist_name,
            cs.clinic_name
     FROM bookings b
     JOIN appointments a ON a.id = b.appointment_id
     JOIN therapists t ON t.id = a.therapist_id
     LEFT JOIN clinic_settings cs ON cs.id = 1
     WHERE b.booking_token = ?`
  ).get(token);

  if (!booking) {
    return res.status(404).json({ error: 'Booking não encontrado' });
  }

  res.json({
    booking_token: booking.booking_token,
    patient_name: booking.patient_name,
    datetime: booking.datetime,
    duration: booking.duration,
    status: booking.status,
    notes: booking.notes,
    therapist_name: booking.therapist_name,
    clinic_name: booking.clinic_name || booking.therapist_name,
    created_at: booking.created_at,
  });
});

// GET /public/:clinic_slug
router.get('/:clinic_slug', (req, res) => {
  const { clinic_slug } = req.params;

  const page = getClinicBySlug(clinic_slug);
  if (!page) {
    return res.status(404).json({ error: 'Página não encontrada' });
  }

  const parsed = parseClinicPage(page);

  const therapist = db.prepare(
    'SELECT id, name, photo_url FROM therapists WHERE id = ?'
  ).get(page.therapist_id);

  const settings = db.prepare('SELECT clinic_name, address, logo_url FROM clinic_settings WHERE id = 1').get();

  res.json({
    slug: parsed.slug,
    clinic_name: settings?.clinic_name || therapist?.name || '',
    therapist_name: therapist?.name || '',
    descricao: parsed.descricao || '',
    foto_capa: parsed.foto_capa || settings?.logo_url || therapist?.photo_url || null,
    address: settings?.address || '',
  });
});

// GET /public/:clinic_slug/services
router.get('/:clinic_slug/services', (req, res) => {
  const { clinic_slug } = req.params;

  const page = getClinicBySlug(clinic_slug);
  if (!page) {
    return res.status(404).json({ error: 'Página não encontrada' });
  }

  const parsed = parseClinicPage(page);
  const servicosVisiveis = parsed.servicos_visiveis;

  let services;
  if (servicosVisiveis.length === 0) {
    services = db.prepare(
      'SELECT id, nome, duracao, descricao, preco FROM services WHERE therapist_id = ? AND ativo = 1 ORDER BY nome ASC'
    ).all(page.therapist_id);
  } else {
    const placeholders = servicosVisiveis.map(() => '?').join(',');
    services = db.prepare(
      `SELECT id, nome, duracao, descricao, preco FROM services
       WHERE therapist_id = ? AND ativo = 1 AND id IN (${placeholders})
       ORDER BY nome ASC`
    ).all(page.therapist_id, ...servicosVisiveis);
  }

  res.json(services);
});

// GET /public/:clinic_slug/slots?service_id=&date=YYYY-MM-DD
router.get('/:clinic_slug/slots', (req, res) => {
  const { clinic_slug } = req.params;
  const { service_id, date } = req.query;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'Parâmetro date é obrigatório (YYYY-MM-DD)' });
  }

  const page = getClinicBySlug(clinic_slug);
  if (!page) {
    return res.status(404).json({ error: 'Página não encontrada' });
  }

  const therapist = db.prepare(
    'SELECT session_duration, session_interval FROM therapists WHERE id = ?'
  ).get(page.therapist_id);

  if (!therapist) {
    return res.status(404).json({ error: 'Terapeuta não encontrado' });
  }

  let duration = therapist.session_duration || 60;
  const interval = therapist.session_interval || 0;

  // If service_id provided, use service duration
  if (service_id) {
    const service = db.prepare(
      'SELECT duracao FROM services WHERE id = ? AND therapist_id = ? AND ativo = 1'
    ).get(Number(service_id), page.therapist_id);
    if (service) {
      duration = service.duracao;
    }
  }

  const slots = calculateSlots(page.therapist_id, date, duration, interval);
  res.json(slots);
});

// GET /public/:clinic_slug/policy — retorna política de cancelamento ativa (F-025)
router.get('/:clinic_slug/policy', (req, res) => {
  const { clinic_slug } = req.params;

  const page = getClinicBySlug(clinic_slug);
  if (!page) {
    return res.status(404).json({ error: 'Página não encontrada' });
  }

  const policy = db.prepare(
    'SELECT janela_horas, taxa_noshow, mensagem, ativa, updated_at FROM cancellation_policy WHERE therapist_id = ?'
  ).get(page.therapist_id);

  if (!policy || !policy.ativa) {
    return res.json({ ativa: false });
  }

  res.json({
    ativa: true,
    janela_horas: policy.janela_horas,
    taxa_noshow: policy.taxa_noshow,
    mensagem: policy.mensagem,
    policy_version: policy.updated_at,
  });
});

// POST /public/:clinic_slug/book
router.post('/:clinic_slug/book', (req, res) => {
  const { clinic_slug } = req.params;
  const { service_id, date, time, patient_name, patient_phone, patient_email, aceite_politica } = req.body;

  if (!service_id || !date || !time || !patient_name || !patient_phone) {
    return res.status(400).json({ error: 'Campos obrigatórios: service_id, date, time, patient_name, patient_phone' });
  }

  const page = getClinicBySlug(clinic_slug);
  if (!page) {
    return res.status(404).json({ error: 'Página não encontrada' });
  }

  // F-025: Check cancellation policy enforcement
  const policy = db.prepare(
    'SELECT ativa, updated_at FROM cancellation_policy WHERE therapist_id = ?'
  ).get(page.therapist_id);

  const policyAtiva = policy && policy.ativa;
  if (policyAtiva && !aceite_politica) {
    return res.status(400).json({ error: 'Aceite da política de cancelamento é obrigatório' });
  }

  const service = db.prepare(
    'SELECT id, duracao, nome FROM services WHERE id = ? AND therapist_id = ? AND ativo = 1'
  ).get(Number(service_id), page.therapist_id);

  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado' });
  }

  // Validate slot is available
  const therapist = db.prepare(
    'SELECT session_interval FROM therapists WHERE id = ?'
  ).get(page.therapist_id);

  const slots = calculateSlots(page.therapist_id, date, service.duracao, therapist?.session_interval || 0);
  const slot = slots.find(s => s.start === time);
  if (!slot) {
    return res.status(400).json({ error: 'Horário não disponível' });
  }
  if (!slot.available) {
    return res.status(409).json({ error: 'Horário já ocupado' });
  }

  const datetime = `${date} ${time}`;
  const booking_token = randomBytes(16).toString('hex');
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || null;

  const createAppointmentAndBooking = db.transaction(() => {
    const apt = db.prepare(
      `INSERT INTO appointments (therapist_id, datetime, duration, status, notes, created_by)
       VALUES (?, ?, ?, 'scheduled', ?, 'online')`
    ).run(page.therapist_id, datetime, service.duracao, `Serviço: ${service.nome}`);

    db.prepare(
      `INSERT INTO bookings (appointment_id, booking_token, patient_name, patient_phone, patient_email, aceite_politica)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(apt.lastInsertRowid, booking_token, patient_name, patient_phone, patient_email || null, aceite_politica ? 1 : 0);

    // F-025: Record policy acceptance if policy is active
    if (policyAtiva && aceite_politica) {
      db.prepare(
        `INSERT INTO policy_acceptance (patient_id, appointment_id, accepted_at, policy_version, ip)
         VALUES (?, ?, datetime('now'), ?, ?)`
      ).run(null, apt.lastInsertRowid, policy.updated_at, clientIp);
    }

    return apt.lastInsertRowid;
  });

  try {
    const appointmentId = createAppointmentAndBooking();
    res.status(201).json({ booking_token, appointment_id: appointmentId });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao criar agendamento' });
  }
});

export default router;
