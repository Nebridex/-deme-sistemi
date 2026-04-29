'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '@/app/components/AuthGuard';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { formatCurrency, subscribeSalesLogsByRange } from '@/lib/firestore';
import type { SaleLog } from '@/types';

type FilterKey = 'today' | '7d' | '30d' | 'custom';

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function ReportsContent() {
  const { user } = useAdminAuth();
  const [filter, setFilter] = useState<FilterKey>('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [logs, setLogs] = useState<SaleLog[]>([]);

  const { fromTs, toTs } = useMemo(() => {
    const now = Date.now();
    const end = now;
    if (filter === 'today') return { fromTs: startOfDay(now), toTs: end };
    if (filter === '7d') return { fromTs: startOfDay(now - 6 * 86400000), toTs: end };
    if (filter === '30d') return { fromTs: startOfDay(now - 29 * 86400000), toTs: end };
    const from = customFrom ? new Date(`${customFrom}T00:00:00`).getTime() : startOfDay(now);
    const to = customTo ? new Date(`${customTo}T23:59:59`).getTime() : end;
    return { fromTs: from, toTs: to };
  }, [customFrom, customTo, filter]);

  useEffect(() => {
    if (!user?.cafeId) return;
    return subscribeSalesLogsByRange(user.cafeId, fromTs, toTs, setLogs);
  }, [fromTs, toTs, user?.cafeId]);

  const rows = useMemo(() => {
    const byTable = new Map<string, { tableName: string; revenue: number; sales: number }>();
    for (const sale of logs) {
      const key = sale.tableId;
      const prev = byTable.get(key);
      if (prev) {
        prev.revenue += sale.total;
        prev.sales += 1;
      } else {
        byTable.set(key, { tableName: sale.tableName, revenue: sale.total, sales: 1 });
      }
    }
    return Array.from(byTable.values())
      .map((r) => ({ ...r, avg: r.sales ? r.revenue / r.sales : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [logs]);

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Masa Performans Raporu</h1>
        <Link href="/admin" className="text-sm underline">Panele Dön</Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['today', '7d', '30d', 'custom'] as const).map((key) => (
          <button key={key} className={`rounded border px-3 py-1 text-sm ${filter === key ? 'bg-slate-900 text-white' : 'bg-white'}`} onClick={() => setFilter(key)}>
            {key === 'today' ? 'Today' : key === '7d' ? '7 Days' : key === '30d' ? '30 Days' : 'Custom'}
          </button>
        ))}
        {filter === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded border px-2 py-1 text-sm" />
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded border px-2 py-1 text-sm" />
          </>
        )}
      </div>

      <div className="rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">Masa</th>
              <th className="px-3 py-2">Ciro</th>
              <th className="px-3 py-2">Satış</th>
              <th className="px-3 py-2">Ortalama</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.tableName} className="border-t">
                <td className="px-3 py-2">{row.tableName}</td>
                <td className="px-3 py-2 font-semibold">{formatCurrency(row.revenue)}</td>
                <td className="px-3 py-2">{row.sales}</td>
                <td className="px-3 py-2">{formatCurrency(row.avg)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-500">Seçilen aralıkta kayıt yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function AdminReportsPage() {
  return <AuthGuard><ReportsContent /></AuthGuard>;
}

