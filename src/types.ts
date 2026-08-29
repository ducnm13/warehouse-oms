/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 'ADMIN' | 'W_MANAGER' | 'P_MANAGER' | 'S_SALES' | 'QD';

export interface User {
  id: number;
  username: string;
  role: Role;
  fullName: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  netWeight: number;
  shelfLifeMonths: number;
  isActive: number;
  totalStock: number;
  packagings: ProductPackaging[];
}

export interface ProductPackaging {
  id: number;
  productId: number;
  name: string;
  sku?: string;
  unit?: string;
  packCount: number;
  defaultRatio: number;
  initial_stock?: number;
  min_stock?: number;
  stock?: number;
  price?: number;
  boms?: { materialPackagingId: number; quantity: number }[];
}

export interface Warehouse {
  id: number;
  name: string;
  type: 'MAIN' | 'SUB';
  location: string;
}

export interface TransactionDetail {
  id: number;
  transactionId: number;
  packagingId: number;
  quantity: number;
  packagingName?: string;
  sku?: string;
  unit?: string;
  productName?: string;
  note?: string;
}

export interface Customer {
  id: number;
  code?: string;
  name: string;
  phone?: string;
  address?: string;
  email?: string;
  taxCode?: string;
  groupName?: string;
  createdAt?: string;
  debt?: number;
  overdueDebt?: number;
  paidLast30Days?: number;
}

export interface Transaction {
  id: number;
  code: string;
  type: 'IMPORT' | 'EXPORT' | 'CONVERT';
  transaction_date: string;
  entry_date?: string;
  exit_date?: string;
  warehouseId: number;
  warehouseName?: string;
  note: string;
  recipient?: string; // Still useful for manual entry or legacy
  customerId?: number; // New field linking to customers table
  customerName?: string;
  reason?: string;
  createdBy: number;
  creatorName?: string;
  createdAt: string;
  details: TransactionDetail[];
}

export type InventoryDocumentStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';
export interface InventoryDocumentV1 {
  id: number; code: string; type: 'IMPORT' | 'EXPORT'; transactionDate: string;
  warehouseId: number; warehouseName?: string; documentStatus: InventoryDocumentStatus;
  version: number; recipient?: string; reason?: string; note?: string; sourceModule?: string;
  postedAt?: string; cancelledAt?: string; cancelReason?: string; creatorName?: string;
  details: Array<{ id: number; packagingId: number; quantity: number; unitCost: number; totalValue: number;
    note?: string; sku?: string; unit?: string; packagingName?: string; productName?: string }>;
}
export interface InventoryBalanceV1 {
  packagingId: number; warehouseId: number; quantity: number; sku?: string; unit?: string;
  packagingName: string; productName: string; warehouseName: string;
}
export interface InventoryReconciliationV1 {
  packagingId: number; warehouseId: number; sku?: string;
  packagingName: string; productName: string; warehouseName: string;
  actualQuantity: number; expectedQuantity: number; difference: number;
}
export interface StocktakeV1 {
  id: number; code: string; date: string; status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  warehouseId: number; warehouseName?: string; version: number; note?: string;
  completedAt?: string; cancelledAt?: string; cancelReason?: string; creatorName?: string;
  details: Array<{ id: number; packagingId: number; expectedQuantity: number; actualQuantity: number;
    difference: number; sku?: string; unit?: string; packagingName?: string; productName?: string }>;
  links?: Array<{ id: string; linkType: string; linkedId: string; linkedCode?: string }>;
}

export type WarehouseTransferStatusV1 = 'DRAFT' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
export interface WarehouseTransferV1 {
  id: number; code: string; transferDate: string; fromWarehouseId: number; toWarehouseId: number;
  fromWarehouseName?: string; toWarehouseName?: string; status: WarehouseTransferStatusV1;
  version: number; note?: string; sourceModule?: string; shippedAt?: string; receivedAt?: string;
  cancelledAt?: string; cancelReason?: string; creatorName?: string;
  details: Array<{ id: number; packagingId: number; quantity: number; unitCost: number; totalValue: number;
    note?: string; sku?: string; unit?: string; packagingName?: string; productName?: string }>;
  links: Array<{ id: string; linkType: string; linkedId: string; linkedCode?: string }>;
}

export type DebtKind = 'RECEIPT' | 'VOUCHER';
export interface DebtAgingRow {
  documentId: number; documentCode: string; partnerId: number; partnerCode?: string; partnerName: string;
  documentDate: string; dueDate?: string; totalAmount: number; outstanding: number; daysOverdue: number;
  bucket: 'CURRENT' | '1_30' | '31_60' | '61_90' | 'OVER_90';
}
export interface DebtAgingResult {
  rows: DebtAgingRow[];
  summary: { total: number; current: number; days1To30: number; days31To60: number; days61To90: number; over90: number };
}
export interface DebtPaymentV1 {
  id: string; code: string; kind: DebtKind; partnerId: number; partnerCode?: string; partnerName?: string;
  paymentDate: string; method: 'CASH' | 'BANK' | 'OTHER'; amount: number; direction: string;
  status: 'DRAFT' | 'POSTED' | 'CANCELLED'; version: number; sourceModule?: string; note?: string;
  postedAt?: string; cancelledAt?: string; cancelReason?: string;
  allocations: Array<{ id: string; documentId: number; documentCode: string; amount: number; totalAmount: number; paidAmount: number }>;
}

export interface ProductionOrder {
  id: number;
  code: string;
  productId: number;
  productName?: string;
  total_powder_kg: number;
  total_sachets: number;
  mfg_date: string;
  exp_date: string;
  status: 'DRAFT' | 'COMPLETED';
  loss_percent: number;
  details: ProductionDetail[];
  batch_number?: string;
  target_sachets?: number;
  order_date?: string;
  createdAt?: string;
}

export interface ProductionDetail {
  id: number;
  orderId: number;
  packagingId: number;
  packagingName?: string;
  quantity: number; // Planned
  actual_quantity: number; // Actual
  allocation_percent: number;
  note?: string;
}

// --- BỔ SUNG CHO TÍNH NĂNG KIỂM KÊ KHO ---

export interface Stocktake {
  id: number;
  code: string;
  date: string;
  status: 'DRAFT' | 'COMPLETED';
  note?: string;
  createdBy: number;
  createdAt: string;
}

export interface StocktakeDetail {
  id: number;
  stocktakeId: number;
  packagingId: number;
  expected_qty: number; // Tồn sổ sách
  actual_qty: number;   // Tồn thực tế do bạn nhập
  difference: number;   // Chênh lệch
}

export type SalesOrderStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'POSTED' | 'CANCELLED' | 'FULFILLED';

export interface SalesOrderDetail {
  id?: number;
  orderId?: number;
  packagingId: number;
  quantity: number;
  unitPrice: number;
  discountRate: number;
  lineTotal?: number;
  unitCost?: number;
  costAmount?: number;
  note?: string;
  packagingName?: string;
  productName?: string;
  sku?: string;
  unit?: string;
}

export interface SalesOrder {
  id: number;
  code: string;
  orderDate: string;
  deliveryDate?: string;
  customerId: number;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  customerTaxCode?: string;
  warehouseId: number;
  warehouseName?: string;
  status: SalesOrderStatus;
  note?: string;
  rejectionReason?: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  creatorName?: string;
  approverName?: string;
  approvedAt?: string;
  fulfilledAt?: string;
  dueDate?: string;
  paidAmount?: number;
  paymentStatus?: 'UNPAID' | 'PARTIAL' | 'PAID';
  paymentIntent?: 'UNPAID' | 'PAID';
  paymentMethod?: 'CASH' | 'BANK';
  version: number;
  postedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  createdAt: string;
  details: SalesOrderDetail[];
  links?: Array<{ id: string; linkType: string; linkedId: string; linkedCode?: string }>;
}

export interface WarehouseTransfer {
  id: number;
  code: string;
  transferDate: string;
  fromWarehouseId: number;
  toWarehouseId: number;
  fromWarehouseName?: string;
  toWarehouseName?: string;
  status: 'COMPLETED';
  note?: string;
  creatorName?: string;
  createdAt: string;
  details: Array<{
    packagingId: number;
    quantity: number;
    note?: string;
    packagingName?: string;
    productName?: string;
    sku?: string;
    unit?: string;
  }>;
}

export interface Supplier {
  id: number;
  code: string;
  name: string;
  taxCode?: string;
  phone?: string;
  email?: string;
  address?: string;
  contactPerson?: string;
  paymentTermDays: number;
  debt?: number;
  overdueDebt?: number;
  paidLast30Days?: number;
}

export type PurchaseDocumentType = 'DOMESTIC_INVENTORY' | 'DOMESTIC_NO_INVENTORY';
export type PurchasePaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID';

export interface PurchaseDocumentDetail {
  id?: number;
  packagingId: number;
  warehouseId?: number;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  lineAmount?: number;
  taxAmount?: number;
  note?: string;
  sku?: string;
  productName?: string;
  packagingName?: string;
  unit?: string;
  warehouseName?: string;
}

export interface PurchaseDocument {
  id: number;
  code: string;
  documentDate: string;
  dueDate?: string;
  type: PurchaseDocumentType;
  paymentStatus: PurchasePaymentStatus;
  paymentIntent?: 'UNPAID' | 'PAID';
  documentStatus?: 'DRAFT' | 'POSTED' | 'CANCELLED';
  paymentMethod?: 'CASH' | 'BANK';
  invoiceOption: 'WITH_INVOICE' | 'NO_INVOICE';
  supplierId: number;
  supplierCode?: string;
  supplierName?: string;
  supplierAddress?: string;
  supplierTaxCode?: string;
  deliveryPerson?: string;
  buyerName?: string;
  description?: string;
  goodsAmount: number;
  taxAmount: number;
  purchaseCost: number;
  totalAmount: number;
  inventoryValue: number;
  paidAmount: number;
  version?: number;
  postedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  creatorName?: string;
  createdAt: string;
  details: PurchaseDocumentDetail[];
  inventoryLinks?: Array<{ inventoryTransactionId: number; inventoryCode: string; warehouseId: number; warehouseName: string }>;
  links?: Array<{ id: string; linkType: string; linkedId: string; linkedCode?: string }>;
}
