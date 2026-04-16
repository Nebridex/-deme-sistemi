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
  CompletedSession,
  TableActivityLog,
  TableItem,
  TableStatus,
  ServiceEntityType
} from '@/types';

const tablesCollection = 'tables';
const itemsCollection = 'tableItems';
const logsCollection = 'tableActivityLogs';
const publicTablesCollection = 'publicTables';
const completedSessionsCollection = 'completedSessions';

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
  const tableSnap = await getDoc(doc(db, tablesCollection, tableId));
  if (!tableSnap.exists()) return;
  const table = tableSnap.data() as Omit<CafeTable, 'id'>;
  const effectiveCafeId = table.cafeId ?? cafeId ?? DEFAULT_CAFE_ID;
  const itemsSnap = await getDocs(
    query(
      collection(db, itemsCollection),
      where('tableId', '==', tableId),
      where('deletedAt', '==', null)
    )
  );
  const items = itemsSnap.docs.map((d) => d.data() as TableItem);
  const totals = calculateTableTotals(items);
  const status: TableStatus = totals.itemCount === 0
    ? 'empty'
    : table.status === 'payment_pending' || table.status === 'closed'
      ? table.status
      : 'occupied';
  const timestamp = now();
  const updates: Record<string, unknown> = {
    ...totals,
    status,
    entityType: table.entityType ?? 'fixed_table',
    updatedAt: timestamp,
    lastActivityAt: timestamp
  };
  if (status !== table.status) updates.lastStatusChangedAt = timestamp;
  if (!table.cafeId) updates.cafeId = effectiveCafeId;
  if (['occupied', 'payment_pending'].includes(status) && !['occupied', 'payment_pending'].includes(table.status)) {
    updates.openedAt = timestamp;
  }
  await updateDoc(doc(db, tablesCollection, tableId), updates);

  await syncPublicTableProjectionDirect(tableId, effectiveCafeId);
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

export function subscribeCafeActivityLogs(cafeId: string, callback: (logs: TableActivityLog[]) => void, onError?: (message: string) => void) {
  const { db } = assertFirebaseConfigured();
  const q = query(collection(db, logsCollection), where('cafeId', '==', cafeId), orderBy('createdAt', 'desc'), limit(12));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TableActivityLog, 'id'>) }))), (err) => onError?.(err.message));
}

export function subscribeTodayClosedLogs(cafeId: string, sinceTimestamp: number, callback: (logs: TableActivityLog[]) => void, onError?: (message: string) => void) {
  const { db } = assertFirebaseConfigured();
  const q = query(
    collection(db, logsCollection),
    where('cafeId', '==', cafeId),
    where('actionType', '==', 'table_closed'),
    where('createdAt', '>=', sinceTimestamp),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TableActivityLog, 'id'>) }))), (err) => onError?.(err.message));
}

export function subscribeRecentTableItems(cafeId: string, sinceTimestamp: number, callback: (items: TableItem[]) => void, onError?: (message: string) => void) {
  const { db } = assertFirebaseConfigured();
  const q = query(
    collection(db, itemsCollection),
    where('cafeId', '==', cafeId),
    where('createdAt', '>=', sinceTimestamp),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TableItem, 'id'>) }))), (err) => onError?.(err.message));
}

export function subscribeCompletedSessions(cafeId: string, callback: (sessions: CompletedSession[]) => void, onError?: (message: string) => void) {
  const { db } = assertFirebaseConfigured();
  const q = query(collection(db, completedSessionsCollection), where('cafeId', '==', cafeId), orderBy('closedAt', 'desc'), limit(12));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CompletedSession, 'id'>) }))), (err) => onError?.(err.message));
}

async function createCompletedSessionSnapshot(tableId: string, actor?: AdminIdentity | null) {
  const { db, auth } = assertFirebaseConfigured();
  const tableSnap = await getDoc(doc(db, tablesCollection, tableId));
  if (!tableSnap.exists()) throw new Error('Masa bulunamadı.');
  const table = { id: tableSnap.id, ...(tableSnap.data() as Omit<CafeTable, 'id'>) };
  const cafeId = actor?.cafeId ?? table.cafeId ?? DEFAULT_CAFE_ID;

  const itemsSnap = await getDocs(
    query(
      collection(db, itemsCollection),
      where('tableId', '==', tableId),
      where('cafeId', '==', cafeId),
      where('deletedAt', '==', null)
    )
  );
  const items = itemsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TableItem, 'id'>) }));
  const timestamp = now();
  const openedAt = table.openedAt ?? table.lastActivityAt ?? table.createdAt;
  const entityType = table.entityType ?? 'fixed_table';
  const payload = {
    cafeId,
    sourceTableId: table.id,
    sourceTableName: table.name,
    sourceEntityType: entityType,
    publicToken: entityType === 'fixed_table' ? table.publicToken : null,
    totalAmount: table.totalAmount,
    itemCount: table.itemCount,
    items: items.map((item) => ({ name: item.name, quantity: item.quantity, unitPrice: item.unitPrice, totalPrice: item.totalPrice })),
    openedAt,
    closedAt: timestamp,
    closedBy: actor?.uid ?? null,
    createdAt: timestamp
  } satisfies Omit<CompletedSession, 'id'>;

  if (process.env.NODE_ENV !== 'production') {
    const requiredFieldChecks = {
      cafeId: typeof payload.cafeId === 'string',
      sourceEntityType: payload.sourceEntityType === 'fixed_table' || payload.sourceEntityType === 'temporary_order',
      sourceTableId: typeof payload.sourceTableId === 'string',
      sourceTableName: typeof payload.sourceTableName === 'string' && payload.sourceTableName.length > 0,
      totalAmount: typeof payload.totalAmount === 'number' && payload.totalAmount >= 0,
      itemCount: typeof payload.itemCount === 'number' && payload.itemCount >= 0,
      items: Array.isArray(payload.items),
      itemsShape: Array.isArray(payload.items) && payload.items.every((item) =>
        typeof item.name === 'string'
        && item.name.length > 0
        && typeof item.quantity === 'number'
        && item.quantity > 0
        && typeof item.unitPrice === 'number'
        && item.unitPrice >= 0
        && typeof item.totalPrice === 'number'
        && item.totalPrice >= 0
        && item.totalPrice === item.quantity * item.unitPrice
      ),
      openedAt: payload.openedAt == null || typeof payload.openedAt === 'number',
      closedAt: typeof payload.closedAt === 'number',
      closedBy: payload.closedBy == null || typeof payload.closedBy === 'string',
      createdAt: typeof payload.createdAt === 'number'
    };
    console.log('COMPLETED SESSION AUTH UID:', auth.currentUser?.uid ?? null);
    console.log('COMPLETED SESSION ACTOR UID:', actor?.uid ?? null);
    console.log('COMPLETED SESSION PAYLOAD:', payload);
    console.log('COMPLETED SESSION REQUIRED FIELD CHECKS:', requiredFieldChecks);
  }

  await addDoc(collection(db, completedSessionsCollection), payload);

  return { table: { ...table, cafeId }, items, timestamp };
}

export async function createTable(name: string, actor?: AdminIdentity | null, cafeId = DEFAULT_CAFE_ID) {
  const { db } = assertFirebaseConfigured();
  const timestamp = now();
  const token = generatePublicToken();
  const effectiveCafeId = actor?.cafeId ?? cafeId;

  const table: Omit<CafeTable, 'id'> = {
    cafeId: effectiveCafeId,
    name,
    entityType: 'fixed_table',
    publicToken: token,
    status: 'empty',
    totalAmount: 0,
    itemCount: 0,
    openedAt: null,
    closedAt: null,
    closedAmountSnapshot: null,
    lastStatusChangedAt: timestamp,
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
  const effectiveCafeId = actor?.cafeId ?? table.cafeId ?? DEFAULT_CAFE_ID;

  const timestamp = now();
  const updates: Record<string, unknown> = { ...payload, updatedAt: timestamp, lastActivityAt: timestamp };
  updates.entityType = table.entityType ?? 'fixed_table';
  if ((table.entityType ?? 'fixed_table') === 'fixed_table' && payload.status === 'closed') {
    throw new Error('Sabit masada "Kapalı" durumunu kullanmayın. "Adisyonu Kapat" işlemiyle masa otomatik hazır duruma döner.');
  }
  const previousStatus = table.status;
  const nextStatus = payload.status ?? previousStatus;

  if (payload.status && nextStatus !== previousStatus) {
    updates.lastStatusChangedAt = timestamp;
  }

  if (payload.status && nextStatus === 'closed' && previousStatus !== 'closed') {
    updates.closedAt = timestamp;
    updates.closedAmountSnapshot = table.totalAmount;
  }

  if (payload.status && previousStatus === 'closed' && nextStatus !== 'closed') {
    updates.openedAt = timestamp;
    updates.closedAt = null;
    updates.closedAmountSnapshot = null;
  }

  if (payload.status && ['occupied', 'payment_pending'].includes(nextStatus) && !['occupied', 'payment_pending'].includes(previousStatus)) {
    updates.openedAt = timestamp;
  }

  await updateDoc(doc(db, tablesCollection, tableId), updates);
  try {
    await syncPublicTableProjection(tableId, effectiveCafeId);
  } catch (err) {
    reportDevOnlyError(`Opsiyonel public projection senkronu başarısız: ${tableId}`, err);
  }

  if (payload.name) await safeLogTableActivity({ tableId, cafeId: effectiveCafeId, actionType: 'table_renamed', message: `Masa adı "${payload.name}" olarak güncellendi`, actorType: 'admin', actorId: actor?.uid ?? null });
  if (payload.status) await safeLogTableActivity({ tableId, cafeId: effectiveCafeId, actionType: 'table_status_changed', message: `Durum ${statusLabel[payload.status]} olarak değiştirildi`, actorType: 'admin', actorId: actor?.uid ?? null });
  if (payload.status === 'closed' && previousStatus !== 'closed') {
    await safeLogTableActivity({
      tableId,
      cafeId: effectiveCafeId,
      actionType: 'table_closed',
      message: `${table.name} kapatıldı`,
      amountSnapshot: table.totalAmount,
      actorType: 'admin',
      actorId: actor?.uid ?? null
    });
  }
  if (payload.status && previousStatus === 'closed' && payload.status !== 'closed') {
    await safeLogTableActivity({
      tableId,
      cafeId: effectiveCafeId,
      actionType: 'table_reopened',
      message: `${table.name} yeniden açıldı`,
      actorType: 'admin',
      actorId: actor?.uid ?? null
    });
  }
}

export async function createTemporaryOrder(name: string, actor?: AdminIdentity | null, cafeId = DEFAULT_CAFE_ID) {
  const { db } = assertFirebaseConfigured();
  const timestamp = now();
  const token = generatePublicToken();
  const effectiveCafeId = actor?.cafeId ?? cafeId;

  const table: Omit<CafeTable, 'id'> = {
    cafeId: effectiveCafeId,
    name,
    entityType: 'temporary_order',
    publicToken: token,
    status: 'occupied',
    totalAmount: 0,
    itemCount: 0,
    openedAt: timestamp,
    closedAt: null,
    closedAmountSnapshot: null,
    lastStatusChangedAt: timestamp,
    deletedAt: null,
    lastActivityAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  const ref = await addDoc(collection(db, tablesCollection), table);
  await safeLogTableActivity({ tableId: ref.id, cafeId: effectiveCafeId, actionType: 'table_created', message: `${name} (geçici sipariş) açıldı`, actorType: 'admin', actorId: actor?.uid ?? null });
}

export async function completeTableSession(tableId: string, actor?: AdminIdentity | null) {
  const { db } = assertFirebaseConfigured();
  let table: { id: string } & Omit<CafeTable, 'id'>;
  let items: Array<{ id: string } & Omit<TableItem, 'id'>>;
  let timestamp: number;
  try {
    const snapshot = await createCompletedSessionSnapshot(tableId, actor);
    table = snapshot.table;
    items = snapshot.items;
    timestamp = snapshot.timestamp;
  } catch (err) {
    throw new Error(`Tamamlanan adisyon kaydı oluşturulamadı (completedSessions/${tableId}): ${toFirebaseErrorMessage(err)}`);
  }

  for (const item of items) {
    try {
      await updateDoc(doc(db, itemsCollection, item.id), {
        cafeId: item.cafeId,
        tableId: item.tableId,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        createdAt: item.createdAt,
        deletedAt: timestamp,
        updatedAt: timestamp
      });
    } catch (err) {
      throw new Error(`Adisyon kalemi arşivlenemedi (tableItems/${item.id}): ${toFirebaseErrorMessage(err)}`);
    }
  }

  if ((table.entityType ?? 'fixed_table') === 'fixed_table') {
    try {
      await updateDoc(doc(db, tablesCollection, tableId), {
        entityType: 'fixed_table',
        status: 'empty',
        totalAmount: 0,
        itemCount: 0,
        openedAt: null,
        closedAt: timestamp,
        closedAmountSnapshot: table.totalAmount,
        lastStatusChangedAt: timestamp,
        updatedAt: timestamp,
        lastActivityAt: timestamp
      });
      await syncPublicTableProjection(tableId, table.cafeId);
      await safeLogTableActivity({
        tableId,
        cafeId: table.cafeId,
        actionType: 'table_closed',
        message: 'Adisyon tamamlandı, masa yeni müşteri için hazır',
        amountSnapshot: table.totalAmount,
        actorType: 'admin',
        actorId: actor?.uid ?? null
      });
    } catch (err) {
      throw new Error(`Sabit masa kapanış güncellemesi başarısız (tables/${tableId}): ${toFirebaseErrorMessage(err)}`);
    }
    return;
  }

  try {
    await updateDoc(doc(db, tablesCollection, tableId), {
      entityType: 'temporary_order',
      status: 'closed',
      deletedAt: timestamp,
      closedAt: timestamp,
      closedAmountSnapshot: table.totalAmount,
      lastStatusChangedAt: timestamp,
      updatedAt: timestamp,
      lastActivityAt: timestamp
    });
    await syncPublicTableProjection(tableId, table.cafeId);
    await safeLogTableActivity({
      tableId,
      cafeId: table.cafeId,
      actionType: 'table_closed',
      message: 'Geçici sipariş tamamlandı ve geçmişe taşındı',
      amountSnapshot: table.totalAmount,
      actorType: 'admin',
      actorId: actor?.uid ?? null
    });
  } catch (err) {
    throw new Error(`Geçici sipariş kapanış güncellemesi başarısız (tables/${tableId}): ${toFirebaseErrorMessage(err)}`);
  }
}

export async function rotateTableToken(table: CafeTable, actor: AdminIdentity) {
  const functionToken = await callBackendRotatePublicToken({ tableId: table.id, actorUid: actor.uid });
  if (functionToken) return functionToken;

  const { db } = assertFirebaseConfigured();
  if (actor.role !== 'owner') throw new Error('Sadece işletme sahibi QR bağlantısını yenileyebilir.');

  const newToken = generatePublicToken();
  const previousToken = table.publicToken;

  const effectiveCafeId = actor.cafeId ?? table.cafeId ?? DEFAULT_CAFE_ID;
  await updateDoc(doc(db, tablesCollection, table.id), { publicToken: newToken, updatedAt: now(), lastActivityAt: now(), cafeId: effectiveCafeId });
  const previousProjectionSnap = await getDoc(doc(db, publicTablesCollection, previousToken));
  if (previousProjectionSnap.exists()) await deleteDoc(doc(db, publicTablesCollection, previousToken));
  try {
    await syncPublicTableProjection(table.id, effectiveCafeId);
  } catch (err) {
    reportDevOnlyError(`Opsiyonel public projection senkronu başarısız: ${table.id}`, err);
  }
  await safeLogTableActivity({ tableId: table.id, cafeId: effectiveCafeId, actionType: 'token_rotated', message: 'QR bağlantısı yenilendi', actorType: 'admin', actorId: actor.uid });
  return newToken;
}

export async function softDeleteTable(tableId: string, actor?: AdminIdentity | null) {
  const { db } = assertFirebaseConfigured();
  const tableSnap = await getDoc(doc(db, tablesCollection, tableId));
  if (!tableSnap.exists()) throw new Error('Masa bulunamadı.');
  const table = tableSnap.data() as Omit<CafeTable, 'id'>;
  const effectiveCafeId = actor?.cafeId ?? table.cafeId ?? DEFAULT_CAFE_ID;

  await updateDoc(doc(db, tablesCollection, tableId), { deletedAt: now(), updatedAt: now(), cafeId: effectiveCafeId });
  const itemsSnap = await getDocs(query(collection(db, itemsCollection), where('tableId', '==', tableId), where('deletedAt', '==', null)));
  await Promise.all(itemsSnap.docs.map((d) => updateDoc(doc(db, itemsCollection, d.id), { deletedAt: now(), updatedAt: now() })));

  try {
    await syncPublicTableProjection(tableId, effectiveCafeId);
  } catch (err) {
    reportDevOnlyError(`Opsiyonel public projection senkronu başarısız: ${tableId}`, err);
  }
  await safeLogTableActivity({ tableId, cafeId: effectiveCafeId, actionType: 'table_deleted', message: 'Masa arşive alındı', actorType: 'admin', actorId: actor?.uid ?? null });
}

export async function addTableItem(tableId: string, cafeId: string, name: string, quantity: number, unitPrice: number, actor?: AdminIdentity | null) {
  const { db } = assertFirebaseConfigured();
  const tableSnap = await getDoc(doc(db, tablesCollection, tableId));
  const tableCafeId = tableSnap.exists() ? (tableSnap.data() as Omit<CafeTable, 'id'>).cafeId : null;
  const effectiveCafeId = actor?.cafeId ?? tableCafeId ?? cafeId ?? DEFAULT_CAFE_ID;
  const timestamp = now();
  const item: Omit<TableItem, 'id'> = { tableId, cafeId: effectiveCafeId, name, quantity, unitPrice, totalPrice: quantity * unitPrice, deletedAt: null, createdAt: timestamp, updatedAt: timestamp };
  await addDoc(collection(db, itemsCollection), item);
  await recomputeTableAggregates(tableId, effectiveCafeId);
  await safeLogTableActivity({ tableId, cafeId: effectiveCafeId, actionType: 'item_added', message: `${name} eklendi`, actorType: 'admin', actorId: actor?.uid ?? null });
}

export async function editTableItem(itemId: string, payload: Pick<TableItem, 'name' | 'quantity' | 'unitPrice' | 'tableId' | 'cafeId'>, actor?: AdminIdentity | null) {
  const { db } = assertFirebaseConfigured();
  const tableSnap = await getDoc(doc(db, tablesCollection, payload.tableId));
  const tableCafeId = tableSnap.exists() ? (tableSnap.data() as Omit<CafeTable, 'id'>).cafeId : null;
  const effectiveCafeId = actor?.cafeId ?? tableCafeId ?? payload.cafeId ?? DEFAULT_CAFE_ID;
  const totalPrice = payload.quantity * payload.unitPrice;
  await updateDoc(doc(db, itemsCollection, itemId), { ...payload, cafeId: effectiveCafeId, totalPrice, updatedAt: now() });
  await recomputeTableAggregates(payload.tableId, effectiveCafeId);
  await safeLogTableActivity({ tableId: payload.tableId, cafeId: effectiveCafeId, actionType: 'item_edited', message: `${payload.name} güncellendi`, actorType: 'admin', actorId: actor?.uid ?? null });
}

export async function softDeleteTableItem(itemId: string, tableId: string, cafeId: string, actor?: AdminIdentity | null) {
  const { db } = assertFirebaseConfigured();
  const tableSnap = await getDoc(doc(db, tablesCollection, tableId));
  const tableCafeId = tableSnap.exists() ? (tableSnap.data() as Omit<CafeTable, 'id'>).cafeId : null;
  const effectiveCafeId = actor?.cafeId ?? tableCafeId ?? cafeId ?? DEFAULT_CAFE_ID;
  await updateDoc(doc(db, itemsCollection, itemId), { deletedAt: now(), updatedAt: now() });
  await recomputeTableAggregates(tableId, effectiveCafeId);
  await safeLogTableActivity({ tableId, cafeId: effectiveCafeId, actionType: 'item_removed', message: 'Ürün kaldırıldı', actorType: 'admin', actorId: actor?.uid ?? null });
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
  empty: 'Yeni müşteri için hazır',
  occupied: 'Dolu',
  payment_pending: 'Ödeme Bekliyor',
  closed: 'Kapalı'
};

export const entityTypeLabel: Record<ServiceEntityType, string> = {
  fixed_table: 'Sabit Masa',
  temporary_order: 'Geçici Sipariş'
};
