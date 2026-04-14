'use client';

import { useParams, useRouter } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { AuthGate } from '@/components/layout/auth-gate';
import { useSubject, useSnapshots, useSignals, useIntelligence } from '@/hooks/use-health';
import { BodyRenderer } from '@/components/twin/body-renderer';
import { useMemo, useState } from 'react';

/* ─── constants ─── */

const DOMAIN_LABELS: Record<string, string> = {
  cardiovascular: 'Cardiovascular',
  metabolic: 'Metabolic',
  hormonal: 'Hormonal',
  musculoskeletal: 'Musculoskeletal',
  sleep_recovery: 'Sleep & Recovery',
  cognitive: 'Cognitive',
};

const BAND_CONFIG: Record<string, { text: string; color: string; bg: string }> = {
  ESCALATED: { text: 'Needs Attention', color: 'text-health-coral', bg: 'bg-health-coral/10 border-health-coral/30' },
  MONITOR:   { text: 'Monitoring',      color: 'text-health-amber', bg: 'bg-health-amber/10 border-health-amber/30' },
  SUPPRESSED:{ text: 'On Track',        color: 'text-health-teal',  bg: 'bg-health-teal/10 border-health-teal/30' },
};

const TABS = ['Intelligence', 'Signals', 'Labs', 'Protocols', 'Twin'] as const;
type Tab = (typeof TABS)[number];

/* ─── detail page ─── */

function AthleteDetail() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { data: detailEnv, isLoading } = useSubject(id);
  const { data: snapsEnv } = useSnapshots(id);
  const { data: intelEnv } = useIntelligence(id);

  const detail = detailEnv?.data;
  const subject = detail?.subject;
  const snapshot = detail?.current_snapshot;
  const intel = intelEnv?.data;

  const [tab, setTab] = useState<Tab>('Intelligence');
  const [showClinical, setShowClinical] = useState(false);
  const [twinMode, setTwinMode] = useState<'current' | 'projection'>('current');
  const [projectionWeeks, setProjectionWeeks] = useState(0);

  const snapshotJson = useMemo(() => snapshot ? JSON.stringify(snapshot) : undefined, [snapshot]);

  const protocolsJson = useMemo(() => {
    if (!detail?.protocols?.length) return undefined;
    const now = Date.now();
    const mapped = detail.protocols.filter((p: any) => p.status === 'active').map((p: any) => {
      const weeksAgo = Math.max(0, (now - new Date(p.started_at).getTime()) / (7 * 864e5));
      return { id: p.protocol_id, started_weeks_ago: weeksAgo, onset_weeks: 2, peak_weeks: 8, target_domains: [], max_effect: 0.6 };
    });
    return JSON.stringify(mapped);
  }, [detail?.protocols]);

  /* loading / not found */
  if (isLoading) return <LoadingSkeleton />;
  if (!subject) return <NotFound />;

  const band = BAND_CONFIG[subject.governance_band] || BAND_CONFIG.SUPPRESSED;
  const coach = intel?.coach_summary;
  const clinical = intel?.clinical;
  const snapshots = snapsEnv?.data || [];

  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Back */}
        <button onClick={() => router.push('/')} className="text-xs text-gravity-text-whisper hover:text-gravity-text-secondary transition-colors mb-5 block">
          &larr; All Athletes
        </button>

        {/* ─── Profile header ─── */}
        <div className="flex items-start justify-between mb-8 animate-fade-in">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gravity-surface border border-gravity-border flex items-center justify-center text-lg font-bold text-gravity-accent-warm">
              {subject.display_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gravity-text">{subject.display_name}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${band.bg} ${band.color}`}>
                  {band.text}
                </span>
                <Separator />
                <span className="text-xs text-gravity-text-secondary">{subject.sport || 'General'}</span>
                <Separator />
                <span className="text-xs text-gravity-text-secondary capitalize">{subject.training_phase?.replace(/_/g, ' ') || 'Active'}</span>
                <Separator />
                <span className="text-xs text-gravity-text-secondary">{DOMAIN_LABELS[subject.primary_domain]}</span>
              </div>
              {subject.coach_notes && (
                <p className="text-xs text-gravity-text-whisper mt-1.5 max-w-xl">{subject.coach_notes}</p>
              )}
            </div>
          </div>

          {/* Next race */}
          {subject.races?.length > 0 && (() => {
            const upcoming = subject.races.filter((r: any) => new Date(r.date) > new Date()).sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
            if (!upcoming) return null;
            const days = Math.ceil((new Date(upcoming.date).getTime() - Date.now()) / 864e5);
            return (
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold font-mono text-gravity-accent">{days}</p>
                <p className="text-[10px] text-gravity-text-whisper">days to {upcoming.name}</p>
              </div>
            );
          })()}
        </div>

        {/* ─── Tabs ─── */}
        <div className="flex gap-1 border-b border-gravity-border mb-6">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-sm transition-all border-b-2 -mb-px ${
                tab === t
                  ? 'border-gravity-accent text-gravity-text font-medium'
                  : 'border-transparent text-gravity-text-secondary hover:text-gravity-text'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ─── Tab content ─── */}

        {tab === 'Intelligence' && (
          <div className="space-y-6 animate-fade-in">
            {/* Coach summary — the Steve Jobs view */}
            {coach ? (
              <div className="bg-gravity-surface border border-gravity-border rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-semibold uppercase tracking-widest ${
                      coach.urgency === 'high' ? 'text-health-coral' : coach.urgency === 'medium' ? 'text-health-amber' : 'text-health-teal'
                    }`}>
                      {coach.urgency} priority
                    </span>
                    <span className="text-[10px] text-gravity-text-whisper">{DOMAIN_LABELS[coach.domain] || coach.domain}</span>
                  </div>
                  <button
                    onClick={() => setShowClinical(!showClinical)}
                    className="text-[10px] text-gravity-accent hover:text-gravity-accent-warm transition-colors"
                  >
                    {showClinical ? 'Hide detail' : 'Clinical detail'}
                  </button>
                </div>

                <h2 className="text-xl font-bold text-gravity-text leading-snug mb-2">{coach.headline}</h2>
                <p className="text-sm text-gravity-text-secondary leading-relaxed mb-4">{coach.body}</p>

                <div className="flex items-center gap-3 pt-3 border-t border-gravity-border">
                  <div className="w-1.5 h-1.5 rounded-full bg-gravity-accent shrink-0" />
                  <p className="text-sm font-medium text-gravity-text">{coach.action}</p>
                </div>
              </div>
            ) : (
              <div className="bg-gravity-surface border border-gravity-border rounded-xl p-6">
                <p className="text-sm text-gravity-text-secondary">Loading intelligence...</p>
              </div>
            )}

            {/* Data confidence — human readable */}
            {snapshot && (
              <div className="bg-gravity-surface border border-gravity-border rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-[10px] text-gravity-text-whisper uppercase tracking-widest">Data quality</p>
                      <p className="text-sm font-medium text-gravity-text mt-0.5">
                        {snapshot.c_score >= 0.7 ? 'Strong evidence' : snapshot.c_score >= 0.5 ? 'Moderate evidence' : 'Limited data'}
                      </p>
                    </div>
                    <div className="w-px h-8 bg-gravity-border" />
                    <div>
                      <p className="text-[10px] text-gravity-text-whisper uppercase tracking-widest">Signal freshness</p>
                      <p className="text-sm font-medium text-gravity-text mt-0.5">
                        {snapshot.s_score <= 0.3 ? 'Current' : snapshot.s_score <= 0.6 ? 'Recent' : 'Stale — needs new data'}
                      </p>
                    </div>
                    <div className="w-px h-8 bg-gravity-border" />
                    <div>
                      <p className="text-[10px] text-gravity-text-whisper uppercase tracking-widest">Confidence</p>
                      <p className="text-sm font-medium text-gravity-text mt-0.5">
                        {snapshot.p_var <= 0.06 ? 'High' : snapshot.p_var <= 0.14 ? 'Moderate' : 'Low — more data needed'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold font-mono ${snapshot.p_score > 0.7 ? 'text-health-coral' : snapshot.p_score > 0.4 ? 'text-health-amber' : 'text-health-teal'}`}>
                      {Math.round(snapshot.p_score * 100)}
                    </p>
                    <p className="text-[10px] text-gravity-text-whisper">concern score</p>
                  </div>
                </div>
              </div>
            )}

            {/* Risk trajectory */}
            {snapshots.length > 2 && <Trajectory snapshots={snapshots} />}

            {/* Clinical drill-down */}
            {showClinical && clinical && (
              <div className="space-y-4 animate-fade-in">
                {/* Performance systems */}
                <div className="bg-gravity-surface border border-gravity-border rounded-xl p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper mb-3">Performance Systems</p>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(clinical.performance_systems).map(([key, sys]) => (
                      <div key={key} className="bg-gravity-elevated rounded-lg p-3">
                        <p className="text-xs text-gravity-text-secondary mb-1">{sys.label}</p>
                        <div className="flex items-end gap-2">
                          <span className="text-lg font-bold font-mono text-gravity-text">{Math.round(sys.score)}</span>
                          <span className="text-[10px] text-gravity-text-whisper mb-0.5">{sys.signal_count} signals</span>
                        </div>
                        <div className="mt-2 h-1 bg-gravity-border rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-gravity-accent transition-all" style={{ width: `${Math.min(100, sys.score)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Evidence chain */}
                <div className="bg-gravity-surface border border-gravity-border rounded-xl p-5">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper mb-3">Evidence Chain</p>
                  <div className="space-y-2">
                    {clinical.evidence_chain.map((ev, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gravity-border last:border-b-0">
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] uppercase tracking-wider font-semibold w-14 ${
                            ev.type === 'blood' ? 'text-health-coral' : ev.type === 'wearable' ? 'text-health-teal' : 'text-health-amber'
                          }`}>
                            {ev.type === 'self_report' ? 'Self' : ev.type}
                          </span>
                          <span className="text-sm text-gravity-text">{ev.label}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-sm font-mono text-gravity-text">{ev.value != null ? ev.value.toFixed(1) : '—'}</span>
                          <span className="text-[10px] text-gravity-text-whisper">{ev.unit}</span>
                          <TrendBadge trend={ev.trend} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Clinical actions */}
                {clinical.actions.length > 0 && (
                  <div className="bg-gravity-surface border border-gravity-border rounded-xl p-5">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper mb-3">Recommended Actions</p>
                    <div className="space-y-2">
                      {clinical.actions.map((action, i) => (
                        <div key={i} className="flex items-start gap-3 py-1.5">
                          <div className="w-5 h-5 rounded-full border border-gravity-border flex items-center justify-center text-[10px] text-gravity-text-whisper shrink-0 mt-0.5">{i + 1}</div>
                          <p className="text-sm text-gravity-text-secondary">{action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'Signals' && <SignalsTab subjectId={id} />}
        {tab === 'Labs' && <LabsTab clinical={clinical} />}
        {tab === 'Protocols' && <ProtocolsTab protocols={detail?.protocols || []} clinical={clinical} />}

        {tab === 'Twin' && (
          <div className="animate-fade-in">
            <div className="bg-gravity-surface border border-gravity-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gravity-border">
                <p className="text-sm font-medium text-gravity-text">Digital Twin</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setTwinMode('current'); setProjectionWeeks(0); }}
                    className={`text-xs px-3 py-1 rounded-md transition-all ${
                      twinMode === 'current' ? 'bg-health-teal/15 text-health-teal' : 'text-gravity-text-whisper hover:text-gravity-text-secondary'
                    }`}
                  >Current</button>
                  <button
                    onClick={() => setTwinMode('projection')}
                    className={`text-xs px-3 py-1 rounded-md transition-all ${
                      twinMode === 'projection' ? 'bg-gravity-accent-warm/15 text-gravity-accent-warm' : 'text-gravity-text-whisper hover:text-gravity-text-secondary'
                    }`}
                    disabled={!protocolsJson}
                  >Projection</button>
                </div>
              </div>

              <BodyRenderer
                snapshotJson={snapshotJson}
                protocolsJson={protocolsJson}
                projectionWeeks={projectionWeeks}
                mode={twinMode}
                className="h-[480px]"
              />

              {twinMode === 'projection' && (
                <div className="px-5 py-3 border-t border-gravity-border">
                  <div className="flex items-center justify-between text-[10px] text-gravity-text-whisper mb-1.5">
                    <span>Now</span>
                    <span className="font-mono text-gravity-accent-warm">+{projectionWeeks}w</span>
                    <span>+12w</span>
                  </div>
                  <input
                    type="range" min={0} max={12} step={1}
                    value={projectionWeeks}
                    onChange={e => setProjectionWeeks(Number(e.target.value))}
                    className="w-full h-1 bg-gravity-border rounded-full appearance-none cursor-pointer accent-gravity-accent-warm"
                  />
                </div>
              )}

              {snapshot && twinMode === 'current' && (
                <div className="grid grid-cols-2 gap-4 p-5 border-t border-gravity-border text-center">
                  <div>
                    <p className="text-xl font-bold font-mono text-health-coral">{Math.round(snapshot.p_score * 100)}%</p>
                    <p className="text-[10px] text-gravity-text-whisper">Stress</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold font-mono text-health-teal">{Math.round((1 - snapshot.p_score) * 100)}%</p>
                    <p className="text-[10px] text-gravity-text-whisper">Recovery</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

/* ─── Signals tab ─── */

function SignalsTab({ subjectId }: { subjectId: string }) {
  const [signal, setSignal] = useState('hrv_rmssd');
  const { data: sigEnv, isLoading } = useSignals(subjectId, { signal, limit: '90' });
  const events = sigEnv?.data || [];

  const OPTIONS = [
    { id: 'hrv_rmssd', label: 'HRV' },
    { id: 'resting_hr', label: 'Resting HR' },
    { id: 'sleep_quality', label: 'Sleep' },
    { id: 'recovery_score', label: 'Recovery' },
    { id: 'strain_score', label: 'Strain' },
    { id: 'active_calories', label: 'Calories' },
  ];

  const chart = useMemo(() => {
    const vals = events.filter((e: any) => e.raw_value != null).map((e: any) => e.raw_value as number);
    if (!vals.length) return null;
    const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
    const meta = events[0]?.signal_meta;
    return { vals, min, max, range, meta };
  }, [events]);

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {OPTIONS.map(o => (
          <button key={o.id} onClick={() => setSignal(o.id)}
            className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
              signal === o.id ? 'bg-gravity-accent/15 text-gravity-accent border border-gravity-accent/30' : 'text-gravity-text-whisper hover:text-gravity-text-secondary border border-transparent'
            }`}>
            {o.label}
          </button>
        ))}
      </div>

      <div className="bg-gravity-surface border border-gravity-border rounded-xl p-5">
        {isLoading ? (
          <div className="h-32 shimmer-bg rounded-lg" />
        ) : chart ? (
          <>
            <svg viewBox="0 0 100 40" className="w-full h-32" preserveAspectRatio="none">
              {chart.meta?.normal_range && (
                <rect x={0} width={100} fill="rgba(99, 102, 241, 0.05)"
                  y={40 - ((chart.meta.normal_range[1] - chart.min) / chart.range) * 40}
                  height={((chart.meta.normal_range[1] - chart.meta.normal_range[0]) / chart.range) * 40}
                />
              )}
              <polyline fill="none" stroke="#6366F1" strokeWidth={0.8} strokeLinecap="round"
                points={chart.vals.map((v, i) => `${(i / (chart.vals.length - 1)) * 100},${40 - ((v - chart.min) / chart.range) * 36}`).join(' ')}
              />
            </svg>
            <div className="flex justify-between mt-3 text-[10px] text-gravity-text-whisper font-mono">
              <span>{chart.meta?.label || signal} ({chart.meta?.unit})</span>
              <span>{Math.round(chart.min)}–{Math.round(chart.max)}</span>
              {chart.meta?.normal_range && <span className="text-gravity-accent">Ref: {chart.meta.normal_range[0]}–{chart.meta.normal_range[1]}</span>}
            </div>
          </>
        ) : (
          <p className="text-xs text-gravity-text-whisper text-center py-12">No data for this signal</p>
        )}
      </div>
    </div>
  );
}

/* ─── Labs tab ─── */

function LabsTab({ clinical }: { clinical: any }) {
  if (!clinical?.lab_markers?.length) {
    return <p className="text-sm text-gravity-text-secondary py-8 text-center animate-fade-in">Loading lab data...</p>;
  }

  const BADGE_STYLES: Record<string, { text: string; color: string }> = {
    below: { text: 'Low', color: 'text-health-amber' },
    normal: { text: 'Normal', color: 'text-health-teal' },
    above: { text: 'High', color: 'text-health-coral' },
    performance: { text: 'Optimal', color: 'text-gravity-accent' },
    no_data: { text: 'No data', color: 'text-gravity-text-whisper' },
  };

  return (
    <div className="animate-fade-in">
      <div className="border border-gravity-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-[1fr_80px_80px_80px_60px_60px] gap-3 px-5 py-2.5 bg-gravity-surface/50 border-b border-gravity-border text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper">
          <span>Marker</span>
          <span className="text-right">Value</span>
          <span className="text-right">Previous</span>
          <span className="text-right">Reference</span>
          <span className="text-center">Status</span>
          <span className="text-center">Trend</span>
        </div>
        {clinical.lab_markers.map((m: any) => {
          const badge = BADGE_STYLES[m.range_badge] || BADGE_STYLES.no_data;
          return (
            <div key={m.signal_id} className="grid grid-cols-[1fr_80px_80px_80px_60px_60px] gap-3 px-5 py-3 border-b border-gravity-border last:border-b-0 items-center">
              <div>
                <p className="text-sm text-gravity-text">{m.label}</p>
                <p className="text-[10px] text-gravity-text-whisper">{m.unit}</p>
              </div>
              <p className="text-sm font-mono text-gravity-text text-right">{m.current_value != null ? m.current_value.toFixed(1) : '—'}</p>
              <p className="text-xs font-mono text-gravity-text-secondary text-right">{m.previous_value != null ? m.previous_value.toFixed(1) : '—'}</p>
              <p className="text-[10px] font-mono text-gravity-text-whisper text-right">{m.normal_range[0]}–{m.normal_range[1]}</p>
              <span className={`text-[10px] font-semibold text-center ${badge.color}`}>{badge.text}</span>
              <div className="flex justify-center"><TrendBadge trend={m.trend_direction} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Protocols tab ─── */

function ProtocolsTab({ protocols, clinical }: { protocols: any[]; clinical: any }) {
  const tracking = clinical?.protocol_tracking || [];

  return (
    <div className="space-y-3 animate-fade-in">
      {protocols.map((p: any) => {
        const track = tracking.find((t: any) => t.protocol_id === p.protocol_id);
        return (
          <div key={p.id} className="bg-gravity-surface border border-gravity-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gravity-text">
                {p.protocol_id.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
              </h3>
              <div className="flex items-center gap-2">
                {track && <TrendBadge trend={track.trend === 'improving' ? 'up' : track.trend === 'worsening' ? 'down' : 'flat'} label={track.trend} />}
                <span className={`text-[10px] font-semibold ${p.status === 'active' ? 'text-health-teal' : 'text-gravity-text-whisper'}`}>{p.status}</span>
              </div>
            </div>
            <p className="text-xs text-gravity-text-secondary mb-2">{p.dosing_notes}</p>
            {track && (
              <>
                <p className="text-xs text-gravity-text-whisper mb-2">{track.narrative}</p>
                {track.trend_values.length > 1 && (
                  <MiniSparkline values={track.trend_values} trend={track.trend} />
                )}
              </>
            )}
            <p className="text-[10px] text-gravity-text-whisper mt-2">Since {new Date(p.started_at).toLocaleDateString()}</p>
          </div>
        );
      })}
      {protocols.length === 0 && <p className="text-sm text-gravity-text-secondary text-center py-8">No active protocols</p>}
    </div>
  );
}

/* ─── reusable components ─── */

function ScoreCard({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div className="bg-gravity-surface border border-gravity-border rounded-xl p-4 text-center">
      <p className="text-2xl font-bold font-mono" style={{ color }}>{pct}</p>
      <p className="text-[10px] text-gravity-text-whisper mt-0.5 uppercase tracking-widest">{label}</p>
    </div>
  );
}

function TrendBadge({ trend, label }: { trend: string; label?: string }) {
  const config: Record<string, { arrow: string; color: string }> = {
    up: { arrow: '\u2191', color: 'text-health-coral' },
    down: { arrow: '\u2193', color: 'text-health-teal' },
    improving: { arrow: '\u2191', color: 'text-health-teal' },
    worsening: { arrow: '\u2193', color: 'text-health-coral' },
    flat: { arrow: '\u2192', color: 'text-gravity-text-whisper' },
    stable: { arrow: '\u2192', color: 'text-gravity-text-whisper' },
    insufficient: { arrow: '?', color: 'text-gravity-text-whisper' },
  };
  const c = config[trend] || config.insufficient;
  return (
    <span className={`text-xs font-mono ${c.color}`}>
      {c.arrow}{label ? ` ${label}` : ''}
    </span>
  );
}

function Trajectory({ snapshots }: { snapshots: any[] }) {
  const last = snapshots[snapshots.length - 1];
  const prev = snapshots[Math.max(0, snapshots.length - 4)];
  const improving = last.p_score < prev.p_score;

  const maxP = Math.max(...snapshots.map((s: any) => s.p_score), 0.01);
  const pts = snapshots.map((s: any, i: number) =>
    `${(i / (snapshots.length - 1)) * 100},${40 - (s.p_score / maxP) * 36}`
  ).join(' ');

  return (
    <div className="bg-gravity-surface border border-gravity-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper">Risk Trajectory</p>
        <span className={`text-xs font-medium ${improving ? 'text-health-teal' : 'text-health-coral'}`}>
          {improving ? 'Improving' : 'Rising'}
        </span>
      </div>
      <svg viewBox="0 0 100 40" className="w-full h-12">
        <polyline points={pts} fill="none" stroke={improving ? '#34D399' : '#F97066'} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function MiniSparkline({ values, trend }: { values: number[]; trend: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / range) * 26}`).join(' ');
  const color = trend === 'improving' ? '#34D399' : trend === 'worsening' ? '#F97066' : '#4A5168';
  return (
    <svg viewBox="0 0 100 30" className="w-full h-8">
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round" />
    </svg>
  );
}

function Separator() {
  return <span className="w-px h-3 bg-gravity-border" />;
}

function LoadingSkeleton() {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-8 py-12 space-y-4">
        <div className="h-8 w-48 bg-gravity-surface rounded shimmer-bg" />
        <div className="h-20 bg-gravity-surface rounded-xl shimmer-bg" />
        <div className="h-40 bg-gravity-surface rounded-xl shimmer-bg" />
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center">
      <p className="text-gravity-text-secondary">Athlete not found</p>
    </main>
  );
}

/* ─── page export ─── */

export default function ClientPage() {
  return (
    <AuthGate>
      <div className="flex min-h-screen">
        <Sidebar />
        <AthleteDetail />
      </div>
    </AuthGate>
  );
}
