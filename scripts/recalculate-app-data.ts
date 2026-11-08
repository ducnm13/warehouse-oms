import "dotenv/config";
import mysql from "mysql2/promise";

const HOST = process.env.DB_HOST || process.env.HOST || "localhost";
const PORT = Number(process.env.DB_PORT || 3306);
const USER = process.env.DB_USER || "root";
const PASSWORD = process.env.DB_PASS || "";
const DATABASE = process.env.DB_NAME || "warehouse_oms_v2";

const args = process.argv.slice(2);
const monthArg = args.find(arg => arg.startsWith("--month="));
const ALL = args.includes("--all");
const CONFIRM = args.includes("--yes") || process.env.CONFIRM_RECALC === "YES";
const now = new Date();
const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const MONTH = monthArg ? monthArg.slice("--month=".length) : currentMonth;

if (!ALL && !/^\d{4}-(0[1-9]|1[0-2])$/.test(MONTH)) {
	console.error(`Tháng không hợp lệ: ${MONTH}. Định dạng đúng: YYYY-MM`);
	process.exit(1);
}

const monthStart = ALL ? "1970-01-01" : `${MONTH}-01`;
const nextMonthStart = ALL ? "9999-12-31" : (() => {
	const [year, monthNumber] = MONTH.split("-").map(Number);
	return new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
})();

type StockRow = {
	packagingId: number;
	warehouseId: number;
	currentQuantity: number;
	baselineQuantity: number;
	beforeNet: number;
	monthNet: number;
	calculatedQuantity: number;
	difference: number;
};

const numberValue = (value: unknown) => Number(value || 0);
const round4 = (value: number) => Math.round(value * 10000) / 10000;

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
		console.log(ALL ? "Phạm vi: toàn bộ ledger" : `Phạm vi: tháng ${MONTH} (đến hết ${nextMonthStart})`);
		if (!ALL && MONTH !== currentMonth) {
			console.warn(
				`Cảnh báo: ${MONTH} không phải tháng hiện tại. Tồn kho sẽ được ghi theo số cuối tháng ${MONTH}.`,
			);
		}

		const [rawRows] = await conn.query<mysql.RowDataPacket[]>(
			`
			SELECT
				k.packagingId AS packagingId,
				k.warehouseId AS warehouseId,
				COALESCE(pw.stock_quantity, 0) AS currentQuantity,
				COALESCE(ob.quantity, 0) AS baselineQuantity,
				COALESCE(l.beforeNet, 0) AS beforeNet,
				COALESCE(l.monthNet, 0) AS monthNet
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
				SELECT packagingId, warehouseId,
					SUM(CASE WHEN occurredAt < ? THEN
						CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END
						ELSE 0 END) AS beforeNet,
					SUM(CASE WHEN occurredAt >= ? AND occurredAt < ? THEN
						CASE WHEN direction = 'IN' THEN quantity ELSE -quantity END
						ELSE 0 END) AS monthNet
				FROM inventory_ledger
				GROUP BY packagingId, warehouseId
			) l ON l.packagingId = k.packagingId AND l.warehouseId = k.warehouseId
			ORDER BY k.packagingId, k.warehouseId
			`,
			[monthStart, monthStart, nextMonthStart],
		);

		const rows: StockRow[] = rawRows.map(row => {
			const currentQuantity = numberValue(row.currentQuantity);
			const baselineQuantity = numberValue(row.baselineQuantity);
			const beforeNet = numberValue(row.beforeNet);
			const monthNet = numberValue(row.monthNet);
			const calculatedQuantity = round4(baselineQuantity + beforeNet + monthNet);
			return {
				packagingId: Number(row.packagingId),
				warehouseId: Number(row.warehouseId),
				currentQuantity,
				baselineQuantity,
				beforeNet,
				monthNet,
				calculatedQuantity,
				difference: round4(calculatedQuantity - currentQuantity),
			};
		});

		const changed = rows.filter(row => Math.abs(row.difference) > 0.0001);
		const totalOpening = round4(rows.reduce((sum, row) => sum + row.baselineQuantity + row.beforeNet, 0));
		const totalMonthNet = round4(rows.reduce((sum, row) => sum + row.monthNet, 0));
		const totalClosing = round4(rows.reduce((sum, row) => sum + row.calculatedQuantity, 0));

		console.log(`\nSố dòng tồn kho: ${rows.length}`);
		console.log(`Tồn đầu kỳ: ${totalOpening}`);
		console.log(`Phát sinh trong kỳ: ${totalMonthNet}`);
		console.log(`Tồn cuối tính lại: ${totalClosing}`);
		console.log(`Số dòng lệch: ${changed.length}`);

		if (changed.length) {
			console.log("\nCác dòng lệch (tối đa 30):");
			for (const row of changed.slice(0, 30)) {
				console.log(
					`  packagingId=${row.packagingId} warehouseId=${row.warehouseId} ` +
					`hiện tại=${row.currentQuantity} tính lại=${row.calculatedQuantity} lệch=${row.difference}`,
				);
			}
			if (changed.length > 30) console.log(`  ... và ${changed.length - 30} dòng khác`);
		}

		if (!CONFIRM) {
			console.log("\nChưa ghi dữ liệu. Chạy lại với --yes để cập nhật tồn kho và công nợ.");
			return;
		}

		await conn.beginTransaction();
		try {
			// Đảm bảo mọi cặp hàng hóa/kho có phát sinh ledger đều có dòng tồn kho.
			await conn.query(`
				INSERT IGNORE INTO productwarehouses (packagingId, warehouseId, stock_quantity, updatedAt)
				SELECT DISTINCT packagingId, warehouseId, 0, DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')
				FROM inventory_ledger
			`);
			await conn.query("DROP TEMPORARY TABLE IF EXISTS _stock_recalculate");
			await conn.query(`
				CREATE TEMPORARY TABLE _stock_recalculate (
					packagingId INT NOT NULL,
					warehouseId INT NOT NULL,
					stock_quantity DECIMAL(18,4) NOT NULL,
					PRIMARY KEY (packagingId, warehouseId)
				)
			`);

			if (rows.length) {
				await conn.query(
					`INSERT INTO _stock_recalculate (packagingId, warehouseId, stock_quantity) VALUES ?`,
					[rows.map(row => [row.packagingId, row.warehouseId, row.calculatedQuantity])],
				);
			}

			const [stockResult] = await conn.query<mysql.ResultSetHeader>(`
				UPDATE productwarehouses pw
				JOIN _stock_recalculate r
					ON r.packagingId = pw.packagingId AND r.warehouseId = pw.warehouseId
				SET pw.stock_quantity = r.stock_quantity,
					pw.updatedAt = DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s')
			`);

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

			await conn.query("DROP TEMPORARY TABLE IF EXISTS _stock_recalculate");
			await conn.commit();
			console.log(`\nĐã cập nhật ${stockResult.affectedRows} dòng tồn kho và công nợ.`);
		} catch (error) {
			await conn.rollback();
			throw error;
		}
	} finally {
		await conn.end();
	}
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
