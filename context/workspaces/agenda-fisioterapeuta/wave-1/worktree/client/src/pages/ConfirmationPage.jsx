import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuracao(min) {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatDatetime(datetimeStr) {
  if (!datetimeStr) return { date: '', time: '' };
  const [datePart, timePart] = datetimeStr.split(' ');
  const [y, mo, d] = datePart.split('-').map(Number);
  const dt = new Date(y, mo - 1, d);
  const date = dt.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const time = timePart ? timePart.substring(0, 5) : '';
  return { date, time };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function InfoRow({ icon, label, primary, secondary }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-sm font-semibold text-gray-900">{primary}</p>
        {secondary && <p className="text-xs text-gray-400 mt-0.5">{secondary}</p>}
      </div>
    </div>
  );
}

const CalendarIcon = (
  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const UserIcon = (
  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const ClipboardIcon = (
  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

// ─── Loading / Error states ──────────────────────────────────────────────────

function CenteredCard({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        {children}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500 text-sm">Carregando...</p>
    </div>
  );
}

function NotFoundState({ token }) {
  return (
    <CenteredCard>
      <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Link inválido</h1>
      <p className="text-gray-500 text-sm mb-4">
        Este link de confirmação é inválido ou não existe.
      </p>
      <p className="text-xs text-gray-400 font-mono break-all bg-gray-50 rounded-lg px-3 py-2">{token}</p>
    </CenteredCard>
  );
}

function AlreadyUsedState({ action }) {
  const isConfirmed = action === 'confirm';
  return (
    <CenteredCard>
      <div className={`w-16 h-16 ${isConfirmed ? 'bg-green-100' : 'bg-orange-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
        {isConfirmed ? (
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">Link já utilizado</h1>
      <p className="text-gray-500 text-sm">
        {isConfirmed
          ? 'Você já confirmou sua sessão anteriormente.'
          : action === 'cancel'
          ? 'Você já cancelou sua sessão anteriormente.'
          : 'Este link de confirmação já foi utilizado.'}
      </p>
    </CenteredCard>
  );
}

function DoneState({ action }) {
  const isConfirmed = action === 'confirm';
  return (
    <CenteredCard>
      <div className={`w-16 h-16 ${isConfirmed ? 'bg-green-100' : 'bg-orange-100'} rounded-full flex items-center justify-center mx-auto mb-4`}>
        {isConfirmed ? (
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">
        {isConfirmed ? 'Sessão confirmada!' : 'Sessão cancelada'}
      </h1>
      <p className="text-gray-500 text-sm">
        {isConfirmed
          ? 'Obrigado! Sua presença foi confirmada. Até logo!'
          : 'Seu cancelamento foi registrado. Se quiser reagendar, entre em contato com o terapeuta.'}
      </p>
    </CenteredCard>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ConfirmationPage() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [alreadyUsed, setAlreadyUsed] = useState(null); // stores action string if used
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // stores action string when done

  useEffect(() => {
    fetch(`/public/confirm/${token}`)
      .then(async r => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return; }
        if (r.status === 410) {
          const body = await r.json();
          setAlreadyUsed(body.action || '');
          setLoading(false);
          return;
        }
        if (!r.ok) { setNotFound(true); setLoading(false); return; }
        const body = await r.json();
        setData(body);
        setLoading(false);
      })
      .catch(() => { setNotFound(true); setLoading(false); });
  }, [token]);

  const handleAction = async (action) => {
    setSubmitting(true);
    try {
      const r = await fetch(`/public/confirm/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (r.status === 410) {
        const body = await r.json();
        setAlreadyUsed(body.action || action);
        return;
      }
      if (!r.ok) {
        alert('Ocorreu um erro. Tente novamente.');
        return;
      }
      setDone(action);
    } catch {
      alert('Ocorreu um erro de rede. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState />;
  if (notFound) return <NotFoundState token={token} />;
  if (alreadyUsed !== null) return <AlreadyUsedState action={alreadyUsed} />;
  if (done) return <DoneState action={done} />;
  if (!data) return <NotFoundState token={token} />;

  const { date, time } = formatDatetime(data.datetime);
  const serviceName = data.notes?.replace(/^Serviço:\s*/i, '') || 'Sessão de fisioterapia';

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-md mx-auto">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Confirmação de sessão</h1>
          {data.clinic_name && (
            <p className="text-gray-500 text-sm mt-1">{data.clinic_name}</p>
          )}
        </div>

        {/* Appointment details */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-4">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Detalhes do agendamento
          </h2>
          <div className="space-y-3">
            <InfoRow
              icon={CalendarIcon}
              label="Data e horário"
              primary={<span className="capitalize">{date}</span>}
              secondary={`às ${time} · ${formatDuracao(data.duration)}`}
            />
            <InfoRow
              icon={ClipboardIcon}
              label="Serviço"
              primary={serviceName}
            />
            <InfoRow
              icon={UserIcon}
              label="Terapeuta"
              primary={data.therapist_name}
            />
            {data.patient_name && (
              <InfoRow
                icon={UserIcon}
                label="Paciente"
                primary={data.patient_name}
              />
            )}
          </div>
        </div>

        {/* Action card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mb-6">
          <p className="text-sm text-gray-700 font-medium mb-4 text-center">
            Você vai comparecer a esta sessão?
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleAction('confirm')}
              disabled={submitting}
              className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Confirmo minha sessão
            </button>

            <button
              onClick={() => handleAction('cancel')}
              disabled={submitting}
              className="w-full py-3 px-4 bg-white hover:bg-red-50 disabled:opacity-50 text-red-600 font-semibold rounded-xl border border-red-200 transition-colors text-sm flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Preciso cancelar
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400">
          Este link é de uso único e expirará após a resposta.
        </p>
      </div>
    </div>
  );
}
