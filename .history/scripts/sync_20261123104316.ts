import "dotenv/config";
import mysql from "mysql2/promise";

const HOST = process.env.DB_HOST || process.env.HOST || "localhost";
const PORT = Number(process.env.DB_PORT || 3306);
const USER = process.env.DB_USER || "root";
const PASSWORD = process.env.DB_PASS || "";
const DATABASE = process.env.DB_NAME || "warehouse_oms_v2";

const args = process.argv.slice(2);
const orderCodeArg = args.find(a => a.startsWith("--orderCode="));
const monthArg = args.find(a => a.startsWith("--month="));

const orderCode = orderCodeArg
	? orderCodeArg.slice("--orderCode=".length).trim()
	: "";
const month = monthArg ? monthArg.slice("--month=".length).trim() : "";

if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
	console.error(`Tháng không hợp lệ: ${month}. Định dạng đúng: YYYY-MM`);
	process.exit(1);
}

const filters = [];
const filterParams = [];

if (orderCode) {
	filters.push("po_match.code = ?");
	filterParams.push(orderCode);
}
if (month) {
	filters.push(
		"DATE_FORMAT(COALESCE(po_match.completedAt, po_match.createdAt), '%Y-%m') = ?",
	);
	filterParams.push(month);
}

const whereExtra = filters.length ? `AND ${filters.join(" AND ")}` : "";

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
		console.log(
			`Phạm vi: ${orderCode ? `mã lệnh ${orderCode}` : "tất cả lệnh"}${month ? ` · tháng ${month}` : ""}`,
		);

		const sqlAgg = `
			SELECT
				COALESCE(itd.productionOrderId, po_match.id) AS orderId,
				itd.packagingId AS packagingId,
				SUM(itd.quantity) AS issuedQty,
				SUM(COALESCE(itd.totalValue, itd.quantity * itd.unitCost, 0)) AS issuedValue
			FROM inventorytransactiondetails itd
			JOIN inventorytransactions it ON it.id = itd.transactionId
			LEFT JOIN productionorders po_match
				ON (itd.productionOrderId = po_match.id OR itd.batchNumber = po_match.code)
			WHERE it.type = 'EXPORT'
				AND it.documentStatus = 'POSTED'
				AND it.cancelledAt IS NULL
				AND COALESCE(itd.productionOrderId, po_match.id) IS NOT NULL
				${whereExtra}
			GROUP BY COALESCE(itd.productionOrderId, po_match.id), itd.packagingId
		`;

		await conn.beginTransaction();
		try {
			const [updateRes] = await conn.query(
				`
				UPDATE production_order_materials_v1 pom
				JOIN (${sqlAgg}) exp
					ON exp.orderId = pom.orderId AND exp.packagingId = pom.packagingId
				SET
					pom.actualQuantity = exp.issuedQty,
					pom.unitCost = CASE WHEN exp.issuedQty > 0 THEN ROUND(exp.issuedValue / exp.issuedQty, 4) ELSE 0 END,
					pom.totalValue = ROUND(exp.issuedValue, 2)
				WHERE pom.totalValue = 0 OR pom.actualQuantity = 0
				`,
				filterParams,
			);

			const [insertRes] = await conn.query(
				`
				INSERT INTO production_order_materials_v1 (
					orderId,
					packagingId,
					plannedQuantity,
					actualQuantity,
					unitCost,
					totalValue,
					createdAt,
					unit
				)
				SELECT
					exp.orderId,
					exp.packagingId,
					0 AS plannedQuantity,
					exp.issuedQty AS actualQuantity,
					CASE WHEN exp.issuedQty > 0 THEN ROUND(exp.issuedValue / exp.issuedQty, 4) ELSE 0 END AS unitCost,
					ROUND(exp.issuedValue, 2) AS totalValue,
					DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS createdAt,
					COALESCE(pp.unit, 'g') AS unit
				FROM (${sqlAgg}) exp
				JOIN productpackagings pp ON pp.id = exp.packagingId
				LEFT JOIN production_order_materials_v1 existing
					ON existing.orderId = exp.orderId AND existing.packagingId = exp.packagingId
				WHERE existing.id IS NULL
				`,
				filterParams,
			);

			await conn.commit();
			console.log(
				`Đã cập nhật ${updateRes.affectedRows ?? 0} dòng định mức hiện có.`,
			);
			console.log(
				`Đã bổ sung ${insertRes.affectedRows ?? 0} dòng NVL xuất thực tế còn thiếu.`,
			);
		} catch (err) {
			await conn.rollback();
			throw err;
		}
	} finally {
		await conn.end();
	}
}

main().catch(err => {
	console.error(err);
	process.exitCode = 1;
});
