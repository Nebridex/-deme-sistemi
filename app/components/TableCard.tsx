import Link from 'next/link';
import { formatCurrency, statusLabel } from '@/lib/firestore';
import type { CafeTable } from '@/types';

export function TableCard({
  table,
  onDelete,
  onRename,
  onToggleStatus
}: {
  table: CafeTable;
  onDelete: (id: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onToggleStatus: (id: string, status: CafeTable['status']) => Promise<void>;
}) {
  return (
    <article className="rounded-xl bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-lg font-semibold">{table.name}</h3>
          <p className="text-sm text-slate-500">{statusLabel[table.status]}</p>
        </div>
        <button
          className="rounded-md border px-2 py-1 text-xs"
          onClick={() => onToggleStatus(table.id, table.status === 'active' ? 'occupied' : 'active')}
        >
          Toggle Status
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-slate-500">Total</p>
          <p className="font-semibold">{formatCurrency(table.totalAmount)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-2">
          <p className="text-slate-500">Items</p>
          <p className="font-semibold">{table.itemCount}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/admin/tables/${table.id}`} className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white">
          Open
        </Link>
        <button
          className="rounded-md border px-3 py-1.5 text-sm"
          onClick={async () => {
            const next = window.prompt('New table name', table.name)?.trim();
            if (next) await onRename(table.id, next);
          }}
        >
          Rename
        </button>
        <button className="rounded-md border border-rose-300 px-3 py-1.5 text-sm text-rose-700" onClick={() => onDelete(table.id)}>
          Delete
        </button>
      </div>
    </article>
  );
}
