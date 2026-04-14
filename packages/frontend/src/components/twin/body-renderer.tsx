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

interface ProtocolInput {
  id: string;
  started_weeks_ago: number;
  onset_weeks: number;
  peak_weeks: number;
  target_domains: string[];
  max_effect?: number;
}

interface BodyRendererProps {
  snapshotJson?: string;
  protocolsJson?: string;
  projectionWeeks?: number;
  mode?: TwinMode;
  className?: string;
  onRegionHover?: (region: RegionState | null) => void;
}

// Body region positions (normalized 0-1 coordinate space on a human silhouette)
const REGION_POSITIONS: Record<string, { x: number; y: number; rx: number; ry: number }> = {
  brain:        { x: 0.50, y: 0.08, rx: 0.07, ry: 0.05 },
  thyroid:      { x: 0.50, y: 0.18, rx: 0.03, ry: 0.02 },
  lungs:        { x: 0.50, y: 0.30, rx: 0.12, ry: 0.07 },
  heart:        { x: 0.44, y: 0.32, rx: 0.04, ry: 0.04 },
  liver:        { x: 0.40, y: 0.42, rx: 0.06, ry: 0.04 },
  adrenals:     { x: 0.50, y: 0.43, rx: 0.03, ry: 0.02 },
  gut:          { x: 0.50, y: 0.50, rx: 0.08, ry: 0.06 },
  kidneys:      { x: 0.58, y: 0.43, rx: 0.04, ry: 0.03 },
  reproductive: { x: 0.50, y: 0.58, rx: 0.04, ry: 0.03 },
  spine:        { x: 0.50, y: 0.40, rx: 0.02, ry: 0.15 },
  upper_body:   { x: 0.50, y: 0.28, rx: 0.18, ry: 0.10 },
  lower_body:   { x: 0.50, y: 0.72, rx: 0.10, ry: 0.14 },
  joints:       { x: 0.50, y: 0.62, rx: 0.14, ry: 0.04 },
  skin:         { x: 0.50, y: 0.50, rx: 0.22, ry: 0.35 },
  blood:        { x: 0.55, y: 0.35, rx: 0.03, ry: 0.03 },
  immune:       { x: 0.45, y: 0.48, rx: 0.03, ry: 0.03 },
};

// Draw stylized human silhouette
function drawSilhouette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const cx = w / 2;
  ctx.save();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.12)';
  ctx.lineWidth = 1.5;
  ctx.fillStyle = 'rgba(99, 102, 241, 0.03)';

  ctx.beginPath();
  // Head
  ctx.ellipse(cx, h * 0.08, w * 0.055, h * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Neck
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.02, h * 0.13);
  ctx.lineTo(cx + w * 0.02, h * 0.13);
  ctx.lineTo(cx + w * 0.02, h * 0.17);
  ctx.lineTo(cx - w * 0.02, h * 0.17);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Torso
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.15, h * 0.19);
  ctx.quadraticCurveTo(cx - w * 0.17, h * 0.35, cx - w * 0.10, h * 0.55);
  ctx.lineTo(cx - w * 0.08, h * 0.60);
  ctx.lineTo(cx + w * 0.08, h * 0.60);
  ctx.lineTo(cx + w * 0.10, h * 0.55);
  ctx.quadraticCurveTo(cx + w * 0.17, h * 0.35, cx + w * 0.15, h * 0.19);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Arms
  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sign * w * 0.15, h * 0.20);
    ctx.quadraticCurveTo(cx + sign * w * 0.22, h * 0.35, cx + sign * w * 0.20, h * 0.50);
    ctx.quadraticCurveTo(cx + sign * w * 0.19, h * 0.55, cx + sign * w * 0.18, h * 0.50);
    ctx.quadraticCurveTo(cx + sign * w * 0.18, h * 0.35, cx + sign * w * 0.13, h * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Legs
  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + sign * w * 0.06, h * 0.60);
    ctx.quadraticCurveTo(cx + sign * w * 0.08, h * 0.75, cx + sign * w * 0.07, h * 0.92);
    ctx.lineTo(cx + sign * w * 0.03, h * 0.92);
    ctx.quadraticCurveTo(cx + sign * w * 0.02, h * 0.75, cx + sign * w * 0.01, h * 0.60);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

function drawRegion(
  ctx: CanvasRenderingContext2D,
  region: RegionState,
  w: number,
  h: number,
  time: number,
) {
  const pos = REGION_POSITIONS[region.id];
  if (!pos) return;

  const cx = pos.x * w;
  const cy = pos.y * h;
  const rx = pos.rx * w;
  const ry = pos.ry * h;

  const [r, g, b, a] = region.color;
  const alpha = a * region.confidence;

  // Pulsing glow
  const pulsePhase = Math.sin(time * region.pulse_rate * 0.001) * 0.5 + 0.5;
  const glowRadius = rx * (1.5 + pulsePhase * 0.8) * region.glow_intensity;

  if (region.glow_intensity > 0.05) {
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
    gradient.addColorStop(0, `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha * 0.35 * (0.7 + pulsePhase * 0.3)})`);
    gradient.addColorStop(0.5, `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha * 0.12})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(cx, cy, glowRadius, glowRadius * (ry / rx), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Core region fill
  ctx.save();
  ctx.globalAlpha = alpha * (0.5 + pulsePhase * 0.15);
  ctx.fillStyle = `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // Border
  ctx.strokeStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${alpha * 0.6})`;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

export function BodyRenderer({ snapshotJson, protocolsJson, projectionWeeks = 0, mode = 'current', className, onRegionHover }: BodyRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<TwinFrame | null>(null);
  const animRef = useRef<number>(0);
  const [wasmReady, setWasmReady] = useState(false);
  const wasmRef = useRef<any>(null);
  const [hoveredRegion, setHoveredRegion] = useState<RegionState | null>(null);

  // Load WASM
  useEffect(() => {
    let cancelled = false;
    loadTwinWasm().then((wasm) => {
      if (!cancelled) {
        wasmRef.current = wasm;
        setWasmReady(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Compute frame when snapshot or mode changes
  useEffect(() => {
    if (!snapshotJson) {
      frameRef.current = null;
      return;
    }

    const wasm = wasmRef.current;

    // Protocol projection mode — use the new WASM function
    if (mode === 'projection' && wasm?.compute_protocol_projection && protocolsJson) {
      try {
        const cohortJson = JSON.stringify({ median_response: 0.6 });
        const frameJson = wasm.compute_protocol_projection(snapshotJson, protocolsJson, cohortJson, projectionWeeks, Date.now());
        frameRef.current = JSON.parse(frameJson);
        return;
      } catch {
        // fall through to current mode
      }
    }

    // Current state mode
    if (wasm?.map_signals_to_regions && wasm?.compute_twin_frame) {
      const signals = wasm.map_signals_to_regions(snapshotJson);
      const frameJson = wasm.compute_twin_frame(signals, Date.now());
      try {
        frameRef.current = JSON.parse(frameJson);
      } catch {
        frameRef.current = null;
      }
    } else {
      // JS fallback
      try {
        const snap = JSON.parse(snapshotJson);
        const p = snap.p_score ?? 0.3;
        const c = snap.c_score ?? 0.5;
        const regions = Object.keys(REGION_POSITIONS).map(id => {
          const heat = p * (0.5 + Math.random() * 0.5);
          const recovery = (1 - p) * (0.6 + Math.random() * 0.4);
          return {
            id,
            heat,
            recovery,
            pulse_rate: 0.5 + heat * 2,
            glow_intensity: heat * c,
            color: [
              heat > 0.5 ? 0.9 : 0.3,
              heat > 0.5 ? 0.5 : 0.75,
              heat > 0.5 ? 0.3 : 0.65,
              0.6 + heat * 0.4,
            ] as [number, number, number, number],
            trend_arrow: 0,
            confidence: c,
            label: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          };
        });
        frameRef.current = {
          timestamp: Date.now(),
          regions,
          global_recovery: 1 - p,
          global_stress: p,
          dominant_system: 'heart',
        };
      } catch {
        frameRef.current = null;
      }
    }
  }, [snapshotJson, protocolsJson, projectionWeeks, mode, wasmReady]);

  // Animation loop
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

    drawSilhouette(ctx, w, h);

    const frame = frameRef.current;
    if (frame) {
      // Draw skin layer first (largest, most transparent)
      const skinRegion = frame.regions.find(r => r.id === 'skin');
      if (skinRegion) drawRegion(ctx, skinRegion, w, h, time);

      // Then organs, from back to front
      const drawOrder = [
        'spine', 'upper_body', 'lower_body',
        'lungs', 'liver', 'gut', 'kidneys',
        'heart', 'brain', 'thyroid', 'adrenals',
        'reproductive', 'joints', 'blood', 'immune',
      ];
      for (const id of drawOrder) {
        const region = frame.regions.find(r => r.id === id);
        if (region) drawRegion(ctx, region, w, h, time);
      }
    }

    animRef.current = requestAnimationFrame(render);
  }, []);

  useEffect(() => {
    animRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animRef.current);
  }, [render]);

  // Hit testing for hover
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !frameRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;

    let closest: RegionState | null = null;
    let closestDist = 0.05;

    for (const region of frameRef.current.regions) {
      const pos = REGION_POSITIONS[region.id];
      if (!pos) continue;
      const dx = (mx - pos.x) / pos.rx;
      const dy = (my - pos.y) / pos.ry;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1 && dist < closestDist) {
        closestDist = dist;
        closest = region;
      }
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
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gravity-elevated/95 backdrop-blur-sm border border-gravity-border rounded-lg px-4 py-2.5 text-center pointer-events-none animate-fade-in">
          <p className="text-xs font-semibold text-gravity-text">{hoveredRegion.label}</p>
          <div className="flex gap-4 mt-1 text-[10px] text-gravity-text-secondary">
            <span>Stress: <span className="text-health-coral font-mono">{Math.round(hoveredRegion.heat * 100)}%</span></span>
            <span>Recovery: <span className="text-health-teal font-mono">{Math.round(hoveredRegion.recovery * 100)}%</span></span>
          </div>
        </div>
      )}
      {frameRef.current && (
        <div className="absolute top-3 right-3 text-[10px] text-gravity-text-whisper font-mono flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full animate-pulse-soft ${mode === 'projection' ? 'bg-gravity-accent-warm' : 'bg-health-teal'}`} />
          {mode === 'projection' ? `WASM Projection +${projectionWeeks}w` : 'WASM Twin'}
        </div>
      )}
    </div>
  );
}
