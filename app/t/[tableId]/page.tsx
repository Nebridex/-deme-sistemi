'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { BillSummary } from '@/app/components/BillSummary';
import { ItemList } from '@/app/components/ItemList';
import { mapTableToPublicBill, subscribeTableByPublicToken, subscribeTableItems } from '@/lib/firestore';
import { DEFAULT_CAFE_NAME } from '@/lib/domain/constants';
import type { CafeTable, PublicTableBillView, TableItem } from '@/types';

export default function CustomerTablePage() {
  const params = useParams<{ tableId: string }>();
  const publicToken = params.tableId;

  const [table, setTable] = useState<CafeTable | null>(null);
  const [items, setItems] = useState<TableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = subscribeTableByPublicToken(publicToken, (next) => {
      setTable(next);
      setLoading(false);
    });
    return () => unsub?.();
  }, [publicToken]);

  const tableId = table?.id;

  useEffect(() => {
    if (!tableId) return;
    return subscribeTableItems(tableId, setItems);
  }, [tableId]);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const bill: PublicTableBillView | null = useMemo(() => (table ? mapTableToPublicBill(table) : null), [table]);

  if (loading) return <main className="p-6 text-center text-slate-500">Loading your table...</main>;
  if (!table || !bill) return <main className="p-6 text-center text-slate-500">Table link invalid or expired.</main>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-4 p-4">
      {offline && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700">You are offline. Data may be stale.</div>}
      <header className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">{DEFAULT_CAFE_NAME}</p>
        <h1 className="mt-1 text-2xl font-bold">{bill.tableName}</h1>
        <p className="text-sm text-slate-500">Live bill summary</p>
      </header>

      <BillSummary totalAmount={bill.totalAmount} itemCount={bill.itemCount} />
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">Items</h2>
        <ItemList items={items} emptyText="No items on this table yet." />
      </section>
    </main>
  );
}
