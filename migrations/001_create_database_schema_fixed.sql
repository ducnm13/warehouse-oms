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
  id INT AUTO_INC