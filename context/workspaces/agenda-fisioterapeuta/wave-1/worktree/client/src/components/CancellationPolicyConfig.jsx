import { useState, useEffect } from 'react';
import { authHeader } from '../lib/auth.js';

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1
        ${checked ? 'bg-teal-600' : 'bg-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform
          ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}

export default function CancellationPolicyConfig({ onToast }) {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    janela_horas: 24,
    taxa_noshow: 0,
    mensagem: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetch('/cancellation-policy', { headers: authHeader() })
      .then(r => r.json())
      .then(data => {
        setPolicy(data);
        setForm({
          janela_horas: data.janela_horas ?? 24,
          taxa_noshow: data.taxa_noshow ?? 0,
          mensagem: data.mensagem || '',
        });
      })
      .catch(() => onToast?.('error', 'Erro ao carregar política de cancelamento'))
      .finally(() => setLoading(false));
  }, []);

  async function save(patch) {
    setSaving(true);
    try {
      const res = await fetch('/cancellation-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      setPolicy(data);
      setForm({
        janela_horas: data.janela_horas ?? 24,
        taxa_noshow: data.taxa_noshow ?? 0,
        mensagem: data.mensagem || '',
      });
      onToast?.('success', 'Política de cancelamento salva!');
    } catch (err) {
      onToast?.('error', err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function handleToggle(value) {
    setPolicy(p => ({ ...p, ativa: value ? 1 : 0 }));
    save({ ativa: value });
  }

  function validate() {
    const errs = {};
    const horas = Number(form.janela_horas);
    if (!Number.isInteger(horas) || horas <= 0) {
      errs.janela_horas = 'Deve ser um número inteiro positivo';
    }
    const taxa = Number(form.taxa_noshow);
    if (isNaN(taxa) || taxa < 0 || taxa > 100) {
      errs.taxa_noshow = 'Deve ser um número entre 0 e 100';
    }
    return errs;
  }

  function handleSaveForm(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    save({
      janela_horas: Number(form.janela_horas),
      taxa_noshow: Number(form.taxa_noshow),
      mensagem: form.mensagem || null,
    });
  }

  function handleChange(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
  }

  if (loading) {
    return <div className="text-sm text-gray-400">Carregando...</div>;
  }

  if (!policy) return null;

  const isAtiva = Boolean(policy.ativa);

  return (
    <div className="space-y-6">
      {/* Toggle ativa */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Política ativa</p>
          <p className="text-xs text-gray-500">Aplicar regras de cancelamento aos agendamentos</p>
        </div>
        <Toggle
          checked={isAtiva}
          onChange={handleToggle}
          disabled={saving}
        />
      </div>

      <hr className="border-gray-100" />

      <form onSubmit={handleSaveForm} noValidate className="space-y-5">
        {/* Janela de aviso */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Janela mínima de aviso (horas)
          </label>
          <p className="text-xs text-gray-500 mb-1">
            Cancelamentos com menos de X horas de antecedência serão tratados como no-show
          </p>
          <input
            type="number"
            min="1"
            step="1"
            value={form.janela_horas}
            onChange={e => handleChange('janela_horas', e.target.value)}
            disabled={!isAtiva}
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500
              ${!isAtiva ? 'bg-gray-50 text-gray-400 border-gray-200' : errors.janela_horas ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
          />
          {errors.janela_horas && (
            <p className="mt-1 text-xs text-red-500">{errors.janela_horas}</p>
          )}
        </div>

        {/* Taxa de no-show */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Taxa de no-show (%)
          </label>
          <p className="text-xs text-gray-500 mb-1">
            Percentual cobrado em caso de no-show (apenas informativo em wave 1)
          </p>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={form.taxa_noshow}
            onChange={e => handleChange('taxa_noshow', e.target.value)}
            disabled={!isAtiva}
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500
              ${!isAtiva ? 'bg-gray-50 text-gray-400 border-gray-200' : errors.taxa_noshow ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
          />
          {errors.taxa_noshow && (
            <p className="mt-1 text-xs text-red-500">{errors.taxa_noshow}</p>
          )}
        </div>

        {/* Mensagem ao paciente */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mensagem ao paciente
          </label>
          <p className="text-xs text-gray-500 mb-1">
            Texto exibido ao paciente no momento do agendamento sobre a política de cancelamento
          </p>
          <textarea
            rows={3}
            value={form.mensagem}
            onChange={e => handleChange('mensagem', e.target.value)}
            disabled={!isAtiva}
            placeholder="Ex.: Cancelamentos com menos de 24h de antecedência serão cobrados 50% do valor da sessão."
            className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-teal-500
              ${!isAtiva ? 'bg-gray-50 text-gray-400 border-gray-200' : 'border-gray-300'}`}
          />
        </div>

        <button
          type="submit"
          disabled={saving || !isAtiva}
          className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar política'}
        </button>
      </form>
    </div>
  );
}
