'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/app/components/AuthGuard';
import { TableCard } from '@/app/components/TableCard';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { adminLogout } from '@/lib/auth';
import { canManageTables } from '@/lib/domain/permissions';
import { DEFAULT_CAFE_ID } from '@/lib/domain/constants';
import { formatDateTime, getStartOfTodayTimestamp } from '@/lib/domain/time';
import { getPresetItems, getRecentItemNames, rememberRecentItemName, type PresetItemShortcut } from '@/lib/domain/recentItems';
import { addTableItem, createTable, formatCurrency, formatFirestoreActionError, softDeleteTable, subscribeCafeActivityLogs, subscribeRecentTableItems, subscribeTables, subscribeTodayClosedLogs, updateTable } from '@/lib/firestore';
import type { CafeTable, TableActivityLog } from '@/types';

function AdminDashboardContent() {
  const router = useRouter();
  const { user } = useAdminAuth();
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [recentItems, setRecentItems] = useState<string[]>([]);
  const [presetItems, setPresetItems] = useState<PresetItemShortcut[]>([]);
  const [recentLogs, setRecentLogs] = useState<TableActivityLog[]>([]);
  const [todayClosedLogs, setTodayClosedLogs] = useState<TableActivityLog[]>([]);
  const [topItemsToday, setTopItemsToday] = useState<Array<{ name: string; count: number }>>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    paymentPending: false,
    occupied: false,
    empty: false,
    closed: true,
    recentActivity: true
  });

  const sectionStorageKey = `odeme-dashboard-collapsed-${user?.cafeId ?? DEFAULT_CAFE_ID}`;

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
    if (!user?.cafeId) return;
    setRecentItems(getRecentItemNames(user.cafeId));
    setPresetItems(getPresetItems(user.cafeId));
  }, [user?.cafeId]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(sectionStorageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Record<string, boolean>;
      setCollapsedSections((prev) => ({ ...prev, ...parsed }));
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[admin/dashboard] collapsed sections load failed', err);
    }
  }, [sectionStorageKey]);

  useEffect(() => {
    if (!user?.cafeId) return;
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeCafeActivityLogs(user.cafeId, setRecentLogs);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[admin/dashboard] logs subscription failed', err);
    }
    return () => unsub?.();
  }, [user?.cafeId]);

  useEffect(() => {
    if (!user?.cafeId) return;
    const startOfToday = getStartOfTodayTimestamp();
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeTodayClosedLogs(user.cafeId, startOfToday, setTodayClosedLogs);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[admin/dashboard] today closed logs subscription failed', err);
    }
    return () => unsub?.();
  }, [user?.cafeId]);

  useEffect(() => {
    if (!user?.cafeId) return;
    const startOfToday = getStartOfTodayTimestamp();
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeRecentTableItems(user.cafeId, startOfToday, (items) => {
        const byName = new Map<string, number>();
        for (const item of items) {
          byName.set(item.name, (byName.get(item.name) ?? 0) + item.quantity);
        }
        const top = Array.from(byName.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name, count]) => ({ name, count }));
        setTopItemsToday(top);
      });
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[admin/dashboard] recent items subscription failed', err);
    }
    return () => unsub?.();
  }, [user?.cafeId]);

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
          setError(message || 'Masa listesi alınamadı.');
          setLoading(false);
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Firestore erişilemiyor.');
      setLoading(false);
    }
    return () => unsub?.();
  }, [user?.cafeId]);

  const summary = useMemo(() => {
    const active = tables.filter((table) => table.status !== 'closed');
    const startOfToday = getStartOfTodayTimestamp();
    const closedTodayFallback = tables.filter((table) => typeof table.closedAt === 'number' && table.closedAt >= startOfToday);
    const paymentPendingCount = tables.filter((table) => table.status === 'payment_pending').length;
    const closedTodayRevenueFromLogs = todayClosedLogs.reduce((sum, log) => {
      if (typeof log.amountSnapshot === 'number') return sum + log.amountSnapshot;
      const fallbackTable = tables.find((table) => table.id === log.tableId);
      if (fallbackTable?.closedAt && fallbackTable.closedAt >= startOfToday && typeof fallbackTable.closedAmountSnapshot === 'number') {
        return sum + fallbackTable.closedAmountSnapshot;
      }
      return sum;
    }, 0);
    const closedTodayRevenueFallback = closedTodayFallback.reduce((sum, table) => sum + (table.closedAmountSnapshot ?? table.totalAmount), 0);
    const todayClosedCount = todayClosedLogs.length || closedTodayFallback.length;
    const todayClosedRevenue = todayClosedLogs.length ? closedTodayRevenueFromLogs : closedTodayRevenueFallback;
    const closedTotalSnapshot = tables
      .filter((table) => table.status === 'closed')
      .reduce((sum, table) => sum + (table.closedAmountSnapshot ?? table.totalAmount), 0);

    return {
      activeCount: active.length,
      occupiedCount: tables.filter((table) => table.status === 'occupied').length,
      closedCount: tables.filter((table) => table.status === 'closed').length,
      paymentPendingCount,
      openAccountAmount: active.reduce((sum, table) => sum + table.totalAmount, 0),
      closedTotalSnapshot,
      todayClosedCount,
      todayClosedRevenue
    };
  }, [tables, todayClosedLogs]);

  const groupedTables = useMemo(() => ({
    paymentPending: tables.filter((table) => table.status === 'payment_pending'),
    occupied: tables.filter((table) => table.status === 'occupied'),
    empty: tables.filter((table) => table.status === 'empty'),
    closed: tables.filter((table) => table.status === 'closed')
  }), [tables]);

  const tableSections: Array<{ key: keyof typeof groupedTables; title: string; description: string; style: string }> = [
    { key: 'paymentPending', title: 'Ödeme Bekleyen Masalar', description: 'Öncelikli işlem sırası', style: 'border-amber-300 bg-amber-50' },
    { key: 'occupied', title: 'Aktif Dolu Masalar', description: 'Servis devam ediyor', style: 'border-emerald-200 bg-emerald-50/40' },
    { key: 'empty', title: 'Boş Masalar', description: 'Yeni müşteri için hazır', style: 'border-slate-200 bg-white' }
  ];

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [sectionKey]: !prev[sectionKey] };
      localStorage.setItem(sectionStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const renderQuickAdd = async (table: CafeTable, suggestedName = recentItems[0] || presetItems[0]?.name || 'Çay') => {
    const name = window.prompt('Ürün adı', suggestedName)?.trim();
    if (!name) return;
    const suggestedPrice = typeof presetItems[0]?.defaultPrice === 'number' ? String(presetItems[0].defaultPrice) : '0';
    const unitPriceInput = window.prompt('Birim fiyat', suggestedPrice)?.trim();
    if (!unitPriceInput) return;
    const unitPrice = Number(unitPriceInput);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setError('Geçerli bir fiyat girin.');
      return;
    }
    try {
      await addTableItem(table.id, table.cafeId, name, 1, unitPrice, user);
      if (user?.cafeId) {
        rememberRecentItemName(user.cafeId, name);
        setRecentItems(getRecentItemNames(user.cafeId));
      }
    } catch (err) {
      setError(formatFirestoreActionError(err, 'Ürün eklenemedi. Lütfen tekrar deneyin.'));
    }
  };

  const addTable = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManageTables(user)) return;
    const autoName = `Masa ${tables.length + 1}`;
    const trimmed = newTableName.trim() || autoName;
    if (!trimmed) return;

    setIsCreating(true);
    try {
      await createTable(trimmed, user);
      setNewTableName('');
    } catch (err) {
      setError(formatFirestoreActionError(err, 'Masa oluşturulamadı. Lütfen tekrar deneyin.'));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl p-4 md:p-6 lg:p-8">
      <header className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Kafe Yönetim Paneli</h1>
            <p className="text-sm text-slate-600">Masa durumlarını ve canlı hesapları tek yerden yönetin.</p>
          </div>
          <button className="rounded-lg border px-4 py-2 text-sm" onClick={async () => {
            await adminLogout();
            router.replace('/admin/login');
          }}>Çıkış</button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-200"><p className="text-xs text-emerald-700">Açık Hesap Tutarı</p><p className="text-xl font-semibold text-emerald-900">{formatCurrency(summary.openAccountAmount)}</p></div>
          <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs text-amber-700">Ödeme Bekleyen Masa</p><p className="text-xl font-semibold text-amber-800">{summary.paymentPendingCount}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Dolu Masa</p><p className="text-xl font-semibold">{summary.occupiedCount}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Kapalı Masa</p><p className="text-xl font-semibold">{summary.closedCount}</p><p className="text-[11px] text-slate-500">{formatCurrency(summary.closedTotalSnapshot)}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Aktif Masalar</p><p className="text-xl font-semibold">{summary.activeCount}</p></div>
          <div className="rounded-lg bg-violet-50 p-3"><p className="text-xs text-violet-700">Bugün Kapanan Masa</p><p className="text-xl font-semibold text-violet-800">{summary.todayClosedCount}</p></div>
          <div className="rounded-lg bg-violet-50 p-3 ring-1 ring-violet-200"><p className="text-xs text-violet-700">Bugünkü Kapanan Masa Cirosu</p><p className="text-xl font-semibold text-violet-800">{formatCurrency(summary.todayClosedRevenue)}</p><p className="text-[11px] text-violet-600">Kapanışlardan hesaplanır</p></div>
        </div>

        <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={addTable}>
          <input value={newTableName} onChange={(e) => setNewTableName(e.target.value)} placeholder="Yeni masa adı (boş bırakırsan otomatik ad verilir)" className="w-full rounded-lg border px-3 py-2 text-sm sm:max-w-sm" />
          <button disabled={isCreating} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60" type="submit">
            {isCreating ? 'Oluşturuluyor...' : 'Masa Oluştur'}
          </button>
        </form>
        {!!presetItems.length && (
          <div className="mt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Hazır Ürünler</p>
            <div className="flex flex-wrap gap-2">
              {presetItems.slice(0, 6).map((item) => (
                <span key={item.name} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
                  {item.name}{typeof item.defaultPrice === 'number' ? ` · ${formatCurrency(item.defaultPrice)}` : ''}
                </span>
              ))}
            </div>
          </div>
        )}
        {!!recentItems.length && (
          <div className="mt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Son Eklenen Ürünler</p>
            <div className="flex flex-wrap gap-2">
              {recentItems.slice(0, 6).map((itemName) => (
                <span key={itemName} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{itemName}</span>
              ))}
            </div>
          </div>
        )}
      </header>

      {offline && <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">İnternet bağlantınız yok. Değişiklikler bağlantı gelince senkronize olur.</div>}
      {error && <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {loading && <div className="rounded-xl bg-white p-6 text-center text-slate-500">Masalar yükleniyor...</div>}

      {!loading && (
        <div className="space-y-4">
          {tableSections.map((section) => {
            const sectionTables = groupedTables[section.key];
            const collapsed = collapsedSections[section.key];
            return (
              <section key={section.key} className={`rounded-xl border p-3 ${section.style}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold">{section.title}</h2>
                    <p className="text-xs text-slate-600">{section.description} · {sectionTables.length} masa</p>
                  </div>
                  <button type="button" className="rounded-md border bg-white px-2 py-1 text-xs" onClick={() => toggleSection(section.key)}>
                    {collapsed ? 'Genişlet' : 'Daralt'}
                  </button>
                </div>
                {!collapsed && !sectionTables.length && <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-sm text-slate-500">Bu grupta masa yok.</div>}
                {!collapsed && !!sectionTables.length && (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {sectionTables.map((table) => (
                      <TableCard
                        key={table.id}
                        table={table}
                        onDelete={(tableId) => softDeleteTable(tableId, user)}
                        onRename={(id, name) => updateTable(id, { name }, user)}
                        onToggleStatus={(id, status) => updateTable(id, { status }, user)}
                        onQuickAdd={renderQuickAdd}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-violet-900">Kapanan Masalar</h2>
                <p className="text-xs text-violet-700">Arşiv görünümü · {groupedTables.closed.length} masa · {formatCurrency(summary.closedTotalSnapshot)}</p>
              </div>
              <button type="button" className="rounded-md border border-violet-200 bg-white px-2 py-1 text-xs" onClick={() => toggleSection('closed')}>
                {collapsedSections.closed ? 'Genişlet' : 'Daralt'}
              </button>
            </div>
            {!collapsedSections.closed && !groupedTables.closed.length && <div className="rounded-lg border border-dashed border-violet-200 bg-white p-3 text-sm text-violet-700">Henüz kapanmış masa yok.</div>}
            {!collapsedSections.closed && !!groupedTables.closed.length && (
              <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {groupedTables.closed.map((table) => (
                  <li key={table.id} className="rounded-lg border border-violet-200 bg-white p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{table.name}</p>
                      <p className="text-xs font-semibold text-violet-700">{formatCurrency(table.closedAmountSnapshot ?? table.totalAmount)}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Kapanış: {formatDateTime(table.closedAt)}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <Link href={`/admin/tables/${table.id}`} className="rounded-md border px-2 py-1 text-xs">Detay</Link>
                      <button
                        type="button"
                        className="rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-700"
                        onClick={async () => {
                          try {
                            await updateTable(table.id, { status: 'empty' }, user);
                          } catch (err) {
                            setError(formatFirestoreActionError(err, 'Masa tekrar açılamadı.'));
                          }
                        }}
                      >
                        Yeniden Aç
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-semibold">Son İşlemler</h2>
                <button type="button" className="rounded-md border px-2 py-1 text-xs" onClick={() => toggleSection('recentActivity')}>
                  {collapsedSections.recentActivity ? 'Genişlet' : 'Daralt'}
                </button>
              </div>
              {!collapsedSections.recentActivity && !recentLogs.length && <p className="mt-2 text-sm text-slate-500">Son işlem bulunamadı.</p>}
              {!collapsedSections.recentActivity && !!recentLogs.length && (
                <ul className="mt-2 space-y-2 text-sm">
                  {recentLogs.slice(0, 6).map((log) => (
                    <li key={log.id} className="rounded-lg bg-slate-50 p-2">
                      <p>{log.message}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <h2 className="text-base font-semibold">En Çok Eklenen Ürünler</h2>
              {!topItemsToday.length && <p className="mt-2 text-sm text-slate-500">Bugün ürün hareketi bulunamadı.</p>}
              {!!topItemsToday.length && (
                <ul className="mt-2 space-y-2 text-sm">
                  {topItemsToday.map((item, index) => (
                    <li key={item.name} className="flex items-center justify-between rounded-lg bg-slate-50 p-2">
                      <p>{index + 1}. {item.name}</p>
                      <p className="font-semibold">{item.count} adet</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {!tables.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Aktif masa yok. Yukarıdan ilk masanızı oluşturun.</div>}
        </div>
      )}
    </main>
  );
}

export default function AdminDashboardPage() {
  return <AuthGuard><AdminDashboardContent /></AuthGuard>;
}
