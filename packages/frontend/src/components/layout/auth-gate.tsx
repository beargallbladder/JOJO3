'use client';

import { useState, useEffect } from 'react';

const VALID_USER = 'coach';
const VALID_PASS = 'longevity2026';
const AUTH_KEY = 'lp_auth';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(AUTH_KEY) === '1') {
      setAuthed(true);
    }
    setChecking(false);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === VALID_USER && password === VALID_PASS) {
      sessionStorage.setItem(AUTH_KEY, '1');
      setAuthed(true);
      setError('');
    } else {
      setError('Invalid credentials');
    }
  };

  if (checking) return null;
  if (authed) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gravity-bg">
      <form onSubmit={handleLogin} className="w-full max-w-sm p-8 animate-fade-in">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-3 h-3 rounded-full bg-health-teal animate-pulse-soft" />
          <span className="font-semibold text-lg tracking-wide">LONGEVITY</span>
          <span className="text-xs font-medium tracking-widest text-gravity-accent-warm">plan.ai</span>
        </div>
        <p className="text-sm text-gravity-text-secondary mb-8">
          Welcome back. Your clients are waiting.
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper block mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 bg-gravity-surface border border-gravity-border rounded-lg text-sm text-gravity-text placeholder:text-gravity-text-whisper focus:outline-none focus:border-gravity-accent/50 transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper block mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-gravity-surface border border-gravity-border rounded-lg text-sm text-gravity-text placeholder:text-gravity-text-whisper focus:outline-none focus:border-gravity-accent/50 transition-colors"
            />
          </div>
          {error && <p className="text-xs text-health-coral">{error}</p>}
          <button
            type="submit"
            className="w-full py-2.5 bg-gravity-accent hover:bg-gravity-accent/90 text-white text-sm font-medium rounded-lg transition-all hover:shadow-lg hover:shadow-gravity-accent/20"
          >
            Sign In
          </button>
        </div>
      </form>
    </div>
  );
}
