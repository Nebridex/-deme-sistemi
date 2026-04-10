'use client';

import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  limit
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { calculateTableTotals } from '@/lib/domain/totals';
import { DEFAULT_CAFE_ID } from '@/lib/domain/constants';
import { generatePublicToken } from '@/lib/domain/token';
import {
  getItemsMock,
  getLogsMock,
  getTablesMock,
  saveItemsMock,
  saveLogsMock,
  saveTablesMock
} from '@/lib/mockStore';
import type { AdminIdentity, CafeTable, PublicTableBillView, TableActivityLog, TableItem, TableStatus } from '@/types';

const tablesCollection = 'tables';
const itemsCollection = 'tableItems';
const logsCollection = 'tableActivityLogs';

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => Date.now();

function activeTables(tables: CafeTable[]) {
  return tables.filter((table) => table.deletedAt === null);
}

function activeItems(items: TableItem[]) {
  return items.filter((item) => item.deletedAt === null);
}

async function logTableActivity(input: Omit<TableActivityLog, 'id' | 'createdAt'>) {
  const logEntry: TableActivityLog = { ...input, id: `log-${uid()}`, createdAt: now() };

  if (!isFirebaseConfigured || !db) {
    saveLogsMock([logEntry, ...getLogsMock()]);
    return;
  }

  await addDoc(collection(db, logsCollection), { ...logEntry, id: undefined });
}

async function recomputeTableTotals(tableId: string) {
  if (!isFirebaseConfigured || !db) {
    const tables = getTablesMock();
    const items = activeItems(getItemsMock().filter((item) => item.tableId === tableId));
    const totals = calculateTableTotals(items);
    const nextStatus: TableStatus = totals.itemCount === 0 ? 'empty' : 'occupied';

    saveTablesMock(
      tables.map((table) =>
        table.id === tableId
          ? {
              ...table,
              ...totals,
              status: table.status === 'payment_pending' || table.status === 'closed' ? table.status : nextStatus,
              updatedAt: now(),
              lastActivityAt: now()
            }
          : table
      )
    );
    return;
  }

  const itemsSnap = await getDocs(query(collection(db, itemsCollection), where('tableId', '==', tableId), where('deletedAt', '==', null)));
  const items = itemsSnap.docs.map((d) => d.data() as TableItem);
  const totals = calculateTableTotals(items);
  await updateDoc(doc(db, tablesCollection, tableId), {
    ...totals,
    updatedAt: now(),
    lastActivityAt: now()
  });
}

export function subscribeTables(cafeId: string, callback: (tables: CafeTable[]) => void) {
  if (!isFirebaseConfigured || !db) {
    const emit = () => callback(activeTables(getTablesMock()).filter((table) => table.cafeId === cafeId));
    emit();
    window.addEventListener('mock-db-updated', emit);
    return () => window.removeEventListener('mock-db-updated', emit);
  }

  const q = query(collection(db, tablesCollection), where('cafeId', '==', cafeId), where('deletedAt', '==', null), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CafeTable, 'id'>) }))));
}

export function subscribeTableById(tableId: string, callback: (table: CafeTable | null) => void) {
  if (!isFirebaseConfigured || !db) {
    const emit = () => callback(activeTables(getTablesMock()).find((table) => table.id === tableId) ?? null);
    emit();
    window.addEventListener('mock-db-updated', emit);
    return () => window.removeEventListener('mock-db-updated', emit);
  }

  return onSnapshot(doc(db, tablesCollection, tableId), (snap) => {
    if (!snap.exists()) return callback(null);
    const table = { id: snap.id, ...(snap.data() as Omit<CafeTable, 'id'>) };
    callback(table.deletedAt ? null : table);
  });
}

export function subscribeTableByPublicToken(token: string, callback: (table: CafeTable | null) => void) {
  if (!isFirebaseConfigured || !db) {
    const emit = () => callback(activeTables(getTablesMock()).find((table) => table.publicToken === token) ?? null);
    emit();
    window.addEventListener('mock-db-updated', emit);
    return () => window.removeEventListener('mock-db-updated', emit);
  }

  const q = query(collection(db, tablesCollection), where('publicToken', '==', token), where('deletedAt', '==', null), limit(1));
  return onSnapshot(q, (snap) => {
    const docValue = snap.docs[0];
    callback(docValue ? ({ id: docValue.id, ...(docValue.data() as Omit<CafeTable, 'id'>) } as CafeTable) : null);
  });
}

export function subscribeTableItems(tableId: string, callback: (items: TableItem[]) => void) {
  if (!isFirebaseConfigured || !db) {
    const emit = () => callback(activeItems(getItemsMock()).filter((item) => item.tableId === tableId));
    emit();
    window.addEventListener('mock-db-updated', emit);
    return () => window.removeEventListener('mock-db-updated', emit);
  }

  const q = query(collection(db, itemsCollection), where('tableId', '==', tableId), where('deletedAt', '==', null), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TableItem, 'id'>) }))));
}

export function subscribeTableActivityLogs(tableId: string, callback: (logs: TableActivityLog[]) => void) {
  if (!isFirebaseConfigured || !db) {
    const emit = () => callback(getLogsMock().filter((log) => log.tableId === tableId).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8));
    emit();
    window.addEventListener('mock-db-updated', emit);
    return () => window.removeEventListener('mock-db-updated', emit);
  }

  const q = query(collection(db, logsCollection), where('tableId', '==', tableId), orderBy('createdAt', 'desc'), limit(8));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TableActivityLog, 'id'>) }))));
}

export async function createTable(name: string, actor?: AdminIdentity | null, cafeId = DEFAULT_CAFE_ID) {
  const timestamp = now();
  const table: Omit<CafeTable, 'id'> = {
    cafeId,
    name,
    publicToken: generatePublicToken(),
    status: 'empty',
    totalAmount: 0,
    itemCount: 0,
    deletedAt: null,
    lastActivityAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  if (!isFirebaseConfigured || !db) {
    const id = `table-${uid()}`;
    saveTablesMock([...getTablesMock(), { id, ...table }]);
    await logTableActivity({ tableId: id, cafeId, actionType: 'table_created', message: `${name} created`, actorType: 'admin', actorId: actor?.uid ?? null });
    return;
  }

  const ref = await addDoc(collection(db, tablesCollection), table);
  await logTableActivity({ tableId: ref.id, cafeId, actionType: 'table_created', message: `${name} created`, actorType: 'admin', actorId: actor?.uid ?? null });
}

export async function updateTable(tableId: string, payload: Partial<Pick<CafeTable, 'name' | 'status'>>, actor?: AdminIdentity | null) {
  const original = getTablesMock().find((table) => table.id === tableId);

  if (!isFirebaseConfigured || !db) {
    saveTablesMock(
      getTablesMock().map((table) => (table.id === tableId ? { ...table, ...payload, updatedAt: now(), lastActivityAt: now() } : table))
    );
    if (payload.name && payload.name !== original?.name) {
      await logTableActivity({ tableId, cafeId: original?.cafeId ?? DEFAULT_CAFE_ID, actionType: 'table_renamed', message: `Renamed to ${payload.name}`, actorType: 'admin', actorId: actor?.uid ?? null });
    }
    if (payload.status && payload.status !== original?.status) {
      await logTableActivity({ tableId, cafeId: original?.cafeId ?? DEFAULT_CAFE_ID, actionType: 'table_status_changed', message: `Status changed to ${payload.status}`, actorType: 'admin', actorId: actor?.uid ?? null });
    }
    return;
  }

  await updateDoc(doc(db, tablesCollection, tableId), { ...payload, updatedAt: now(), lastActivityAt: now() });
}

export async function softDeleteTable(tableId: string, actor?: AdminIdentity | null) {
  const table = getTablesMock().find((t) => t.id === tableId);

  if (!isFirebaseConfigured || !db) {
    saveTablesMock(getTablesMock().map((t) => (t.id === tableId ? { ...t, deletedAt: now(), updatedAt: now() } : t)));
    saveItemsMock(getItemsMock().map((item) => (item.tableId === tableId ? { ...item, deletedAt: now(), updatedAt: now() } : item)));
    await logTableActivity({ tableId, cafeId: table?.cafeId ?? DEFAULT_CAFE_ID, actionType: 'table_deleted', message: 'Table soft-deleted', actorType: 'admin', actorId: actor?.uid ?? null });
    return;
  }

  await updateDoc(doc(db, tablesCollection, tableId), { deletedAt: now(), updatedAt: now() });
}

export async function addTableItem(tableId: string, cafeId: string, name: string, quantity: number, unitPrice: number, actor?: AdminIdentity | null) {
  const timestamp = now();
  const item: Omit<TableItem, 'id'> = {
    tableId,
    cafeId,
    name,
    quantity,
    unitPrice,
    totalPrice: quantity * unitPrice,
    deletedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  if (!isFirebaseConfigured || !db) {
    saveItemsMock([...getItemsMock(), { id: `item-${uid()}`, ...item }]);
    await recomputeTableTotals(tableId);
    await logTableActivity({ tableId, cafeId, actionType: 'item_added', message: `${name} added`, actorType: 'admin', actorId: actor?.uid ?? null });
    return;
  }

  await addDoc(collection(db, itemsCollection), item);
  await recomputeTableTotals(tableId);
}

export async function editTableItem(itemId: string, payload: Pick<TableItem, 'name' | 'quantity' | 'unitPrice' | 'tableId' | 'cafeId'>, actor?: AdminIdentity | null) {
  const totalPrice = payload.quantity * payload.unitPrice;

  if (!isFirebaseConfigured || !db) {
    saveItemsMock(
      getItemsMock().map((item) =>
        item.id === itemId
          ? { ...item, name: payload.name, quantity: payload.quantity, unitPrice: payload.unitPrice, totalPrice, updatedAt: now() }
          : item
      )
    );
    await recomputeTableTotals(payload.tableId);
    await logTableActivity({ tableId: payload.tableId, cafeId: payload.cafeId, actionType: 'item_edited', message: `${payload.name} updated`, actorType: 'admin', actorId: actor?.uid ?? null });
    return;
  }

  await updateDoc(doc(db, itemsCollection, itemId), { ...payload, totalPrice, updatedAt: now() });
  await recomputeTableTotals(payload.tableId);
}

export async function softDeleteTableItem(itemId: string, tableId: string, cafeId: string, actor?: AdminIdentity | null) {
  if (!isFirebaseConfigured || !db) {
    saveItemsMock(getItemsMock().map((item) => (item.id === itemId ? { ...item, deletedAt: now(), updatedAt: now() } : item)));
    await recomputeTableTotals(tableId);
    await logTableActivity({ tableId, cafeId, actionType: 'item_removed', message: 'Item removed', actorType: 'admin', actorId: actor?.uid ?? null });
    return;
  }

  await updateDoc(doc(db, itemsCollection, itemId), { deletedAt: now(), updatedAt: now() });
  await recomputeTableTotals(tableId);
}

export function mapTableToPublicBill(table: CafeTable): PublicTableBillView {
  return {
    tableName: table.name,
    status: table.status,
    itemCount: table.itemCount,
    totalAmount: table.totalAmount
  };
}

export async function ensureTableToken(tableId: string, currentToken?: string | null) {
  if (currentToken) return currentToken;
  const token = generatePublicToken();
  if (!isFirebaseConfigured || !db) {
    saveTablesMock(getTablesMock().map((table) => (table.id === tableId ? { ...table, publicToken: token, updatedAt: now() } : table)));
    return token;
  }
  await updateDoc(doc(db, tablesCollection, tableId), { publicToken: token, updatedAt: now() });
  return token;
}

export async function upsertCafeUser(uidValue: string, email: string, role: 'owner' | 'manager', cafeId = DEFAULT_CAFE_ID) {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(doc(db, 'cafeUsers', uidValue), { uid: uidValue, email, role, cafeId, updatedAt: now(), createdAt: now() }, { merge: true });
}

export const formatCurrency = (value: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);

export const statusLabel: Record<TableStatus, string> = {
  empty: 'Empty',
  occupied: 'Occupied',
  payment_pending: 'Payment Pending',
  closed: 'Closed'
};
