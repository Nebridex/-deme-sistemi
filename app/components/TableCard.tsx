'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatDateTime, formatRelativeTime } from '@/lib/domain/time';
import { formatCurrency, statusLabel } from '@/lib/firestore';
import type { CafeTable } from '@/types';

const statusStyles: Record<CafeTable['status'], string> = {
  empty: 'bg-slate-100 text-slate-700 border-slate-200',
  occupied: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  payment_pending: 'bg-amber-100 text-amber-700 border-amber-200',
  closed: 'bg-violet-100 text-violet-700 border-violet-200'
};

export function TableCard({
  table,
  onDelete,
  onRename,
  onToggleStatus,
  onQuickAdd
}: {
  table: CafeTable;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onToggleStatus: (id: string, status: CafeTable['status']) => Promise<void>;
  onQuickAdd: (table: CafeTable) => Promise<void>;
}) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [name, setName] = useState(table.name);
  const [deleting, setDeleting] = useState(false);

  const statusChoices: CafeTable['status'][] = (table.entityType ?? 'fixed_table') === 'temporary_order'
    ? ['occupied', 'payment_pending', 'closed']
    : ['empty', 'occupied', 'payment_pending'];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isEditingName ? (
            <div className="flex gap-2">
              <input
                className="w-full rounded-md border px-2 py-1 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    if (!name.trim()) return;
                    await onRename(table.id, name.trim());
                    setIsEditingName(false);
                  }
                }}
              />
              <button className="rounded-md border px-2 text-xs" onClick={async () => {
                if (!name.trim()) return;
                await onRename(table.id, name.trim());
                setIsEditingName(false);
              }}>Kaydet</button>
            </div>
          ) : (
            <h3 className="truncate text-lg font-semibold">{table.name}</h3>
          )}
          <p className={`mt-1 inline-flex max-w-full rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles[table.status]}`}>
            {statusLabel[table.status]}
          </p>
          <p className="mt-1 text-xs text-slate-500">{formatRelativeTime(table.lastActivityAt)} güncellendi</p>
          {table.status === 'closed' ? (
            <p className="mt-1 text-xs text-violet-700">Kapanış: {formatDateTime(table.closedAt)}</p>
          ) : (
            <p className="mt-1 text-xs text-emerald-700">Açılış: {formatDateTime(table.openedAt)}</p>
          )}
        </div>
        <select
          value={table.status}
          onChange={(e) => onToggleStatus(table.id, e.target.value as CafeTable['status'])}
          className="w-36 rounded-md border px-2 py-1 text-xs sm:w-44"
          aria-label="Masa durumu"
        >
          {statusChoices.map((status) => (
            <option key={status} value={status}>
              {statusLabel[status]}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Toplam</p>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(table.totalAmount)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Ürün</p>
          <p className="text-xl font-semibold">{table.itemCount}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link href={`/admin/tables/${table.id}`} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">Aç</Link>
        <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => setIsEditingName((v) => !v)}>
          {isEditingName ? 'Vazgeç' : 'Yeniden Adlandır'}
        </button>
        <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => onQuickAdd(table)}>Hızlı Ürün</button>
        <button
          className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-700"
          onClick={async () => {
            if (!deleting) {
              setDeleting(true);
              return;
            }
            await onDelete(table.id);
            setDeleting(false);
          }}
        >
          {deleting ? 'Silmeyi Onayla' : 'Sil'}
        </button>
        {deleting && <button className="col-span-2 rounded-md border px-3 py-1.5 text-xs" onClick={() => setDeleting(false)}>Silme işlemini iptal et</button>}
      </div>
    </article>
  );
}
