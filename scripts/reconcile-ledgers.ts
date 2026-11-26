/**
 * Đối soát chéo sổ cái (read-only).
 *
 * So sánh:
 *  1. Tồn kho (productwarehouses) với tồn đầu kỳ + phát sinh inventory_ledger.
 *  2. Công nợ nhà cung cấp: purchase_documents với payable_transactions.
 *  3. Công nợ khách hàng: sales_orders với receivable_transactions.
 *  4. Thanh toán: paidAmount với supplier_payments / customer_payments (+ credit).
 *  5. Phiếu thu/chi: header so với tổng phân bổ.
 *  6. Toán học chứng từ: header so với tổng dòng chi tiết.
 *
 * Script KHÔNG ghi dữ liệu. Exit code 1 nếu phát hiện lệch.
 *
 * Cách chạy:
 *   npm run db:reconcile
 *   npm run db:reconcile -- --threshold=0.01 --limit=50
 *   npm run db:reconcile -- --out=reconciliation-report.json
 *
 * Chọn DB khác (ví dụ .env.servers) bằng biến môi trường:
 *   DB_HOST=... DB_USER=... DB_PASS=... DB_NAME=warehouse_oms_v2 npm run db:reconcile
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import mysql from "mysql2/promise";

const argv = process.argv.slice(2);
const argValue = (name: string) => {
	const direct = argv.find(item => item.startsWith(`--${name}=`));
	if (direct) return direct.slice(name.length + 3);
	const flag = argv.findIndex(item => item === `--${name}`);
	if (flag >= 0 && argv[flag + 1] && !argv[flag + 1].startsWith("--")) return argv[flag + 1];
	return undefined;
};

const HOST = argValue("host") || process.env.DB_HOST || process.env.HOST || "localhost";
const PORT = Number(argValue("port") || process.env.DB_PORT || 3306);
const USER = argValue("user") || process.env.DB_USER || "root";
const PASSWORD = argValue("password") ?? process.env.DB_PASS ?? "";
const DATABASE = argValue("database") || process.env.DB_NAME || "warehouse_oms_v2";
const THRESHOLD = Number(argValue("threshold") || 0.01);
const LIMIT = Math.max(1, Number(argValue("limit") || 25));
const OUT = argValue("out");

type Finding = {
	check: string;
	subject: string;
	expected: number;
	actual: number;
	diff: number;
};

type Anomaly = {
	check: string;
	subject: string;
	detail: string;
};

type SectionResult = {
	title: string;
	scanned: number;
	findings: Finding[];
	anomalies: Anomaly[];
	notes: string[];
};

const num = (value: unknown) => {
	if (value === null || value === undefined) return 0;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value: number, digits = 4) => {
	const factor = 10 ** digits;
	return Math.round((value + Number.EPSILON) * factor) / factor;
};

const fmt = (value: number) =>
	Number.isFinite(value)
		? value.toLocaleString("en-US", { maximumFractionDigits: 4 })
		: String(value);

const makeFinding = (
	check: string,
	subject: string,
	expected: number,
	actual: number,
): Finding | null => {
	const diff = round(actual - expected);
	if (Math.abs(diff) <= THRESHOLD) return null;
	return { check, subject, expected: round(expected), actual: round(actual), diff };
};

const labels = {
	packaging: (packagingId: unknown, warehouseId: unknown) =>
		`packagingId=${num(packagingId)} warehouseId=${num(warehouseId)}`,
	purchase: (id: unknown, code: unknown) => `purchase#${num(id)} (${code ?? "?"})`,
	sales: (id: unknown, code: unknown) => `sales#${num(id)} (${code ?? "?"})`,
	supplier: (id: unknown, code: unknown) => `supplier#${num(id)} (${code ?? "?"})`,
	customer: (id: unknown, code: unknown) => `customer#${num(id)} (${code ?? "?"})`,
	voucher: (id: unknown, code: unknown) => `voucher#${String(id)} (${code ?? "?"})`,
	receipt: (id: unknown, code: unknown) => `receipt#${String(id)} (${code ?? "?"})`,
};

async function main() {
	const conn = await mysql.createConnection({
		host: HOST,
		port: PORT,
		user: USER,
		password: PASSWORD,
		database: DATABASE,
		dateStrings: true,
		// Trả DECIMAL dưới dạng string để tránh sai số float khi đọc.
		decimalNumbers: false,
	});

	const sections: SectionResult[] = [];

	const runSection = async (
		title: string,
		run: () => Promise<Omit<SectionResult, "title">>,
	) => {
		process.stdout.write(`\n▶ ${title}\n`);
		try {
			const result = await run();
			sections.push({ title, ...result });
			const icon = result.findings.length || result.anomalies.length ? "✗" : "✓";
			console.log(
				`  ${icon} đã kiểm tra ${result.scanned} đối tượng — lệch ${result.findings.length}, bất thường ${result.anomalies.length}`,
			);
			for (const note of result.notes) console.log(`    · ${note}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.log(`  ! bỏ qua: ${message}`);
			sections.push({
				title,
				scanned: 0,
				findings: [],
				anomalies: [{ check: "system", subject: title, detail: message }],
				notes: [],
			});
		}
	};

	try {
		console.log("=== ĐỐI SOÁT SỔ CÁI ERP (READ-ONLY) ===");
		console.log(`DB: ${USER}@${HOST}:${PORT}/${DATABASE}`);
		console.log(`Ngưỡng sai số: ${THRESHOLD}`);

		// ---------------------------------------------------------------------
		// 1. Tồn kho
		// ---------------------------------------------------------------------
		await runSection("1. Tồn kho: productwarehouses vs opening balance + inventory_ledger", async () => {
			const [rows] = await conn.query<mysql.RowDataPacket[]>(
				`
				SELECT
					k.packagingId,
					k.warehouseId,
					COALESCE(pw.stock_quantity, 0) AS currentQty,
					COALESCE(ob.quantity, 0) AS openingQty,
					COALESCE(l.netQty, 0) AS ledgerNet
				FROM (
					SELECT packagingId, warehouseId FROM productwarehouses
					UNION
					SELECT packagingId, warehouseId FROM inventory_ledger
				) k
				LEFT JOIN productwarehouses pw
					ON pw.packagingId = k.packagingId AND pw.warehouseId = k.warehouseId
				LEFT JOIN inventory_ledger_opening_balances ob
					ON ob.packagingId = k.packagingId AND ob.warehouseId = k.warehouseId
				LEFT JOIN (
					SELECT
						packagingId,
						warehouseId,
						SUM(CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END) AS netQty
					FROM inventory_ledger
					GROUP BY packagingId, warehouseId
				) l ON l.packagingId = k.packagingId AND l.warehouseId = k.warehouseId
				ORDER BY k.packagingId, k.warehouseId
				`,
			);

			const findings = rows
				.map(row => {
					const expected = num(row.openingQty) + num(row.ledgerNet);
					return makeFinding(
						"inventory",
						labels.packaging(row.packagingId, row.warehouseId),
						expected,
						num(row.currentQty),
					);
				})
				.filter((item): item is Finding => Boolean(item));

			const anomalies: Anomaly[] = [];
			const [directions] = await conn.query<mysql.RowDataPacket[]>(
				"SELECT direction, COUNT(*) AS total FROM inventory_ledger GROUP BY direction",
			);
			for (const row of directions) {
				if (!["IN", "OUT"].includes(String(row.direction))) {
					anomalies.push({
						check: "inventory",
						subject: `direction=${String(row.direction)}`,
						detail: `${num(row.total)} bút toán có chiều không hợp lệ (chỉ chấp nhận IN/OUT)`,
					});
				}
			}

			return { scanned: rows.length, findings, anomalies, notes: [] };
		});

		// ---------------------------------------------------------------------
		// 2. Công nợ nhà cung cấp theo chứng từ
		// ---------------------------------------------------------------------
		await runSection("2. Công nợ NCC: purchase_documents(documentStatus=POSTED) vs payable_transactions", async () => {
			const [rows] = await conn.query<mysql.RowDataPacket[]>(
				`
				SELECT
					pd.id,
					pd.code,
					pd.supplierId,
					COALESCE(pd.totalAmount, 0) AS totalAmount,
					COALESCE(pd.paidAmount, 0) AS paidAmount,
					COALESCE(l.ledgerAmount, 0) AS ledgerAmount,
					COALESCE(l.entries, 0) AS entries
				FROM purchase_documents pd
				LEFT JOIN (
					SELECT sourceId, SUM(amount) AS ledgerAmount, COUNT(*) AS entries
					FROM payable_transactions
					GROUP BY sourceId
				) l ON l.sourceId = pd.id
				WHERE COALESCE(pd.documentStatus, 'POSTED') = 'POSTED' AND pd.deletedAt IS NULL
				ORDER BY pd.id
				`,
			);

			const findings: Finding[] = [];
			const anomalies: Anomaly[] = [];
			let missingLedger = 0;
			for (const row of rows) {
				const expected = num(row.totalAmount) - num(row.paidAmount);
				const actual = num(row.ledgerAmount);
				if (num(row.entries) === 0) {
					if (Math.abs(expected) > THRESHOLD) {
						missingLedger += 1;
						anomalies.push({
							check: "payable",
							subject: labels.purchase(row.id, row.code),
							detail: `chưa có bút toán công nợ; chứng từ còn phải trả ${fmt(expected)} (thường do luồng cũ server.ts)`,
						});
					}
					continue;
				}
				const finding = makeFinding("payable", labels.purchase(row.id, row.code), expected, actual);
				if (finding) findings.push(finding);
			}
			return {
				scanned: rows.length,
				findings,
				anomalies,
				notes: [
					"actual = SUM(payable_transactions.amount); expected = totalAmount - paidAmount",
					...(missingLedger ? [`${missingLedger} chứng từ POSTED chưa có bút toán công nợ`] : []),
				],
			};
		});

		// ---------------------------------------------------------------------
		// 3. Bút toán công nợ trỏ tới chứng từ không còn POSTED
		// ---------------------------------------------------------------------
		await runSection("3. payable_transactions còn số dư cho chứng từ không còn POSTED", async () => {
			const [rows] = await conn.query<mysql.RowDataPacket[]>(
				`
				SELECT l.sourceId, SUM(l.amount) AS ledgerAmount, COUNT(*) AS entries
				FROM payable_transactions l
				LEFT JOIN purchase_documents pd ON pd.id = l.sourceId
				WHERE pd.id IS NULL
					OR COALESCE(pd.documentStatus, 'POSTED') <> 'POSTED'
					OR pd.deletedAt IS NOT NULL
				GROUP BY l.sourceId
				HAVING ABS(SUM(l.amount)) > ?
				ORDER BY ABS(SUM(l.amount)) DESC
				`,
				[THRESHOLD],
			);

			const anomalies = rows.map(row => ({
				check: "payable",
				subject: `purchase#${num(row.sourceId)}`,
				detail: `${num(row.entries)} bút toán còn số dư ${fmt(num(row.ledgerAmount))} nhưng chứng từ không tồn tại/không POSTED/đã xoá`,
			}));
			const [totals] = await conn.query<mysql.RowDataPacket[]>(
				"SELECT COUNT(DISTINCT sourceId) AS total FROM payable_transactions",
			);

			return { scanned: num(totals[0]?.total), findings: [], anomalies, notes: [] };
		});

		// ---------------------------------------------------------------------
		// 4. Tổng công nợ NCC theo nhà cung cấp
		// ---------------------------------------------------------------------
		await runSection("4. Tổng công nợ NCC theo supplier: sổ cái vs chứng từ", async () => {
			const [rows] = await conn.query<mysql.RowDataPacket[]>(
				`
				SELECT * FROM (
					SELECT
						s.id,
						s.code,
						s.name,
						COALESCE(l.ledgerOutstanding, 0) AS ledgerOutstanding,
						COALESCE(d.documentOutstanding, 0) AS documentOutstanding
					FROM suppliers s
					LEFT JOIN (
						SELECT supplierId, SUM(amount) AS ledgerOutstanding
						FROM payable_transactions
						GROUP BY supplierId
					) l ON l.supplierId = s.id
					LEFT JOIN (
						SELECT supplierId, SUM(COALESCE(totalAmount,0) - COALESCE(paidAmount,0)) AS documentOutstanding
						FROM purchase_documents
						WHERE COALESCE(documentStatus, 'POSTED') = 'POSTED' AND deletedAt IS NULL
						GROUP BY supplierId
					) d ON d.supplierId = s.id
				) t
				WHERE ABS(t.ledgerOutstanding - t.documentOutstanding) > ?
				ORDER BY ABS(t.ledgerOutstanding - t.documentOutstanding) DESC
				`,
				[THRESHOLD],
			);

			const findings = rows
				.map(row =>
					makeFinding(
						"payable",
						labels.supplier(row.id, row.code),
						num(row.documentOutstanding),
						num(row.ledgerOutstanding),
					),
				)
				.filter((item): item is Finding => Boolean(item));

			const [totals] = await conn.query<mysql.RowDataPacket[]>(
				"SELECT COUNT(*) AS total FROM suppliers",
			);

			return {
				scanned: num(totals[0]?.total),
				findings,
				anomalies: [],
				notes: [
					"expected = tổng (totalAmount - paidAmount) của chứng từ POSTED; actual = tổng payable_transactions",
					"chênh lệch thường gặp khi chứng từ được tạo bởi luồng cũ chưa ghi sổ kép",
				],
			};
		});

		// ---------------------------------------------------------------------
		// 5. supplier_payments vs purchase_documents.paidAmount
		// ---------------------------------------------------------------------
		await runSection("5. Thanh toán NCC: supplier_payments vs purchase_documents.paidAmount", async () => {
			const [rows] = await conn.query<mysql.RowDataPacket[]>(
				`
				SELECT
					pd.id,
					pd.code,
					COALESCE(pd.paidAmount, 0) AS paidAmount,
					COALESCE(p.amount, 0) AS paymentTotal,
					COALESCE(p.entries, 0) AS entries
				FROM purchase_documents pd
				LEFT JOIN (
					SELECT purchaseDocumentId, SUM(amount) AS amount, COUNT(*) AS entries
					FROM supplier_payments
					GROUP BY purchaseDocumentId
				) p ON p.purchaseDocumentId = pd.id
				WHERE COALESCE(pd.documentStatus, 'POSTED') = 'POSTED' AND pd.deletedAt IS NULL
				ORDER BY pd.id
				`,
			);

			const findings = rows
				.map(row =>
					makeFinding(
						"payable-payment",
						labels.purchase(row.id, row.code),
						num(row.paidAmount),
						num(row.paymentTotal),
					),
				)
				.filter((item): item is Finding => Boolean(item));

			return { scanned: rows.length, findings, anomalies: [], notes: [] };
		});

		// ---------------------------------------------------------------------
		// 6. Phiếu chi: header vs allocations
		// ---------------------------------------------------------------------
		await runSection("6. Phiếu chi: payment_vouchers vs payment_voucher_allocations", async () => {
			const [rows] = await conn.query<mysql.RowDataPacket[]>(
				`
				SELECT
					v.id,
					v.code,
					v.direction,
					COALESCE(v.amount, 0) AS amount,
					COALESCE(a.amount, 0) AS allocTotal
				FROM payment_vouchers v
				LEFT JOIN (
					SELECT paymentVoucherId, SUM(amount) AS amount
					FROM payment_voucher_allocations
					GROUP BY paymentVoucherId
				) a ON a.paymentVoucherId = v.id
				WHERE v.status IN ('POSTED', 'CANCELLED')
				ORDER BY v.id
				`,
			);

			const findings = rows
				.map(row => {
					const expected = String(row.direction) === "REVERSAL" ? -num(row.amount) : num(row.amount);
					return makeFinding(
						"voucher",
						labels.voucher(row.id, row.code),
						expected,
						num(row.allocTotal),
					);
				})
				.filter((item): item is Finding => Boolean(item));

			return {
				scanned: rows.length,
				findings,
				anomalies: [],
				notes: ["phiếu REVERSAL có tổng phân bổ âm theo thiết kế"],
			};
		});

		// ---------------------------------------------------------------------
		// 7. Công nợ khách hàng theo đơn
		// ---------------------------------------------------------------------
		await runSection("7. Công nợ KH: sales_orders(status=FULFILLED) vs receivable_transactions", async () => {
			const [rows] = await conn.query<mysql.RowDataPacket[]>(
				`
				SELECT
					so.id,
					so.code,
					COALESCE(so.totalAmount, 0) AS totalAmount,
					COALESCE(so.paidAmount, 0) AS paidAmount,
					COALESCE(l.ledgerAmount, 0) AS ledgerAmount,
					COALESCE(l.entries, 0) AS entries
				FROM sales_orders so
				LEFT JOIN (
					SELECT sourceId, SUM(amount) AS ledgerAmount, COUNT(*) AS entries
					FROM receivable_transactions
					GROUP BY sourceId
				) l ON l.sourceId = so.id
				WHERE so.status = 'FULFILLED'
				ORDER BY so.id
				`,
			);

			const findings: Finding[] = [];
			const anomalies: Anomaly[] = [];
			let missingLedger = 0;
			for (const row of rows) {
				const expected = num(row.totalAmount) - num(row.paidAmount);
				const actual = num(row.ledgerAmount);
				if (num(row.entries) === 0) {
					if (Math.abs(expected) > THRESHOLD) {
						missingLedger += 1;
						anomalies.push({
							check: "receivable",
							subject: labels.sales(row.id, row.code),
							detail: `chưa có bút toán công nợ; đơn còn phải thu ${fmt(expected)} (thường do luồng cũ server.ts)`,
						});
					}
					continue;
				}
				const finding = makeFinding("receivable", labels.sales(row.id, row.code), expected, actual);
				if (finding) findings.push(finding);
			}
			return {
				scanned: rows.length,
				findings,
				anomalies,
				notes: [
					"actual = SUM(receivable_transactions.amount); expected = totalAmount - paidAmount",
					...(missingLedger ? [`${missingLedger} đơn FULFILLED chưa có bút toán công nợ`] : []),
				],
			};
		});

		// ---------------------------------------------------------------------
		// 8. Bút toán công nợ trỏ tới đơn không còn FULFILLED
		// ---------------------------------------------------------------------
		await runSection("8. receivable_transactions còn số dư cho đơn không còn FULFILLED", async () => {
			const [rows] = await conn.query<mysql.RowDataPacket[]>(
				`
				SELECT l.sourceId, SUM(l.amount) AS ledgerAmount, COUNT(*) AS entries
				FROM receivable_transactions l
				LEFT JOIN sales_orders so ON so.id = l.sourceId
				WHERE so.id IS NULL OR so.status <> 'FULFILLED'
				GROUP BY l.sourceId
				HAVING ABS(SUM(l.amount)) > ?
				ORDER BY ABS(SUM(l.amount)) DESC
				`,
				[THRESHOLD],
			);

			const anomalies = rows.map(row => ({
				check: "receivable",
				subject: `sales#${num(row.sourceId)}`,
				detail: `${num(row.entries)} bút toán còn số dư ${fmt(num(row.ledgerAmount))} nhưng đơn không tồn tại/không FULFILLED`,
			}));
			const [totals] = await conn.query<mysql.RowDataPacket[]>(
				"SELECT COUNT(DISTINCT sourceId) AS total FROM receivable_transactions",
			);

			return { scanned: num(totals[0]?.total), findings: [], anomalies, notes: [] };
		});

		// ---------------------------------------------------------------------
		// 9. Tổng công nợ KH theo khách hàng
		// ---------------------------------------------------------------------
		await runSection("9. Tổng công nợ KH theo customer: sổ cái vs đơn hàng", async () => {
			const [rows] = await conn.query<mysql.RowDataPacket[]>(
				`
				SELECT * FROM (
					SELECT
						c.id,
						c.code,
						c.name,
						COALESCE(l.ledgerOutstanding, 0) AS ledgerOutstanding,
						COALESCE(d.documentOutstanding, 0) AS documentOutstanding
					FROM customers c
					LEFT JOIN (
						SELECT customerId, SUM(amount) AS ledgerOutstanding
						FROM receivable_transactions
						GROUP BY customerId
					) l ON l.customerId = c.id
					LEFT JOIN (
						SELECT customerId, SUM(COALESCE(totalAmount,0) - COALESCE(paidAmount,0)) AS documentOutstanding
						FROM sales_orders
						WHERE status = 'FULFILLED'
						GROUP BY customerId
					) d ON d.customerId = c.id
				) t
				WHERE ABS(t.ledgerOutstanding - t.documentOutstanding) > ?
				ORDER BY ABS(t.ledgerOutstanding - t.documentOutstanding) DESC
				`,
				[THRESHOLD],
			);

			const findings = rows
				.map(row =>
					makeFinding(
						"receivable",
						labels.customer(row.id, row.code),
						num(row.documentOutstanding),
						num(row.ledgerOutstanding),
					),
				)
				.filter((item): item is Finding => Boolean(item));
			const [totals] = await conn.query<mysql.RowDataPacket[]>(
				"SELECT COUNT(*) AS total FROM customers",
			);

			return { scanned: num(totals[0]?.total), findings, anomalies: [], notes: [] };
		});

		// ---------------------------------------------------------------------
		// 10. customer_payments + credit vs sales_orders.paidAmount
		// ---------------------------------------------------------------------
		await runSection("10. Thanh toán KH: customer_payments + credit vs sales_orders.paidAmount", async () => {
			const [rows] = await conn.query<mysql.RowDataPacket[]>(
				`
				SELECT
					so.id,
					so.code,
					COALESCE(so.paidAmount, 0) AS paidAmount,
					COALESCE(p.amount, 0) AS paymentTotal,
					COALESCE(c.creditApplied, 0) AS creditApplied
				FROM sales_orders so
				LEFT JOIN (
					SELECT salesOrderId, SUM(amount) AS amount
					FROM customer_payments
					GROUP BY salesOrderId
				) p ON p.salesOrderId = so.id
				LEFT JOIN (
					SELECT
						sourceId,
						SUM(CASE WHEN entryType IN ('CREDIT_IN', 'CREDIT_IN_REVERSAL') THEN -amount ELSE 0 END) AS creditApplied
					FROM receivable_transactions
					GROUP BY sourceId
				) c ON c.sourceId = so.id
				WHERE so.status = 'FULFILLED'
				ORDER BY so.id
				`,
			);

			const findings = rows
				.map(row =>
					makeFinding(
						"receivable-payment",
						labels.sales(row.id, row.code),
						num(row.paymentTotal) + num(row.creditApplied),
						num(row.paidAmount),
					),
				)
				.filter((item): item is Finding => Boolean(item));

			return {
				scanned: rows.length,
				findings,
				anomalies: [],
				notes: ["expected = SUM(customer_payments.amount) + credit đã áp dụng từ đơn khác"],
			};
		});

		// ---------------------------------------------------------------------
		// 11. Phiếu thu: header vs allocations
		// ---------------------------------------------------------------------
		await runSection("11. Phiếu thu: payment_receipts vs payment_receipt_allocations", async () => {
			const [rows] = await conn.query<mysql.RowDataPacket[]>(
				`
				SELECT
					r.id,
					r.code,
					r.direction,
					COALESCE(r.amount, 0) AS amount,
					COALESCE(a.amount, 0) AS allocTotal
				FROM payment_receipts r
				LEFT JOIN (
					SELECT paymentReceiptId, SUM(amount) AS amount
					FROM payment_receipt_allocations
					GROUP BY paymentReceiptId
				) a ON a.paymentReceiptId = r.id
				WHERE r.status IN ('POSTED', 'CANCELLED')
				ORDER BY r.id
				`,
			);

			const findings = rows
				.map(row => {
					const expected = String(row.direction) === "REVERSAL" ? -num(row.amount) : num(row.amount);
					return makeFinding(
						"receipt",
						labels.receipt(row.id, row.code),
						expected,
						num(row.allocTotal),
					);
				})
				.filter((item): item is Finding => Boolean(item));

			return {
				scanned: rows.length,
				findings,
				anomalies: [],
				notes: ["phiếu REVERSAL có tổng phân bổ âm theo thiết kế"],
			};
		});

		// ---------------------------------------------------------------------
		// 12. Toán học chứng từ mua
		// ---------------------------------------------------------------------
		await runSection("12. Chứng từ mua: header vs tổng dòng chi tiết", async () => {
			const [rows] = await conn.query<mysql.RowDataPacket[]>(
				`
				SELECT
					pd.id,
					pd.code,
					COALESCE(pd.goodsAmount, 0) AS goodsAmount,
					COALESCE(pd.taxAmount, 0) AS taxAmount,
					COALESCE(pd.purchaseCost, 0) AS purchaseCost,
					COALESCE(pd.totalAmount, 0) AS totalAmount,
					COALESCE(d.lineGoods, 0) AS lineGoods,
					COALESCE(d.lineTax, 0) AS lineTax,
					COALESCE(d.lineCount, 0) AS lineCount
				FROM purchase_documents pd
				LEFT JOIN (
					SELECT
						documentId,
						SUM(COALESCE(lineAmount, 0)) AS lineGoods,
						SUM(COALESCE(taxAmount, 0)) AS lineTax,
						COUNT(*) AS lineCount
					FROM purchase_document_details
					GROUP BY documentId
				) d ON d.documentId = pd.id
				WHERE COALESCE(pd.documentStatus, 'POSTED') IN ('POSTED', 'DRAFT') AND pd.deletedAt IS NULL
				ORDER BY pd.id
				`,
			);

			const findings: Finding[] = [];
			for (const row of rows) {
				if (num(row.lineCount) === 0) continue;
				const push = (check: string, expected: number, actual: number) => {
					const finding = makeFinding(check, labels.purchase(row.id, row.code), expected, actual);
					if (finding) findings.push(finding);
				};
				push("purchase-math-goods", num(row.goodsAmount), num(row.lineGoods));
				push("purchase-math-tax", num(row.taxAmount), num(row.lineTax));
				push(
					"purchase-math-total",
					num(row.goodsAmount) + num(row.taxAmount) + num(row.purchaseCost),
					num(row.totalAmount),
				);
			}

			return {
				scanned: rows.length,
				findings,
				anomalies: [],
				notes: ["expected total = goodsAmount + taxAmount + purchaseCost"],
			};
		});

		// ---------------------------------------------------------------------
		// 13. Toán học chứng từ bán
		// ---------------------------------------------------------------------
		await runSection("13. Đơn bán: header vs tổng dòng chi tiết", async () => {
			const [rows] = await conn.query<mysql.RowDataPacket[]>(
				`
				SELECT
					so.id,
					so.code,
					COALESCE(so.subtotal, 0) AS subtotal,
					COALESCE(so.discountAmount, 0) AS discountAmount,
					COALESCE(so.taxAmount, 0) AS taxAmount,
					COALESCE(so.totalAmount, 0) AS totalAmount,
					COALESCE(d.lineSubtotal, 0) AS lineSubtotal,
					COALESCE(d.gross, 0) AS gross,
					COALESCE(d.lineCount, 0) AS lineCount
				FROM sales_orders so
				LEFT JOIN (
					SELECT
						orderId,
						SUM(COALESCE(lineTotal, 0)) AS lineSubtotal,
						SUM(COALESCE(quantity, 0) * COALESCE(unitPrice, 0)) AS gross,
						COUNT(*) AS lineCount
					FROM sales_order_details
					GROUP BY orderId
				) d ON d.orderId = so.id
				WHERE so.deletedAt IS NULL
				ORDER BY so.id
				`,
			);

			const findings: Finding[] = [];
			for (const row of rows) {
				if (num(row.lineCount) === 0) continue;
				const push = (check: string, expected: number, actual: number) => {
					const finding = makeFinding(check, labels.sales(row.id, row.code), expected, actual);
					if (finding) findings.push(finding);
				};
				push("sales-math-subtotal", num(row.lineSubtotal), num(row.subtotal));
				push(
					"sales-math-total",
					num(row.gross) - num(row.discountAmount) + num(row.taxAmount),
					num(row.totalAmount),
				);
			}

			return {
				scanned: rows.length,
				findings,
				anomalies: [],
				notes: ["expected total = gross - discountAmount + taxAmount"],
			};
		});

		// ---------------------------------------------------------------------
		// Tổng hợp
		// ---------------------------------------------------------------------
		const allFindings = sections.flatMap(section => section.findings);
		const allAnomalies = sections.flatMap(section => section.anomalies);
		const failedSections = sections.filter(
			section => section.findings.length || section.anomalies.length,
		);

		console.log("\n================ TỔNG HỢP ================");
		for (const section of sections) {
			const total = section.findings.length + section.anomalies.length;
			console.log(
				`${total ? "✗" : "✓"} ${section.title}: ${section.findings.length} lệch, ${section.anomalies.length} bất thường`,
			);

			if (section.findings.length) {
				console.log(`  Sai lệch số học (tối đa ${LIMIT}):`);
				for (const finding of section.findings.slice(0, LIMIT)) {
					console.log(
						`    - ${finding.subject} [${finding.check}] expected=${fmt(finding.expected)} actual=${fmt(finding.actual)} lệch=${fmt(finding.diff)}`,
					);
				}
				if (section.findings.length > LIMIT)
					console.log(`    ... và ${section.findings.length - LIMIT} dòng khác`);
			}

			if (section.anomalies.length) {
				console.log(`  Bất thường cấu trúc (tối đa ${LIMIT}):`);
				for (const anomaly of section.anomalies.slice(0, LIMIT)) {
					console.log(`    - ${anomaly.subject} [${anomaly.check}] ${anomaly.detail}`);
				}
				if (section.anomalies.length > LIMIT)
					console.log(`    ... và ${section.anomalies.length - LIMIT} dòng khác`);
			}
		}

		console.log("\n-----------------------------------------");
		console.log(
			`Kết luận: ${failedSections.length}/${sections.length} nhóm có vấn đề — ` +
			`${allFindings.length} sai lệch số học, ${allAnomalies.length} bất thường cấu trúc.`,
		);

		if (OUT) {
			const report = {
				generatedAt: new Date().toISOString(),
				database: `${USER}@${HOST}:${PORT}/${DATABASE}`,
				threshold: THRESHOLD,
				sections: sections.map(section => ({
					title: section.title,
					scanned: section.scanned,
					notes: section.notes,
					findings: section.findings,
					anomalies: section.anomalies,
				})),
				summary: {
					sections: sections.length,
					sectionsWithIssues: failedSections.length,
					findings: allFindings.length,
					anomalies: allAnomalies.length,
				},
			};
			writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
			console.log(`Đã ghi báo cáo JSON: ${OUT}`);
		}

		process.exitCode = allFindings.length || allAnomalies.length ? 1 : 0;
	} finally {
		await conn.end();
	}
}

main().catch(error => {
	console.error("\nKhông chạy được đối soát:");
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 2;
});
