import SkillForm from '@/components/skills/SkillForm';

export default function NewSkillPage() {
  return (
    <div className="p-8 animate-page-enter max-w-3xl">
      <h1 className="font-display text-xl font-medium uppercase tracking-wider text-primary mb-8">
        Create Skill
      </h1>
      <SkillForm mode="create" />
    </div>
  );
}
