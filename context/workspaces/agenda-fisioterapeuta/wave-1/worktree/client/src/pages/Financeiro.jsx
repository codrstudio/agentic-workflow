import { useState, useEffect, useCallback, useRef } from 'react';
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

// ── Register Payment Modal ─────────────────────────────────────────────────────

const METHOD_LABELS = { cash: 'Dinheiro', pix: 'Pix', card: 'Cartão', transfer: 'Transferência' };

function RegisterPaymentModal({ row, onClose, onSaved }) {
  const [amount, setAmount] = useState(
    row.saldo_restante > 0 ? String(row.saldo_restante.toFixed(2)) : ''
  );
  const [method, setMethod] = useState('pix');
  const [status, setStatus] = useState('paid');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const endpoint = row.payment_id ? `/payments/${row.payment_id}` : '/payments';
      const httpMethod = row.payment_id ? 'PUT' : 'POST';
      const body = row.payment_id
        ? { amount: Number(amount), method, status }
        : { appointment_id: row.appointment_id, patient_id: row.patient_id, amount: Number(amount), method, status };

      const res = await fetch(endpoint, {
        method: httpMethod,
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Erro ao salvar pagamento');
        return;
      }
      onSaved();
    } catch {
      setError('Erro de conexão');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900">Registrar pagamento</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {row.patient_nome} · {formatDate(row.appointment_datetime)}
          </p>
          {row.service_nome && (
            <p className="text-xs text-gray-400">{row.service_nome}</p>
          )}
        </div>

        {row.payment_status === 'partial' && row.saldo_restante > 0 && (
          <p className="text-xs bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 mb-4 text-yellow-800">
            Saldo restante: {formatCurrency(row.saldo_restante)}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Valor (R$)</label>
            <input
              ref={inputRef}
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Método</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {Object.entries(METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="paid">Pago total</option>
              <option value="partial">Parcial</option>
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
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
  const [registerRow, setRegisterRow] = useState(null); // row for payment modal

  // Pending filter defaults to the selected month range
  const { date_from: defaultFrom, date_to: defaultTo } = monthDateRange(currentMonthStr());
  const [pendingFrom, setPendingFrom] = useState(defaultFrom);
  const [pendingTo, setPendingTo] = useState(defaultTo);

  const loadPending = useCallback(async (from, to) => {
    const params = new URLSearchParams();
    if (from) params.set('date_from', from);
    if (to) params.set('date_to', to);
    const res = await fetch(`/financial/pending?${params}`, { headers: authHeader() });
    if (res.ok) setPending(await res.json());
    else setPending([]);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { date_from, date_to } = monthDateRange(month);
      const headers = authHeader();

      const [summaryRes, dailyRes] = await Promise.all([
        fetch(`/financial/summary?period=month&date=${month}`, { headers }),
        fetch(`/financial/daily?date_from=${date_from}&date_to=${date_to}`, { headers }),
      ]);

      if (summaryRes.ok) setSummary(await summaryRes.json());
      else setSummary(null);

      if (dailyRes.ok) setDaily(await dailyRes.json());
      else setDaily([]);
    } catch {
      setSummary(null);
      setDaily([]);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadPending(pendingFrom, pendingTo); }, [loadPending, pendingFrom, pendingTo]);

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
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3 justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-700">Sessões pendentes de pagamento</p>
            <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full font-medium">
              {pending.length}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <label>De</label>
            <input
              type="date"
              value={pendingFrom}
              onChange={e => setPendingFrom(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <label>Até</label>
            <input
              type="date"
              value={pendingTo}
              onChange={e => setPendingTo(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => { setPendingFrom(''); setPendingTo(''); }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Limpar filtro"
            >
              ✕
            </button>
          </div>
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
                <th className="text-right px-5 py-3">Valor esperado</th>
                <th className="text-right px-5 py-3">Saldo restante</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {pending.map(row => (
                <tr key={row.appointment_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-700">{formatDate(row.appointment_datetime)}</td>
                  <td className="px-5 py-3 text-gray-700">{row.patient_nome || '—'}</td>
                  <td className="px-5 py-3 text-gray-500">{row.service_nome || '—'}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">
                    {row.service_preco != null ? formatCurrency(row.service_preco) : '—'}
                  </td>
                  <td className="px-5 py-3 text-right font-medium text-orange-600">
                    {row.saldo_restante != null ? formatCurrency(row.saldo_restante) : '—'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      row.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-700'
                    }`}>
                      {row.payment_status === 'partial' ? 'Parcial' : 'Sem registro'}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setRegisterRow(row)}
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      Registrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {registerRow && (
        <RegisterPaymentModal
          row={registerRow}
          onClose={() => setRegisterRow(null)}
          onSaved={() => {
            setRegisterRow(null);
            loadPending(pendingFrom, pendingTo);
            load();
          }}
        />
      )}
    </div>
  );
}
