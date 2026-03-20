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

const REMINDER_SLOTS = [
  { key: 'reminder_48h', label: '48 horas antes', description: 'Lembrete enviado 2 dias antes da sessão' },
  { key: 'reminder_24h', label: '24 horas antes', description: 'Lembrete enviado 1 dia antes da sessão' },
  { key: 'reminder_2h', label: '2 horas antes', description: 'Lembrete enviado 2 horas antes da sessão' },
];

export default function NotificacoesConfig({ onToast }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customMessage, setCustomMessage] = useState('');

  useEffect(() => {
    fetch('/notifications/settings', { headers: authHeader() })
      .then(r => r.json())
      .then(data => {
        setSettings(data);
        setCustomMessage(data.custom_message || '');
      })
      .catch(() => onToast?.('error', 'Erro ao carregar configurações de notificação'))
      .finally(() => setLoading(false));
  }, []);

  async function save(patch) {
    setSaving(true);
    try {
      const res = await fetch('/notifications/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar');
      setSettings(data);
      setCustomMessage(data.custom_message || '');
      onToast?.('success', 'Configurações de notificação salvas!');
    } catch (err) {
      onToast?.('error', err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function toggleField(field, value) {
    const patch = { [field]: value };
    setSettings(s => ({ ...s, [field]: value ? 1 : 0 }));
    save(patch);
  }

  function handleMessageSave() {
    save({ custom_message: customMessage });
  }

  if (loading) {
    return <div className="text-sm text-gray-400">Carregando...</div>;
  }

  if (!settings) return null;

  const masterEnabled = Boolean(settings.enabled);

  return (
    <div className="space-y-6">
      {/* Master toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Notificações ativas</p>
          <p className="text-xs text-gray-500">Ativar ou desativar todos os lembretes automáticos</p>
        </div>
        <Toggle
          checked={masterEnabled}
          onChange={v => toggleField('enabled', v)}
          disabled={saving}
        />
      </div>

      <hr className="border-gray-100" />

      {/* Reminder slots */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Horários de lembrete</p>
        <div className="space-y-4">
          {REMINDER_SLOTS.map(slot => (
            <div key={slot.key} className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${masterEnabled ? 'text-gray-900' : 'text-gray-400'}`}>
                  {slot.label}
                </p>
                <p className="text-xs text-gray-500">{slot.description}</p>
              </div>
              <Toggle
                checked={Boolean(settings[slot.key])}
                onChange={v => toggleField(slot.key, v)}
                disabled={saving || !masterEnabled}
              />
            </div>
          ))}
        </div>
      </div>

      <hr className="border-gray-100" />

      {/* Custom message */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Mensagem personalizada
        </label>
        <p className="text-xs text-gray-500 mb-2">
          Texto incluído nos lembretes enviados ao paciente. Deixe em branco para usar o padrão.
        </p>
        <textarea
          rows={3}
          value={customMessage}
          onChange={e => setCustomMessage(e.target.value)}
          disabled={!masterEnabled}
          placeholder="Ex.: Lembre-se da sua sessão de fisioterapia! Qualquer dúvida, entre em contato."
          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none resize-none focus:ring-2 focus:ring-teal-500
            ${masterEnabled ? 'border-gray-300' : 'border-gray-200 bg-gray-50 text-gray-400'}`}
        />
        <button
          type="button"
          disabled={saving || !masterEnabled}
          onClick={handleMessageSave}
          className="mt-2 px-4 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar mensagem'}
        </button>
      </div>
    </div>
  );
}
