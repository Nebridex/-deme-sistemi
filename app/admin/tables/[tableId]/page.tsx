'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AuthGuard } from '@/app/components/AuthGuard';
import { BillSummary } from '@/app/components/BillSummary';
import {
  addTableItem,
  editTableItem,
  formatCurrency,
  rotateTableToken,
  softDeleteTableItem,
  subscribeTableActivityLogs,
  subscribeTableById,
  subscribeTableItems,
  updateTable
} from '@/lib/firestore';
import { formatRelativeTime } from '@/lib/domain/time';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import type { CafeTable, TableActivityLog, TableItem } from '@/types';

function AdminTableDetailContent() {
  const { user } = useAdminAuth();
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;

  const [table, setTable] = useState<CafeTable | null>(null);
  const [items, setItems] = useState<TableItem[]>([]);
  const [logs, setLogs] = useState<TableActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeTableById(
        tableId,
        (value) => {
          setTable(value);
          setLoading(false);
        },
        (message) => {
          setError(message || 'Could not load table.');
          setLoading(false);
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Firestore unavailable.');
      setLoading(false);
    }
    return () => unsub?.();
  }, [tableId]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeTableItems(tableId, setItems, (message) => setError(message || 'Could not load items.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Firestore unavailable.');
    }
    return () => unsub?.();
  }, [tableId]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeTableActivityLogs(tableId, setLogs, (message) => setError(message || 'Could not load logs.'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Firestore unavailable.');
    }
    return () => unsub?.();
  }, [tableId]);

  const editingItem = useMemo(() => items.find((i) => i.id === editingId), [items, editingId]);
  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setQuantity(editingItem.quantity);
      setUnitPrice(editingItem.unitPrice);
    }
  }, [editingItem]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!table || !name.trim()) return;

    try {
      if (editingId) {
        await editTableItem(editingId, { tableId, cafeId: table.cafeId, name: name.trim(), quantity, unitPrice }, user);
      } else {
        await addTableItem(tableId, table.cafeId, name.trim(), quantity, unitPrice, user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save item.');
      return;
    }
    setName(''); setQuantity(1); setUnitPrice(0); setEditingId(null);
  };

  if (loading) return <div className="p-6 text-center text-slate-500">Loading table...</div>;
  if (!table) return <div className="p-6 text-center text-slate-500">This table is unavailable or deleted.</div>;

  return (
    <main className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/admin" className="text-sm text-slate-600 underline">← Back</Link>
        <div className="flex gap-2">
          <Link href={`/t/${table.publicToken}`} className="rounded-md border px-3 py-1.5 text-sm">Open public bill</Link>
          {user?.role === 'owner' && (
            <button
              className="rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-700"
              onClick={async () => {
                await rotateTableToken(table, user);
              }}
            >
              Rotate Token
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{table.name}</h1>
            <p className="text-sm text-slate-500">Public token: {table.publicToken.slice(0, 10)}... · Updated {formatRelativeTime(table.lastActivityAt)}</p>
          </div>
          <select
            className="rounded-md border px-3 py-1.5 text-sm"
            value={table.status}
            onChange={(e) => updateTable(table.id, { status: e.target.value as CafeTable['status'] }, user)}
          >
            <option value="empty">empty</option>
            <option value="occupied">occupied</option>
            <option value="payment_pending">payment_pending</option>
            <option value="closed">closed</option>
          </select>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr,330px]">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Bill Items</h2>
          {!items.length && <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">No items yet. Add the first item.</div>}
          {items.map((item) => (
            <div key={item.id} className="rounded-xl bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between"><div><p className="font-medium">{item.name}</p><p className="text-sm text-slate-500">{item.quantity} × {formatCurrency(item.unitPrice)}</p></div><p className="font-semibold">{formatCurrency(item.totalPrice)}</p></div>
              <div className="mt-2 flex gap-2">
                <button className="rounded-md border px-2 py-1 text-xs" onClick={() => setEditingId(item.id)}>Edit</button>
                <button className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => softDeleteTableItem(item.id, tableId, table.cafeId, user)}>Remove</button>
              </div>
            </div>
          ))}
        </section>

        <aside className="space-y-4">
          <BillSummary totalAmount={table.totalAmount} itemCount={table.itemCount} />
          <form className="space-y-3 rounded-xl bg-white p-4 shadow-sm" onSubmit={onSubmit}>
            <h3 className="font-semibold">{editingId ? 'Edit Item' : 'Quick Add Item'}</h3>
            <input className="w-full rounded-lg border px-3 py-2" placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} required />
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-lg border px-3 py-2" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required />
              <input className="rounded-lg border px-3 py-2" type="number" min={0} value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} required />
            </div>
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white" type="submit">{editingId ? 'Save' : 'Add Item'}</button>
          </form>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h3 className="mb-2 font-semibold">Last Activity</h3>
            {!logs.length && <p className="text-sm text-slate-500">No activity yet.</p>}
            <ul className="space-y-2 text-sm">
              {logs.map((log) => (
                <li key={log.id} className="border-b pb-2 last:border-b-0">
                  <p>{log.message}</p>
                  <p className="text-xs text-slate-500">{formatRelativeTime(log.createdAt)}</p>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  );
}

export default function AdminTableDetailPage() {
  return <AuthGuard><AdminTableDetailContent /></AuthGuard>;
}
