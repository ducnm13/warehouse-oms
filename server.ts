import express from "express";
import "dotenv/config";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
// Đổi thư viện sang mysql2
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import ExcelJS from "exceljs";
import {formatDate, formatNumber } from "./src/lib/utils";
import fs from "fs";
import { mountV1Api } from "./apps/api/src/index";
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === "fallback_secret") {
  throw new Error("JWT_SECRET bắt buộc phải được cấu hình an toàn");
}

// --- ZALO NOTIFICATION HELPER ---
async function sendZaloNotification(orderData: any, productName: string, details: any[]) {
  const botToken = process.env.ZALO_BOT_TOKEN;
  const chatId = process.env.ZALO_CHAT_ID;

  if (!botToken || !chatId || botToken.includes("YOUR_ZALO")) {
    console.log("Zalo notification skipped: Missing or default configuration.");
    return;
  }

  try {
    const allocationText = details
      .filter((d: any) => Number(d.quantity) !== 0)
      .map((d: any) => `+ ${d.packagingName || 'Quy cách'}: {green}**${d.quantity.toLocaleString('en-US')}** ${d.packagingUnit}{/green}`)
      .join("\n");

    const message = `
🔔 {red}**${orderData.code}**{/red} 🔔
Sản phẩm: {orange}**${productName.trim()}**{/orange}
Khối lượng: {green}**${orderData.total_powder_kg} kg**{/green}
NSX: {green}**${formatDate(orderData.mfg_date) || 'N/A'}**{/green}
HSD: {green}**${formatDate(orderData.exp_date) || 'N/A'}**{/green}
Số lô: {green}**${orderData.batch_number.toUpperCase() || 'N/A'}**{/green}
Tổng số gói: {green}**${orderData.target_sachets.toLocaleString('en-US') || orderData.total_sachets.toLocaleString('en-US')}** Gói{/green}
Phân bổ:
${allocationText}
    `.trim();

    const entrypoint = `https://bot-api.zaloplatforms.com/bot${botToken}/sendMessage`;
    await axios.post(entrypoint, {
      parse_mode: "markdown",
      chat_id: chatId,
      text: message
    });
    console.log(`Zalo notification sent for order ${orderData.code}`);
  } catch (error: any) {
    console.error("Error sending Zalo notification:", error.response?.data || error.message);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Cấu hình thư mục chứa file static
  app.use("/public", express.static(path.join(process.cwd(), "public")));

  // Database setup - Kết nối MySQL
  const pool = mysql.createPool({
    host: process.env.HOST,
    user: process.env.DB_USER, // Thay bằng user MySQL của bạn
    password: process.env.DB_PASS, // Thay bằng mật khẩu MySQL của bạn
    database: process.env.DB_NAME, // Tên database MySQL của bạn
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    multipleStatements: true,
  });

  // Wrapper mô phỏng lại các hàm của SQLite
  const db = {
    all: async (sql: string, params: any[] = []) => {
      const [rows] = await pool.query(sql, params);
      return rows as any[];
    },
    get: async (sql: string, params: any[] = []) => {
      const [rows] = await pool.query(sql, params);
      return (rows as any[])[0];
    },
    run: async (sql: string, params: any[] = []) => {
      const [result] = await pool.query(sql, params);
      return {
        lastID: (result as any).insertId,
        changes: (result as any).affectedRows,
      };
    },
    exec: async (sql: string) => {
      await pool.query(sql);
    },
  };

  // Initialize Tables based on user schema - Cập nhật cú pháp chuẩn MySQL
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(255) UNIQUE,
      password TEXT,
      role TEXT, -- 'ADMIN', 'W_MANAGER' (User1), 'P_MANAGER' (User2)
      fullName TEXT
    );

    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sku TEXT,
      name TEXT NOT NULL,
      netWeight DOUBLE DEFAULT 0,
      shelfLifeMonths INT DEFAULT 24,
      isActive INT DEFAULT 1,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS productpackagings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      productId INT,
      name TEXT NOT NULL,
      sku TEXT,
      unit VARCHAR(50) DEFAULT 'Gói',
      packCount INT DEFAULT 1,
      defaultRatio DOUBLE DEFAULT 0,
      initial_stock INT DEFAULT 0,
      netWeight DOUBLE DEFAULT 0,
      shelfLifeMonths INT DEFAULT 24,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (productId) REFERENCES products (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'MAIN',
      location TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS inventorytransactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(255) UNIQUE,
      type TEXT NOT NULL, -- 'IMPORT', 'EXPORT', 'CONVERT'
      transaction_date TEXT NOT NULL,
      entry_date TEXT,
      exit_date TEXT,
      warehouseId INT,
      note TEXT,
      reason TEXT,
      recipient TEXT,
      createdBy INT,
      createdAt TEXT,
      updatedAt TEXT,
      customerId INT,
      FOREIGN KEY (warehouseId) REFERENCES warehouses (id),
      FOREIGN KEY (createdBy) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS inventorytransactiondetails (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transactionId INT,
      packagingId INT,
      quantity INT NOT NULL,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (transactionId) REFERENCES inventorytransactions (id) ON DELETE CASCADE,
      FOREIGN KEY (packagingId) REFERENCES productpackagings (id)
    );

    CREATE TABLE IF NOT EXISTS productionorders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(255) UNIQUE,
      productId INT,
      total_powder_kg DOUBLE DEFAULT 0,
      total_sachets INT DEFAULT 0,
      mfg_date TEXT,
      exp_date TEXT,
      status VARCHAR(50) DEFAULT 'DRAFT', -- 'DRAFT', 'COMPLETED'
      loss_percent DOUBLE DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (productId) REFERENCES products (id)
    );

    CREATE TABLE IF NOT EXISTS productiondetails (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orderId INT,
      packagingId INT,
      quantity INT DEFAULT 0, -- Plannned
      actual_quantity INT DEFAULT 0, -- Actual
      allocation_percent DOUBLE DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (orderId) REFERENCES productionorders (id) ON DELETE CASCADE,
      FOREIGN KEY (packagingId) REFERENCES productpackagings (id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(100) UNIQUE,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      email TEXT,
      taxCode TEXT,
      groupName TEXT,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      action TEXT NOT NULL,
      details TEXT,
      userId INT,
      userName TEXT,
      createdAt TEXT,
      FOREIGN KEY (userId) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS productwarehouses (
      packagingId INT,
      warehouseId INT,
      stock_quantity INT DEFAULT 0,
      updatedAt TEXT,
      PRIMARY KEY (packagingId, warehouseId),
      FOREIGN KEY (packagingId) REFERENCES productpackagings (id) ON DELETE CASCADE,
      FOREIGN KEY (warehouseId) REFERENCES warehouses (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stocktakes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(255) UNIQUE,
      date TEXT,
      status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, COMPLETED
      note TEXT,
      createdBy INT,
      createdAt TEXT,
      FOREIGN KEY (createdBy) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS stocktake_details (
      id INT AUTO_INCREMENT PRIMARY KEY,
      stocktakeId INT,
      packagingId INT,
      expected_qty DOUBLE DEFAULT 0, -- Tồn sổ sách
      actual_qty DOUBLE DEFAULT 0,  -- Tồn thực tế
      difference DOUBLE DEFAULT 0,  -- Chênh lệch
      FOREIGN KEY (stocktakeId) REFERENCES stocktakes (id) ON DELETE CASCADE,
      FOREIGN KEY (packagingId) REFERENCES productpackagings (id)
    );

    CREATE TABLE IF NOT EXISTS sales_orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(255) UNIQUE NOT NULL,
      orderDate TEXT NOT NULL,
      deliveryDate TEXT,
      customerId INT NOT NULL,
      warehouseId INT NOT NULL,
      status VARCHAR(30) DEFAULT 'DRAFT',
      note TEXT,
      rejectionReason TEXT,
      subtotal DOUBLE DEFAULT 0,
      discountAmount DOUBLE DEFAULT 0,
      taxAmount DOUBLE DEFAULT 0,
      totalAmount DOUBLE DEFAULT 0,
      createdBy INT NOT NULL,
      approvedBy INT,
      approvedAt TEXT,
      fulfilledAt TEXT,
      inventoryTransactionId INT,
      dueDate TEXT,
      paidAmount DOUBLE DEFAULT 0,
      paymentStatus VARCHAR(30) DEFAULT 'UNPAID',
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (customerId) REFERENCES customers (id),
      FOREIGN KEY (warehouseId) REFERENCES warehouses (id),
      FOREIGN KEY (createdBy) REFERENCES users (id),
      FOREIGN KEY (approvedBy) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS sales_order_details (
      id INT AUTO_INCREMENT PRIMARY KEY,
      orderId INT NOT NULL,
      packagingId INT NOT NULL,
      quantity DOUBLE NOT NULL,
      unitPrice DOUBLE DEFAULT 0,
      discountRate DOUBLE DEFAULT 0,
      lineTotal DOUBLE DEFAULT 0,
      note TEXT,
      FOREIGN KEY (orderId) REFERENCES sales_orders (id) ON DELETE CASCADE,
      FOREIGN KEY (packagingId) REFERENCES productpackagings (id)
    );

    CREATE TABLE IF NOT EXISTS warehouse_transfers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(255) UNIQUE NOT NULL,
      transferDate TEXT NOT NULL,
      fromWarehouseId INT NOT NULL,
      toWarehouseId INT NOT NULL,
      status VARCHAR(30) DEFAULT 'COMPLETED',
      note TEXT,
      exportTransactionId INT,
      importTransactionId INT,
      createdBy INT NOT NULL,
      createdAt TEXT,
      FOREIGN KEY (fromWarehouseId) REFERENCES warehouses (id),
      FOREIGN KEY (toWarehouseId) REFERENCES warehouses (id),
      FOREIGN KEY (createdBy) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS warehouse_transfer_details (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transferId INT NOT NULL,
      packagingId INT NOT NULL,
      quantity DOUBLE NOT NULL,
      note TEXT,
      FOREIGN KEY (transferId) REFERENCES warehouse_transfers (id) ON DELETE CASCADE,
      FOREIGN KEY (packagingId) REFERENCES productpackagings (id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(100) UNIQUE NOT NULL,
      name TEXT NOT NULL,
      taxCode TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      contactPerson TEXT,
      paymentTermDays INT DEFAULT 0,
      createdAt TEXT,
      updatedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS purchase_documents (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(255) UNIQUE NOT NULL,
      documentDate TEXT NOT NULL,
      dueDate TEXT,
      type VARCHAR(50) NOT NULL,
      paymentStatus VARCHAR(30) DEFAULT 'UNPAID',
      paymentMethod VARCHAR(30),
      invoiceOption VARCHAR(30) DEFAULT 'WITH_INVOICE',
      supplierId INT NOT NULL,
      deliveryPerson TEXT,
      buyerName TEXT,
      description TEXT,
      goodsAmount DOUBLE DEFAULT 0,
      taxAmount DOUBLE DEFAULT 0,
      purchaseCost DOUBLE DEFAULT 0,
      totalAmount DOUBLE DEFAULT 0,
      inventoryValue DOUBLE DEFAULT 0,
      paidAmount DOUBLE DEFAULT 0,
      inventoryTransactionId INT,
      createdBy INT NOT NULL,
      createdAt TEXT,
      updatedAt TEXT,
      FOREIGN KEY (supplierId) REFERENCES suppliers (id),
      FOREIGN KEY (createdBy) REFERENCES users (id)
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
      FOREIGN KEY (documentId) REFERENCES purchase_documents (id) ON DELETE CASCADE,
      FOREIGN KEY (packagingId) REFERENCES productpackagings (id),
      FOREIGN KEY (warehouseId) REFERENCES warehouses (id)
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      supplierId INT NOT NULL,
      purchaseDocumentId INT NOT NULL,
      paymentDate TEXT NOT NULL,
      amount DOUBLE NOT NULL,
      method VARCHAR(30),
      note TEXT,
      createdBy INT NOT NULL,
      createdAt TEXT,
      FOREIGN KEY (supplierId) REFERENCES suppliers (id),
      FOREIGN KEY (purchaseDocumentId) REFERENCES purchase_documents (id),
      FOREIGN KEY (createdBy) REFERENCES users (id)
    );

    CREATE TABLE IF NOT EXISTS purchase_inventory_links (
      purchaseDocumentId INT NOT NULL,
      inventoryTransactionId INT NOT NULL,
      warehouseId INT NOT NULL,
      PRIMARY KEY (purchaseDocumentId, inventoryTransactionId),
      FOREIGN KEY (purchaseDocumentId) REFERENCES purchase_documents (id) ON DELETE CASCADE,
      FOREIGN KEY (inventoryTransactionId) REFERENCES inventorytransactions (id),
      FOREIGN KEY (warehouseId) REFERENCES warehouses (id)
    );

    CREATE TABLE IF NOT EXISTS customer_payments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      customerId INT NOT NULL,
      salesOrderId INT NOT NULL,
      paymentDate TEXT NOT NULL,
      amount DOUBLE NOT NULL,
      method VARCHAR(30),
      note TEXT,
      createdBy INT NOT NULL,
      createdAt TEXT,
      FOREIGN KEY (customerId) REFERENCES customers (id),
      FOREIGN KEY (salesOrderId) REFERENCES sales_orders (id),
      FOREIGN KEY (createdBy) REFERENCES users (id)
    );
  `);

  try {
    await db.run(
      "ALTER TABLE productpackagings ADD COLUMN initial_stock INT DEFAULT 0",
    );
  } catch (e) {}
  try {
    await db.run(
      "ALTER TABLE productpackagings ADD COLUMN min_stock INT DEFAULT 0",
    );
  } catch (e) {}
  try {
    await db.run(
      "ALTER TABLE productpackagings ADD COLUMN netWeight DOUBLE DEFAULT 0",
    );
  } catch (e) {}
  try {
    await db.run(
      "ALTER TABLE productpackagings ADD COLUMN shelfLifeMonths INT DEFAULT 24",
    );
  } catch (e) {}
  try {
    await db.run(
      "ALTER TABLE productiondetails ADD COLUMN actual_quantity INT DEFAULT 0",
    );
  } catch (e) {}
  try {
    await db.run(
      "ALTER TABLE productionorders ADD COLUMN target_sachets INTEGER DEFAULT 0",
    );
  } catch (e) {}
  try {
    await db.run("ALTER TABLE productionorders ADD COLUMN order_date TEXT");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE productionorders ADD COLUMN batch_number TEXT");
  } catch (e) {}
  try {
    await db.run("ALTER TABLE productiondetails ADD COLUMN note TEXT");
  } catch (e) {}
  try {
    await db.run(
      "ALTER TABLE inventorytransactiondetails ADD COLUMN note TEXT",
    );
  } catch (e) {}
  try {
    await db.run(
      "ALTER TABLE products ADD COLUMN category VARCHAR(50) DEFAULT 'PRODUCT'",
    );
  } catch (e) {}
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS product_boms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        productPackagingId INT,
        materialPackagingId INT,
        quantity DOUBLE DEFAULT 0,
        FOREIGN KEY (productPackagingId) REFERENCES productpackagings (id) ON DELETE CASCADE,
        FOREIGN KEY (materialPackagingId) REFERENCES productpackagings (id) ON DELETE CASCADE
      );
    `);

    try {
      await db.exec(
        "ALTER TABLE inventorytransactiondetails MODIFY COLUMN quantity DOUBLE NOT NULL",
      );
    } catch (e) {}
    try {
      await db.exec(
        "ALTER TABLE productwarehouses MODIFY COLUMN stock_quantity DOUBLE DEFAULT 0",
      );
    } catch (e) {}
    try {
      await db.exec(
        "ALTER TABLE productiondetails MODIFY COLUMN quantity DOUBLE DEFAULT 0",
      );
    } catch (e) {}
    try {
      await db.exec(
        "ALTER TABLE productiondetails MODIFY COLUMN actual_quantity DOUBLE DEFAULT 0",
      );
    } catch (e) {}
    try {
      await db.exec(
        "ALTER TABLE inventorytransactiondetails MODIFY COLUMN quantity DOUBLE NOT NULL",
      );
    } catch (e) {}
    try {
      await db.exec(
        "ALTER TABLE productwarehouses MODIFY COLUMN stock_quantity DOUBLE DEFAULT 0",
      );
    } catch (e) {}
    try {
      await db.exec(
        "ALTER TABLE productiondetails MODIFY COLUMN quantity DOUBLE DEFAULT 0",
      );
    } catch (e) {}
    try {
      await db.exec(
        "ALTER TABLE productiondetails MODIFY COLUMN actual_quantity DOUBLE DEFAULT 0",
      );
    } catch (e) {}
  } catch (e) {
    console.error(e);
  }
  // Migration: Add SKU and unit to productpackagings if missing
  const pkgTableInfo = await db.all("SHOW COLUMNS FROM productpackagings");
  if (!pkgTableInfo.find((col: any) => col.Field === "sku")) {
    await db.exec("ALTER TABLE productpackagings ADD COLUMN sku TEXT");
  }
  if (!pkgTableInfo.find((col: any) => col.Field === "unit")) {
    await db.exec("ALTER TABLE productpackagings ADD COLUMN unit TEXT");
  }

  // Migration: Add reason and recipient to inventorytransactions if missing
  const txTableInfo = await db.all("SHOW COLUMNS FROM inventorytransactions");
  if (!txTableInfo.find((col: any) => col.Field === "reason")) {
    await db.exec("ALTER TABLE inventorytransactions ADD COLUMN reason TEXT");
  }
  if (!txTableInfo.find((col: any) => col.Field === "recipient")) {
    await db.exec(
      "ALTER TABLE inventorytransactions ADD COLUMN recipient TEXT",
    );
  }
  if (!txTableInfo.find((col: any) => col.Field === "customerId")) {
    await db.exec(
      "ALTER TABLE inventorytransactions ADD COLUMN customerId INT",
    );
  }
  if (!txTableInfo.find((col: any) => col.Field === "entry_date")) {
    await db.exec(
      "ALTER TABLE inventorytransactions ADD COLUMN entry_date TEXT",
    );
  }
  if (!txTableInfo.find((col: any) => col.Field === "exit_date")) {
    await db.exec(
      "ALTER TABLE inventorytransactions ADD COLUMN exit_date TEXT",
    );
  }

  const customerColumns = await db.all("SHOW COLUMNS FROM customers");
  if (!customerColumns.find((col: any) => col.Field === "code")) {
    await db.exec("ALTER TABLE customers ADD COLUMN code VARCHAR(100) UNIQUE");
  }
  await db.exec("UPDATE customers SET code = CONCAT('KH', LPAD(id, 6, '0')) WHERE code IS NULL OR code = ''");
  const salesOrderColumns = await db.all("SHOW COLUMNS FROM sales_orders");
  if (!salesOrderColumns.find((col: any) => col.Field === "dueDate")) {
    await db.exec("ALTER TABLE sales_orders ADD COLUMN dueDate TEXT");
  }
  if (!salesOrderColumns.find((col: any) => col.Field === "paidAmount")) {
    await db.exec("ALTER TABLE sales_orders ADD COLUMN paidAmount DOUBLE DEFAULT 0");
  }
  if (!salesOrderColumns.find((col: any) => col.Field === "paymentStatus")) {
    await db.exec("ALTER TABLE sales_orders ADD COLUMN paymentStatus VARCHAR(30) DEFAULT 'UNPAID'");
  }

  // Seed default admin if not exists
  const adminDoc = await db.get("SELECT * FROM users WHERE username = ?", [
    "admin",
  ]);
  if (!adminDoc) {
    const hashedPw = await bcrypt.hash("admin123", 10);
    await db.run(
      "INSERT INTO users (username, password, role, fullName) VALUES (?, ?, ?, ?)",
      ["admin", hashedPw, "ADMIN", "Administrator"],
    );
    // Seed sample users
    const user1Pw = await bcrypt.hash("user123", 10);
    await db.run(
      "INSERT INTO users (username, password, role, fullName) VALUES (?, ?, ?, ?)",
      ["thu_kho", user1Pw, "W_MANAGER", "Nguyễn Văn Kho"],
    );
    await db.run(
      "INSERT INTO users (username, password, role, fullName) VALUES (?, ?, ?, ?)",
      ["quan_ly_sx", user1Pw, "P_MANAGER", "Trần Thị Sản Xuất"],
    );
  }

  // Seed initial warehouses if empty
  const whCount = await db.get("SELECT count(*) as count FROM warehouses");
  if (whCount?.count === 0) {
    const now = new Date().toISOString();
    await db.run(
      "INSERT INTO warehouses (name, type, location, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      ["Kho Chính", "MAIN", "Tầng 1", now, now],
    );
    await db.run(
      "INSERT INTO warehouses (name, type, location, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)",
      ["Kho Phụ", "SUB", "Tầng 2", now, now],
    );
  }

  // Versioned modular API. Legacy /api routes remain available during the
  // strangler migration so current pages continue to work unchanged.
  await mountV1Api(app);

  // Legacy API Routes
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const user = await db.get("SELECT * FROM users WHERE username = ?", [
      username,
    ]);
    if (user && (await bcrypt.compare(password, user.password))) {
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        JWT_SECRET,
      );
      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          fullName: user.fullName,
        },
      });
    } else {
      res.status(401).json({ error: "Sai tài khoản hoặc mật khẩu" });
    }
  });

  // Example Protected Route Middleware
  // Helper to log actions
  const logAction = async (user: any, action: string, details: string) => {
    try {
      await db.run(
        "INSERT INTO audit_logs (action, details, userId, userName, createdAt) VALUES (?, ?, ?, ?, ?)",
        [action, details, user.id, user.fullName, new Date().toISOString()],
      );
    } catch (err) {
      console.error("Log error:", err);
    }
  };

  const authenticate = async (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const decoded: any = jwt.verify(token, JWT_SECRET);
      const user = await db.get(
        "SELECT id, username, role, fullName FROM users WHERE id = ?",
        [decoded.id],
      );
      if (!user) return res.status(401).json({ error: "User not found" });
      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: "Invalid token" });
    }
  };

  // Customers API
  app.get("/api/customers", authenticate, async (req, res) => {
    const customers = await db.all(`
      SELECT c.*,
        COALESCE(SUM(CASE WHEN so.status = 'FULFILLED' THEN GREATEST(so.totalAmount - so.paidAmount, 0) ELSE 0 END), 0) debt,
        COALESCE(SUM(CASE WHEN so.status = 'FULFILLED' AND so.dueDate < CURDATE() AND so.totalAmount > so.paidAmount
          THEN so.totalAmount - so.paidAmount ELSE 0 END), 0) overdueDebt,
        COALESCE((SELECT SUM(cp.amount) FROM customer_payments cp
          WHERE cp.customerId = c.id AND cp.paymentDate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)), 0) paidLast30Days
      FROM customers c LEFT JOIN sales_orders so ON so.customerId = c.id
      GROUP BY c.id ORDER BY c.name ASC`);
    res.json(customers);
  });

  app.post("/api/customers", authenticate, async (req: any, res) => {
    const { code, name, phone, address, email, taxCode, groupName } = req.body;
    const now = new Date().toISOString();
    try {
      const customerCode = String(code || `KH${Date.now().toString().slice(-8)}`).trim();
      const result = await db.run(
        "INSERT INTO customers (code, name, phone, address, email, taxCode, groupName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [customerCode, name, phone, address, email, taxCode, groupName, now, now],
      );

      await logAction(
        req.user,
        "Thêm khách hàng",
        `Đã thêm khách hàng/đối tác: ${name}`,
      );

      res.json({ id: result.lastID });
    } catch (err: any) {
      res.status(400).json({ error: err?.code === "ER_DUP_ENTRY" ? "Mã khách hàng đã tồn tại" : "Lỗi khi tạo khách hàng" });
    }
  });

  app.put("/api/customers/:id", authenticate, async (req: any, res) => {
    const { code, name, phone, address, email, taxCode, groupName } = req.body;
    const now = new Date().toISOString();
    try {
      await db.run(
        "UPDATE customers SET code = ?, name = ?, phone = ?, address = ?, email = ?, taxCode = ?, groupName = ?, updatedAt = ? WHERE id = ?",
        [code || `KH${String(req.params.id).padStart(6, "0")}`, name, phone, address, email, taxCode, groupName, now, req.params.id],
      );

      await logAction(
        req.user,
        "Cập nhật khách hàng",
        `Đã cập nhật thông tin khách hàng ID: ${req.params.id} (${name})`,
      );

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Lỗi khi cập nhật khách hàng" });
    }
  });

  app.delete("/api/customers/:id", authenticate, async (req: any, res) => {
    try {
      const cust = await db.get("SELECT name FROM customers WHERE id = ?", [
        req.params.id,
      ]);
      await db.run("DELETE FROM customers WHERE id = ?", [req.params.id]);

      if (cust) {
        await logAction(
          req.user,
          "Xóa khách hàng",
          `Đã xóa khách hàng: ${cust.name}`,
        );
      }

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Lỗi khi xóa khách hàng" });
    }
  });

  // Suppliers and purchasing API
  const purchaseRoles = ["ADMIN", "W_MANAGER", "QD"];
  const ensurePurchaseRole = (req: any, res: any) => {
    if (!purchaseRoles.includes(req.user.role)) {
      res.status(403).json({ error: "Bạn không có quyền truy cập phân hệ mua hàng" });
      return false;
    }
    return true;
  };

  app.get("/api/suppliers", authenticate, async (req: any, res) => {
    if (!ensurePurchaseRole(req, res)) return;
    const suppliers = await db.all(`
      SELECT s.*,
        COALESCE(SUM(GREATEST(pd.totalAmount - pd.paidAmount, 0)), 0) debt,
        COALESCE(SUM(CASE WHEN pd.dueDate < CURDATE() AND pd.totalAmount > pd.paidAmount
          THEN pd.totalAmount - pd.paidAmount ELSE 0 END), 0) overdueDebt,
        COALESCE((SELECT SUM(sp.amount) FROM supplier_payments sp
          WHERE sp.supplierId = s.id AND sp.paymentDate >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)), 0) paidLast30Days
      FROM suppliers s
      LEFT JOIN purchase_documents pd ON pd.supplierId = s.id AND COALESCE(pd.documentStatus, 'POSTED') = 'POSTED'
      GROUP BY s.id ORDER BY s.name`);
    res.json(suppliers);
  });

  app.post("/api/suppliers", authenticate, async (req: any, res) => {
    if (!ensurePurchaseRole(req, res)) return;
    const { code, name, taxCode, phone, email, address, contactPerson, paymentTermDays = 0 } = req.body;
    if (!String(code || "").trim() || !String(name || "").trim())
      return res.status(400).json({ error: "Mã và tên nhà cung cấp là bắt buộc" });
    const now = new Date().toISOString();
    try {
      const result = await db.run(
        `INSERT INTO suppliers (code, name, taxCode, phone, email, address, contactPerson, paymentTermDays, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [String(code).trim(), String(name).trim(), taxCode || "", phone || "", email || "", address || "",
          contactPerson || "", Math.max(0, Number(paymentTermDays) || 0), now, now]);
      await logAction(req.user, "Thêm nhà cung cấp", `${code} - ${name}`);
      res.status(201).json({ id: result.lastID });
    } catch (error: any) {
      res.status(400).json({ error: error?.code === "ER_DUP_ENTRY" ? "Mã nhà cung cấp đã tồn tại" : "Không thể tạo nhà cung cấp" });
    }
  });

  app.put("/api/suppliers/:id", authenticate, async (req: any, res) => {
    if (!ensurePurchaseRole(req, res)) return;
    const { code, name, taxCode, phone, email, address, contactPerson, paymentTermDays = 0 } = req.body;
    if (!String(code || "").trim() || !String(name || "").trim())
      return res.status(400).json({ error: "Mã và tên nhà cung cấp là bắt buộc" });
    try {
      await db.run(
        `UPDATE suppliers SET code=?, name=?, taxCode=?, phone=?, email=?, address=?, contactPerson=?,
          paymentTermDays=?, updatedAt=? WHERE id=?`,
        [String(code).trim(), String(name).trim(), taxCode || "", phone || "", email || "", address || "",
          contactPerson || "", Math.max(0, Number(paymentTermDays) || 0), new Date().toISOString(), req.params.id]);
      await logAction(req.user, "Cập nhật nhà cung cấp", `${code} - ${name}`);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ error: error?.code === "ER_DUP_ENTRY" ? "Mã nhà cung cấp đã tồn tại" : "Không thể cập nhật" });
    }
  });

  app.delete("/api/suppliers/:id", authenticate, async (req: any, res) => {
    if (!ensurePurchaseRole(req, res)) return;
    const used = await db.get("SELECT id FROM purchase_documents WHERE supplierId = ? LIMIT 1", [req.params.id]);
    if (used) return res.status(400).json({ error: "Nhà cung cấp đã phát sinh chứng từ, không thể xóa" });
    await db.run("DELETE FROM suppliers WHERE id = ?", [req.params.id]);
    res.json({ success: true });
  });

  const loadPurchaseDocument = async (id: string | number) => {
    const document = await db.get(`
      SELECT pd.*, s.code supplierCode, s.name supplierName, s.address supplierAddress,
        s.taxCode supplierTaxCode, s.phone supplierPhone, u.fullName creatorName
      FROM purchase_documents pd JOIN suppliers s ON s.id = pd.supplierId
      JOIN users u ON u.id = pd.createdBy WHERE pd.id = ?`, [id]);
    if (!document) return null;
    document.details = await db.all(`
      SELECT pdd.*, pp.sku, pp.name packagingName, pp.unit, p.name productName, w.name warehouseName
      FROM purchase_document_details pdd JOIN productpackagings pp ON pp.id = pdd.packagingId
      JOIN products p ON p.id = pp.productId LEFT JOIN warehouses w ON w.id = pdd.warehouseId
      WHERE pdd.documentId = ? ORDER BY pdd.id`, [id]);
    document.inventoryLinks = await db.all(`
      SELECT pil.*, it.code inventoryCode, w.name warehouseName FROM purchase_inventory_links pil
      JOIN inventorytransactions it ON it.id = pil.inventoryTransactionId
      JOIN warehouses w ON w.id = pil.warehouseId WHERE pil.purchaseDocumentId = ?`, [id]);
    return document;
  };

  app.get("/api/purchase-documents", authenticate, async (req: any, res) => {
    if (!ensurePurchaseRole(req, res)) return;
    const rows = await db.all("SELECT id FROM purchase_documents ORDER BY documentDate DESC, id DESC");
    res.json(await Promise.all(rows.map((row: any) => loadPurchaseDocument(row.id))));
  });

  app.post("/api/purchase-documents", authenticate, async (req: any, res) => {
    if (!ensurePurchaseRole(req, res)) return;
    const { documentDate, dueDate, type, paymentStatus = "UNPAID", paymentMethod, invoiceOption,
      supplierId, deliveryPerson, buyerName, description, purchaseCost = 0, details } = req.body;
    const validTypes = ["DOMESTIC_INVENTORY", "DOMESTIC_NO_INVENTORY"];
    const immediate = paymentStatus === "PAID";
    if (!documentDate || !supplierId || !validTypes.includes(type) || !Array.isArray(details) || !details.length)
      return res.status(400).json({ error: "Thông tin chứng từ mua hàng chưa đầy đủ" });
    if (details.some((d: any) => !d.packagingId || Number(d.quantity) <= 0 || Number(d.unitPrice) < 0 || Number(d.taxRate) < 0))
      return res.status(400).json({ error: "Chi tiết hàng hóa không hợp lệ" });
    if (type === "DOMESTIC_INVENTORY" && details.some((d: any) => !d.warehouseId))
      return res.status(400).json({ error: "Mỗi hàng hóa nhập kho phải chọn kho" });

    const normalized = details.map((d: any) => {
      const quantity = Number(d.quantity), unitPrice = Number(d.unitPrice), taxRate = Number(d.taxRate || 0);
      const lineAmount = quantity * unitPrice;
      return { ...d, quantity, unitPrice, taxRate, lineAmount, taxAmount: lineAmount * taxRate / 100 };
    });
    const goodsAmount = normalized.reduce((sum: number, d: any) => sum + d.lineAmount, 0);
    const taxAmount = normalized.reduce((sum: number, d: any) => sum + d.taxAmount, 0);
    const cost = Math.max(0, Number(purchaseCost) || 0);
    const totalAmount = goodsAmount + taxAmount + cost;
    const inventoryValue = type === "DOMESTIC_INVENTORY" ? goodsAmount + cost : 0;
    const now = new Date().toISOString();
    const code = `MH-${String(documentDate).replaceAll("-", "")}-${Date.now().toString().slice(-6)}`;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [supplierRows]: any = await connection.query("SELECT * FROM suppliers WHERE id = ?", [supplierId]);
      const supplier = supplierRows[0];
      if (!supplier) throw new Error("Không tìm thấy nhà cung cấp");
      const calculatedDueDate = dueDate || new Date(new Date(documentDate).getTime() + Number(supplier.paymentTermDays || 0) * 86400000).toISOString().slice(0, 10);
      const [result]: any = await connection.query(
        `INSERT INTO purchase_documents (code, documentDate, dueDate, type, paymentStatus, paymentMethod,
          invoiceOption, supplierId, deliveryPerson, buyerName, description, goodsAmount, taxAmount,
          purchaseCost, totalAmount, inventoryValue, paidAmount, createdBy, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [code, documentDate, calculatedDueDate, type, immediate ? "PAID" : "UNPAID", immediate ? paymentMethod : null,
          invoiceOption || "WITH_INVOICE", supplierId, deliveryPerson || "", buyerName || req.user.fullName,
          description || "", goodsAmount, taxAmount, cost, totalAmount, inventoryValue,
          immediate ? totalAmount : 0, req.user.id, now, now]);
      const documentId = result.insertId;
      for (const detail of normalized) await connection.query(
        `INSERT INTO purchase_document_details (documentId, packagingId, warehouseId, quantity, unitPrice,
          taxRate, lineAmount, taxAmount, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [documentId, detail.packagingId, detail.warehouseId || null, detail.quantity, detail.unitPrice,
          detail.taxRate, detail.lineAmount, detail.taxAmount, detail.note || ""]);

      if (type === "DOMESTIC_INVENTORY") {
        const warehouseGroups = new Map<number, any[]>();
        for (const detail of normalized) {
          const warehouseId = Number(detail.warehouseId);
          warehouseGroups.set(warehouseId, [...(warehouseGroups.get(warehouseId) || []), detail]);
        }
        let firstTransactionId: number | null = null;
        for (const [warehouseId, warehouseDetails] of warehouseGroups.entries()) {
          const txCode = `PN-${code}-${warehouseId}`;
          const [txResult]: any = await connection.query(
            `INSERT INTO inventorytransactions (code, type, transaction_date, entry_date, warehouseId, note,
              recipient, reason, createdBy, createdAt, updatedAt) VALUES (?, 'IMPORT', ?, ?, ?, ?, ?, 'Mua hàng', ?, ?, ?)`,
            [txCode, documentDate, documentDate, warehouseId, `Nhập kho theo chứng từ ${code}`,
              supplier.name, req.user.id, now, now]);
          if (!firstTransactionId) firstTransactionId = txResult.insertId;
          await connection.query(
            "INSERT INTO purchase_inventory_links (purchaseDocumentId, inventoryTransactionId, warehouseId) VALUES (?, ?, ?)",
            [documentId, txResult.insertId, warehouseId]);
          for (const detail of warehouseDetails) {
            await connection.query(
              `INSERT INTO inventorytransactiondetails (transactionId, packagingId, quantity, note, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?)`, [txResult.insertId, detail.packagingId, detail.quantity, code, now, now]);
            await connection.query(
              `INSERT INTO productwarehouses (packagingId, warehouseId, stock_quantity, updatedAt) VALUES (?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE stock_quantity = stock_quantity + VALUES(stock_quantity), updatedAt = VALUES(updatedAt)`,
              [detail.packagingId, warehouseId, detail.quantity, now]);
          }
        }
        await connection.query("UPDATE purchase_documents SET inventoryTransactionId = ? WHERE id = ?", [firstTransactionId, documentId]);
      }
      if (immediate) await connection.query(
        `INSERT INTO supplier_payments (supplierId, purchaseDocumentId, paymentDate, amount, method, note, createdBy, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [supplierId, documentId, documentDate, totalAmount, paymentMethod || "CASH", `Thanh toán chứng từ ${code}`, req.user.id, now]);
      await connection.commit();
      await logAction(req.user, "Tạo chứng từ mua hàng", `${code} - ${supplier.name}`);
      res.status(201).json(await loadPurchaseDocument(documentId));
    } catch (error: any) {
      await connection.rollback();
      console.error(error);
      res.status(400).json({ error: error.message || "Không thể tạo chứng từ mua hàng" });
    } finally { connection.release(); }
  });

  app.post("/api/purchase-documents/:id/payments", authenticate, async (req: any, res) => {
    if (!ensurePurchaseRole(req, res)) return;
    const { amount, paymentDate, method, note } = req.body;
    const value = Number(amount);
    if (!paymentDate || value <= 0) return res.status(400).json({ error: "Số tiền thanh toán không hợp lệ" });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows]: any = await connection.query("SELECT * FROM purchase_documents WHERE id = ? FOR UPDATE", [req.params.id]);
      const document = rows[0];
      if (!document) throw new Error("Không tìm thấy chứng từ");
      const remaining = Number(document.totalAmount) - Number(document.paidAmount);
      if (value > remaining + 0.001) throw new Error("Số tiền thanh toán vượt quá công nợ còn lại");
      const newPaid = Number(document.paidAmount) + value;
      const status = newPaid >= Number(document.totalAmount) - 0.001 ? "PAID" : "PARTIAL";
      const now = new Date().toISOString();
      await connection.query(
        `INSERT INTO supplier_payments (supplierId, purchaseDocumentId, paymentDate, amount, method, note, createdBy, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [document.supplierId, document.id, paymentDate, value, method || "BANK", note || "", req.user.id, now]);
      await connection.query("UPDATE purchase_documents SET paidAmount=?, paymentStatus=?, paymentMethod=?, updatedAt=? WHERE id=?",
        [newPaid, status, method || "BANK", now, document.id]);
      await connection.commit();
      await logAction(req.user, "Thanh toán nhà cung cấp", `${document.code}: ${value}`);
      res.json(await loadPurchaseDocument(document.id));
    } catch (error: any) {
      await connection.rollback();
      res.status(400).json({ error: error.message || "Không thể ghi nhận thanh toán" });
    } finally { connection.release(); }
  });

  // Audit Logs API
  app.get("/api/audit-logs", authenticate, async (req: any, res) => {
    if (req.user.role !== "ADMIN") {
      return res.status(403).json({ error: "Quyền truy cập bị từ chối" });
    }
    const logs = await db.all(
      "SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT 50",
    );
    res.json(logs);
  });

  // Products API
  app.get("/api/products", authenticate, async (req, res) => {
    const { category } = req.query;
    let sql = "SELECT * FROM products";
    const params = [];

    if (category) {
      sql += " WHERE category = ?";
      params.push(category);
    }

    const products = await db.all(sql, params);
    for (const p of products) {
      p.packagings = await db.all(
        `
        SELECT
          pp.*,
          (
            pp.initial_stock +
            COALESCE((
              SELECT SUM(CASE WHEN it.type = 'IMPORT' THEN itd.quantity ELSE -itd.quantity END)
              FROM inventorytransactiondetails itd
              JOIN inventorytransactions it ON itd.transactionId = it.id
              WHERE itd.packagingId = pp.id
            ), 0)
          ) as stock
        FROM productpackagings pp
        WHERE pp.productId = ?
        `,
        [p.id],
      );

      let totalStock = 0;
      for (const pk of p.packagings) {
        totalStock += (pk.stock || 0) * (pk.packCount || 1);
        // THÊM DÒNG NÀY: Lấy định mức BOM cho quy cách này
        pk.boms = await db.all(
          "SELECT * FROM product_boms WHERE productPackagingId = ?",
          [pk.id],
        );
      }
      p.totalStock = totalStock;
    }
    res.json(products);
  });

  app.post("/api/products", authenticate, async (req: any, res) => {
    const { name, sku, netWeight, shelfLifeMonths, packagings, category } =
      req.body;
    const now = new Date().toISOString();

    try {
      const result = await db.run(
        "INSERT INTO products (name, sku, netWeight, shelfLifeMonths, category, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          name,
          sku || "",
          netWeight || 0,
          shelfLifeMonths || 24,
          category || "PRODUCT",
          now,
          now,
        ],
      );
      const productId = result.lastID;

      if (packagings && Array.isArray(packagings)) {
        for (const pk of packagings) {
          const resPk = await db.run(
            "INSERT INTO productpackagings (productId, name, sku, unit, packCount, initial_stock, min_stock, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
              productId,
              pk.name,
              pk.sku || "",
              pk.unit || "Gói",
              pk.packCount || 1,
              pk.initial_stock || 0,
              pk.min_stock || 0,
              now,
              now,
            ],
          );

          // LƯU ĐỊNH MỨC BOM (NẾU CÓ)
          const currentPkId = resPk.lastID;
          if (pk.boms && Array.isArray(pk.boms)) {
            for (const bom of pk.boms) {
              if (bom.materialPackagingId && bom.quantity > 0) {
                await db.run(
                  "INSERT INTO product_boms (productPackagingId, materialPackagingId, quantity) VALUES (?, ?, ?)",
                  [currentPkId, bom.materialPackagingId, bom.quantity],
                );
              }
            }
          }
        }
      }

      await logAction(
        req.user,
        "Tạo sản phẩm",
        `Đã tạo sản phẩm/vật tư: ${name}`,
      );

      res.json({ id: productId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Lỗi khi tạo sản phẩm" });
    }
  });

  app.put("/api/products/:id", authenticate, async (req: any, res) => {
    const { name, sku, netWeight, shelfLifeMonths, packagings, category } =
      req.body;
    const now = new Date().toISOString();

    try {
      await db.run(
        "UPDATE products SET name = ?, sku = ?, netWeight = ?, shelfLifeMonths = ?, category = ?, updatedAt = ? WHERE id = ?",
        [
          name,
          sku || "",
          netWeight || 0,
          shelfLifeMonths || 24,
          category || "PRODUCT",
          now,
          req.params.id,
        ],
      );

      if (packagings && Array.isArray(packagings)) {
        const currentPackagings = await db.all(
          "SELECT id FROM productpackagings WHERE productId = ?",
          [req.params.id],
        );
        const currentIds = currentPackagings.map((cp) => cp.id);
        const incomingIds = packagings.map((p) => p.id).filter((id) => id);

        const toDelete = currentIds.filter((id) => !incomingIds.includes(id));
        if (toDelete.length > 0) {
          const placeholders = toDelete.map(() => "?").join(",");
          await db.run(
            `DELETE FROM productpackagings WHERE id IN (${placeholders})`,
            toDelete,
          );
          await db.run(
            `DELETE FROM productwarehouses WHERE packagingId IN (${placeholders})`,
            toDelete,
          );
        }

        for (const pk of packagings) {
          let currentPkId = pk.id;
          if (pk.id) {
            await db.run(
              "UPDATE productpackagings SET name = ?, sku = ?, unit = ?, packCount = ?, initial_stock = ?, min_stock = ?, updatedAt = ? WHERE id = ?",
              [
                pk.name,
                pk.sku || "",
                pk.unit || "Cái",
                pk.packCount || 1,
                pk.initial_stock || 0,
                pk.min_stock || 0,
                now,
                pk.id,
              ],
            );
          } else {
            const resPk = await db.run(
              "INSERT INTO productpackagings (productId, name, sku, unit, packCount, initial_stock, min_stock, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
              [
                req.params.id,
                pk.name,
                pk.sku || "",
                pk.unit || "Cái",
                pk.packCount || 1,
                pk.initial_stock || 0,
                pk.min_stock || 0,
                now,
                now,
              ],
            );
            currentPkId = resPk.lastID;
          }

          // XỬ LÝ LƯU BOM
          await db.run(
            "DELETE FROM product_boms WHERE productPackagingId = ?",
            [currentPkId],
          );
          if (pk.boms && Array.isArray(pk.boms)) {
            for (const bom of pk.boms) {
              if (bom.materialPackagingId && bom.quantity > 0) {
                await db.run(
                  "INSERT INTO product_boms (productPackagingId, materialPackagingId, quantity) VALUES (?, ?, ?)",
                  [currentPkId, bom.materialPackagingId, bom.quantity],
                );
              }
            }
          }
        }
      }

      await logAction(
        req.user,
        "Cập nhật sản phẩm",
        `Đã cập nhật ID: ${req.params.id} (${name})`,
      );

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Lỗi khi cập nhật sản phẩm" });
    }
  });

  app.patch("/api/products/:id", authenticate, async (req, res) => {
    const {
      name,
      sku,
      netWeight,
      shelfLifeMonths,
      isActive,
      packagings,
      category,
    } = req.body;
    const now = new Date().toISOString();

    await db.run(
      `UPDATE products SET
        name = COALESCE(?, name),
        sku = COALESCE(?, sku),
        netWeight = COALESCE(?, netWeight),
        shelfLifeMonths = COALESCE(?, shelfLifeMonths),
        category = COALESCE(?, category),
        isActive = COALESCE(?, isActive),
        updatedAt = ?
       WHERE id = ?`,
      [
        name,
        sku,
        netWeight,
        shelfLifeMonths,
        category,
        isActive,
        now,
        req.params.id,
      ],
    );

    // Không xử lý chi tiết packagings ở PATCH để tránh đụng độ BOM, dùng PUT cho tác vụ đó
    res.json({ success: true });
  });

  app.delete("/api/products/:id", authenticate, async (req, res) => {
    try {
      const packagings = await db.all(
        "SELECT id FROM productpackagings WHERE productId = ?",
        [req.params.id],
      );
      const pkgIds = packagings.map((p) => p.id);

      if (pkgIds.length > 0) {
        const placeholders = pkgIds.map(() => "?").join(",");
        await db.run(
          `DELETE FROM productwarehouses WHERE packagingId IN (${placeholders})`,
          pkgIds,
        );
        await db.run(
          `DELETE FROM inventorytransactiondetails WHERE packagingId IN (${placeholders})`,
          pkgIds,
        );
        await db.run(`DELETE FROM productpackagings WHERE productId = ?`, [
          req.params.id,
        ]);
      }

      await db.run("DELETE FROM products WHERE id = ?", [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Lỗi hệ thống khi xóa sản phẩm" });
    }
  });

  // Transactions API
  app.get("/api/transactions", authenticate, async (req, res) => {
    const txs = await db.all(`
      SELECT it.*, u.fullName as creatorName, w.name as warehouseName, c.name as customerName
      FROM inventorytransactions it
      LEFT JOIN users u ON it.createdBy = u.id
      LEFT JOIN warehouses w ON it.warehouseId = w.id
      LEFT JOIN customers c ON it.customerId = c.id
      ORDER BY it.createdAt DESC
    `);
    for (const tx of txs) {
      tx.details = await db.all(
        `
        SELECT itd.*, pp.name as packagingName, pp.unit, pp.sku, p.name as productName, p.category as productCategory
        FROM inventorytransactiondetails itd
        JOIN productpackagings pp ON itd.packagingId = pp.id
        JOIN products p ON pp.productId = p.id
        WHERE itd.transactionId = ?
      `,
        [tx.id],
      );
    }
    res.json(txs);
  });

  app.delete("/api/transactions/:id", authenticate, async (req: any, res) => {
    if (req.user.role !== "ADMIN") {
      return res
        .status(403)
        .json({ error: "Chỉ quản trị viên mới có quyền xóa phiếu" });
    }

    try {
      const tx = await db.get(
        "SELECT * FROM inventorytransactions WHERE id = ?",
        [req.params.id],
      );
      if (!tx) return res.status(404).json({ error: "Không tìm thấy phiếu" });

      const details = await db.all(
        "SELECT * FROM inventorytransactiondetails WHERE transactionId = ?",
        [req.params.id],
      );
      const now = new Date().toISOString();

      for (const d of details) {
        const stockAdjustment = tx.type === "IMPORT" ? -d.quantity : d.quantity;

        // Cập nhật câu lệnh cho MySQL
        await db.run(
          `INSERT INTO productwarehouses (packagingId, warehouseId, stock_quantity, updatedAt)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           stock_quantity = stock_quantity + VALUES(stock_quantity),
           updatedAt = VALUES(updatedAt)`,
          [d.packagingId, tx.warehouseId, stockAdjustment, now],
        );
      }

      await db.run(
        "DELETE FROM inventorytransactiondetails WHERE transactionId = ?",
        [req.params.id],
      );
      await db.run("DELETE FROM inventorytransactions WHERE id = ?", [
        req.params.id,
      ]);

      await logAction(
        req.user,
        "Xóa phiếu kho",
        `Đã xóa phiếu ${tx.code} (${tx.type})`,
      );

      res.json({ success: true, message: "Đã xóa phiếu và khôi phục tồn kho" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Lỗi hệ thống khi xóa phiếu" });
    }
  });

  app.post("/api/transactions", authenticate, async (req: any, res) => {
    const {
      type,
      transaction_date,
      entry_date,
      exit_date,
      warehouseId,
      note,
      recipient,
      customerId,
      reason,
      createdBy,
      details,
    } = req.body;
    const now = new Date().toISOString();

    try {
      const dateObj = new Date(transaction_date);
      const day = String(dateObj.getDate()).padStart(2, "0");
      const month = String(dateObj.getMonth() + 1).padStart(2, "0");
      const year = String(dateObj.getFullYear()).slice(-2);
      const prefix = type === "IMPORT" ? "PNCL" : "PXCL";
      const dateStr = `${day}${month}${year}`;

      const lastTx = await db.get(
        "SELECT code FROM inventorytransactions WHERE type = ? AND transaction_date = ? ORDER BY code DESC LIMIT 1",
        [type, transaction_date],
      );

      let seq = 1;
      if (lastTx && lastTx.code.includes(dateStr)) {
        const parts = lastTx.code.split("-");
        const lastSeq = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastSeq)) {
          seq = lastSeq + 1;
        }
      }

      const code = `${prefix}${dateStr}-${String(seq).padStart(3, "0")}`;
      const finalCreatorId =
        req.user.role === "ADMIN" && createdBy ? createdBy : req.user.id;

      const result = await db.run(
        "INSERT INTO inventorytransactions (code, type, transaction_date, entry_date, exit_date, warehouseId, note, recipient, customerId, reason, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          code,
          type,
          transaction_date,
          entry_date,
          exit_date,
          warehouseId,
          note,
          recipient,
          customerId,
          reason,
          finalCreatorId,
          now,
          now,
        ],
      );
      const txId = result.lastID;

      for (const d of details) {
        await db.run(
          "INSERT INTO inventorytransactiondetails (transactionId, packagingId, quantity, note, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
          [txId, d.packagingId, d.quantity, d.note || "", now, now],
        );

        const stockChange = type === "IMPORT" ? d.quantity : -d.quantity;
        // Cập nhật câu lệnh cho MySQL
        await db.run(
          `INSERT INTO productwarehouses (packagingId, warehouseId, stock_quantity, updatedAt)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
           stock_quantity = stock_quantity + VALUES(stock_quantity),
           updatedAt = VALUES(updatedAt)`,
          [d.packagingId, warehouseId, stockChange, now],
        );
      }
      await logAction(
        req.user,
        "Lập phiếu kho",
        `Đã lập phiếu ${code} (${type})`,
      );

      res.json({ id: txId });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Lỗi hệ thống khi lập phiếu" });
    }
  });

  // API Sửa phiếu nhập xuất
app.put("/api/transactions/:id", authenticate, async (req: any, res) => {
    const {
      type,
      transaction_date,
      entry_date,
      exit_date,
      warehouseId,
      note,
      recipient,
      customerId,
      reason,
      createdBy,
      details,
    } = req.body;
    const now = new Date().toISOString();
    const txId = req.params.id;

    try {
      const oldTx = await db.get(
        "SELECT * FROM inventorytransactions WHERE id = ?",
        [txId]
      );
      if (!oldTx) return res.status(404).json({ error: "Không tìm thấy phiếu" });

      const oldDetails = await db.all(
        "SELECT * FROM inventorytransactiondetails WHERE transactionId = ?",
        [txId]
      );

      // 1. TÍNH TOÁN BÙ TRỪ TỒN KHO TRONG BỘ NHỚ (NET DELTA)
      const stockChanges = new Map();

      // Hoàn trả số lượng cũ (Nếu cũ là IMPORT thì trừ đi, EXPORT thì cộng lại)
      for (const d of oldDetails) {
        const revertStock = oldTx.type === "IMPORT" ? -d.quantity : d.quantity;
        const key = `${oldTx.warehouseId}_${d.packagingId}`;
        stockChanges.set(key, (stockChanges.get(key) || 0) + revertStock);
      }

      // Áp dụng số lượng mới (Nếu mới là IMPORT thì cộng vào, EXPORT thì trừ đi)
      for (const d of details) {
        const applyStock = type === "IMPORT" ? d.quantity : -d.quantity;
        const key = `${warehouseId}_${d.packagingId}`;
        stockChanges.set(key, (stockChanges.get(key) || 0) + applyStock);
      }

      // 2. KIỂM TRA CHỐNG ÂM KHO TỪ PHÍA BACKEND
      for (const [key, netChange] of stockChanges.entries()) {
        if (netChange < 0) {
          const [wId, pId] = key.split('_');
          const currentStockRow = await db.get(
            "SELECT stock_quantity FROM productwarehouses WHERE warehouseId = ? AND packagingId = ?",
            [wId, pId]
          );
          const currentStock = currentStockRow?.stock_quantity || 0;

          if (currentStock + netChange < 0) {
            return res.status(400).json({
              error: `Lỗi: Số lượng xuất vượt quá tồn kho hiện tại (Tồn: ${currentStock}).`
            });
          }
        }
      }

      // 3. CẬP NHẬT THÔNG TIN PHIẾU
      const finalCreatorId = req.user.role === "ADMIN" && createdBy ? createdBy : req.user.id;
      await db.run(
        "UPDATE inventorytransactions SET type = ?, transaction_date = ?, entry_date = ?, exit_date = ?, warehouseId = ?, note = ?, recipient = ?, customerId = ?, reason = ?, createdBy = ?, updatedAt = ? WHERE id = ?",
        [type, transaction_date, entry_date || null, exit_date || null, warehouseId, note, recipient, customerId || null, reason, finalCreatorId, now, txId]
      );

      // Xóa chi tiết cũ và Thêm chi tiết mới
      await db.run("DELETE FROM inventorytransactiondetails WHERE transactionId = ?", [txId]);
      for (const d of details) {
        await db.run(
          "INSERT INTO inventorytransactiondetails (transactionId, packagingId, quantity, note, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
          [txId, d.packagingId, d.quantity, d.note || "", now, now]
        );
      }

      // 4. ÁP DỤNG CHÊNH LỆCH VÀO KHO (Chỉ gọi 1 lệnh duy nhất cho mỗi mặt hàng)
      for (const [key, netChange] of stockChanges.entries()) {
        if (netChange !== 0) {
          const [wId, pId] = key.split('_');
          await db.run(
            `INSERT INTO productwarehouses (packagingId, warehouseId, stock_quantity, updatedAt)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             stock_quantity = stock_quantity + VALUES(stock_quantity),
             updatedAt = VALUES(updatedAt)`,
            [pId, wId, netChange, now]
          );
        }
      }

      await logAction(req.user, "Sửa phiếu kho", `Đã sửa phiếu ${oldTx.code}`);
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Lỗi hệ thống khi sửa phiếu" });
    }
  });

  // Production API
  app.get("/api/production-orders", authenticate, async (req, res) => {
    const orders = await db.all(`
      SELECT po.*, p.name as productName
      FROM productionorders po
      JOIN products p ON po.productId = p.id
      ORDER BY po.createdAt DESC
    `);
    for (const o of orders) {
      o.details = await db.all(
        `
        SELECT pd.*, pp.name as packagingName,pp.packCount
        FROM productiondetails pd
        JOIN productpackagings pp ON pd.packagingId = pp.id
        WHERE pd.orderId = ?
      `,
        [o.id],
      );
    }
    res.json(orders);
  });

  app.post("/api/production-orders", authenticate, async (req: any, res) => {
    const {
      code,
      batch_number,
      productId,
      total_powder_kg,
      total_sachets,
      target_sachets,
      order_date,
      mfg_date,
      exp_date,
      loss_percent,
      details,
    } = req.body;
    const now = new Date().toISOString();
    const finalOrderDate = order_date || now.split("T")[0]; // Dùng ngày truyền lên hoặc ngày hiện tại
    const result = await db.run(
      "INSERT INTO productionorders (code, batch_number, productId, total_powder_kg, total_sachets, target_sachets, order_date, mfg_date, exp_date, loss_percent, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        code || "",
        batch_number || null, // Nếu undefined sẽ tự chuyển thành null an toàn cho mysql
        productId || null,
        total_powder_kg || 0,
        total_sachets || 0,
        target_sachets || 0,
        finalOrderDate || null,
        mfg_date || null,
        exp_date || null,
        loss_percent || 0,
        "DRAFT",
        now,
        now,
      ],
    );
    const orderId = result.lastID;
    const enrichedDetails = [];
    for (const d of details) {
      const packaging = await db.get("SELECT name,unit FROM productpackagings WHERE id = ?", [d.packagingId]);
      await db.run(
        "INSERT INTO productiondetails (orderId, packagingId, quantity, allocation_percent, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
        [orderId, d.packagingId, d.quantity, d.allocation_percent, now, now],
      );
      enrichedDetails.push({ ...d, packagingName: packaging?.name, packagingUnit: packaging?.unit });
    }

    await logAction(
      req.user,
      "Tạo lệnh sản xuất",
      `Đã tạo lệnh sản xuất mới: ${code}`,
    );

    // Gửi thông báo Zalo
    const product = await db.get("SELECT name FROM products WHERE id = ?", [productId]);
    sendZaloNotification(req.body, product?.name || "N/A", enrichedDetails);

    res.json({ id: orderId });
  });

  // API sửa lệnh sản xuất
  app.put("/api/production-orders/:id", authenticate, async (req: any, res) => {
    const {
      code,
      batch_number,
      productId,
      total_powder_kg,
      total_sachets,
      target_sachets,
      order_date,
      mfg_date,
      exp_date,
      loss_percent,
      details,
    } = req.body;
    const now = new Date().toISOString();

    try {
      // Giữ lại số lượng thực tế và ghi chú khi sửa một lệnh đã chốt.
      // Trước đây toàn bộ details bị xóa rồi tạo lại nên actual_quantity trở về 0,
      // làm phiếu bán thành phẩm đã chốt không còn dòng dữ liệu để hiển thị.
      const existingDetails = await db.all(
        "SELECT packagingId, actual_quantity, note FROM productiondetails WHERE orderId = ?",
        [req.params.id],
      );
      const existingDetailMap = new Map(
        existingDetails.map((detail: any) => [Number(detail.packagingId), detail]),
      );

      await db.run(
        "UPDATE productionorders SET code = ?, batch_number = ?, productId = ?, total_powder_kg = ?, total_sachets = ?, target_sachets = ?, order_date = ?, mfg_date = ?, exp_date = ?, loss_percent = ?, updatedAt = ? WHERE id = ?",
        [
          code,
          batch_number,
          productId,
          total_powder_kg,
          total_sachets,
          target_sachets || 0,
          order_date,
          mfg_date,
          exp_date,
          loss_percent,
          now,
          req.params.id,
        ],
      );

      // Xóa details cũ và thêm mới lại
      await db.run("DELETE FROM productiondetails WHERE orderId = ?", [
        req.params.id,
      ]);
      for (const d of details) {
        const existingDetail: any = existingDetailMap.get(Number(d.packagingId));
        await db.run(
          "INSERT INTO productiondetails (orderId, packagingId, quantity, actual_quantity, allocation_percent, note, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            req.params.id,
            d.packagingId,
            d.quantity,
            Number(existingDetail?.actual_quantity) || 0,
            d.allocation_percent,
            existingDetail?.note || "",
            now,
            now,
          ],
        );
      }
      await logAction(
        req.user,
        "Sửa lệnh sản xuất",
        `Đã sửa lệnh sản xuất: ${code}`,
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Lỗi hệ thống khi sửa lệnh" });
    }
  });

  // API Cập nhật & Chốt lệnh sản xuất (Tự động trừ/nhập kho)
  app.patch(
    "/api/production-orders/:id",
    authenticate,
    async (req: any, res) => {
      // Đã loại bỏ biến consumedMaterials ra khỏi Hướng 2 BOM
      const { status, details } = req.body;
      const now = new Date().toISOString();
      const orderId = req.params.id;

      try {
        const order = await db.get(
          "SELECT code, status FROM productionorders WHERE id = ?",
          [orderId],
        );
        if (!order)
          return res.status(404).json({ error: "Không tìm thấy lệnh SX" });

        // Chặn trường hợp bấm hoàn thành nhiều lần gây trừ kho lặp lại
        if (order.status === "COMPLETED" && status === "COMPLETED") {
          return res
            .status(400)
            .json({ error: "Lệnh này đã được chốt trước đó!" });
        }

        if (status) {
          await db.run(
            "UPDATE productionorders SET status = ?, updatedAt = ? WHERE id = ?",
            [status, now, orderId],
          );
        }

        // Cập nhật số lượng Thành phẩm thực tế
        if (details && Array.isArray(details)) {
          for (const d of details) {
            if (d.id) {
              await db.run(
                "UPDATE productiondetails SET actual_quantity = ?, note = ?, updatedAt = ? WHERE id = ?",
                [d.actual_quantity || 0, d.note || "", now, d.id],
              );
            }
          }
        }

        // ========================================================
        // TỰ ĐỘNG PHÁT SINH PHIẾU KHO KHI CHỐT LỆNH THEO BOM
        // ========================================================
        if (status === "COMPLETED") {
          const dateObj = new Date();
          const dateStr = `${String(dateObj.getDate()).padStart(2, "0")}${String(dateObj.getMonth() + 1).padStart(2, "0")}${String(dateObj.getFullYear()).slice(-2)}`;

          // 1. TẠO PHIẾU NHẬP THÀNH PHẨM (Kho 1)
          const importDetails =
            details?.filter((d: any) => (d.actual_quantity || 0) > 0) || [];

          if (importDetails.length > 0) {
            const lastImport = await db.get(
              "SELECT code FROM inventorytransactions WHERE type = 'IMPORT' AND transaction_date = ? ORDER BY code DESC LIMIT 1",
              [now.split("T")[0]],
            );
            let seqI = 1;
            if (lastImport && lastImport.code.includes(dateStr)) {
              const parts = lastImport.code.split("-");
              seqI = parseInt(parts[parts.length - 1]) + 1 || 1;
            }
            // Lấy ngày hiện tại an toàn
            const todayStr = new Date().toISOString().split("T")[0];
            // 1. Đếm xem trong ngày hôm nay đã có bao nhiêu phiếu nhập IMPORT
            const countQuery = await db.get(
              `SELECT COUNT(*) as total
           FROM inventorytransactions
           WHERE type = 'IMPORT' AND transaction_date = ?`,
              [todayStr],
            );
            // 2. Số thứ tự tiếp theo = Số lượng hiện tại + 1
            const nextSequence = (countQuery.total || 0) + 1;
            // 3. Chuẩn hóa chuỗi (VD: format ngày 20260522, format số thứ tự 001, 002...)
            const datePart = todayStr.replace(/-/g, "");
            const sequencePart = nextSequence.toString().padStart(3, "0"); // Biến 1 thành '001'

            // 4. Lắp ráp thành mã phiếu chính thức
            const txCode = `PNTP${datePart}-${sequencePart}`;

            const importTx = await db.run(
              `INSERT INTO inventorytransactions (
            code, type, transaction_date, entry_date, warehouseId, recipient, note, reason, createdBy, createdAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                txCode,
                "IMPORT",
                todayStr,
                todayStr,
                1,
                "Bộ phận đóng gói",
                `Nhập TP từ ${order.code}`,
                "Sản xuất",
                req.user.id,
                now,
                now,
              ],
            );

            for (const d of importDetails) {
              await db.run(
                "INSERT INTO inventorytransactiondetails (transactionId, packagingId, quantity, note, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
                [
                  importTx.lastID,
                  d.packagingId,
                  d.actual_quantity,
                  "",
                  now,
                  now,
                ],
              );
              await db.run(
                `INSERT INTO productwarehouses (packagingId, warehouseId, stock_quantity, updatedAt) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE stock_quantity = stock_quantity + VALUES(stock_quantity), updatedAt = VALUES(updatedAt)`,
                [d.packagingId, 1, d.actual_quantity, now],
              );
            }

            // 2. TẠO PHIẾU XUẤT BAO BÌ DỰA THEO ĐỊNH MỨC BOM (Kho 1)
            const exportDetailsMap = new Map();

            // Tính toán tiêu hao tự động dựa trên Thành phẩm thực tế
            for (const d of importDetails) {
              const boms = await db.all(
                "SELECT materialPackagingId, quantity FROM product_boms WHERE productPackagingId = ?",
                [d.packagingId],
              );

              for (const bom of boms) {
                const totalConsumed = bom.quantity * d.actual_quantity;
                if (exportDetailsMap.has(bom.materialPackagingId)) {
                  exportDetailsMap.set(
                    bom.materialPackagingId,
                    exportDetailsMap.get(bom.materialPackagingId) +
                      totalConsumed,
                  );
                } else {
                  exportDetailsMap.set(bom.materialPackagingId, totalConsumed);
                }
              }
            }

            const exportDetails = Array.from(exportDetailsMap.entries()).map(
              ([packagingId, quantity]) => ({ packagingId, quantity }),
            );

            // Sinh phiếu xuất kho nếu có phát sinh tiêu hao
            if (exportDetails.length > 0) {
              const lastExport = await db.get(
                "SELECT code FROM inventorytransactions WHERE type = 'EXPORT' AND transaction_date = ? ORDER BY code DESC LIMIT 1",
                [now.split("T")[0]],
              );
              let seqE = 1;
              if (lastExport && lastExport.code.includes(dateStr)) {
                const parts = lastExport.code.split("-");
                seqE = parseInt(parts[parts.length - 1]) + 1 || 1;
              }
              const exportCode = `PXCL${dateStr}-${String(seqE).padStart(3, "0")}`;

              const exportTx = await db.run(
                "INSERT INTO inventorytransactions (code, type, transaction_date, exit_date, warehouseId, note, recipient, reason, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                  exportCode,
                  "EXPORT",
                  now.split("T")[0],
                  now.split("T")[0],
                  1,
                  `Xuất vật tư cho ${order.code}`,
                  "Bộ phận Sản xuất",
                  "Sản xuất",
                  req.user.id,
                  now,
                  now,
                ],
              );

              for (const m of exportDetails) {
                await db.run(
                  "INSERT INTO inventorytransactiondetails (transactionId, packagingId, quantity, note, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)",
                  [exportTx.lastID, m.packagingId, m.quantity, "", now, now],
                );
                await db.run(
                  `INSERT INTO productwarehouses (packagingId, warehouseId, stock_quantity, updatedAt) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE stock_quantity = stock_quantity + VALUES(stock_quantity), updatedAt = VALUES(updatedAt)`,
                  [m.packagingId, 1, -m.quantity, now],
                );
              }
            }
          }
        }

        await logAction(
          req.user,
          "Cập nhật lệnh sản xuất",
          `Đã ${status === "COMPLETED" ? "chốt" : "cập nhật"} lệnh SX: ${order.code}`,
        );
        res.json({ success: true });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Lỗi hệ thống khi cập nhật lệnh" });
      }
    },
  );

  app.delete(
    "/api/production-orders/:id",
    authenticate,
    async (req: any, res) => {
      if (req.user.role !== "ADMIN") {
        return res
          .status(403)
          .json({ error: "Chỉ quản trị viên mới có quyền xóa lệnh sản xuất" });
      }
      try {
        const order = await db.get(
          "SELECT code FROM productionorders WHERE id = ?",
          [req.params.id],
        );
        await db.run("DELETE FROM productiondetails WHERE orderId = ?", [
          req.params.id,
        ]);
        await db.run("DELETE FROM productionorders WHERE id = ?", [
          req.params.id,
        ]);

        if (order) {
          await logAction(
            req.user,
            "Xóa lệnh sản xuất",
            `Đã xóa lệnh sản xuất: ${order.code}`,
          );
        }

        res.json({ success: true });
      } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Lỗi hệ thống khi xóa lệnh sản xuất" });
      }
    },
  );

  // Users Management API (Admin only)
  app.get("/api/users", authenticate, async (req: any, res) => {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ error: "Access denied" });
    const users = await db.all(
      "SELECT id, username, role, fullName FROM users",
    );
    res.json(users);
  });

  app.post("/api/users", authenticate, async (req: any, res) => {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ error: "Access denied" });
    const { fullName, role, username, password } = req.body;

    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await db.run(
        "INSERT INTO users (username, password, role, fullName) VALUES (?, ?, ?, ?)",
        [username, hashedPassword, role, fullName],
      );

      await logAction(
        req.user,
        "Thêm nhân viên",
        `Đã thêm tài khoản nhân viên: ${username} (${fullName})`,
      );

      res.json({ id: result.lastID });
    } catch (error) {
      res.status(400).json({ error: "Tên đăng nhập đã tồn tại" });
    }
  });

  app.patch("/api/users/:id", authenticate, async (req: any, res) => {
    if (req.user.role !== "ADMIN")
      return res.status(403).json({ error: "Access denied" });
    const { fullName, role, username, password } = req.body;

    try {
      if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run(
          "UPDATE users SET fullName = ?, role = ?, username = ?, password = ? WHERE id = ?",
          [fullName, role, username, hashedPassword, req.params.id],
        );
      } else {
        await db.run(
          "UPDATE users SET fullName = ?, role = ?, username = ? WHERE id = ?",
          [fullName, role, username, req.params.id],
        );
      }
      res.json({ success: true });
    } catch (error) {
      res
        .status(400)
        .json({ error: "Tên đăng nhập đã tồn tại hoặc lỗi dữ liệu" });
    }
  });

  // Warehouses API
  app.get("/api/warehouses", authenticate, async (req, res) => {
    const whs = await db.all("SELECT * FROM warehouses ORDER BY type, name");
    res.json(whs);
  });

  // Sales orders, sales fulfillment and warehouse transfers
  const salesRoles = ["ADMIN", "S_SALES"];
  const loadSalesOrder = async (id: string | number) => {
    const order = await db.get(`
      SELECT so.*, c.name customerName, c.phone customerPhone, c.address customerAddress,
             c.taxCode customerTaxCode, w.name warehouseName,
             creator.fullName creatorName, approver.fullName approverName
      FROM sales_orders so
      JOIN customers c ON c.id = so.customerId
      JOIN warehouses w ON w.id = so.warehouseId
      JOIN users creator ON creator.id = so.createdBy
      LEFT JOIN users approver ON approver.id = so.approvedBy
      WHERE so.id = ?`, [id]);
    if (order) {
      order.details = await db.all(`
        SELECT sod.*, pp.name packagingName, pp.sku, pp.unit, p.name productName
        FROM sales_order_details sod
        JOIN productpackagings pp ON pp.id = sod.packagingId
        JOIN products p ON p.id = pp.productId
        WHERE sod.orderId = ? ORDER BY sod.id`, [id]);
    }
    return order;
  };

  app.get("/api/sales-orders/template", authenticate, async (req: any, res) => {
    if (!salesRoles.includes(req.user.role) && req.user.role !== "W_MANAGER")
      return res.status(403).json({ error: "Bạn không có quyền tải mẫu đơn hàng" });
    const templatePath = path.join(process.cwd(), "donhang_template.xlsx");
    if (!fs.existsSync(templatePath))
      return res.status(404).json({ error: "Không tìm thấy file mẫu đơn hàng" });
    res.sendFile(templatePath);
  });

  app.get("/api/sales-orders", authenticate, async (req: any, res) => {
    if (!salesRoles.includes(req.user.role) && req.user.role !== "W_MANAGER")
      return res.status(403).json({ error: "Bạn không có quyền xem đơn hàng" });
    const rows = await db.all(`SELECT id FROM sales_orders ORDER BY createdAt DESC`);
    res.json(await Promise.all(rows.map((row: any) => loadSalesOrder(row.id))));
  });

  app.post("/api/sales-orders", authenticate, async (req: any, res) => {
    if (!salesRoles.includes(req.user.role))
      return res.status(403).json({ error: "Chỉ bộ phận bán hàng được tạo đơn" });
    const { orderDate, deliveryDate, customerId, warehouseId, note, taxRate = 0, details } = req.body;
    if (!orderDate || !customerId || !warehouseId || !Array.isArray(details) || !details.length)
      return res.status(400).json({ error: "Vui lòng nhập đủ khách hàng, kho và hàng hóa" });
    if (details.some((d: any) => !d.packagingId || Number(d.quantity) <= 0 || Number(d.unitPrice) < 0))
      return res.status(400).json({ error: "Chi tiết hàng hóa không hợp lệ" });
    if (new Set(details.map((d: any) => Number(d.packagingId))).size !== details.length)
      return res.status(400).json({ error: "Một quy cách hàng hóa không được nhập nhiều dòng" });

    const normalized = details.map((d: any) => {
      const quantity = Number(d.quantity);
      const unitPrice = Number(d.unitPrice || 0);
      const discountRate = Math.min(100, Math.max(0, Number(d.discountRate || 0)));
      return { ...d, quantity, unitPrice, discountRate, lineTotal: quantity * unitPrice * (1 - discountRate / 100) };
    });
    const gross = normalized.reduce((sum: number, d: any) => sum + d.quantity * d.unitPrice, 0);
    const subtotal = normalized.reduce((sum: number, d: any) => sum + d.lineTotal, 0);
    const discountAmount = gross - subtotal;
    const taxAmount = subtotal * Math.max(0, Number(taxRate)) / 100;
    const now = new Date().toISOString();
    const code = `DH-${orderDate.replaceAll("-", "")}-${Date.now().toString().slice(-6)}`;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result]: any = await connection.query(
        `INSERT INTO sales_orders (code, orderDate, deliveryDate, customerId, warehouseId, status, note,
          subtotal, discountAmount, taxAmount, totalAmount, createdBy, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, 'DRAFT', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [code, orderDate, deliveryDate || null, customerId, warehouseId, note || "", subtotal,
          discountAmount, taxAmount, subtotal + taxAmount, req.user.id, now, now]);
      for (const d of normalized) {
        await connection.query(
          `INSERT INTO sales_order_details (orderId, packagingId, quantity, unitPrice, discountRate, lineTotal, note)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [result.insertId, d.packagingId, d.quantity, d.unitPrice, d.discountRate, d.lineTotal, d.note || ""]);
      }
      await connection.commit();
      await logAction(req.user, "Tạo đơn hàng", `Đã tạo đơn hàng ${code}`);
      res.status(201).json(await loadSalesOrder(result.insertId));
    } catch (error) {
      await connection.rollback();
      console.error(error);
      res.status(500).json({ error: "Không thể tạo đơn hàng" });
    } finally { connection.release(); }
  });

  app.patch("/api/sales-orders/:id/status", authenticate, async (req: any, res) => {
    if (!salesRoles.includes(req.user.role))
      return res.status(403).json({ error: "Bạn không có quyền duyệt đơn" });
    const order = await loadSalesOrder(req.params.id);
    if (!order) return res.status(404).json({ error: "Không tìm thấy đơn hàng" });
    const { status, reason } = req.body;
    const transitions: Record<string, string[]> = {
      DRAFT: ["PENDING"], REJECTED: ["PENDING"], PENDING: ["APPROVED", "REJECTED"]
    };
    if (!transitions[order.status]?.includes(status))
      return res.status(400).json({ error: `Không thể chuyển từ ${order.status} sang ${status}` });
    if (status === "REJECTED" && !String(reason || "").trim())
      return res.status(400).json({ error: "Vui lòng nhập lý do từ chối" });
    const now = new Date().toISOString();
    await db.run(
      `UPDATE sales_orders SET status = ?, rejectionReason = ?, approvedBy = ?, approvedAt = ?, updatedAt = ? WHERE id = ?`,
      [status, status === "REJECTED" ? reason : null,
        status === "APPROVED" || status === "REJECTED" ? req.user.id : null,
        status === "APPROVED" || status === "REJECTED" ? now : null, now, req.params.id]);
    await logAction(req.user, status === "APPROVED" ? "Duyệt đơn hàng" : status === "REJECTED" ? "Từ chối đơn hàng" : "Gửi duyệt đơn hàng", `${order.code} → ${status}`);
    res.json(await loadSalesOrder(req.params.id));
  });

  app.post("/api/sales-orders/:id/fulfill", authenticate, async (req: any, res) => {
    if (!salesRoles.includes(req.user.role) && req.user.role !== "W_MANAGER")
      return res.status(403).json({ error: "Bạn không có quyền ghi nhận bán hàng" });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [orders]: any = await connection.query("SELECT * FROM sales_orders WHERE id = ? FOR UPDATE", [req.params.id]);
      const order = orders[0];
      if (!order || order.status !== "APPROVED") throw new Error("Đơn hàng chưa được duyệt hoặc đã bán");
      const [details]: any = await connection.query(
        `SELECT packagingId, SUM(quantity) quantity FROM sales_order_details
         WHERE orderId = ? GROUP BY packagingId`, [order.id]);
      for (const d of details) {
        const [stocks]: any = await connection.query(
          "SELECT stock_quantity FROM productwarehouses WHERE warehouseId = ? AND packagingId = ? FOR UPDATE",
          [order.warehouseId, d.packagingId]);
        if (Number(stocks[0]?.stock_quantity || 0) < Number(d.quantity))
          throw new Error(`Không đủ tồn kho cho mã quy cách #${d.packagingId}`);
      }
      const now = new Date().toISOString();
      const txCode = `PXBH-${order.code}-${Date.now().toString().slice(-4)}`;
      const [customers]: any = await connection.query("SELECT name FROM customers WHERE id = ?", [order.customerId]);
      const [txResult]: any = await connection.query(
        `INSERT INTO inventorytransactions (code, type, transaction_date, exit_date, warehouseId, note, recipient,
          customerId, reason, createdBy, createdAt, updatedAt) VALUES (?, 'EXPORT', ?, ?, ?, ?, ?, ?, 'Bán hàng', ?, ?, ?)`,
        [txCode, now.slice(0, 10), now.slice(0, 10), order.warehouseId, `Xuất bán theo ${order.code}`,
          customers[0]?.name || "Khách hàng", order.customerId, req.user.id, now, now]);
      for (const d of details) {
        await connection.query(
          `INSERT INTO inventorytransactiondetails (transactionId, packagingId, quantity, note, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?)`, [txResult.insertId, d.packagingId, d.quantity, order.code, now, now]);
        await connection.query(
          `UPDATE productwarehouses SET stock_quantity = stock_quantity - ?, updatedAt = ?
           WHERE warehouseId = ? AND packagingId = ?`, [d.quantity, now, order.warehouseId, d.packagingId]);
      }
      await connection.query(
        `UPDATE sales_orders SET status = 'FULFILLED', fulfilledAt = ?, inventoryTransactionId = ?,
          dueDate = COALESCE(dueDate, DATE_ADD(?, INTERVAL 30 DAY)), paymentStatus = 'UNPAID', updatedAt = ? WHERE id = ?`,
        [now, txResult.insertId, now.slice(0, 10), now, order.id]);
      await connection.commit();
      await logAction(req.user, "Bán hàng", `Đã xuất bán đơn ${order.code}`);
      res.json(await loadSalesOrder(order.id));
    } catch (error: any) {
      await connection.rollback();
      res.status(400).json({ error: error.message || "Không thể ghi nhận bán hàng" });
    } finally { connection.release(); }
  });

  app.post("/api/sales-orders/:id/payments", authenticate, async (req: any, res) => {
    if (!salesRoles.includes(req.user.role))
      return res.status(403).json({ error: "Bạn không có quyền ghi nhận thanh toán" });
    const { amount, paymentDate, method, note } = req.body;
    const value = Number(amount);
    if (!paymentDate || value <= 0) return res.status(400).json({ error: "Số tiền thanh toán không hợp lệ" });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows]: any = await connection.query("SELECT * FROM sales_orders WHERE id = ? FOR UPDATE", [req.params.id]);
      const order = rows[0];
      if (!order || order.status !== "FULFILLED") throw new Error("Đơn hàng chưa ghi nhận bán");
      const remaining = Number(order.totalAmount) - Number(order.paidAmount || 0);
      if (value > remaining + 0.001) throw new Error("Số tiền thanh toán vượt quá công nợ còn lại");
      const newPaid = Number(order.paidAmount || 0) + value;
      const status = newPaid >= Number(order.totalAmount) - 0.001 ? "PAID" : "PARTIAL";
      const now = new Date().toISOString();
      await connection.query(
        `INSERT INTO customer_payments (customerId, salesOrderId, paymentDate, amount, method, note, createdBy, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [order.customerId, order.id, paymentDate, value, method || "BANK", note || "", req.user.id, now]);
      await connection.query("UPDATE sales_orders SET paidAmount=?, paymentStatus=?, updatedAt=? WHERE id=?",
        [newPaid, status, now, order.id]);
      await connection.commit();
      await logAction(req.user, "Thu tiền khách hàng", `${order.code}: ${value}`);
      res.json(await loadSalesOrder(order.id));
    } catch (error: any) {
      await connection.rollback();
      res.status(400).json({ error: error.message || "Không thể ghi nhận thanh toán" });
    } finally { connection.release(); }
  });

  app.get("/api/dashboard/financial", authenticate, async (_req, res) => {
    try {
      const sales = await db.get(`SELECT COALESCE(SUM(totalAmount),0) revenue,
        COALESCE(SUM(GREATEST(totalAmount-paidAmount,0)),0) receivables
        FROM sales_orders WHERE status='FULFILLED'`);
      const purchases = await db.get(`SELECT COALESCE(SUM(totalAmount),0) expense,
        COALESCE(SUM(GREATEST(totalAmount-paidAmount,0)),0) payables FROM purchase_documents WHERE COALESCE(documentStatus, 'POSTED') = 'POSTED'`);
      const inventory = await db.get(`
        SELECT COALESCE(SUM(pw.stock_quantity * COALESCE(price.lastPrice,0)),0) inventoryValue
        FROM productwarehouses pw LEFT JOIN (
          SELECT pdd.packagingId, pdd.unitPrice lastPrice FROM purchase_document_details pdd
          JOIN (SELECT packagingId, MAX(id) maxId FROM purchase_document_details GROUP BY packagingId) latest
            ON latest.maxId=pdd.id
        ) price ON price.packagingId=pw.packagingId`);
      const monthly = await db.all(`
        SELECT monthKey, SUM(revenue) revenue, SUM(expense) expense FROM (
          SELECT DATE_FORMAT(fulfilledAt,'%Y-%m') monthKey, SUM(totalAmount) revenue, 0 expense
          FROM sales_orders WHERE status='FULFILLED' AND fulfilledAt >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          GROUP BY DATE_FORMAT(fulfilledAt,'%Y-%m')
          UNION ALL
          SELECT DATE_FORMAT(documentDate,'%Y-%m') monthKey, 0 revenue, SUM(totalAmount) expense
          FROM purchase_documents WHERE COALESCE(documentStatus, 'POSTED') = 'POSTED' AND documentDate >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
          GROUP BY DATE_FORMAT(documentDate,'%Y-%m')
        ) data GROUP BY monthKey ORDER BY monthKey`);
      const customerDebts = await db.all(`
        SELECT c.id, c.code, c.name, SUM(so.totalAmount-so.paidAmount) debt
        FROM customers c JOIN sales_orders so ON so.customerId=c.id
        WHERE so.status='FULFILLED' AND so.totalAmount>so.paidAmount
        GROUP BY c.id ORDER BY debt DESC LIMIT 5`);
      const lowStock = await db.all(`
        SELECT itemStock.*
        FROM (
          SELECT pp.id, pp.sku, p.name productName, pp.name packagingName,
            COALESCE(SUM(pw.stock_quantity), 0) stock,
            COALESCE(MAX(pp.min_stock), 0) minStock
          FROM productpackagings pp
          JOIN products p ON p.id = pp.productId
          LEFT JOIN productwarehouses pw ON pw.packagingId = pp.id
          GROUP BY pp.id, pp.sku, p.name, pp.name
        ) itemStock
        WHERE itemStock.stock <= itemStock.minStock
        ORDER BY itemStock.stock ASC
        LIMIT 8`);
      const revenue = Number(sales?.revenue || 0), expense = Number(purchases?.expense || 0);
      res.json({ revenue, expense, profit: revenue-expense, receivables:Number(sales?.receivables||0),
        payables:Number(purchases?.payables||0), inventoryValue:Number(inventory?.inventoryValue||0), monthly, customerDebts, lowStock });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Không thể tổng hợp dữ liệu tài chính" });
    }
  });

  app.get("/api/warehouse-transfers", authenticate, async (_req, res) => {
    const transfers = await db.all(`
      SELECT wt.*, fw.name fromWarehouseName, tw.name toWarehouseName, u.fullName creatorName
      FROM warehouse_transfers wt JOIN warehouses fw ON fw.id = wt.fromWarehouseId
      JOIN warehouses tw ON tw.id = wt.toWarehouseId JOIN users u ON u.id = wt.createdBy
      ORDER BY wt.createdAt DESC`);
    for (const transfer of transfers) {
      transfer.details = await db.all(`
        SELECT wtd.*, pp.name packagingName, pp.sku, pp.unit, p.name productName
        FROM warehouse_transfer_details wtd JOIN productpackagings pp ON pp.id = wtd.packagingId
        JOIN products p ON p.id = pp.productId WHERE wtd.transferId = ?`, [transfer.id]);
    }
    res.json(transfers);
  });

  app.post("/api/warehouse-transfers", authenticate, async (req: any, res) => {
    if (!["ADMIN", "W_MANAGER"].includes(req.user.role))
      return res.status(403).json({ error: "Chỉ thủ kho được chuyển kho" });
    const { transferDate, fromWarehouseId, toWarehouseId, note, details } = req.body;
    if (!transferDate || !fromWarehouseId || !toWarehouseId || Number(fromWarehouseId) === Number(toWarehouseId))
      return res.status(400).json({ error: "Kho nguồn và kho đích phải khác nhau" });
    if (!Array.isArray(details) || !details.length || details.some((d: any) => !d.packagingId || Number(d.quantity) <= 0))
      return res.status(400).json({ error: "Chi tiết chuyển kho không hợp lệ" });
    if (new Set(details.map((d: any) => Number(d.packagingId))).size !== details.length)
      return res.status(400).json({ error: "Một quy cách hàng hóa không được chuyển nhiều dòng" });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      for (const d of details) {
        const [stocks]: any = await connection.query(
          "SELECT stock_quantity FROM productwarehouses WHERE warehouseId = ? AND packagingId = ? FOR UPDATE",
          [fromWarehouseId, d.packagingId]);
        if (Number(stocks[0]?.stock_quantity || 0) < Number(d.quantity))
          throw new Error(`Không đủ tồn kho nguồn cho mã quy cách #${d.packagingId}`);
      }
      const now = new Date().toISOString();
      const code = `CK-${transferDate.replaceAll("-", "")}-${Date.now().toString().slice(-6)}`;
      const makeInventoryTx = async (type: "IMPORT" | "EXPORT", warehouseId: number) => {
        const txCode = `${type === "EXPORT" ? "PX" : "PN"}-${code}`;
        const [result]: any = await connection.query(
          `INSERT INTO inventorytransactions (code, type, transaction_date, entry_date, exit_date, warehouseId,
            note, recipient, reason, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Chuyển kho', ?, ?, ?)`,
          [txCode, type, transferDate, type === "IMPORT" ? transferDate : null,
            type === "EXPORT" ? transferDate : null, warehouseId, `Chuyển kho ${code}: ${note || ""}`,
            type === "EXPORT" ? `Kho #${toWarehouseId}` : `Từ kho #${fromWarehouseId}`, req.user.id, now, now]);
        for (const d of details) await connection.query(
          `INSERT INTO inventorytransactiondetails (transactionId, packagingId, quantity, note, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?)`, [result.insertId, d.packagingId, d.quantity, code, now, now]);
        return result.insertId;
      };
      const exportId = await makeInventoryTx("EXPORT", fromWarehouseId);
      const importId = await makeInventoryTx("IMPORT", toWarehouseId);
      const [transferResult]: any = await connection.query(
        `INSERT INTO warehouse_transfers (code, transferDate, fromWarehouseId, toWarehouseId, status, note,
          exportTransactionId, importTransactionId, createdBy, createdAt) VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?, ?, ?, ?)`,
        [code, transferDate, fromWarehouseId, toWarehouseId, note || "", exportId, importId, req.user.id, now]);
      for (const d of details) {
        await connection.query(
          "INSERT INTO warehouse_transfer_details (transferId, packagingId, quantity, note) VALUES (?, ?, ?, ?)",
          [transferResult.insertId, d.packagingId, d.quantity, d.note || ""]);
        await connection.query(
          "UPDATE productwarehouses SET stock_quantity = stock_quantity - ?, updatedAt = ? WHERE warehouseId = ? AND packagingId = ?",
          [d.quantity, now, fromWarehouseId, d.packagingId]);
        await connection.query(
          `INSERT INTO productwarehouses (packagingId, warehouseId, stock_quantity, updatedAt) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE stock_quantity = stock_quantity + VALUES(stock_quantity), updatedAt = VALUES(updatedAt)`,
          [d.packagingId, toWarehouseId, d.quantity, now]);
      }
      await connection.commit();
      await logAction(req.user, "Chuyển kho", `Đã hoàn tất phiếu ${code}`);
      res.status(201).json({ id: transferResult.insertId, code });
    } catch (error: any) {
      await connection.rollback();
      res.status(400).json({ error: error.message || "Không thể chuyển kho" });
    } finally { connection.release(); }
  });

  // Report API
  app.get("/api/report/stock-detail", authenticate, async (req, res) => {
    // 1. Nhận thêm tham số category từ giao diện
    const { startDate, endDate, category } = req.query;
    const start = startDate
      ? String(startDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          .toISOString()
          .split("T")[0];
    const end = endDate
      ? String(endDate)
      : new Date().toISOString().split("T")[0];

    try {
      // 2. Lọc sản phẩm theo Category (nếu có)
      let sql = "SELECT id, name, sku FROM products";
      const params = [];
      if (category && category !== "ALL") {
        sql += " WHERE category = ?";
        params.push(category);
      }
      const products = await db.all(sql, params);

      const reportData = [];

      for (const p of products) {
        const packagings = await db.all(
          "SELECT id, name, sku, initial_stock FROM productpackagings WHERE productId = ?",
          [p.id],
        );
        const pReport: any = { ...p, packagings: [] };

        for (const pk of packagings) {
          const opening = await db.get(
            `
            SELECT SUM(CASE WHEN it.type = 'IMPORT' THEN itd.quantity ELSE -itd.quantity END) as balance
            FROM inventorytransactiondetails itd
            JOIN inventorytransactions it ON itd.transactionId = it.id
            WHERE itd.packagingId = ? AND it.transaction_date < ?
          `,
            [pk.id, start],
          );

          const imports = await db.get(
            `
            SELECT SUM(itd.quantity) as total
            FROM inventorytransactiondetails itd
            JOIN inventorytransactions it ON itd.transactionId = it.id
            WHERE itd.packagingId = ? AND it.transaction_date BETWEEN ? AND ? AND it.type = 'IMPORT'
          `,
            [pk.id, start, end],
          );

          const exports = await db.get(
            `
            SELECT SUM(itd.quantity) as total
            FROM inventorytransactiondetails itd
            JOIN inventorytransactions it ON itd.transactionId = it.id
            WHERE itd.packagingId = ? AND it.transaction_date BETWEEN ? AND ? AND it.type = 'EXPORT'
          `,
            [pk.id, start, end],
          );

          // Ép kiểu toàn bộ về Number() để tránh lỗi ghép chuỗi của MySQL
          const openingStock =
            Number(pk.initial_stock || 0) + Number(opening?.balance || 0);
          const importQty = Number(imports?.total || 0);
          const exportQty = Number(exports?.total || 0);
          const closingStock = openingStock + importQty - exportQty;

          pReport.packagings.push({
            ...pk,
            openingStock,
            importQty,
            exportQty,
            closingStock,
          });
        }
        reportData.push(pReport);
      }
      res.json(reportData);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Lỗi tính toán báo cáo" });
    }
  });
  // API Lấy danh sách kiểm kê
  app.get("/api/stocktakes", authenticate, async (req, res) => {
    const list = await db.all(
      "SELECT * FROM stocktakes ORDER BY createdAt DESC",
    );
    res.json(list);
  });

  // API Chốt kiểm kê và tự động cân bằng kho
  app.post(
    "/api/stocktakes/:id/complete",
    authenticate,
    async (req: any, res) => {
      if (req.user.role !== "ADMIN")
        return res
          .status(403)
          .json({ error: "Chỉ Admin mới được chốt kiểm kê" });

      const now = new Date().toISOString();
      const details = await db.all(
        "SELECT * FROM stocktake_details WHERE stocktakeId = ?",
        [req.params.id],
      );

      for (const d of details) {
        if (d.difference !== 0) {
          // Tự động sinh phiếu điều chỉnh (phiếu kho ẩn)
          const type = d.difference > 0 ? "IMPORT" : "EXPORT";
          const absQty = Math.abs(d.difference);

          await db.run(
            `INSERT INTO inventorytransactiondetails (transactionId, packagingId, quantity, note) VALUES (?, ?, ?, ?)`,
            [0, d.packagingId, absQty, "Điều chỉnh kiểm kê"],
          );
          // Cập nhật tồn kho thực tế
          await db.run(
            `UPDATE productwarehouses SET stock_quantity = stock_quantity + ? WHERE packagingId = ? AND warehouseId = 1`,
            [d.difference, d.packagingId],
          );
        }
      }
      await db.run("UPDATE stocktakes SET status = 'COMPLETED' WHERE id = ?", [
        req.params.id,
      ]);
      res.json({ success: true });
    },
  );
  // API LƯU PHIẾU KIỂM KÊ
  app.post("/api/stocktakes", authenticate, async (req: any, res) => {
    const { date, details } = req.body;
    const now = new Date().toISOString();
    const result = await db.run(
      "INSERT INTO stocktakes (code, date, createdBy, createdAt) VALUES (?, ?, ?, ?)",
      [`KT-${Date.now()}`, date, req.user.id, now],
    );

    for (const d of details) {
      await db.run(
        "INSERT INTO stocktake_details (stocktakeId, packagingId, expected_qty, actual_qty, difference) VALUES (?, ?, ?, ?, ?)",
        [
          result.lastID,
          d.packagingId,
          d.expected_qty,
          d.actual_qty,
          d.difference,
        ],
      );
    }
    res.json({ id: result.lastID });
  });

  // API CÂN BẰNG KHO (Đã code ở gợi ý trước)
  app.post(
    "/api/stocktakes/:id/complete",
    authenticate,
    async (req: any, res) => {
      if (req.user.role !== "ADMIN")
        return res.status(403).json({ error: "Chỉ Admin mới được chốt" });
      const details = await db.all(
        "SELECT * FROM stocktake_details WHERE stocktakeId = ?",
        [req.params.id],
      );
      const now = new Date().toISOString();

      for (const d of details) {
        if (d.difference !== 0) {
          await db.run(
            `INSERT INTO inventorytransactiondetails (transactionId, packagingId, quantity, note) VALUES (?, ?, ?, ?)`,
            [0, d.packagingId, d.difference, "Kiểm kê tháng"],
          );
          await db.run(
            `UPDATE productwarehouses SET stock_quantity = stock_quantity + ? WHERE packagingId = ? AND warehouseId = 1`,
            [d.difference, d.packagingId],
          );
        }
      }
      await db.run("UPDATE stocktakes SET status = 'COMPLETED' WHERE id = ?", [
        req.params.id,
      ]);
      res.json({ success: true });
    },
  );

app.get("/api/export-report", authenticate, async (req: any, res: any) => {
  const month = req.query.month as string;
  if (!month) return res.status(400).json({ error: "Vui lòng chọn tháng" });

  try {
    const workbook = new ExcelJS.Workbook();

    // --- 1. CẤU HÌNH TRANG TRÍ ---
    const fontName = "Segoe UI";
    const borderThin = {
      top: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
      left: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
      bottom: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
      right: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
    };
    const headerFill = {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: "FF3C50E0" },
    };
    const titleBannerFill = {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: "FF1E3A8A" },
    };
    const zebraFill = {
      type: "pattern" as const,
      pattern: "solid" as const,
      fgColor: { argb: "FFF8FAFC" },
    };

    // --- 2. TRUY VẤN DỮ LIỆU SẢN XUẤT AN TOÀN ---
    const orders = await db.all(
      `SELECT po.*, p.name as productName
       FROM productionorders po
       LEFT JOIN products p ON po.productId = p.id
       WHERE po.status = 'COMPLETED' AND (po.order_date LIKE ? OR po.mfg_date LIKE ?)`,
      [`${month}%`, `${month}%`],
    );

    let totalPowder = 0,
      totalQty = 0,
      totalSachets = 0,
      sumLossPercent = 0;
    const processedOrders = [];

    for (const o of orders) {
      const details = await db.all(
        `SELECT pd.*, pp.name as packagingName, pp.packCount, pp.sku, p.name as altProductName
         FROM productiondetails pd
         JOIN productpackagings pp ON pd.packagingId = pp.id
         LEFT JOIN products p ON pp.productId = p.id
         WHERE pd.orderId = ?`,
        [o.id],
      );

      let orderQty = 0,
        orderSachets = 0;
      details.forEach((d: any) => {
        orderQty += d.actual_quantity || 0;
        orderSachets += (d.actual_quantity || 0) * (d.packCount || 1);
      });

      totalPowder += o.total_powder_kg || 0;
      totalQty += orderQty;
      totalSachets += orderSachets;
      sumLossPercent += o.loss_percent || 0;

      processedOrders.push({ o, orderQty, orderSachets, details });
    }
    const avgLossPercent =
      orders.length > 0 ? sumLossPercent / orders.length / 100 : 0;

    // NHÓM HÀM VẼ HEADER CÔNG TY CHO CÁC SHEET (Tạm tắt logo để chống lỗi Drawing)
    const applyCompanyHeader = (ws: any) => {
      ws.getCell("A1").value = "CÔNG TY TNHH SX-TM-DV CHALLENGE";
      ws.getCell("A1").font = {
        name: fontName,
        size: 11,
        bold: true,
        color: { argb: "FF1E293B" },
      };
      ws.getCell("A2").value =
        "Trụ sở chính: 159 Hùng Vương, phường Đạo Thạnh, tỉnh Đồng Tháp";
      ws.getCell("A2").font = {
        name: fontName,
        size: 9,
        italic: true,
        color: { argb: "FF64748B" },
      };
      ws.getCell("A3").value =
        "Nhà máy: 260 Nguyễn Quân, phường Đạo Thạnh, tỉnh Đồng Tháp";
      ws.getCell("A3").font = {
        name: fontName,
        size: 9,
        italic: true,
        color: { argb: "FF64748B" },
      };
    };

    // ==========================================
    // SHEET 1: TỔNG QUAN DASHBOARD
    // ==========================================
    const ws1 = workbook.addWorksheet("Tổng Quan");
    ws1.views = [{ showGridLines: true }];
    applyCompanyHeader(ws1);

    ws1.mergeCells("A5:D5");
    const titleCell1 = ws1.getCell("A5");
    titleCell1.value = `BÁO CÁO TỔNG HỢP SẢN XUẤT THÁNG ${month.split("-")[1]}/${month.split("-")[0]}`;
    titleCell1.font = {
      name: fontName,
      size: 14,
      bold: true,
      color: { argb: "FF1E3A8A" },
    };
    titleCell1.alignment = { vertical: "middle", horizontal: "left" };
    ws1.getRow(5).height = 25;

    const kpiData = [
      ["Tổng Bột Tiêu Hao", totalPowder || 0, "#,##0.00", "kg"],
      ["Tổng Sản Lượng Đóng Gói", totalQty || 0, "#,##0", "Hộp/Túi"],
      ["Tổng Số Gói Quy Đổi", totalSachets || 0, "#,##0", "Gói"],
      ["Hao Hụt Bình Quân", avgLossPercent || 0, "0.00%", ""],
    ];

    kpiData.forEach((kpi, idx) => {
      const rowNum = 7 + idx;
      ws1.getCell(`A${rowNum}`).value = kpi[0];
      ws1.getCell(`A${rowNum}`).font = {
        name: fontName,
        bold: true,
        color: { argb: "FF334155" },
      };

      const valCell = ws1.getCell(`B${rowNum}`);
      valCell.value = kpi[1];
      valCell.font = {
        name: fontName,
        bold: true,
        color: { argb: "FF3C50E0" },
        size: 11,
      };
      valCell.numFmt = kpi[2] as string;
      valCell.alignment = { horizontal: "right" };

      ws1.getCell(`C${rowNum}`).value = kpi[3];
      ws1.getCell(`C${rowNum}`).font = {
        name: fontName,
        size: 10,
        italic: true,
        color: { argb: "FF64748B" },
      };
      ws1.getRow(rowNum).height = 22;
    });
    ws1.columns = [{ width: 26 }, { width: 16 }, { width: 12 }, { width: 15 }];

    // ==========================================
    // SHEET 2: CHI TIẾT SẢN XUẤT
    // ==========================================
    const ws2 = workbook.addWorksheet("Chi Tiết Sản Xuất");
    ws2.views = [{ showGridLines: true }];
    applyCompanyHeader(ws2);

    ws2.mergeCells("A5:I5");
    const titleCell2 = ws2.getCell("A5");
    titleCell2.value = "CHI TIẾT CÁC LỆNH SẢN XUẤT ĐÃ HOÀN THÀNH (COMPLETED)";
    titleCell2.font = {
      name: fontName,
      size: 12,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    titleCell2.fill = titleBannerFill;
    titleCell2.alignment = {
      vertical: "middle",
      horizontal: "left",
      indent: 1,
    };
    ws2.getRow(5).height = 30;

    const headers2 = [
      "STT",
      "Mã Lệnh",
      "Số Lô",
      "Thành Phẩm",
      "Số Lượng",
      "Quy Cách",
      "Quy Đổi",
      "Bột (kg)",
      "Hao Hụt",
    ];
    const headerRow2 = ws2.addRow([]);
    headerRow2.values = headers2;
    ws2.getRow(7).height = 26;
    ws2.getRow(7).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = {
        name: fontName,
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 10,
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
      cell.border = borderThin;
    });

    ws2.columns = [
      { width: 5 },
      { width: 18 },
      { width: 15 },
      { width: 38 },
      { width: 15 },
      { width: 12 },
      { width: 16 },
      { width: 16 },
      { width: 12 },
    ];

    const dataStartRow2 = 8;
    if (processedOrders.length === 0) {
      const emptyRow = ws2.addRow([
        "",
        "Không có lệnh sản xuất hoàn thành nào trong kỳ báo cáo này",
      ]);
      emptyRow.getCell(2).font = {
        name: fontName,
        italic: true,
        color: { argb: "FFEF4444" },
      };
    } else {
      processedOrders.forEach((item, idx) => {
        item.details.forEach((d: any, dIdx: number) => {
          const row = ws2.addRow([
            dIdx === 0 ? idx + 1 : "",
            dIdx === 0 ? item.o.code : "",
            dIdx === 0 ? item.o.batch_number : "",
            `${item.o.productName || d.altProductName || "Sản phẩm"} (${d.packagingName || "Không rõ"})`,
            d.actual_quantity || 0,
            d.packCount || 1,
            (d.actual_quantity || 0) * (d.packCount || 1),
            dIdx === 0 ? item.o.total_powder_kg || 0 : 0,
            dIdx === 0 ? (item.o.loss_percent || 0) / 100 : 0,
          ]);

          row.height = 22;
          row.eachCell((cell, colIdx) => {
            cell.font = { name: fontName, size: 10 };
            cell.border = borderThin;
            if (idx % 2 !== 0) cell.fill = zebraFill;

            if ([1, 2, 3, 6, 9].includes(colIdx))
              cell.alignment = { horizontal: "center", vertical: "middle" };
            if (colIdx === 4)
              cell.alignment = { horizontal: "left", vertical: "middle" };
            if ([5, 7, 8].includes(colIdx)) {
              cell.alignment = { horizontal: "right", vertical: "middle" };
              if (colIdx === 5 || colIdx === 7) cell.numFmt = "#,##0";
              if (colIdx === 8) cell.numFmt = "#,##0.00";
            }
            if (colIdx === 9) cell.numFmt = "0.00%";
          });
        });
      });

      const lastDataRow2 = ws2.rowCount;
      const totalRow2 = ws2.addRow([]);
      totalRow2.height = 24;
      totalRow2.getCell(3).value = "TỔNG CỘNG";
      totalRow2.getCell(5).value = {
        formula: `SUM(E${dataStartRow2}:E${lastDataRow2})`,
      };
      totalRow2.getCell(7).value = {
        formula: `SUM(G${dataStartRow2}:G${lastDataRow2})`,
      };
      totalRow2.getCell(8).value = {
        formula: `SUM(H${dataStartRow2}:H${lastDataRow2})`,
      };

      totalRow2.eachCell((cell, colIdx) => {
        cell.font = { name: fontName, bold: true, size: 10 };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFE0E7FF" },
        };
        cell.border = {
          top: { style: "thin" },
          bottom: { style: "double", color: { argb: "FF1E3A8A" } },
        };
        if ([5, 7, 8].includes(colIdx)) {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.numFmt = colIdx === 8 ? "#,##0.00" : "#,##0";
        }
      });
    }

    // ==========================================
    // SHEET 3: XUẤT NHẬP TỒN VẬT TƯ & BAO BÌ
    // ==========================================
    const ws3 = workbook.addWorksheet("XNT Vật Tư");
    ws3.views = [{ showGridLines: true }];
    applyCompanyHeader(ws3);

    ws3.mergeCells("A5:I5");
    const titleCell3 = ws3.getCell("A5");
    titleCell3.value = "BÁO CÁO XUẤT NHẬP TỒN KHO BAO BÌ VẬT TƯ CHUYÊN SÂU";
    titleCell3.font = {
      name: fontName,
      size: 12,
      bold: true,
      color: { argb: "FFFFFFFF" },
    };
    titleCell3.fill = titleBannerFill;
    titleCell3.alignment = {
      vertical: "middle",
      horizontal: "left",
      indent: 1,
    };
    ws3.getRow(5).height = 30;

    const headers3 = [
      "Mã SKU",
      "Tên Vật Tư / Bao Bì",
      "Quy Cách",
      "Tồn Đầu",
      "Nhập",
      "Xuất",
      "Tồn Sổ Sách",
      "Thực Tế",
      "Lệch",
    ];
    const headerRow3 = ws3.addRow([]);
    headerRow3.values = headers3;
    ws3.getRow(7).height = 26;
    ws3.getRow(7).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = {
        name: fontName,
        bold: true,
        color: { argb: "FFFFFFFF" },
        size: 10,
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = borderThin;
    });

    ws3.columns = [
      { width: 15 },
      { width: 38 },
      { width: 15 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 14 },
      { width: 14 },
      { width: 12 },
    ];

    const packagings = await db.all(
      "SELECT pp.*, p.name as productName FROM productpackagings pp LEFT JOIN products p ON pp.productId = p.id",
    );

    const dataStartRow3 = 8;
    packagings.forEach((pk: any, idx: number) => {
      const rIdx = dataStartRow3 + idx;

      // BẢO VỆ DỮ LIỆU: Ép kiểu số học, chống NaN
      const currentStock = Number(pk.stock) || 0;
      const packName = pk.name || "Bao bì";
      const prodName = pk.productName || "Vật tư";

      ws3.addRow([
        pk.sku || `SKU-00${pk.id}`,
        `${prodName} - ${packName}`,
        `1 Hộp = ${pk.packCount || 1}gói`,
        currentStock, // Đầu kỳ
        0, // Nhập
        0, // Xuất
        { formula: `D${rIdx}+E${rIdx}-F${rIdx}` },
        currentStock, // Tồn Thực tế
        { formula: `H${rIdx}-G${rIdx}` },
      ]);

      const row = ws3.getRow(rIdx);
      row.height = 22;
      row.eachCell((cell, colIdx) => {
        cell.font = { name: fontName, size: 10 };
        cell.border = borderThin;
        if (idx % 2 !== 0) cell.fill = zebraFill;
        if ([1, 3].includes(colIdx))
          cell.alignment = { horizontal: "center", vertical: "middle" };
        if (colIdx === 2)
          cell.alignment = { horizontal: "left", vertical: "middle" };
        if (colIdx >= 4) {
          cell.alignment = { horizontal: "right", vertical: "middle" };
          cell.numFmt = "#,##0";
        }
      });
    });

    // --- TRẢ FILE VỀ TRÌNH DUYỆT ---
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=Bao_Cao_Tong_Hop_${month}.xlsx`,
    );
    await workbook.xlsx.write(res);
    res.end();
  } catch (err: any) {
    console.error("LỖI HỆ THỐNG KHI TẠO EXCEL:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get(
  "/api/export-production-report",
  authenticate,
  async (req: any, res: any) => {
    const month = req.query.month as string;
    if (!month)
      return res
        .status(400)
        .json({ error: "Vui lòng chọn tháng xuất báo cáo" });

    try {
      const workbook = new ExcelJS.Workbook();
      const fontName = "Segoe UI";
      const borderThin = {
        top: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
        left: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
        right: { style: "thin" as const, color: { argb: "FFCBD5E1" } },
      };
      const headerFill = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "FF3C50E0" },
      };
      const titleBannerFill = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "FF1E3A8A" },
      };
      const zebraFill = {
        type: "pattern" as const,
        pattern: "solid" as const,
        fgColor: { argb: "FFF8FAFC" },
      };

      const ws = workbook.addWorksheet("Báo Cáo Lệnh Sản Xuất");
      ws.views = [{ showGridLines: true }];

      // Thêu thông tin hành chính công ty lên đầu sheet
      ws.getCell("A1").value = "CÔNG TY TNHH SX-TM-DV CHALLENGE";
      ws.getCell("A1").font = {
        name: fontName,
        size: 11,
        bold: true,
        color: { argb: "FF1E293B" },
      };
      ws.getCell("A2").value =
        "Trụ sở chính: 159 Hùng Vương, phường Đạo Thạnh, tỉnh Đồng Tháp";
      ws.getCell("A2").font = {
        name: fontName,
        size: 9,
        italic: true,
        color: { argb: "FF64748B" },
      };
      ws.getCell("A3").value =
        "Nhà máy: 260 Nguyễn Quân, phường Đạo Thạnh, tỉnh Đồng Tháp";
      ws.getCell("A3").font = {
        name: fontName,
        size: 9,
        italic: true,
        color: { argb: "FF64748B" },
      };

      // Banner Tiêu đề chính (Merge từ cột A đến L rộng rãi)
      ws.mergeCells("A5:L5");
      const titleCell = ws.getCell("A5");
      titleCell.value = `THỐNG KÊ CHI TIẾT CÁC LỆNH SẢN XUẤT - THÁNG ${month.split("-")[1]}/${month.split("-")[0]}`;
      titleCell.font = {
        name: fontName,
        size: 12,
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      titleCell.fill = titleBannerFill;
      titleCell.alignment = {
        vertical: "middle",
        horizontal: "center",
        indent: 1,
      };
      ws.getRow(5).height = 30;

      // --- THIẾT LẬP CÁC TIÊU ĐỀ THEO ĐÚNG YÊU CẦU ---
      const headers = [
        "STT",
        "Mã Lệnh",
        "Số Lô",
        "Bột Dùng (kg)",
        "Ngày tạo lệnh",
        "Ngày SX",
        "Hạn SD",
        "Thành Phẩm / Quy Cách",
        "SL theo LSX",
        "SL Đóng gói",
        "Quy Đổi (Gói)",
        "Hao Hụt",
      ];
      const headerRow = ws.addRow([]);
      headerRow.values = headers;
      ws.getRow(6).height = 26;
      headerRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = {
          name: fontName,
          bold: true,
          color: { argb: "FFFFFFFF" },
          size: 10,
        };
        cell.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        cell.border = borderThin;
      });

      ws.columns = [
        { width: 5 },
        { width: 16 },
        { width: 14 },
        { width: 13 },
        { width: 13 },
        { width: 13 },
        { width: 13 },
        { width: 38 },
        { width: 15 },
        { width: 15 },
        { width: 15 },
        { width: 10 },
      ];

      const orders = await db.all(
        `SELECT po.*, p.name as productName
       FROM productionorders po
       LEFT JOIN products p ON po.productId = p.id
       WHERE po.order_date LIKE ? OR po.mfg_date LIKE ?
       ORDER BY po.code DESC`,
        [`${month}%`, `${month}%`],
      );

      const dataStartRow = 7;
      let displayedIdx = 0; // Bộ đếm số thứ tự liên tục sau khi lọc dòng 0

      for (let i = 0; i < orders.length; i++) {
        const o = orders[i];
        const details = await db.all(
          `SELECT pd.*, pp.name as packagingName, pp.packCount
         FROM productiondetails pd
         JOIN productpackagings pp ON pd.packagingId = pp.id
         WHERE pd.orderId = ?`,
          [o.id],
        );

        const orderDateStr = o.order_date
          ? new Date(o.order_date).toLocaleDateString("vi-VN")
          : "-";
        const mfgDateStr = o.mfg_date
          ? new Date(o.mfg_date).toLocaleDateString("vi-VN")
          : "-";
        const expDateStr = o.exp_date
          ? new Date(o.exp_date).toLocaleDateString("vi-VN")
          : "-";
        const targetSachets = Number(o.target_sachets) || 0;

        if (details.length === 0) {
          if (targetSachets === 0 || o.status !== "COMPLETED") continue;

       displayedIdx++;
       const row = ws.addRow([
         displayedIdx, // 1. STT
         o.code, // 2. Mã Lệnh
         o.batch_number || "-", // 3. Số Lô
         Number(o.total_powder_kg) || 0, // 4. Bột dùng (kg)
         orderDateStr, // 5. Ngày tạo lệnh
         mfgDateStr, // 6. Ngày SX
         expDateStr, // 7. Hạn SD
         o.productName || "Sản phẩm gốc", // 8. Thành phẩm
         targetSachets, // 9. SL theo LSX (Lấy từ target_sachets)
         targetSachets, // 10. SL Đóng gói
         targetSachets, // 11. Quy đổi gói
         (Number(o.loss_percent) || 0) / 100, // 12. Hao hụt
       ]);
       formatDataRow(row, displayedIdx, fontName, borderThin, zebraFill);
        } else {
          // KIỂM TRA KHỐI CHI TIẾT ĐÓNG GÓI: Lọc bỏ các dòng quy cách có số lượng đóng gói bằng 0
          const validDetails = details.filter(
            (d: any) => (Number(d.actual_quantity) || 0) > 0,
          );

          // Nếu toàn bộ lệnh sản xuất này không đóng gói được hộp nào (>0), bỏ qua cả lệnh
          if (validDetails.length === 0 || o.status !== "COMPLETED") continue;

          displayedIdx++;
          validDetails.forEach((d: any, dIdx: number) => {
            const planQty = Number(d.target_sachets) || 0;
            const actualQty = Number(d.actual_quantity) || 0;
            const packCount = Number(d.packCount) || 1;

           const row = ws.addRow([
             dIdx === 0 ? displayedIdx : "", // 1. STT
             dIdx === 0 ? o.code : "", // 2. Mã lệnh
             dIdx === 0 ? o.batch_number || "-" : "", // 3. Số lô
             dIdx === 0 ? Number(o.total_powder_kg) || 0 : 0, // 4. Bột dùng (kg)
             dIdx === 0 ? orderDateStr : "", // 5. Ngày tạo lệnh
             dIdx === 0 ? mfgDateStr : "", // 6. Ngày SX
             dIdx === 0 ? expDateStr : "", // 7. Hạn SD
             `${o.productName || "Sản phẩm"} (${d.packagingName || ""})`, // 8. Thành phẩm
             dIdx === 0 ? targetSachets : "", // 9. SL theo LSX (Chỉ in ở dòng đầu tiên của lệnh để chống cộng lặp)
             actualQty, // 10. SL Đóng gói
             actualQty * packCount, // 11. Quy đổi gói
             dIdx === 0 ? (Number(o.loss_percent) || 0) / 100 : 0, // 12. Hao hụt
           ]);
            formatDataRow(row, displayedIdx, fontName, borderThin, zebraFill);
          });
        }
      }

      const lastDataRow = ws.rowCount;

      // Nếu có ít nhất 1 dòng dữ liệu hợp lệ phát sinh sản lượng
      if (displayedIdx > 0) {
        const totalRow = ws.addRow([]);
        totalRow.height = 24;
        const rowNum = totalRow.number;

        ws.mergeCells(`A${rowNum}:H${rowNum}`);
        const labelCell = ws.getCell(`A${rowNum}`);
        labelCell.value = "TỔNG CỘNG SẢN LƯỢNG THỰC TẾ TRONG KỲ";

        ws.getCell(`I${rowNum}`).value = {
          formula: `SUM(I${dataStartRow}:I${lastDataRow})`,
        }; // SL theo LSX
        ws.getCell(`J${rowNum}`).value = {
          formula: `SUM(J${dataStartRow}:J${lastDataRow})`,
        }; // SL Đóng gói
        ws.getCell(`K${rowNum}`).value = {
          formula: `SUM(K${dataStartRow}:K${lastDataRow})`,
        }; // Quy đổi
        ws.getCell(`L${rowNum}`).value = {
          formula: `SUM(L${dataStartRow}:L${lastDataRow})`,
        }; // Hao hụt

        totalRow.eachCell({ includeEmpty: true }, (cell, colIdx) => {
          // Chỉ format từ cột 1 đến 12
          if (colIdx <= 12) {
            cell.font = { name: fontName, bold: true, size: 10 };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFE0E7FF" },
            };
            cell.border = {
              top: { style: "thin" },
              bottom: { style: "thin", color: { argb: "FF1E3A8A" } },
            };

            // Ô số 1 (ô đã gộp 1->8) -> Căn phải
            if (colIdx === 1) {
              cell.alignment = { horizontal: "right", vertical: "middle" };
            }

            // Các cột số liệu (9, 10, 11) -> Căn phải và format số chia ngàn
            if ([9, 10, 11].includes(colIdx)) {
              cell.alignment = { horizontal: "right", vertical: "middle" };
              cell.numFmt = "#,##0";
            }
            if ([12].includes(colIdx)) {
              cell.alignment = { horizontal: "right", vertical: "middle" };
              cell.numFmt = "0%";
            }
          }
        });
      } else {
        const emptyRow = ws.addRow([
          "",
          "Tháng này không phát sinh bất kỳ sản lượng thực tế nào (> 0)",
        ]);
        emptyRow.getCell(2).font = {
          name: fontName,
          italic: true,
          color: { argb: "FFEF4444" },
        };
      }

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Bao_Cao_Lenh_San_Xuat_${month}.xlsx`,
      );
      await workbook.xlsx.write(res);
      res.end();
    } catch (err: any) {
      console.error("LỖI XUẤT FILE LỆNH SẢN XUẤT:", err);
      res.status(500).json({ error: err.message });
    }
  },
);

app.get("/api/export-production-report", authenticate, async (req: any, res: any) => {
  const month = req.query.month as string;
  if (!month) return res.status(400).json({ error: "Vui lòng chọn tháng xuất báo cáo" });

  try {
    const workbook = new ExcelJS.Workbook();
    const fontName = 'Segoe UI';
    const borderThin = {
      top: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin' as const, color: { argb: 'FFCBD5E1' } }
    };
    const headerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF3C50E0' } };
    const titleBannerFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1E3A8A' } };
    const zebraFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFF8FAFC' } };

    const ws = workbook.addWorksheet('Báo Cáo Lệnh Sản Xuất');
    ws.views = [{ showGridLines: true }];

    // Thông tin công ty
    ws.getCell('A1').value = 'CÔNG TY TNHH SX-TM-DV CHALLENGE';
    ws.getCell('A1').font = { name: fontName, size: 11, bold: true, color: { argb: 'FF1E293B' } };
    ws.getCell('A2').value = 'Trụ sở chính: 159 Hùng Vương, phường Đạo Thạnh, tỉnh Đồng Tháp';
    ws.getCell('A2').font = { name: fontName, size: 9, italic: true, color: { argb: 'FF64748B' } };
    ws.getCell('A3').value = 'Nhà máy: 260 Nguyễn Quân, phường Đạo Thạnh, tỉnh Đồng Tháp';
    ws.getCell('A3').font = { name: fontName, size: 9, italic: true, color: { argb: 'FF64748B' } };

    // Banner Tiêu đề chính (Merge từ cột A đến L - Tương ứng 12 cột)
    ws.mergeCells('A5:L5');
    const titleCell = ws.getCell('A5');
    titleCell.value = `THỐNG KÊ CHI TIẾT CÁC LỆNH SẢN XUẤT - THÁNG ${month.split('-')[1]}/${month.split('-')[0]}`;
    titleCell.font = { name: fontName, size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = titleBannerFill;
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    ws.getRow(5).height = 30;

    // --- CẬP NHẬT HEADER THEO ĐÚNG THỨ TỰ YÊU CẦU ---
 const headers = [
      "STT", "Mã Lệnh", "Số Lô", "Bột Dùng (kg)", "Ngày tạo lệnh",
      "Ngày SX", "Hạn SD", "Thành Phẩm / Quy Cách", "SL theo LSX",
      "SL Đóng gói", "Quy Đổi (Gói)", "Hao Hụt"
    ];

    const headerRow = ws.addRow([]);
    headerRow.values = headers;
    ws.getRow(6).height = 26;
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = { name: fontName, bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = borderThin;
    });

    // Căn chỉnh độ rộng theo thứ tự cột mới
    ws.columns = [
      { width: 5 },  // 1: STT
      { width: 16 }, // 2: Mã Lệnh
      { width: 14 }, // 3: Số Lô
      { width: 15 }, // 4: Bột Dùng
      { width: 13 }, // 5: Ngày tạo
      { width: 13 }, // 6: Ngày SX
      { width: 13 }, // 7: Hạn SD
      { width: 38 }, // 8: Thành Phẩm
      { width: 14 }, // 9: SL theo LSX
      { width: 14 }, // 10: SL Đóng gói
      { width: 15 }, // 11: Quy Đổi
      { width: 10 }  // 12: Hao Hụt
    ];

    const orders = await db.all(
      `SELECT po.*, p.name as productName
       FROM productionorders po
       LEFT JOIN products p ON po.productId = p.id
       WHERE po.order_date LIKE ? OR po.mfg_date LIKE ?
       ORDER BY po.code DESC`,
      [`${month}%`, `${month}%`]
    );

    const dataStartRow = 7;
    let displayedIdx = 0; // Số thứ tự liên tục

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      const details = await db.all(
        `SELECT pd.*, pp.name as packagingName, pp.packCount
         FROM productiondetails pd
         JOIN productpackagings pp ON pd.packagingId = pp.id
         WHERE pd.orderId = ?`,
        [o.id]
      );

      // Xử lý các định dạng ngày tháng
      const orderDateStr = o.order_date ? new Date(o.order_date).toLocaleDateString('vi-VN') : "-";
      const mfgDateStr = o.mfg_date ? new Date(o.mfg_date).toLocaleDateString('vi-VN') : "-";
      const expDateStr = o.exp_date ? new Date(o.exp_date).toLocaleDateString('vi-VN') : "-";

      if (details.length === 0) {
        const targetQty = Number(o.target_sachets || o.total_sachets || 0);

        // Bỏ qua nếu SL = 0 hoặc chưa hoàn thành
        if (targetQty === 0 || o.status !== 'COMPLETED') continue;

        displayedIdx++;
        const row = ws.addRow([
          displayedIdx,                                         // 1. STT
          o.code,                                               // 2. Mã Lệnh
          o.batch_number || "-",                                // 3. Số Lô
          Number(o.total_powder_kg) || 0,                       // 4. Bột dùng (kg)
          orderDateStr,                                         // 5. Ngày tạo lệnh
          mfgDateStr,                                           // 6. Ngày SX
          expDateStr,                                           // 7. Hạn SD
          o.productName || "Sản phẩm gốc",                      // 8. Thành phẩm
          targetQty,                                            // 9. SL theo LSX
          targetQty,                                            // 10. SL Đóng gói
          targetQty,                                            // 11. Quy đổi gói
          (Number(o.loss_percent) || 0) / 100                   // 12. Hao hụt
        ]);
        formatDataRow(row, displayedIdx, fontName, borderThin, zebraFill);
      } else {
        const validDetails = details.filter((d: any) => (Number(d.actual_quantity) || 0) > 0);
        if (validDetails.length === 0 || o.status !== 'COMPLETED') continue;

        displayedIdx++;
        validDetails.forEach((d: any, dIdx: number) => {
          const planQty = Number(d.quantity) || 0;
          const actualQty = Number(d.actual_quantity) || 0;
          const packCount = Number(d.packCount) || 1;

          const row = ws.addRow([
            dIdx === 0 ? displayedIdx : "",                      // 1. STT
            dIdx === 0 ? o.code : "",                            // 2. Mã lệnh
            dIdx === 0 ? (o.batch_number || "-") : "",           // 3. Số lô
            dIdx === 0 ? (Number(o.total_powder_kg) || 0) : 0,   // 4. Bột dùng (kg)
            dIdx === 0 ? orderDateStr : "",                      // 5. Ngày tạo lệnh
            dIdx === 0 ? mfgDateStr : "",                        // 6. Ngày SX
            dIdx === 0 ? expDateStr : "",                        // 7. Hạn SD
            `${o.productName || "Sản phẩm"} (${d.packagingName || ""})`, // 8. Thành phẩm
            planQty,                                             // 9. SL theo LSX
            actualQty,                                           // 10. SL Đóng gói
            actualQty * packCount,                               // 11. Quy đổi gói
            dIdx === 0 ? ((Number(o.loss_percent) || 0) / 100) : 0 // 12. Hao hụt
          ]);
          formatDataRow(row, displayedIdx, fontName, borderThin, zebraFill);
        });
      }
    }

    const lastDataRow = ws.rowCount;

    // TẠO DÒNG TỔNG CỘNG NẾU CÓ DỮ LIỆU
    if (displayedIdx > 0) {
      const totalRow = ws.addRow([]);
      totalRow.height = 24;
      totalRow.getCell(8).value = "TỔNG CỘNG SẢN LƯỢNG THỰC TẾ TRONG KỲ"; // Đặt nhãn tổng ở cột 8 (Thành phẩm)

      // Áp dụng tính tổng theo vị trí cột mới
      totalRow.getCell(4).value = { formula: `SUM(D${dataStartRow}:D${lastDataRow})` };  // Bột dùng
      totalRow.getCell(9).value = { formula: `SUM(I${dataStartRow}:I${lastDataRow})` };  // SL theo LSX
      totalRow.getCell(10).value = { formula: `SUM(J${dataStartRow}:J${lastDataRow})` }; // SL Đóng gói
      totalRow.getCell(11).value = { formula: `SUM(K${dataStartRow}:K${lastDataRow})` }; // Quy đổi

      totalRow.eachCell((cell, colIdx) => {
        cell.font = { name: fontName, bold: true, size: 10 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } };
        cell.border = { top: { style: 'thin' }, bottom: { style: 'double', color: { argb: 'FF1E3A8A' } } };

        // Căn phải và format số cho các cột tính tổng
        if ([4, 9, 10, 11].includes(colIdx)) {
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
          cell.numFmt = colIdx === 4 ? '#,##0.00' : '#,##0';
        }
      });
    } else {
      const emptyRow = ws.addRow(["", "Tháng này không phát sinh bất kỳ sản lượng thực tế nào (> 0)"]);
      emptyRow.getCell(2).font = { name: fontName, italic: true, color: { argb: 'FFEF4444' } };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Bao_Cao_Lenh_San_Xuat_${month}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();

  } catch (err: any) {
    console.error("LỖI XUẤT FILE LỆNH SẢN XUẤT:", err);
    res.status(500).json({ error: err.message });
  }
});

// Hàm hỗ trợ format dòng với vị trí index mới
function formatDataRow(row: any, idx: number, fontName: string, borderThin: any, zebraFill: any) {
  row.eachCell((cell: any, colIdx: number) => {
    cell.font = { name: fontName, size: 10 };
    cell.border = borderThin;
    if (idx % 2 !== 0) cell.fill = zebraFill;

    // Cột 1,2,3,5,6,7,12 căn giữa
    if ([1, 2, 3, 5, 6, 7, 12].includes(colIdx)) cell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Cột 8 (Thành Phẩm) căn trái
    if (colIdx === 8) cell.alignment = { horizontal: 'left', vertical: 'middle' };

    // Cột 4 (Bột dùng), 9,10,11 (Số lượng) căn phải
    if ([4, 9, 10, 11].includes(colIdx)) {
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
      if (colIdx === 4) cell.numFmt = '#,##0.00'; // Bột hiển thị 2 số thập phân
      else cell.numFmt = '#,##0';                 // Số lượng hiển thị chia ngàn
    }

    // Cột 12 (Hao hụt) định dạng phần trăm
    if (colIdx === 12) cell.numFmt = '0.00%';
  });
}


// API Lấy lịch sử xuất nhập (Thẻ kho) của 1 mặt hàng cụ thể
  app.get("/api/report/packaging-history/:id", authenticate, async (req: any, res) => {
    const { startDate, endDate } = req.query;
    try {
      const history = await db.all(
        `SELECT
           it.code,
           it.type,
           it.transaction_date,
           it.recipient,
           c.name as customerName,
           itd.quantity,
           itd.note,
           u.fullName as creatorName
         FROM inventorytransactiondetails itd
         JOIN inventorytransactions it ON itd.transactionId = it.id
         LEFT JOIN customers c ON it.customerId = c.id
         LEFT JOIN users u ON it.createdBy = u.id
         WHERE itd.packagingId = ? AND it.transaction_date >= ? AND it.transaction_date <= ?
         ORDER BY it.transaction_date DESC, it.createdAt DESC`,
        [req.params.id, startDate, endDate],
      );
      res.json(history);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Lỗi hệ thống khi lấy lịch sử" });
    }
  });


  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
