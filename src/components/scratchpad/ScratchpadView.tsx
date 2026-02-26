'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { ScratchpadItem } from '@/types';

export default function ScratchpadView() {
  const [items, setItems] = useState<ScratchpadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    fetch('/api/scratchpad')
      .then(r => r.json())
      .then(data => { setItems(data); setLoading(false); });
  }, []);

  const selectedItem = items.find(i => i.id === selectedId);

  const handleCreate = async () => {
    if (!editTitle.trim() || !editContent.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/scratchpad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim(), content: editContent.trim() }),
      });
      if (res.ok) {
        const item = await res.json();
        setItems(prev => [item, ...prev]);
        setSelectedId(item.id);
        setIsCreating(false);
        setIsEditing(false);
      }
    } catch { alert('Failed to create item.'); }
    finally { setSaving(false); }
  };

  const handleUpdate = async () => {
    if (!selectedId || !editTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/scratchpad/${selectedId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle.trim(), content: editContent.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems(prev => prev.map(i => i.id === selectedId ? updated : i));
        setIsEditing(false);
      }
    } catch { alert('Failed to update item.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this scratchpad item?')) return;
    try {
      await fetch(`/api/scratchpad/${id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== id));
      if (selectedId === id) { setSelectedId(null); setIsEditing(false); }
    } catch { alert('Failed to delete item.'); }
  };

  const startCreate = () => {
    setIsCreating(true);
    setIsEditing(true);
    setSelectedId(null);
    setEditTitle('');
    setEditContent('');
  };

  const startEdit = (item: ScratchpadItem) => {
    setIsEditing(true);
    setEditTitle(item.title);
    setEditContent(item.content);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setIsCreating(false);
    if (selectedItem) {
      setEditTitle(selectedItem.title);
      setEditContent(selectedItem.content);
    }
  };

  const selectItem = (item: ScratchpadItem) => {
    setSelectedId(item.id);
    setIsCreating(false);
    setIsEditing(false);
    setEditTitle(item.title);
    setEditContent(item.content);
  };

  const inputClasses = 'w-full bg-elevated border border-subtle rounded px-3 py-2 text-primary text-sm focus:border-cyan focus:outline-none focus:shadow-glow-cyan-subtle transition-all';
  const labelClasses = 'text-xs text-secondary uppercase tracking-wider font-mono mb-1.5 block';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-tertiary text-sm uppercase tracking-wider">Loading scratchpad...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-medium uppercase tracking-wider text-primary">
            Scratchpad
          </h1>
          <p className="text-secondary text-sm mt-1">
            Save and organize content from conversations
          </p>
        </div>
        <button
          onClick={startCreate}
          className="inline-flex items-center gap-2 bg-cyan text-on-accent px-5 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:shadow-glow-cyan hover:brightness-110 transition-all"
        >
          <Plus size={16} />
          New Item
        </button>
      </div>

      {items.length === 0 && !isCreating ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">📋</span>
          <h2 className="font-display text-lg font-medium uppercase tracking-wider text-primary mb-2">
            Scratchpad is empty
          </h2>
          <p className="text-secondary text-sm mb-6">
            Save messages from chat or create items manually.
          </p>
          <button
            onClick={startCreate}
            className="inline-flex items-center gap-2 bg-cyan text-on-accent px-5 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:shadow-glow-cyan hover:brightness-110 transition-all"
          >
            <Plus size={16} />
            Create Item
          </button>
        </div>
      ) : (
        <div className="flex gap-6" style={{ minHeight: '500px' }}>
          {/* Left panel: item list */}
          <div className="w-80 flex-shrink-0 space-y-2 overflow-y-auto">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => selectItem(item)}
                className={`w-full text-left p-4 rounded-lg border transition-all ${
                  selectedId === item.id
                    ? 'border-cyan bg-cyan/5'
                    : 'border-subtle bg-elevated hover:border-cyan/50'
                }`}
              >
                <h3 className="text-sm font-medium text-primary truncate">{item.title}</h3>
                <p className="text-xs text-tertiary mt-1 line-clamp-2">{item.content}</p>
                <span className="text-xs text-tertiary mt-2 block">
                  {formatDistanceToNow(new Date(item.updated_at + 'Z'), { addSuffix: true })}
                </span>
              </button>
            ))}
          </div>

          {/* Right panel: detail / edit */}
          <div className="flex-1 min-w-0">
            {isCreating || (selectedItem && isEditing) ? (
              <div className="space-y-4">
                <div>
                  <label className={labelClasses}>Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className={inputClasses}
                    placeholder="Item title"
                  />
                </div>
                <div>
                  <label className={labelClasses}>Content</label>
                  <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    className={`${inputClasses} min-h-[300px] resize-y font-mono`}
                    placeholder="Content..."
                    rows={12}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={isCreating ? handleCreate : handleUpdate}
                    disabled={saving || !editTitle.trim()}
                    className="inline-flex items-center gap-2 bg-cyan text-on-accent px-5 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:shadow-glow-cyan hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    <Save size={14} />
                    {saving ? 'Saving...' : isCreating ? 'Create' : 'Save'}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-5 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider border border-subtle text-secondary hover:text-primary hover:border-default transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : selectedItem ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-display text-lg font-medium uppercase tracking-wider text-primary">
                    {selectedItem.title}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => startEdit(selectedItem)}
                      className="px-3 py-1.5 rounded text-xs font-medium uppercase tracking-wider border border-subtle text-secondary hover:text-primary hover:border-default transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(selectedItem.id)}
                      className="p-1.5 rounded text-tertiary hover:text-magenta transition-colors"
                      aria-label="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="text-sm text-primary whitespace-pre-wrap font-mono bg-elevated border border-subtle rounded-lg p-4">
                  {selectedItem.content}
                </div>
                <p className="text-xs text-tertiary mt-3">
                  Created {formatDistanceToNow(new Date(selectedItem.created_at + 'Z'), { addSuffix: true })}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-tertiary text-sm">
                Select an item or create a new one
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
