'use client';

import { useEffect, useRef } from 'react';
import { API_BASE } from '@/lib/api-client';

interface CachedVoice {
  text: string;
  audioUrl: string | null;
}

const vinPrompts = [
  'What\'s going on with this vehicle?',
  'What should I tell the customer?',
  'Should we schedule service?',
  'What evidence are we missing?',
];

const fleetPrompts = [
  'Give me the quick rundown.',
  'Which vehicles should I look at first?',
  'Anything I should worry about this week?',
  'What would you prioritize for scheduling?',
];

const cache = new Map<string, CachedVoice>();

function cacheKey(scope: string, id: string | null, prompt: string) {
  return `${scope}:${id || 'fleet'}:${prompt}`;
}

async function preloadOne(scope: 'vin' | 'fleet', id: string | null, prompt: string) {
  const key = cacheKey(scope, id, prompt);
  if (cache.has(key)) return;

  try {
    const path = scope === 'vin' ? `/voice/vin/${id}` : '/voice/fleet';
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: prompt }),
    });

    if (!res.ok || !res.body) return;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const chunk = JSON.parse(line.slice(6));
            if (chunk.type === 'text') fullText += chunk.content;
          } catch { /* skip */ }
        }
      }
    }

    if (!fullText) return;

    cache.set(key, { text: fullText, audioUrl: null });

    const ttsRes = await fetch(`${API_BASE}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: fullText }),
    });

    if (ttsRes.ok) {
      const blob = await ttsRes.blob();
      const url = URL.createObjectURL(blob);
      cache.set(key, { text: fullText, audioUrl: url });
    }
  } catch { /* preload is best-effort */ }
}

export function useVoicePreload(scope: 'vin' | 'fleet', id: string | null) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    if (scope === 'vin' && !id) return;
    started.current = true;

    const prompts = scope === 'vin' ? vinPrompts : fleetPrompts;
    prompts.forEach((prompt) => preloadOne(scope, id, prompt));
  }, [scope, id]);
}

export function getCachedVoice(scope: string, id: string | null, prompt: string): CachedVoice | null {
  return cache.get(cacheKey(scope, id, prompt)) || null;
}
