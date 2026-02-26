'use client';

import { useState, useEffect } from 'react';
import { Server, Plus, Trash2, CheckCircle, XCircle, Loader2, Terminal, Globe, Link2, Unlink } from 'lucide-react';
import type { McpServer, McpOAuthStatus } from '@/types';

interface McpServersManagerProps {
  isAdmin: boolean;
}

interface CatalogEntry {
  name: string;
  slug: string;
  description: string;
  icon: string;
  url: string;
  requiresClientRegistration: boolean;
  registrationInstructions?: string;
  docsUrl?: string;
  alreadyAdded: boolean;
}

interface McpServerForm {
  name: string;
  description: string;
  transport_type: 'stdio' | 'sse';
  command: string;
  args: string;
  env: string;
  url: string;
  headers: string;
}

const emptyForm: McpServerForm = {
  name: '',
  description: '',
  transport_type: 'stdio',
  command: '',
  args: '',
  env: '',
  url: '',
  headers: '',
};

export default function McpServersManager({ isAdmin }: McpServersManagerProps) {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [oauthStatuses, setOauthStatuses] = useState<McpOAuthStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<McpServerForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; tools?: string[]; error?: string }>>({});
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // Catalog add state
  const [addingSlug, setAddingSlug] = useState<string | null>(null);
  const [catalogClientId, setCatalogClientId] = useState('');
  const [catalogClientSecret, setCatalogClientSecret] = useState('');
  const [catalogAdding, setCatalogAdding] = useState(false);

  const fetchAll = async () => {
    try {
      const [serversRes, catalogRes, statusRes] = await Promise.all([
        fetch('/api/mcp-servers').then(r => r.json()),
        fetch('/api/mcp-servers/catalog').then(r => r.json()),
        fetch('/api/mcp-servers/oauth/status').then(r => r.json()),
      ]);
      setServers(serversRes);
      setCatalog(catalogRes);
      setOauthStatuses(statusRes.statuses || []);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const getOAuthStatus = (serverId: string): McpOAuthStatus | undefined => {
    return oauthStatuses.find(s => s.mcp_server_id === serverId);
  };

  // Manual server form handlers (existing)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);

    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      transport_type: form.transport_type,
      command: form.transport_type === 'stdio' ? form.command.trim() || null : null,
      args: form.transport_type === 'stdio' && form.args.trim()
        ? JSON.stringify(form.args.split(',').map(a => a.trim()).filter(Boolean))
        : null,
      env: form.transport_type === 'stdio' && form.env.trim() ? form.env.trim() : null,
      url: form.transport_type === 'sse' ? form.url.trim() || null : null,
      headers: form.transport_type === 'sse' && form.headers.trim() ? form.headers.trim() : null,
    };

    try {
      if (editingId) {
        await fetch(`/api/mcp-servers/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        await fetch('/api/mcp-servers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchAll();
    } catch {
      alert('Failed to save MCP server.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (server: McpServer) => {
    if (server.auth_type === 'oauth') return; // OAuth servers aren't editable via this form
    setEditingId(server.id);
    setForm({
      name: server.name,
      description: server.description || '',
      transport_type: server.transport_type as 'stdio' | 'sse',
      command: server.command || '',
      args: server.args ? JSON.parse(server.args).join(', ') : '',
      env: server.env || '',
      url: server.url || '',
      headers: server.headers || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this MCP server? This will remove it from all agents.')) return;
    await fetch(`/api/mcp-servers/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResults(prev => ({ ...prev, [id]: undefined as unknown as { success: boolean } }));
    try {
      const res = await fetch(`/api/mcp-servers/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setTestResults(prev => ({ ...prev, [id]: { success: true, tools: data.tools } }));
      } else {
        setTestResults(prev => ({ ...prev, [id]: { success: false, error: data.error } }));
      }
    } catch {
      setTestResults(prev => ({ ...prev, [id]: { success: false, error: 'Connection failed' } }));
    } finally {
      setTestingId(null);
    }
  };

  // OAuth handlers
  const handleOAuthConnect = async (serverId: string) => {
    setConnectingId(serverId);
    try {
      const res = await fetch(`/api/mcp-servers/${serverId}/oauth/connect`, { method: 'POST' });
      const data = await res.json();
      if (data.alreadyConnected) {
        fetchAll();
      } else if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        alert(data.error || 'Failed to start OAuth flow');
      }
    } catch {
      alert('Failed to start OAuth flow');
    } finally {
      setConnectingId(null);
    }
  };

  const handleOAuthDisconnect = async (serverId: string) => {
    if (!confirm('Disconnect from this service? You can reconnect later.')) return;
    setDisconnectingId(serverId);
    try {
      await fetch(`/api/mcp-servers/${serverId}/oauth/disconnect`, { method: 'POST' });
      fetchAll();
    } catch {
      alert('Failed to disconnect');
    } finally {
      setDisconnectingId(null);
    }
  };

  // Catalog handlers
  const handleCatalogAdd = async (slug: string, requiresRegistration: boolean) => {
    if (requiresRegistration) {
      setAddingSlug(slug);
      setCatalogClientId('');
      setCatalogClientSecret('');
      return;
    }

    setCatalogAdding(true);
    try {
      const res = await fetch(`/api/mcp-servers/catalog/${slug}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to add service');
      } else {
        fetchAll();
      }
    } catch {
      alert('Failed to add service');
    } finally {
      setCatalogAdding(false);
    }
  };

  const handleCatalogRegister = async () => {
    if (!addingSlug || !catalogClientId.trim()) return;
    setCatalogAdding(true);
    try {
      const res = await fetch(`/api/mcp-servers/catalog/${addingSlug}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: catalogClientId.trim(),
          clientSecret: catalogClientSecret.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to add service');
      } else {
        setAddingSlug(null);
        fetchAll();
      }
    } catch {
      alert('Failed to add service');
    } finally {
      setCatalogAdding(false);
    }
  };

  const inputClasses = 'w-full bg-elevated border border-subtle rounded px-3 py-2 text-primary text-sm focus:border-cyan focus:outline-none focus:shadow-glow-cyan-subtle transition-all';
  const labelClasses = 'text-xs text-secondary uppercase tracking-wider font-mono mb-1.5 block';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-tertiary">
        <Loader2 size={20} className="animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  const oauthServers = servers.filter(s => s.auth_type === 'oauth');
  const manualServers = servers.filter(s => s.auth_type !== 'oauth');

  return (
    <div className="space-y-8">
      {/* Service Catalog */}
      {isAdmin && catalog.length > 0 && (
        <section className="space-y-4">
          <div>
            <h3 className="font-display text-sm font-medium uppercase tracking-wider text-secondary">
              Available Services
            </h3>
            <p className="text-xs text-tertiary mt-1">
              Add OAuth-connected services. Click to enable, then connect your account.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {catalog.map(entry => (
              <div
                key={entry.slug}
                className={`p-3 rounded-lg border transition-all ${
                  entry.alreadyAdded
                    ? 'border-subtle bg-elevated opacity-60'
                    : 'border-subtle bg-surface hover:border-cyan hover:shadow-glow-cyan-subtle cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{entry.icon}</span>
                  <span className="text-sm font-medium text-primary truncate">{entry.name}</span>
                </div>
                <p className="text-xs text-tertiary mb-3 line-clamp-2">{entry.description}</p>
                {entry.alreadyAdded ? (
                  <span className="text-xs text-tertiary uppercase tracking-wider font-mono">Added</span>
                ) : (
                  <button
                    onClick={() => handleCatalogAdd(entry.slug, entry.requiresClientRegistration)}
                    disabled={catalogAdding}
                    className="text-xs text-cyan uppercase tracking-wider font-mono hover:text-cyan/80 transition-colors disabled:opacity-50"
                  >
                    {entry.requiresClientRegistration ? 'Configure' : '+ Add'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Client Registration Modal */}
          {addingSlug && (
            <div className="p-4 rounded-lg border border-cyan/30 bg-cyan/5 space-y-3">
              <h4 className="text-sm font-medium text-primary">
                Register {catalog.find(c => c.slug === addingSlug)?.name}
              </h4>
              <p className="text-xs text-secondary">
                {catalog.find(c => c.slug === addingSlug)?.registrationInstructions}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClasses}>Client ID *</label>
                  <input
                    type="text"
                    value={catalogClientId}
                    onChange={e => setCatalogClientId(e.target.value)}
                    className={inputClasses}
                    placeholder="Your OAuth client ID"
                  />
                </div>
                <div>
                  <label className={labelClasses}>Client Secret</label>
                  <input
                    type="password"
                    value={catalogClientSecret}
                    onChange={e => setCatalogClientSecret(e.target.value)}
                    className={inputClasses}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCatalogRegister}
                  disabled={catalogAdding || !catalogClientId.trim()}
                  className="inline-flex items-center gap-2 bg-cyan text-on-accent px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:shadow-glow-cyan hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  {catalogAdding ? 'Adding...' : 'Add Service'}
                </button>
                <button
                  onClick={() => setAddingSlug(null)}
                  className="px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider border border-subtle text-secondary hover:text-primary transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* OAuth Connected Servers */}
      {oauthServers.length > 0 && (
        <section className="space-y-4">
          <h3 className="font-display text-sm font-medium uppercase tracking-wider text-secondary">
            OAuth Services
          </h3>
          <div className="space-y-3">
            {oauthServers.map(server => {
              const status = getOAuthStatus(server.id);
              const isConnected = status?.connected ?? false;
              return (
                <div
                  key={server.id}
                  className="p-4 rounded-lg border border-subtle bg-surface hover:border-default transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-elevated">
                        <Globe size={16} className={isConnected ? 'text-green-400' : 'text-tertiary'} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-medium text-primary">{server.name}</h3>
                          <span className={`text-xs px-1.5 py-0.5 rounded font-mono uppercase tracking-wider ${
                            isConnected
                              ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                              : 'bg-elevated text-tertiary border border-subtle'
                          }`}>
                            {isConnected ? 'Connected' : 'Not Connected'}
                          </span>
                        </div>
                        {server.description && (
                          <p className="text-xs text-tertiary mt-0.5">{server.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isConnected ? (
                        <button
                          onClick={() => handleOAuthDisconnect(server.id)}
                          disabled={disconnectingId === server.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium uppercase tracking-wider border border-subtle text-secondary hover:text-magenta hover:border-magenta transition-all disabled:opacity-50"
                        >
                          {disconnectingId === server.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Unlink size={12} />
                          )}
                          Disconnect
                        </button>
                      ) : (
                        <button
                          onClick={() => handleOAuthConnect(server.id)}
                          disabled={connectingId === server.id}
                          className="inline-flex items-center gap-1.5 bg-cyan text-on-accent px-3 py-1.5 rounded text-xs font-medium uppercase tracking-wider hover:shadow-glow-cyan hover:brightness-110 disabled:opacity-50 transition-all"
                        >
                          {connectingId === server.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Link2 size={12} />
                          )}
                          Connect
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDelete(server.id)}
                          className="p-1.5 rounded text-tertiary hover:text-magenta transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Manual Servers */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-medium uppercase tracking-wider text-secondary">
            Custom Servers
          </h3>
          {isAdmin && !showForm && (
            <button
              onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
              className="inline-flex items-center gap-2 bg-cyan text-on-accent px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:shadow-glow-cyan hover:brightness-110 transition-all"
            >
              <Plus size={16} />
              Add Server
            </button>
          )}
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="space-y-4 p-4 rounded-lg border border-subtle bg-surface">
            <h3 className="font-display text-sm font-medium uppercase tracking-wider text-primary">
              {editingId ? 'Edit MCP Server' : 'New MCP Server'}
            </h3>

            <div>
              <label className={labelClasses}>Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={inputClasses}
                placeholder="e.g. GitHub, Filesystem, Slack"
                required
              />
            </div>

            <div>
              <label className={labelClasses}>Description</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className={inputClasses}
                placeholder="What tools does this server provide?"
              />
            </div>

            <div>
              <label className={labelClasses}>Transport</label>
              <div className="flex gap-2">
                {(['stdio', 'sse'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, transport_type: t }))}
                    className={`flex items-center gap-2 px-4 py-2 rounded border text-sm uppercase tracking-wider font-mono transition-all ${
                      form.transport_type === t
                        ? 'border-cyan bg-cyan/10 text-cyan'
                        : 'border-subtle text-tertiary hover:text-secondary'
                    }`}
                  >
                    {t === 'stdio' ? <Terminal size={14} /> : <Globe size={14} />}
                    {t === 'stdio' ? 'Stdio (Local)' : 'SSE (Remote)'}
                  </button>
                ))}
              </div>
            </div>

            {form.transport_type === 'stdio' ? (
              <>
                <div>
                  <label className={labelClasses}>Command *</label>
                  <input
                    type="text"
                    value={form.command}
                    onChange={e => setForm(f => ({ ...f, command: e.target.value }))}
                    className={inputClasses}
                    placeholder="e.g. npx, node, python"
                  />
                </div>
                <div>
                  <label className={labelClasses}>Arguments (comma-separated)</label>
                  <input
                    type="text"
                    value={form.args}
                    onChange={e => setForm(f => ({ ...f, args: e.target.value }))}
                    className={inputClasses}
                    placeholder="e.g. -y, @modelcontextprotocol/server-github"
                  />
                </div>
                <div>
                  <label className={labelClasses}>Environment Variables (JSON)</label>
                  <textarea
                    value={form.env}
                    onChange={e => setForm(f => ({ ...f, env: e.target.value }))}
                    className={`${inputClasses} font-mono min-h-[80px] resize-y`}
                    placeholder='{"GITHUB_TOKEN": "ghp_..."}'
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className={labelClasses}>Server URL *</label>
                  <input
                    type="text"
                    value={form.url}
                    onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                    className={inputClasses}
                    placeholder="https://api.example.com/mcp/sse"
                  />
                </div>
                <div>
                  <label className={labelClasses}>Headers (JSON)</label>
                  <textarea
                    value={form.headers}
                    onChange={e => setForm(f => ({ ...f, headers: e.target.value }))}
                    className={`${inputClasses} font-mono min-h-[80px] resize-y`}
                    placeholder='{"Authorization": "Bearer ..."}'
                    rows={3}
                  />
                </div>
              </>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="inline-flex items-center gap-2 bg-cyan text-on-accent px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider hover:shadow-glow-cyan hover:brightness-110 disabled:opacity-50 transition-all"
              >
                {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
                className="px-4 py-2 rounded-md text-sm font-medium uppercase tracking-wider border border-subtle text-secondary hover:text-primary transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Manual Server List */}
        {manualServers.length === 0 && !showForm ? (
          <div className="text-center py-8 text-tertiary">
            <Server size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-xs">No custom MCP servers configured.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {manualServers.map(server => {
              const testResult = testResults[server.id];
              return (
                <div
                  key={server.id}
                  className="p-4 rounded-lg border border-subtle bg-surface hover:border-default transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-elevated">
                        {server.transport_type === 'stdio'
                          ? <Terminal size={16} className="text-cyan" />
                          : <Globe size={16} className="text-magenta" />
                        }
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-primary">{server.name}</h3>
                        <p className="text-xs text-tertiary mt-0.5">
                          {server.transport_type === 'stdio'
                            ? `${server.command} ${server.args ? JSON.parse(server.args).join(' ') : ''}`
                            : server.url
                          }
                        </p>
                        {server.description && (
                          <p className="text-xs text-secondary mt-1">{server.description}</p>
                        )}
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleTest(server.id)}
                          disabled={testingId === server.id}
                          className="px-3 py-1.5 rounded text-xs font-medium uppercase tracking-wider border border-subtle text-secondary hover:text-cyan hover:border-cyan transition-all disabled:opacity-50"
                        >
                          {testingId === server.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            'Test'
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(server)}
                          className="px-3 py-1.5 rounded text-xs font-medium uppercase tracking-wider border border-subtle text-secondary hover:text-primary transition-all"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(server.id)}
                          className="p-1.5 rounded text-tertiary hover:text-magenta transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Test Results */}
                  {testResult && (
                    <div className={`mt-3 p-3 rounded border text-xs ${
                      testResult.success
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-magenta/30 bg-magenta/5'
                    }`}>
                      {testResult.success ? (
                        <div>
                          <div className="flex items-center gap-1.5 text-green-400 mb-1">
                            <CheckCircle size={12} />
                            <span className="font-medium uppercase tracking-wider">Connected</span>
                          </div>
                          {testResult.tools && testResult.tools.length > 0 && (
                            <div className="text-secondary mt-1">
                              <span className="text-tertiary">Tools: </span>
                              {testResult.tools.join(', ')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-magenta">
                          <XCircle size={12} />
                          <span>{testResult.error || 'Connection failed'}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
