'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { BillSummary } from '@/app/components/BillSummary';
import { formatCurrency, mapPublicProjectionToBillView, subscribePublicTableByToken } from '@/lib/firestore';
import { DEFAULT_CAFE_NAME } from '@/lib/domain/constants';
import type { PublicTableBillView, PublicTableProjection } from '@/types';

export default function CustomerTablePage() {
  const params = useParams<{ tableId: string }>();
  const publicToken = params.tableId;

  const [projection, setProjection] = useState<PublicTableProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = subscribePublicTableByToken(publicToken, (next) => {
      setProjection(next);
      setLoading(false);
    });
    return () => unsub?.();
  }, [publicToken]);

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

  const bill: PublicTableBillView | null = useMemo(
    () => (projection ? mapPublicProjectionToBillView(projection) : null),
    [projection]
  );

  if (loading) return <main className="p-6 text-center text-slate-500">Loading your table...</main>;
  if (!bill) return <main className="p-6 text-center text-slate-500">Table link invalid or expired.</main>;

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
        {!bill.items.length && <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">No items on this table yet.</div>}
        {!!bill.items.length && (
          <ul className="space-y-3">
            {bill.items.map((item, idx) => (
              <li key={`${item.name}-${idx}`} className="rounded-xl bg-white p-4 shadow-sm">
                <div className="flex justify-between">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-slate-500">{item.quantity} × {formatCurrency(item.unitPrice)}</p>
                  </div>
                  <p className="font-semibold">{formatCurrency(item.totalPrice)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
