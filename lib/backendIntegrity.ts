'use client';

import type {
  RecomputeTableAggregatesInput,
  RotatePublicTokenInput,
  SyncPublicTableProjectionInput
} from '@/lib/domain/backendContracts';

export async function callBackendRecomputeTableAggregates(input: RecomputeTableAggregatesInput): Promise<boolean> {
  void input;
  return false;
}

export async function callBackendSyncPublicProjection(input: SyncPublicTableProjectionInput): Promise<boolean> {
  void input;
  return false;
}

export async function callBackendRotatePublicToken(input: RotatePublicTokenInput): Promise<string | null> {
  void input;
  return null;
}
