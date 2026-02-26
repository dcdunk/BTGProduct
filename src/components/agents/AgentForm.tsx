'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { type Agent, type Skill, type Template } from '@/types';

interface SkillAssignment {
  skillId: string;
  mode: 'always_on' | 'on_demand';
  sort_order: number;
}

interface TemplateAssignment {
  templateId: string;
  sort_order: number;
}

interface AgentFormProps {
  mode: 'create' | 'edit';
  agent?: Agent;
}

export default function AgentForm({ mode, agent }: AgentFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Basic info
  const [name, setName] = useState(agent?.name ?? '');
  const [description, setDescription] = useState(agent?.description ?? '');
  const [avatarEmoji, setAvatarEmoji] = useState(agent?.avatar_emoji ?? '🤖');

  // System prompt
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt ?? '');

  // Skills & templates (edit mode only)
  const [allSkills, setAllSkills] = useState<(Skill & { agent_count: number })[]>([]);
  const [allTemplates, setAllTemplates] = useState<(Template & { agent_count: number })[]>([]);
  const [skillAssignments, setSkillAssignments] = useState<SkillAssignment[]>([]);
  const [templateAssignments, setTemplateAssignments] = useState<TemplateAssignment[]>([]);
  // Load skills and templates in edit mode
  useEffect(() => {
    if (mode !== 'edit' || !agent) return;

    Promise.all([
      fetch('/api/skills').then(r => r.json()),
      fetch('/api/templates').then(r => r.json()),
      fetch(`/api/agents/${agent.id}/skills`).then(r => r.json()),
      fetch(`/api/agents/${agent.id}/templates`).then(r => r.json()),
    ]).then(([skills, templates, agentSkills, agentTemplates]) => {
      setAllSkills(skills);
      setAllTemplates(templates);
      setSkillAssignments(
        agentSkills.map((s: Skill & { mode: string; sort_order: number }) => ({
          skillId: s.id,
          mode: s.mode as 'always_on' | 'on_demand',
          sort_order: s.sort_order,
        }))
      );
      setTemplateAssignments(
        agentTemplates.map((t: Template & { sort_order: number }) => ({
          templateId: t.id,
          sort_order: t.sort_order,
        }))
      );
    });
  }, [mode, agent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        avatar_emoji: avatarEmoji,
        system_prompt: systemPrompt,
      };

      if (mode === 'create') {
        const res = await fetch('/api/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error('Failed to create agent');
        const created = await res.json();
        router.push(`/agents/${created.slug}/edit`);
      } else if (agent) {
        const res = await fetch(`/api/agents/${agent.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (!res.ok) throw new Error('Failed to update agent');

        // Save skill and template assignments
        await Promise.all([
          fetch(`/api/agents/${agent.id}/skills`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignments: skillAssignments }) }),
          fetch(`/api/agents/${agent.id}/templates`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignments: templateAssignments }) }),
        ]);

        router.push('/agents');
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
    if (!agent) return;
    if (!window.confirm(`Delete "${agent.name}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete agent');
      router.push('/agents');
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Failed to delete agent.');
    } finally {
      setSaving(false);
    }
  };

  const toggleSkill = (skillId: string) => {
    setSkillAssignments(prev => {
      const exists = prev.find(a => a.skillId === skillId);
      if (exists) return prev.filter(a => a.skillId !== skillId);
      return [...prev, { skillId, mode: 'on_demand' as const, sort_order: prev.length }];
    });
  };

  const toggleSkillMode = (skillId: string) => {
    setSkillAssignments(prev =>
      prev.map(a => a.skillId === skillId ? { ...a, mode: a.mode === 'always_on' ? 'on_demand' : 'always_on' } : a)
    );
  };

  const toggleTemplate = (templateId: string) => {
    setTemplateAssignments(prev => {
      const exists = prev.find(a => a.templateId === templateId);
      if (exists) return prev.filter(a => a.templateId !== templateId);
      return [...prev, { templateId, sort_order: prev.length }];
    });
  };

  const inputClasses = 'w-full bg-elevated border border-subtle rounded px-3 py-2 text-primary text-sm focus:border-cyan focus:outline-none focus:shadow-glow-cyan-subtle transition-all';
  const labelClasses = 'text-xs text-secondary uppercase tracking-wider font-mono mb-1.5 block';

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Info */}
      <section className="space-y-4">
        <h2 className="font-display text-sm font-medium uppercase tracking-wider text-secondary">
          Basic Info
        </h2>

        <div className="flex gap-4">
          {/* Avatar Emoji */}
          <div>
            <label className={labelClasses}>Icon</label>
            <input
              type="text"
              value={avatarEmoji}
              onChange={e => setAvatarEmoji(e.target.value)}
              className={`${inputClasses} w-16 text-center text-2xl`}
              maxLength={4}
            />
          </div>

          {/* Name */}
          <div className="flex-1">
            <label className={labelClasses}>Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className={inputClasses}
              placeholder="e.g. PRD Writer"
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
            placeholder="Brief description of what this agent does"
          />
        </div>
      </section>

      {/* System Prompt */}
      <section className="space-y-4">
        <h2 className="font-display text-sm font-medium uppercase tracking-wider text-secondary">
          System Prompt
        </h2>
        <div>
          <label className={labelClasses}>Instructions</label>
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            className={`${inputClasses} min-h-[200px] resize-y font-mono`}
            placeholder="You are a helpful assistant that..."
            rows={8}
          />
        </div>
      </section>

      {/* Skills Assignment (edit mode only) */}
      {mode === 'edit' && allSkills.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-sm font-medium uppercase tracking-wider text-secondary">
            Skills
          </h2>
          <div className="space-y-2">
            {allSkills.map(skill => {
              const assignment = skillAssignments.find(a => a.skillId === skill.id);
              return (
                <div
                  key={skill.id}
                  className={`flex items-center justify-between p-3 rounded border transition-all ${
                    assignment
                      ? 'border-cyan/50 bg-cyan/5'
                      : 'border-subtle bg-elevated'
                  }`}
                >
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={!!assignment}
                      onChange={() => toggleSkill(skill.id)}
                      className="accent-cyan"
                    />
                    <span className="text-lg">{skill.icon_emoji}</span>
                    <div>
                      <span className="text-sm text-primary">{skill.name}</span>
                      {skill.category && (
                        <span className="ml-2 text-xs text-tertiary uppercase">
                          {skill.category}
                        </span>
                      )}
                    </div>
                  </label>
                  {assignment && (
                    <button
                      type="button"
                      onClick={() => toggleSkillMode(skill.id)}
                      className={`text-xs px-2 py-1 rounded uppercase tracking-wider font-mono transition-colors ${
                        assignment.mode === 'always_on'
                          ? 'bg-cyan/20 text-cyan'
                          : 'bg-elevated text-secondary border border-subtle'
                      }`}
                    >
                      {assignment.mode === 'always_on' ? 'Always On' : 'On Demand'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Templates Assignment (edit mode only) */}
      {mode === 'edit' && allTemplates.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-sm font-medium uppercase tracking-wider text-secondary">
            Templates
          </h2>
          <div className="space-y-2">
            {allTemplates.map(template => {
              const assignment = templateAssignments.find(a => a.templateId === template.id);
              return (
                <div
                  key={template.id}
                  className={`flex items-center gap-3 p-3 rounded border transition-all ${
                    assignment
                      ? 'border-cyan/50 bg-cyan/5'
                      : 'border-subtle bg-elevated'
                  }`}
                >
                  <label className="flex items-center gap-3 cursor-pointer flex-1">
                    <input
                      type="checkbox"
                      checked={!!assignment}
                      onChange={() => toggleTemplate(template.id)}
                      className="accent-cyan"
                    />
                    <span className="text-lg">{template.icon_emoji}</span>
                    <div>
                      <span className="text-sm text-primary">{template.name}</span>
                      <span className="ml-2 text-xs text-tertiary uppercase">
                        {template.format}
                      </span>
                    </div>
                  </label>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-subtle">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-2 bg-cyan text-on-accent px-5 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:shadow-glow-cyan hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? 'Saving...' : mode === 'create' ? 'Create Agent' : 'Save Changes'}
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
            Delete Agent
          </button>
        )}
      </div>
    </form>
  );
}
