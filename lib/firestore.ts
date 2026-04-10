'use client';

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  getDocs
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import type { CafeTable, TableItem, TableStatus } from '@/types';
import { getItemsMock, getTablesMock, saveItemsMock, saveTablesMock } from '@/lib/mockStore';

const tablesCollection = 'tables';
const itemsCollection = 'tableItems';

const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => Date.now();

export function subscribeTables(callback: (tables: CafeTable[]) => void) {
  if (!isFirebaseConfigured || !db) {
    const emit = () => callback(getTablesMock());
    emit();
    window.addEventListener('mock-db-updated', emit);
    return () => window.removeEventListener('mock-db-updated', emit);
  }

  const q = query(collection(db, tablesCollection), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    const tables = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CafeTable, 'id'>) }));
    callback(tables);
  });
}

export function subscribeTable(tableId: string, callback: (table: CafeTable | null) => void) {
  if (!isFirebaseConfigured || !db) {
    const emit = () => callback(getTablesMock().find((t) => t.id === tableId) ?? null);
    emit();
    window.addEventListener('mock-db-updated', emit);
    return () => window.removeEventListener('mock-db-updated', emit);
  }

  return onSnapshot(doc(db, tablesCollection, tableId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback({ id: snap.id, ...(snap.data() as Omit<CafeTable, 'id'>) });
  });
}

export function subscribeTableItems(tableId: string, callback: (items: TableItem[]) => void) {
  if (!isFirebaseConfigured || !db) {
    const emit = () => callback(getItemsMock().filter((i) => i.tableId === tableId));
    emit();
    window.addEventListener('mock-db-updated', emit);
    return () => window.removeEventListener('mock-db-updated', emit);
  }

  const q = query(collection(db, itemsCollection), where('tableId', '==', tableId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TableItem, 'id'>) }));
    callback(items);
  });
}

async function recalcTableTotals(tableId: string) {
  if (!isFirebaseConfigured || !db) {
    const tables = getTablesMock();
    const items = getItemsMock().filter((i) => i.tableId === tableId);
    const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    saveTablesMock(
      tables.map((t) => (t.id === tableId ? { ...t, totalAmount, itemCount, updatedAt: now() } : t))
    );
    return;
  }

  const itemsSnap = await getDocs(query(collection(db, itemsCollection), where('tableId', '==', tableId)));
  const items = itemsSnap.docs.map((d) => d.data() as Omit<TableItem, 'id'>);
  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  await updateDoc(doc(db, tablesCollection, tableId), { totalAmount, itemCount, updatedAt: now() });
}

export async function createTable(name: string) {
  const timestamp = now();
  const table: Omit<CafeTable, 'id'> = {
    name,
    code: name.toLowerCase().replace(/\s+/g, '-'),
    status: 'active',
    totalAmount: 0,
    itemCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  if (!isFirebaseConfigured || !db) {
    const id = `table-${uid()}`;
    saveTablesMock([...getTablesMock(), { id, ...table }]);
    return;
  }

  await addDoc(collection(db, tablesCollection), table);
}

export async function updateTable(tableId: string, payload: Partial<Pick<CafeTable, 'name' | 'status'>>) {
  if (!isFirebaseConfigured || !db) {
    saveTablesMock(getTablesMock().map((t) => (t.id === tableId ? { ...t, ...payload, updatedAt: now() } : t)));
    return;
  }

  await updateDoc(doc(db, tablesCollection, tableId), { ...payload, updatedAt: now() });
}

export async function deleteTable(tableId: string) {
  if (!isFirebaseConfigured || !db) {
    saveTablesMock(getTablesMock().filter((t) => t.id !== tableId));
    saveItemsMock(getItemsMock().filter((i) => i.tableId !== tableId));
    return;
  }

  const itemsSnap = await getDocs(query(collection(db, itemsCollection), where('tableId', '==', tableId)));
  await Promise.all(itemsSnap.docs.map((d) => deleteDoc(doc(db, itemsCollection, d.id))));
  await deleteDoc(doc(db, tablesCollection, tableId));
}

export async function addTableItem(tableId: string, name: string, quantity: number, unitPrice: number) {
  const timestamp = now();
  const totalPrice = quantity * unitPrice;
  const item: Omit<TableItem, 'id'> = { tableId, name, quantity, unitPrice, totalPrice, createdAt: timestamp, updatedAt: timestamp };

  if (!isFirebaseConfigured || !db) {
    saveItemsMock([...getItemsMock(), { id: `item-${uid()}`, ...item }]);
    await recalcTableTotals(tableId);
    return;
  }

  await addDoc(collection(db, itemsCollection), item);
  await recalcTableTotals(tableId);
}

export async function editTableItem(itemId: string, payload: Pick<TableItem, 'name' | 'quantity' | 'unitPrice' | 'tableId'>) {
  const totalPrice = payload.quantity * payload.unitPrice;

  if (!isFirebaseConfigured || !db) {
    saveItemsMock(
      getItemsMock().map((i) =>
        i.id === itemId ? { ...i, name: payload.name, quantity: payload.quantity, unitPrice: payload.unitPrice, totalPrice, updatedAt: now() } : i
      )
    );
    await recalcTableTotals(payload.tableId);
    return;
  }

  await updateDoc(doc(db, itemsCollection, itemId), { ...payload, totalPrice, updatedAt: now() });
  await recalcTableTotals(payload.tableId);
}

export async function removeTableItem(itemId: string, tableId: string) {
  if (!isFirebaseConfigured || !db) {
    saveItemsMock(getItemsMock().filter((i) => i.id !== itemId));
    await recalcTableTotals(tableId);
    return;
  }

  await deleteDoc(doc(db, itemsCollection, itemId));
  await recalcTableTotals(tableId);
}

export async function upsertUser(uidValue: string, email: string) {
  if (!isFirebaseConfigured || !db) return;
  await setDoc(doc(db, 'users', uidValue), { uid: uidValue, email, role: 'admin' }, { merge: true });
}

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);

export const statusLabel: Record<TableStatus, string> = {
  active: 'Active',
  occupied: 'Occupied'
};
