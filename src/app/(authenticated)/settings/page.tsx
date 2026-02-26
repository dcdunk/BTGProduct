import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import SettingsLayout from '@/components/settings/SettingsLayout';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) return null;

  const role = (session.user as { role: string }).role;

  return (
    <div className="p-8 animate-page-enter">
      <h1 className="font-display text-xl font-medium uppercase tracking-wider text-primary mb-8">
        Settings
      </h1>
      <SettingsLayout isAdmin={role === 'admin'} />
    </div>
  );
}
