import type { CafeTable, TableItem } from '@/types';

const TABLES_KEY = 'cafe_mvp_tables';
const ITEMS_KEY = 'cafe_mvp_items';
const AUTH_KEY = 'cafe_mvp_admin_auth';

const now = () => Date.now();

const demoTables: CafeTable[] = [
  {
    id: 'demo-table-1',
    name: 'Table 1',
    code: 'table-1',
    status: 'occupied',
    totalAmount: 78,
    itemCount: 2,
    createdAt: now(),
    updatedAt: now()
  }
];

const demoItems: TableItem[] = [
  {
    id: 'item-1',
    tableId: 'demo-table-1',
    name: 'Latte',
    quantity: 2,
    unitPrice: 12,
    totalPrice: 24,
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: 'item-2',
    tableId: 'demo-table-1',
    name: 'Cheesecake',
    quantity: 3,
    unitPrice: 18,
    totalPrice: 54,
    createdAt: now(),
    updatedAt: now()
  }
];

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    window.localStorage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }
  return JSON.parse(raw) as T;
}

function write<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event('mock-db-updated'));
}

export function getTablesMock() {
  return read(TABLES_KEY, demoTables);
}

export function getItemsMock() {
  return read(ITEMS_KEY, demoItems);
}

export function saveTablesMock(tables: CafeTable[]) {
  write(TABLES_KEY, tables);
}

export function saveItemsMock(items: TableItem[]) {
  write(ITEMS_KEY, items);
}

export function getMockAuthState() {
  return read(AUTH_KEY, false);
}

export function setMockAuthState(value: boolean) {
  write(AUTH_KEY, value);
}
