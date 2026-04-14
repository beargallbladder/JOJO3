import { v4 as uuidv4 } from 'uuid';
import type { GeneratedSubject } from './health-subject-generator.js';
import {
  HEALTH_SIGNALS, DOMAIN_SIGNALS, DOMAIN_N_EXPECTED,
  SIGNAL_CADENCE, type HealthSignalId,
  DATA_SOURCES, WEARABLE_PROFILES, BIOMARKER_PROFILES,
  PROTOCOLS, type ProtocolId,
  type HealthDomainId,
} from '@gravity/shared';

// ---- PRNG ----
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function jitter(rng: () => number, mag: number) {
  return (rng() * 2 - 1) * mag;
}

function smoothStep(prev: number, target: number, alpha: number) {
  return prev + (target - prev) * alpha;
}

type GovBand = 'ESCALATED' | 'MONITOR' | 'SUPPRESSED';

function precisionTag(pVar: number): string {
  if (pVar <= 0.06) return 'high confidence';
  if (pVar <= 0.14) return 'moderate confidence';
  return 'limited data';
}

function computeGovBand(p: number, c: number, sDays: number, pVar: number = 0.15): { band: GovBand; reason: string } {
  const conf = precisionTag(pVar);
  if (sDays > 60) return { band: 'SUPPRESSED', reason: `Data is ${sDays} days old — too stale to act on` };
  if (c < 0.50) return { band: 'SUPPRESSED', reason: `Not enough evidence (${Math.round(c * 100)}% coverage, ${conf}). Need at least 50%.` };
  if (p >= 0.85 && c >= 0.70 && sDays <= 14) return { band: 'ESCALATED', reason: `High concern (${Math.round(p * 100)}%, ${conf}) with strong evidence (${Math.round(c * 100)}%) and fresh data. Practitioner intervention warranted.` };
  if (p >= 0.60 && c >= 0.60) return { band: 'MONITOR', reason: `Elevated concern (${Math.round(p * 100)}%, ${conf}) with moderate evidence (${Math.round(c * 100)}%). Watching for more signal.` };
  if (p < 0.45) return { band: 'SUPPRESSED', reason: `Concern level (${Math.round(p * 100)}%, ${conf}) is below action threshold` };
  return { band: 'SUPPRESSED', reason: `Concern ${Math.round(p * 100)}% (${conf}) but evidence only ${Math.round(c * 100)}% — not enough to escalate. Holding.` };
}

function getRiskBand(p: number): 'critical' | 'high' | 'medium' | 'low' {
  if (p >= 0.8) return 'critical';
  if (p >= 0.6) return 'high';
  if (p >= 0.3) return 'medium';
  return 'low';
}

// ---- Generated types ----

export interface GeneratedSignalEvent {
  id: string;
  subject_id: string;
  org_id: string;
  signal_name: string;
  signal_state: 'final' | 'preliminary' | 'cancelled' | 'unknown';
  confidence: number;
  source_type: string;
  raw_value: number | null;
  unit: string;
  normalized_value: number;
  occurred_at: Date;
  metadata: Record<string, unknown>;
}

export interface GeneratedHealthSnapshot {
  id: string;
  subject_id: string;
  org_id: string;
  domain: HealthDomainId;
  p_score: number;
  p_var: number;
  c_score: number;
  s_score: number;
  risk_band: 'critical' | 'high' | 'medium' | 'low';
  governance_band: GovBand;
  governance_reason: string;
  signal_vector: Record<string, 'final' | 'cancelled' | 'unknown'>;
  frame_index: number;
  computed_at: Date;
}

export interface GeneratedSubjectUpdate {
  subject_id: string;
  posterior_p: number;
  posterior_p_var: number;
  posterior_c: number;
  posterior_s: number;
  risk_band: 'critical' | 'high' | 'medium' | 'low';
  governance_band: GovBand;
  governance_reason: string;
  last_signal_at: Date;
}

export interface GeneratedProtocolAssignment {
  id: string;
  subject_id: string;
  org_id: string;
  protocol_id: string;
  started_at: Date;
  status: string;
  dosing_notes: string;
}

export interface GeneratedDataSourceConnection {
  id: string;
  subject_id: string;
  org_id: string;
  source_id: string;
  connected_at: Date;
  last_sync_at: Date;
  status: string;
}

// ---- Signal value generation ----

function generateRawValue(
  signalId: HealthSignalId,
  t: number,
  storylineBias: number,
  protocolEffect: number,
  rng: () => number,
): { raw: number; normalized: number } {
  const def = HEALTH_SIGNALS[signalId];
  if (!def || def.unit === 'text' || !def.normalRange) return { raw: 0, normalized: 0.5 };

  const [normLo, normHi] = def.normalRange;
  const [fullLo, fullHi] = def.fullRange;
  const fullSpan = fullHi - fullLo;
  const normMid = (normLo + normHi) / 2;

  // storylineBias: 0 = healthy, 1 = concerning
  // protocolEffect: 0 = no effect, positive = improving
  const healthyTarget = normMid + (normHi - normMid) * 0.2;
  const INVERSE_SIGNALS = new Set([
    'self_pain', 'lab_crp', 'lab_cortisol', 'resting_hr', 'lab_a1c',
    'lab_thyroid_tsh', 'lab_creatine_kinase', 'lab_fasting_glucose',
    'resting_bp_systolic', 'resting_bp_diastolic', 'lab_apob',
  ]);

  const concernTarget = INVERSE_SIGNALS.has(signalId)
    ? normHi + (fullHi - normHi) * 0.4   // high = bad for these
    : normLo - (normLo - fullLo) * 0.3;  // low = bad for HRV, sleep, recovery, etc.

  const isInverseSignal = INVERSE_SIGNALS.has(signalId);

  const base = healthyTarget + (concernTarget - healthyTarget) * storylineBias;
  const withProtocol = isInverseSignal
    ? base - protocolEffect * (base - normMid) * 0.3
    : base + protocolEffect * (normHi - base) * 0.3;

  const raw = clamp(withProtocol + jitter(rng, fullSpan * 0.06), fullLo, fullHi);

  const normalized = isInverseSignal
    ? clamp01(1 - (raw - fullLo) / fullSpan)
    : clamp01((raw - fullLo) / fullSpan);

  return { raw: Math.round(raw * 100) / 100, normalized: Math.round(normalized * 1000) / 1000 };
}

// ---- Main generator ----

export function generateHealthSignalData(subjects: GeneratedSubject[]) {
  const allEvents: GeneratedSignalEvent[] = [];
  const allSnapshots: GeneratedHealthSnapshot[] = [];
  const subjectUpdates: GeneratedSubjectUpdate[] = [];
  const protocolAssignments: GeneratedProtocolAssignment[] = [];
  const dataSourceConnections: GeneratedDataSourceConnection[] = [];

  const now = new Date();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

  for (const subject of subjects) {
    const rng = mulberry32(subject.externalId.charCodeAt(3) * 1000 + subject.displayName.charCodeAt(0));
    const storyline = subject.storyline;
    const domain = subject.primaryDomain;
    const startTime = now.getTime() - ninetyDaysMs;

    // -- Determine which signals this subject produces --
    const wProfile = WEARABLE_PROFILES[subject.wearableProfile];
    const bProfile = BIOMARKER_PROFILES[subject.biomarkerProfile];

    const primarySource = DATA_SOURCES[wProfile?.primary ?? 'oura'];
    const secondarySource = wProfile?.secondary ? DATA_SOURCES[wProfile.secondary] : null;
    const labSource = DATA_SOURCES[bProfile?.provider ?? 'function_health'];

    const wearableSignals = new Set([
      ...(primarySource?.signals ?? []),
      ...(secondarySource?.signals ?? []),
    ]);
    const labSignals = new Set(labSource?.signals ?? []);
    // Use ALL activeDomains, not just primary — fixes recovery_score, self_energy, self_pain, nutrition_* producing 0 events
    const domainSignals = new Set(
      subject.activeDomains.flatMap(d => DOMAIN_SIGNALS[d] ?? [])
    );

    // Record data source connections — include nutrition app if subject has metabolic domain
    const hasMetabolic = subject.activeDomains.includes('metabolic');
    const nutritionApp = hasMetabolic ? (rng() < 0.5 ? 'myfitnesspal' : 'cronometer') : null;
    const connectedSources = [wProfile?.primary, wProfile?.secondary, bProfile?.provider, 'self_report', nutritionApp].filter(Boolean) as string[];
    for (const srcId of connectedSources) {
      dataSourceConnections.push({
        id: uuidv4(),
        subject_id: subject.id,
        org_id: subject.orgId,
        source_id: srcId,
        connected_at: subject.enrolledAt,
        last_sync_at: new Date(now.getTime() - rng() * 2 * 24 * 60 * 60 * 1000),
        status: 'active',
      });
    }

    // Record protocol assignments
    for (const protoId of subject.protocols) {
      const proto = PROTOCOLS[protoId];
      const startedWeeksAgo = 4 + Math.floor(rng() * 8);
      protocolAssignments.push({
        id: uuidv4(),
        subject_id: subject.id,
        org_id: subject.orgId,
        protocol_id: protoId,
        started_at: new Date(now.getTime() - startedWeeksAgo * 7 * 24 * 60 * 60 * 1000),
        status: 'active',
        dosing_notes: `${proto?.label ?? protoId} — ${proto?.dosingCadence ?? 'as_needed'} dosing`,
      });
    }

    // Compute protocol effect curve for each signal
    function protocolEffectAt(signalId: string, t: number): number {
      let effect = 0;
      for (const protoId of subject.protocols) {
        const proto = PROTOCOLS[protoId];
        if (!proto?.monitoredSignals.includes(signalId as HealthSignalId)) continue;
        const onset = proto.onsetWeeks / 13; // normalize to 90-day window
        const peak = proto.peakWeeks / 13;
        if (t < onset) continue;
        const progress = clamp01((t - onset) / (peak - onset));
        effect += progress * 0.6;
      }
      return clamp01(effect);
    }

    // -- Generate daily wearable signal events --
    const dailySignals = SIGNAL_CADENCE.daily.filter(s =>
      wearableSignals.has(s) || domainSignals.has(s)
    );
    const weeklySignals = SIGNAL_CADENCE.weekly.filter(s => domainSignals.has(s));

    const dayCount = 90;
    for (let d = 0; d < dayCount; d++) {
      const t = d / dayCount;
      const dayMs = startTime + d * 24 * 60 * 60 * 1000;
      const occurredAt = new Date(dayMs + rng() * 8 * 60 * 60 * 1000); // jitter within day

      const storylineBias = clamp01(storyline.pCurve(t) + jitter(rng, 0.05));

      // Data gap storyline: after 40% mark, signals start dropping out
      const isDataGap = storyline.id === 10 && t > 0.4;
      const dropRate = isDataGap ? 0.3 + (t - 0.4) * 0.8 : 0.05;

      for (const signalId of dailySignals) {
        if (rng() < dropRate) continue; // missed day

        const isStorySignal = storyline.activeSignals.includes(signalId);
        const bias = isStorySignal ? storylineBias : clamp01(0.3 + jitter(rng, 0.1));
        const protoEffect = protocolEffectAt(signalId, t);
        const { raw, normalized } = generateRawValue(signalId as HealthSignalId, t, bias, protoEffect, rng);
        const conf = clamp01(0.7 + rng() * 0.25);

        const sourceId = wearableSignals.has(signalId)
          ? (wProfile?.primary ?? 'oura')
          : 'self_report';

        allEvents.push({
          id: uuidv4(),
          subject_id: subject.id,
          org_id: subject.orgId,
          signal_name: signalId,
          signal_state: 'final',
          confidence: Math.round(conf * 100) / 100,
          source_type: sourceId,
          raw_value: raw,
          unit: HEALTH_SIGNALS[signalId as HealthSignalId]?.unit ?? '',
          normalized_value: normalized,
          occurred_at: occurredAt,
          metadata: { auto_generated: true, storyline: storyline.id },
        });
      }

      // Weekly self-reports
      if (d % 7 === 0) {
        for (const signalId of weeklySignals) {
          if (rng() < dropRate) continue;
          const isStorySignal = storyline.activeSignals.includes(signalId);
          const bias = isStorySignal ? storylineBias : clamp01(0.25 + jitter(rng, 0.1));
          const protoEffect = protocolEffectAt(signalId, t);
          const { raw, normalized } = generateRawValue(signalId as HealthSignalId, t, bias, protoEffect, rng);

          allEvents.push({
            id: uuidv4(),
            subject_id: subject.id,
            org_id: subject.orgId,
            signal_name: signalId,
            signal_state: 'final',
            confidence: clamp01(0.6 + rng() * 0.2),
            source_type: 'self_report',
            raw_value: raw,
            unit: HEALTH_SIGNALS[signalId as HealthSignalId]?.unit ?? '',
            normalized_value: normalized,
            occurred_at: occurredAt,
            metadata: { auto_generated: true, storyline: storyline.id },
          });
        }
      }
    }

    // -- Generate periodic lab events --
    const labCadenceWeeks = bProfile?.cadenceWeeks ?? 13;
    const labSignalIds = SIGNAL_CADENCE.periodic_lab.filter(s => labSignals.has(s));
    const labIntervalMs = labCadenceWeeks * 7 * 24 * 60 * 60 * 1000;
    let labTime = startTime + rng() * labIntervalMs * 0.3; // first lab offset

    while (labTime < now.getTime()) {
      const t = (labTime - startTime) / ninetyDaysMs;
      const occurredAt = new Date(labTime);
      const storylineBias = clamp01(storyline.pCurve(clamp01(t)) + jitter(rng, 0.04));

      for (const signalId of labSignalIds) {
        const protoEffect = protocolEffectAt(signalId, clamp01(t));
        const { raw, normalized } = generateRawValue(signalId as HealthSignalId, clamp01(t), storylineBias, protoEffect, rng);

        allEvents.push({
          id: uuidv4(),
          subject_id: subject.id,
          org_id: subject.orgId,
          signal_name: signalId,
          signal_state: 'final',
          confidence: clamp01(0.85 + rng() * 0.1),
          source_type: bProfile?.provider ?? 'function_health',
          raw_value: raw,
          unit: HEALTH_SIGNALS[signalId as HealthSignalId]?.unit ?? '',
          normalized_value: normalized,
          occurred_at: occurredAt,
          metadata: { auto_generated: true, storyline: storyline.id, lab_draw: true },
        });
      }

      labTime += labIntervalMs * (0.8 + rng() * 0.4);
    }

    // -- Generate timeline snapshots (posterior frames) --
    const frameCount = 10 + Math.floor(rng() * 6);
    const relevantSignals = DOMAIN_SIGNALS[domain] ?? [];
    const nExpected = DOMAIN_N_EXPECTED[domain] ?? relevantSignals.length;

    let prevP = clamp01(storyline.pCurve(0) + jitter(rng, 0.06));
    let prevS = clamp01(storyline.sCurve(0) + jitter(rng, 0.05));

    for (let f = 0; f < frameCount; f++) {
      const t = frameCount === 1 ? 1 : f / (frameCount - 1);
      const computedAtMs = startTime + t * ninetyDaysMs;
      const computedAt = new Date(computedAtMs);

      const vector: Record<string, 'final' | 'cancelled' | 'unknown'> = {};
      let observed = 0;
      let present = 0;
      let absent = 0;

      for (const sig of relevantSignals) {
        const isDataGap = storyline.id === 10 && t > 0.4;
        const coverage = isDataGap ? 0.2 : 0.75 + rng() * 0.2;
        const isObserved = rng() < coverage;

        if (!isObserved) { vector[sig] = 'unknown'; continue; }
        observed++;

        const isStorySig = storyline.activeSignals.includes(sig);
        const activation = isStorySig ? clamp01(0.25 + t * 0.6 + jitter(rng, 0.12)) : clamp01(0.15 + jitter(rng, 0.08));

        if (rng() < activation) { vector[sig] = 'final'; present++; }
        else if (rng() < 0.15) { vector[sig] = 'cancelled'; absent++; }
        else { vector[sig] = 'unknown'; }
      }

      const missingPenalty = 1 - observed / nExpected;
      const conflict = observed > 0 ? Math.min(1, (absent / Math.max(1, observed)) * 1.6) : 1;

      const baseP = clamp01(storyline.pCurve(t) + jitter(rng, 0.08));
      const prior = 0.06;
      const evidenceWeight = clamp01(1 - missingPenalty * 0.35);
      const targetP = clamp01(baseP * evidenceWeight + prior * (1 - evidenceWeight));
      const p = clamp01(smoothStep(prevP, targetP, 0.55) + jitter(rng, 0.03));
      prevP = p;

      const stalenessPenalty = clamp01(storyline.sCurve(t));
      const baseS = clamp01(storyline.sCurve(t) + 0.35 * p + jitter(rng, 0.06));
      const severityFromEvidence = clamp01(0.15 + (present / Math.max(1, nExpected)) * 0.55 + conflict * 0.15);
      const targetS = clamp01(0.55 * baseS + 0.45 * severityFromEvidence + stalenessPenalty * 0.12 - missingPenalty * 0.08);
      const s = clamp01(smoothStep(prevS, targetS, 0.5) + jitter(rng, 0.03));
      prevS = s;

      const c = clamp01(0.85 - missingPenalty * 0.75 - stalenessPenalty * 0.55 - conflict * 0.25 + jitter(rng, 0.05));

      // p_var: variance of the P estimate. Bounded [0, 0.25] (Bernoulli max).
      // Low observed signals → high variance (limited data).
      // High conflict (present + absent mix) → high variance (inconsistent evidence).
      // Staleness → inflates variance (old data = less certain).
      const signalRatio = observed / Math.max(1, nExpected);
      const pVar = clamp(
        0.25 * (1 - signalRatio * 0.7) * (1 + conflict * 0.5) * (1 + stalenessPenalty * 0.3) + jitter(rng, 0.01),
        0.01,
        0.25,
      );

      const roundedP = Math.round(p * 1000) / 1000;
      const roundedPVar = Math.round(pVar * 1000) / 1000;
      const roundedC = Math.round(c * 1000) / 1000;
      const sDaysForGov = Math.round(stalenessPenalty * 30);
      const gov = computeGovBand(roundedP, roundedC, sDaysForGov, roundedPVar);

      allSnapshots.push({
        id: uuidv4(),
        subject_id: subject.id,
        org_id: subject.orgId,
        domain,
        p_score: roundedP,
        p_var: roundedPVar,
        c_score: roundedC,
        s_score: Math.round(s * 1000) / 1000,
        risk_band: getRiskBand(p),
        governance_band: gov.band,
        governance_reason: gov.reason,
        signal_vector: vector,
        frame_index: f,
        computed_at: computedAt,
      });
    }

    // Subject update from last snapshot
    const lastSnap = allSnapshots.filter(s => s.subject_id === subject.id).at(-1);
    const lastEventAt = new Date(Math.max(
      ...allEvents.filter(e => e.subject_id === subject.id).map(e => e.occurred_at.getTime()),
      startTime,
    ));

    if (lastSnap) {
      subjectUpdates.push({
        subject_id: subject.id,
        posterior_p: lastSnap.p_score,
        posterior_p_var: lastSnap.p_var,
        posterior_c: lastSnap.c_score,
        posterior_s: lastSnap.s_score,
        risk_band: lastSnap.risk_band,
        governance_band: lastSnap.governance_band,
        governance_reason: lastSnap.governance_reason,
        last_signal_at: lastEventAt,
      });
    }
  }

  return {
    events: allEvents,
    snapshots: allSnapshots,
    subjectUpdates,
    protocolAssignments,
    dataSourceConnections,
  };
}
