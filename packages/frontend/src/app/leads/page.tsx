'use client';

import { useState } from 'react';
import { useLeads } from '@/hooks/use-leads';
import { LeadTable } from '@/components/leads/lead-table';
import { BandFilter } from '@/components/leads/band-filter';
import { SubsystemFilter } from '@/components/leads/subsystem-filter';
import { VoiceOverlay } from '@/components/voice/voice-overlay';
import { VoiceTrigger } from '@/components/voice/voice-trigger';
import { Header } from '@/components/layout/header';
import { useVoicePreload } from '@/hooks/use-voice-preload';
import { API_BASE } from '@/lib/api-client';

export default function LeadsPage() {
  useVoicePreload('fleet', null);
  const [governanceBand, setGovernanceBand] = useState<string | null>(null);
  const [subsystem, setSubsystem] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const limit = 50;

  const { data, isLoading, isError, error, isFetching } = useLeads({
    governance_band: governanceBand || undefined,
    subsystem: subsystem || undefined,
    page,
    limit,
  });

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-lg font-medium tracking-wide">Command Board</h1>
          <p className="text-sm text-gravity-text-secondary mt-1">
            {data
              ? `${data.total} VINs · Governance bands: ESCALATED > MONITOR > SUPPRESSED`
              : isError
                ? 'Failed to load fleet data.'
                : (isLoading || isFetching)
                  ? 'Loading fleet data...'
                  : 'Fleet data unavailable.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-4 mb-6">
          <BandFilter selected={governanceBand} onSelect={(b) => { setGovernanceBand(b); setPage(1); }} />
          <div className="w-px h-8 bg-gravity-border self-center" />
          <SubsystemFilter selected={subsystem} onSelect={(s) => { setSubsystem(s); setPage(1); }} />
        </div>

        {isLoading && !data ? (
          <div className="space-y-1">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className="h-14 bg-gravity-surface rounded-lg animate-shimmer shimmer-bg" style={{ animationDelay: `${i * 50}ms` }} />
            ))}
          </div>
        ) : isError ? (
          <div className="bg-gravity-surface border border-gravity-border rounded-xl p-6">
            <div className="text-sm font-medium mb-2">Couldn't load leads</div>
            <div className="text-sm text-gravity-text-secondary">
              {error?.message || 'Unknown error'}
            </div>
            <div className="text-xs text-gravity-text-whisper mt-3 font-mono break-all">
              API_BASE: {API_BASE}
            </div>
          </div>
        ) : data ? (
          <>
            <LeadTable leads={data.leads} page={page} limit={limit} />

            {data.total > limit && (
              <div className="flex items-center justify-center gap-4 mt-8">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-4 py-2 text-xs font-medium uppercase tracking-wider bg-gravity-surface rounded-md disabled:opacity-30 hover:bg-gravity-elevated transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm font-mono text-gravity-text-secondary">
                  Page {page} of {Math.ceil(data.total / limit)}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page * limit >= data.total}
                  className="px-4 py-2 text-xs font-medium uppercase tracking-wider bg-gravity-surface rounded-md disabled:opacity-30 hover:bg-gravity-elevated transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        ) : null}
      </main>

      <VoiceTrigger onClick={() => setVoiceOpen(true)} mode="fleet" />
      <VoiceOverlay open={voiceOpen} onClose={() => setVoiceOpen(false)} scope="fleet" />
    </>
  );
}
