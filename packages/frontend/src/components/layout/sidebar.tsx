'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSubjects } from '@/hooks/use-health';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: GridIcon },
  { href: '/athletes', label: 'Athletes', icon: UsersIcon },
];

function GridIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path d="M3 4a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm8 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V4zM3 12a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zm8 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" width="16" height="16">
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zm-4.07 11c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  );
}

const BAND_DOT: Record<string, string> = {
  ESCALATED: 'bg-health-coral',
  MONITOR: 'bg-health-amber',
  SUPPRESSED: 'bg-health-teal',
};

export function Sidebar() {
  const pathname = usePathname();
  const { data: env } = useSubjects({ limit: '50' });
  const subjects = env?.data || [];

  const isAthleteDetail = pathname.startsWith('/client/');
  const activeId = isAthleteDetail ? pathname.split('/')[2] : null;

  return (
    <aside className="w-64 h-screen sticky top-0 border-r border-gravity-border bg-gravity-bg flex flex-col shrink-0">
      {/* Brand */}
      <Link href="/" className="h-14 flex items-center gap-2.5 px-5 border-b border-gravity-border shrink-0">
        <div className="w-2 h-2 rounded-full bg-health-teal animate-pulse-soft" />
        <span className="font-semibold text-sm tracking-wide text-gravity-text">LONGEVITY</span>
        <span className="text-[9px] font-medium tracking-widest text-gravity-accent-warm">plan.ai</span>
      </Link>

      {/* Nav */}
      <nav className="px-3 py-4 space-y-0.5 shrink-0">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-gravity-surface text-gravity-text font-medium'
                  : 'text-gravity-text-secondary hover:text-gravity-text hover:bg-gravity-surface/50'
              }`}
            >
              <Icon className="opacity-60" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Athlete list */}
      <div className="flex-1 overflow-y-auto border-t border-gravity-border">
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper">Athletes</p>
        </div>
        <div className="px-2 pb-4 space-y-0.5">
          {subjects.map((s: any) => (
            <Link
              key={s.id}
              href={`/client/${s.id}`}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all ${
                activeId === s.id
                  ? 'bg-gravity-surface text-gravity-text'
                  : 'text-gravity-text-secondary hover:bg-gravity-surface/50 hover:text-gravity-text'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${BAND_DOT[s.governance_band] || 'bg-gravity-text-whisper'}`} />
              <span className="truncate">{s.display_name}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gravity-border shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-gravity-elevated border border-gravity-border flex items-center justify-center text-[10px] font-bold text-health-teal">
            C
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gravity-text truncate">Coach</p>
            <p className="text-[10px] text-gravity-text-whisper">Practitioner</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
