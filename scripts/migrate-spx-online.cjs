/**
 * Migrate dữ liệu bán online từ DB cũ (spx_orders) sang warehouse_oms_v2.
 *
 * Chạy trên máy có cả 2 database:
 *   SPX_DB_HOST / SPX_DB_PORT / SPX_DB_USER / SPX_DB_PASSWORD / SPX_DB_NAME (mặc định localhost:3306/root/spx_orders)
 *   DATABASE_URL (.env) trỏ warehouse_oms_v2 đích
 *
 *   node scripts/migrate-spx-online.cjs [--dry-run]
 */
const mysql = require("mysql2/promise");

const DRY_RUN = process.argv.includes("--dry-run");

function spxConfig() {
  return {
    host: process.env.SPX_DB_HOST || "localhost",
    port: Number(process.env.SPX_DB_PORT || 3306),
    user: process.env.SPX_DB_USER || "root",
    password: process.env.SPX_DB_PASSWORD || process.env.DB_PASSWORD || "",
    database: process.env.SPX_DB_NAME || "spx_orders",
  };
}

function erpConfig() {
  const url = process.env.DATABASE_URL || "";
  const m = url.match(/mysql:\/\/([^:]+):([^@]*)@([^:/]+):?(\d*)\/(.+)/);
  if (!m) throw new Error("DATABASE_URL không hợp lệ, cần dạng mysql://user:pass@host:port/db");
  return { host: m[3], port: Number(m[4] || 3306), user: m[1], password: m[2], database: m[5].split("?")[0] };
}

(async () => {
  require("dotenv").config();
  const src = await mysql.createConnection(spxConfig());
  const dst = await mysql.createConnection(erpConfig());
  try {
    const [products] = await src.query("SELECT id, name, price, unit FROM products ORDER BY id");
    const [orders] = await src.query("SELECT * FROM orders ORDER BY id");
    console.log(`SPX source: ${products.length} products, ${orders.length} orders (dry-run: ${DRY_RUN})`);

    let productCount = 0;
    const productIdMap = new Map();
    for (const p of products) {
      const [exists] = await dst.query("SELECT id FROM online_products WHERE name = ? LIMIT 1", [p.name]);
      if (exists.length) {
        productIdMap.set(p.id, exists[0].id);
        continue;
      }
      if (DRY_RUN) {
        console.log(`[skip] product: ${p.name}`);
        continue;
      }
      const [r] = await dst.query(
        "INSERT INTO online_products (packagingId, name, price, unit, isActive) VALUES (NULL, ?, ?, ?, 1)",
        [p.name, p.price, p.unit || "Cái"],
      );
      productIdMap.set(p.id, r.insertId);
      productCount += 1;
    }

    let orderCount = 0, itemCount = 0;
    for (const o of orders) {
      const [exists] = await dst.query("SELECT id FROM online_orders WHERE orderCode = ? LIMIT 1", [o.order_code]);
      if (exists.length) continue;
      const [items] = await src.query("SELECT product_name, quantity, price, unit FROM order_items WHERE order_id = ?", [o.id]);
      if (DRY_RUN) {
        console.log(`[skip] order: ${o.order_code} (${items.length} items)`);
        continue;
      }
      const [r] = await dst.query(
        `INSERT INTO online_orders (orderCode, orderDate, recipientName, phone, address, shippingFee, totalAmount, status, trackingNumber)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [o.order_code, o.order_date, o.recipient_name, o.phone, o.address, o.shipping_fee, o.total_amount, o.status, o.tracking_number || null],
      );
      for (const it of items) {
        await dst.query(
          "INSERT INTO online_order_items (orderId, packagingId, productName, quantity, price, unit) VALUES (?, NULL, ?, ?, ?, ?)",
          [r.insertId, it.product_name, it.quantity, it.price, it.unit || "Cái"],
        );
        itemCount += 1;
      }
      orderCount += 1;
    }
    console.log(`DONE: ${productCount} products, ${orderCount} orders, ${itemCount} items migrated`);
  } finally {
    await src.end().catch(() => {});
    await dst.end().catch(() => {});
  }
})().catch(e => {
  console.error("MIGRATE FAILED:", e.message);
  process.exit(1);
});
