'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Template } from '@/types';

interface TemplateFormProps {
  mode: 'create' | 'edit';
  template?: Template;
}

export default function TemplateForm({ mode, template }: TemplateFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [iconEmoji, setIconEmoji] = useState(template?.icon_emoji ?? '📋');
  const [format, setFormat] = useState<'markdown' | 'structured'>(template?.format ?? 'markdown');
  const [category, setCategory] = useState(template?.category ?? '');
  const [content, setContent] = useState(template?.content ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    setSaving(true);

    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        icon_emoji: iconEmoji,
        format,
        category: category.trim() || null,
        content: content.trim(),
      };

      if (mode === 'create') {
        const res = await fetch('/api/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error('Failed to create template');
        const created = await res.json();
        router.push(`/templates/${created.slug}/edit`);
      } else if (template) {
        const res = await fetch(`/api/templates/${template.slug}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error('Failed to update template');
        router.push('/templates');
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      alert('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!template) return;
    if (!window.confirm(`Delete "${template.name}"? This will remove it from all agents.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${template.slug}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete template');
      router.push('/templates');
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Failed to delete template.');
    } finally {
      setSaving(false);
    }
  };

  const inputClasses = 'w-full bg-elevated border border-subtle rounded px-3 py-2 text-primary text-sm focus:border-cyan focus:outline-none focus:shadow-glow-cyan-subtle transition-all';
  const labelClasses = 'text-xs text-secondary uppercase tracking-wider font-mono mb-1.5 block';

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex gap-4">
        <div>
          <label className={labelClasses}>Icon</label>
          <input
            type="text"
            value={iconEmoji}
            onChange={e => setIconEmoji(e.target.value)}
            className={`${inputClasses} w-16 text-center text-2xl`}
            maxLength={4}
          />
        </div>
        <div className="flex-1">
          <label className={labelClasses}>Name *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className={inputClasses}
            placeholder="e.g. PRD Template"
            required
          />
        </div>
      </div>

      <div>
        <label className={labelClasses}>Description</label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className={inputClasses}
          placeholder="Brief description of this template"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClasses}>Format</label>
          <select
            value={format}
            onChange={e => setFormat(e.target.value as 'markdown' | 'structured')}
            className={inputClasses}
          >
            <option value="markdown">Markdown</option>
            <option value="structured">Structured</option>
          </select>
        </div>
        <div>
          <label className={labelClasses}>Category</label>
          <input
            type="text"
            value={category}
            onChange={e => setCategory(e.target.value)}
            className={inputClasses}
            placeholder="e.g. Product, Engineering"
          />
        </div>
      </div>

      <div>
        <label className={labelClasses}>Content *</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          className={`${inputClasses} min-h-[300px] resize-y font-mono`}
          placeholder="Template content that will structure the agent's output..."
          rows={12}
          required
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-subtle">
        <button
          type="submit"
          disabled={saving || !name.trim() || !content.trim()}
          className="inline-flex items-center gap-2 bg-cyan text-on-accent px-5 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:shadow-glow-cyan hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? 'Saving...' : mode === 'create' ? 'Create Template' : 'Save Changes'}
        </button>

        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider border border-subtle text-secondary hover:text-primary hover:border-default transition-all"
        >
          Cancel
        </button>

        {mode === 'edit' && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={saving}
            className="ml-auto px-5 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider border border-magenta/50 text-magenta hover:bg-magenta/10 disabled:opacity-50 transition-all"
          >
            Delete Template
          </button>
        )}
      </div>
    </form>
  );
}
