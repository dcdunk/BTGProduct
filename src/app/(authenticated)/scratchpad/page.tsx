import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ScratchpadView from '@/components/scratchpad/ScratchpadView';

export default async function ScratchpadPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return (
    <div className="p-8 animate-page-enter h-full">
      <ScratchpadView />
    </div>
  );
}
