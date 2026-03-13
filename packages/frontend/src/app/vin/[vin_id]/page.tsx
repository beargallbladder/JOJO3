'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useVin } from '@/hooks/use-vin';
import { useVoicePreload } from '@/hooks/use-voice-preload';
import { HeroRiskCard } from '@/components/vin/hero-risk-card';
import { PillarConstellation } from '@/components/vin/pillar-constellation';
import { PlaybackTimeline } from '@/components/vin/playback-timeline';
import { GovernancePanel } from '@/components/vin/governance-panel';
import { ScheduleDrawer } from '@/components/schedule/schedule-drawer';
import { VoiceOverlay } from '@/components/voice/voice-overlay';
import { VoiceTrigger } from '@/components/voice/voice-trigger';
import { Header } from '@/components/layout/header';
import { fadeInUp } from '@/lib/motion';

export default function VinDetailPage() {
  const { vin_id } = useParams<{ vin_id: string }>();
  const { data, isLoading, error } = useVin(vin_id);
  useVoicePreload('vin', vin_id);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="h-64 bg-gravity-surface rounded-xl animate-shimmer shimmer-bg" />
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Header />
        <div className="max-w-7xl mx-auto px-6 py-8 text-center">
          <p className="text-gravity-text-secondary">VIN not found or failed to load.</p>
          <Link href="/leads" className="text-gravity-accent text-sm mt-2 inline-block hover:underline">
            Back to leads
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-gravity-text-whisper mb-6">
          <Link href="/leads" className="hover:text-gravity-text transition-colors">Command Board</Link>
          <span>/</span>
          <span className="text-gravity-text-secondary font-mono">{data.vin.vin_code}</span>
        </div>

        {/* Hero risk card */}
        <motion.div {...fadeInUp}>
          <HeroRiskCard vin={data.vin} />
        </motion.div>

        {/* Two column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          {/* Left: Constellation + Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-6"
          >
            <div className="bg-gravity-surface border border-gravity-border rounded-xl p-6">
              <PillarConstellation pillars={data.pillars} />
            </div>
            <div className="bg-gravity-surface border border-gravity-border rounded-xl p-6">
              <PlaybackTimeline timeline={data.timeline} />
            </div>
          </motion.div>

          {/* Right: Governance + Schedule CTA */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-6"
          >
            <div className="bg-gravity-surface border border-gravity-border rounded-xl p-6">
              <GovernancePanel vin={data.vin} governance={data.governance} suggestion={data.service_suggestion} sortContext={data.sort_context || null} />
            </div>

            {/* Schedule CTA */}
            {data.service_suggestion?.recommended && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-gravity-surface border border-gravity-accent/20 rounded-xl p-6"
              >
                <div className="text-[10px] font-semibold uppercase tracking-widest text-gravity-accent mb-2">
                  Ready to Schedule
                </div>
                <p className="text-sm text-gravity-text-secondary mb-4">
                  This vehicle qualifies for service scheduling. Find the nearest dealer and available time slots.
                </p>
                <button
                  onClick={() => setDrawerOpen(true)}
                  className="w-full py-3 bg-gravity-accent hover:bg-gravity-accent/90 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Schedule Service
                </button>
              </motion.div>
            )}
          </motion.div>
        </div>
      </main>

      {/* Schedule Drawer */}
      <ScheduleDrawer open={drawerOpen} onOpenChange={setDrawerOpen} vin={data.vin} />

      {/* Voice */}
      <VoiceTrigger onClick={() => setVoiceOpen(true)} mode="vin" />
      <VoiceOverlay open={voiceOpen} onClose={() => setVoiceOpen(false)} scope="vin" vinId={vin_id} />
    </>
  );
}
