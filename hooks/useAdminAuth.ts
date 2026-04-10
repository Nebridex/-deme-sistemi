'use client';

import { useEffect, useState } from 'react';
import { subscribeAdminAuth } from '@/lib/auth';
import { isFirebaseConfigured, firebaseConfigError } from '@/lib/firebase';
import type { AdminIdentity } from '@/types';

export function useAdminAuth() {
  const [user, setUser] = useState<AdminIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setError(firebaseConfigError ?? 'Firebase env is missing.');
      setLoading(false);
      return;
    }

    const unsub = subscribeAdminAuth(
      (nextUser) => {
        setUser(nextUser);
        setLoading(false);
      },
      (message) => {
        setError(message);
        setLoading(false);
      }
    );

    return () => unsub?.();
  }, []);

  return { user, loading, error, isAuthenticated: Boolean(user) };
}
