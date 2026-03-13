'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/cn';
import { springs } from '@/lib/motion';
import { PulseIndicator } from './pulse-indicator';
import { StreamingText } from './streaming-text';
import { useVoiceStream } from '@/hooks/use-voice-stream';
import { getCachedVoice } from '@/hooks/use-voice-preload';
import { API_BASE } from '@/lib/api-client';
import type { VoiceScope } from '@gravity/shared';

interface VoiceOverlayProps {
  open: boolean;
  onClose: () => void;
  scope: VoiceScope;
  vinId?: string;
}

const QUICK_PROMPTS = {
  vin: [
    'What\'s going on with this vehicle?',
    'What should I tell the customer?',
    'Should we schedule service?',
    'What evidence are we missing?',
  ],
  fleet: [
    'Give me the quick rundown.',
    'Which vehicles should I look at first?',
    'Anything I should worry about this week?',
    'What would you prioritize for scheduling?',
  ],
};

const TTS_EARLY_THRESHOLD = 120;

export function VoiceOverlay({ open, onClose, scope, vinId }: VoiceOverlayProps) {
  const [input, setInput] = useState('');
  const [cachedText, setCachedText] = useState('');
  const { isStreaming, text, error, stream, stop, reset } = useVoiceStream();
  const [ttsStatus, setTtsStatus] = useState<'idle' | 'generating' | 'speaking' | 'error'>('idle');
  const [ttsError, setTtsError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const ttsFiredForRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakingAbortRef = useRef<AbortController | null>(null);

  function stopAudio() {
    speakingAbortRef.current?.abort();
    speakingAbortRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = '';
      audioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  const handleSubmit = (message: string) => {
    if (!message.trim()) return;
    requestIdRef.current += 1;
    ttsFiredForRef.current = null;
    setTtsStatus('idle');
    setTtsError(null);
    stopAudio();

    const cached = getCachedVoice(scope, vinId || null, message.trim());
    if (cached) {
      ttsFiredForRef.current = requestIdRef.current;
      setCachedText(cached.text);

      if (cached.audioUrl) {
        setTtsStatus('speaking');
        const audio = new Audio(cached.audioUrl);
        audioRef.current = audio;
        audio.onended = () => setTtsStatus('idle');
        audio.play().catch(() => setTtsStatus('idle'));
      } else {
        fireTts(cached.text);
      }

      setInput('');
      return;
    }

    setCachedText('');

    stream(scope, vinId || null, message.trim());
    setInput('');
  };

  function fireTts(ttsText: string) {
    const controller = new AbortController();
    speakingAbortRef.current = controller;
    setTtsStatus('generating');
    setTtsError(null);

    (async () => {
      const res = await fetch(`${API_BASE}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ttsText }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const msg = payload?.error || payload?.details || `TTS failed (${res.status})`;
        setTtsStatus('error');
        setTtsError(String(msg));
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          try {
            const u = new SpeechSynthesisUtterance(ttsText);
            u.rate = 0.9;
            u.pitch = 0.85;
            u.volume = 1;
            u.onstart = () => setTtsStatus('speaking');
            u.onend = () => setTtsStatus('idle');
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(u);
          } catch { /* ignore */ }
        }
        return;
      }

      const blob = await res.blob();
      if (controller.signal.aborted) return;

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setTtsStatus('speaking');
      audio.onended = () => {
        setTtsStatus('idle');
        URL.revokeObjectURL(url);
      };
      audio.play().catch(() => {
        setTtsStatus('error');
        setTtsError('Audio playback blocked by browser.');
      });
    })().catch(() => {});
  }

  useEffect(() => {
    if (!open || error) return;
    const reqId = requestIdRef.current;
    if (ttsFiredForRef.current === reqId) return;

    if (isStreaming && text.length >= TTS_EARLY_THRESHOLD) {
      ttsFiredForRef.current = reqId;
      fireTts(text);
    } else if (!isStreaming && text.length > 0) {
      ttsFiredForRef.current = reqId;
      fireTts(text);
    }
  }, [open, isStreaming, text, error]);

  const handleClose = () => {
    stop();
    reset();
    setCachedText('');
    stopAudio();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={handleClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={springs.snappy}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[70vh]"
          >
            <div className="bg-gravity-elevated/95 backdrop-blur-xl rounded-t-2xl border-t border-gravity-border overflow-hidden">
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-gravity-border" />
              </div>

              <div className="px-6 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <PulseIndicator active={isStreaming || ttsStatus === 'speaking'} size={32} />
                  <div>
                    <h3 className="text-sm font-medium">
                      {scope === 'vin' ? 'Vehicle Health Assistant' : 'Fleet Health Assistant'}
                    </h3>
                    <p className="text-[10px] text-gravity-text-whisper uppercase tracking-widest">
                      {isStreaming ? 'Thinking…' : ttsStatus === 'generating' ? 'Preparing voice…' : ttsStatus === 'speaking' ? 'Speaking…' : 'Ready'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-gravity-surface flex items-center justify-center hover:bg-gravity-border transition-colors"
                >
                  <svg className="w-4 h-4 text-gravity-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="px-6 pb-4">
                <StreamingText text={cachedText || text} isStreaming={isStreaming && !cachedText} />
                {error && (
                  <p className="text-xs text-risk-critical mt-2">{error}</p>
                )}
                {ttsError && (
                  <p className="text-[10px] text-gravity-text-whisper mt-2">
                    TTS: {ttsError}
                  </p>
                )}
              </div>

              {!text && !cachedText && !isStreaming && (
                <div className="px-6 pb-4">
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper mb-2">
                    Quick Prompts
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_PROMPTS[scope].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSubmit(prompt)}
                        className="text-xs px-3 py-1.5 bg-gravity-surface border border-gravity-border rounded-full text-gravity-text-secondary hover:text-gravity-text hover:border-gravity-text-whisper transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="px-6 pb-6">
                <div className="flex gap-2">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit(input)}
                    placeholder={`Ask about ${scope === 'vin' ? 'this vehicle' : 'the fleet'}...`}
                    className="flex-1 px-4 py-2.5 bg-gravity-surface border border-gravity-border rounded-lg text-sm text-gravity-text placeholder:text-gravity-text-whisper focus:outline-none focus:border-gravity-accent/40"
                    disabled={isStreaming}
                  />
                  {isStreaming ? (
                    <button
                      onClick={stop}
                      className="px-4 py-2.5 bg-risk-critical/20 text-risk-critical text-sm font-medium rounded-lg hover:bg-risk-critical/30 transition-colors"
                    >
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubmit(input)}
                      disabled={!input.trim()}
                      className="px-4 py-2.5 bg-gravity-accent hover:bg-gravity-accent/90 disabled:opacity-30 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      Ask
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
