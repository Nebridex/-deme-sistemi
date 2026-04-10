'use client';

import { useEffect, useState } from 'react';
import { subscribeAdminAuth } from '@/lib/auth';

export function useAdminAuth() {
  const [user, setUser] = useState<null | { email?: string }>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeAdminAuth((nextUser) => {
      setUser(nextUser ? { email: nextUser.email ?? undefined } : null);
      setLoading(false);
    });

    return () => unsub?.();
  }, []);

  return { user, loading, isAuthenticated: Boolean(user) };
}
