import "dotenv/config";
import mysql from "mysql2/promise";

const HOST = process.env.DB_HOST || process.env.HOST || "localhost";
const PORT = Number(process.env.DB_PORT || 3306);
const USER = process.env.DB_USER || "root";
const PASSWORD = process.env.DB_PASS || "";
const DATABASE = process.env.DB_NAME || "warehouse_oms_v2";

const args = process.argv.slice(2);
const monthArg = args.find(arg => arg.startsWith("--month="));
const MONTH = monthArg ? monthArg.slice("--month=".length) : "2026-10";
const CONFIRM = args.includes("--yes") || process.env.CONFIRM_RESET === "YES";

if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(MONTH)) {
	console.error(`Tháng không hợp lệ: ${MONTH}. Định dạng đúng: YYYY-MM`);
	process.exit(1);
}

const monthStart = `${MONTH}-01`;
const [year, monthNumber] = MONTH.split("-").map(Number);
const nextMonth = new Date(Date.UTC(year, monthNumber, 1));
const nextMonthStart = nextMonth.toISOString().slice(0, 10);

type Ids = number[];

async function ids(
	conn: mysql.Connection,
	sql: string,
	params: any[] = [],
): Promise<Ids> {
	const [rows] = await conn.query<mysql.RowDataPacket[]>(sql, params);
	return rows.map(row => Number(row.id)).filter(Number.isFinite);
}

async function scalar(
	conn: mysql.Connection,
	sql: string,
	params: any[] = [],
) {
	const [rows] = await conn.query<mysql.RowDataPacket[]>(sql, params);
	return Number(Object.values(rows[0] || {})[0] || 0);
}

async function addIds(target: Set<number>, values: Ids) {
	for (const value of values) target.add(value);
}

function placeholders(values: number[]) {
	return values.map(() => "?").join(", ");
}

async function deleteIn(
	conn: mysql.Connection,
	table: string,
	column: string,
	values: number[],
) {
	if (!values.length) return 0;
	const [result] = await conn.query<mysql.ResultSetHeader>(
		`DELETE FROM \`${table}\` WHERE \`${column}\` IN (${placeholders(values)})`,
		values,
	);
	return result.affectedRows;
}

async function deleteWhere(
	conn: mysql.Connection,
	table: string,
	where: string,
	params: any[] = [],
) {
	const [result] = await conn.query<mysql.ResultSetHeader>(
		`DELETE FROM \`${table}\` WHERE ${where}`,
		params,
	);
	return result.affectedRows;
}

async function expandReversalIds(
	conn: mysql.Connection,
	table: string,
	idsSet: Set<number>,
) {
	let previousSize = -1;
	while (previousSize !== idsSet.size) {
		previousSize = idsSet.size;
		if (!idsSet.size) break;
		const values = [...idsSet];
		const rows = await ids(
			conn,
			`SELECT id FROM \`${table}\` WHERE reversalOfId IN (${placeholders(values)})`,
			values,
		);
		for (const id of rows) idsSet.add(id);
	}
}

async function expandReversalDocumentIds(
	conn: mysql.Connection,
	table: string,
	column: string,
	idsSet: Set<number>,
) {
	let previousSize = -1;
	while (previousSize !== idsSet.size) {
		previousSize = idsSet.size;
		if (!idsSet.size) break;
		const values = [...idsSet];
		const rows = await ids(
			conn,
			`SELECT id FROM \`${table}\` WHERE \`${column}\` IN (${placeholders(values)})`,
			values,
		);
		for (const id of rows) idsSet.add(id);
	}
}

async function collect(conn: mysql.Connection) {
	const salesOrders = await ids(
		conn,
		"SELECT id FROM sales_orders WHERE LEFT(orderDate, 7) = ?",
		[MONTH],
	);
	const purchaseDocuments = await ids(
		conn,
		"SELECT id FROM purchase_documents WHERE LEFT(documentDate, 7) = ?",
		[MONTH],
	);
	const salesReturns = await ids(
		conn,
		"SELECT id FROM sales_returns WHERE DATE_FORMAT(returnDate, '%Y-%m') = ?",
		[MONTH],
	);
	const warehouseTransfers = await ids(
		conn,
		"SELECT id FROM warehouse_transfers WHERE LEFT(transferDate, 7) = ?",
		[MONTH],
	);
	const stocktakes = await ids(
		conn,
		"SELECT id FROM stocktakes WHERE LEFT(date, 7) = ?",
		[MONTH],
	);
	const productionOrders = await ids(
		conn,
		"SELECT id FROM productionorders WHERE LEFT(order_date, 7) = ?",
		[MONTH],
	);
	const assemblyOrders = await ids(
		conn,
		"SELECT id FROM assembly_orders WHERE DATE_FORMAT(orderDate, '%Y-%m') = ?",
		[MONTH],
	);
	const disassemblyOrders = await ids(
		conn,
		"SELECT id FROM disassembly_orders WHERE DATE_FORMAT(orderDate, '%Y-%m') = ?",
		[MONTH],
	);
	const onlineOrders = await ids(
		conn,
		"SELECT id FROM online_orders WHERE DATE_FORMAT(orderDate, '%Y-%m') = ?",
		[MONTH],
	);
	const paymentReceipts = new Set(
		await ids(
			conn,
			"SELECT id FROM payment_receipts WHERE DATE_FORMAT(receiptDate, '%Y-%m') = ?",
			[MONTH],
		),
	);
	const paymentVouchers = new Set(
		await ids(
			conn,
			"SELECT id FROM payment_vouchers WHERE DATE_FORMAT(voucherDate, '%Y-%m') = ?",
			[MONTH],
		),
	);
	const customerPayments = await ids(
		conn,
		"SELECT id FROM customer_payments WHERE LEFT(paymentDate, 7) = ?",
		[MONTH],
	);
	const supplierPayments = await ids(
		conn,
		"SELECT id FROM supplier_payments WHERE LEFT(paymentDate, 7) = ?",
		[MONTH],
	);

	// Thanh toán của chứng từ bị xóa (kể cả phiếu thanh toán ở tháng khác).
	if (salesOrders.length) {
		const linkedReceipts = await ids(
			conn,
			`SELECT linkedId AS id FROM sales_document_links_v1
       WHERE salesOrderId IN (${placeholders(salesOrders)}) AND linkType = 'PAYMENT_RECEIPT'`,
			salesOrders,
		);
		await addIds(paymentReceipts, linkedReceipts);
	}
	if (purchaseDocuments.length) {
		const linkedVouchers = await ids(
			conn,
			`SELECT linkedId AS id FROM purchase_document_links_v1
       WHERE purchaseDocumentId IN (${placeholders(purchaseDocuments)}) AND linkType = 'PAYMENT_VOUCHER'`,
			purchaseDocuments,
		);
		await addIds(paymentVouchers, linkedVouchers);
	}

	await expandReversalDocumentIds(
		conn,
		"payment_receipts",
		"reversalReceiptId",
		paymentReceipts,
	);
	await expandReversalDocumentIds(
		conn,
		"payment_vouchers",
		"reversalVoucherId",
		paymentVouchers,
	);

	const inventoryTransactions = new Set(
		await ids(
			conn,
			`SELECT id FROM inventorytransactions
       WHERE (LEFT(transaction_date, 7) = ? OR LEFT(entry_date, 7) = ? OR LEFT(exit_date, 7) = ?)
         AND COALESCE(sourceModule, '') <> 'OPENING_INVENTORY'`,
			[MONTH, MONTH, MONTH],
		),
	);
	if (salesOrders.length)
		await addIds(
			inventoryTransactions,
			await ids(
				conn,
				`SELECT inventoryTransactionId AS id FROM sales_orders
         WHERE id IN (${placeholders(salesOrders)}) AND inventoryTransactionId IS NOT NULL`,
				salesOrders,
			),
		);
	if (purchaseDocuments.length)
		await addIds(
			inventoryTransactions,
			await ids(
				conn,
				`SELECT inventoryTransactionId AS id FROM purchase_documents
         WHERE id IN (${placeholders(purchaseDocuments)}) AND inventoryTransactionId IS NOT NULL`,
				purchaseDocuments,
			),
		);
	if (warehouseTransfers.length) {
		for (const column of [
			"exportTransactionId",
			"importTransactionId",
			"cancellationTransactionId",
		]) {
			await addIds(
				inventoryTransactions,
				await ids(
					conn,
					`SELECT \`${column}\` AS id FROM warehouse_transfers
           WHERE id IN (${placeholders(warehouseTransfers)}) AND \`${column}\` IS NOT NULL`,
					warehouseTransfers,
				),
			);
		}
	}
	if (stocktakes.length) {
		for (const column of ["adjustmentTransactionId", "reversalTransactionId"]) {
			await addIds(
				inventoryTransactions,
				await ids(
					conn,
					`SELECT \`${column}\` AS id FROM stocktakes
           WHERE id IN (${placeholders(stocktakes)}) AND \`${column}\` IS NOT NULL`,
					stocktakes,
				),
			);
		}
	}

	return {
		salesOrders,
		purchaseDocuments,
		salesReturns,
		warehouseTransfers,
		stocktakes,
		productionOrders,
		assemblyOrders,
		disassemblyOrders,
		onlineOrders,
		paymentReceipts: [...paymentReceipts],
		paymentVouchers: [...paymentVouchers],
		customerPayments,
		supplierPayments,
		inventoryTransactions: [...inventoryTransactions],
	};
}

type Collected = Awaited<ReturnType<typeof collect>>;

function summaryRows(collected: Collected) {
	return [
		["Đơn bán hàng", collected.salesOrders.length],
		["Chứng từ mua hàng", collected.purchaseDocuments.length],
		["Phiếu trả hàng", collected.salesReturns.length],
		["Chứng từ kho", collected.inventoryTransactions.length],
		["Phiếu chuyển kho", collected.warehouseTransfers.length],
		["Phiếu kiểm kê", collected.stocktakes.length],
		["Lệnh lắp ráp", collected.assemblyOrders.length],
		["Lệnh tháo dỡ", collected.disassemblyOrders.length],
		["Đơn online", collected.onlineOrders.length],
		["Phiếu thu", collected.paymentReceipts.length],
		["Phiếu chi", collected.paymentVouchers.length],
		["Thanh toán KH (legacy)", collected.customerPayments.length],
		["Thanh toán NCC (legacy)", collected.supplierPayments.length],
	] as const;
}

async function execute(conn: mysql.Connection, collected: Collected) {
	const {
		salesOrders,
		purchaseDocuments,
		salesReturns,
		warehouseTransfers,
		stocktakes,
		assemblyOrders,
		disassemblyOrders,
		onlineOrders,
		paymentReceipts,
		paymentVouchers,
		customerPayments,
		supplierPayments,
		inventoryTransactions,
	} = collected;

	// Con của chứng từ bán/mua/trả hàng.
	await deleteIn(conn, "sales_order_details", "orderId", salesOrders);
	await deleteIn(conn, "sales_document_links_v1", "salesOrderId", salesOrders);
	await deleteIn(conn, "sales_return_lines", "salesReturnId", salesReturns);
	await deleteIn(
		conn,
		"sales_return_document_links",
		"salesReturnId",
		salesReturns,
	);
	await deleteIn(
		conn,
		"purchase_document_details",
		"documentId",
		purchaseDocuments,
	);
	await deleteIn(
		conn,
		"purchase_document_links_v1",
		"purchaseDocumentId",
		purchaseDocuments,
	);
	await deleteIn(
		conn,
		"purchase_inventory_links",
		"purchaseDocumentId",
		purchaseDocuments,
	);

	// Con của các chứng từ kho/khác.
	await deleteIn(
		conn,
		"warehouse_transfer_details",
		"transferId",
		warehouseTransfers,
	);
	await deleteIn(
		conn,
		"warehouse_transfer_document_links_v1",
		"transferId",
		warehouseTransfers,
	);
	await deleteIn(conn, "stocktake_details", "stocktakeId", stocktakes);
	await deleteIn(
		conn,
		"stocktake_document_links_v1",
		"stocktakeId",
		stocktakes,
	);
	await deleteIn(conn, "assembly_order_lines", "orderId", assemblyOrders);
	await deleteIn(conn, "assembly_order_outputs", "orderId", assemblyOrders);
	await deleteIn(
		conn,
		"assembly_order_document_links",
		"orderId",
		assemblyOrders,
	);
	await deleteIn(
		conn,
		"disassembly_order_lines",
		"orderId",
		disassemblyOrders,
	);
	await deleteIn(
		conn,
		"disassembly_order_sources",
		"orderId",
		disassemblyOrders,
	);
	await deleteIn(
		conn,
		"disassembly_order_document_links",
		"orderId",
		disassemblyOrders,
	);
	await deleteIn(conn, "online_order_items", "orderId", onlineOrders);

	// Thanh toán & phân bổ.
	await deleteIn(
		conn,
		"payment_receipt_allocations",
		"paymentReceiptId",
		paymentReceipts,
	);
	await deleteIn(
		conn,
		"payment_voucher_allocations",
		"paymentVoucherId",
		paymentVouchers,
	);
	await deleteIn(
		conn,
		"payment_receipt_allocations",
		"salesOrderId",
		salesOrders,
	);
	await deleteIn(
		conn,
		"payment_voucher_allocations",
		"purchaseDocumentId",
		purchaseDocuments,
	);
	await deleteIn(conn, "customer_payments", "id", customerPayments);
	await deleteIn(conn, "customer_payments", "salesOrderId", salesOrders);
	await deleteIn(conn, "supplier_payments", "id", supplierPayments);
	await deleteIn(
		conn,
		"supplier_payments",
		"purchaseDocumentId",
		purchaseDocuments,
	);

	// Công nợ: xóa giao dịch phát sinh trong tháng hoặc thuộc chứng từ bị xóa,
	// sau đó xóa luôn các bút toán đảo tương ứng.
	const receivableIds = new Set(
		await ids(
			conn,
			"SELECT id FROM receivable_transactions WHERE occurredAt >= ? AND occurredAt < ?",
			[monthStart, nextMonthStart],
		),
	);
	for (const values of [
		salesOrders,
		salesReturns,
		paymentReceipts,
		customerPayments,
	]) {
		if (!values.length) continue;
		await addIds(
			receivableIds,
			await ids(
				conn,
				`SELECT id FROM receivable_transactions WHERE sourceId IN (${placeholders(values)})`,
				[...values],
			),
		);
	}
	await expandReversalIds(conn, "receivable_transactions", receivableIds);

	const payableIds = new Set(
		await ids(
			conn,
			"SELECT id FROM payable_transactions WHERE occurredAt >= ? AND occurredAt < ?",
			[monthStart, nextMonthStart],
		),
	);
	for (const values of [
		purchaseDocuments,
		paymentVouchers,
		supplierPayments,
	]) {
		if (!values.length) continue;
		await addIds(
			payableIds,
			await ids(
				conn,
				`SELECT id FROM payable_transactions WHERE sourceId IN (${placeholders(values)})`,
				values,
			),
		);
	}
	await expandReversalIds(conn, "payable_transactions", payableIds);

	await deleteIn(
		conn,
		"receivable_transactions",
		"id",
		[...receivableIds],
	);
	await deleteIn(conn, "payable_transactions", "id", [...payableIds]);

	// Sổ kho: xóa bút toán theo tháng (giữ OPENING và PRODUCTION của lệnh sản xuất) + bút toán của chứng từ bị xóa.
	const ledgerIds = new Set(
		await ids(
			conn,
			`SELECT id FROM inventory_ledger
       WHERE occurredAt >= ? AND occurredAt < ?
         AND sourceType NOT IN ('OPENING', 'PRODUCTION', 'PRODUCTION_CANCEL')`,
			[monthStart, nextMonthStart],
		),
	);
	const ledgerSources: Array<{ types: string[]; ids: number[] }> = [
		{
			types: [
				"SALE",
				"SALE_CANCEL",
				"SALE_UNPOST",
				"SALE_PAYMENT",
				"SALE_PAYMENT_CANCEL",
				"SALE_CREDIT",
				"SALE_CREDIT_CANCEL",
			],
			ids: salesOrders,
		},
		{
			types: [
				"PURCHASE",
				"PURCHASE_CANCEL",
				"PURCHASE_PAYMENT",
				"PURCHASE_PAYMENT_CANCEL",
			],
			ids: purchaseDocuments,
		},
		{ types: ["SALES_RETURN", "SALES_RETURN_CANCEL"], ids: salesReturns },
		{
			types: ["INVENTORY_DOCUMENT", "INVENTORY_DOCUMENT_CANCEL"],
			ids: inventoryTransactions,
		},
		{
			types: [
				"TRANSFER",
				"TRANSFER_CANCEL",
				"WAREHOUSE_TRANSFER",
				"WAREHOUSE_TRANSFER_CANCEL",
			],
			ids: warehouseTransfers,
		},
		{ types: ["STOCKTAKE", "STOCKTAKE_CANCEL"], ids: stocktakes },
		{
			types: [
				"ASSEMBLY",
				"ASSEMBLY_CANCEL",
				"DISASSEMBLY",
				"DISASSEMBLY_CANCEL",
			],
			ids: [...assemblyOrders, ...disassemblyOrders],
		},
	];
	for (const source of ledgerSources) {
		if (!source.ids.length) continue;
		await addIds(
			ledgerIds,
			await ids(
				conn,
				`SELECT id FROM inventory_ledger
         WHERE sourceType IN (${source.types.map(() => "?").join(", ")})
           AND sourceId IN (${placeholders(source.ids)})`,
				[...source.types, ...source.ids],
			),
		);
	}
	await expandReversalIds(conn, "inventory_ledger", ledgerIds);
	await deleteIn(conn, "inventory_ledger", "id", [...ledgerIds]);

	// Chứng từ kho.
	await deleteIn(
		conn,
		"inventorytransactiondetails",
		"transactionId",
		inventoryTransactions,
	);
	if (inventoryTransactions.length) {
		await deleteWhere(
			conn,
			"inventory_document_links_v1",
			`sourceTransactionId IN (${placeholders(inventoryTransactions)}) OR targetTransactionId IN (${placeholders(inventoryTransactions)})`,
			[...inventoryTransactions, ...inventoryTransactions],
		);
		// Giữ lệnh sản xuất nhưng bỏ liên kết tới phiếu kho đã bị xóa.
		await deleteWhere(
			conn,
			"production_order_document_links_v1",
			`linkedId IN (${placeholders(inventoryTransactions)})`,
			inventoryTransactions,
		);
	}
	await deleteIn(
		conn,
		"inventorytransactions",
		"id",
		inventoryTransactions,
	);

	// Xóa chứng từ gốc.
	await deleteIn(conn, "sales_returns", "id", salesReturns);
	await deleteIn(conn, "sales_orders", "id", salesOrders);
	await deleteIn(conn, "purchase_documents", "id", purchaseDocuments);
	await deleteIn(conn, "warehouse_transfers", "id", warehouseTransfers);
	await deleteIn(conn, "stocktakes", "id", stocktakes);
	await deleteIn(conn, "assembly_orders", "id", assemblyOrders);
	await deleteIn(conn, "disassembly_orders", "id", disassemblyOrders);
	await deleteIn(conn, "online_orders", "id", onlineOrders);
	await deleteIn(conn, "payment_receipts", "id", paymentReceipts);
	await deleteIn(conn, "payment_vouchers", "id", paymentVouchers);

	// Tính lại tồn kho từ sổ kho còn lại (bao gồm tồn đầu kỳ OPENING).
	await conn.query(`
    INSERT INTO productwarehouses (packagingId, warehouseId, stock_quantity, updatedAt)
    SELECT l.packagingId, l.warehouseId,
      SUM(CASE WHEN l.direction = 'IN' THEN l.quantity ELSE -l.quantity END),
      DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')
    FROM inventory_ledger l
    GROUP BY l.packagingId, l.warehouseId
    ON DUPLICATE KEY UPDATE
      stock_quantity = VALUES(stock_quantity),
      updatedAt = VALUES(updatedAt)
  `);
	await conn.query(`
    UPDATE productwarehouses pw
    LEFT JOIN (
      SELECT packagingId, warehouseId,
        SUM(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END) qty
      FROM inventory_ledger
      GROUP BY packagingId, warehouseId
    ) l ON l.packagingId = pw.packagingId AND l.warehouseId = pw.warehouseId
    SET pw.stock_quantity = COALESCE(l.qty, 0)
  `);

	// Tính lại đã thanh toán/công nợ của các chứng từ còn lại.
	await conn.query(`
    UPDATE sales_orders s
    LEFT JOIN (
      SELECT sourceId, SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) paid
      FROM receivable_transactions GROUP BY sourceId
    ) t ON t.sourceId = s.id
    SET s.paidAmount = COALESCE(t.paid, 0),
        s.paymentStatus = CASE
          WHEN COALESCE(t.paid, 0) <= 0.001 THEN 'UNPAID'
          WHEN COALESCE(t.paid, 0) >= s.totalAmount - 0.001 THEN 'PAID'
          ELSE 'PARTIAL'
        END
  `);
	await conn.query(`
    UPDATE purchase_documents p
    LEFT JOIN (
      SELECT sourceId, SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) paid
      FROM payable_transactions GROUP BY sourceId
    ) t ON t.sourceId = p.id
    SET p.paidAmount = COALESCE(t.paid, 0),
        p.paymentStatus = CASE
          WHEN COALESCE(t.paid, 0) <= 0.001 THEN 'UNPAID'
          WHEN COALESCE(t.paid, 0) >= p.totalAmount - 0.001 THEN 'PAID'
          ELSE 'PARTIAL'
        END
  `);
}

async function main() {
	const conn = await mysql.createConnection({
		host: HOST,
		port: PORT,
		user: USER,
		password: PASSWORD,
		database: DATABASE,
		dateStrings: true,
	});
	try {
		console.log(`DB: ${USER}@${HOST}:${PORT}/${DATABASE}`);
		console.log(`Tháng xóa: ${MONTH}`);
		console.log(
			"Phạm vi: đơn bán/mua, kho, chuyển kho, kiểm kê, lắp ráp/tháo dỡ, online, thu/chi, công nợ.",
		);
		console.log("Giữ lại: lệnh sản xuất, danh mục, tồn đầu kỳ (OPENING), người dùng, bảng giá.");

		const collected = await collect(conn);
		console.log("\nDữ liệu sẽ xóa:");
		for (const [label, count] of summaryRows(collected)) {
			if (count) console.log(`  ${label}: ${count}`);
		}
		if (collected.productionOrders.length)
			console.log(`  Lệnh sản xuất (giữ lại): ${collected.productionOrders.length}`);
		const total = summaryRows(collected).reduce(
			(sum, [, count]) => sum + count,
			0,
		);
		if (!total) {
			console.log("\nKhông có chứng từ nào trong tháng này.");
			return;
		}
		if (!CONFIRM) {
			console.log(
				"\nChưa thực thi. Chạy lại với --yes để xóa thật (nên chạy npm run db:dump trước).",
			);
			return;
		}

		await conn.beginTransaction();
		try {
			await conn.query("SET FOREIGN_KEY_CHECKS = 0");
			await execute(conn, collected);
			await conn.query("SET FOREIGN_KEY_CHECKS = 1");
			await conn.commit();
		} catch (error) {
			await conn.rollback();
			throw error;
		} finally {
			await conn.query("SET FOREIGN_KEY_CHECKS = 1").catch(() => {});
		}

		const remaining = await collect(conn);
		console.log("\nĐã xóa xong. Còn lại trong tháng:");
		let remainingTotal = 0;
		for (const [label, count] of summaryRows(remaining)) {
			remainingTotal += count;
			if (count) console.log(`  ${label}: ${count}`);
		}
		if (remaining.productionOrders.length)
			console.log(`  Lệnh sản xuất (giữ lại): ${remaining.productionOrders.length}`);
		if (!remainingTotal) console.log("  (không còn chứng từ)");
		console.log(`\nStock còn lại: ${await scalar(conn, "SELECT ROUND(SUM(stock_quantity), 4) FROM productwarehouses")}`);
		console.log("RESET_MONTH_DOCUMENTS_OK");
	} finally {
		await conn.end();
	}
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
