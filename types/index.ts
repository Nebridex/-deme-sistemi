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
    | 'item_added'
    | 'item_edited'
    | 'item_removed'
    | 'token_rotated';
  message: string;
  actorType: ActorType;
  actorId: string | null;
  createdAt: TimestampMs;
};

export type Payment = {
  id: string;
  cafeId: string;
  tableId: string;
  amount: number;
  currency: 'TRY';
  status: 'pending' | 'succeeded' | 'failed';
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
