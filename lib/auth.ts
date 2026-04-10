'use client';

import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/lib/firebase';
import { getMockAuthState, setMockAuthState } from '@/lib/mockStore';

export function subscribeAdminAuth(callback: (user: User | null | { email: string }) => void) {
  if (!isFirebaseConfigured || !auth) {
    const emit = () => callback(getMockAuthState() ? { email: 'demo@cafe.com' } : null);
    emit();
    window.addEventListener('mock-db-updated', emit);
    return () => window.removeEventListener('mock-db-updated', emit);
  }
  return onAuthStateChanged(auth, callback);
}

export async function adminLogin(email: string, password: string) {
  if (!isFirebaseConfigured || !auth) {
    if (email === 'demo@cafe.com' && password === 'admin123') {
      setMockAuthState(true);
      return;
    }
    throw new Error('Use demo@cafe.com / admin123 in mock mode.');
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
