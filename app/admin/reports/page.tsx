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

  const summary = useMemo(() => {
    const revenue = logs.reduce((sum, sale) => sum + sale.total, 0);
    const itemCount = logs.reduce((sum, sale) => sum + sale.itemCount, 0);
    return {
      revenue,
      sales: logs.length,
      itemCount,
      averageSale: logs.length ? revenue / logs.length : 0
    };
  }, [logs]);

  const exportCsv = () => {
    const escapeCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const csv = [
      ['Masa', 'Ciro', 'Satış', 'Ortalama'].map(escapeCell).join(','),
      ...rows.map((row) => [row.tableName, row.revenue, row.sales, row.avg].map(escapeCell).join(','))
    ].join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `masa-raporu-${new Date(fromTs).toISOString().slice(0, 10)}-${new Date(toTs).toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Masa Performans Raporu</h1>
        <Link href="/admin" className="text-sm underline">Panele Dön</Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(['today', '7d', '30d', 'custom'] as const).map((key) => (
          <button key={key} className={`rounded border px-3 py-1 text-sm ${filter === key ? 'bg-slate-900 text-white' : 'bg-white'}`} onClick={() => setFilter(key)}>
            {key === 'today' ? 'Bugün' : key === '7d' ? 'Son 7 Gün' : key === '30d' ? 'Son 30 Gün' : 'Özel Aralık'}
          </button>
        ))}
        {filter === 'custom' && (
          <>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded border px-2 py-1 text-sm" />
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded border px-2 py-1 text-sm" />
          </>
        )}
        <button
          className="rounded border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!rows.length}
          onClick={exportCsv}
        >
          CSV İndir
        </button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-emerald-50 p-3">
          <p className="text-xs text-emerald-700">Seçili Aralık Cirosu</p>
          <p className="text-xl font-semibold text-emerald-900">{formatCurrency(summary.revenue)}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-slate-500">Satış Sayısı</p>
          <p className="text-xl font-semibold">{summary.sales}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-slate-500">Satılan Ürün</p>
          <p className="text-xl font-semibold">{summary.itemCount}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-slate-500">Ortalama Adisyon</p>
          <p className="text-xl font-semibold">{formatCurrency(summary.averageSale)}</p>
        </div>
      </section>

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

