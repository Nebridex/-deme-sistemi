export type TimestampMs = number;

export type CafeStatus = 'active' | 'inactive';
export type CafeUserRole = 'owner' | 'manager';
export type TableStatus = 'empty' | 'occupied' | 'payment_pending' | 'closed';
export type ActorType = 'admin' | 'system';

export type Cafe = {
  id: string;
  name: string;
  slug: string;
  status: CafeStatus;
  createdAt: TimestampMs;
  updatedAt: TimestampMs;
};

export type CafeUser = {
  uid: string;
  cafeId: string;
  email: string;
  role: CafeUserRole;
  createdAt: TimestampMs;
  updatedAt: TimestampMs;
};

export type CafeTable = {
  id: string;
  cafeId: string;
  name: string;
  publicToken: string;
  status: TableStatus;
  itemCount: number;
  totalAmount: number;
  openedAt: TimestampMs | null;
  closedAt: TimestampMs | null;
  closedAmountSnapshot: number | null;
  lastStatusChangedAt: TimestampMs;
  deletedAt: TimestampMs | null;
  lastActivityAt: TimestampMs;
  createdAt: TimestampMs;
  updatedAt: TimestampMs;
};

export type TableItem = {
  id: string;
  tableId: string;
  cafeId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  deletedAt: TimestampMs | null;
  createdAt: TimestampMs;
  updatedAt: TimestampMs;
};

export type PublicTableItem = Pick<TableItem, 'name' | 'quantity' | 'unitPrice' | 'totalPrice'>;

export type PublicTableProjection = {
  id: string; // publicToken as document ID
  cafeId: string;
  tableId: string;
  publicToken: string;
  tableName: string;
  status: TableStatus;
  itemCount: number;
  totalAmount: number;
  items: PublicTableItem[];
  updatedAt: TimestampMs;
  deletedAt: TimestampMs | null;
};

export type TableActivityLog = {
  id: string;
  tableId: string;
  cafeId: string;
  actionType:
    | 'table_created'
    | 'table_renamed'
    | 'table_status_changed'
    | 'table_deleted'
    | 'table_closed'
    | 'table_reopened'
    | 'item_added'
    | 'item_edited'
    | 'item_removed'
    | 'token_rotated';
  message: string;
  actorType: ActorType;
  actorId: string | null;
  amountSnapshot?: number;
  createdAt: TimestampMs;
};

export type Payment = {
  id: string;
  cafeId: string;
  tableId: string;
  amount: number;
  currency: 'TRY';
  status: 'pending' | 'authorized' | 'succeeded' | 'failed' | 'canceled';
  provider: 'manual' | 'iyzico' | 'stripe' | 'other';
  providerReference: string | null;
  splitSessionId: string | null;
  payerLabel: string | null;
  payerId: string | null;
  createdAt: TimestampMs;
  updatedAt: TimestampMs;
};

export type SplitSession = {
  id: string;
  cafeId: string;
  tableId: string;
  mode: 'equal' | 'item_select';
  participantCount: number | null;
  selectedItems: Array<{ itemName: string; quantity: number; totalPrice: number }> | null;
  subtotal: number;
  status: 'draft' | 'confirmed' | 'canceled';
  createdAt: TimestampMs;
  updatedAt: TimestampMs;
};

export type TableSettlement = {
  id: string;
  cafeId: string;
  tableId: string;
  originalAmount: number;
  settledAmount: number;
  remainingAmount: number;
  status: 'open' | 'partial' | 'settled';
  createdAt: TimestampMs;
  updatedAt: TimestampMs;
};

export type PublicTableBillView = {
  tableName: string;
  status: TableStatus;
  itemCount: number;
  totalAmount: number;
  items: PublicTableItem[];
};

export type AdminIdentity = {
  uid: string;
  email: string;
  cafeId: string;
  role: CafeUserRole;
};
