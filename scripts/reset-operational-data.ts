import "dotenv/config";
import mysql from "mysql2/promise";

const HOST = process.env.DB_HOST || process.env.HOST || "localhost";
const PORT = Number(process.env.DB_PORT || 3306);
const USER = process.env.DB_USER || "root";
const PASSWORD = process.env.DB_PASS || "";
const DATABASE = process.env.DB_NAME || "warehouse_oms_v2";
const CONFIRM =
	process.argv.includes("--yes") || process.env.CONFIRM_RESET === "YES";

/**
 * Các bảng dữ liệu nghiệp vụ sẽ xóa hoàn toàn.
 * KHÔNG có trong danh sách: customers, suppliers, users, price_books,
 * product_* (danh mục), opening_inventory_*, inventory_ledger_opening_balances.
 */
const FULL_TABLES = [
	// Tin nhắn
	"chat_reactions",
	"chat_typing",
	"chat_messages",
	"chat_participants",
	"chat_conversations",
	// Khuyến mãi
	"promotion_usage_logs",
	"promotion_rewards",
	"promotion_conditions",
	"promotion_programs",
	// Trả hàng bán
	"sales_return_document_links",
	"sales_return_lines",
	"sales_returns",
	// Bán hàng
	"sales_document_links_v1",
	"sales_order_details",
	"sales_orders",
	// Bán hàng online (giữ online_products - danh mục)
	"online_order_items",
	"online_orders",
	// Công nợ & thanh toán
	"customer_payments",
	"supplier_payments",
	"payment_receipt_allocations",
	"payment_voucher_allocations",
	"receivable_transactions",
	"payable_transactions",
	"payment_receipts",
	"payment_vouchers",
	// Nhập kho / mua hàng
	"purchase_document_links_v1",
	"purchase_inventory_links",
	"purchase_document_details",
	"purchase_documents",
	// Kiểm kê
	"stocktake_document_links_v1",
	"stocktake_details",
	"stocktakes",
	// Chuyển kho
	"warehouse_transfer_document_links_v1",
	"warehouse_transfer_details",
	"warehouse_transfers",
	// Liên kết chứng từ kho
	"inventory_document_links_v1",
	// Lệnh sản xuất / quản lý sản xuất
	"production_order_document_links_v1",
	"production_order_materials_v1",
	"productiondetails",
	"productionorders",
	// Lắp ráp / tháo dỡ (giữ assembly_bom_headers/lines - danh mục BOM)
	"assembly_order_document_links",
	"assembly_order_outputs",
	"assembly_order_lines",
	"assembly_orders",
	"disassembly_order_document_links",
	"disassembly_order_sources",
	"disassembly_order_lines",
	"disassembly_orders",
	// Bảng tồn kho dẫn xuất/legacy (sẽ tính lại từ tồn đầu kỳ)
	"inventory_lot_balances",
	"inventory_balances",
];

const KEEP_OPENING_FILTER = (alias: string) =>
	`(COALESCE(${alias}.sourceModule,'') = 'OPENING_INVENTORY' OR COALESCE(${alias}.reason,'') = 'OPENING_INVENTORY')`;

async function tableCount(conn: mysql.Connection, table: string) {
	const [rows] = await conn.query<mysql.RowDataPacket[]>(
		`SELECT COUNT(*) AS total FROM \`${table}\``,
	);
	return Number(rows[0]?.total || 0);
}

async function scalar(conn: mysql.Connection, sql: string) {
	const [rows] = await conn.query<mysql.RowDataPacket[]>(sql);
	return Number(Object.values(rows[0] || {})[0] || 0);
}

async function main() {
	const conn = await mysql.createConnection({
		host: HOST,
		port: PORT,
		user: USER,
		password: PASSWORD,
		database: DATABASE,
	});
	try {
		console.log(`DB: ${USER}@${HOST}:${PORT}/${DATABASE}`);
		console.log("Giữ lại: khách hàng, nhà cung cấp, user, bảng giá, danh mục hàng hóa, tồn đầu kỳ.");

		const before = new Map<string, number>();
		for (const table of FULL_TABLES) before.set(table, await tableCount(conn, table));
		const beforeTx = await scalar(conn, "SELECT COUNT(*) FROM inventorytransactions");
		const beforeLedger = await scalar(conn, "SELECT COUNT(*) FROM inventory_ledger");

		if (!CONFIRM) {
			console.log("\nChưa thực thi. Thêm cờ --yes để xóa dữ liệu:");
			console.log("  npx tsx scripts/reset-operational-data.ts --yes");
			console.log("\nSố dòng hiện tại:");
			for (const [table, count] of before) if (count > 0) console.log(`  ${table}: ${count}`);
			console.log(`  inventorytransactions: ${beforeTx}`);
			console.log(`  inventory_ledger: ${beforeLedger}`);
			return;
		}

		await conn.query("SET FOREIGN_KEY_CHECKS = 0");
		await conn.beginTransaction();
		try {
			for (const table of FULL_TABLES) {
				await conn.query(`DELETE FROM \`${table}\``);
			}

			// Chỉ xóa chứng từ kho không phải tồn đầu kỳ
			await conn.query(
				`DELETE d FROM inventorytransactiondetails d
				 INNER JOIN inventorytransactions t ON t.id = d.transactionId
				 WHERE NOT ${KEEP_OPENING_FILTER("t")}`,
			);
			await conn.query(
				`DELETE FROM inventorytransactions WHERE NOT ${KEEP_OPENING_FILTER("inventorytransactions")}`,
			);
			// Giữ bút toán ledger sinh từ phiếu tồn đầu kỳ
			await conn.query(
				"DELETE FROM inventory_ledger WHERE COALESCE(sourceType,'') <> 'OPENING'",
			);

			// Tính lại tồn kho hiện tại = tồn đầu kỳ còn giữ lại
			await conn.query(`
				UPDATE productwarehouses pw
				LEFT JOIN (
					SELECT packagingId, warehouseId,
						SUM(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END) AS qty
					FROM inventory_ledger
					WHERE sourceType = 'OPENING'
					GROUP BY packagingId, warehouseId
				) l ON l.packagingId = pw.packagingId AND l.warehouseId = pw.warehouseId
				LEFT JOIN inventory_ledger_opening_balances ob
					ON ob.packagingId = pw.packagingId AND ob.warehouseId = pw.warehouseId
				SET pw.stock_quantity = COALESCE(l.qty, 0) + COALESCE(ob.quantity, 0)
			`);

			await conn.commit();
		} catch (error) {
			await conn.rollback();
			throw error;
		} finally {
			await conn.query("SET FOREIGN_KEY_CHECKS = 1");
		}

		const remainingTx = await scalar(conn, "SELECT COUNT(*) FROM inventorytransactions");
		const remainingLedger = await scalar(conn, "SELECT COUNT(*) FROM inventory_ledger");
		console.log("\nĐã xóa xong:");
		for (const [table, count] of before) {
			if (count > 0) console.log(`  ${table}: ${count} -> ${await tableCount(conn, table)}`);
		}
		console.log(`  inventorytransactions: ${beforeTx} -> ${remainingTx} (giữ tồn đầu kỳ)`);
		console.log(`  inventory_ledger: ${beforeLedger} -> ${remainingLedger} (giữ bút toán OPENING)`);
		console.log("\nRESET_OPERATIONAL_DATA_OK");
	} finally {
		await conn.end();
	}
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
