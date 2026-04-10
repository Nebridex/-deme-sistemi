'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/app/components/AuthGuard';
import { TableCard } from '@/app/components/TableCard';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { adminLogout } from '@/lib/auth';
import { canManageTables } from '@/lib/domain/permissions';
import { DEFAULT_CAFE_ID } from '@/lib/domain/constants';
import { addTableItem, createTable, formatCurrency, softDeleteTable, subscribeTables, updateTable } from '@/lib/firestore';
import type { CafeTable } from '@/types';

function AdminDashboardContent() {
  const router = useRouter();
  const { user } = useAdminAuth();
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const online = () => setOffline(false);
    const offlineListener = () => setOffline(true);
    window.addEventListener('online', online);
    window.addEventListener('offline', offlineListener);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offlineListener);
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeTables(
        user?.cafeId ?? DEFAULT_CAFE_ID,
        (nextTables) => {
          setTables(nextTables);
          setLoading(false);
        },
        (message) => {
          setError(message || 'Failed to subscribe tables.');
          setLoading(false);
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Firestore unavailable.');
      setLoading(false);
    }
    return () => unsub?.();
  }, [user?.cafeId]);

  const summary = useMemo(() => {
    const active = tables.filter((table) => table.status !== 'closed');
    return {
      activeCount: active.length,
      occupiedCount: tables.filter((table) => table.status === 'occupied').length,
      closedCount: tables.filter((table) => table.status === 'closed').length,
      totalAmount: active.reduce((sum, table) => sum + table.totalAmount, 0)
    };
  }, [tables]);

  const addTable = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManageTables(user)) return;
    const trimmed = newTableName.trim();
    if (!trimmed) return;

    setIsCreating(true);
    try {
      await createTable(trimmed, user);
      setNewTableName('');
    } catch {
      setError('Could not create table. Please retry.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl p-4 md:p-6 lg:p-8">
      <header className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Cafe Admin Dashboard</h1>
            <p className="text-sm text-slate-600">Manage table status and live bills in one place.</p>
          </div>
          <button className="rounded-lg border px-4 py-2 text-sm" onClick={async () => {
            await adminLogout();
            router.replace('/admin/login');
          }}>Logout</button>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-4">
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Active Tables</p><p className="text-xl font-semibold">{summary.activeCount}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Active Amount</p><p className="text-xl font-semibold">{formatCurrency(summary.totalAmount)}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Occupied</p><p className="text-xl font-semibold">{summary.occupiedCount}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Closed</p><p className="text-xl font-semibold">{summary.closedCount}</p></div>
        </div>

        <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={addTable}>
          <input value={newTableName} onChange={(e) => setNewTableName(e.target.value)} placeholder="Create new table" className="w-full rounded-lg border px-3 py-2 text-sm sm:max-w-sm" />
          <button disabled={isCreating} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60" type="submit">
            {isCreating ? 'Creating...' : 'Create Table'}
          </button>
        </form>
      </header>

      {offline && <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">You are offline. Changes may not sync until connection returns.</div>}
      {error && <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {loading && <div className="rounded-xl bg-white p-6 text-center text-slate-500">Loading tables...</div>}

      {!loading && (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              onDelete={(tableId) => softDeleteTable(tableId, user)}
              onRename={(id, name) => updateTable(id, { name }, user)}
              onToggleStatus={(id, status) => updateTable(id, { status }, user)}
              onQuickAdd={async (t) => {
                const name = window.prompt('Item name', 'Americano')?.trim();
                if (!name) return;
                await addTableItem(t.id, t.cafeId, name, 1, 0, user);
              }}
            />
          ))}

          {!tables.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">No active tables. Create your first table above.</div>}
        </section>
      )}
    </main>
  );
}

export default function AdminDashboardPage() {
  return <AuthGuard><AdminDashboardContent /></AuthGuard>;
}
