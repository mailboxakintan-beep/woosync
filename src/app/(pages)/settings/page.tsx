'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, Save, Eye, EyeOff } from 'lucide-react';

interface Settings {
  epos_app_id?: string;
  epos_app_secret?: string;
  woo_site_url?: string;
  woo_consumer_key?: string;
  woo_consumer_secret?: string;
}

interface TestResult {
  epos: boolean;
  woo: boolean;
}

function InputField({
  label,
  name,
  value,
  onChange,
  placeholder,
  secret,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  placeholder?: string;
  secret?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={secret && !show ? 'password' : 'text'}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 pr-10"
        />
        {secret && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [secretsSet, setSecretsSet] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((data) => {
        const saved: Record<string, boolean> = {};
        const clean: Settings = {};
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'string' && value.includes('••••')) {
            saved[key] = true;
            // Don't pre-fill masked values — leave field empty
          } else {
            (clean as Record<string, string>)[key] = value as string;
          }
        }
        setSettings(clean);
        setSecretsSet(saved);
      });
  }, []);

  const handleChange = (name: string, value: string) => {
    setSettings((prev) => ({ ...prev, [name]: value }));
    setSaved(false);
    setError(null);
    setTestResult(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to save settings');
        return;
      }
      setSaved(true);
      // Refresh to update which secrets are now saved
      const refreshRes = await fetch('/api/settings');
      const refreshData = await refreshRes.json();
      const savedSecrets: Record<string, boolean> = {};
      const clean: Settings = {};
      for (const [key, value] of Object.entries(refreshData)) {
        if (typeof value === 'string' && value.includes('••••')) {
          savedSecrets[key] = true;
        } else {
          (clean as Record<string, string>)[key] = value as string;
        }
      }
      setSettings(clean);
      setSecretsSet(savedSecrets);
    } catch {
      setError('Network error — could not save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      // Save current values first so test uses latest credentials
      const saveRes = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({}));
        setError(data.error || 'Failed to save settings before testing');
        return;
      }

      const res = await fetch('/api/sync/test');
      const data = await res.json();
      setTestResult(data);
    } catch {
      setError('Network error — could not test connections');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-500 mt-1">
          Configure your ePOS Now and WooCommerce API credentials.
        </p>
      </div>

      {/* ePOS Now */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
            E
          </div>
          <div>
            <h2 className="font-semibold text-slate-700">ePOS Now</h2>
            <p className="text-slate-400 text-xs">
              Get your credentials from{' '}
              <a
                href="https://developer.eposnowhq.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-500 hover:underline"
              >
                developer.eposnowhq.com
              </a>
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <InputField
            label="Application ID"
            name="epos_app_id"
            value={settings.epos_app_id ?? ''}
            onChange={handleChange}
            placeholder="Your ePOS Now Application ID"
          />
          <InputField
            label="Application Secret"
            name="epos_app_secret"
            value={settings.epos_app_secret ?? ''}
            onChange={handleChange}
            placeholder={secretsSet.epos_app_secret ? '•••••••• (saved — leave blank to keep)' : 'Your ePOS Now Application Secret'}
            secret
          />
        </div>
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
          <strong>How to get credentials:</strong> Log in to your ePOS Now back office → Apps →
          API → Create Application. Copy the Application ID and Secret.
        </div>
      </div>

      {/* WooCommerce */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center text-white text-xs font-bold">
            W
          </div>
          <div>
            <h2 className="font-semibold text-slate-700">WooCommerce</h2>
            <p className="text-slate-400 text-xs">sterlinglams.com REST API credentials</p>
          </div>
        </div>
        <div className="space-y-4">
          <InputField
            label="Store URL"
            name="woo_site_url"
            value={settings.woo_site_url ?? ''}
            onChange={handleChange}
            placeholder="https://sterlinglams.com"
          />
          <InputField
            label="Consumer Key"
            name="woo_consumer_key"
            value={settings.woo_consumer_key ?? ''}
            onChange={handleChange}
            placeholder={secretsSet.woo_consumer_key ? '•••••••• (saved — leave blank to keep)' : 'ck_xxxxxxxxxxxxxxxx'}
            secret
          />
          <InputField
            label="Consumer Secret"
            name="woo_consumer_secret"
            value={settings.woo_consumer_secret ?? ''}
            onChange={handleChange}
            placeholder={secretsSet.woo_consumer_secret ? '•••••••• (saved — leave blank to keep)' : 'cs_xxxxxxxxxxxxxxxx'}
            secret
          />
        </div>
        <div className="mt-4 p-3 bg-purple-50 rounded-lg text-xs text-purple-700">
          <strong>How to get credentials:</strong> In WordPress, go to WooCommerce → Settings →
          Advanced → REST API → Add Key. Set permissions to Read/Write, copy Consumer Key and
          Secret.
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save Settings'}
        </button>

        <button
          onClick={handleTest}
          disabled={testing}
          className="inline-flex items-center gap-2 border border-slate-200 hover:border-indigo-300 text-slate-600 font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${testing ? 'animate-spin' : ''}`} />
          {testing ? 'Testing…' : 'Test Connections'}
        </button>

        {saved && (
          <span className="text-green-600 text-sm flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Saved
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {testResult && (
        <div className="mt-4 bg-white rounded-xl p-4 shadow-sm border border-slate-100 space-y-2">
          <h3 className="text-sm font-semibold text-slate-700">Connection Test Results</h3>
          {[
            { label: 'ePOS Now', ok: testResult.epos },
            { label: 'WooCommerce', ok: testResult.woo },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              {ok ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span className={ok ? 'text-green-700' : 'text-red-600'}>
                {label}: {ok ? 'Connected ✓' : 'Failed – check credentials'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
