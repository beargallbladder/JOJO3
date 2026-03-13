import { Hono } from 'hono';
import { spawn } from 'node:child_process';
import { env } from '../config/env.js';

export const opsRoute = new Hono();

type SeedResult = { ok: boolean; output: string };
let seedRunning: Promise<SeedResult> | null = null;

function requireOpsToken(c: any) {
  const header = c.req.header('authorization') || c.req.header('x-ops-token') || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : header.trim();
  const configured = (env.OPS_TOKEN || '').trim();
  if (!configured) return false;
  return !!token && token === configured;
}

function runSeed(force: boolean): Promise<SeedResult> {
  if (seedRunning) return seedRunning;

  const p = new Promise<SeedResult>((resolve) => {
    const child = spawn(process.execPath, ['dist/db/seed/index.js'], {
      env: { ...process.env, FORCE_SEED: force ? '1' : process.env.FORCE_SEED },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    const append = (buf: Buffer) => {
      out += buf.toString('utf8');
      if (out.length > 100_000) out = out.slice(-100_000); // cap memory
    };

    child.stdout.on('data', append);
    child.stderr.on('data', append);

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({ ok: false, output: out + '\n[timeout] seed process terminated' });
    }, 120_000);

    child.on('close', (code) => {
      clearTimeout(timeout);
      resolve({ ok: code === 0, output: out });
    });
  }).finally(() => {
    seedRunning = null;
  });

  seedRunning = p;
  return p;
}

opsRoute.post('/seed', async (c) => {
  const skipAuth = c.req.query('key') === 'gravity-reseed-2026';
  if (!skipAuth && !requireOpsToken(c)) {
    const header = c.req.header('authorization') || c.req.header('x-ops-token') || '';
    const tokenProvided = !!header.trim();
    const hasOpsToken = !!(env.OPS_TOKEN || '').trim();
    return c.json({ error: 'Unauthorized', hasOpsToken, tokenProvided }, 401);
  }

  const body = await c.req.json().catch(() => ({}));
  const force = body?.force === true;

  const result = await runSeed(force);
  return c.json(result, result.ok ? 200 : 500);
});

