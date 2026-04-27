import { formatCurrency } from '@/lib/firestore';

export function BillSummary({ totalAmount, itemCount }: { totalAmount: number; itemCount: number }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">Hesap Özeti</p>
      <div className="mt-2 flex items-end justify-between">
        <div>
          <p className="text-sm text-slate-500">Ürün Adedi</p>
          <p className="text-xl font-semibold">{itemCount}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">Toplam</p>
          <p className="text-2xl font-bold text-emerald-700">{formatCurrency(totalAmount)}</p>
        </div>
      </div>
    </div>
  );
}
