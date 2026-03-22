import { useState, useEffect, useCallback } from 'react';
import { authHeader } from '../lib/auth.js';

function formatCurrency(val) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const METHOD_LABELS = {
  cash: 'Dinheiro',
  pix: 'Pix',
  card: 'Cartão',
  transfer: 'Transferência',
};

const STATUS_LABELS = {
  pending: 'Pendente',
  paid: 'Pago',
  partial: 'Parcial',
  waived: 'Isento',
};

const STATUS_CLASSES = {
  pending: 'bg-red-100 text-red-700',
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-yellow-100 text-yellow-800',
  waived: 'bg-gray-100 text-gray-600',
};

const PAGE_SIZE = 20;

function exportCSV(rows) {
  const headers = ['Data', 'Paciente', 'Serviço', 'Valor', 'Método', 'Status'];
  const lines = rows.map(r => [
    formatDate(r.appointment_datetime),
    r.patient_nome || '',
    r.service_nome || '',
    (r.amount || 0).toFixed(2).replace('.', ','),
    METHOD_LABELS[r.method] || r.method,
    STATUS_LABELS[r.status] || r.status,
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));

  const csv = [headers.join(';'), ...lines].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `historico-pagamentos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HistoricoPagamentos() {
  const [patients, setPatients] = useState([]);
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Filters
  const [patientId, setPatientId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [method, setMethod] = useState('');

  // Pending applied filters (used for CSV export)
  const [appliedFilters, setAppliedFilters] = useState({ patientId: '', dateFrom: '', dateTo: '', method: '' });

  useEffect(() => {
    fetch('/patients', { headers: authHeader() })
      .then(r => r.ok ? r.json() : [])
      .then(setPatients)
      .catch(() => setPatients([]));
  }, []);

  const loadPayments = useCallback(async (filters, pageNum) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: pageNum, page_size: PAGE_SIZE });
      if (filters.patientId) params.set('patient_id', filters.patientId);
      if (filters.dateFrom)  params.set('date_from', filters.dateFrom);
      if (filters.dateTo)    params.set('date_to', filters.dateTo);
      if (filters.method)    params.set('method', filters.method);

      const res = await fetch(`/payments?${params}`, { headers: authHeader() });
      if (res.ok) {
        const json = await res.json();
        setPayments(json.data ?? []);
        setTotal(json.total ?? 0);
      } else {
        setPayments([]);
        setTotal(0);
      }
    } catch {
      setPayments([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments(appliedFilters, page);
  }, [loadPayments, appliedFilters, page]);

  function applyFilters(e) {
    e.preventDefault();
    const filters = { patientId, dateFrom, dateTo, method };
    setAppliedFilters(filters);
    setPage(1);
  }

  function clearFilters() {
    setPatientId('');
    setDateFrom('');
    setDateTo('');
    setMethod('');
    const filters = { patientId: '', dateFrom: '', dateTo: '', method: '' };
    setAppliedFilters(filters);
    setPage(1);
  }

  async function handleExportCSV() {
    // Fetch all matching rows without pagination for export
    const params = new URLSearchParams({ page: 1, page_size: 10000 });
    if (appliedFilters.patientId) params.set('patient_id', appliedFilters.patientId);
    if (appliedFilters.dateFrom)  params.set('date_from', appliedFilters.dateFrom);
    if (appliedFilters.dateTo)    params.set('date_to', appliedFilters.dateTo);
    if (appliedFilters.method)    params.set('method', appliedFilters.method);

    const res = await fetch(`/payments?${params}`, { headers: authHeader() });
    if (!res.ok) return;
    const json = await res.json();
    exportCSV(json.data ?? []);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-6 grid grid-cols-1 gap-6 items-start">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Histórico de Pagamentos</h1>
          <p className="text-sm text-gray-400">Todos os pagamentos registrados, com filtros e export.</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-1.5 bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M12 16V4m0 12-4-4m4 4 4-4M4 20h16" />
          </svg>
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <form
        onSubmit={applyFilters}
        className="bg-white rounded-2xl border border-gray-200 p-5"
      >
        <p className="text-sm font-medium text-gray-700 mb-4">Filtros</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Paciente</label>
            <select
              value={patientId}
              onChange={e => setPatientId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {patients.map(p => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data inicial</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data final</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
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
              <option value="">Todos</option>
              {Object.entries(METHOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Filtrar
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Limpar
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">
            Pagamentos
            {total > 0 && (
              <span className="ml-2 text-xs text-gray-400">({total} no total)</span>
            )}
          </p>
          {loading && (
            <span className="text-xs text-gray-400">Carregando...</span>
          )}
        </div>

        {!loading && payments.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-400">
            Nenhum pagamento encontrado para os filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left px-5 py-3">Data</th>
                  <th className="text-left px-5 py-3">Paciente</th>
                  <th className="text-left px-5 py-3">Serviço</th>
                  <th className="text-right px-5 py-3">Valor</th>
                  <th className="text-left px-5 py-3">Método</th>
                  <th className="text-left px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map(row => (
                  <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-700 whitespace-nowrap">
                      {formatDate(row.appointment_datetime)}
                    </td>
                    <td className="px-5 py-3 text-gray-700">{row.patient_nome || '—'}</td>
                    <td className="px-5 py-3 text-gray-500">{row.service_nome || '—'}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                      {formatCurrency(row.amount)}
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {METHOD_LABELS[row.method] || row.method}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASSES[row.status] || 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[row.status] || row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-2">
            <span className="text-xs text-gray-500">
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Anterior
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Show pages around current
                const half = 2;
                let start = Math.max(1, page - half);
                const end = Math.min(totalPages, start + 4);
                start = Math.max(1, end - 4);
                return start + i;
              }).filter(p => p >= 1 && p <= totalPages).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`px-3 py-1.5 text-xs border rounded-lg transition-colors ${
                    p === page
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
