'use client';

import { useState, useEffect } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import type { ContextFile } from '@/types';

export default function WorkspaceContextEditor() {
  const [files, setFiles] = useState<ContextFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch('/api/settings/workspace-context')
      .then(r => r.json())
      .then(data => {
        setFiles(data);
        setLoading(false);
      });
  }, []);

  const handleSave = async (file: ContextFile) => {
    setSavingId(file.id);
    try {
      await fetch('/api/settings/workspace-context', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: file.id, content: file.content }),
      });
    } catch (err) {
      console.error(err);
      alert('Failed to save.');
    } finally {
      setSavingId(null);
    }
  };

  const handleCreate = async () => {
    if (!newFileName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/settings/workspace-context', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFileName.trim(), content: '' }),
      });
      if (res.ok) {
        const file = await res.json();
        setFiles(prev => [...prev, file]);
        setNewFileName('');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to create file.');
    } finally {
      setCreating(false);
    }
  };

  const updateContent = (id: string, content: string) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, content } : f));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-pulse text-tertiary text-sm uppercase tracking-wider">
          Loading workspace context...
        </div>
      </div>
    );
  }

  const inputClasses = 'bg-elevated border border-subtle rounded px-3 py-2 text-primary text-sm focus:border-cyan focus:outline-none focus:shadow-glow-cyan-subtle transition-all';
  const labelClasses = 'text-xs text-secondary uppercase tracking-wider font-mono mb-1.5 block';

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-secondary text-sm">
        Workspace context files are included in every agent&apos;s system prompt. Use them for company-wide information, brand guidelines, or shared context.
      </p>

      {files.map(file => (
        <div key={file.id} className="border border-subtle rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className={labelClasses}>{file.name}</label>
            <button
              onClick={() => handleSave(file)}
              disabled={savingId === file.id}
              className="inline-flex items-center gap-1.5 text-xs text-cyan hover:text-cyan/80 disabled:opacity-50 uppercase tracking-wider font-mono transition-colors"
            >
              <Save size={14} />
              {savingId === file.id ? 'Saving...' : 'Save'}
            </button>
          </div>
          <textarea
            value={file.content}
            onChange={e => updateContent(file.id, e.target.value)}
            className={`w-full ${inputClasses} min-h-[150px] resize-y font-mono`}
            rows={6}
          />
        </div>
      ))}

      {/* Add new file */}
      <div className="border border-dashed border-subtle rounded-lg p-4">
        <label className={labelClasses}>Add Context File</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={newFileName}
            onChange={e => setNewFileName(e.target.value)}
            className={`flex-1 ${inputClasses}`}
            placeholder="File name (e.g. brand-guidelines)"
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newFileName.trim()}
            className="inline-flex items-center gap-2 bg-cyan text-on-accent px-4 py-2 rounded text-sm font-medium uppercase tracking-wider hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
