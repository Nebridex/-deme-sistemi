'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { AuthGuard } from '@/app/components/AuthGuard';
import { BillSummary } from '@/app/components/BillSummary';
import { formatCurrency, addTableItem, editTableItem, removeTableItem, subscribeTable, subscribeTableItems, updateTable } from '@/lib/firestore';
import type { CafeTable, TableItem } from '@/types';

function AdminTableDetailContent() {
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;
  const [table, setTable] = useState<CafeTable | null>(null);
  const [items, setItems] = useState<TableItem[]>([]);
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => subscribeTable(tableId, setTable), [tableId]);
  useEffect(() => subscribeTableItems(tableId, setItems), [tableId]);

  const editingItem = useMemo(() => items.find((i) => i.id === editingId), [items, editingId]);

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name);
      setQuantity(editingItem.quantity);
      setUnitPrice(editingItem.unitPrice);
    }
  }, [editingItem]);

  const resetForm = () => {
    setName('');
    setQuantity(1);
    setUnitPrice(0);
    setEditingId(null);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    if (editingId) {
      await editTableItem(editingId, { tableId, name: name.trim(), quantity, unitPrice });
    } else {
      await addTableItem(tableId, name.trim(), quantity, unitPrice);
    }
    resetForm();
  };

  if (!table) {
    return <div className="p-5 text-center text-slate-500">Table not found.</div>;
  }

  return (
    <main className="mx-auto w-full max-w-4xl p-4 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/admin" className="text-sm text-slate-600 underline">
          ← Back to dashboard
        </Link>
        <Link href={`/t/${table.id}`} className="rounded-md border px-3 py-1.5 text-sm">
          Open customer view
        </Link>
      </div>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{table.name}</h1>
            <p className="text-sm text-slate-500">Table code: {table.code}</p>
          </div>
          <button
            className="rounded-md border px-3 py-1.5 text-sm"
            onClick={() => updateTable(table.id, { status: table.status === 'active' ? 'occupied' : 'active' })}
          >
            Status: {table.status}
          </button>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr,320px]">
        <section>
          <h2 className="mb-2 text-lg font-semibold">Bill Items</h2>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-slate-500">
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <p className="font-semibold">{formatCurrency(item.totalPrice)}</p>
                </div>
                <div className="mt-2 flex gap-2">
                  <button className="rounded-md border px-2 py-1 text-xs" onClick={() => setEditingId(item.id)}>
                    Edit
                  </button>
                  <button className="rounded-md border border-rose-300 px-2 py-1 text-xs text-rose-700" onClick={() => removeTableItem(item.id, tableId)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {!items.length && <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">No items added yet.</div>}
          </div>
        </section>

        <aside className="space-y-4">
          <BillSummary totalAmount={table.totalAmount} itemCount={table.itemCount} />
          <form className="space-y-3 rounded-xl bg-white p-4 shadow-sm" onSubmit={onSubmit}>
            <h3 className="font-semibold">{editingId ? 'Edit Item' : 'Add Item'}</h3>
            <input
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Item name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="w-full rounded-lg border px-3 py-2"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
              />
              <input
                className="w-full rounded-lg border px-3 py-2"
                type="number"
                min={0}
                value={unitPrice}
                onChange={(e) => setUnitPrice(Number(e.target.value))}
                required
              />
            </div>
            <div className="flex gap-2">
              <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white" type="submit">
                {editingId ? 'Save' : 'Add'}
              </button>
              {editingId && (
                <button className="rounded-lg border px-4 py-2 text-sm" type="button" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </aside>
      </div>
    </main>
  );
}

export default function AdminTableDetailPage() {
  return (
    <AuthGuard>
      <AdminTableDetailContent />
    </AuthGuard>
  );
}
