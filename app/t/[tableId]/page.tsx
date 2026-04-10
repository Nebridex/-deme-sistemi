'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { BillSummary } from '@/app/components/BillSummary';
import { ItemList } from '@/app/components/ItemList';
import { subscribeTable, subscribeTableItems } from '@/lib/firestore';
import type { CafeTable, TableItem } from '@/types';

export default function CustomerTablePage() {
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;

  const [table, setTable] = useState<CafeTable | null>(null);
  const [items, setItems] = useState<TableItem[]>([]);

  useEffect(() => subscribeTable(tableId, setTable), [tableId]);
  useEffect(() => subscribeTableItems(tableId, setItems), [tableId]);

  if (!table) {
    return <main className="p-6 text-center text-slate-500">Table not found or unavailable.</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md space-y-4 p-4">
      <header className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-xs uppercase tracking-wide text-slate-500">MiniFabrika Cafe</p>
        <h1 className="mt-1 text-2xl font-bold">{table.name}</h1>
        <p className="text-sm text-slate-500">Live table bill</p>
      </header>

      <BillSummary totalAmount={table.totalAmount} itemCount={table.itemCount} />
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase text-slate-500">Items</h2>
        <ItemList items={items} emptyText="No items on this table yet." />
      </section>
    </main>
  );
}
