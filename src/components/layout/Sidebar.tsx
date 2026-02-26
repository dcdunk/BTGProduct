'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  Users,
  Zap,
  FileText,
  ClipboardList,
  Search,
  Settings,
  LogOut,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/agents', label: 'Agents', icon: Users },
  { href: '/skills', label: 'Skills', icon: Zap },
  { href: '/templates', label: 'Templates', icon: FileText },
  { href: '/scratchpad', label: 'Scratchpad', icon: ClipboardList },
  { href: '/search', label: 'Search', icon: Search },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="w-[260px] min-h-screen bg-base border-r border-subtle flex flex-col">
      {/* Wordmark */}
      <div className="px-5 pt-6 pb-8">
        <Link href="/" className="block">
          <h1 className="font-display text-lg font-bold tracking-[0.12em] uppercase">
            <span className="text-primary">Mission </span>
            <span className="text-cyan">Control</span>
          </h1>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium uppercase tracking-wider transition-all
                    ${isActive
                      ? 'text-cyan bg-cyan-muted border-l-2 border-cyan'
                      : 'text-secondary hover:text-primary hover:bg-surface-hover border-l-2 border-transparent'
                    }
                  `}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User section */}
      <div className="px-3 pb-4 mt-auto border-t border-subtle pt-4">
        <div className="flex items-center justify-between px-3">
          <div className="flex items-center gap-3 min-w-0">
            {session?.user?.image ? (
              <img
                src={session.user.image}
                alt=""
                className="w-8 h-8 rounded-full flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-elevated flex-shrink-0 flex items-center justify-center text-xs text-secondary">
                {session?.user?.name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
            )}
            <span className="text-xs text-secondary truncate">
              {session?.user?.name ?? 'User'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="p-2 rounded-lg text-secondary hover:text-magenta hover:bg-surface-hover transition-colors"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
