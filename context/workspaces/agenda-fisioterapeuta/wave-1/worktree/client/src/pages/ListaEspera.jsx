import { useState, useEffect, useCallback } from 'react';
import { authHeader } from '../lib/auth';

const API = '/waitlist';

const STATUS_LABEL = {
  waiting: 'Aguardando',
  notified: 'Notificado',
  booked: 'Agendado',
  expired: 'Expirado',
};

const STATUS_COLOR = {
  waiting: 'bg-yellow-100 text-yellow-800',
  notified: 'bg-blue-100 text-blue-800',
  booked: 'bg-green-100 text-green-800',
  expired: 'bg-gray-100 text-gray-500',
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T'));
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function ListaEspera() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notifying, setNotifying] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(API, { headers: authHeader() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar lista de espera');
      setEntries(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleNotify(entry) {
    setNotifying(entry.id);
    try {
      const res = await fetch(`${API}/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ id: entry.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao notificar');
      setEntries(prev =>
        prev.map(e => e.id === entry.id ? { ...e, status: 'notified' } : e)
      );
    } catch (err) {
      alert(err.message);
    } finally {
      setNotifying(null);
    }
  }

  async function handleRemove(entry) {
    if (!confirm(`Remover ${entry.patient_name} da lista de espera?`)) return;
    setRemoving(entry.id);
    try {
      const res = await fetch(`${API}/${entry.id}`, {
        method: 'DELETE',
        headers: authHeader(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao remover');
      }
      setEntries(prev => prev.filter(e => e.id !== entry.id));
    } catch (err) {
      alert(err.message);
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
      <div className="col-span-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Lista de Espera</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Pacientes aguardando um horário disponível
            </p>
          </div>
          <button
            onClick={load}
            className="text-sm text-teal-600 hover:text-teal-800 font-medium px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-colors"
          >
            Atualizar
          </button>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
        )}

        {loading ? (
          <div className="text-sm text-gray-400 py-12 text-center">Carregando...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-3 opacity-40" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <p className="text-sm">Nenhum paciente na lista de espera</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-4 px-5 py-4">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-semibold shrink-0">
                  {entry.patient_name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 truncate">{entry.patient_name}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLOR[entry.status]}`}>
                      {STATUS_LABEL[entry.status]}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                    {entry.patient_email && <span>{entry.patient_email}</span>}
                    {entry.patient_phone && <span>{entry.patient_phone}</span>}
                    {entry.service_nome && (
                      <span className="text-teal-600 font-medium">{entry.service_nome}</span>
                    )}
                  </div>
                  {(entry.preferred_dates?.length > 0 || entry.preferred_times?.length > 0) && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                      {entry.preferred_dates?.length > 0 && (
                        <span>Datas: {entry.preferred_dates.join(', ')}</span>
                      )}
                      {entry.preferred_times?.length > 0 && (
                        <span>Horários: {entry.preferred_times.join(', ')}</span>
                      )}
                    </div>
                  )}
                  <div className="mt-0.5 text-xs text-gray-400">
                    Inscrito em {formatDate(entry.created_at)}
                    {entry.notified_at && (
                      <span className="ml-2 text-blue-400">· Notificado em {formatDate(entry.notified_at)}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {entry.status === 'waiting' && (
                    <button
                      onClick={() => handleNotify(entry)}
                      disabled={notifying === entry.id}
                      className="text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-60 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      {notifying === entry.id ? 'Notificando...' : 'Notificar'}
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(entry)}
                    disabled={removing === entry.id}
                    className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-60 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    {removing === entry.id ? '...' : 'Remover'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
