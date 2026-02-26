'use client';

import { useState, useEffect } from 'react';
import { Key, CheckCircle, XCircle, Loader2, Link2, Unlink } from 'lucide-react';
import { PROVIDER_DISPLAY_NAMES, type Provider } from '@/types';

interface ApiKeyStatus {
  provider: string;
  key_hint: string;
  set_by: string;
  updated_at: string;
}

interface ApiKeysManagerProps {
  isAdmin: boolean;
}

const PROVIDERS: Provider[] = ['anthropic', 'openai', 'google'];

const ENV_VAR_NAMES: Record<Provider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_API_KEY',
};

export default function ApiKeysManager({ isAdmin }: ApiKeysManagerProps) {
  const [statuses, setStatuses] = useState<ApiKeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [savingProvider, setSavingProvider] = useState<string | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [googleOAuthConnected, setGoogleOAuthConnected] = useState(false);
  const [disconnectingGoogle, setDisconnectingGoogle] = useState(false);

  useEffect(() => {
    fetch('/api/settings/api-keys')
      .then(r => r.json())
      .then(data => {
        setStatuses(data);
        setLoading(false);
      });
    // Check Google OAuth connection status
    fetch('/api/settings/google-oauth')
      .then(r => r.json())
      .then(data => setGoogleOAuthConnected(data.connected))
      .catch(() => {});
  }, []);

  const getStatus = (provider: string) => statuses.find(s => s.provider === provider);

  const handleSaveKey = async (provider: string) => {
    const key = keyInputs[provider]?.trim();
    if (!key) return;
    setSavingProvider(provider);
    try {
      const res = await fetch('/api/settings/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, key }),
      });
      if (res.ok) {
        // Refresh statuses
        const updated = await fetch('/api/settings/api-keys').then(r => r.json());
        setStatuses(updated);
        setKeyInputs(prev => ({ ...prev, [provider]: '' }));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to save key');
      }
    } catch {
      alert('Failed to save key.');
    } finally {
      setSavingProvider(null);
    }
  };

  const handleDeleteKey = async (provider: string) => {
    if (!window.confirm(`Remove the stored ${PROVIDER_DISPLAY_NAMES[provider as Provider]} API key?`)) return;
    setSavingProvider(provider);
    try {
      await fetch(`/api/settings/api-keys/${provider}`, { method: 'DELETE' });
      const updated = await fetch('/api/settings/api-keys').then(r => r.json());
      setStatuses(updated);
      setTestResults(prev => { const next = { ...prev }; delete next[provider]; return next; });
    } catch {
      alert('Failed to remove key.');
    } finally {
      setSavingProvider(null);
    }
  };

  const handleDisconnectGoogle = async () => {
    if (!window.confirm('Disconnect your Google account from Gemini? You will need to sign out and back in to reconnect.')) return;
    setDisconnectingGoogle(true);
    try {
      await fetch('/api/settings/google-oauth', { method: 'DELETE' });
      setGoogleOAuthConnected(false);
    } catch {
      alert('Failed to disconnect.');
    } finally {
      setDisconnectingGoogle(false);
    }
  };

  const handleTestConnection = async (provider: string) => {
    setTestingProvider(provider);
    setTestResults(prev => { const next = { ...prev }; delete next[provider]; return next; });
    try {
      const res = await fetch('/api/settings/api-keys/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      });
      if (res.ok) {
        setTestResults(prev => ({ ...prev, [provider]: { success: true, message: 'Connection successful' } }));
      } else {
        const err = await res.json();
        setTestResults(prev => ({ ...prev, [provider]: { success: false, message: err.error || 'Connection failed' } }));
      }
    } catch {
      setTestResults(prev => ({ ...prev, [provider]: { success: false, message: 'Network error' } }));
    } finally {
      setTestingProvider(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-tertiary text-sm uppercase tracking-wider">
          Loading API key statuses...
        </div>
      </div>
    );
  }

  const inputClasses = 'bg-elevated border border-subtle rounded px-3 py-2 text-primary text-sm focus:border-cyan focus:outline-none focus:shadow-glow-cyan-subtle transition-all';

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-secondary text-sm">
        API keys are encrypted at rest and never displayed after saving. Keys stored in the database take priority over environment variables.
      </p>

      {!isAdmin && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm text-yellow-500">
          Only admins can manage API keys. Contact your admin to update keys.
        </div>
      )}

      {PROVIDERS.map(provider => {
        const status = getStatus(provider);
        const testResult = testResults[provider];
        const isSaving = savingProvider === provider;
        const isTesting = testingProvider === provider;

        return (
          <div key={provider} className="border border-subtle rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Key size={18} className="text-secondary" />
                <h3 className="font-display text-sm font-medium uppercase tracking-wider text-primary">
                  {PROVIDER_DISPLAY_NAMES[provider]}
                </h3>
              </div>
              {status ? (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-green-400">
                  <CheckCircle size={14} />
                  Configured
                </span>
              ) : (
                <span className="text-xs font-medium uppercase tracking-wider text-tertiary">
                  Not configured
                </span>
              )}
            </div>

            {/* Google OAuth status */}
            {provider === 'google' && (
              <div className="border border-subtle/50 rounded-lg p-3 space-y-2 bg-surface/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 size={14} className="text-secondary" />
                    <span className="text-xs font-medium uppercase tracking-wider text-secondary">
                      Google OAuth
                    </span>
                  </div>
                  {googleOAuthConnected ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-green-400">
                      <CheckCircle size={12} />
                      Connected
                    </span>
                  ) : (
                    <span className="text-xs font-medium uppercase tracking-wider text-tertiary">
                      Not connected
                    </span>
                  )}
                </div>
                {googleOAuthConnected ? (
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-tertiary">
                      Gemini uses your Google account. No API key needed.
                    </p>
                    <button
                      onClick={handleDisconnectGoogle}
                      disabled={disconnectingGoogle}
                      className="inline-flex items-center gap-1 text-xs text-magenta hover:text-magenta/80 uppercase tracking-wider font-mono transition-colors disabled:opacity-50"
                    >
                      <Unlink size={12} />
                      {disconnectingGoogle ? 'Disconnecting...' : 'Disconnect'}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-tertiary">
                    Sign out and back in to connect your Google account for Gemini access.
                  </p>
                )}
              </div>
            )}

            {status && (
              <div className="text-xs text-tertiary space-y-1">
                <p>Key hint: <span className="text-secondary font-mono">{status.key_hint}</span></p>
                <p>Set by: <span className="text-secondary">{status.set_by}</span></p>
              </div>
            )}

            <p className="text-xs text-tertiary">
              {provider === 'google' && googleOAuthConnected
                ? <>API key (fallback): <code className="text-secondary font-mono">{ENV_VAR_NAMES[provider]}</code></>
                : <>Env var: <code className="text-secondary font-mono">{ENV_VAR_NAMES[provider]}</code></>
              }
            </p>

            {isAdmin && (
              <div className="flex gap-2">
                <input
                  type="password"
                  autoComplete="off"
                  value={keyInputs[provider] || ''}
                  onChange={e => setKeyInputs(prev => ({ ...prev, [provider]: e.target.value }))}
                  className={`flex-1 ${inputClasses}`}
                  placeholder={status ? 'Enter new key to replace...' : 'Enter API key...'}
                />
                <button
                  onClick={() => handleSaveKey(provider)}
                  disabled={isSaving || !keyInputs[provider]?.trim()}
                  className="px-4 py-2 bg-cyan text-on-accent rounded text-xs font-medium uppercase tracking-wider hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}

            {/* Actions */}
            {isAdmin && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleTestConnection(provider)}
                  disabled={isTesting}
                  className="inline-flex items-center gap-1.5 text-xs text-secondary hover:text-primary uppercase tracking-wider font-mono transition-colors disabled:opacity-50"
                >
                  {isTesting ? <Loader2 size={14} className="animate-spin" /> : null}
                  Test Connection
                </button>
                {status && (
                  <button
                    onClick={() => handleDeleteKey(provider)}
                    disabled={isSaving}
                    className="inline-flex items-center gap-1.5 text-xs text-magenta hover:text-magenta/80 uppercase tracking-wider font-mono transition-colors disabled:opacity-50"
                  >
                    Remove Key
                  </button>
                )}
              </div>
            )}

            {/* Test result */}
            {testResult && (
              <div className={`flex items-center gap-2 text-xs ${testResult.success ? 'text-green-400' : 'text-magenta'}`}>
                {testResult.success ? <CheckCircle size={14} /> : <XCircle size={14} />}
                {testResult.message}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
