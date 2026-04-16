'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthGuard } from '@/app/components/AuthGuard';
import { TableCard } from '@/app/components/TableCard';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { adminLogout } from '@/lib/auth';
import { canManageTables } from '@/lib/domain/permissions';
import { DEFAULT_CAFE_ID } from '@/lib/domain/constants';
import { getPresetItems, getRecentItemNames, rememberRecentItemName, type PresetItemShortcut } from '@/lib/domain/recentItems';
import { addTableItem, createTable, formatCurrency, formatFirestoreActionError, softDeleteTable, subscribeTables, updateTable } from '@/lib/firestore';
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
  const [recentItems, setRecentItems] = useState<string[]>([]);
  const [presetItems, setPresetItems] = useState<PresetItemShortcut[]>([]);

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
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayActivityCount = tables.filter((table) => table.lastActivityAt >= startOfToday.getTime()).length;

    return {
      activeCount: active.length,
      occupiedCount: tables.filter((table) => table.status === 'occupied').length,
      closedCount: tables.filter((table) => table.status === 'closed').length,
      totalAmount: active.reduce((sum, table) => sum + table.totalAmount, 0),
      totalItemCount: active.reduce((sum, table) => sum + table.itemCount, 0),
      todayActivityCount
    };
  }, [tables]);

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
            <p className="text-sm text-slate-600">Masaları ve canlı hesapları tek ekrandan yönetin.</p>
          </div>
          <button className="rounded-lg border px-4 py-2 text-sm" onClick={async () => {
            await adminLogout();
            router.replace('/admin/login');
          }}>Çıkış</button>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-5">
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Aktif Masa</p><p className="text-xl font-semibold">{summary.activeCount}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Aktif Tutar</p><p className="text-xl font-semibold">{formatCurrency(summary.totalAmount)}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Dolu Masa</p><p className="text-xl font-semibold">{summary.occupiedCount}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Kapalı Masa</p><p className="text-xl font-semibold">{summary.closedCount}</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Aktif Ürün</p><p className="text-xl font-semibold">{summary.totalItemCount}</p><p className="text-[11px] text-slate-400">Bugün {summary.todayActivityCount} masada işlem var</p></div>
        </div>

        <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={addTable}>
          <input value={newTableName} onChange={(e) => setNewTableName(e.target.value)} placeholder="Yeni masa adı (boş bırakırsan otomatik ad verilir)" className="w-full rounded-lg border px-3 py-2 text-sm sm:max-w-sm" />
          <button disabled={isCreating} className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60" type="submit">
            {isCreating ? 'Oluşturuluyor...' : 'Masa Oluştur'}
          </button>
        </form>
        {!!presetItems.length && (
          <div className="mt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Hazır ürün kısayolları</p>
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
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Son eklenen ürünler</p>
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
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tables.map((table) => (
            <TableCard
              key={table.id}
              table={table}
              onDelete={(tableId) => softDeleteTable(tableId, user)}
              onRename={(id, name) => updateTable(id, { name }, user)}
              onToggleStatus={(id, status) => updateTable(id, { status }, user)}
              onQuickAdd={async (t) => {
                const suggestedPreset = presetItems[0];
                const suggestedName = recentItems[0] || suggestedPreset?.name || 'Çay';
                const name = window.prompt('Ürün adı', suggestedName)?.trim();
                if (!name) return;
                const suggestedPrice = typeof suggestedPreset?.defaultPrice === 'number' ? String(suggestedPreset.defaultPrice) : '0';
                const unitPriceInput = window.prompt('Birim fiyat', suggestedPrice)?.trim();
                if (!unitPriceInput) return;
                const unitPrice = Number(unitPriceInput);
                if (!Number.isFinite(unitPrice) || unitPrice < 0) {
                  setError('Geçerli bir fiyat girin.');
                  return;
                }
                try {
                  await addTableItem(t.id, t.cafeId, name, 1, unitPrice, user);
                  if (user?.cafeId) {
                    rememberRecentItemName(user.cafeId, name);
                    setRecentItems(getRecentItemNames(user.cafeId));
                  }
                } catch (err) {
                  setError(formatFirestoreActionError(err, 'Ürün eklenemedi. Lütfen tekrar deneyin.'));
                }
              }}
            />
          ))}

          {!tables.length && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Aktif masa yok. Yukarıdan ilk masanızı oluşturun.</div>}
        </section>
      )}
    </main>
  );
}

export default function AdminDashboardPage() {
  return <AuthGuard><AdminDashboardContent /></AuthGuard>;
}
