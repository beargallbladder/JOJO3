'use client';

import { motion } from 'framer-motion';
import { PillarNode } from './pillar-node';
import { polygonPoints } from '@/lib/pillar-geometry';
import type { PillarEvent } from '@gravity/shared';

const PILLAR_META: Record<string, { label: string; letter: string; source: string }> = {
  short_trip_density: { label: 'Short Trips', letter: 'A', source: 'Vehicle telematics' },
  ota_stress: { label: 'Software Updates', letter: 'B', source: 'OTA servers' },
  cold_soak: { label: 'Cold Weather', letter: 'C', source: 'Vehicle sensors' },
  cranking_degradation: { label: 'Starting Health', letter: 'D', source: 'Onboard diagnostics' },
  hmi_reset: { label: 'Driver Reset', letter: 'E', source: 'HMI event log' },
  service_record: { label: 'Dealer Service', letter: 'F', source: 'Dealer management system' },
  parts_purchase: { label: 'Parts Purchased', letter: 'G', source: 'Parts commerce / aftermarket' },
  cohort_prior: { label: 'Fleet Pattern', letter: 'H', source: 'Fleet analytics (millions of VINs)' },
};

const STATE_LABELS: Record<string, { label: string; desc: string }> = {
  present: { label: 'Corroborating', desc: 'Evidence received and supports the assessment' },
  absent: { label: 'Expected but missing', desc: 'Window closed without expected signal — reduces confidence' },
  unknown: { label: 'Not yet received', desc: 'Waiting for data — could arrive async and change the picture' },
};

interface PillarConstellationProps {
  pillars: PillarEvent[];
  className?: string;
}

export function PillarConstellation({ pillars, className }: PillarConstellationProps) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 100;

  const pillarNames = [...new Set(pillars.map(p => p.pillar_name))];
  const nodeCount = Math.max(pillarNames.length, 5);
  const points = polygonPoints(nodeCount, radius, cx, cy);

  const latestStates: Record<string, PillarEvent> = {};
  for (const p of pillars) {
    if (!latestStates[p.pillar_name] || p.occurred_at > latestStates[p.pillar_name].occurred_at) {
      latestStates[p.pillar_name] = p;
    }
  }

  const present = pillarNames.filter(n => latestStates[n]?.pillar_state === 'present');
  const absent = pillarNames.filter(n => latestStates[n]?.pillar_state === 'absent');
  const unknown = pillarNames.filter(n => !latestStates[n] || latestStates[n]?.pillar_state === 'unknown');
  const total = pillarNames.length;

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + ' Z';

  return (
    <div className={className}>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper mb-1">
        Evidence Triangulation
      </div>
      <p className="text-[11px] text-gravity-text-secondary mb-4">
        Each signal comes from a different connected data source. When signals agree, confidence rises. When expected signals are missing, confidence drops. New evidence — a dealer repair order, a parts purchase, a telemetry update — can arrive at any time and change this picture.
      </p>

      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <motion.path
          d={pathD}
          fill="none"
          stroke="#1E2330"
          strokeWidth={1}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        />

        {points.map((p, i) => (
          <line key={`line-${i}`} x1={cx} y1={cy} x2={p[0]} y2={p[1]} stroke="#1E2330" strokeWidth={0.5} opacity={0.5} />
        ))}

        <circle cx={cx} cy={cy} r={3} fill="#6B7280" opacity={0.6} />

        {pillarNames.map((name, i) => {
          const point = points[i] || [cx, cy];
          const meta = PILLAR_META[name];
          const latest = latestStates[name];
          return (
            <PillarNode
              key={name}
              name={name}
              label={meta ? `${meta.letter} ${meta.label}` : name}
              state={latest?.pillar_state || 'unknown'}
              x={point[0]}
              y={point[1]}
              color="#8B92A5"
            />
          );
        })}
      </svg>

      {/* Evidence summary */}
      <div className="mt-4 space-y-2">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
          <span className="text-gravity-text-secondary">
            <span className="text-gravity-text font-medium">{present.length} of {total} signals corroborating</span>
            {present.length > 0 && <span> — {present.map(n => PILLAR_META[n]?.label || n).join(', ')}</span>}
          </span>
        </div>
        {absent.length > 0 && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
            <span className="text-gravity-text-secondary">
              <span className="text-gravity-text font-medium">{absent.length} expected but missing</span>
              <span> — {absent.map(n => PILLAR_META[n]?.label || n).join(', ')}</span>
              <span className="text-gravity-text-whisper"> (reduces confidence)</span>
            </span>
          </div>
        )}
        {unknown.length > 0 && (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0" />
            <span className="text-gravity-text-secondary">
              <span className="text-gravity-text font-medium">{unknown.length} awaiting data</span>
              <span> — {unknown.map(n => PILLAR_META[n]?.label || n).join(', ')}</span>
              <span className="text-gravity-text-whisper"> (could arrive and change assessment)</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
