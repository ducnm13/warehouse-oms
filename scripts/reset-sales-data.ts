import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: { db: { url: "mysql://root:@localhost:3306/warehouse_oms_v2" } },
});

async function resetSalesData() {
  console.log("TARGET_DATABASE: warehouse_oms_v2");
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");

  const tables = [
    // Khuyến mãi
    "promotion_usage_logs",
    "promotion_rewards",
    "promotion_conditions",
    "promotion_programs",
    // Bán hàng và trả hàng
    "sales_return_document_links",
    "sales_return_lines",
    "sales_returns",
    "sales_document_links_v1",
    "sales_order_details",
    "sales_orders",
    // Mua hàng
    "purchase_document_links_v1",
    "purchase_inventory_links",
    "purchase_document_details",
    "purchase_documents",
    // Kho: phiếu, chi tiết, ledger, chuyển kho, kiểm kê, tồn đầu kỳ, lắp ráp/tháo dỡ, sản xuất
    "inventorytransactiondetails",
    "inventorytransactions",
    "inventory_ledger_opening_balances",
    "inventory_ledger",
    "inventory_lot_balances",
    "inventory_document_links_v1",
    "warehouse_transfer_document_links_v1",
    "warehouse_transfer_details",
    "warehouse_transfers",
    "stocktake_document_links_v1",
    "stocktake_details",
    "stocktakes",
    "opening_inventory_lines",
    "opening_inventory_documents",
    "assembly_order_document_links",
    "assembly_order_lines",
    "assembly_orders",
    "disassembly_order_document_links",
    "disassembly_order_lines",
    "disassembly_orders",
    "production_order_document_links_v1",
    "production_order_materials_v1",
    "productiondetails",
    "productionorders",
    // Công nợ và thu chi
    "payment_receipt_allocations",
    "payment_receipts",
    "payment_voucher_allocations",
    "payment_vouchers",
    "receivable_transactions",
    "payable_transactions",
    "customer_payments",
    "supplier_payments",
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DELETE FROM ${table}`);
  }
  await prisma.$executeRawUnsafe("DELETE FROM productwarehouses");
  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
  console.log("SALES_DATA_RESET_OK");
}

resetSalesData()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
