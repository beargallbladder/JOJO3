'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { loadTwinWasm } from '@/lib/wasm-loader';

interface RegionState {
  id: string;
  heat: number;
  recovery: number;
  pulse_rate: number;
  glow_intensity: number;
  color: [number, number, number, number];
  trend_arrow: number;
  confidence: number;
  label: string;
}

interface TwinFrame {
  timestamp: number;
  regions: RegionState[];
  global_recovery: number;
  global_stress: number;
  dominant_system: string;
}

type TwinMode = 'current' | 'projection' | 'comparison';

interface BodyRendererProps {
  snapshotJson?: string;
  protocolsJson?: string;
  projectionWeeks?: number;
  mode?: TwinMode;
  className?: string;
  onRegionHover?: (region: RegionState | null) => void;
}

const REGION_POSITIONS: Record<string, { x: number; y: number; rx: number; ry: number }> = {
  brain:        { x: 0.50, y: 0.08, rx: 0.06, ry: 0.045 },
  thyroid:      { x: 0.50, y: 0.16, rx: 0.025, ry: 0.015 },
  lungs:        { x: 0.50, y: 0.28, rx: 0.11, ry: 0.065 },
  heart:        { x: 0.45, y: 0.30, rx: 0.035, ry: 0.035 },
  liver:        { x: 0.41, y: 0.40, rx: 0.05, ry: 0.035 },
  adrenals:     { x: 0.50, y: 0.41, rx: 0.025, ry: 0.015 },
  gut:          { x: 0.50, y: 0.48, rx: 0.07, ry: 0.05 },
  kidneys:      { x: 0.57, y: 0.41, rx: 0.035, ry: 0.025 },
  reproductive: { x: 0.50, y: 0.56, rx: 0.035, ry: 0.025 },
  spine:        { x: 0.50, y: 0.38, rx: 0.015, ry: 0.14 },
  upper_body:   { x: 0.50, y: 0.26, rx: 0.16, ry: 0.09 },
  lower_body:   { x: 0.50, y: 0.70, rx: 0.09, ry: 0.13 },
  joints:       { x: 0.50, y: 0.60, rx: 0.12, ry: 0.035 },
  skin:         { x: 0.50, y: 0.45, rx: 0.19, ry: 0.32 },
  blood:        { x: 0.54, y: 0.33, rx: 0.025, ry: 0.025 },
  immune:       { x: 0.46, y: 0.46, rx: 0.025, ry: 0.025 },
};

// Chi meridian connections — energy flows between these
const MERIDIANS: [string, string][] = [
  ['brain', 'thyroid'], ['thyroid', 'heart'], ['thyroid', 'lungs'],
  ['heart', 'lungs'], ['heart', 'blood'], ['lungs', 'blood'],
  ['heart', 'liver'], ['liver', 'gut'], ['liver', 'kidneys'],
  ['gut', 'kidneys'], ['gut', 'reproductive'], ['gut', 'immune'],
  ['kidneys', 'adrenals'], ['adrenals', 'reproductive'],
  ['brain', 'spine'], ['spine', 'upper_body'], ['spine', 'lower_body'],
  ['upper_body', 'joints'], ['lower_body', 'joints'],
  ['heart', 'upper_body'], ['gut', 'lower_body'],
  ['immune', 'blood'], ['skin', 'immune'],
  ['lungs', 'upper_body'], ['kidneys', 'lower_body'],
];

// Particles flowing along meridians
interface Particle {
  meridian: number;
  t: number;          // 0-1 position along path
  speed: number;
  size: number;
  color: [number, number, number];
  alpha: number;
}

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    meridian: Math.floor(Math.random() * MERIDIANS.length),
    t: Math.random(),
    speed: 0.0003 + Math.random() * 0.0008,
    size: 1 + Math.random() * 2,
    color: [45, 212, 191] as [number, number, number],
    alpha: 0.2 + Math.random() * 0.5,
  }));
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// Anatomical silhouette — smooth, yoga-pose proportions
function drawBody(ctx: CanvasRenderingContext2D, w: number, h: number, breath: number) {
  const cx = w / 2;
  const scale = 1 + breath * 0.003;
  ctx.save();
  ctx.translate(cx, h * 0.5);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -h * 0.5);

  // Outer aura
  const auraGrad = ctx.createRadialGradient(cx, h * 0.42, h * 0.05, cx, h * 0.42, h * 0.45);
  auraGrad.addColorStop(0, 'rgba(99, 102, 241, 0.02)');
  auraGrad.addColorStop(0.5, 'rgba(45, 212, 191, 0.015)');
  auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = auraGrad;
  ctx.fillRect(0, 0, w, h);

  // Body outline — smooth bezier human form
  ctx.beginPath();

  // Head
  ctx.moveTo(cx, h * 0.02);
  ctx.bezierCurveTo(cx + w * 0.06, h * 0.02, cx + w * 0.065, h * 0.07, cx + w * 0.055, h * 0.11);
  ctx.bezierCurveTo(cx + w * 0.045, h * 0.14, cx + w * 0.02, h * 0.145, cx + w * 0.02, h * 0.155);

  // Neck right → shoulder
  ctx.bezierCurveTo(cx + w * 0.02, h * 0.17, cx + w * 0.08, h * 0.175, cx + w * 0.155, h * 0.195);

  // Right arm
  ctx.bezierCurveTo(cx + w * 0.19, h * 0.21, cx + w * 0.21, h * 0.30, cx + w * 0.195, h * 0.42);
  ctx.bezierCurveTo(cx + w * 0.185, h * 0.48, cx + w * 0.18, h * 0.50, cx + w * 0.175, h * 0.52);
  // Wrist/hand
  ctx.bezierCurveTo(cx + w * 0.17, h * 0.53, cx + w * 0.16, h * 0.53, cx + w * 0.155, h * 0.52);
  // Inner arm back up
  ctx.bezierCurveTo(cx + w * 0.155, h * 0.49, cx + w * 0.16, h * 0.42, cx + w * 0.16, h * 0.32);
  ctx.bezierCurveTo(cx + w * 0.155, h * 0.25, cx + w * 0.14, h * 0.22, cx + w * 0.12, h * 0.21);

  // Right torso
  ctx.bezierCurveTo(cx + w * 0.13, h * 0.30, cx + w * 0.12, h * 0.42, cx + w * 0.10, h * 0.52);
  ctx.bezierCurveTo(cx + w * 0.09, h * 0.57, cx + w * 0.085, h * 0.59, cx + w * 0.08, h * 0.61);

  // Right leg
  ctx.bezierCurveTo(cx + w * 0.085, h * 0.65, cx + w * 0.09, h * 0.73, cx + w * 0.08, h * 0.83);
  ctx.bezierCurveTo(cx + w * 0.075, h * 0.88, cx + w * 0.075, h * 0.92, cx + w * 0.08, h * 0.95);
  // Foot
  ctx.bezierCurveTo(cx + w * 0.06, h * 0.96, cx + w * 0.04, h * 0.955, cx + w * 0.035, h * 0.94);
  // Inner leg
  ctx.bezierCurveTo(cx + w * 0.04, h * 0.90, cx + w * 0.045, h * 0.80, cx + w * 0.03, h * 0.68);
  ctx.bezierCurveTo(cx + w * 0.02, h * 0.63, cx + w * 0.015, h * 0.61, cx + w * 0.01, h * 0.60);

  // Crotch
  ctx.bezierCurveTo(cx + w * 0.005, h * 0.60, cx - w * 0.005, h * 0.60, cx - w * 0.01, h * 0.60);

  // Left leg (mirror)
  ctx.bezierCurveTo(cx - w * 0.015, h * 0.61, cx - w * 0.02, h * 0.63, cx - w * 0.03, h * 0.68);
  ctx.bezierCurveTo(cx - w * 0.045, h * 0.80, cx - w * 0.04, h * 0.90, cx - w * 0.035, h * 0.94);
  ctx.bezierCurveTo(cx - w * 0.04, h * 0.955, cx - w * 0.06, h * 0.96, cx - w * 0.08, h * 0.95);
  ctx.bezierCurveTo(cx - w * 0.075, h * 0.92, cx - w * 0.075, h * 0.88, cx - w * 0.08, h * 0.83);
  ctx.bezierCurveTo(cx - w * 0.09, h * 0.73, cx - w * 0.085, h * 0.65, cx - w * 0.08, h * 0.61);

  // Left torso
  ctx.bezierCurveTo(cx - w * 0.085, h * 0.59, cx - w * 0.09, h * 0.57, cx - w * 0.10, h * 0.52);
  ctx.bezierCurveTo(cx - w * 0.12, h * 0.42, cx - w * 0.13, h * 0.30, cx - w * 0.12, h * 0.21);

  // Left arm
  ctx.bezierCurveTo(cx - w * 0.14, h * 0.22, cx - w * 0.155, h * 0.25, cx - w * 0.16, h * 0.32);
  ctx.bezierCurveTo(cx - w * 0.16, h * 0.42, cx - w * 0.155, h * 0.49, cx - w * 0.155, h * 0.52);
  ctx.bezierCurveTo(cx - w * 0.16, h * 0.53, cx - w * 0.17, h * 0.53, cx - w * 0.175, h * 0.52);
  ctx.bezierCurveTo(cx - w * 0.18, h * 0.50, cx - w * 0.185, h * 0.48, cx - w * 0.195, h * 0.42);
  ctx.bezierCurveTo(cx - w * 0.21, h * 0.30, cx - w * 0.19, h * 0.21, cx - w * 0.155, h * 0.195);

  // Left shoulder → neck
  ctx.bezierCurveTo(cx - w * 0.08, h * 0.175, cx - w * 0.02, h * 0.17, cx - w * 0.02, h * 0.155);
  ctx.bezierCurveTo(cx - w * 0.02, h * 0.145, cx - w * 0.045, h * 0.14, cx - w * 0.055, h * 0.11);
  ctx.bezierCurveTo(cx - w * 0.065, h * 0.07, cx - w * 0.06, h * 0.02, cx, h * 0.02);

  ctx.closePath();

  // Fill with subtle inner gradient
  const bodyGrad = ctx.createLinearGradient(cx, h * 0.02, cx, h * 0.95);
  bodyGrad.addColorStop(0, 'rgba(99, 102, 241, 0.04)');
  bodyGrad.addColorStop(0.3, 'rgba(45, 212, 191, 0.03)');
  bodyGrad.addColorStop(0.7, 'rgba(99, 102, 241, 0.025)');
  bodyGrad.addColorStop(1, 'rgba(45, 212, 191, 0.02)');
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Outline
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.10)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Second, softer outline for depth
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.04)';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.restore();
}

// Draw energy flowing along a meridian path
function drawMeridian(
  ctx: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  w: number, h: number,
  intensity: number,
  time: number,
) {
  const x1 = from.x * w, y1 = from.y * h;
  const x2 = to.x * w, y2 = to.y * h;

  // Curved path with control point offset
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const cpx = mx + dy * 0.15;
  const cpy = my - dx * 0.15;

  const alpha = intensity * 0.08;
  if (alpha < 0.005) return;

  ctx.save();
  ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
  ctx.lineWidth = 0.5 + intensity * 0.5;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.quadraticCurveTo(cpx, cpy, x2, y2);
  ctx.stroke();
  ctx.restore();
}

// Draw a single flowing particle
function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: Particle,
  w: number, h: number,
  frame: TwinFrame | null,
) {
  const [fromId, toId] = MERIDIANS[p.meridian];
  const from = REGION_POSITIONS[fromId];
  const to = REGION_POSITIONS[toId];
  if (!from || !to) return;

  const x1 = from.x * w, y1 = from.y * h;
  const x2 = to.x * w, y2 = to.y * h;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const dx = x2 - x1, dy = y2 - y1;
  const cpx = mx + dy * 0.15, cpy = my - dx * 0.15;

  // Quadratic bezier position at t
  const t = p.t;
  const it = 1 - t;
  const px = it * it * x1 + 2 * it * t * cpx + t * t * x2;
  const py = it * it * y1 + 2 * it * t * cpy + t * t * y2;

  // Color adapts to the region state it's flowing through
  let [r, g, b] = p.color;
  if (frame) {
    const nearId = t < 0.5 ? fromId : toId;
    const region = frame.regions.find(reg => reg.id === nearId);
    if (region) {
      const [cr, cg, cb] = region.color;
      r = cr * 255; g = cg * 255; b = cb * 255;
    }
  }

  // Soft glow
  const fadeAlpha = p.alpha * Math.sin(t * Math.PI);
  const grad = ctx.createRadialGradient(px, py, 0, px, py, p.size * 3);
  grad.addColorStop(0, `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${fadeAlpha * 0.6})`);
  grad.addColorStop(0.5, `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${fadeAlpha * 0.15})`);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(px, py, p.size * 3, 0, Math.PI * 2);
  ctx.fill();

  // Bright core
  ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${fadeAlpha * 0.9})`;
  ctx.beginPath();
  ctx.arc(px, py, p.size * 0.6, 0, Math.PI * 2);
  ctx.fill();
}

// Draw a region as a soft organic glow
function drawRegionGlow(
  ctx: CanvasRenderingContext2D,
  region: RegionState,
  w: number, h: number,
  time: number,
) {
  const pos = REGION_POSITIONS[region.id];
  if (!pos) return;

  const cx = pos.x * w;
  const cy = pos.y * h;
  const baseRx = pos.rx * w;
  const baseRy = pos.ry * h;

  const [r, g, b, a] = region.color;
  const ri = Math.round(r * 255), gi = Math.round(g * 255), bi = Math.round(b * 255);
  const alpha = a * region.confidence;

  // Breathing pulse per region
  const pulse = Math.sin(time * region.pulse_rate * 0.001) * 0.5 + 0.5;
  const rx = baseRx * (1.0 + pulse * 0.15);
  const ry = baseRy * (1.0 + pulse * 0.15);

  if (region.glow_intensity < 0.02) return;

  // Outer halo
  const haloR = Math.max(rx, ry) * (2.0 + pulse * 0.5) * region.glow_intensity;
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
  halo.addColorStop(0, `rgba(${ri}, ${gi}, ${bi}, ${alpha * 0.20 * (0.7 + pulse * 0.3)})`);
  halo.addColorStop(0.3, `rgba(${ri}, ${gi}, ${bi}, ${alpha * 0.08})`);
  halo.addColorStop(0.6, `rgba(${ri}, ${gi}, ${bi}, ${alpha * 0.02})`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.save();
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.ellipse(cx, cy, haloR, haloR * (ry / Math.max(rx, 0.01)), 0, 0, Math.PI * 2);
  ctx.fill();

  // Inner core — soft, not hard-edged
  const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
  coreGrad.addColorStop(0, `rgba(${ri}, ${gi}, ${bi}, ${alpha * 0.35 * (0.8 + pulse * 0.2)})`);
  coreGrad.addColorStop(0.6, `rgba(${ri}, ${gi}, ${bi}, ${alpha * 0.10})`);
  coreGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = coreGrad;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 1.2, ry * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bright center point for key organs
  if (['heart', 'brain', 'lungs', 'gut', 'liver'].includes(region.id) && region.heat > 0.3) {
    const sparkAlpha = alpha * 0.5 * (0.6 + pulse * 0.4);
    ctx.fillStyle = `rgba(255, 255, 255, ${sparkAlpha * 0.3})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 2 + pulse * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function BodyRenderer({ snapshotJson, protocolsJson, projectionWeeks = 0, mode = 'current', className, onRegionHover }: BodyRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<TwinFrame | null>(null);
  const animRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>(createParticles(60));
  const [wasmReady, setWasmReady] = useState(false);
  const wasmRef = useRef<any>(null);
  const [hoveredRegion, setHoveredRegion] = useState<RegionState | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTwinWasm().then((wasm) => {
      if (!cancelled) { wasmRef.current = wasm; setWasmReady(true); }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!snapshotJson) { frameRef.current = null; return; }
    const wasm = wasmRef.current;

    if (mode === 'projection' && wasm?.compute_protocol_projection && protocolsJson) {
      try {
        const cohortJson = JSON.stringify({ median_response: 0.6 });
        const frameJson = wasm.compute_protocol_projection(snapshotJson, protocolsJson, cohortJson, projectionWeeks, Date.now());
        frameRef.current = JSON.parse(frameJson);
        return;
      } catch { /* fall through */ }
    }

    if (wasm?.map_signals_to_regions && wasm?.compute_twin_frame) {
      const signals = wasm.map_signals_to_regions(snapshotJson);
      try { frameRef.current = JSON.parse(wasm.compute_twin_frame(signals, Date.now())); } catch { frameRef.current = null; }
    } else {
      try {
        const snap = JSON.parse(snapshotJson);
        const p = snap.p_score ?? 0.3;
        const c = snap.c_score ?? 0.5;
        const regions = Object.keys(REGION_POSITIONS).map(id => {
          const heat = p * (0.5 + Math.random() * 0.5);
          const recovery = (1 - p) * (0.6 + Math.random() * 0.4);
          return {
            id, heat, recovery,
            pulse_rate: 0.5 + heat * 2,
            glow_intensity: 0.3 + heat * c * 0.7,
            color: [
              heat > 0.5 ? 0.95 : 0.18, heat > 0.5 ? 0.44 : 0.83, heat > 0.5 ? 0.40 : 0.75,
              0.6 + heat * 0.4,
            ] as [number, number, number, number],
            trend_arrow: 0, confidence: Math.max(c, 0.4),
            label: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          };
        });
        frameRef.current = { timestamp: Date.now(), regions, global_recovery: 1 - p, global_stress: p, dominant_system: 'heart' };
      } catch { frameRef.current = null; }
    }
  }, [snapshotJson, protocolsJson, projectionWeeks, mode, wasmReady]);

  const render = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);

    const breath = Math.sin(time * 0.0008);

    // 1. Body silhouette with breathing
    drawBody(ctx, w, h, breath);

    const frame = frameRef.current;
    if (frame) {
      // 2. Meridian lines (chi paths)
      for (const [fromId, toId] of MERIDIANS) {
        const from = REGION_POSITIONS[fromId];
        const to = REGION_POSITIONS[toId];
        if (!from || !to) continue;
        const fromR = frame.regions.find(r => r.id === fromId);
        const toR = frame.regions.find(r => r.id === toId);
        const intensity = ((fromR?.heat ?? 0) + (toR?.heat ?? 0)) / 2;
        drawMeridian(ctx, from, to, w, h, intensity + 0.2, time);
      }

      // 3. Region glows — layered, back to front
      const drawOrder = [
        'skin', 'spine', 'upper_body', 'lower_body',
        'lungs', 'liver', 'gut', 'kidneys',
        'heart', 'brain', 'thyroid', 'adrenals',
        'reproductive', 'joints', 'blood', 'immune',
      ];
      for (const id of drawOrder) {
        const region = frame.regions.find(r => r.id === id);
        if (region) drawRegionGlow(ctx, region, w, h, time);
      }

      // 4. Flowing particles — chi energy
      const particles = particlesRef.current;
      for (const p of particles) {
        p.t += p.speed * (1 + (frame.global_stress * 0.5));
        if (p.t > 1) {
          p.t = 0;
          p.meridian = Math.floor(Math.random() * MERIDIANS.length);
          p.speed = 0.0003 + Math.random() * 0.0008;
          p.alpha = 0.2 + Math.random() * 0.5;

          // Recovery = teal, stress = coral/amber
          if (frame.global_recovery > 0.6) {
            p.color = [45, 212, 191];
          } else if (frame.global_stress > 0.7) {
            p.color = [249, 112, 102];
          } else {
            p.color = [167, 139, 250];
          }
        }
        drawParticle(ctx, p, w, h, frame);
      }
    }

    animRef.current = requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [render]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !frameRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;

    let closest: RegionState | null = null;
    let closestDist = 0.06;

    for (const region of frameRef.current.regions) {
      const pos = REGION_POSITIONS[region.id];
      if (!pos) continue;
      const dx = (mx - pos.x) / pos.rx;
      const dy = (my - pos.y) / pos.ry;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1.2 && dist < closestDist) { closestDist = dist; closest = region; }
    }
    setHoveredRegion(closest);
    onRegionHover?.(closest);
  }, [onRegionHover]);

  return (
    <div className={`relative ${className || ''}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHoveredRegion(null); onRegionHover?.(null); }}
      />
      {hoveredRegion && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gravity-bg/90 backdrop-blur-md border border-gravity-border/50 rounded-xl px-5 py-3 text-center pointer-events-none animate-fade-in">
          <p className="text-xs font-medium text-gravity-text tracking-wide">{hoveredRegion.label}</p>
          <div className="flex gap-5 mt-1.5 text-[10px]">
            <span className="text-gravity-text-secondary">Stress <span className="text-health-coral font-mono font-medium">{Math.round(hoveredRegion.heat * 100)}%</span></span>
            <span className="text-gravity-text-secondary">Recovery <span className="text-health-teal font-mono font-medium">{Math.round(hoveredRegion.recovery * 100)}%</span></span>
          </div>
        </div>
      )}
      {frameRef.current && (
        <div className="absolute top-3 right-3 text-[10px] text-gravity-text-whisper/60 font-mono flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full animate-pulse-soft ${mode === 'projection' ? 'bg-gravity-accent-warm' : 'bg-health-teal'}`} />
          {mode === 'projection' ? `+${projectionWeeks}w` : 'live'}
        </div>
      )}
    </div>
  );
}
