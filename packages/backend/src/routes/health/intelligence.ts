import { Hono } from 'hono';
import { healthDb } from '../../config/health-database.js';
import {
  subjects, healthSignalEvents, healthSnapshots, protocolAssignments,
} from '../../db/health-schema.js';
import { eq, and, desc, asc, sql, gte } from 'drizzle-orm';
import { envelope } from '../../lib/api-envelope.js';
import {
  HEALTH_SIGNALS, DOMAIN_SIGNALS, PROTOCOLS, type HealthSignalId, type HealthDomainId,
  HEALTH_DOMAINS,
} from '@gravity/shared';
import type { AppEnv } from '../../types/hono-env.js';

export const intelligenceRoute = new Hono<AppEnv>();

interface LabMarker {
  signal_id: string;
  label: string;
  unit: string;
  current_value: number | null;
  previous_value: number | null;
  delta_pct: number | null;
  normal_range: [number, number];
  range_badge: 'below' | 'normal' | 'above' | 'performance' | 'no_data';
  last_draw: string | null;
  source: string;
  trend_direction: 'up' | 'down' | 'flat' | 'insufficient';
}

interface EvidenceCard {
  type: 'blood' | 'wearable' | 'self_report';
  signal_id: string;
  label: string;
  value: number | null;
  unit: string;
  ref_range: string;
  date: string | null;
  trend: 'up' | 'down' | 'flat' | 'insufficient';
  delta_text: string | null;
}

interface ProtocolTrack {
  protocol_id: string;
  label: string;
  status: string;
  started_at: string;
  monitored_signal: string;
  monitored_signal_label: string;
  trend: 'improving' | 'worsening' | 'stable' | 'insufficient';
  trend_values: number[];
  narrative: string;
}

function rangeBadge(value: number, range: [number, number], signalId: string): LabMarker['range_badge'] {
  const isInverse = ['lab_crp', 'lab_cortisol', 'lab_a1c', 'lab_creatine_kinase', 'lab_fasting_glucose', 'lab_thyroid_tsh'].includes(signalId);
  if (isInverse) {
    if (value < range[0]) return 'performance';
    if (value <= range[1]) return 'normal';
    return 'above';
  }
  if (value < range[0]) return 'below';
  if (value <= range[1]) return 'normal';
  return 'above';
}

function slopeDirection(values: number[]): 'up' | 'down' | 'flat' | 'insufficient' {
  if (values.length < 3) return 'insufficient';
  const first3Avg = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
  const last3Avg = values.slice(-3).reduce((a, b) => a + b, 0) / 3;
  const pctChange = (last3Avg - first3Avg) / Math.max(Math.abs(first3Avg), 0.01);
  if (pctChange > 0.05) return 'up';
  if (pctChange < -0.05) return 'down';
  return 'flat';
}

const DOMAIN_LABELS: Record<string, string> = {
  cardiovascular: 'Cardiovascular', metabolic: 'Metabolic', hormonal: 'Hormonal',
  musculoskeletal: 'Musculoskeletal', sleep_recovery: 'Sleep & Recovery', cognitive: 'Cognitive',
};

const CONSTRAINT_NAMES: Record<string, Record<string, string>> = {
  cardiovascular: {
    high_concern: 'Oxygen Transport — Constrained',
    moderate: 'Cardiovascular Load — Elevated',
    low: 'Cardiovascular — Stable',
  },
  metabolic: {
    high_concern: 'Metabolic Regulation — Disrupted',
    moderate: 'Metabolic Balance — Shifting',
    low: 'Metabolic — Stable',
  },
  hormonal: {
    high_concern: 'Hormonal Balance — Disrupted',
    moderate: 'Hormonal Response — In Progress',
    low: 'Hormonal — Stable',
  },
  musculoskeletal: {
    high_concern: 'Injury Risk — Constrained',
    moderate: 'Tissue Stress — Elevated',
    low: 'Musculoskeletal — Recovering',
  },
  sleep_recovery: {
    high_concern: 'Recovery — Compromised',
    moderate: 'Recovery Stress — Elevated',
    low: 'Recovery — On Track',
  },
  cognitive: {
    high_concern: 'Cognitive Load — Critical',
    moderate: 'Stress Response — Elevated',
    low: 'Cognitive — Stable',
  },
};

function getConstraintName(domain: string, pScore: number): string {
  const level = pScore >= 0.7 ? 'high_concern' : pScore >= 0.4 ? 'moderate' : 'low';
  return CONSTRAINT_NAMES[domain]?.[level] ?? `${DOMAIN_LABELS[domain] ?? domain} — ${level}`;
}

function generateCoachHeadline(domain: string, pScore: number): string {
  const name = getConstraintName(domain, pScore);
  return name.split(' — ')[0];
}

function generateAction(domain: string, pScore: number, govBand: string, protocols: string[], clinicalActions: string[]): string {
  if (clinicalActions.length > 0) {
    const topAction = clinicalActions[0];
    if (clinicalActions.length > 1) return `${topAction} (+${clinicalActions.length - 1} more — see clinical detail)`;
    return topAction;
  }
  if (domain === 'musculoskeletal' && pScore >= 0.7)
    return 'Reduce training load to Zone 1 for 7 days. Schedule blood retest.';
  if (domain === 'cardiovascular' && pScore >= 0.6)
    return 'Check iron panel. Consider supplementation if ferritin < 30 ng/mL.';
  if (domain === 'sleep_recovery' && pScore >= 0.6)
    return 'Review sleep hygiene. Consider adjusting evening protocol timing.';
  if (domain === 'metabolic' && pScore >= 0.6)
    return 'Review calorie and macro targets. Retest fasting glucose in 2 weeks.';
  if (domain === 'hormonal' && pScore >= 0.5)
    return 'Continue protocol. Retest hormone panel at next scheduled draw.';
  if (domain === 'cognitive' && pScore >= 0.6)
    return 'Prioritize sleep and stress management. Consider NAD+ or Semax protocol adjustment.';
  return 'Continue current protocols. Review at next check-in.';
}

function generateClinicalActions(domain: string, pScore: number, labMarkers: LabMarker[], protocols: ProtocolTrack[]): string[] {
  const actions: string[] = [];
  const below = labMarkers.filter(m => m.range_badge === 'below');
  const above = labMarkers.filter(m => m.range_badge === 'above');
  const worsening = protocols.filter(p => p.trend === 'worsening');

  for (const m of below.slice(0, 3)) {
    actions.push(`Review ${m.label} trend — ${m.current_value} ${m.unit} is below reference range.`);
  }
  for (const m of above.slice(0, 2)) {
    actions.push(`Review ${m.label} — ${m.current_value} ${m.unit} exceeds upper limit. Confirm with retest.`);
  }
  for (const p of worsening) {
    actions.push(`Evaluate ${p.label} — ${p.monitored_signal_label} is trending worse since protocol start.`);
  }
  if (pScore >= 0.7) {
    actions.push('Schedule blood retest within 14 days to confirm trends.');
    actions.push('Flag for practitioner review — governance band warrants intervention.');
  } else if (pScore >= 0.5) {
    actions.push('Schedule follow-up in 3–5 days to check compliance.');
  }
  if (actions.length === 0) {
    actions.push('Continue current protocols. No new actions required.');
  }
  return actions;
}

// ---- GET /subjects/:id/intelligence ----

intelligenceRoute.get('/:id/intelligence', async (c) => {
  const orgId = c.get('org_id') as string;
  const subjectId = c.req.param('id');

  const [subject] = await healthDb.select().from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.org_id, orgId)));
  if (!subject) return c.json({ error: 'Subject not found' }, 404);

  const domain = subject.primary_domain as HealthDomainId;
  const domainSignals = DOMAIN_SIGNALS[domain] ?? [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Fetch recent signals for this subject across all domain-relevant signals
  const recentSignals = await healthDb.select().from(healthSignalEvents)
    .where(and(
      eq(healthSignalEvents.subject_id, subjectId),
      eq(healthSignalEvents.org_id, orgId),
    ))
    .orderBy(desc(healthSignalEvents.occurred_at))
    .limit(2000);

  // Fetch latest snapshot
  const [snapshot] = await healthDb.select().from(healthSnapshots)
    .where(and(eq(healthSnapshots.subject_id, subjectId), eq(healthSnapshots.org_id, orgId)))
    .orderBy(desc(healthSnapshots.frame_index))
    .limit(1);

  // Fetch protocols
  const activeProtocols = await healthDb.select().from(protocolAssignments)
    .where(and(
      eq(protocolAssignments.subject_id, subjectId),
      eq(protocolAssignments.org_id, orgId),
      eq(protocolAssignments.status, 'active'),
    ));

  // ---- Build lab markers ----
  const labSignalIds = domainSignals.filter(s => s.startsWith('lab_'));
  const allLabIds = Object.keys(HEALTH_SIGNALS).filter(s => s.startsWith('lab_'));
  const targetLabIds = [...new Set([...labSignalIds, ...allLabIds])];

  const labMarkers: LabMarker[] = [];
  for (const sigId of targetLabIds) {
    const def = HEALTH_SIGNALS[sigId as HealthSignalId];
    if (!def) continue;
    const events = recentSignals
      .filter(e => e.signal_name === sigId)
      .sort((a, b) => b.occurred_at.getTime() - a.occurred_at.getTime());

    if (events.length === 0) continue;
    const current = events[0];
    const previous = events.length > 1 ? events[1] : null;
    const deltaPct = previous && current.raw_value != null && previous.raw_value != null
      ? ((current.raw_value - previous.raw_value) / Math.max(Math.abs(previous.raw_value), 0.01)) * 100
      : null;

    const values = events.filter(e => e.raw_value != null).map(e => e.raw_value as number);

    labMarkers.push({
      signal_id: sigId,
      label: def.label,
      unit: def.unit,
      current_value: current.raw_value,
      previous_value: previous?.raw_value ?? null,
      delta_pct: deltaPct != null ? Math.round(deltaPct * 10) / 10 : null,
      normal_range: def.normalRange,
      range_badge: current.raw_value != null ? rangeBadge(current.raw_value, def.normalRange, sigId) : 'no_data',
      last_draw: current.occurred_at.toISOString(),
      source: current.source_type,
      trend_direction: slopeDirection(values.reverse()),
    });
  }

  // ---- Build evidence chain ----
  const evidenceChain: EvidenceCard[] = [];
  const topSignals = domainSignals.slice(0, 6);
  for (const sigId of topSignals) {
    const def = HEALTH_SIGNALS[sigId as HealthSignalId];
    if (!def) continue;
    const events = recentSignals
      .filter(e => e.signal_name === sigId)
      .sort((a, b) => b.occurred_at.getTime() - a.occurred_at.getTime());
    if (events.length === 0) continue;

    const current = events[0];
    const values = events.filter(e => e.raw_value != null).map(e => e.raw_value as number).reverse();
    const trend = slopeDirection(values);
    const first = values[0];
    const last = values[values.length - 1];
    const deltaText = values.length >= 2
      ? `${last > first ? '+' : ''}${Math.round(last - first)} ${def.unit} over ${values.length} readings`
      : null;

    evidenceChain.push({
      type: def.source === 'Lab' ? 'blood' : def.source === 'Self-Report' ? 'self_report' : 'wearable',
      signal_id: sigId,
      label: def.label,
      value: current.raw_value,
      unit: def.unit,
      ref_range: `${def.normalRange[0]}–${def.normalRange[1]}`,
      date: current.occurred_at.toISOString(),
      trend,
      delta_text: deltaText,
    });
  }

  // ---- Build performance systems (per-domain scores) ----
  const allDomains: HealthDomainId[] = ['cardiovascular', 'metabolic', 'hormonal', 'musculoskeletal', 'sleep_recovery', 'cognitive'];
  const performanceSystems: Record<string, { score: number; label: string; signal_count: number }> = {};

  for (const d of allDomains) {
    const dSignals = DOMAIN_SIGNALS[d] ?? [];
    let sumNorm = 0;
    let count = 0;
    for (const sigId of dSignals) {
      const latest = recentSignals.find(e => e.signal_name === sigId && e.raw_value != null);
      if (latest) {
        sumNorm += latest.normalized_value;
        count++;
      }
    }
    const score = count > 0 ? Math.round((1 - sumNorm / count) * 100) : 0;
    performanceSystems[d] = {
      score: Math.max(0, Math.min(100, score)),
      label: DOMAIN_LABELS[d] ?? d,
      signal_count: count,
    };
  }

  // ---- Build protocol tracking ----
  const protocolTracking: ProtocolTrack[] = [];
  for (const pa of activeProtocols) {
    const protoDef = PROTOCOLS[pa.protocol_id as keyof typeof PROTOCOLS];
    if (!protoDef) continue;

    const monitored = protoDef.monitoredSignals[0];
    const monDef = HEALTH_SIGNALS[monitored];
    const signalEvents = recentSignals
      .filter(e => e.signal_name === monitored && e.occurred_at >= pa.started_at)
      .sort((a, b) => a.occurred_at.getTime() - b.occurred_at.getTime());

    const values = signalEvents.filter(e => e.raw_value != null).map(e => e.raw_value as number);
    const slope = slopeDirection(values);

    const isInverse = ['lab_crp', 'lab_cortisol', 'lab_a1c', 'lab_creatine_kinase', 'lab_fasting_glucose', 'resting_hr', 'self_pain'].includes(monitored);
    const trend: ProtocolTrack['trend'] =
      slope === 'insufficient' ? 'insufficient'
      : (slope === 'down' && isInverse) || (slope === 'up' && !isInverse) ? 'improving'
      : (slope === 'up' && isInverse) || (slope === 'down' && !isInverse) ? 'worsening'
      : 'stable';

    const first = values[0];
    const last = values[values.length - 1];
    let narrative = `${protoDef.label} started ${pa.started_at.toISOString().split('T')[0]}.`;
    if (values.length >= 3 && first != null && last != null) {
      const dir = trend === 'improving' ? 'improved' : trend === 'worsening' ? 'worsened' : 'remained stable';
      narrative += ` ${monDef?.label ?? monitored} has ${dir} from ${Math.round(first)} to ${Math.round(last)} ${monDef?.unit ?? ''} over ${values.length} readings.`;
    } else {
      narrative += ' Insufficient data to assess trend yet.';
    }

    protocolTracking.push({
      protocol_id: pa.protocol_id,
      label: protoDef.label,
      status: pa.status,
      started_at: pa.started_at.toISOString(),
      monitored_signal: monitored,
      monitored_signal_label: monDef?.label ?? monitored,
      trend,
      trend_values: values.slice(-20),
      narrative,
    });
  }

  // ---- Build coach summary ----
  const p = subject.posterior_p;
  const constraintName = getConstraintName(domain, p);
  const headline = generateCoachHeadline(domain, p);

  const topDegraded = evidenceChain
    .filter(e => e.trend === 'up' || e.trend === 'down')
    .slice(0, 3);

  const sport = subject.sport || 'General';
  const phase = subject.training_phase?.replace(/_/g, ' ') || 'active';
  const races = (subject.races as any[] || []);
  const nextRace = races
    .filter((r: any) => new Date(r.date) > new Date())
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  const raceContext = nextRace
    ? ` With ${nextRace.name} ${Math.ceil((new Date(nextRace.date).getTime() - Date.now()) / 864e5)} days away`
    : '';

  let body = '';
  if (topDegraded.length > 0) {
    const signalSummary = topDegraded.map(e => {
      const arrow = e.trend === 'up' ? 'rising' : 'falling';
      return `${e.label} ${arrow}${e.delta_text ? ` (${e.delta_text})` : ''}`;
    }).join('; ');

    const domainNarrative: Record<string, string> = {
      cardiovascular: `${sport} athlete in ${phase} phase showing cardiovascular load — ${signalSummary}.${raceContext}, prioritize recovery to protect performance.`,
      metabolic: `Metabolic signals shifting for this ${sport} athlete — ${signalSummary}.${raceContext}, review nutrition and fueling strategy.`,
      hormonal: `Hormonal response in progress — ${signalSummary}. ${phase} phase ${sport} athlete.${raceContext ? `${raceContext}, ensure protocol timing supports race prep.` : ' Monitor at next draw.'}`,
      musculoskeletal: `Tissue stress elevated — ${signalSummary}. ${sport} athlete in ${phase} phase.${raceContext ? `${raceContext}, consider deload to reduce injury risk.` : ' Monitor training load.'}`,
      sleep_recovery: `Recovery compromised — ${signalSummary}. ${sport} athlete in ${phase} phase.${raceContext ? `${raceContext}, sleep quality critical for taper.` : ' Review sleep hygiene and evening protocols.'}`,
      cognitive: `Cognitive load elevated — ${signalSummary}. ${sport} athlete in ${phase} phase.${raceContext ? `${raceContext}, manage stress to protect focus.` : ' Prioritize stress management.'}`,
    };
    body = domainNarrative[domain] || `${signalSummary}.${raceContext ? `${raceContext}.` : ''}`;
  } else {
    body = subject.governance_reason || `${sport} athlete in ${phase} phase. No significant trends detected in recent data.`;
  }

  const urgency = subject.governance_band === 'ESCALATED' ? 'high'
    : subject.governance_band === 'MONITOR' ? 'medium'
    : 'low';

  const clinicalActions = generateClinicalActions(domain, p, labMarkers, protocolTracking);
  const action = generateAction(domain, p, subject.governance_band, activeProtocols.map(p => p.protocol_id), clinicalActions);

  return envelope(c, {
    coach_summary: {
      headline,
      constraint: constraintName,
      body,
      action,
      urgency,
      domain: DOMAIN_LABELS[domain] ?? domain,
    },
    clinical: {
      primary_finding: {
        name: constraintName,
        domain,
        domain_label: DOMAIN_LABELS[domain] ?? domain,
        p_score: subject.posterior_p,
        c_score: subject.posterior_c,
        s_score: subject.posterior_s,
        p_var: subject.posterior_p_var,
        governance_band: subject.governance_band,
        governance_reason: subject.governance_reason,
      },
      evidence_chain: evidenceChain,
      performance_systems: performanceSystems,
      lab_markers: labMarkers,
      protocol_tracking: protocolTracking,
      actions: clinicalActions,
    },
  });
});
