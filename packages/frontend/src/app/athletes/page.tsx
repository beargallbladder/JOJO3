'use client';

import { Sidebar } from '@/components/layout/sidebar';
import { AuthGate } from '@/components/layout/auth-gate';
import { useSubjects } from '@/hooks/use-health';
import Link from 'next/link';

const DOMAIN_LABELS: Record<string, string> = {
  cardiovascular: 'Cardio',
  metabolic: 'Metabolic',
  hormonal: 'Hormonal',
  musculoskeletal: 'MSK',
  sleep_recovery: 'Sleep',
  cognitive: 'Cognitive',
};

const BAND_CONFIG: Record<string, { dot: string; label: string; color: string }> = {
  ESCALATED: { dot: 'bg-health-coral', label: 'Attention', color: 'text-health-coral' },
  MONITOR:   { dot: 'bg-health-amber',  label: 'Monitor',   color: 'text-health-amber' },
  SUPPRESSED:{ dot: 'bg-health-teal',   label: 'On Track',  color: 'text-health-teal' },
};

function AthletesContent() {
  const { data: env, isLoading } = useSubjects({ limit: '100' });
  const subjects = env?.data || [];

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-10">
        <div className="mb-8 animate-fade-in">
          <h1 className="text-3xl font-bold tracking-tight text-gravity-text">Athletes</h1>
          <p className="text-base text-gravity-text-secondary mt-1.5">{subjects.length} enrolled</p>
        </div>

        <div className="border border-gravity-border rounded-xl overflow-hidden animate-fade-in">
          <div className="grid grid-cols-[1fr_100px_100px_100px_80px_60px] gap-4 px-5 py-2.5 bg-gravity-surface/50 border-b border-gravity-border text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper">
            <span>Name</span>
            <span>Sport</span>
            <span>Phase</span>
            <span>Domain</span>
            <span className="text-right">Concern</span>
            <span className="text-right">Status</span>
          </div>

          {isLoading ? (
            Array.from({ length: 12 }).map((_, i) => <div key={i} className="h-12 shimmer-bg" />)
          ) : (
            subjects.map((s: any) => {
              const band = BAND_CONFIG[s.governance_band] || BAND_CONFIG.SUPPRESSED;
              return (
                <Link
                  key={s.id}
                  href={`/client/${s.id}`}
                  className="grid grid-cols-[1fr_100px_100px_100px_80px_60px] gap-4 px-5 py-3 border-b border-gravity-border last:border-b-0 hover:bg-gravity-surface/40 transition-colors group items-center"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${band.dot}`} />
                    <span className="text-sm text-gravity-text truncate group-hover:text-white transition-colors">{s.display_name}</span>
                  </div>
                  <span className="text-xs text-gravity-text-secondary truncate">{s.sport || '—'}</span>
                  <span className="text-xs text-gravity-text-secondary capitalize truncate">{s.training_phase?.replace(/_/g, ' ') || '—'}</span>
                  <span className="text-xs text-gravity-text-secondary">{DOMAIN_LABELS[s.primary_domain] || s.primary_domain}</span>
                  <span className="text-sm font-mono text-gravity-text text-right">{Math.round(s.posterior_p * 100)}%</span>
                  <span className={`text-[10px] font-medium text-right ${band.color}`}>{band.label}</span>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}

export default function AthletesPage() {
  return (
    <AuthGate>
      <div className="flex min-h-screen">
        <Sidebar />
        <AthletesContent />
      </div>
    </AuthGate>
  );
}
