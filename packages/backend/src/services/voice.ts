import Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';

const VIN_SYSTEM_PROMPT = `You are a Ford Vehicle Health assistant. You help dealers and service advisors understand what's going on with a specific vehicle.

CRITICAL RULES:
1. You MUST match the governance_band and service_recommendation in the data. If governance says SUPPRESSED and service says "no service needed," you MUST NOT recommend service. If it says ESCALATED, you MUST say service is recommended.
2. You MUST reference the actual evidence_present and evidence_absent lists provided. Do not invent evidence.
3. Explain WHY missing evidence matters — Ford uses data from millions of vehicles to find outlier behavior BEFORE a breakdown. When a pillar is missing, it means we can't compare this vehicle's pattern against the fleet. That gap reduces our confidence.
4. Talk naturally. A dealer should be able to repeat what you say to a customer word for word.
5. Never say "posterior," "confidence score," "staleness index," or "pillar." Say "risk level," "how sure we are," "how fresh the data is," and "evidence" or "signal."
6. Keep it to 3-5 sentences.

THE COHORT STORY (use this when relevant):
Ford monitors millions of connected vehicles. We compare each VIN's behavior patterns — trip length, starting performance, weather exposure, service history — against similar vehicles in the same region. When a vehicle starts behaving differently from its peers, that's a signal. We don't wait for a breakdown. We catch the pattern early. But we also don't cry wolf — we need enough evidence across multiple signals before we act.`;

const FLEET_SYSTEM_PROMPT = `You are a Ford Vehicle Health assistant for fleet managers.

CRITICAL RULES:
1. Reference the actual governance_band counts provided. If there are 0 escalated vehicles, say so.
2. Reference specific vehicles by model and VIN last 4 digits from the data.
3. Explain the cohort story: Ford monitors millions of vehicles to find outliers before breakdown. Each vehicle is compared against its peers.
4. Be practical: what to look at first, what can wait.
5. Talk naturally. 3-5 sentences.`;

function safeFallback(params: { scope: 'vin' | 'fleet'; context: Record<string, unknown> }) {
  const ctx: any = params.context || {};

  if (params.scope === 'vin') {
    const vehicle = ctx.vehicle || 'this vehicle';
    const risk = ctx.risk_level_percent ?? 0;
    const evidence = ctx.evidence_strength_percent ?? 0;
    const band = ctx.governance_band || 'SUPPRESSED';
    const present = Array.isArray(ctx.evidence_present) ? ctx.evidence_present : [];
    const absent = Array.isArray(ctx.evidence_absent) ? ctx.evidence_absent : [];
    const missing = Array.isArray(ctx.evidence_missing) ? ctx.evidence_missing : [];
    const serviceRec = ctx.service_recommendation || '';

    const drivers = present.length > 0
      ? `The main signals are ${present.slice(0, 3).join(' and ')}.`
      : 'We don\'t have strong signals pointing in any direction yet.';

    const gaps = absent.length > 0
      ? `We expected to see ${absent.slice(0, 2).join(' and ')} but didn\'t — that\'s actually important because Ford compares this vehicle against millions of similar ones, and that missing data means we can\'t confirm the pattern.`
      : missing.length > 0
        ? `We\'re still waiting on ${missing.slice(0, 2).join(' and ')} to complete the picture.`
        : '';

    const action = band === 'ESCALATED'
      ? 'Based on what we see, this vehicle should be scheduled for service.'
      : band === 'MONITOR'
        ? 'We\'re keeping an eye on this one but not recommending action yet.'
        : `The system is holding this one back — ${evidence < 50 ? 'we don\'t have enough evidence to act' : 'the risk level isn\'t high enough to trigger an alert'}.`;

    return `This ${vehicle} is at ${risk}% risk for ${ctx.subsystem || 'issues'}, and we're ${evidence}% confident in that assessment. ${drivers} ${gaps} ${action}`.trim();
  }

  const escalated = ctx.escalated_count ?? 0;
  const monitor = ctx.monitor_count ?? 0;
  const top = Array.isArray(ctx.top_vehicles) ? ctx.top_vehicles : [];
  const topNames = top.slice(0, 3).map((v: any) => `${v.vehicle} (${v.vin_last4})`);

  if (escalated === 0 && monitor === 0) {
    return 'The fleet looks healthy right now. No vehicles need immediate attention. We\'re monitoring everything against fleet-wide patterns and nothing stands out.';
  }

  return `You have ${escalated} vehicle${escalated !== 1 ? 's' : ''} escalated and ${monitor} being monitored. ${topNames.length > 0 ? `Top priority: ${topNames.join(', ')}.` : ''} Ford compares each vehicle against millions of similar ones in the fleet — these are the ones showing patterns that stand out from their peers.`;
}

export async function* streamVoiceResponse(params: {
  scope: 'vin' | 'fleet';
  message: string;
  context: Record<string, unknown>;
}): AsyncGenerator<{ type: 'text' | 'done' | 'error'; content: string }> {
  if (!env.ANTHROPIC_API_KEY) {
    yield { type: 'text', content: safeFallback(params) };
    yield { type: 'done', content: '' };
    return;
  }

  try {
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
    const systemPrompt = params.scope === 'vin' ? VIN_SYSTEM_PROMPT : FLEET_SYSTEM_PROMPT;

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 200,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Vehicle data:\n${JSON.stringify(params.context, null, 2)}\n\nQuestion: ${params.message}`,
        },
      ],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text', content: event.delta.text };
      }
    }
    yield { type: 'done', content: '' };
  } catch (err: any) {
    const msg = err?.message || 'Voice streaming failed';
    if (msg.includes('authentication_error') || msg.includes('invalid') || msg.includes('401')) {
      yield { type: 'text', content: safeFallback(params) };
      yield { type: 'done', content: '' };
      return;
    }
    yield { type: 'error', content: msg };
  }
}
