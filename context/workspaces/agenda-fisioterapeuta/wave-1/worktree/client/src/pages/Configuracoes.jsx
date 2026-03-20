import { useState, useEffect } from 'react';
import { authHeader } from '../lib/auth.js';
import NotificacoesConfig from '../components/NotificacoesConfig.jsx';

const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'Brasília (UTC-3)' },
  { value: 'America/Manaus', label: 'Manaus (UTC-4)' },
  { value: 'America/Belem', label: 'Belém (UTC-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza (UTC-3)' },
  { value: 'America/Recife', label: 'Recife (UTC-3)' },
  { value: 'America/Maceio', label: 'Maceió (UTC-3)' },
  { value: 'America/Bahia', label: 'Salvador (UTC-3)' },
  { value: 'America/Cuiaba', label: 'Cuiabá (UTC-4)' },
  { value: 'America/Porto_Velho', label: 'Porto Velho (UTC-4)' },
  { value: 'America/Boa_Vista', label: 'Boa Vista (UTC-4)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco (UTC-5)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (UTC-2)' },
  { value: 'UTC', label: 'UTC' },
];

const CURRENCIES = [
  { value: 'BRL', label: 'Real brasileiro (R$)' },
  { value: 'USD', label: 'Dólar americano (US$)' },
  { value: 'EUR', label: 'Euro (€)' },
];

const REQUIRED_FIELDS = ['clinic_name', 'address', 'timezone', 'currency'];

export default function Configuracoes() {
  const [form, setForm] = useState({
    clinic_name: '',
    address: '',
    timezone: 'America/Sao_Paulo',
    currency: 'BRL',
    logo_url: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message }

  useEffect(() => {
    fetch('/clinic/settings', { headers: authHeader() })
      .then(r => r.json())
      .then(data => {
        setForm({
          clinic_name: data.clinic_name || '',
          address: data.address || '',
          timezone: data.timezone || 'America/Sao_Paulo',
          currency: data.currency || 'BRL',
          logo_url: data.logo_url || '',
        });
      })
      .catch(() => showToast('error', 'Erro ao carregar configurações'))
      .finally(() => setLoading(false));
  }, []);

  function showToast(type, message) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  function validate() {
    const errs = {};
    if (!form.clinic_name.trim()) errs.clinic_name = 'Nome da clínica é obrigatório';
    if (!form.address.trim()) errs.address = 'Endereço é obrigatório';
    if (!form.timezone) errs.timezone = 'Fuso horário é obrigatório';
    if (!form.currency) errs.currency = 'Moeda é obrigatória';
    return errs;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch('/clinic/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      setForm({
        clinic_name: data.clinic_name || '',
        address: data.address || '',
        timezone: data.timezone || 'America/Sao_Paulo',
        currency: data.currency || 'BRL',
        logo_url: data.logo_url || '',
      });
      showToast('success', 'Configurações salvas com sucesso!');
    } catch (err) {
      showToast('error', err.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  }

  function handleChange(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-sm text-gray-400">Carregando configurações...</div>
      </div>
    );
  }

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
      {/* Toast */}
      {toast && (
        <div
          role="alert"
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
            ${toast.type === 'success' ? 'bg-teal-600 text-white' : 'bg-red-600 text-white'}`}
        >
          {toast.message}
        </div>
      )}

      {/* Notification settings card */}
      <div className="col-span-1 bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Notificações e Lembretes</h2>
        <p className="text-sm text-gray-500 mb-6">Configure os lembretes automáticos enviados aos pacientes</p>
        <NotificacoesConfig onToast={showToast} />
      </div>

      <div className="col-span-1 bg-white rounded-2xl border border-gray-200 p-6">
        <h1 className="text-lg font-semibold text-gray-900 mb-1">Configurações da Clínica</h1>
        <p className="text-sm text-gray-500 mb-6">Dados gerais da sua clínica</p>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Nome da clínica */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nome da clínica <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.clinic_name}
              onChange={e => handleChange('clinic_name', e.target.value)}
              placeholder="Ex.: Fisioterapia Bem Estar"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500
                ${errors.clinic_name ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
            {errors.clinic_name && (
              <p className="mt-1 text-xs text-red-500">{errors.clinic_name}</p>
            )}
          </div>

          {/* Endereço */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Endereço <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.address}
              onChange={e => handleChange('address', e.target.value)}
              placeholder="Ex.: Rua das Flores, 123 – São Paulo, SP"
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500
                ${errors.address ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            />
            {errors.address && (
              <p className="mt-1 text-xs text-red-500">{errors.address}</p>
            )}
          </div>

          {/* Fuso horário */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fuso horário <span className="text-red-500">*</span>
            </label>
            <select
              value={form.timezone}
              onChange={e => handleChange('timezone', e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500
                ${errors.timezone ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            >
              {TIMEZONES.map(tz => (
                <option key={tz.value} value={tz.value}>{tz.label}</option>
              ))}
            </select>
            {errors.timezone && (
              <p className="mt-1 text-xs text-red-500">{errors.timezone}</p>
            )}
          </div>

          {/* Moeda */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Moeda <span className="text-red-500">*</span>
            </label>
            <select
              value={form.currency}
              onChange={e => handleChange('currency', e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500
                ${errors.currency ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
            >
              {CURRENCIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            {errors.currency && (
              <p className="mt-1 text-xs text-red-500">{errors.currency}</p>
            )}
          </div>

          {/* Logo URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL do logotipo
            </label>
            <input
              type="url"
              value={form.logo_url}
              onChange={e => handleChange('logo_url', e.target.value)}
              placeholder="https://exemplo.com/logo.png"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500"
            />
            {form.logo_url && (
              <img
                src={form.logo_url}
                alt="Logo preview"
                className="mt-2 h-12 w-auto rounded object-contain border border-gray-200"
                onError={e => { e.target.style.display = 'none'; }}
              />
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
          >
            {saving ? 'Salvando...' : 'Salvar configurações'}
          </button>
        </form>
      </div>
    </div>
  );
}
