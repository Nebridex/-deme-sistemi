'use client';

import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { assertFirebaseConfigured } from '@/lib/firebase';
import type { AdminIdentity, CafeUser } from '@/types';

async function buildIdentity(uid: string, email: string | null): Promise<AdminIdentity | null> {
  const { db } = assertFirebaseConfigured();
  const snap = await getDoc(doc(db, 'cafeUsers', uid));
  if (!snap.exists()) return null;
  const cafeUser = snap.data() as CafeUser;
  if (cafeUser.role !== 'owner' && cafeUser.role !== 'manager') return null;

  return {
    uid,
    email: email ?? cafeUser.email,
    cafeId: cafeUser.cafeId,
    role: cafeUser.role
  };
}

export function subscribeAdminAuth(callback: (user: AdminIdentity | null) => void, onError?: (message: string) => void) {
  const { auth } = assertFirebaseConfigured();

  return onAuthStateChanged(
    auth,
    async (user) => {
      try {
        if (!user) return callback(null);
        const identity = await buildIdentity(user.uid, user.email);
        callback(identity);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : 'Failed to initialize admin session.');
        callback(null);
      }
    },
    (err) => {
      onError?.(err.message || 'Auth listener failed.');
      callback(null);
    }
  );
}

export async function adminLogin(email: string, password: string) {
  const { auth } = assertFirebaseConfigured();
  await signInWithEmailAndPassword(auth, email, password);
}

export async function adminLogout() {
  const { auth } = assertFirebaseConfigured();
  await signOut(auth);
}
