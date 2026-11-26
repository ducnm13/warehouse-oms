import "dotenv/config";
import mysql from "mysql2/promise";

const HOST = process.env.DB_HOST || process.env.HOST || "localhost";
const PORT = Number(process.env.DB_PORT || 3306);
const USER = process.env.DB_USER || "root";
const PASSWORD = process.env.DB_PASS || "";
const DATABASE = process.env.DB_NAME || "warehouse_oms_v2";

const args = process.argv.slice(2);
const orderCodeArg = args.find(arg => arg.startsWith("--orderCode="));
const monthArg = args.find(arg => arg.startsWith("--month="));

const orderCode = orderCodeArg
	? orderCodeArg.slice("--orderCode=".length).trim()
	: "";
const month = monthArg ? monthArg.slice("--month=".length).trim() : "";

if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
	console.error(`Tháng không hợp lệ: ${month}. Định dạng đúng: YYYY-MM`);
	process.exit(1);
}

const filters: string[] = [];
const filterParams: string[] = [];

if (orderCode) {
	filters.push("po.code = ?");
	filterParams.push(orderCode);
}

if (month) {
	filters.push(
		"DATE_FORMAT(COALESCE(po.completedAt, po.createdAt), '%Y-%m') = ?",
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
			`Phạm vi: ${orderCode ? `mã lệnh ${orderCode}` : "tất cả lệnh"}${
				month ? ` · tháng ${month}` : ""
			}`,
		);

		const sqlAgg = `
			SELECT
				po.id AS orderId,
				itd.packagingId AS packagingId,
				SUM(itd.quantity) AS issuedQty,
				SUM(COALESCE(itd.totalValue, itd.quantity * itd.unitCost, 0)) AS issuedValue
			FROM inventorytransactiondetails itd
			JOIN inventorytransactions it ON it.id = itd.transactionId
			JOIN productionorders po ON (
				itd.productionOrderId = po.id
				OR itd.batchNumber = po.code
				OR (
					(itd.productionOrderId IS NULL AND (itd.batchNumber IS NULL OR itd.batchNumber = ''))
					AND (
						it.note LIKE CONCAT('%', po.code, '%')
						OR it.reason LIKE CONCAT('%', po.code, '%')
					)
				)
			)
			WHERE it.type = 'EXPORT'
				AND it.documentStatus = 'POSTED'
				AND it.cancelledAt IS NULL
				${whereExtra}
			GROUP BY po.id, itd.packagingId
		`;

		await conn.beginTransaction();
		try {
			// Cập nhật các dòng định mức đã có (đồng bộ cả các dòng đang bị totalValue = 0 hoặc unit = 'g' khớp với phiếu xuất)
			const [updateRes] = await conn.query<mysql.ResultSetHeader>(
				`
				UPDATE production_order_materials_v1 pom
				JOIN (${sqlAgg}) exp
					ON exp.orderId = pom.orderId AND exp.packagingId = pom.packagingId
				SET
					pom.actualQuantity = exp.issuedQty,
					pom.unitCost = CASE
						WHEN exp.issuedQty > 0 THEN ROUND(exp.issuedValue / exp.issuedQty, 4)
						ELSE 0
					END,
					pom.totalValue = ROUND(exp.issuedValue, 2),
					pom.unit = 'kg'
				WHERE pom.totalValue = 0
					OR pom.actualQuantity = 0
					OR (pom.unit = 'g' AND ROUND(pom.totalValue, 2) = ROUND(exp.issuedValue, 2))
				`,
				filterParams,
			);

			// Bổ sung các dòng NVL xuất thực tế còn thiếu với đơn vị chuẩn 'kg'
			const [insertRes] = await conn.query<mysql.ResultSetHeader>(
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
					CASE
						WHEN exp.issuedQty > 0 THEN ROUND(exp.issuedValue / exp.issuedQty, 4)
						ELSE 0
					END AS unitCost,
					ROUND(exp.issuedValue, 2) AS totalValue,
					DATE_FORMAT(NOW(), '%Y-%m-%d %H:%i:%s') AS createdAt,
					'kg' AS unit
				FROM (${sqlAgg}) exp
				JOIN productpackagings pp ON pp.id = exp.packagingId
				LEFT JOIN production_order_materials_v1 existing
					ON existing.orderId = exp.orderId AND existing.packagingId = exp.packagingId
				WHERE existing.id IS NULL
				`,
				filterParams,
			);

			// Đồng bộ thêm các dòng định mức cùng packagingId trên các lệnh khác nếu đang bị 'g' và có tổng tiền khớp
			const [syncOtherUnitsRes] = await conn.query<mysql.ResultSetHeader>(
				`
				UPDATE production_order_materials_v1 pom
				JOIN productionorders po ON po.id = pom.orderId
				JOIN (${sqlAgg}) exp ON exp.packagingId = pom.packagingId
				SET pom.unit = 'kg'
				WHERE pom.unit = 'g'
					AND ROUND(pom.totalValue, 2) > 0
					AND ROUND(pom.totalValue, 2) = ROUND(exp.issuedValue, 2)
					${whereExtra}
				`,
				filterParams,
			);

			await conn.commit();
			console.log(
				`Đã cập nhật ${updateRes.affectedRows ?? 0} dòng định mức từ phiếu xuất (unit = 'kg').`,
			);
			console.log(
				`Đã bổ sung ${insertRes.affectedRows ?? 0} dòng NVL xuất thực tế còn thiếu (unit = 'kg').`,
			);
			console.log(
				`Đã chuẩn hóa đơn vị 'kg' cho ${syncOtherUnitsRes.affectedRows ?? 0} dòng định mức liên quan.`,
			);
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
