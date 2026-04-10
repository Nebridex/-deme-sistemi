'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { canViewDashboard } from '@/lib/domain/permissions';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, user, error } = useAdminAuth();

  useEffect(() => {
    if (!loading && !error && !canViewDashboard(user)) router.replace('/admin/login');
  }, [loading, user, error, router]);

  if (loading) return <div className="p-6 text-center text-slate-600">Initializing admin session...</div>;
  if (error) return <div className="p-6 text-center text-rose-700">{error}</div>;
  if (!canViewDashboard(user)) return null;

  return <>{children}</>;
}
