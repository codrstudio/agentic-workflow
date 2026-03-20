import { useState, useEffect, useCallback, useRef } from 'react';
import { authHeader } from '../lib/auth.js';

// ── Constants ─────────────────────────────────────────────────────────────────
const GRID_START_HOUR = 7;   // 07:00
const GRID_END_HOUR   = 20;  // 20:00
const SLOT_HEIGHT     = 48;  // px per 30-minute slot
const SLOT_MINUTES    = 30;

const STATUS_LABELS = {
  scheduled: 'Agendado',
  confirmed: 'Confirmado',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  no_show:   'Não compareceu',
};

const STATUS_TRANSITIONS = {
  scheduled: ['confirmed', 'cancelled', 'no_show'],
  confirmed: ['completed', 'cancelled', 'no_show'],
  completed: [],
  cancelled: [],
  no_show:   [],
};

// Solid block colors for calendar cells (feature spec: scheduled=blue, confirmed=green,
// completed=gray, cancelled=red, no_show=orange)
const BLOCK_COLORS = {
  scheduled: 'bg-blue-500   text-white',
  confirmed: 'bg-green-500  text-white',
  completed: 'bg-gray-400   text-white',
  cancelled: 'bg-red-400    text-white',
  no_show:   'bg-orange-400 text-white',
};

// Badge colors for list-style status display
const BADGE_COLORS = {
  scheduled: 'bg-blue-100   text-blue-800',
  confirmed: 'bg-green-100  text-green-800',
  completed: 'bg-gray-100   text-gray-700',
  cancelled: 'bg-red-100    text-red-700',
  no_show:   'bg-orange-100 text-orange-800',
};

// Confirmation status badge (F-021)
const CONFIRM_STATUS = {
  confirmed:   { dot: 'bg-white',        label: 'Confirmado',           title: 'Paciente confirmou a consulta' },
  pending:     { dot: 'bg-yellow-300',   label: 'Conf. pendente',       title: 'Aguardando confirmação do paciente' },
  no_response: { dot: 'bg-white/40',     label: 'Sem resposta',         title: 'Link de confirmação não enviado ou sem resposta' },
};

function ConfirmationBadge({ status }) {
  const cfg = CONFIRM_STATUS[status] || CONFIRM_STATUS.no_response;
  return (
    <span
      className={`shrink-0 w-2 h-2 rounded-full inline-block ${cfg.dot}`}
      title={cfg.title}
    />
  );
}

const DURATIONS = [30, 45, 60, 90, 120];

const DAY_NAMES_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DAY_NAMES_LONG  = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function weekRange(base) {
  const d   = new Date(base + 'T00:00:00');
  const day = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  return { from: mon.toISOString().slice(0, 10), to: sun.toISOString().slice(0, 10) };
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function formatDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function localToISO(dateStr, timeStr) {
  return `${dateStr}T${timeStr}:00`;
}

function minutesSinceMidnight(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAY_NAMES_SHORT[d.getDay()]} ${formatDate(dateStr)}`;
}

// ── PatientSearch ─────────────────────────────────────────────────────────────
function PatientSearch({ value, onChange }) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState([]);
  const [open,    setOpen]    = useState(false);
  const timer = useRef(null);

  useEffect(() => { setQuery(value ? value.nome : ''); }, [value]);

  function search(q) {
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await fetch(`/patients?search=${encodeURIComponent(q)}`, { headers: authHeader() });
      if (res.ok) { setResults(await res.json()); setOpen(true); }
    }, 250);
  }

  function select(patient) { onChange(patient); setQuery(patient.nome); setOpen(false); }
  function clear()          { onChange(null); setQuery(''); setResults([]); setOpen(false); }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Buscar paciente..."
          value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value); }}
          onFocus={() => query && results.length && setOpen(true)}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {value && (
          <button type="button" onClick={clear} className="text-gray-400 hover:text-gray-600 px-2">✕</button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {results.map(p => (
            <li key={p.id} onClick={() => select(p)}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-blue-50">
              <span className="font-medium">{p.nome}</span>
              {p.telefone && <span className="text-gray-400 ml-2">{p.telefone}</span>}
            </li>
          ))}
        </ul>
      )}
      {open && results.length === 0 && query.trim() && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-400">
          Nenhum paciente encontrado
        </div>
      )}
    </div>
  );
}

// ── AppointmentModal ──────────────────────────────────────────────────────────
function AppointmentModal({ appointment, defaultDate, defaultTime, onClose, onSaved }) {
  const isEdit = !!appointment;
  const [patient,  setPatient]  = useState(
    appointment?.patient_id ? { id: appointment.patient_id, nome: appointment.patient_nome } : null
  );
  const [date,     setDate]     = useState(
    appointment ? appointment.datetime.slice(0, 10) : (defaultDate || todayStr())
  );
  const [time,     setTime]     = useState(
    appointment ? appointment.datetime.slice(11, 16) : (defaultTime || '08:00')
  );
  const [duration, setDuration] = useState(appointment?.duration ?? 60);
  const [status,   setStatus]   = useState(appointment?.status ?? 'scheduled');
  const [notes,    setNotes]    = useState(appointment?.notes ?? '');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // F-022 Manual Reminder state
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderFeedback, setReminderFeedback] = useState(null); // { ok: bool, msg: string }

  const availableStatuses = isEdit
    ? [appointment.status, ...STATUS_TRANSITIONS[appointment.status]]
    : ['scheduled'];

  // Whether the "Enviar Lembrete" button should be enabled
  const canSendReminder = isEdit &&
    appointment.status !== 'cancelled' &&
    new Date(appointment.datetime.replace(' ', 'T')) > new Date();

  async function handleSendReminder() {
    setReminderLoading(true);
    setReminderFeedback(null);
    try {
      const res = await fetch(`/notifications/send-now/${appointment.id}`, {
        method: 'POST',
        headers: authHeader(),
      });
      const data = await res.json();
      if (res.ok) {
        setReminderFeedback({ ok: true, msg: data.message || 'Lembrete enviado!' });
      } else {
        setReminderFeedback({ ok: false, msg: data.error || 'Erro ao enviar lembrete' });
      }
    } catch {
      setReminderFeedback({ ok: false, msg: 'Erro de conexão' });
    } finally {
      setReminderLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = {
        patient_id: patient?.id || null,
        datetime:   localToISO(date, time),
        duration:   Number(duration),
        status,
        notes:      notes || null,
      };
      const url    = isEdit ? `/appointments/${appointment.id}` : '/appointments';
      const method = isEdit ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erro ao salvar agendamento'); return; }
      onSaved(data);
      onClose();
    } catch {
      setError('Erro de conexão');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Editar Agendamento' : 'Novo Agendamento'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paciente</label>
            <PatientSearch value={patient} onChange={setPatient} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Horário</label>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duração (min)</label>
              <select value={duration} onChange={e => setDuration(Number(e.target.value))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {DURATIONS.map(d => <option key={d} value={d}>{d} min</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {availableStatuses.map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Observações sobre a sessão..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* F-022 Manual Reminder */}
          {isEdit && (
            <div className="pt-1 border-t border-gray-100">
              <button
                type="button"
                onClick={handleSendReminder}
                disabled={reminderLoading || !canSendReminder}
                title={!canSendReminder ? 'Lembrete indisponível para agendamentos passados ou cancelados' : 'Enviar lembrete agora'}
                className="w-full flex items-center justify-center gap-2 border border-blue-300 rounded-lg py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>📩</span>
                {reminderLoading ? 'Enviando...' : 'Enviar Lembrete'}
              </button>
              {reminderFeedback && (
                <p className={`mt-1 text-xs text-center ${reminderFeedback.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {reminderFeedback.msg}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {loading ? 'Salvando...' : (isEdit ? 'Salvar' : 'Criar')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Fit-in helpers ────────────────────────────────────────────────────────────

/** Returns contiguous free ranges on a given day whose length >= minDuration. */
function getFitInBlocks(dayStr, appointments, minDuration) {
  const gridStart = GRID_START_HOUR * 60;
  const gridEnd   = GRID_END_HOUR   * 60;

  // Only count active (non-cancelled/no-show) appointments
  const appts = appointments
    .filter(a =>
      a.datetime.slice(0, 10) === dayStr &&
      a.status !== 'cancelled' && a.status !== 'no_show'
    )
    .map(a => ({
      start: minutesSinceMidnight(a.datetime.slice(11, 16)),
      end:   minutesSinceMidnight(a.datetime.slice(11, 16)) + a.duration,
    }))
    .sort((a, b) => a.start - b.start);

  const blocks = [];
  let cursor = gridStart;

  for (const appt of appts) {
    const apptStart = Math.max(appt.start, gridStart);
    const apptEnd   = Math.min(appt.end,   gridEnd);
    if (apptStart > cursor) {
      const dur = apptStart - cursor;
      if (dur >= minDuration) blocks.push({ start: cursor, end: apptStart, duration: dur });
    }
    cursor = Math.max(cursor, apptEnd);
  }

  if (cursor < gridEnd) {
    const dur = gridEnd - cursor;
    if (dur >= minDuration) blocks.push({ start: cursor, end: gridEnd, duration: dur });
  }

  return blocks;
}

function minsToTimeStr(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

// ── CalendarGrid ──────────────────────────────────────────────────────────────
function CalendarGrid({ days, appointments, onSlotClick, onAppointmentClick, fitInMode, fitInMinDuration }) {
  const gridStartMins = GRID_START_HOUR * 60;
  const totalSlots    = (GRID_END_HOUR - GRID_START_HOUR) * 2; // 26 half-hour slots
  const totalHeight   = totalSlots * SLOT_HEIGHT;              // 1248px
  const hourCount     = GRID_END_HOUR - GRID_START_HOUR;       // 13

  // Group appointments by date
  const byDate = {};
  for (const a of appointments) {
    const d = a.datetime.slice(0, 10);
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(a);
  }

  // Hour labels (left column)
  const hourLabels = Array.from({ length: hourCount }, (_, i) => {
    const h = GRID_START_HOUR + i;
    return `${String(h).padStart(2, '0')}:00`;
  });

  // Generate clickable slot info for a day
  function getSlotInfo(dayStr, slotIndex) {
    const slotMins = gridStartMins + slotIndex * SLOT_MINUTES;
    const h = Math.floor(slotMins / 60);
    const m = slotMins % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const appts   = byDate[dayStr] || [];
    const occupied = appts.some(a => {
      const aStart = minutesSinceMidnight(a.datetime.slice(11, 16));
      const aEnd   = aStart + a.duration;
      return slotMins >= aStart && slotMins < aEnd;
    });
    return { timeStr, occupied };
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header row */}
      <div className="flex border-b border-gray-200">
        {/* Time gutter header */}
        <div className="w-14 shrink-0 border-r border-gray-200" />
        {/* Day headers */}
        {days.map(day => {
          const isToday = day === todayStr();
          const d = new Date(day + 'T00:00:00');
          const dayNum = d.getDate();
          const dayName = DAY_NAMES_SHORT[d.getDay()];
          return (
            <div key={day}
              className={`flex-1 min-w-0 h-12 flex flex-col items-center justify-center border-r last:border-r-0 border-gray-100 ${isToday ? 'bg-blue-50' : ''}`}>
              <span className={`text-xs font-medium ${isToday ? 'text-blue-600' : 'text-gray-500'}`}>
                {dayName}
              </span>
              <span className={`text-sm font-bold leading-none ${isToday ? 'text-blue-700 bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center mt-0.5' : 'text-gray-800'}`}>
                {isToday ? (
                  <span className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                    {dayNum}
                  </span>
                ) : dayNum}
              </span>
            </div>
          );
        })}
      </div>

      {/* Body: time gutter + day columns */}
      <div className="flex overflow-y-auto" style={{ maxHeight: '70vh' }}>
        {/* Time gutter */}
        <div className="w-14 shrink-0 border-r border-gray-200 relative" style={{ height: totalHeight }}>
          {hourLabels.map((label, i) => (
            <div key={label} className="absolute w-full pr-2 flex justify-end"
              style={{ top: i * SLOT_HEIGHT * 2 - 8 }}>
              {i > 0 && (
                <span className="text-xs text-gray-400 leading-none">{label}</span>
              )}
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map(day => {
          const appts   = byDate[day] || [];
          const isToday = day === todayStr();

          return (
            <div key={day}
              className={`flex-1 min-w-0 border-r last:border-r-0 border-gray-100 relative ${isToday ? 'bg-blue-50/20' : ''}`}
              style={{ height: totalHeight }}>

              {/* Hour grid lines */}
              {Array.from({ length: hourCount + 1 }, (_, i) => (
                <div key={`h-${i}`} className="absolute w-full border-t border-gray-100"
                  style={{ top: i * SLOT_HEIGHT * 2 }} />
              ))}

              {/* Half-hour grid lines */}
              {Array.from({ length: hourCount }, (_, i) => (
                <div key={`hh-${i}`} className="absolute w-full border-t border-gray-50"
                  style={{ top: i * SLOT_HEIGHT * 2 + SLOT_HEIGHT }} />
              ))}

              {/* Clickable empty slots */}
              {Array.from({ length: totalSlots }, (_, i) => {
                const { timeStr, occupied } = getSlotInfo(day, i);
                if (occupied) return null;
                return (
                  <div key={`slot-${i}`}
                    onClick={() => onSlotClick(day, timeStr)}
                    className="absolute w-full cursor-pointer hover:bg-blue-100/40 transition-colors"
                    style={{ top: i * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                    title={`${timeStr} — clique para agendar`}
                  />
                );
              })}

              {/* Fit-in blocks (F-011) */}
              {fitInMode && getFitInBlocks(day, appointments, fitInMinDuration).map((block, idx) => {
                const top     = ((block.start - gridStartMins) / SLOT_MINUTES) * SLOT_HEIGHT;
                const height  = (block.duration / SLOT_MINUTES) * SLOT_HEIGHT;
                const timeStr = minsToTimeStr(block.start);
                const label   = block.duration >= 60
                  ? `${Math.floor(block.duration / 60)}h${block.duration % 60 > 0 ? String(block.duration % 60).padStart(2,'0') : ''} livre`
                  : `${block.duration}min livre`;
                return (
                  <div key={`fitin-${idx}`}
                    onClick={() => onSlotClick(day, timeStr)}
                    className="absolute left-0.5 right-0.5 border-2 border-dashed border-emerald-400 bg-emerald-50/70 rounded-md cursor-pointer hover:bg-emerald-100/90 transition-colors flex flex-col items-center justify-start pt-1 gap-0.5 select-none"
                    style={{ top: top + 1, height: height - 2, zIndex: 5 }}
                    title={`Encaixe: ${label} a partir das ${timeStr} — clique para agendar`}>
                    <span className="text-emerald-600 text-xs font-bold leading-none">+</span>
                    {height >= SLOT_HEIGHT * 1.5 && (
                      <span className="text-emerald-700 text-xs font-medium leading-none">{label}</span>
                    )}
                  </div>
                );
              })}

              {/* Appointment blocks */}
              {appts.map(a => {
                const startMins = minutesSinceMidnight(a.datetime.slice(11, 16));
                // Skip if outside grid
                if (startMins < gridStartMins || startMins >= GRID_END_HOUR * 60) return null;
                const top    = ((startMins - gridStartMins) / SLOT_MINUTES) * SLOT_HEIGHT;
                const height = Math.max((a.duration / SLOT_MINUTES) * SLOT_HEIGHT - 2, SLOT_HEIGHT - 2);

                return (
                  <div key={a.id}
                    onClick={() => onAppointmentClick(a)}
                    className={`absolute left-0.5 right-0.5 rounded-md px-1.5 py-0.5 cursor-pointer shadow-sm overflow-hidden select-none ${BLOCK_COLORS[a.status]}`}
                    style={{ top: top + 1, height, zIndex: 10 }}
                    title={`${a.patient_nome || 'Sem paciente'} — ${STATUS_LABELS[a.status]}`}>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold truncate leading-tight flex-1">
                        {a.patient_nome || '—'}
                      </span>
                      <ConfirmationBadge status={a.confirmation_status} />
                    </div>
                    {height > SLOT_HEIGHT * 0.8 && (
                      <div className="text-xs opacity-80 leading-tight">
                        {a.datetime.slice(11, 16)} · {a.duration}min
                      </div>
                    )}
                    {height > SLOT_HEIGHT * 1.5 && (
                      <div className="text-xs opacity-70 leading-tight truncate">
                        {STATUS_LABELS[a.status]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Agenda page ──────────────────────────────────────────────────────────
const FIT_IN_DURATIONS = [30, 45, 60, 90];

export default function Agenda() {
  const [view,              setView]             = useState('week'); // 'day' | 'week'
  const [baseDate,          setBaseDate]         = useState(todayStr());
  const [appointments,      setAppointments]     = useState([]);
  const [loading,           setLoading]          = useState(false);
  const [modal,             setModal]            = useState(null);
  const [cancelConfirm,     setCancelConfirm]    = useState(null);
  const [fitInMode,         setFitInMode]        = useState(false);
  const [fitInMinDuration,  setFitInMinDuration] = useState(30);

  // Determine date range based on view
  const dateRange = view === 'week' ? weekRange(baseDate) : { from: baseDate, to: baseDate };
  const { from, to } = dateRange;

  // Build day list
  const days = [];
  const startDay = new Date(from + 'T00:00:00');
  const endDay   = new Date(to   + 'T00:00:00');
  for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/appointments?date_from=${from}&date_to=${to}`, { headers: authHeader() });
      if (res.ok) setAppointments(await res.json());
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  function prevPeriod() {
    setBaseDate(prev => view === 'week' ? addDays(prev, -7) : addDays(prev, -1));
  }

  function nextPeriod() {
    setBaseDate(prev => view === 'week' ? addDays(prev, 7) : addDays(prev, 1));
  }

  function periodLabel() {
    if (view === 'day') {
      const d = new Date(baseDate + 'T00:00:00');
      return `${DAY_NAMES_LONG[d.getDay()]}, ${formatDate(baseDate)}`;
    }
    return `${formatDate(from)} – ${formatDate(to)}`;
  }

  function handleSlotClick(day, time) {
    setModal({ defaultDate: day, defaultTime: time });
  }

  function handleAppointmentClick(appt) {
    setModal({ appointment: appt });
  }

  async function handleCancel(appt) {
    await fetch(`/appointments/${appt.id}`, { method: 'DELETE', headers: authHeader() });
    setCancelConfirm(null);
    load();
  }

  return (
    <div className="p-6 grid grid-cols-1 gap-6 items-start">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <button onClick={prevPeriod}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 text-lg leading-none">‹</button>
          <span className="text-sm font-semibold text-gray-800 min-w-[180px] text-center">
            {periodLabel()}
          </span>
          <button onClick={nextPeriod}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 text-lg leading-none">›</button>
          <button
            onClick={() => { setBaseDate(todayStr()); }}
            className="ml-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
            Hoje
          </button>
        </div>

        {/* View toggle + New button */}
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setView('day')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'day' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Dia
            </button>
            <button
              onClick={() => setView('week')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 ${view === 'week' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
              Semana
            </button>
          </div>

          {/* Fit-in toggle */}
          <button
            onClick={() => setFitInMode(m => !m)}
            className={`text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${fitInMode ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            title="Mostrar encaixes disponíveis">
            ⬡ Encaixes
          </button>

          {fitInMode && (
            <select
              value={fitInMinDuration}
              onChange={e => setFitInMinDuration(Number(e.target.value))}
              className="border border-emerald-300 rounded-lg px-2 py-2 text-xs text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-emerald-50">
              {FIT_IN_DURATIONS.map(d => (
                <option key={d} value={d}>{d}min mín.</option>
              ))}
            </select>
          )}

          <button
            onClick={() => setModal({ defaultDate: baseDate })}
            className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700">
            + Novo agendamento
          </button>
        </div>
      </div>

      {/* ── Status legend ── */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <span key={key} className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_COLORS[key]}`}>
            {label}
          </span>
        ))}
        {fitInMode && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800 border border-dashed border-emerald-400">
            + Encaixe ≥{fitInMinDuration}min
          </span>
        )}
      </div>

      {/* ── Confirmation legend ── */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="font-medium text-gray-400">Confirmação:</span>
        {Object.entries(CONFIRM_STATUS).map(([key, cfg]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full inline-block ${key === 'no_response' ? 'bg-gray-400' : key === 'pending' ? 'bg-yellow-400' : 'bg-green-500'}`} />
            {cfg.label}
          </span>
        ))}
      </div>

      {/* ── Calendar Grid ── */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">Carregando...</div>
      ) : (
        <CalendarGrid
          days={days}
          appointments={appointments}
          onSlotClick={handleSlotClick}
          onAppointmentClick={handleAppointmentClick}
          fitInMode={fitInMode}
          fitInMinDuration={fitInMinDuration}
        />
      )}

      {/* ── New / Edit Modal ── */}
      {modal && (
        <AppointmentModal
          appointment={modal.appointment}
          defaultDate={modal.defaultDate}
          defaultTime={modal.defaultTime}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}

      {/* ── Cancel confirmation ── */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Cancelar agendamento?</h3>
            <p className="text-sm text-gray-500 mb-4">
              {cancelConfirm.patient_nome || 'Sem paciente'} — {formatDateTime(cancelConfirm.datetime)}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setCancelConfirm(null)}
                className="flex-1 border border-gray-300 rounded-lg py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Voltar
              </button>
              <button onClick={() => handleCancel(cancelConfirm)}
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700">
                Cancelar agendamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
