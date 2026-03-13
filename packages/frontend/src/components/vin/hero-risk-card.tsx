'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { riskColor, riskBandClass } from '@/lib/risk-color';
import { AnimatedScore } from './animated-score';
import { springs } from '@/lib/motion';
import type { Vin } from '@gravity/shared';

interface HeroRiskCardProps {
  vin: Vin;
}

const subsystemLabels: Record<string, string> = {
  battery_12v: 'Battery 12V',
  oil_maintenance: 'Oil Maintenance',
  brake_wear: 'Brake Wear',
};

const bandLabels: Record<string, { label: string; color: string }> = {
  ESCALATED: { label: 'Escalated — Action Required', color: '#EF4444' },
  MONITOR: { label: 'Monitoring — Accumulating Signal', color: '#EAB308' },
  SUPPRESSED: { label: 'Suppressed — Insufficient Evidence', color: '#6B7280' },
};

export function HeroRiskCard({ vin }: HeroRiskCardProps) {
  const pColor = riskColor(vin.posterior_p);
  const band = bandLabels[vin.governance_band] || bandLabels.SUPPRESSED;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springs.default}
      className="bg-gravity-surface border border-gravity-border rounded-xl p-8 relative overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-5"
        style={{ background: `radial-gradient(circle at 30% 50%, ${pColor}, transparent 70%)` }}
      />

      {/* Governance band banner */}
      <div className="relative mb-6 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: band.color }} />
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: band.color }}>
          {band.label}
        </span>
      </div>

      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper mb-2">
            Risk Level
          </div>
          <motion.div
            layoutId={`p-score-${vin.id}`}
            className={cn('font-mono text-[96px] font-extralight leading-none tracking-wide animate-breathe', riskBandClass(vin.risk_band))}
            style={{ color: pColor }}
          >
            <AnimatedScore value={vin.posterior_p} />
          </motion.div>
        </div>

        <div className="flex gap-8 mt-4">
          <div className="text-center">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper mb-1">
              Evidence
            </div>
            <div className="font-mono text-3xl font-light text-score-c">
              <AnimatedScore value={vin.posterior_c} />
            </div>
          </div>
          <div className="text-center">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper mb-1">
              Freshness
            </div>
            <div className="font-mono text-3xl font-light text-score-s">
              <AnimatedScore value={vin.posterior_s} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-gravity-border flex gap-8">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper">VIN</div>
          <div className="font-mono text-sm tracking-wide mt-0.5">{vin.vin_code}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper">Vehicle</div>
          <div className="text-sm mt-0.5">{vin.year} {vin.make} {vin.model} {vin.trim}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper">Subsystem</div>
          <div className="text-sm mt-0.5">{subsystemLabels[vin.subsystem] || vin.subsystem}</div>
        </div>
      </div>
    </motion.div>
  );
}
