'use client';

import { useQuery } from '@tanstack/react-query';
import { healthApi } from '@/lib/health-api';

export function useSubjects(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['subjects', params],
    queryFn: () => healthApi.subjects(params),
  });
}

export function useSubject(id: string) {
  return useQuery({
    queryKey: ['subject', id],
    queryFn: () => healthApi.subject(id),
    enabled: !!id,
  });
}

export function useSignals(subjectId: string, params?: Record<string, string>) {
  return useQuery({
    queryKey: ['signals', subjectId, params],
    queryFn: () => healthApi.signals(subjectId, params),
    enabled: !!subjectId,
  });
}

export function useSnapshots(subjectId: string, params?: Record<string, string>) {
  return useQuery({
    queryKey: ['snapshots', subjectId, params],
    queryFn: () => healthApi.snapshots(subjectId, params),
    enabled: !!subjectId,
  });
}

export function useOrgStats() {
  return useQuery({
    queryKey: ['org-stats'],
    queryFn: () => healthApi.orgStats(),
  });
}

export function useProtocols() {
  return useQuery({
    queryKey: ['protocols'],
    queryFn: () => healthApi.protocols(),
    staleTime: 5 * 60_000,
  });
}

export function useIntelligence(subjectId: string) {
  return useQuery({
    queryKey: ['intelligence', subjectId],
    queryFn: () => healthApi.intelligence(subjectId),
    enabled: !!subjectId,
  });
}
