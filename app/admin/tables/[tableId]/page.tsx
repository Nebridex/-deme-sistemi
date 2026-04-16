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
  formatFirestoreActionError,
  rotateTableToken,
  softDeleteTableItem,
  subscribeTableActivityLogs,
  subscribeTableById,
  subscribeTableItems,
  updateTable
} from '@/lib/firestore';
import { formatRelativeTime } from '@/lib/domain/time';
import { appEnv } from '@/lib/env';
import {
  getPresetItemNames,
  getRecentItemNames,
  rememberRecentItemName,
  savePresetItemNames
} from '@/lib/domain/recentItems';
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
  const [optionalWarnings, setOptionalWarnings] = useState<string[]>([]);
  const [recentItems, setRecentItems] = useState<string[]>([]);
  const [presetItems, setPresetItems] = useState<string[]>([]);
  const [newPreset, setNewPreset] = useState('');

  const publicBillUrl = `${appEnv.appBaseUrl}/t/${table?.publicToken ?? ''}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(publicBillUrl)}`;

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
          setError(message || 'Masa yüklenemedi.');
          setLoading(false);
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Firestore erişilemiyor.');
      setLoading(false);
    }
    return () => unsub?.();
  }, [tableId]);

  useEffect(() => {
    if (!user?.cafeId) return;
    setRecentItems(getRecentItemNames(user.cafeId));
    setPresetItems(getPresetItemNames(user.cafeId));
  }, [user?.cafeId]);

  useEffect(() => {
    if (!user?.cafeId) return;
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeTableItems(user.cafeId, tableId, setItems, (message) => {
        setItems([]);
        const warning = message || 'Ürün listesi okunamadı.';
        setOptionalWarnings((prev) => (prev.includes(warning) ? prev : [...prev, warning]));
      });
    } catch (err) {
      setItems([]);
      if (process.env.NODE_ENV !== 'production') console.error('[admin/table-detail] opsiyonel ürün dinleyicisi başarısız', err);
    }
    return () => unsub?.();
  }, [tableId, user?.cafeId]);

  useEffect(() => {
    if (!user?.cafeId) return;
    let unsub: (() => void) | undefined;
    try {
      unsub = subscribeTableActivityLogs(user.cafeId, tableId, setLogs, (message) => {
        setLogs([]);
        const warning = message || 'Aktivite kayıtları okunamadı.';
        setOptionalWarnings((prev) => (prev.includes(warning) ? prev : [...prev, warning]));
      });
    } catch (err) {
      setLogs([]);
      if (process.env.NODE_ENV !== 'production') console.error('[admin/table-detail] opsiyonel log dinleyicisi başarısız', err);
    }
    return () => unsub?.();
  }, [tableId, user?.cafeId]);

  const editingItem = useMemo(() => items.find((i) => i.id === editingId), [items, editingId]);
  useEffect(() => {
    if (!editingItem) return;
    setName(editingItem.name);
    setQuantity(editingItem.quantity);
    setUnitPrice(editingItem.unitPrice);
  }, [editingItem]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!table || !name.trim() || quantity < 1 || unitPrice < 0) return;

    try {
      if (editingId) {
        await editTableItem(editingId, { tableId, cafeId: table.cafeId, name: name.trim(), quantity, unitPrice }, user);
      } else {
        await addTableItem(tableId, table.cafeId, name.trim(), quantity, unitPrice, user);
      }
      if (user?.cafeId) {
        rememberRecentItemName(user.cafeId, name.trim());
        setRecentItems(getRecentItemNames(user.cafeId));
      }
    } catch (err) {
      setError(formatFirestoreActionError(err, 'Ürün kaydedilemedi.'));
      return;
    }
    setName('');
    setQuantity(1);
    setUnitPrice(0);
    setEditingId(null);
  };

  if (loading) return <div className="p-6 text-center text-slate-500">Masa yükleniyor...</div>;
  if (!table) return <div className="p-6 text-center text-slate-500">Masa bulunamadı veya arşive alınmış.</div>;

  return (
    <main className="mx-auto w-full max-w-5xl p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/admin" className="text-sm text-slate-600 underline">← Panele Dön</Link>
        <div className="flex gap-2">
          <Link href={`/t/${table.publicToken}`} className="rounded-md border px-3 py-1.5 text-sm">Müşteri Sayfasını Aç</Link>
          {user?.role === 'owner' && (
            <button
              className="rounded-md border border-amber-300 px-3 py-1.5 text-sm text-amber-700"
              onClick={async () => {
                try {
                  await rotateTableToken(table, user);
                } catch (err) {
                  setError(formatFirestoreActionError(err, 'QR bağlantısı yenilenemedi.'));
                }
              }}
            >
              QR Yenile
            </button>
          )}
        </div>
      </div>

      {error && <div className="mb-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {!!optionalWarnings.length && process.env.NODE_ENV !== 'production' && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Opsiyonel Firestore okumaları başarısız oldu: {optionalWarnings.join(' | ')}
        </div>
      )}

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{table.name}</h1>
            <p className="text-sm text-slate-500">Token: {table.publicToken.slice(0, 10)}... · Son güncelleme {formatRelativeTime(table.lastActivityAt)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase text-slate-500">Masa durumu</p>
            <select
              className="rounded-md border px-3 py-1.5 text-sm"
              value={table.status}
              onChange={async (e) => {
                try {
                  await updateTable(table.id, { status: e.target.value as CafeTable['status'] }, user);
                } catch (err) {
                  setError(formatFirestoreActionError(err, 'Masa durumu güncellenemedi.'));
                }
              }}
            >
              <option value="empty">Boş</option>
              <option value="occupied">Dolu</option>
              <option value="payment_pending">Ödeme Bekliyor</option>
              <option value="closed">Kapalı</option>
            </select>
          </div>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr,330px]">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Hesap Ürünleri</h2>
          {!items.length && <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">Henüz ürün yok. İlk ürünü ekleyin.</div>}
          {items.map((item) => (
            <div key={item.id} className="rounded-xl bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-slate-500">{item.quantity} × {formatCurrency(item.unitPrice)}</p>
                </div>
                <p className="font-semibold">{formatCurrency(item.totalPrice)}</p>
              </div>
              <div className="mt-2 flex gap-2">
                <button className="rounded-md border px-2 py-1 text-xs" onClick={() => setEditingId(item.id)}>Düzenle</button>
                <button
                  className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700"
                  onClick={async () => {
                    try {
                      await softDeleteTableItem(item.id, tableId, table.cafeId, user);
                    } catch (err) {
                      setError(formatFirestoreActionError(err, 'Ürün kaldırılamadı.'));
                    }
                  }}
                >
                  Kaldır
                </button>
              </div>
            </div>
          ))}
        </section>

        <aside className="space-y-4">
          <BillSummary totalAmount={table.totalAmount} itemCount={table.itemCount} />
          <form className="space-y-3 rounded-xl bg-white p-4 shadow-sm" onSubmit={onSubmit}>
            <h3 className="font-semibold">{editingId ? 'Ürünü Düzenle' : 'Hızlı Ürün Ekle'}</h3>
            <input className="w-full rounded-lg border px-3 py-2" placeholder="Ürün adı" value={name} onChange={(e) => setName(e.target.value)} required />
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-lg border px-3 py-2" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} required />
              <input className="rounded-lg border px-3 py-2" type="number" min={0} value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} required />
            </div>
            {!!recentItems.length && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Son kullanılan ürünler</p>
                <div className="flex flex-wrap gap-2">
                  {recentItems.slice(0, 8).map((itemName) => (
                    <button key={itemName} type="button" className="rounded-full border px-2 py-1 text-xs text-slate-700" onClick={() => setName(itemName)}>
                      {itemName}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!!presetItems.length && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Hazır kısayol ürünleri</p>
                <div className="flex flex-wrap gap-2">
                  {presetItems.map((itemName) => (
                    <button key={itemName} type="button" className="rounded-full bg-slate-100 px-2 py-1 text-xs" onClick={() => setName(itemName)}>
                      {itemName}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white" type="submit">{editingId ? 'Kaydet' : 'Ürün Ekle'}</button>
          </form>

          <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
            <h3 className="font-semibold">Hazır Ürün Kısayolları</h3>
            <div className="flex gap-2">
              <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Örn. Filtre Kahve" value={newPreset} onChange={(e) => setNewPreset(e.target.value)} />
              <button
                type="button"
                className="rounded-md border px-3 text-xs"
                onClick={() => {
                  if (!user?.cafeId || !newPreset.trim()) return;
                  const next = [newPreset.trim(), ...presetItems.filter((item) => item.toLocaleLowerCase() !== newPreset.trim().toLocaleLowerCase())].slice(0, 12);
                  setPresetItems(next);
                  savePresetItemNames(user.cafeId, next);
                  setNewPreset('');
                }}
              >
                Ekle
              </button>
            </div>
            {!!presetItems.length && (
              <div className="flex flex-wrap gap-2">
                {presetItems.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="rounded-full border px-2 py-1 text-xs"
                    onClick={() => {
                      if (!user?.cafeId) return;
                      const next = presetItems.filter((item) => item !== preset);
                      setPresetItems(next);
                      savePresetItemNames(user.cafeId, next);
                    }}
                  >
                    {preset} ×
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm">
            <h3 className="font-semibold">Masa QR Kodu</h3>
            <p className="text-xs text-slate-500">Müşteri bu kodu okutup canlı hesap sayfasını açar.</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt={`${table.name} için QR kodu`} className="mx-auto w-44 rounded-lg border" />
            <div className="space-y-2">
              <input className="w-full rounded-lg border px-2 py-1 text-xs text-slate-600" value={publicBillUrl} readOnly />
              <div className="flex gap-2">
                <a href={qrUrl} download={`${table.name}-qr.png`} className="rounded-md border px-3 py-1.5 text-xs">QR İndir</a>
                <button
                  type="button"
                  className="rounded-md border px-3 py-1.5 text-xs"
                  onClick={() => {
                    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
                    if (!printWindow) return;
                    printWindow.document.write(`<html><body style="display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${qrUrl}" style="width:320px;height:320px;" /></body></html>`);
                    printWindow.document.close();
                    printWindow.focus();
                    printWindow.print();
                  }}
                >
                  QR Yazdır
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <h3 className="mb-2 font-semibold">Son Aktivite</h3>
            {!logs.length && <p className="text-sm text-slate-500">Henüz aktivite yok.</p>}
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
