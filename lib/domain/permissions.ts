import type { AdminIdentity } from '@/types';

export function canManageTables(user: AdminIdentity | null) {
  return Boolean(user && (user.role === 'owner' || user.role === 'manager'));
}

export function canManageCafeSettings(user: AdminIdentity | null) {
  return Boolean(user && user.role === 'owner');
}

export function canViewDashboard(user: AdminIdentity | null) {
  return canManageTables(user);
}
