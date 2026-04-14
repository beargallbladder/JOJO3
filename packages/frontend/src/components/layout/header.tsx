'use client';

import Link from 'next/link';

export function Header() {
  return (
    <header className="border-b border-gravity-border bg-gravity-bg/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-health-teal animate-pulse-soft" />
          <span className="font-semibold text-sm tracking-wide">LONGEVITY</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-gravity-accent-warm ml-0.5">plan.ai</span>
        </Link>
        <div className="flex items-center gap-4 text-xs text-gravity-text-secondary">
          <span className="hidden sm:inline">Coach Dashboard</span>
          <div className="w-7 h-7 rounded-full bg-gravity-elevated border border-gravity-border flex items-center justify-center text-[10px] font-bold text-health-teal">
            C
          </div>
        </div>
      </div>
    </header>
  );
}
