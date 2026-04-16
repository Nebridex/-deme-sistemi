'use client';

import { FirebaseError } from 'firebase/app';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import type {
  RecomputeTableAggregatesInput,
  RotatePublicTokenInput,
  SyncPublicTableProjectionInput
} from '@/lib/domain/backendContracts';

const NOT_READY_ERROR_CODES = new Set([
  'functions/unavailable',
  'functions/unimplemented',
  'functions/not-found',
  'functions/internal'
]);

function shouldFallbackToClient(err: unknown) {
  if (!(err instanceof FirebaseError)) return false;
  return NOT_READY_ERROR_CODES.has(err.code);
}

export async function callBackendRecomputeTableAggregates(input: RecomputeTableAggregatesInput): Promise<boolean> {
  if (!app) return false;
  try {
    const fn = httpsCallable<RecomputeTableAggregatesInput, { ok: boolean }>(getFunctions(app), 'recomputeTableAggregates');
    await fn(input);
    return true;
  } catch (err) {
    if (shouldFallbackToClient(err)) return false;
    throw err;
  }
}

export async function callBackendSyncPublicProjection(input: SyncPublicTableProjectionInput): Promise<boolean> {
  if (!app) return false;
  try {
    const fn = httpsCallable<SyncPublicTableProjectionInput, { ok: boolean }>(getFunctions(app), 'syncPublicTableProjection');
    await fn(input);
    return true;
  } catch (err) {
    if (shouldFallbackToClient(err)) return false;
    throw err;
  }
}

export async function callBackendRotatePublicToken(input: RotatePublicTokenInput): Promise<string | null> {
  if (!app) return null;
  try {
    const fn = httpsCallable<RotatePublicTokenInput, { publicToken: string }>(getFunctions(app), 'rotatePublicToken');
    const result = await fn(input);
    return result.data.publicToken;
  } catch (err) {
    if (shouldFallbackToClient(err)) return null;
    throw err;
  }
}
