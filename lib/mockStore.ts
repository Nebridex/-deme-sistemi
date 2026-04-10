import { DEFAULT_CAFE_ID } from '@/lib/domain/constants';
import { generatePublicToken } from '@/lib/domain/token';
import type { CafeTable, TableActivityLog, TableItem } from '@/types';

const TABLES_KEY = 'cafe_mvp_tables_v2';
const ITEMS_KEY = 'cafe_mvp_items_v2';
const LOGS_KEY = 'cafe_mvp_logs_v2';
const AUTH_KEY = 'cafe_mvp_admin_auth_v2';

const now = () => Date.now();

const demoTableId = 'table-demo-1';
const demoTables: CafeTable[] = [
  {
    id: demoTableId,
    cafeId: DEFAULT_CAFE_ID,
    name: 'Table 1',
    publicToken: generatePublicToken(),
    status: 'occupied',
    totalAmount: 78,
    itemCount: 2,
    deletedAt: null,
    lastActivityAt: now(),
    createdAt: now(),
    updatedAt: now()
  }
];

const demoItems: TableItem[] = [
  {
    id: 'item-demo-1',
    tableId: demoTableId,
    cafeId: DEFAULT_CAFE_ID,
    name: 'Latte',
    quantity: 2,
    unitPrice: 12,
    totalPrice: 24,
    deletedAt: null,
    createdAt: now(),
    updatedAt: now()
  },
  {
    id: 'item-demo-2',
    tableId: demoTableId,
    cafeId: DEFAULT_CAFE_ID,
    name: 'Cheesecake',
    quantity: 3,
    unitPrice: 18,
    totalPrice: 54,
    deletedAt: null,
    createdAt: now(),
    updatedAt: now()
  }
];

const demoLogs: TableActivityLog[] = [
  {
    id: 'log-demo-1',
    tableId: demoTableId,
    cafeId: DEFAULT_CAFE_ID,
    actionType: 'table_created',
    message: 'Table created in demo mode',
    actorType: 'system',
    actorId: null,
    createdAt: now()
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

export const getTablesMock = () => read(TABLES_KEY, demoTables);
export const getItemsMock = () => read(ITEMS_KEY, demoItems);
export const getLogsMock = () => read(LOGS_KEY, demoLogs);
export const saveTablesMock = (tables: CafeTable[]) => write(TABLES_KEY, tables);
export const saveItemsMock = (items: TableItem[]) => write(ITEMS_KEY, items);
export const saveLogsMock = (logs: TableActivityLog[]) => write(LOGS_KEY, logs);
export const getMockAuthState = () => read(AUTH_KEY, false);
export const setMockAuthState = (value: boolean) => write(AUTH_KEY, value);
