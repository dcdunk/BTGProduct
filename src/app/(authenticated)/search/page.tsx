import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ConversationSearch from '@/components/search/ConversationSearch';

export default async function SearchPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  return (
    <div className="p-8 animate-page-enter">
      <ConversationSearch />
    </div>
  );
}
