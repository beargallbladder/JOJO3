'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { staggers } from '@/lib/motion';
import type { GovernanceAction, Vin, SortContext } from '@gravity/shared';
import type { ServiceSuggestion } from '@gravity/shared';

interface GovernancePanelProps {
  vin: Vin;
  governance: GovernanceAction[];
  suggestion: ServiceSuggestion | null;
  sortContext: SortContext | null;
}

const bandStyles: Record<string, { bg: string; border: string; text: string }> = {
  ESCALATED: { bg: 'bg-red-500/8', border: 'border-red-500/30', text: 'text-red-400' },
  MONITOR: { bg: 'bg-yellow-500/8', border: 'border-yellow-500/30', text: 'text-yellow-400' },
  SUPPRESSED: { bg: 'bg-gray-500/8', border: 'border-gray-500/30', text: 'text-gray-400' },
};

const actionIcons: Record<string, string> = {
  recommend_service: '→',
  hold: '⏸',
  escalate: '↑',
  suppress: '×',
};

export function GovernancePanel({ vin, governance, suggestion, sortContext }: GovernancePanelProps) {
  const band = vin.governance_band || 'SUPPRESSED';
  const reason = vin.governance_reason || '';
  const style = bandStyles[band] || bandStyles.SUPPRESSED;

  return (
    <div>
      {/* Governance gate */}
      <div className={cn('p-4 rounded-lg border mb-4', style.bg, style.border)}>
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper">
            Governance Band
          </div>
          <span className={cn('text-xs font-bold uppercase tracking-wider', style.text)}>
            {band}
          </span>
        </div>
        <p className="text-xs text-gravity-text-secondary font-mono">{reason}</p>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div>
            <div className="text-[10px] text-gravity-text-whisper uppercase tracking-widest">Risk</div>
            <div className="font-mono text-lg">{vin.posterior_p.toFixed(2)}</div>
            <div className="text-[9px] text-gravity-text-whisper">escalate at 0.85</div>
          </div>
          <div>
            <div className="text-[10px] text-gravity-text-whisper uppercase tracking-widest">Evidence</div>
            <div className="font-mono text-lg text-score-c">{vin.posterior_c.toFixed(2)}</div>
            <div className="text-[9px] text-gravity-text-whisper">need 0.70 to act</div>
          </div>
          <div>
            <div className="text-[10px] text-gravity-text-whisper uppercase tracking-widest">Freshness</div>
            <div className="font-mono text-lg text-score-s">{vin.posterior_s.toFixed(2)}</div>
            <div className="text-[9px] text-gravity-text-whisper">stale after 14d</div>
          </div>
        </div>
      </div>

      {/* Closed-loop explanation */}
      <div className="p-3 rounded-lg border border-gravity-border bg-gravity-surface mb-4">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper mb-2">
          What Can Change This
        </div>
        <p className="text-[11px] text-gravity-text-secondary mb-2">
          New evidence arrives asynchronously and updates the assessment in real time:
        </p>
        <div className="space-y-1.5 text-[11px]">
          <div className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5 shrink-0">+</span>
            <span className="text-gravity-text-secondary"><span className="text-gravity-text">Dealer repair order (RO)</span> — confirms or contradicts the risk, recalibrates fleet-wide priors</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5 shrink-0">+</span>
            <span className="text-gravity-text-secondary"><span className="text-gravity-text">Parts purchase</span> — oil filter, battery, brake pads tied to this VIN strengthen resolution confidence</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-green-400 mt-0.5 shrink-0">+</span>
            <span className="text-gravity-text-secondary"><span className="text-gravity-text">Telemetry normalization</span> — vehicle behavior returning to baseline after service</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5 shrink-0">~</span>
            <span className="text-gravity-text-secondary"><span className="text-gravity-text">Time passing without evidence</span> — confidence decays, eventually suppresses the signal</span>
          </div>
        </div>
      </div>

      {/* Operational priority */}
      {sortContext && (
        <div className="p-3 rounded-lg border border-gravity-border bg-gravity-surface mb-4">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper mb-2">
            Operational Priority
            {sortContext.stale && <span className="text-yellow-500 ml-2">DATA STALE</span>}
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[9px] text-gravity-text-whisper">Activity</div>
              <div className="font-mono text-sm">{sortContext.vas === -1 ? '—' : sortContext.vas}</div>
            </div>
            <div>
              <div className="text-[9px] text-gravity-text-whisper">Env Stress</div>
              <div className="font-mono text-sm">{sortContext.esc === -1 ? '—' : sortContext.esc}</div>
            </div>
            <div>
              <div className="text-[9px] text-gravity-text-whisper">Trip Stress</div>
              <div className="font-mono text-sm">{sortContext.tsi === -1 ? '—' : sortContext.tsi}</div>
            </div>
          </div>
        </div>
      )}

      {/* Service suggestion */}
      {suggestion && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'p-4 rounded-lg border mb-4',
            suggestion.urgency === 'immediate' && 'bg-red-500/5 border-red-500/20',
            suggestion.urgency === 'soon' && 'bg-yellow-500/5 border-yellow-500/20',
            suggestion.urgency === 'routine' && 'bg-gray-500/5 border-gray-500/20',
            suggestion.urgency === 'none' && 'bg-gravity-surface border-gravity-border',
          )}
        >
          <div className="text-[10px] font-semibold uppercase tracking-widest mb-1">
            Service {suggestion.recommended ? 'Recommended' : 'Not Required'}
          </div>
          <div className="text-sm text-gravity-text-secondary">{suggestion.reason}</div>
        </motion.div>
      )}

      {/* Governance actions */}
      <div className="text-[10px] font-semibold uppercase tracking-widest text-gravity-text-whisper mb-3">
        Decision Log
      </div>
      <div className="space-y-2">
        {governance.length === 0 && (
          <div className="text-sm text-gravity-text-whisper">No governance actions recorded.</div>
        )}
        {governance.map((action, i) => (
          <motion.div
            key={action.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * staggers.fast }}
            className="flex items-start gap-3 p-3 bg-gravity-surface rounded-lg border border-gravity-border"
          >
            <span className="text-lg leading-none mt-0.5">
              {actionIcons[action.action_type] || '•'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gravity-text">
                  {action.action_type.replace(/_/g, ' ')}
                </span>
                <span className="text-[10px] text-gravity-text-whisper font-mono">
                  {formatDate(action.created_at)}
                </span>
              </div>
              <p className="text-xs text-gravity-text-secondary mt-0.5">{action.reason}</p>
              <p className="text-[10px] text-gravity-text-whisper mt-1">Triggered by: {action.triggered_by}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
