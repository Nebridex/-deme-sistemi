'use client';

import { FirebaseError } from 'firebase/app';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { assertFirebaseConfigured } from '@/lib/firebase';
import { DEFAULT_CAFE_ID } from '@/lib/domain/constants';
import { generatePublicToken } from '@/lib/domain/token';
import { calculateTableTotals } from '@/lib/domain/totals';
import {
  callBackendRecomputeTableAggregates,
  callBackendRotatePublicToken,
  callBackendSyncPublicProjection
} from '@/lib/backendIntegrity';
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

const now = () => Date.now();

function toFirebaseErrorMessage(err: unknown) {
  if (err instanceof FirebaseError) return `${err.code}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return 'Bilinmeyen Firebase hatası';
}

function reportDevOnlyError(context: string, err: unknown) {
  if (process.env.NODE_ENV !== 'production') {
    console.error(`[firestore] ${context}`, err);
  }
}

function toUserErrorMessage(err: unknown, fallback: string) {
  if (process.env.NODE_ENV !== 'production') {
    return `${fallback} (${toFirebaseErrorMessage(err)})`;
  }
  return fallback;
}

async function logTableActivity(input: Omit<TableActivityLog, 'id' | 'createdAt'>) {
  const { db } = assertFirebaseConfigured();
  await addDoc(collection(db, logsCollection), { ...input, createdAt: now() });
}

async function safeLogTableActivity(input: Omit<TableActivityLog, 'id' | 'createdAt'>) {
  try {
    await logTableActivity(input);
  } catch (err) {
    reportDevOnlyError('Opsiyonel aktivite logu yazılamadı', err);
  }
}

async function syncPublicTableProjectionDirect(tableId: string, cafeId: string) {
  const { db } = assertFirebaseConfigured();
  const tableSnap = await getDoc(doc(db, tablesCollection, tableId));
  if (!tableSnap.exists()) return;

  const table = { id: tableSnap.id, ...(tableSnap.data() as Omit<CafeTable, 'id'>) };
  const itemsSnap = await getDocs(
    query(
      collection(db, itemsCollection),
      where('tableId', '==', tableId),
      where('cafeId', '==', cafeId),
      where('deletedAt', '==', null)
    )
  );
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

export async function syncPublicTableProjection(tableId: string, cafeId: string) {
  const usedFunction = await callBackendSyncPublicProjection({ tableId, cafeId });
  if (usedFunction) return;
  await syncPublicTableProjectionDirect(tableId, cafeId);
}

async function recomputeTableAggregatesDirect(tableId: string, cafeId: string) {
  const { db } = assertFirebaseConfigured();
  const itemsSnap = await getDocs(
    query(
      collection(db, itemsCollection),
      where('tableId', '==', tableId),
      where('cafeId', '==', cafeId),
      where('deletedAt', '==', null)
    )
  );
  const items = itemsSnap.docs.map((d) => d.data() as TableItem);
  const totals = calculateTableTotals(items);

  const tableSnap = await getDoc(doc(db, tablesCollection, tableId));
  if (!tableSnap.exists()) return;

  const table = tableSnap.data() as Omit<CafeTable, 'id'>;
  const status: TableStatus = totals.itemCount === 0
    ? 'empty'
    : table.status === 'payment_pending' || table.status === 'closed'
      ? table.status
      : 'occupied';

  await updateDoc(doc(db, tablesCollection, tableId), {
    ...totals,
    status,
    updatedAt: now(),
    lastActivityAt: now()
  });

  await syncPublicTableProjectionDirect(tableId, cafeId);
}

export async function recomputeTableAggregates(tableId: string, cafeId: string) {
  const usedFunction = await callBackendRecomputeTableAggregates({ tableId, cafeId });
  if (usedFunction) return;
  await recomputeTableAggregatesDirect(tableId, cafeId);
}

export function subscribeTables(cafeId: string, callback: (tables: CafeTable[]) => void, onError?: (message: string) => void) {
  const { db } = assertFirebaseConfigured();
  const q = query(collection(db, tablesCollection), where('cafeId', '==', cafeId), where('deletedAt', '==', null), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CafeTable, 'id'>) }))), (err) => onError?.(err.message));
}

export function subscribeTableById(tableId: string, callback: (table: CafeTable | null) => void, onError?: (message: string) => void) {
  const { db } = assertFirebaseConfigured();
  return onSnapshot(
    doc(db, tablesCollection, tableId),
    (snap) => {
      if (!snap.exists()) return callback(null);
      const table = { id: snap.id, ...(snap.data() as Omit<CafeTable, 'id'>) };
      callback(table.deletedAt ? null : table);
    },
    (err) => onError?.(err.message)
  );
}

export function subscribePublicTableByToken(token: string, callback: (table: PublicTableProjection | null) => void, onError?: (message: string) => void) {
  const { db } = assertFirebaseConfigured();
  return onSnapshot(
    doc(db, publicTablesCollection, token),
    (snap) => {
      if (!snap.exists()) return callback(null);
      const data = snap.data() as Omit<PublicTableProjection, 'id'>;
      callback(data.deletedAt ? null : { id: snap.id, ...data });
    },
    (err) => onError?.(err.message)
  );
}

export function subscribeTableItems(cafeId: string, tableId: string, callback: (items: TableItem[]) => void, onError?: (message: string) => void) {
  const { db } = assertFirebaseConfigured();
  const q = query(collection(db, itemsCollection), where('cafeId', '==', cafeId), where('tableId', '==', tableId), where('deletedAt', '==', null), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TableItem, 'id'>) }))), (err) => onError?.(err.message));
}

export function subscribeTableActivityLogs(cafeId: string, tableId: string, callback: (logs: TableActivityLog[]) => void, onError?: (message: string) => void) {
  const { db } = assertFirebaseConfigured();
  const q = query(collection(db, logsCollection), where('cafeId', '==', cafeId), where('tableId', '==', tableId), orderBy('createdAt', 'desc'), limit(8));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TableActivityLog, 'id'>) }))), (err) => onError?.(err.message));
}

export async function createTable(name: string, actor?: AdminIdentity | null, cafeId = DEFAULT_CAFE_ID) {
  const { db } = assertFirebaseConfigured();
  const timestamp = now();
  const token = generatePublicToken();
  const effectiveCafeId = actor?.cafeId ?? cafeId;

  const table: Omit<CafeTable, 'id'> = {
    cafeId: effectiveCafeId,
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

  const ref = await addDoc(collection(db, tablesCollection), table);
  try {
    await syncPublicTableProjection(ref.id, effectiveCafeId);
  } catch (err) {
    reportDevOnlyError(`Opsiyonel public projection senkronu başarısız: ${ref.id}`, err);
  }
  await safeLogTableActivity({ tableId: ref.id, cafeId: effectiveCafeId, actionType: 'table_created', message: `${name} oluşturuldu`, actorType: 'admin', actorId: actor?.uid ?? null });
}

export async function updateTable(tableId: string, payload: Partial<Pick<CafeTable, 'name' | 'status'>>, actor?: AdminIdentity | null) {
  const { db } = assertFirebaseConfigured();
  const tableSnap = await getDoc(doc(db, tablesCollection, tableId));
  if (!tableSnap.exists()) throw new Error('Masa bulunamadı.');
  const table = tableSnap.data() as Omit<CafeTable, 'id'>;

  await updateDoc(doc(db, tablesCollection, tableId), { ...payload, updatedAt: now(), lastActivityAt: now() });
  try {
    await syncPublicTableProjection(tableId, table.cafeId);
  } catch (err) {
    reportDevOnlyError(`Opsiyonel public projection senkronu başarısız: ${tableId}`, err);
  }

  if (payload.name) await safeLogTableActivity({ tableId, cafeId: table.cafeId, actionType: 'table_renamed', message: `Masa adı "${payload.name}" olarak güncellendi`, actorType: 'admin', actorId: actor?.uid ?? null });
  if (payload.status) await safeLogTableActivity({ tableId, cafeId: table.cafeId, actionType: 'table_status_changed', message: `Durum ${statusLabel[payload.status]} olarak değiştirildi`, actorType: 'admin', actorId: actor?.uid ?? null });
}

export async function rotateTableToken(table: CafeTable, actor: AdminIdentity) {
  const functionToken = await callBackendRotatePublicToken({ tableId: table.id, actorUid: actor.uid });
  if (functionToken) return functionToken;

  const { db } = assertFirebaseConfigured();
  if (actor.role !== 'owner') throw new Error('Sadece işletme sahibi QR bağlantısını yenileyebilir.');

  const newToken = generatePublicToken();
  const previousToken = table.publicToken;

  await updateDoc(doc(db, tablesCollection, table.id), { publicToken: newToken, updatedAt: now(), lastActivityAt: now() });
  const previousProjectionSnap = await getDoc(doc(db, publicTablesCollection, previousToken));
  if (previousProjectionSnap.exists()) await deleteDoc(doc(db, publicTablesCollection, previousToken));
  try {
    await syncPublicTableProjection(table.id, table.cafeId);
  } catch (err) {
    reportDevOnlyError(`Opsiyonel public projection senkronu başarısız: ${table.id}`, err);
  }
  await safeLogTableActivity({ tableId: table.id, cafeId: table.cafeId, actionType: 'token_rotated', message: 'QR bağlantısı yenilendi', actorType: 'admin', actorId: actor.uid });
  return newToken;
}

export async function softDeleteTable(tableId: string, actor?: AdminIdentity | null) {
  const { db } = assertFirebaseConfigured();
  const tableSnap = await getDoc(doc(db, tablesCollection, tableId));
  if (!tableSnap.exists()) throw new Error('Masa bulunamadı.');
  const table = tableSnap.data() as Omit<CafeTable, 'id'>;

  await updateDoc(doc(db, tablesCollection, tableId), { deletedAt: now(), updatedAt: now() });
  const itemsSnap = await getDocs(query(collection(db, itemsCollection), where('tableId', '==', tableId), where('deletedAt', '==', null)));
  await Promise.all(itemsSnap.docs.map((d) => updateDoc(doc(db, itemsCollection, d.id), { deletedAt: now(), updatedAt: now() })));

  try {
    await syncPublicTableProjection(tableId, table.cafeId);
  } catch (err) {
    reportDevOnlyError(`Opsiyonel public projection senkronu başarısız: ${tableId}`, err);
  }
  await safeLogTableActivity({ tableId, cafeId: table.cafeId, actionType: 'table_deleted', message: 'Masa arşive alındı', actorType: 'admin', actorId: actor?.uid ?? null });
}

export async function addTableItem(tableId: string, cafeId: string, name: string, quantity: number, unitPrice: number, actor?: AdminIdentity | null) {
  const { db } = assertFirebaseConfigured();
  const timestamp = now();
  const item: Omit<TableItem, 'id'> = { tableId, cafeId, name, quantity, unitPrice, totalPrice: quantity * unitPrice, deletedAt: null, createdAt: timestamp, updatedAt: timestamp };
  await addDoc(collection(db, itemsCollection), item);
  await recomputeTableAggregates(tableId, cafeId);
  await safeLogTableActivity({ tableId, cafeId, actionType: 'item_added', message: `${name} eklendi`, actorType: 'admin', actorId: actor?.uid ?? null });
}

export async function editTableItem(itemId: string, payload: Pick<TableItem, 'name' | 'quantity' | 'unitPrice' | 'tableId' | 'cafeId'>, actor?: AdminIdentity | null) {
  const { db } = assertFirebaseConfigured();
  const totalPrice = payload.quantity * payload.unitPrice;
  await updateDoc(doc(db, itemsCollection, itemId), { ...payload, totalPrice, updatedAt: now() });
  await recomputeTableAggregates(payload.tableId, payload.cafeId);
  await safeLogTableActivity({ tableId: payload.tableId, cafeId: payload.cafeId, actionType: 'item_edited', message: `${payload.name} güncellendi`, actorType: 'admin', actorId: actor?.uid ?? null });
}

export async function softDeleteTableItem(itemId: string, tableId: string, cafeId: string, actor?: AdminIdentity | null) {
  const { db } = assertFirebaseConfigured();
  await updateDoc(doc(db, itemsCollection, itemId), { deletedAt: now(), updatedAt: now() });
  await recomputeTableAggregates(tableId, cafeId);
  await safeLogTableActivity({ tableId, cafeId, actionType: 'item_removed', message: 'Ürün kaldırıldı', actorType: 'admin', actorId: actor?.uid ?? null });
}

export function formatFirestoreActionError(err: unknown, fallback: string) {
  reportDevOnlyError(fallback, err);
  return toUserErrorMessage(err, fallback);
}

export function mapPublicProjectionToBillView(projection: PublicTableProjection): PublicTableBillView {
  return { tableName: projection.tableName, status: projection.status, itemCount: projection.itemCount, totalAmount: projection.totalAmount, items: projection.items };
}

export async function upsertCafeUser(uidValue: string, email: string, role: 'owner' | 'manager', cafeId = DEFAULT_CAFE_ID) {
  const { db } = assertFirebaseConfigured();
  await setDoc(doc(db, 'cafeUsers', uidValue), { uid: uidValue, email, role, cafeId, updatedAt: now(), createdAt: now() }, { merge: true });
}

export const formatCurrency = (value: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(value);

export const statusLabel: Record<TableStatus, string> = {
  empty: 'Boş',
  occupied: 'Dolu',
  payment_pending: 'Ödeme Bekliyor',
  closed: 'Kapalı'
};
