'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import SkillCard from './SkillCard';
import type { Skill } from '@/types';

type SkillWithCount = Skill & { agent_count: number };

export default function SkillsGrid() {
  const [skills, setSkills] = useState<SkillWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/skills')
      .then(r => r.json())
      .then(data => {
        setSkills(data);
        setLoading(false);
      });
  }, []);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    skills.forEach(s => { if (s.category) cats.add(s.category); });
    return Array.from(cats).sort();
  }, [skills]);

  const filtered = activeCategory
    ? skills.filter(s => s.category === activeCategory)
    : skills;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-tertiary text-sm uppercase tracking-wider">
          Loading skills...
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-xl font-medium uppercase tracking-wider text-primary">
            Skills
          </h1>
          <p className="text-secondary text-sm mt-1">
            Reusable instruction sets for agents
          </p>
        </div>
        <Link
          href="/skills/new"
          className="inline-flex items-center gap-2 bg-cyan text-on-accent px-5 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:shadow-glow-cyan hover:brightness-110 transition-all"
        >
          <Plus size={16} />
          New Skill
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
          <span className="text-5xl mb-4">⚡</span>
          <h2 className="font-display text-lg font-medium uppercase tracking-wider text-primary mb-2">
            No skills yet
          </h2>
          <p className="text-secondary text-sm mb-6">
            Create your first skill to enhance your agents.
          </p>
          <Link
            href="/skills/new"
            className="inline-flex items-center gap-2 bg-cyan text-on-accent px-5 py-2.5 rounded-md text-sm font-medium uppercase tracking-wider hover:shadow-glow-cyan hover:brightness-110 transition-all"
          >
            <Plus size={16} />
            Create Skill
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(skill => (
            <SkillCard key={skill.id} skill={skill} />
          ))}
        </div>
      )}
    </div>
  );
}
