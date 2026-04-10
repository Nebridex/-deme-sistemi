import type { TableItem } from '@/types';

export function calculateTableTotals(items: TableItem[]) {
  const activeItems = items.filter((item) => item.deletedAt === null);
  return {
    itemCount: activeItems.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: activeItems.reduce((sum, item) => sum + item.totalPrice, 0)
  };
}
