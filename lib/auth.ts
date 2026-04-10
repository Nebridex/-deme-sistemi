'use client';

import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/lib/firebase';
import { getMockAuthState, setMockAuthState } from '@/lib/mockStore';
import { DEFAULT_CAFE_ID } from '@/lib/domain/constants';
import type { AdminIdentity } from '@/types';

export function mapUserToIdentity(user: User | { email: string }): AdminIdentity {
  return {
    uid: 'uid' in user ? user.uid : 'demo-admin',
    email: user.email ?? 'demo@cafe.com',
    cafeId: DEFAULT_CAFE_ID,
    role: (user.email ?? '').includes('owner') ? 'owner' : 'manager'
  };
}

export function subscribeAdminAuth(callback: (user: AdminIdentity | null) => void) {
  if (!isFirebaseConfigured || !auth) {
    const emit = () => callback(getMockAuthState() ? mapUserToIdentity({ email: 'owner@cafe.com' }) : null);
    emit();
    window.addEventListener('mock-db-updated', emit);
    return () => window.removeEventListener('mock-db-updated', emit);
  }

  return onAuthStateChanged(auth, (user) => callback(user ? mapUserToIdentity(user) : null));
}

export async function adminLogin(email: string, password: string) {
  if (!isFirebaseConfigured || !auth) {
    if ((email === 'owner@cafe.com' || email === 'manager@cafe.com') && password === 'admin123') {
      setMockAuthState(true);
      return;
    }
    throw new Error('Use owner@cafe.com or manager@cafe.com with admin123 in demo mode.');
  }
  await signInWithEmailAndPassword(auth, email, password);
}

export async function adminLogout() {
  if (!isFirebaseConfigured || !auth) {
    setMockAuthState(false);
    return;
  }
  await signOut(auth);
}
