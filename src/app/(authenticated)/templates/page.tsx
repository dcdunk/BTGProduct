import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import TemplatesGrid from '@/components/templates/TemplatesGrid';

export default async function TemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return (
    <div className="p-8 animate-page-enter">
      <TemplatesGrid />
    </div>
  );
}
