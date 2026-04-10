'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, isAuthenticated } = useAdminAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/admin/login');
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return <div className="p-6 text-center text-slate-600">Checking authentication...</div>;
  }

  if (!isAuthenticated) return null;

  return <>{children}</>;
}
