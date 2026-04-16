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
  const [error, setError] = useState<string | null>(null);
  const [splitCount, setSplitCount] = useState(2);
  const [selectedItemKeys, setSelectedItemKeys] = useState<string[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    try {
      setIsRefreshing(true);
      unsub = subscribePublicTableByToken(
        publicToken,
        (next) => {
          setProjection(next);
          setLoading(false);
          setIsRefreshing(false);
        },
        (message) => {
          setError(message || 'Could not load table bill.');
          setLoading(false);
          setIsRefreshing(false);
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Firebase unavailable.');
      setLoading(false);
      setIsRefreshing(false);
    }
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

  const selectedSubtotal = useMemo(() => {
    if (!bill) return 0;
    return bill.items.reduce((sum, item, idx) => {
      const key = `${item.name}-${idx}`;
      return selectedItemKeys.includes(key) ? sum + item.totalPrice : sum;
    }, 0);
  }, [bill, selectedItemKeys]);

  const perPersonAmount = useMemo(() => {
    if (!bill || splitCount <= 0) return 0;
    return bill.totalAmount / splitCount;
  }, [bill, splitCount]);

  if (loading) return <main className="p-6 text-center text-slate-500">Loading your table...</main>;
  if (error) return <main className="p-6 text-center text-rose-700">{error}</main>;
  if (!bill) return <main className="p-6 text-center text-slate-500">This table link is invalid, deleted, or expired.</main>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-4 bg-slate-50 p-4">
      {offline && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-700">You are offline. Data may be stale.</div>}
      {isRefreshing && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700">Bill is being updated...</div>}

      <header className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">{DEFAULT_CAFE_NAME}</p>
        <h1 className="mt-1 text-2xl font-bold">{bill.tableName}</h1>
        <p className="text-sm text-slate-500">Live table bill</p>
      </header>

      <BillSummary totalAmount={bill.totalAmount} itemCount={bill.itemCount} />

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Split Bill</h2>
        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-700">Equal split</p>
            <div className="flex items-center gap-2">
              <label htmlFor="split-count" className="text-sm text-slate-600">People</label>
              <input
                id="split-count"
                className="w-24 rounded-lg border px-3 py-2 text-sm"
                type="number"
                min={2}
                max={20}
                value={splitCount}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  if (!Number.isFinite(next)) return;
                  setSplitCount(Math.min(20, Math.max(2, next)));
                }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-700">
              Estimated per person: <span className="font-semibold">{formatCurrency(perPersonAmount)}</span>
            </p>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-700">Item-based split preview</p>
            <p className="text-xs text-slate-500">Select the items you want to cover (preview only).</p>
            <p className="mt-1 text-sm text-slate-700">Selected subtotal: <span className="font-semibold">{formatCurrency(selectedSubtotal)}</span></p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">Items</h2>
        {!bill.items.length && <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">No items on this table yet.</div>}
        {!!bill.items.length && (
          <ul className="space-y-3">
            {bill.items.map((item, idx) => (
              <li key={`${item.name}-${idx}`} className="rounded-xl bg-white p-4 shadow-sm">
                <label className="flex cursor-pointer items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-slate-500">{item.quantity} × {formatCurrency(item.unitPrice)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(item.totalPrice)}</p>
                    <input
                      type="checkbox"
                      className="mt-2 h-4 w-4"
                      checked={selectedItemKeys.includes(`${item.name}-${idx}`)}
                      onChange={(e) => {
                        const key = `${item.name}-${idx}`;
                        setSelectedItemKeys((prev) => {
                          if (e.target.checked) return [...prev, key];
                          return prev.filter((entry) => entry !== key);
                        });
                      }}
                    />
                  </div>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
