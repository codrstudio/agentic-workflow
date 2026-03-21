import { useState, useEffect, useCallback } from 'react';
import { authHeader } from '../lib/auth.js';

const METHOD_LABELS  = { cash: 'Dinheiro', pix: 'Pix', card: 'Cartão', transfer: 'Transferência' };
const STATUS_LABELS  = { paid: 'Pago', partial: 'Parcial', waived: 'Isento', pending: 'Pendente' };
const STATUS_COLORS  = {
  paid:    'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  waived:  'bg-gray-100 text-gray-600',
  pending: 'bg-red-100 text-red-700',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

export default function Financeiro() {
  const [payments, setPayments] = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo)   params.set('date_to',   dateTo);
      const res = await fetch(`/payments?${params}`, { headers: authHeader() });
      if (res.ok) setPayments(await res.json());
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const total = payments.filter(p => p.status === 'paid' || p.status === 'partial')
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
      <div className="col-span-full">
        <h1 className="text-xl font-semibold text-gray-900 mb-1">Financeiro</h1>
        <p className="text-sm text-gray-400">Histórico de pagamentos registrados.</p>
      </div>

      {/* Filters */}
      <div className="col-span-full flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">De</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Até</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={load}
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Filtrar
        </button>
      </div>

      {/* Summary card */}
      <div className="col-span-1 bg-white rounded-2xl border border-gray-200 p-5">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total recebido</p>
        <p className="text-2xl font-bold text-gray-900">{formatCurrency(total)}</p>
        <p className="text-xs text-gray-400 mt-1">{payments.length} pagamento{payments.length !== 1 ? 's' : ''} no período</p>
      </div>

      {/* Payment list */}
      <div className="col-span-full bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">Carregando...</div>
        ) : payments.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">Nenhum pagamento encontrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Data</th>
                <th className="text-left px-5 py-3">Paciente</th>
                <th className="text-left px-5 py-3">Método</th>
                <th className="text-right px-5 py-3">Valor</th>
                <th className="text-left px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 text-gray-700">{formatDate(p.appointment_datetime)}</td>
                  <td className="px-5 py-3 text-gray-700">{p.patient_nome || '—'}</td>
                  <td className="px-5 py-3 text-gray-600">{METHOD_LABELS[p.method] || p.method}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-900">{formatCurrency(p.amount)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || ''}`}>
                      {STATUS_LABELS[p.status] || p.status}
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
