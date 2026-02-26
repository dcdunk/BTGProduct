'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="w-2 h-5 bg-cyan rounded-sm animate-pulse-glow" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return <>{children}</>;
}
