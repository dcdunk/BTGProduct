'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import TemplateCard from './TemplateCard';
import type { Template } from '@/types';

type TemplateWithCount = Template & { agent_count: number };

export default function TemplatesGrid() {
  const [templates, setTemplates] = useState<TemplateWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(data => {
        setTemplates(data);
        setLoading(false);
      });
  }, []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    templates.forEach(t => { if (t.category) cats.add(t.category); });
    return Array.from(cats).sort();
  }, [templates]);

  const filtered = activeCategory
    ? templates.filter(t => t.category === activeCategory)
    : templates;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-tertiary text-sm uppercase tracking-wider">
          Loading templates...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-medium uppercase tracking-wider text-primary">
            Templates
          </h1>
          <p className="text-secondary text-sm mt-1">
            Output format templates for agents
          </p>
        </div>
        <Link
          href="/templates/new"
          className="inline-flex items-center gap-2 bg-cyan text-on-accent px-5 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:shadow-glow-cyan hover:brightness-110 transition-all"
        >
          <Plus size={16} />
          New Template
        </Link>
      </div>

      {/* Category filter tabs */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-3 py-1.5 rounded text-xs font-medium uppercase tracking-wider transition-all ${
              activeCategory === null
                ? 'bg-cyan/20 text-cyan'
                : 'text-tertiary hover:text-secondary'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded text-xs font-medium uppercase tracking-wider transition-all ${
                activeCategory === cat
                  ? 'bg-cyan/20 text-cyan'
                  : 'text-tertiary hover:text-secondary'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">📋</span>
          <h2 className="font-display text-lg font-medium uppercase tracking-wider text-primary mb-2">
            No templates yet
          </h2>
          <p className="text-secondary text-sm mb-6">
            Create your first template to structure agent outputs.
          </p>
          <Link
            href="/templates/new"
            className="inline-flex items-center gap-2 bg-cyan text-on-accent px-5 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:shadow-glow-cyan hover:brightness-110 transition-all"
          >
            <Plus size={16} />
            Create Template
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(template => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  );
}
