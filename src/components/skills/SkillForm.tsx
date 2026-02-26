'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Skill } from '@/types';

interface SkillFormProps {
  mode: 'create' | 'edit';
  skill?: Skill;
}

export default function SkillForm({ mode, skill }: SkillFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState(skill?.name ?? '');
  const [description, setDescription] = useState(skill?.description ?? '');
  const [iconEmoji, setIconEmoji] = useState(skill?.icon_emoji ?? '⚡');
  const [category, setCategory] = useState(skill?.category ?? '');
  const [content, setContent] = useState(skill?.content ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !content.trim()) return;
    setSaving(true);

    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        icon_emoji: iconEmoji,
        category: category.trim() || null,
        content: content.trim(),
      };

      if (mode === 'create') {
        const res = await fetch('/api/skills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error('Failed to create skill');
        const created = await res.json();
        router.push(`/skills/${created.slug}/edit`);
      } else if (skill) {
        const res = await fetch(`/api/skills/${skill.slug}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error('Failed to update skill');
        router.push('/skills');
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
    if (!skill) return;
    if (!window.confirm(`Delete "${skill.name}"? This will remove it from all agents.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/skills/${skill.slug}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete skill');
      router.push('/skills');
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Failed to delete skill.');
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
            placeholder="e.g. RICE Scoring"
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
          placeholder="Brief description of what this skill does"
        />
      </div>

      <div>
        <label className={labelClasses}>Category</label>
        <input
          type="text"
          value={category}
          onChange={e => setCategory(e.target.value)}
          className={inputClasses}
          placeholder="e.g. Analysis, Writing, Research"
        />
      </div>

      <div>
        <label className={labelClasses}>Content *</label>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          className={`${inputClasses} min-h-[300px] resize-y font-mono`}
          placeholder="Skill instructions that will be injected into the system prompt..."
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
          {saving ? 'Saving...' : mode === 'create' ? 'Create Skill' : 'Save Changes'}
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
            Delete Skill
          </button>
        )}
      </div>
    </form>
  );
}
