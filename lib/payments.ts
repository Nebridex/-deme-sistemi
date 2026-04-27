'use client';

import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { assertFirebaseConfigured } from '@/lib/firebase';
import type { Payment, SplitSession, TableSettlement } from '@/types';

const now = () => Date.now();

export async function createSplitSessionDraft(input: Omit<SplitSession, 'id' | 'createdAt' | 'updatedAt' | 'status'>) {
  const { db } = assertFirebaseConfigured();
  const payload: Omit<SplitSession, 'id'> = {
    ...input,
    status: 'draft',
    createdAt: now(),
    updatedAt: now()
  };
  await addDoc(collection(db, 'splitSessions'), payload);
}

export async function createManualPaymentDraft(input: Omit<Payment, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'provider'>) {
  const { db } = assertFirebaseConfigured();
  const payload: Omit<Payment, 'id'> = {
    ...input,
    status: 'pending',
    provider: 'manual',
    createdAt: now(),
    updatedAt: now()
  };
  await addDoc(collection(db, 'payments'), payload);
}

export async function upsertTableSettlementDraft(input: Omit<TableSettlement, 'id' | 'createdAt' | 'updatedAt'>) {
  const { db } = assertFirebaseConfigured();
  await setDoc(
    doc(db, 'tableSettlements', `${input.cafeId}_${input.tableId}`),
    { ...input, createdAt: now(), updatedAt: now(), serverUpdatedAt: serverTimestamp() },
    { merge: true }
  );
}
