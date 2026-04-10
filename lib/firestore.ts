'use client';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { DEFAULT_CAFE_ID } from '@/lib/domain/constants';
import { generatePublicToken } from '@/lib/domain/token';
import { calculateTableTotals } from '@/lib/domain/totals';
import {
  getItemsMock,
  getLogsMock,
  getPublicTablesMock,
  getTablesMock,
  saveItemsMock,
  saveLogsMock,
  savePublicTablesMock,
  saveTablesMock
} from '@/lib/mockStore';
import type {
  AdminIdentity,
  CafeTable,
  PublicTableBillView,
  PublicTableProjection,
  TableActivityLog,
  TableItem,
  TableStatus
} from '@/types';

const tablesCollection = 'tables';
const itemsCollection = 'tableItems';
const logsCollection = 'tableActivityLogs';
const publicTablesCollection = 'publicTables';

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => Date.now();

const activeItems = (items: TableItem[]) => items.filter((i) => i.deletedAt === null);
const activeTables = (tables: CafeTable[]) => tables.filter((t) => t.deletedAt === null);

async function logTableActivity(input: Omit<TableActivityLog, 'id' | 'createdAt'>) {
  const logEntry: TableActivityLog = { ...input, id: `log-${uid()}`, createdAt: now() };
  if (!isFirebaseConfigured || !db) {
    saveLogsMock([logEntry, ...getLogsMock()]);
    return;
  }
  await addDoc(collection(db, logsCollection), { ...logEntry, id: undefined });
}

export async function syncPublicTableProjection(tableId: string, cafeId: string) {
  if (!isFirebaseConfigured || !db) {
    const table = getTablesMock().find((t) => t.id === tableId);
    if (!table) return;
    const items = activeItems(getItemsMock().filter((i) => i.tableId === tableId));
    const projection: PublicTableProjection = {
      id: table.publicToken,
      cafeId,
      tableId,
      publicToken: table.publicToken,
      tableName: table.name,
      status: table.status,
      itemCount: table.itemCount,
      totalAmount: table.totalAmount,
      items: items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice })),
      updatedAt: now(),
      deletedAt: table.deletedAt
    };

    const others = getPublicTablesMock().filter((p) => p.tableId !== tableId && p.id !== projection.id);
    savePublicTablesMock([...others, projection]);
    return;
  }

  const tableSnap = await getDocs(query(collection(db, tablesCollection), where('__name__', '==', tableId), limit(1)));
  const tableDoc = tableSnap.docs[0];
  if (!tableDoc) return;
  const table = { id: tableDoc.id, ...(tableDoc.data() as Omit<CafeTable, 'id'>) };
  const itemsSnap = await getDocs(query(collection(db, itemsCollection), where('tableId', '==', tableId), where('deletedAt', '==', null)));
  const items = itemsSnap.docs.map((d) => d.data() as TableItem);

  const projection = {
    cafeId,
    tableId,
    publicToken: table.publicToken,
    tableName: table.name,
    status: table.status,
    itemCount: table.itemCount,
    totalAmount: table.totalAmount,
    items: items.map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice })),
    updatedAt: now(),
    deletedAt: table.deletedAt
  };

  await setDoc(doc(db, publicTablesCollection, table.publicToken), projection, { merge: true });
}

export async function recomputeTableAggregates(tableId: string, cafeId: string) {
  if (!isFirebaseConfigured || !db) {
    const tables = getTablesMock();
    const items = activeItems(getItemsMock().filter((i) => i.tableId === tableId));
    const totals = calculateTableTotals(items);
    saveTablesMock(
      tables.map((t) =>
        t.id === tableId
          ? {
              ...t,
              ...totals,
              status: totals.itemCount === 0 ? 'empty' : t.status === 'payment_pending' || t.status === 'closed' ? t.status : 'occupied',
              updatedAt: now(),
              lastActivityAt: now()
            }
          : t
      )
    );
    await syncPublicTableProjection(tableId, cafeId);
    return;
  }

  const itemsSnap = await getDocs(query(collection(db, itemsCollection), where('tableId', '==', tableId), where('deletedAt', '==', null)));
  const items = itemsSnap.docs.map((d) => d.data() as TableItem);
  const totals = calculateTableTotals(items);
  await updateDoc(doc(db, tablesCollection, tableId), { ...totals, updatedAt: now(), lastActivityAt: now() });
  await syncPublicTableProjection(tableId, cafeId);
}

export function subscribeTables(cafeId: string, callback: (tables: CafeTable[]) => void) {
  if (!isFirebaseConfigured || !db) {
    const emit = () => callback(activeTables(getTablesMock()).filter((t) => t.cafeId === cafeId));
    emit();
    window.addEventListener('mock-db-updated', emit);
    return () => window.removeEventListener('mock-db-updated', emit);
  }

  const q = query(collection(db, tablesCollection), where('cafeId', '==', cafeId), where('deletedAt', '==', null), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CafeTable, 'id'>) }))));
}

export function subscribeTableById(tableId: string, callback: (table: CafeTable | null) => void) {
  if (!isFirebaseConfigured || !db) {
    const emit = () => callback(activeTables(getTablesMock()).find((t) => t.id === tableId) ?? null);
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

export function subscribePublicTableByToken(token: string, callback: (table: PublicTableProjection | null) => void) {
  if (!isFirebaseConfigured || !db) {
    const emit = () => callback(getPublicTablesMock().find((p) => p.publicToken === token && p.deletedAt === null) ?? null);
    emit();
    window.addEventListener('mock-db-updated', emit);
    return () => window.removeEventListener('mock-db-updated', emit);
  }

  return onSnapshot(doc(db, publicTablesCollection, token), (snap) => {
    if (!snap.exists()) return callback(null);
    const data = snap.data() as Omit<PublicTableProjection, 'id'>;
    callback(data.deletedAt ? null : { id: snap.id, ...data });
  });
}

export function subscribeTableItems(tableId: string, callback: (items: TableItem[]) => void) {
  if (!isFirebaseConfigured || !db) {
    const emit = () => callback(activeItems(getItemsMock()).filter((i) => i.tableId === tableId));
    emit();
    window.addEventListener('mock-db-updated', emit);
    return () => window.removeEventListener('mock-db-updated', emit);
  }
  const q = query(collection(db, itemsCollection), where('tableId', '==', tableId), where('deletedAt', '==', null), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TableItem, 'id'>) }))));
}

export function subscribeTableActivityLogs(tableId: string, callback: (logs: TableActivityLog[]) => void) {
  if (!isFirebaseConfigured || !db) {
    const emit = () => callback(getLogsMock().filter((l) => l.tableId === tableId).sort((a, b) => b.createdAt - a.createdAt).slice(0, 8));
    emit();
    window.addEventListener('mock-db-updated', emit);
    return () => window.removeEventListener('mock-db-updated', emit);
  }
  const q = query(collection(db, logsCollection), where('tableId', '==', tableId), orderBy('createdAt', 'desc'), limit(8));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TableActivityLog, 'id'>) }))));
}

export async function createTable(name: string, actor?: AdminIdentity | null, cafeId = DEFAULT_CAFE_ID) {
  const timestamp = now();
  const token = generatePublicToken();
  const table: Omit<CafeTable, 'id'> = {
    cafeId,
    name,
    publicToken: token,
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
    await syncPublicTableProjection(id, cafeId);
    await logTableActivity({ tableId: id, cafeId, actionType: 'table_created', message: `${name} created`, actorType: 'admin', actorId: actor?.uid ?? null });
    return;
  }

  const ref = await addDoc(collection(db, tablesCollection), table);
  await syncPublicTableProjection(ref.id, cafeId);
  await logTableActivity({ tableId: ref.id, cafeId, actionType: 'table_created', message: `${name} created`, actorType: 'admin', actorId: actor?.uid ?? null });
}

export async function updateTable(tableId: string, payload: Partial<Pick<CafeTable, 'name' | 'status'>>, actor?: AdminIdentity | null) {
  const table = getTablesMock().find((t) => t.id === tableId);
  const cafeId = table?.cafeId ?? DEFAULT_CAFE_ID;

  if (!isFirebaseConfigured || !db) {
    saveTablesMock(getTablesMock().map((t) => (t.id === tableId ? { ...t, ...payload, updatedAt: now(), lastActivityAt: now() } : t)));
    await syncPublicTableProjection(tableId, cafeId);
    if (payload.name) await logTableActivity({ tableId, cafeId, actionType: 'table_renamed', message: `Renamed to ${payload.name}`, actorType: 'admin', actorId: actor?.uid ?? null });
    if (payload.status) await logTableActivity({ tableId, cafeId, actionType: 'table_status_changed', message: `Status changed to ${payload.status}`, actorType: 'admin', actorId: actor?.uid ?? null });
    return;
  }

  await updateDoc(doc(db, tablesCollection, tableId), { ...payload, updatedAt: now(), lastActivityAt: now() });
  const tableSnap = await getDocs(query(collection(db, tablesCollection), where('__name__', '==', tableId), limit(1)));
  const tableDoc = tableSnap.docs[0];
  if (tableDoc) {
    await syncPublicTableProjection(tableId, (tableDoc.data() as CafeTable).cafeId);
  }
}

export async function rotateTableToken(table: CafeTable, actor: AdminIdentity) {
  if (actor.role !== 'owner') throw new Error('Only owner can rotate token.');
  const newToken = generatePublicToken();

  if (!isFirebaseConfigured || !db) {
    const previousToken = table.publicToken;
    saveTablesMock(getTablesMock().map((t) => (t.id === table.id ? { ...t, publicToken: newToken, updatedAt: now(), lastActivityAt: now() } : t)));
    savePublicTablesMock(getPublicTablesMock().filter((p) => p.id !== previousToken));
    await syncPublicTableProjection(table.id, table.cafeId);
    await logTableActivity({ tableId: table.id, cafeId: table.cafeId, actionType: 'token_rotated', message: 'Public token rotated', actorType: 'admin', actorId: actor.uid });
    return newToken;
  }

  const previousToken = table.publicToken;
  await updateDoc(doc(db, tablesCollection, table.id), { publicToken: newToken, updatedAt: now(), lastActivityAt: now() });
  await deleteDoc(doc(db, publicTablesCollection, previousToken));
  await syncPublicTableProjection(table.id, table.cafeId);
  await logTableActivity({ tableId: table.id, cafeId: table.cafeId, actionType: 'token_rotated', message: 'Public token rotated', actorType: 'admin', actorId: actor.uid });
  return newToken;
}

export async function softDeleteTable(tableId: string, actor?: AdminIdentity | null) {
  const table = getTablesMock().find((t) => t.id === tableId);
  const cafeId = table?.cafeId ?? DEFAULT_CAFE_ID;

  if (!isFirebaseConfigured || !db) {
    saveTablesMock(getTablesMock().map((t) => (t.id === tableId ? { ...t, deletedAt: now(), updatedAt: now() } : t)));
    saveItemsMock(getItemsMock().map((item) => (item.tableId === tableId ? { ...item, deletedAt: now(), updatedAt: now() } : item)));
    await recomputeTableAggregates(tableId, cafeId);
    await syncPublicTableProjection(tableId, cafeId);
    await logTableActivity({ tableId, cafeId, actionType: 'table_deleted', message: 'Table soft-deleted', actorType: 'admin', actorId: actor?.uid ?? null });
    return;
  }

  await updateDoc(doc(db, tablesCollection, tableId), { deletedAt: now(), updatedAt: now() });
  await syncPublicTableProjection(tableId, cafeId);
}

export async function addTableItem(tableId: string, cafeId: string, name: string, quantity: number, unitPrice: number, actor?: AdminIdentity | null) {
  const timestamp = now();
  const item: Omit<TableItem, 'id'> = { tableId, cafeId, name, quantity, unitPrice, totalPrice: quantity * unitPrice, deletedAt: null, createdAt: timestamp, updatedAt: timestamp };

  if (!isFirebaseConfigured || !db) {
    saveItemsMock([...getItemsMock(), { id: `item-${uid()}`, ...item }]);
    await recomputeTableAggregates(tableId, cafeId);
    await logTableActivity({ tableId, cafeId, actionType: 'item_added', message: `${name} added`, actorType: 'admin', actorId: actor?.uid ?? null });
    return;
  }

  await addDoc(collection(db, itemsCollection), item);
  await recomputeTableAggregates(tableId, cafeId);
}

export async function editTableItem(itemId: string, payload: Pick<TableItem, 'name' | 'quantity' | 'unitPrice' | 'tableId' | 'cafeId'>, actor?: AdminIdentity | null) {
  const totalPrice = payload.quantity * payload.unitPrice;
  if (!isFirebaseConfigured || !db) {
    saveItemsMock(getItemsMock().map((i) => (i.id === itemId ? { ...i, name: payload.name, quantity: payload.quantity, unitPrice: payload.unitPrice, totalPrice, updatedAt: now() } : i)));
    await recomputeTableAggregates(payload.tableId, payload.cafeId);
    await logTableActivity({ tableId: payload.tableId, cafeId: payload.cafeId, actionType: 'item_edited', message: `${payload.name} updated`, actorType: 'admin', actorId: actor?.uid ?? null });
    return;
  }

  await updateDoc(doc(db, itemsCollection, itemId), { ...payload, totalPrice, updatedAt: now() });
  await recomputeTableAggregates(payload.tableId, payload.cafeId);
}

export async function softDeleteTableItem(itemId: string, tableId: string, cafeId: string, actor?: AdminIdentity | null) {
  if (!isFirebaseConfigured || !db) {
    saveItemsMock(getItemsMock().map((i) => (i.id === itemId ? { ...i, deletedAt: now(), updatedAt: now() } : i)));
    await recomputeTableAggregates(tableId, cafeId);
    await logTableActivity({ tableId, cafeId, actionType: 'item_removed', message: 'Item removed', actorType: 'admin', actorId: actor?.uid ?? null });
    return;
  }

  await updateDoc(doc(db, itemsCollection, itemId), { deletedAt: now(), updatedAt: now() });
  await recomputeTableAggregates(tableId, cafeId);
}

export function mapPublicProjectionToBillView(projection: PublicTableProjection): PublicTableBillView {
  return {
    tableName: projection.tableName,
    status: projection.status,
    itemCount: projection.itemCount,
    totalAmount: projection.totalAmount,
    items: projection.items
  };
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
