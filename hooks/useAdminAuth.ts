'use client';

import { useEffect, useState } from 'react';
import { subscribeAdminAuth } from '@/lib/auth';
import type { AdminIdentity } from '@/types';

export function useAdminAuth() {
  const [user, setUser] = useState<AdminIdentity | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeAdminAuth((nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return () => unsub?.();
  }, []);

  return { user, loading, isAuthenticated: Boolean(user) };
}
