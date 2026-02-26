import { getSkillBySlug } from '@/lib/db';
import { notFound } from 'next/navigation';
import SkillForm from '@/components/skills/SkillForm';
import type { Skill } from '@/types';

interface PageProps {
  params: { slug: string };
}

export default async function EditSkillPage({ params }: PageProps) {
  const skill = getSkillBySlug(params.slug) as Skill | undefined;
  if (!skill) notFound();

  return (
    <div className="p-8 animate-page-enter max-w-3xl">
      <h1 className="font-display text-xl font-medium uppercase tracking-wider text-primary mb-8">
        Edit {skill.name}
      </h1>
      <SkillForm mode="edit" skill={skill} />
    </div>
  );
}
