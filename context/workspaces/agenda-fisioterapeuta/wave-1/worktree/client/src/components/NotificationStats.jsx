import { useState, useEffect } from 'react';
import { authHeader } from '../lib/auth.js';

function StatCard({ label, value, sub, color = 'gray' }) {
  const colors = {
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {sub && <p className="mt-1 text-xs opacity-60">{sub}</p>}
    </div>
  );
}

export default function NotificationStats() {
  const [period, setPeriod] = useState('week');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/notifications/stats?period=${period}`, { headers: authHeader() })
      .then((r) => {
        if (!r.ok) throw new Error('Erro ao carregar estatísticas');
        return r.json();
      })
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [period]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900">Métricas de Notificações</h2>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          <button
            onClick={() => setPeriod('week')}
            className={`px-3 py-1 ${period === 'week' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Semana
          </button>
          <button
            onClick={() => setPeriod('month')}
            className={`px-3 py-1 ${period === 'month' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            Mês
          </button>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-gray-400">Carregando...</p>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {!loading && !error && stats && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Taxa de Confirmação"
            value={`${Math.round(stats.confirmation_rate * 100)}%`}
            sub={`${stats.confirmed_appointments} de ${stats.total_appointments_with_notifications} agendamentos`}
            color="green"
          />
          <StatCard
            label="Notificações Entregues"
            value={stats.total_delivered}
            sub={`${stats.total_sent} enviadas no total`}
            color="blue"
          />
          <StatCard
            label="Falhas de Entrega"
            value={stats.total_failed}
            sub="notificações com erro"
            color={stats.total_failed > 0 ? 'red' : 'gray'}
          />
          <StatCard
            label="No-shows"
            value={stats.no_shows}
            sub="pacientes que não compareceram"
            color={stats.no_shows > 0 ? 'yellow' : 'gray'}
          />
        </div>
      )}
    </div>
  );
}
