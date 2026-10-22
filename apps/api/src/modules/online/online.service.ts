import type { OnlineOrderInput, OnlineProductInput } from "@challenge/contracts";
import { Prisma } from "@challenge/database";
import { prisma } from "@challenge/database";
import { HttpError } from "../../common/http-error";

const money = (value: number) => new Prisma.Decimal(Number(value || 0).toFixed(2));

// Zalo: ưu tiên biến mới, fallback tên biến cũ của dự án SPX
const ZALO_BOT_TOKEN = process.env.ZALO_BOT_TOKEN || process.env.BOT_TOKEN_DEV || process.env.BOT_TOKEN || "";
const ZALO_CHAT_ID = process.env.ZALO_CHAT_ID || process.env.CHAT_ID_DEV || process.env.CHAT_ID || "";

async function sendZaloNotification(message: string) {
  if (!ZALO_BOT_TOKEN || !ZALO_CHAT_ID) return;
  try {
    await fetch(`https://bot-api.zaloplatforms.com/bot${ZALO_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parse_mode: "markdown", chat_id: ZALO_CHAT_ID, text: message }),
    });
  } catch (error) {
    console.error("Zalo notify error:", (error as Error).message);
  }
}

const productInclude = { productpackagings: { select: { id: true, name: true, sku: true, unit: true } } } as const;
const orderInclude = { items: true } as const;

// Tránh lặp tên: "A - A" hoặc "A - B - A - B" chỉ còn "A" / "A - B"
function collapseRepeatedName(value?: string | null) {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const parts = normalized.split(/\s+-\s+/).map(part => part.trim()).filter(Boolean);
  if (parts.length < 2) return normalized;
  const seen = new Set<string>();
  return parts
    .filter(part => {
      const key = part.toLocaleLowerCase("vi");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" - ");
}

function formatProductDisplayName(productName?: string | null, packagingName?: string | null) {
  const product = collapseRepeatedName(productName);
  const packaging = collapseRepeatedName(packagingName);
  if (!product) return packaging;
  if (!packaging) return product;
  const productKey = product.toLocaleLowerCase("vi");
  const packagingKey = packaging.toLocaleLowerCase("vi");
  if (productKey === packagingKey || productKey.includes(packagingKey)) return product;
  if (packagingKey.includes(productKey)) return packaging;
  return collapseRepeatedName(`${product} - ${packaging}`);
}

const mapProduct = (row: any) => ({
  id: row.id,
  packagingId: row.packagingId,
  name: collapseRepeatedName(row.name),
  price: Number(row.price || 0),
  unit: row.unit,
  isActive: row.isActive,
  packagingName: row.productpackagings?.name || null,
  packagingSku: row.productpackagings?.sku || null,
});

const mapOrder = (row: any) => ({
  id: row.id,
  orderCode: row.orderCode,
  orderDate: row.orderDate,
  recipientName: row.recipientName,
  phone: row.phone,
  address: row.address,
  shippingFee: Number(row.shippingFee || 0),
  totalAmount: Number(row.totalAmount || 0),
  status: row.status,
  trackingNumber: row.trackingNumber,
  items: (row.items || []).map((line: any) => ({
    id: line.id,
    packagingId: line.packagingId,
    productName: line.productName,
    quantity: line.quantity,
    price: Number(line.price || 0),
    unit: line.unit,
  })),
});

export const onlineService = {
  // ── Sản phẩm online (link quy cách kho để đồng bộ tên) ──
  async listProducts() {
    const rows = await prisma.online_products.findMany({
      where: { isActive: true },
      include: productInclude,
      orderBy: { name: "asc" },
    });
    return rows.map(mapProduct);
  },
  async createProduct(input: OnlineProductInput) {
    const row = await prisma.online_products.create({
      data: {
        packagingId: input.packagingId || null,
        name: collapseRepeatedName(input.name) || input.name,
        price: money(input.price),
        unit: input.unit || "Cái",
      },
      include: productInclude,
    });
    return mapProduct(row);
  },
  async updateProduct(id: number, input: OnlineProductInput) {
    const existing = await prisma.online_products.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "ONLINE_PRODUCT_NOT_FOUND", "Không tìm thấy sản phẩm online");
    const row = await prisma.online_products.update({
      where: { id },
      data: {
        packagingId: input.packagingId || null,
        name: collapseRepeatedName(input.name) || input.name,
        price: money(input.price),
        unit: input.unit || "Cái",
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: productInclude,
    });
    return mapProduct(row);
  },
  // Đồng bộ tên + ĐVT từ danh mục kho cho các SP đã link
  async syncNames() {
    const rows = await prisma.online_products.findMany({ where: { packagingId: { not: null } } });
    let updated = 0;
    for (const row of rows) {
      const pkg: any = await prisma.productpackagings.findUnique({
        where: { id: row.packagingId as number },
        include: { products: { select: { name: true } } },
      });
      if (!pkg) continue;
      const name =
        formatProductDisplayName(pkg.products?.name, pkg.name) || collapseRepeatedName(row.name) || row.name;
      if (name !== row.name || (pkg.unit && pkg.unit !== row.unit)) {
        await prisma.online_products.update({
          where: { id: row.id },
          data: { name, ...(pkg.unit ? { unit: pkg.unit } : {}) },
        });
        updated += 1;
      }
    }
    return { updated };
  },

  // ── Đơn hàng online ──
  async listOrders(query: { page: number; limit: number; search?: string; status?: string }) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { orderCode: { contains: query.search } },
        { recipientName: { contains: query.search } },
        { phone: { contains: query.search } },
        { address: { contains: query.search } },
        { trackingNumber: { contains: query.search } },
      ];
    }
    const [rows, total] = await Promise.all([
      prisma.online_orders.findMany({
        where,
        include: orderInclude,
        orderBy: { orderDate: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.online_orders.count({ where }),
    ]);
    return { data: rows.map(mapOrder), meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) } };
  },
  async createOrder(input: OnlineOrderInput, userId: number) {
    const subtotal = input.items.reduce((sum, line) => sum + Number(line.quantity) * Number(line.price), 0);
    const total = subtotal + Number(input.shippingFee || 0);
    let code = (input.orderCode || "").trim().toUpperCase();
    if (!code) code = (await this.nextCode()).code;
    const dup = await prisma.online_orders.findUnique({ where: { orderCode: code } });
    if (dup) throw new HttpError(409, "ONLINE_ORDER_CODE_EXISTS", "Mã đơn hàng đã tồn tại");
    const row = await prisma.online_orders.create({
      data: {
        orderCode: code,
        recipientName: input.recipientName,
        phone: input.phone,
        address: input.address,
        shippingFee: money(input.shippingFee),
        totalAmount: money(total),
        status: "Pending",
        createdBy: userId,
        items: {
          create: input.items.map(line => ({
            packagingId: line.packagingId || null,
            productName: line.productName,
            quantity: line.quantity,
            price: money(line.price),
            unit: line.unit || "Cái",
          })),
        },
      },
      include: orderInclude,
    });
    const itemsText = input.items
      .map(i => `- ${i.productName} (SL: ${i.quantity} ${i.unit || "Cái"}) - ${(Number(i.quantity) * Number(i.price)).toLocaleString("vi-VN")}đ`)
      .join("\n");
    await sendZaloNotification(
      `🔔 *ĐƠN HÀNG MỚI: ${code}*\n👤 Người nhận: ${input.recipientName}\n📞 SĐT: ${input.phone}\n📍 Địa chỉ: ${input.address}\n📦 Sản phẩm:\n${itemsText}\n🚚 Phí vận chuyển: ${Number(input.shippingFee || 0).toLocaleString("vi-VN")}đ\n💰 *Tổng tiền: ${total.toLocaleString("vi-VN")}đ*`,
    );
    return mapOrder(row);
  },
  async updateStatus(id: number, status: string) {
    const existing = await prisma.online_orders.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "ONLINE_ORDER_NOT_FOUND", "Không tìm thấy đơn hàng online");
    const row = await prisma.online_orders.update({
      where: { id },
      data: { status },
      include: orderInclude,
    });
    return mapOrder(row);
  },
  async remove(id: number) {
    const existing = await prisma.online_orders.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "ONLINE_ORDER_NOT_FOUND", "Không tìm thấy đơn hàng online");
    // Chi tiết cascade theo header
    await prisma.online_orders.delete({ where: { id } });
    return { id };
  },
  async updateTracking(id: number, trackingNumber: string) {
    const existing = await prisma.online_orders.findUnique({ where: { id } });
    if (!existing) throw new HttpError(404, "ONLINE_ORDER_NOT_FOUND", "Không tìm thấy đơn hàng online");
    const row = await prisma.online_orders.update({
      where: { id },
      data: { trackingNumber, status: "Shipped" },
      include: orderInclude,
    });
    return mapOrder(row);
  },

  // ── Proxy tra cứu SPX + tự cập nhật trạng thái ──
  async trackingInfo(trackingNumber: string) {
    const response = await fetch(
      `https://spx.vn/shipment/order/open/order/get_order_info?spx_tn=${encodeURIComponent(trackingNumber)}&language_code=vi`,
    );
    if (!response.ok) throw new HttpError(502, "SPX_TRACKING_FAILED", "Không lấy được thông tin vận đơn từ SPX");
    const spxData: any = await response.json();
    const milestone = String(spxData?.data?.sls_tracking_info?.records?.[0]?.milestone_name || "");
    let newStatus: string | null = null;
    if (milestone === "Delivered") newStatus = "Delivered";
    else if (milestone === "Out for delivery") newStatus = "Shipping";
    else if (["In transit", "Picked up"].includes(milestone)) newStatus = "Shipped";
    if (newStatus) {
      await prisma.online_orders.updateMany({
        where: { trackingNumber, status: { notIn: ["Cancelled", "Delivered"] } },
        data: { status: newStatus },
      });
    }
    return spxData;
  },

  // ── Đồng bộ hàng loạt trạng thái SPX (dùng endpoint tracking công khai) ──
  async syncShipments() {
    const SYNCABLE = ["Packing", "Shipping", "Shipped"];
    const cooldown = new Date(Date.now() - 30 * 60 * 1000);
    const candidates = await prisma.online_orders.findMany({
      where: {
        status: { in: SYNCABLE },
        trackingNumber: { not: null },
        OR: [{ trackingSyncedAt: null }, { trackingSyncedAt: { lt: cooldown } }],
      },
      orderBy: { trackingSyncedAt: "asc" },
      take: 50,
    });
    let succeeded = 0;
    let failed = 0;
    let changed = 0;
    const delivered: string[] = [];
    for (const order of candidates) {
      const before = String(order.status);
      try {
        // eslint-disable-next-line no-await-in-loop
        await onlineService.trackingInfo(String(order.trackingNumber));
        const after = await prisma.online_orders.findUnique({ where: { id: order.id }, select: { status: true, orderCode: true } });
        await prisma.online_orders.update({ where: { id: order.id }, data: { trackingSyncedAt: new Date() } });
        succeeded += 1;
        if (after && after.status !== before) {
          changed += 1;
          if (after.status === "Delivered") delivered.push(after.orderCode);
        }
      } catch {
        failed += 1;
      }
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => { setTimeout(resolve, 400); });
    }
    return { checked: candidates.length, succeeded, failed, changed, delivered };
  },

  // Mã đơn tăng dần DH000001... (tiếp nối số lớn nhất đang có)
  async nextCode() {
    const rows = await prisma.$queryRawUnsafe<Array<{ m: number | null }>>(
      `SELECT MAX(CAST(SUBSTRING(orderCode, 3) AS UNSIGNED)) m FROM online_orders
       WHERE orderCode REGEXP '^DH[0-9]+$'`,
    );
    const next = Number(rows[0]?.m || 0) + 1;
    return { code: `DH${String(next).padStart(6, "0")}` };
  },

  // ── Báo cáo: SP bán chạy + doanh số theo tháng ──
  async topProducts(query: { month?: string; limit: number }) {
    const params: any[] = [];
    let monthFilter = "";
    if (query.month) {
      monthFilter = "AND DATE_FORMAT(o.orderDate, '%Y-%m') = ?";
      params.push(query.month);
    }
    const rows = await prisma.$queryRawUnsafe<Array<{
      productName: string; unit: string; qty: number; revenue: number; orders: number;
    }>>(
      `SELECT i.productName, i.unit, SUM(i.quantity) qty, SUM(i.quantity * i.price) revenue,
        COUNT(DISTINCT i.orderId) orders
       FROM online_order_items i JOIN online_orders o ON o.id = i.orderId
       WHERE o.status <> 'Cancelled' ${monthFilter}
       GROUP BY i.productName, i.unit ORDER BY qty DESC LIMIT ?`,
      ...params, query.limit,
    );
    return rows.map(row => ({
      productName: row.productName,
      unit: row.unit,
      quantity: Number(row.qty || 0),
      revenue: Number(row.revenue || 0),
      orders: Number(row.orders || 0),
    }));
  },
  async monthlyReport(months: number) {
    const rows = await prisma.$queryRawUnsafe<Array<{ month: string; orders: number; revenue: number }>>(
      `SELECT DATE_FORMAT(orderDate, '%Y-%m') month, COUNT(*) orders, SUM(totalAmount) revenue
       FROM online_orders WHERE status <> 'Cancelled'
       GROUP BY DATE_FORMAT(orderDate, '%Y-%m') ORDER BY month DESC LIMIT ?`,
      months,
    );
    return [...rows].reverse().map(row => ({
      month: row.month,
      orders: Number(row.orders || 0),
      revenue: Number(row.revenue || 0),
    }));
  },

  // ── Thống kê ──
  async stats() {
    const [summary, daily, monthly] = await Promise.all([
      prisma.online_orders.aggregate({
        _sum: { totalAmount: true },
        _count: { id: true },
        where: { status: { not: "Cancelled" } },
      }),
      prisma.$queryRawUnsafe<Array<{ date: string; revenue: number }>>(
        `SELECT DATE(orderDate) date, SUM(totalAmount) revenue FROM online_orders
         WHERE status <> 'Cancelled' GROUP BY DATE(orderDate) ORDER BY date DESC LIMIT 7`,
      ),
      prisma.$queryRawUnsafe<Array<{ month: string; revenue: number }>>(
        `SELECT DATE_FORMAT(orderDate, '%Y-%m') month, SUM(totalAmount) revenue FROM online_orders
         WHERE status <> 'Cancelled' GROUP BY DATE_FORMAT(orderDate, '%Y-%m') ORDER BY month DESC LIMIT 12`,
      ),
    ]);
    return {
      totalRevenue: Number(summary._sum.totalAmount || 0),
      totalOrders: summary._count.id || 0,
      dailyRevenue: [...daily].reverse().map(row => ({ date: row.date, revenue: Number(row.revenue || 0) })),
      monthlyRevenue: [...monthly].reverse().map(row => ({ month: row.month, revenue: Number(row.revenue || 0) })),
    };
  },
};
