'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatRelativeTime } from '@/lib/domain/time';
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

  const statusCycle: CafeTable['status'][] = ['empty', 'occupied', 'payment_pending', 'closed'];
  const nextStatus = statusCycle[(statusCycle.indexOf(table.status) + 1) % statusCycle.length];

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          {isEditingName ? (
            <div className="flex gap-2">
              <input
                className="w-full rounded-md border px-2 py-1 text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter') {
                    await onRename(table.id, name.trim());
                    setIsEditingName(false);
                  }
                }}
              />
              <button className="rounded-md border px-2 text-xs" onClick={async () => {
                await onRename(table.id, name.trim());
                setIsEditingName(false);
              }}>Save</button>
            </div>
          ) : (
            <h3 className="text-lg font-semibold">{table.name}</h3>
          )}
          <p className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusStyles[table.status]}`}>
            {statusLabel[table.status]}
          </p>
        </div>
        <button className="rounded-md border px-2 py-1 text-xs" onClick={() => onToggleStatus(table.id, nextStatus)}>
          Next Status
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Total</p>
          <p className="text-xl font-bold text-slate-900">{formatCurrency(table.totalAmount)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-500">Items</p>
          <p className="text-xl font-semibold">{table.itemCount}</p>
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500">Updated {formatRelativeTime(table.lastActivityAt)}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/admin/tables/${table.id}`} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">Open</Link>
        <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => setIsEditingName((v) => !v)}>Rename</button>
        <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => onQuickAdd(table)}>Quick Add Item</button>
        <button className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-700" onClick={() => onDelete(table.id)}>Delete</button>
      </div>
    </article>
  );
}
