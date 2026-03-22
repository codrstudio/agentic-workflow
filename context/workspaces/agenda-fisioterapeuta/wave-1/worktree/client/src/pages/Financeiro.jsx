import { useState, useEffect, useCallback } from 'react';
import { authHeader } from '../lib/auth.js';

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatPct(val) {
  return `${Math.round((val || 0) * 100)}%`;
}

function currentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function monthDateRange(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    date_from: `${monthStr}-01`,
    date_to: `${monthStr}-${String(lastDay).padStart(2, '0')}`,
  };
}

// ── Simple SVG bar chart ──────────────────────────────────────────────────────

function BarChart({ data }) {
  const height = 160;
  const barGap = 4;
  const maxRevenue = Math.max(...data.map(d => d.revenue), 1);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        Sem dados para o período
      </div>
    );
  }

  const barWidth = Math.max(4, Math.floor((100 - barGap * data.length) / data.length));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${Math.max(data.length * (barWidth + barGap), 200)} ${height + 24}`}
        className="w-full"
        style={{ minWidth: `${data.length * (barWidth + barGap)}px` }}
        preserveAspectRatio="none"
      >
        {data.map((d, i) => {
          const barH = Math.max(2, (d.revenue / maxRevenue) * height);
          const x = i * (barWidth + barGap);
          const y = height - barH;
          const dayNum = d.date ? d.date.slice(8) : '';
          return (
            <g key={d.date}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barH}
                rx={2}
                fill={d.revenue > 0 ? '#3b82f6' : '#e5e7eb'}
              />
              {barWidth >= 8 && (
                <text
                  x={x + barWidth / 2}
                  y={height + 14}
                  textAnchor="middle"
                  fontSize="8"
                  fill="#9ca3af"
                >
                  {dayNum}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Financeiro() {
  const [month, setMonth] = useState(currentMonthStr);
  const [summary, setSummary] = useState(null);
  const [daily, setDaily] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { date_from, date_to } = monthDateRange(month);
      const headers = authHeader();

      const [summaryRes, dailyRes, pendingRes] = await Promise.all([
        fetch(`/financial/summary?period=month&date=${month}`, { headers }),
        fetch(`/financial/daily?date_from=${date_from}&date_to=${date_to}`, { headers }),
        fetch('/financial/pending', { headers }),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      else setSummary(null);

      if (dailyRes.ok) setDaily(await dailyRes.json());
      else setDaily([]);

      if (pendingRes.ok) setPending(await pendingRes.json());
      else setPending([]);
    } catch {
      setSummary(null);
      setDaily([]);
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  // Fill daily chart with all days of the selected month (zeros for missing days)
  const { date_from, date_to } = monthDateRange(month);
  const allDays = [];
  for (let d = new Date(date_from + 'T12:00:00Z'); d <= new Date(date_to + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    allDays.push(d.toISOString().slice(0, 10));
  }
  const revenueMap = Object.fromEntries(daily.map(r => [r.date, r.revenue]));
  const chartData = allDays.map(date => ({ date, revenue: revenueMap[date] || 0 }));

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
      {/* Header */}
      <div className="col-span-full flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Financeiro</h1>
          <p className="text-sm text-gray-400">Visão financeira do período selecionado.</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Mês</label>
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {loading && (
        <div className="col-span-full text-center text-sm text-gray-400 py-4">Carregando...</div>
      )}

      {/* Metric cards */}
      <MetricCard
        label="Receita do mês"
        value={formatCurrency(summary?.receita_total)}
        sub={summary ? `Esperada: ${formatCurrency(summary.receita_esperada)}` : undefined}
      />
      <MetricCard
        label="Taxa de ocupação"
        value={formatPct(summary?.taxa_ocupacao)}
        sub={summary ? `${summary.slots_ocupados} de ${summary.slots_disponiveis} slots` : undefined}
      />
      <MetricCard
        label="Ticket médio"
        value={formatCurrency(summary?.ticket_medio)}
        sub={summary ? `${summary.sessoes_realizadas} sessões realizadas` : undefined}
      />
      <MetricCard
        label="No-shows"
        value={summary?.no_shows ?? '—'}
        sub={summary?.sessoes_canceladas != null ? `${summary.sessoes_canceladas} cancelamento(s)` : undefined}
      />

      {/* Daily revenue chart */}
      <div className="col-span-full bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-sm font-medium text-gray-700 mb-4">Receita diária</p>
        <BarChart data={chartData} />
      </div>

      {/* Pending payments */}
      <div className="col-span-full bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Sessões pendentes de pagamento</p>
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
            {pending.length}
          </span>
        </div>
        {pending.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            Nenhuma sessão pendente de pagamento.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="text-left px-5 py-3">Data</th>
                <th className="text-left px-5 py-3">Paciente</th>
                <th className="text-left px-5 py-3">Serviço</th>
                <th className="text-right px-5 py-3">Valor</th>
                <th className="text-left px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {pending.map(row => (
                <tr key={row.appointment_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-700">{formatDate(row.appointment_datetime)}</td>
                  <td className="px-5 py-3 text-gray-700">{row.patient_nome || '—'}</td>
                  <td className="px-5 py-3 text-gray-500">{row.service_nome || '—'}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">
                    {row.payment_amount != null ? formatCurrency(row.payment_amount) : (row.service_preco != null ? formatCurrency(row.service_preco) : '—')}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      row.payment_id ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-700'
                    }`}>
                      {row.payment_id ? (row.payment_status === 'partial' ? 'Parcial' : 'Pendente') : 'Sem registro'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
