'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { AuthGate } from '@/components/layout/auth-gate';
import { useOrgStats, useSubjects } from '@/hooks/use-health';
import Link from 'next/link';

const DOMAIN_LABELS: Record<string, string> = {
  cardiovascular: 'Cardio',
  metabolic: 'Metabolic',
  hormonal: 'Hormonal',
  musculoskeletal: 'MSK',
  sleep_recovery: 'Sleep',
  cognitive: 'Cognitive',
};

const BAND_STYLES: Record<string, { dot: string; label: string; color: string }> = {
  ESCALATED: { dot: 'bg-health-coral', label: 'Attention', color: 'text-health-coral' },
  MONITOR:   { dot: 'bg-health-amber',  label: 'Monitor',   color: 'text-health-amber' },
  SUPPRESSED:{ dot: 'bg-health-teal',   label: 'On Track',  color: 'text-health-teal' },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function DashboardContent() {
  const { data: statsEnv, isLoading: statsLoading } = useOrgStats();
  const { data: subjectsEnv, isLoading: subjectsLoading } = useSubjects({ limit: '50' });

  const stats = statsEnv?.data;
  const subjects = subjectsEnv?.data || [];

  const escalated = stats?.governance_bands?.ESCALATED || 0;
  const monitor = stats?.governance_bands?.MONITOR || 0;

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-10">
        {/* Greeting */}
        <div className="mb-10 animate-fade-in">
          <h1 className="text-3xl font-bold tracking-tight text-gravity-text">
            {greeting()}.
          </h1>
          <p className="text-base text-gravity-text-secondary mt-1.5">
            {stats
              ? `${stats.total_subjects} athletes · ${stats.coverage.pct}% data coverage this week`
              : 'Loading...'}
          </p>
        </div>

        {/* Stat row — 4 cards, Apple-clean */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-10 animate-fade-in">
            <StatCard value={stats.total_subjects} label="Athletes" />
            <StatCard
              value={escalated + monitor}
              label="Need Review"
              accent={escalated > 0 ? 'text-health-coral' : 'text-health-amber'}
            />
            <StatCard value={stats.active_protocols.length} label="Protocols" />
            <StatCard value={`${stats.coverage.pct}%`} label="Coverage" accent="text-health-teal" />
          </div>
        )}

        {/* Table */}
        <div className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gravity-text">All Athletes</h2>
            <p className="text-xs text-gravity-text-whisper">Sorted by priority</p>
          </div>

          <div className="border border-gravity-border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_100px_100px_100px_80px] gap-4 px-5 py-2.5 bg-gravity-surface/50 border-b border-gravity-border text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper">
              <span>Name</span>
              <span>Sport</span>
              <span>Phase</span>
              <span>Domain</span>
              <span className="text-right">Status</span>
            </div>

            {/* Rows */}
            {subjectsLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-12 shimmer-bg" />
              ))
            ) : (
              subjects.map((s: any) => {
                const band = BAND_STYLES[s.governance_band] || BAND_STYLES.SUPPRESSED;
                return (
                  <Link
                    key={s.id}
                    href={`/client/${s.id}`}
                    className="grid grid-cols-[1fr_100px_100px_100px_80px] gap-4 px-5 py-3 border-b border-gravity-border last:border-b-0 hover:bg-gravity-surface/40 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${band.dot}`} />
                      <span className="text-sm text-gravity-text truncate group-hover:text-white transition-colors">
                        {s.display_name}
                      </span>
                    </div>
                    <span className="text-xs text-gravity-text-secondary truncate self-center">
                      {s.sport || '—'}
                    </span>
                    <span className="text-xs text-gravity-text-secondary truncate self-center capitalize">
                      {s.training_phase?.replace(/_/g, ' ') || '—'}
                    </span>
                    <span className="text-xs text-gravity-text-secondary self-center">
                      {DOMAIN_LABELS[s.primary_domain] || s.primary_domain}
                    </span>
                    <span className={`text-xs font-medium self-center text-right ${band.color}`}>
                      {band.label}
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function StatCard({ value, label, accent }: { value: string | number; label: string; accent?: string }) {
  return (
    <div className="bg-gravity-surface border border-gravity-border rounded-xl p-5">
      <p className={`text-2xl font-bold font-mono ${accent || 'text-gravity-text'}`}>{value}</p>
      <p className="text-[11px] text-gravity-text-secondary mt-1">{label}</p>
    </div>
  );
}

export default function Home() {
  return (
    <AuthGate>
      <div className="flex min-h-screen">
        <Sidebar />
        <DashboardContent />
      </div>
    </AuthGate>
  );
}
