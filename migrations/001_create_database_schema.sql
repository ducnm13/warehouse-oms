-- Migration: Tạo schema database hoàn chỉnh cho ERP Warehouse OMS v2
-- Ngày: 2026-09-01
-- Mục đích: Tạo database schema chuẩn cho hệ thống ERP quản lý sản xuất, kho, mua bán

-- ============================================================================
-- 1. HỆ THỐNG
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role VARCHAR(50) NOT NULL, -- 'ADMIN', 'W_MANAGER', 'P_MANAGER', 'S_SALES', 'QD'
  fullName VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  avatar TEXT,
  isActive INT DEFAULT 1,
  lastLogin TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  isActive INT DEFAULT 1,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  isActive INT DEFAULT 1,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS user_roles (
  userId INT NOT NULL,
  roleId INT NOT NULL,
  PRIMARY KEY (userId, roleId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS role_permissions (
  roleId INT NOT NULL,
  permissionId INT NOT NULL,
  PRIMARY KEY (roleId, permissionId),
  FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permissionId) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action TEXT NOT NULL,
  entityType VARCHAR(100),
  entityId INT,
  details TEXT,
  userId INT,
  userName TEXT,
  ipAddress VARCHAR(50),
  userAgent TEXT,
  createdAt TEXT
);

CREATE TABLE IF NOT EXISTS system_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updatedAt TEXT
);

-- ============================================================================
-- 2. DANH MỤC
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  parentId INT,
  description TEXT,
  isActive INT DEFAULT 1,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);

CREATE TABLE IF NOT EXISTS units (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(50) NOT NULL,
  symbol VARCHAR(20),
  description TEXT,
  isActive INT DEFAULT 1,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS unit_conversions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fromUnitId INT NOT NULL,
  toUnitId INT NOT NULL,
  ratio DOUBLE NOT NULL,
  isActive INT DEFAULT 1,
  FOREIGN KEY (fromUnitId) REFERENCES units(id) ON DELETE CASCADE,
  FOREIGN KEY (toUnitId) REFERENCES units(id) ON DELETE CASCADE,
  UNIQUE KEY (fromUnitId, toUnitId)
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(100) UNIQUE NOT NULL,
  code VARCHAR(50) UNIQUE,
  name VARCHAR(255) NOT NULL,
  categoryId INT,
  description TEXT,
  netWeight DOUBLE DEFAULT 0,
  shelfLifeMonths INT DEFAULT 24,
  isActive INT DEFAULT 1, -- 1: active, 0: inactive
  canManageInventory INT DEFAULT 1, -- 1: có quản lý tồn kho, 0: không
  canBePurchased INT DEFAULT 1, -- 1: có thể mua, 0: không
  canBeSold INT DEFAULT 1, -- 1: có thể bán, 0: không
  canBeProduced INT DEFAULT 0, -- 1: có thể sản xuất, 0: không
  canBeBomComponent INT DEFAULT 1, -- 1: có thể dùng làm thành phần định mức, 0: không
  imageUrl TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT,
  FOREIGN KEY (categoryId) REFERENCES product_categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS productpackagings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  productId INT NOT NULL,
  code VARCHAR(50) UNIQUE,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE,
  unitId INT,
  packCount INT DEFAULT 1, -- Số lượng trong 1 đơn vị đóng gói
  defaultRatio DOUBLE DEFAULT 1, -- Tỷ lệ quy đổi
  initial_stock DOUBLE DEFAULT 0, -- Tồn đầu kỳ
  min_stock DOUBLE DEFAULT 0, -- Tồn tối thiểu
  max_stock DOUBLE DEFAULT 0, -- Tồn tối đa
  netWeight DOUBLE DEFAULT 0,
  shelfLifeMonths INT DEFAULT 24,
  barcode VARCHAR(100),
  warehouseId INT, -- Kho ngầm định
  isActive INT DEFAULT 1,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT,
  FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (unitId) REFERENCES units(id) ON DELETE SET NULL,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS product_prices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  packagingId INT NOT NULL,
  priceType VARCHAR(20) NOT NULL, -- 'SALE_1', 'SALE_2', 'SALE_3', 'COST'
  price DOUBLE NOT NULL,
  currency VARCHAR(10) DEFAULT 'VND',
  validFrom TEXT,
  validTo TEXT,
  isActive INT DEFAULT 1,
  FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE,
  UNIQUE KEY (packagingId, priceType)
);

CREATE TABLE IF NOT EXISTS item_barcodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  packagingId INT NOT NULL,
  barcode VARCHAR(100) UNIQUE NOT NULL,
  isPrimary INT DEFAULT 0,
  FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE
);

-- ============================================================================
-- 3. KHO
-- ============================================================================

CREATE TABLE IF NOT EXISTS warehouses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'MAIN', -- 'MAIN', 'SUB', 'RECEIVING', 'SHIPPING', 'PRODUCTION'
  location TEXT,
  address TEXT,
  managerId INT,
  isActive INT DEFAULT 1,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT,
  FOREIGN KEY (managerId) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS warehouse_zones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  warehouseId INT NOT NULL,
  code VARCHAR(50),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  isActive INT DEFAULT 1,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS inventorytransactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL, -- 'IMPORT', 'EXPORT', 'ADJUSTMENT', 'TRANSFER', 'COUNT'
  transaction_date TEXT NOT NULL,
  entry_date TEXT,
  exit_date TEXT,
  warehouseId INT NOT NULL,
  zoneId INT,
  note TEXT,
  reason TEXT,
  recipient TEXT,
  sourceModule VARCHAR(50), -- 'PURCHASE', 'SALES', 'PRODUCTION', 'ASSEMBLY', 'DISASSEMBLY', 'ADJUSTMENT'
  documentId INT, -- ID chứng từ nguồn
  documentCode VARCHAR(100),
  documentType VARCHAR(50),
  status VARCHAR(20) DEFAULT 'POSTED', -- 'DRAFT', 'POSTED', 'CANCELLED'
  createdBy INT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT,
  cancelledAt TEXT,
  cancelReason TEXT,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE CASCADE,
  FOREIGN KEY (zoneId) REFERENCES warehouse_zones(id) ON DELETE SET NULL,
  FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventorytransactiondetails (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transactionId INT NOT NULL,
  packagingId INT NOT NULL,
  quantity DOUBLE NOT NULL,
  unitCost DOUBLE DEFAULT 0,
  totalValue DOUBLE DEFAULT 0,
  note TEXT,
  batchNumber VARCHAR(100),
  expiryDate TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  FOREIGN KEY (transactionId) REFERENCES inventorytransactions(id) ON DELETE CASCADE,
  FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE
);

    CREATE TABLE IF NOT EXISTS inventory_balances (
      id INT AUTO_INCREMENT PRIMARY KEY,
      packagingId INT NOT NULL,
      warehouseId INT NOT NULL,
      quantity DOUBLE DEFAULT 0,
      unitCost DOUBLE DEFAULT 0,
      totalValue DOUBLE DEFAULT 0,
      lastTransactionId INT,
      updatedAt TEXT,
      FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE,
      FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE CASCADE,
      UNIQUE KEY (packagingId, warehouseId)
    );

-- ============================================================================
-- 4. KHÁCH HÀNG & NHÀ CUNG CẤP
-- ============================================================================

CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  address TEXT,
  email VARCHAR(255),
  taxCode VARCHAR(100),
  groupId INT,
  paymentTermDays INT DEFAULT 0,
  priceListId INT,
  creditLimit DOUBLE DEFAULT 0, -- Hạn mức công nợ
  isActive INT DEFAULT 1,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT,
  FOREIGN KEY (groupId) REFERENCES customer_groups(id) ON DELETE SET NULL,
  FOREIGN KEY (priceListId) REFERENCES price_lists(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS customer_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  discountRate DOUBLE DEFAULT 0,
  creditLimit DOUBLE DEFAULT 0,
  isActive INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS customer_addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customerId INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  address TEXT NOT NULL,
  isDefault INT DEFAULT 0,
  isActive INT DEFAULT 1,
  createdAt TEXT,
  updatedAt TEXT,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  taxCode VARCHAR(100),
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  contactPerson VARCHAR(255),
  groupId INT,
  paymentTermDays INT DEFAULT 0,
  isActive INT DEFAULT 1,
  createdAt TEXT,
  updatedAt TEXT,
  deletedAt TEXT,
  FOREIGN KEY (groupId) REFERENCES supplier_groups(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS supplier_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  isActive INT DEFAULT 1
);

CREATE TABLE IF NOT EXISTS price_lists (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  isActive INT DEFAULT 1,
  createdAt TEXT,
  updatedAt TEXT
);

CREATE TABLE IF NOT EXISTS price_list_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  priceListId INT NOT NULL,
  packagingId INT NOT NULL,
  priceType VARCHAR(20) NOT NULL, -- 'SALE_1', 'SALE_2', 'SALE_3'
  price DOUBLE NOT NULL,
  validFrom TEXT,
  validTo TEXT,
  isActive INT DEFAULT 1,
  FOREIGN KEY (priceListId) REFERENCES price_lists(id) ON DELETE CASCADE,
  FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE,
  UNIQUE KEY (priceListId, packagingId, priceType)
);

-- ============================================================================
-- 5. MUA HÀNG
-- ============================================================================

CREATE TABLE IF NOT EXISTS purchase_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  documentDate TEXT NOT NULL,
  dueDate TEXT,
  type VARCHAR(50) NOT NULL, -- 'DOMESTIC_INVENTORY', 'DOMESTIC_NO_INVENTORY', 'IMPORT'
  paymentStatus VARCHAR(30) DEFAULT 'UNPAID', -- 'UNPAID', 'PARTIAL', 'PAID'
  paymentMethod VARCHAR(30), -- 'CASH', 'BANK', 'OTHER'
  invoiceOption VARCHAR(30) DEFAULT 'WITH_INVOICE', -- 'WITH_INVOICE', 'NO_INVOICE'
  supplierId INT NOT NULL,
  deliveryPerson VARCHAR(255),
  buyerName VARCHAR(255),
  description TEXT,
  goodsAmount DOUBLE DEFAULT 0,
  taxAmount DOUBLE DEFAULT 0,
  purchaseCost DOUBLE DEFAULT 0,
  totalAmount DOUBLE DEFAULT 0,
  inventoryValue DOUBLE DEFAULT 0,
  paidAmount DOUBLE DEFAULT 0,
  documentStatus VARCHAR(20) DEFAULT 'POSTED', -- 'DRAFT', 'POSTED', 'CANCELLED'
  createdBy INT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT,
  cancelledAt TEXT,
  cancelReason TEXT,
  FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_document_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  documentId INT NOT NULL,
  packagingId INT NOT NULL,
  warehouseId INT,
  quantity DOUBLE NOT NULL,
  unitPrice DOUBLE DEFAULT 0,
  taxRate DOUBLE DEFAULT 0,
  lineAmount DOUBLE DEFAULT 0,
  taxAmount DOUBLE DEFAULT 0,
  note TEXT,
  FOREIGN KEY (documentId) REFERENCES purchase_documents(id) ON DELETE CASCADE,
  FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS supplier_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplierId INT NOT NULL,
  purchaseDocumentId INT NOT NULL,
  paymentDate TEXT NOT NULL,
  amount DOUBLE NOT NULL,
  method VARCHAR(30), -- 'CASH', 'BANK', 'OTHER'
  referenceNumber VARCHAR(100),
  note TEXT,
  createdBy INT NOT NULL,
  createdAt TEXT,
  FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (purchaseDocumentId) REFERENCES purchase_documents(id) ON DELETE CASCADE,
  FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS purchase_inventory_links (
  purchaseDocumentId INT NOT NULL,
  inventoryTransactionId INT NOT NULL,
  warehouseId INT NOT NULL,
  PRIMARY KEY (purchaseDocumentId, inventoryTransactionId),
  FOREIGN KEY (purchaseDocumentId) REFERENCES purchase_documents(id) ON DELETE CASCADE,
  FOREIGN KEY (inventoryTransactionId) REFERENCES inventorytransactions(id) ON DELETE CASCADE,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE CASCADE
);

-- ============================================================================
-- 6. BÁN HÀNG
-- ============================================================================

CREATE TABLE IF NOT EXISTS sales_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  orderDate TEXT NOT NULL,
  deliveryDate TEXT,
  customerId INT NOT NULL,
  warehouseId INT NOT NULL,
  status VARCHAR(30) DEFAULT 'DRAFT', -- 'DRAFT', 'PENDING', 'APPROVED', 'POSTED', 'CANCELLED', 'FULFILLED'
  note TEXT,
  rejectionReason TEXT,
  subtotal DOUBLE DEFAULT 0,
  discountAmount DOUBLE DEFAULT 0,
  taxAmount DOUBLE DEFAULT 0,
  totalAmount DOUBLE DEFAULT 0,
  paidAmount DOUBLE DEFAULT 0,
  paymentStatus VARCHAR(30) DEFAULT 'UNPAID', -- 'UNPAID', 'PARTIAL', 'PAID'
  paymentMethod VARCHAR(30), -- 'CASH', 'BANK', 'OTHER'
  dueDate TEXT,
  createdBy INT NOT NULL,
  approvedBy INT,
  approvedAt TEXT,
  fulfilledAt TEXT,
  inventoryTransactionId INT,
  createdAt TEXT,
  updatedAt TEXT,
  cancelledAt TEXT,
  cancelReason TEXT,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE CASCADE,
  FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (approvedBy) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sales_order_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  packagingId INT NOT NULL,
  quantity DOUBLE NOT NULL,
  unitPrice DOUBLE DEFAULT 0,
  discountRate DOUBLE DEFAULT 0,
  lineTotal DOUBLE DEFAULT 0,
  unitCost DOUBLE DEFAULT 0,
  costAmount DOUBLE DEFAULT 0,
  note TEXT,
  lineType VARCHAR(20) DEFAULT 'SALE', -- 'SALE', 'PROMOTION', 'SERVICE'
  FOREIGN KEY (orderId) REFERENCES sales_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sales_returns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  originalSalesOrderId INT NOT NULL,
  customerId INT NOT NULL,
  warehouseId INT NOT NULL,
  returnDate TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'DRAFT', -- 'DRAFT', 'POSTED', 'CANCELLED'
  reason TEXT NOT NULL,
  settlementType VARCHAR(30), -- 'REDUCE_DEBT', 'REFUND', 'REPLACE'
  subtotal DOUBLE DEFAULT 0,
  taxAmount DOUBLE DEFAULT 0,
  totalAmount DOUBLE DEFAULT 0,
  costAmount DOUBLE DEFAULT 0,
  createdBy INT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT,
  cancelledAt TEXT,
  cancelReason TEXT,
  FOREIGN KEY (originalSalesOrderId) REFERENCES sales_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE CASCADE,
  FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sales_return_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  returnId INT NOT NULL,
  originalLineId INT NOT NULL,
  packagingId INT NOT NULL,
  quantity DOUBLE NOT NULL,
  unitPrice DOUBLE DEFAULT 0,
  lineTotal DOUBLE DEFAULT 0,
  note TEXT,
  FOREIGN KEY (returnId) REFERENCES sales_returns(id) ON DELETE CASCADE,
  FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS customer_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customerId INT NOT NULL,
  salesOrderId INT NOT NULL,
  paymentDate TEXT NOT NULL,
  amount DOUBLE NOT NULL,
  method VARCHAR(30), -- 'CASH', 'BANK', 'OTHER'
  referenceNumber VARCHAR(100),
  note TEXT,
  createdBy INT NOT NULL,
  createdAt TEXT,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY (salesOrderId) REFERENCES sales_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================================
-- 7. SẢN XUẤT
-- ============================================================================

CREATE TABLE IF NOT EXISTS production_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  productId INT NOT NULL,
  warehouseId INT NOT NULL,
  orderDate TEXT NOT NULL,
  mfgDate TEXT,
  expDate TEXT,
  batchNumber VARCHAR(100),
  targetSachets INT DEFAULT 0,
  totalPowderKg DOUBLE DEFAULT 0,
  totalSachets INT DEFAULT 0,
  status VARCHAR(30) DEFAULT 'DRAFT', -- 'DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
  lossPercent DOUBLE DEFAULT 0,
  description TEXT,
  createdBy INT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT,
  startedAt TEXT,
  completedAt TEXT,
  cancelledAt TEXT,
  cancelReason TEXT,
  FOREIGN KEY (productId) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE CASCADE,
  FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS production_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  packagingId INT NOT NULL,
  quantity DOUBLE DEFAULT 0, -- Planned
  actual_quantity DOUBLE DEFAULT 0, -- Actual
  allocation_percent DOUBLE DEFAULT 0,
  note TEXT,
  FOREIGN KEY (orderId) REFERENCES production_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_boms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  productPackagingId INT NOT NULL,
  materialPackagingId INT NOT NULL,
  quantity DOUBLE NOT NULL,
  version INT DEFAULT 1,
  isActive INT DEFAULT 1,
  validFrom TEXT,
  validTo TEXT,
  FOREIGN KEY (productPackagingId) REFERENCES productpackagings(id) ON DELETE CASCADE,
  FOREIGN KEY (materialPackagingId) REFERENCES productpackagings(id) ON DELETE CASCADE
);

-- ============================================================================
-- 8. LẮP RÁP & THÁO DỠ
-- ============================================================================

CREATE TABLE IF NOT EXISTS assembly_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  orderDate TEXT NOT NULL,
  outputPackagingId INT NOT NULL,
  plannedQuantity DOUBLE NOT NULL,
  actualQuantity DOUBLE DEFAULT 0,
  componentWarehouseId INT NOT NULL,
  outputWarehouseId INT NOT NULL,
  assemblyCost DOUBLE DEFAULT 0,
  status VARCHAR(30) DEFAULT 'DRAFT', -- 'DRAFT', 'POSTED', 'CANCELLED'
  note TEXT,
  createdBy INT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT,
  postedAt TEXT,
  cancelledAt TEXT,
  cancelReason TEXT,
  FOREIGN KEY (outputPackagingId) REFERENCES productpackagings(id) ON DELETE CASCADE,
  FOREIGN KEY (componentWarehouseId) REFERENCES warehouses(id) ON DELETE CASCADE,
  FOREIGN KEY (outputWarehouseId) REFERENCES warehouses(id) ON DELETE CASCADE,
  FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS assembly_order_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  packagingId INT NOT NULL,
  plannedQuantity DOUBLE NOT NULL,
  actualQuantity DOUBLE DEFAULT 0,
  unitCost DOUBLE DEFAULT 0,
  totalValue DOUBLE DEFAULT 0,
  lossQuantity DOUBLE DEFAULT 0,
  note TEXT,
  FOREIGN KEY (orderId) REFERENCES assembly_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS disassembly_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  orderDate TEXT NOT NULL,
  sourcePackagingId INT NOT NULL,
  plannedQuantity DOUBLE NOT NULL,
  actualQuantity DOUBLE DEFAULT 0,
  sourceWarehouseId INT NOT NULL,
  recoveryWarehouseId INT NOT NULL,
  status VARCHAR(30) DEFAULT 'DRAFT', -- 'DRAFT', 'POSTED', 'CANCELLED'
  note TEXT,
  createdBy INT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT,
  postedAt TEXT,
  cancelledAt TEXT,
  cancelReason TEXT,
  FOREIGN KEY (sourcePackagingId) REFERENCES productpackagings(id) ON DELETE CASCADE,
  FOREIGN KEY (sourceWarehouseId) REFERENCES warehouses(id) ON DELETE CASCADE,
  FOREIGN KEY (recoveryWarehouseId) REFERENCES warehouses(id) ON DELETE CASCADE,
  FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS disassembly_order_lines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  orderId INT NOT NULL,
  packagingId INT NOT NULL,
  plannedQuantity DOUBLE NOT NULL,
  actualQuantity DOUBLE DEFAULT 0,
  unitCost DOUBLE DEFAULT 0,
  totalValue DOUBLE DEFAULT 0,
  recoveryRate DOUBLE DEFAULT 100, -- Tỷ lệ thu hồi
  note TEXT,
  FOREIGN KEY (orderId) REFERENCES disassembly_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE
);

-- ============================================================================
-- 9. CHUYỂN KHO
-- ============================================================================

CREATE TABLE IF NOT EXISTS warehouse_transfers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  transferDate TEXT NOT NULL,
  fromWarehouseId INT NOT NULL,
  toWarehouseId INT NOT NULL,
  status VARCHAR(30) DEFAULT 'DRAFT', -- 'DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'
  note TEXT,
  shippedAt TEXT,
  receivedAt TEXT,
  createdBy INT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT,
  cancelledAt TEXT,
  cancelReason TEXT,
  FOREIGN KEY (fromWarehouseId) REFERENCES warehouses(id) ON DELETE CASCADE,
  FOREIGN KEY (toWarehouseId) REFERENCES warehouses(id) ON DELETE CASCADE,
  FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS warehouse_transfer_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transferId INT NOT NULL,
  packagingId INT NOT NULL,
  plannedQuantity DOUBLE NOT NULL,
  actualQuantity DOUBLE DEFAULT 0,
  unitCost DOUBLE DEFAULT 0,
  totalValue DOUBLE DEFAULT 0,
  note TEXT,
  FOREIGN KEY (transferId) REFERENCES warehouse_transfers(id) ON DELETE CASCADE,
  FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE
);

-- ============================================================================
-- 10. KIỂM KÊ
-- ============================================================================

CREATE TABLE IF NOT EXISTS stocktakes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  date TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'DRAFT', -- 'DRAFT', 'COMPLETED', 'CANCELLED'
  note TEXT,
  createdBy INT NOT NULL,
  createdAt TEXT,
  updatedAt TEXT,
  completedAt TEXT,
  cancelledAt TEXT,
  cancelReason TEXT,
  FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS stocktake_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stocktakeId INT NOT NULL,
  packagingId INT NOT NULL,
  expectedQuantity DOUBLE DEFAULT 0, -- Tồn sổ sách
  actualQuantity DOUBLE DEFAULT 0,  -- Tồn thực tế
  difference DOUBLE DEFAULT 0,      -- Chênh lệch
  unitCost DOUBLE DEFAULT 0,
  totalValue DOUBLE DEFAULT 0,
  note TEXT,
  FOREIGN KEY (stocktakeId) REFERENCES stocktakes(id) ON DELETE CASCADE,
  FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE
);

-- ============================================================================
-- 11. KHUYẾN MÃI
-- ============================================================================

CREATE TABLE IF NOT EXISTS promotion_programs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  startDate TEXT NOT NULL,
  endDate TEXT NOT NULL,
  customerScope VARCHAR(20) DEFAULT 'ALL', -- 'ALL', 'GROUP'
  customerGroupId INT,
  priority INT DEFAULT 1,
  status VARCHAR(20) DEFAULT 'ACTIVE', -- 'DRAFT', 'ACTIVE', 'INACTIVE'
  description TEXT,
  isActive INT DEFAULT 1,
  version INT DEFAULT 1,
  createdAt TEXT,
  updatedAt TEXT,
  FOREIGN KEY (customerGroupId) REFERENCES customer_groups(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS promotion_conditions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  programId INT NOT NULL,
  packagingId INT NOT NULL,
  minimumQuantity DOUBLE NOT NULL,
  FOREIGN KEY (programId) REFERENCES promotion_programs(id) ON DELETE CASCADE,
  FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS promotion_rewards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  programId INT NOT NULL,
  packagingId INT NOT NULL,
  rewardQuantity DOUBLE NOT NULL,
  warehouseId INT,
  FOREIGN KEY (programId) REFERENCES promotion_programs(id) ON DELETE CASCADE,
  FOREIGN KEY (packagingId) REFERENCES productpackagings(id) ON DELETE CASCADE,
  FOREIGN KEY (warehouseId) REFERENCES warehouses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS promotion_usage_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  programId INT NOT NULL,
  salesOrderId INT,
  lineId INT,
  appliedQuantity DOUBLE NOT NULL,
  createdAt TEXT,
  FOREIGN KEY (programId) REFERENCES promotion_programs(id) ON DELETE CASCADE,
  FOREIGN KEY (salesOrderId) REFERENCES sales_orders(id) ON DELETE SET NULL
);

-- ============================================================================
-- 12. CÔNG NỢ
-- ============================================================================

CREATE TABLE IF NOT EXISTS receivable_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customerId INT NOT NULL,
  documentType VARCHAR(50) NOT NULL, -- 'SALES_ORDER', 'SALES_RETURN'
  documentId INT NOT NULL,
  documentCode VARCHAR(100) NOT NULL,
  transactionDate TEXT NOT NULL,
  dueDate TEXT,
  amount DOUBLE NOT NULL,
  outstanding DOUBLE NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'OVERDUE'
  createdAt TEXT,
  FOREIGN KEY (customerId) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payable_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supplierId INT NOT NULL,
  documentType VARCHAR(50) NOT NULL, -- 'PURCHASE_ORDER', 'PURCHASE_RETURN'
  documentId INT NOT NULL,
  documentCode VARCHAR(100) NOT NULL,
  transactionDate TEXT NOT NULL,
  dueDate TEXT,
  amount DOUBLE NOT NULL,
  outstanding DOUBLE NOT NULL,
  status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'PAID', 'OVERDUE'
  createdAt TEXT,
  FOREIGN KEY (supplierId) REFERENCES suppliers(id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES & CONSTRAINTS
-- ============================================================================

-- Indexes cho performance
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(categoryId);
CREATE INDEX idx_packagings_product ON productpackagings(productId);
CREATE INDEX idx_packagings_sku ON productpackagings(sku);
CREATE INDEX idx_warehouses_code ON warehouses(code);
CREATE INDEX idx_customers_code ON customers(code);
CREATE INDEX idx_suppliers_code ON suppliers(code);
CREATE INDEX idx_purchase_documents_supplier ON purchase_documents(supplierId);
CREATE INDEX idx_sales_orders_customer ON sales_orders(customerId);
CREATE INDEX idx_inventory_transactions_warehouse ON inventorytransactions(warehouseId);
CREATE INDEX idx_inventory_balances_packaging_warehouse ON inventory_balances(packagingId, warehouseId);

-- ============================================================================
-- SEED DATA MẪU
-- ============================================================================

-- Chèn roles mặc định
INSERT IGNORE INTO roles (code, name, description) VALUES
('ADMIN', 'Quản trị viên', 'Toàn quyền truy cập hệ thống'),
('W_MANAGER', 'Quản lý kho', 'Quản lý kho, nhập xuất, chuyển kho'),
('P_MANAGER', 'Quản lý sản xuất', 'Quản lý sản xuất, lắp ráp, tháo dỡ'),
('S_SALES', 'Nhân viên kinh doanh', 'Quản lý khách hàng, bán hàng, khuyến mãi'),
('QD', 'Kế toán', 'Xem báo cáo, công nợ, tài chính');

-- Chèn permissions mặc định
INSERT IGNORE INTO permissions (code, name, description) VALUES
('VIEW_DASHBOARD', 'Xem dashboard', 'Xem tổng quan hệ thống'),
('MANAGE_PRODUCTS', 'Quản lý sản phẩm', 'Thêm/sửa/xóa sản phẩm'),
('MANAGE_WAREHOUSES', 'Quản lý kho', 'Quản lý kho và tồn kho'),
('MANAGE_PURCHASES', 'Quản lý mua hàng', 'Lập và quản lý chứng từ mua'),
('MANAGE_SALES', 'Quản lý bán hàng', 'Lập và quản lý chứng từ bán'),
('MANAGE_PRODUCTION', 'Quản lý sản xuất', 'Lập và quản lý lệnh sản xuất'),
('MANAGE_ASSEMBLY', 'Quản lý lắp ráp', 'Lập và quản lý lệnh lắp ráp'),
('MANAGE_DISASSEMBLY', 'Quản lý tháo dỡ', 'Lập và quản lý lệnh tháo dỡ'),
('MANAGE_TRANSFERS', 'Quản lý chuyển kho', 'Lập và quản lý chuyển kho'),
('MANAGE_STOCKTAKE', 'Quản lý kiểm kê', 'Lập và quản lý kiểm kê'),
('MANAGE_CUSTOMERS', 'Quản lý khách hàng', 'Quản lý thông tin khách hàng'),
('MANAGE_SUPPLIERS', 'Quản lý nhà cung cấp', 'Quản lý thông tin nhà cung cấp'),
('VIEW_REPORTS', 'Xem báo cáo', 'Xem các báo cáo hệ thống'),
('MANAGE_PROMOTIONS', 'Quản lý khuyến mãi', 'Quản lý chương trình khuyến mãi'),
('MANAGE_USERS', 'Quản lý người dùng', 'Quản lý tài khoản người dùng');

-- Gán permissions cho roles
INSERT IGNORE INTO role_permissions (roleId, permissionId)
SELECT r.id, p.id FROM roles r
CROSS JOIN permissions p
WHERE r.code IN ('ADMIN', 'W_MANAGER', 'P_MANAGER', 'S_SALES', 'QD');

-- Chèn tài khoản demo
INSERT IGNORE INTO users (username, password, role, fullName, email, phone, isActive, createdAt, updatedAt)
VALUES
('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'ADMIN', 'Administrator', 'admin@erp.com', '0123456789', 1, NOW(), NOW()),
('thu_kho', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'W_MANAGER', 'Nguyễn Văn Kho', 'kho@erp.com', '0987654321', 1, NOW(), NOW()),
('quan_ly_sx', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'P_MANAGER', 'Trần Thị Sản Xuất', 'sx@erp.com', '0123789456', 1, NOW(), NOW());

-- Chèn đơn vị tính mặc định
INSERT IGNORE INTO units (code, name, symbol) VALUES
('KG', 'Kilogram', 'kg'),
('G', 'Gram', 'g'),
('UNIT', 'Cái', 'cái'),
('BOX', 'Hộp', 'hộp'),
('PACK', 'Gói', 'gói'),
('BAG', 'Túi', 'túi');

-- Chèn kho mặc định
INSERT IGNORE INTO warehouses (code, name, type, location, address, isActive, createdAt, updatedAt) VALUES
('KHO001', 'Kho Chính', 'MAIN', 'Tầng 1', '123 Đường ABC, Quận 1, TP.HCM', 1, NOW(), NOW()),
('KHO002', 'Kho Phụ', 'SUB', 'Tầng 2', '456 Đường XYZ, Quận 1, TP.HCM', 1, NOW(), NOW()),
('KHO003', 'Kho Nguyên Liệu', 'PRODUCTION', 'Tầng trệt', '789 Đường DEF, Quận 1, TP.HCM', 1, NOW(), NOW());