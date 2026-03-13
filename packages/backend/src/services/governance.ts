import { db } from '../config/database.js';
import { governanceActions, vins } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

const STALENESS_HARD_CEILING = 60;

interface GovernanceResult {
  band: 'ESCALATED' | 'MONITOR' | 'SUPPRESSED';
  reason: string;
}

export function computeGovernanceBand(p: number, c: number, sDays: number): GovernanceResult {
  if (sDays > STALENESS_HARD_CEILING) {
    return { band: 'SUPPRESSED', reason: `Evidence is ${sDays} days old — too stale to act on` };
  }

  if (c < 0.50) {
    return { band: 'SUPPRESSED', reason: `Not enough evidence to act (${Math.round(c * 100)}% coverage). Need at least 50%.` };
  }

  if (p >= 0.85 && c >= 0.70 && sDays <= 14) {
    return { band: 'ESCALATED', reason: `High risk (${Math.round(p * 100)}%) with strong evidence (${Math.round(c * 100)}%) and fresh data. Dealer action warranted.` };
  }

  if (p >= 0.60 && c >= 0.60) {
    return { band: 'MONITOR', reason: `Elevated risk (${Math.round(p * 100)}%) with moderate evidence (${Math.round(c * 100)}%). Watching for more signal.` };
  }

  if (p < 0.45) {
    return { band: 'SUPPRESSED', reason: `Risk level (${Math.round(p * 100)}%) is below action threshold` };
  }

  return { band: 'SUPPRESSED', reason: `Risk is ${Math.round(p * 100)}% but evidence is only ${Math.round(c * 100)}% — not enough to escalate or monitor. Holding.` };
}

export function computeStaleness(lastEventAt: string | Date): number {
  const last = new Date(lastEventAt).getTime();
  return Math.max(0, Math.round((Date.now() - last) / (24 * 60 * 60 * 1000)));
}

export async function getGovernanceForVin(vinId: string) {
  return db.select().from(governanceActions).where(eq(governanceActions.vin_id, vinId)).orderBy(desc(governanceActions.created_at));
}

export function buildServiceSuggestion(
  vin: typeof vins.$inferSelect,
  _governance: (typeof governanceActions.$inferSelect)[]
) {
  const band = vin.governance_band;
  const reason = vin.governance_reason;

  if (band === 'ESCALATED') {
    return {
      recommended: true,
      urgency: 'immediate' as const,
      reason: reason || 'Governance has escalated this vehicle for dealer engagement.',
    };
  }

  if (band === 'MONITOR') {
    return {
      recommended: false,
      urgency: 'routine' as const,
      reason: reason || 'Under monitoring. Evidence is building but not yet sufficient to act.',
    };
  }

  return {
    recommended: false,
    urgency: 'none' as const,
    reason: reason || 'Suppressed. The system does not have enough evidence to recommend action.',
  };
}
