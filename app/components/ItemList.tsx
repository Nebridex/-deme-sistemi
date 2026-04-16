import { formatCurrency } from '@/lib/firestore';
import type { TableItem } from '@/types';

export function ItemList({ items, emptyText }: { items: TableItem[]; emptyText: string }) {
  if (!items.length) {
    return <div className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm">{emptyText}</div>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-xl bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-slate-500">{item.quantity} × {formatCurrency(item.unitPrice)}</p>
            </div>
            <p className="font-semibold">{formatCurrency(item.totalPrice)}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
