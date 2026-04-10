export type TableStatus = 'active' | 'occupied';

export type CafeTable = {
  id: string;
  name: string;
  code: string;
  status: TableStatus;
  totalAmount: number;
  itemCount: number;
  createdAt: number;
  updatedAt: number;
};

export type TableItem = {
  id: string;
  tableId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: number;
  updatedAt: number;
};

export type AdminUserProfile = {
  uid: string;
  email: string;
  role: 'admin';
};
