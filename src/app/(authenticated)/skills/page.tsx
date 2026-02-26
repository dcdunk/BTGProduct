import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import SkillsGrid from '@/components/skills/SkillsGrid';

export default async function SkillsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return (
    <div className="p-8 animate-page-enter">
      <SkillsGrid />
    </div>
  );
}
