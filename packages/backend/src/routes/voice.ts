import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { streamVoiceResponse } from '../services/voice.js';
import { db } from '../config/database.js';
import { vins } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';
import { getPillarsForVin, getTimelineForVin } from '../services/pillar-engine.js';
import { getGovernanceForVin } from '../services/governance.js';

const PILLAR_FRIENDLY: Record<string, string> = {
  short_trip_density: 'short trips',
  ota_stress: 'software updates',
  cold_soak: 'cold weather exposure',
  cranking_degradation: 'starting performance',
  hmi_reset: 'driver reset',
  service_record: 'dealer service record',
  parts_purchase: 'parts purchase',
  cohort_prior: 'fleet pattern',
};

const SUBSYSTEM_FRIENDLY: Record<string, string> = {
  battery_12v: '12V battery',
  oil_maintenance: 'oil maintenance',
  brake_wear: 'brake wear',
};

export const voiceRoute = new Hono();

voiceRoute.post('/vin/:vin_id', async (c) => {
  const vinId = c.req.param('vin_id');
  const body = await c.req.json();

  const [vin] = await db.select().from(vins).where(eq(vins.id, vinId));
  if (!vin) return c.json({ error: 'VIN not found' }, 404);

  const [pillars, timeline, governance] = await Promise.all([
    getPillarsForVin(vinId),
    getTimelineForVin(vinId),
    getGovernanceForVin(vinId),
  ]);

  const recentPillars = pillars.slice(-15);
  const presentEvidence = [...new Set(recentPillars.filter(p => p.pillar_state === 'present').map(p => PILLAR_FRIENDLY[p.pillar_name] || p.pillar_name))];
  const absentEvidence = [...new Set(recentPillars.filter(p => p.pillar_state === 'absent').map(p => PILLAR_FRIENDLY[p.pillar_name] || p.pillar_name))];
  const unknownEvidence = [...new Set(recentPillars.filter(p => p.pillar_state === 'unknown').map(p => PILLAR_FRIENDLY[p.pillar_name] || p.pillar_name))];

  const context = {
    vehicle: `${vin.year} ${vin.make} ${vin.model} ${vin.trim}`,
    vin_code: vin.vin_code,
    subsystem: SUBSYSTEM_FRIENDLY[vin.subsystem] || vin.subsystem,
    risk_level_percent: Math.round(vin.posterior_p * 100),
    evidence_strength_percent: Math.round(vin.posterior_c * 100),
    governance_band: vin.governance_band,
    governance_reason: vin.governance_reason,
    evidence_present: presentEvidence,
    evidence_absent: absentEvidence,
    evidence_missing: unknownEvidence,
    governance_actions: governance.map(g => ({
      action: g.action_type.replace(/_/g, ' '),
      reason: g.reason,
    })),
    service_recommendation: vin.governance_band === 'ESCALATED'
      ? 'Service is recommended — dealer engagement warranted.'
      : vin.governance_band === 'MONITOR'
        ? 'No service needed yet. We are watching this vehicle.'
        : 'No service needed. This vehicle is suppressed.',
  };

  return streamSSE(c, async (stream) => {
    const gen = streamVoiceResponse({
      scope: 'vin',
      message: body.message || 'What\'s going on with this vehicle?',
      context,
    });

    for await (const chunk of gen) {
      await stream.writeSSE({ data: JSON.stringify(chunk) });
    }
  });
});

voiceRoute.post('/fleet', async (c) => {
  const body = await c.req.json();

  const topLeads = await db.select().from(vins).orderBy(desc(vins.posterior_p)).limit(20);

  const context = {
    fleet_size: 500,
    top_vehicles: topLeads.slice(0, 10).map(v => ({
      vehicle: `${v.year} ${v.make} ${v.model}`,
      vin_last4: v.vin_code.slice(-4),
      subsystem: SUBSYSTEM_FRIENDLY[v.subsystem] || v.subsystem,
      risk_percent: Math.round(v.posterior_p * 100),
      evidence_percent: Math.round(v.posterior_c * 100),
      governance_band: v.governance_band,
    })),
    escalated_count: topLeads.filter(v => v.governance_band === 'ESCALATED').length,
    monitor_count: topLeads.filter(v => v.governance_band === 'MONITOR').length,
    suppressed_count: topLeads.filter(v => v.governance_band === 'SUPPRESSED').length,
  };

  return streamSSE(c, async (stream) => {
    const gen = streamVoiceResponse({
      scope: 'fleet',
      message: body.message || 'Give me the quick rundown.',
      context,
    });

    for await (const chunk of gen) {
      await stream.writeSSE({ data: JSON.stringify(chunk) });
    }
  });
});
