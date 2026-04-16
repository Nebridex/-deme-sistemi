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
import {
  addTableItem,
  createTable,
  createTemporaryOrder,
  entityTypeLabel,
  formatCurrency,
  formatFirestoreActionError,
  softDeleteTable,
  subscribeCafeActivityLogs,
  subscribeCompletedSessions,
  subscribeRecentTableItems,
  subscribeTables,
  subscribeTodayClosedLogs,
  updateTable
} from '@/lib/firestore';
import type { CafeTable, CompletedSession, TableActivityLog } from '@/types';

function AdminDashboardContent() {
  const router = useRouter();
  const { user } = useAdminAuth();
  const [tables, setTables] = useState<CafeTable[]>([]);
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [newTableName, setNewTableName] = useState('');
  const [newTemporaryName, setNewTemporaryName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isCreatingTemporary, setIsCreatingTemporary] = useState(false);
  const [recentItems, setRecentItems] = useState<string[]>([]);
  const [presetItems, setPresetItems] = useState<PresetItemShortcut[]>([]);
  const [recentLogs, setRecentLogs] = useState<TableActivityLog[]>([]);
  const [todayClosedLogs, setTodayClosedLogs] = useState<TableActivityLog[]>([]);
  const [topItemsToday, setTopItemsToday] = useState<Array<{ name: string; count: number }>>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    fixedOccupied: false,
    fixedReady: false,
    temporaryOpen: false,
    completedHistory: false,
    legacyClosed: true
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
        setTopItemsToday(
          Array.from(byName.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([name, count]) => ({ name, count }))
        );
      });
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[admin/dashboard] recent items subscription failed', err);
    }
    return () => unsub?.();
  }, [user?.cafeId]);

  useEffect(() => {
    if (!user?.cafeId) return;
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeCompletedSessions(user.cafeId, setCompletedSessions);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.error('[admin/dashboard] completed sessions subscription failed', err);
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

  const fixedTables = useMemo(
    () => tables.filter((table) => (table.entityType ?? 'fixed_table') === 'fixed_table'),
    [tables]
  );
  const temporaryOrders = useMemo(
    () => tables.filter((table) => (table.entityType ?? 'fixed_table') === 'temporary_order'),
    [tables]
  );

  const summary = useMemo(() => {
    const startOfToday = getStartOfTodayTimestamp();
    const fixedActive = fixedTables.filter((table) => table.status !== 'closed');
    const temporaryOpen = temporaryOrders.filter((table) => !table.deletedAt);
    const closedTodayFallback = fixedTables.filter((table) => typeof table.closedAt === 'number' && table.closedAt >= startOfToday);
    const closedTodayRevenueFromLogs = todayClosedLogs.reduce((sum, log) => {
      if (typeof log.amountSnapshot === 'number') return sum + log.amountSnapshot;
      const fallbackTable = tables.find((table) => table.id === log.tableId);
      if (fallbackTable?.closedAt && fallbackTable.closedAt >= startOfToday && typeof fallbackTable.closedAmountSnapshot === 'number') {
        return sum + fallbackTable.closedAmountSnapshot;
      }
      return sum;
    }, 0);
    const closedTodayRevenueFallback = closedTodayFallback.reduce((sum, table) => sum + (table.closedAmountSnapshot ?? table.totalAmount), 0);

    return {
      openAccountAmount: [...fixedActive, ...temporaryOpen].reduce((sum, table) => sum + table.totalAmount, 0),
      todayClosedCount: todayClosedLogs.length || closedTodayFallback.length,
      todayClosedRevenue: todayClosedLogs.length ? closedTodayRevenueFromLogs : closedTodayRevenueFallback,
      paymentPendingCount: fixedTables.filter((table) => table.status === 'payment_pending').length,
      occupiedCount: fixedTables.filter((table) => table.status === 'occupied' || table.status === 'payment_pending').length,
      readyCount: fixedTables.filter((table) => table.status === 'empty').length,
      temporaryOpenCount: temporaryOpen.length
    };
  }, [fixedTables, tables, temporaryOrders, todayClosedLogs]);

  const groupedFixed = useMemo(
    () => ({
      occupied: fixedTables.filter((table) => table.status === 'occupied' || table.status === 'payment_pending'),
      ready: fixedTables.filter((table) => table.status === 'empty'),
      legacyClosed: fixedTables.filter((table) => table.status === 'closed')
    }),
    [fixedTables]
  );

  const activeTemporaryOrders = useMemo(
    () => temporaryOrders.filter((table) => !table.deletedAt && table.status !== 'closed'),
    [temporaryOrders]
  );

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [sectionKey]: !prev[sectionKey] };
      localStorage.setItem(sectionStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const renderQuickAdd = async (table: CafeTable) => {
    const suggestedName = recentItems[0] || presetItems[0]?.name || 'Çay';
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

  const addFixedTable = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManageTables(user)) return;
    const trimmed = newTableName.trim() || `Masa ${fixedTables.length + 1}`;
    if (!trimmed) return;

    setIsCreating(true);
    try {
      await createTable(trimmed, user);
      setNewTableName('');
    } catch (err) {
      setError(formatFirestoreActionError(err, 'Sabit masa oluşturulamadı.'));
    } finally {
      setIsCreating(false);
    }
  };

  const addTemporary = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManageTables(user)) return;
    const trimmed = newTemporaryName.trim() || `Geçici Sipariş ${Date.now().toString().slice(-4)}`;
    if (!trimmed) return;

    setIsCreatingTemporary(true);
    try {
      await createTemporaryOrder(trimmed, user);
      setNewTemporaryName('');
    } catch (err) {
      setError(formatFirestoreActionError(err, 'Geçici sipariş açılamadı.'));
    } finally {
      setIsCreatingTemporary(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl p-4 md:p-6 lg:p-8">
      <header className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Kafe Yönetim Paneli</h1>
            <p className="text-sm text-slate-600">Sabit masaları ve geçici siparişleri aynı operasyon ekranından yönetin.</p>
          </div>
          <button className="rounded-lg border px-4 py-2 text-sm" onClick={async () => {
            await adminLogout();
            router.replace('/admin/login');
          }}>Çıkış</button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-lg bg-emerald-50 p-3 ring-1 ring-emerald-200"><p className="text-xs text-emerald-700">Açık Hesap Tutarı</p><p className="text-xl font-semibold text-emerald-900">{formatCurrency(summary.openAccountAmount)}</p></div>
          <div className="rounded-lg bg-violet-50 p-3 ring-1 ring-violet-200"><p className="text-xs text-violet-700">Bugünkü Kapanan Masa Cirosu</p><p className="text-xl font-semibold text-violet-800">{formatCurrency(summary.todayClosedRevenue)}</p></div>
          <div className="rounded-lg bg-violet-50 p-3"><p className="text-xs text-violet-700">Bugün Kapanan Masa</p><p className="text-xl font-semibold text-violet-800">{summary.todayClosedCount}</p></div>
          <div className="rounded-lg bg-amber-50 p-3"><p className="text-xs text-amber-700">Ödeme Bekleyen Masa</p><p className="text-xl font-semibold text-amber-800">{summary.paymentPendingCount}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Dolu Masa</p><p className="text-xl font-semibold">{summary.occupiedCount}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Açık Siparişler</p><p className="text-xl font-semibold">{summary.temporaryOpenCount}</p></div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={addFixedTable}>
            <input value={newTableName} onChange={(e) => setNewTableName(e.target.value)} placeholder="Yeni sabit masa adı" className="w-full rounded-lg border px-3 py-2 text-sm" />
            <button disabled={isCreating} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60" type="submit">{isCreating ? 'Oluşturuluyor...' : 'Sabit Masa Oluştur'}</button>
          </form>
          <form className="flex flex-col gap-2 sm:flex-row" onSubmit={addTemporary}>
            <input value={newTemporaryName} onChange={(e) => setNewTemporaryName(e.target.value)} placeholder="Geçici sipariş adı (örn. Paket 1)" className="w-full rounded-lg border px-3 py-2 text-sm" />
            <button disabled={isCreatingTemporary} className="rounded-lg bg-indigo-700 px-4 py-2 text-sm text-white disabled:opacity-60" type="submit">{isCreatingTemporary ? 'Açılıyor...' : 'Geçici Sipariş Aç'}</button>
          </form>
        </div>
      </header>

      {offline && <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">İnternet bağlantınız yok. Değişiklikler bağlantı gelince senkronize olur.</div>}
      {error && <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {loading && <div className="rounded-xl bg-white p-6 text-center text-slate-500">Masalar yükleniyor...</div>}

      {!loading && (
        <div className="space-y-4">
          <section className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-semibold">Sabit Masalar · Dolu</h2>
                <button className="rounded-md border bg-white px-2 py-1 text-xs" onClick={() => toggleSection('fixedOccupied')}>{collapsedSections.fixedOccupied ? 'Genişlet' : 'Daralt'}</button>
              </div>
              {!collapsedSections.fixedOccupied && (
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {groupedFixed.occupied.map((table) => (
                    <TableCard
                      key={table.id}
                      table={table}
                      onDelete={(tableId) => softDeleteTable(tableId, user)}
                      onRename={(id, name) => updateTable(id, { name }, user)}
                      onToggleStatus={(id, status) => updateTable(id, { status }, user)}
                      onQuickAdd={renderQuickAdd}
                    />
                  ))}
                  {!groupedFixed.occupied.length && <div className="rounded-lg border border-dashed p-3 text-sm text-slate-500">Dolu sabit masa yok.</div>}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-base font-semibold">Sabit Masalar · Yeni müşteri için hazır</h2>
                <button className="rounded-md border px-2 py-1 text-xs" onClick={() => toggleSection('fixedReady')}>{collapsedSections.fixedReady ? 'Genişlet' : 'Daralt'}</button>
              </div>
              {!collapsedSections.fixedReady && (
                <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                  {groupedFixed.ready.map((table) => (
                    <TableCard
                      key={table.id}
                      table={table}
                      onDelete={(tableId) => softDeleteTable(tableId, user)}
                      onRename={(id, name) => updateTable(id, { name }, user)}
                      onToggleStatus={(id, status) => updateTable(id, { status }, user)}
                      onQuickAdd={renderQuickAdd}
                    />
                  ))}
                  {!groupedFixed.ready.length && <div className="rounded-lg border border-dashed p-3 text-sm text-slate-500">Hazır sabit masa yok.</div>}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-indigo-900">Açık Siparişler</h2>
                <p className="text-xs text-indigo-700">Geçici adisyonlar, kapanınca aktif listeden kalkar.</p>
              </div>
              <button className="rounded-md border border-indigo-200 bg-white px-2 py-1 text-xs" onClick={() => toggleSection('temporaryOpen')}>{collapsedSections.temporaryOpen ? 'Genişlet' : 'Daralt'}</button>
            </div>
            {!collapsedSections.temporaryOpen && (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {activeTemporaryOrders.map((table) => (
                  <article key={table.id} className="rounded-lg border border-indigo-200 bg-white p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{table.name}</p>
                      <p className="text-xs text-indigo-700">{entityTypeLabel[table.entityType ?? 'temporary_order']}</p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Toplam: {formatCurrency(table.totalAmount)} · {table.itemCount} ürün</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link href={`/admin/tables/${table.id}`} className="rounded-md border px-2 py-1 text-xs">Detay</Link>
                      <button className="rounded-md border px-2 py-1 text-xs" onClick={() => renderQuickAdd(table)}>Hızlı Ürün</button>
                    </div>
                  </article>
                ))}
                {!activeTemporaryOrders.length && <div className="rounded-lg border border-dashed border-indigo-200 bg-white p-3 text-sm text-indigo-700">Açık geçici sipariş yok.</div>}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-violet-200 bg-violet-50/50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-violet-900">Tamamlanan Siparişler / Adisyon Geçmişi</h2>
                <p className="text-xs text-violet-700">Sabit masa kapanışları ve geçici sipariş tamamlamaları.</p>
              </div>
              <button className="rounded-md border border-violet-200 bg-white px-2 py-1 text-xs" onClick={() => toggleSection('completedHistory')}>{collapsedSections.completedHistory ? 'Genişlet' : 'Daralt'}</button>
            </div>
            {!collapsedSections.completedHistory && (
              <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {completedSessions.map((session) => (
                  <li key={session.id} className="rounded-lg border border-violet-200 bg-white p-2 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{session.sourceTableName}</p>
                      <p className="text-xs text-violet-700">{session.sourceEntityType === 'fixed_table' ? 'Sabit Masa' : 'Geçici Sipariş'}</p>
                    </div>
                    <p className="text-xs text-slate-500">Kapanış: {formatDateTime(session.closedAt)}</p>
                    <p className="text-xs font-semibold text-slate-700">{formatCurrency(session.totalAmount)}</p>
                  </li>
                ))}
                {!completedSessions.length && <li className="rounded-lg border border-dashed border-violet-200 bg-white p-3 text-sm text-violet-700">Henüz tamamlanan adisyon yok.</li>}
              </ul>
            )}
          </section>

          {!!groupedFixed.legacyClosed.length && (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">Eski Kapalı Sabit Masa Kayıtları (geçiş)</h2>
                <button className="rounded-md border bg-white px-2 py-1 text-xs" onClick={() => toggleSection('legacyClosed')}>{collapsedSections.legacyClosed ? 'Genişlet' : 'Daralt'}</button>
              </div>
              {!collapsedSections.legacyClosed && (
                <ul className="space-y-2">
                  {groupedFixed.legacyClosed.map((table) => (
                    <li key={table.id} className="flex items-center justify-between rounded-lg border bg-white p-2 text-sm">
                      <p>{table.name}</p>
                      <button
                        className="rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-700"
                        onClick={async () => {
                          try {
                            await updateTable(table.id, { status: 'empty' }, user);
                          } catch (err) {
                            setError(formatFirestoreActionError(err, 'Masa tekrar hazırlanamadı.'));
                          }
                        }}
                      >
                        Yeni müşteri için hazır yap
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <h2 className="text-base font-semibold">Son İşlemler</h2>
              {!recentLogs.length && <p className="mt-2 text-sm text-slate-500">Son işlem bulunamadı.</p>}
              {!!recentLogs.length && (
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
        </div>
      )}
    </main>
  );
}

export default function AdminDashboardPage() {
  return <AuthGuard><AdminDashboardContent /></AuthGuard>;
}
