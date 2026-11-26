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

function buildWhereClause(alias: string): { clause: string; params: string[] } {
	const filters: string[] = [];
	const params: string[] = [];

	if (orderCode) {
		filters.push(`${alias}.code = ?`);
		params.push(orderCode);
	}

	if (month) {
		filters.push(
			`DATE_FORMAT(COALESCE(${alias}.completedAt, ${alias}.createdAt), '%Y-%m') = ?`,
		);
		params.push(month);
	}

	return {
		clause: filters.length ? `AND ${filters.join(" AND ")}` : "",
		params,
	};
}

function buildAggSql(alias = "po_sub"): { sql: string; params: string[] } {
	const { clause, params } = buildWhereClause(alias);
	const sql = `
		SELECT
			${alias}.id AS orderId,
			itd.packagingId AS packagingId,
			SUM(itd.quantity) AS issuedQty,
			SUM(COALESCE(itd.totalValue, itd.quantity * itd.unitCost, 0)) AS issuedValue
		FROM inventorytransactiondetails itd
		JOIN inventorytransactions it ON it.id = itd.transactionId
		JOIN productionorders ${alias} ON (
			itd.productionOrderId = ${alias}.id
			OR itd.batchNumber = ${alias}.code
			OR (
				(itd.productionOrderId IS NULL AND (itd.batchNumber IS NULL OR itd.batchNumber = ''))
				AND (
					it.note LIKE CONCAT('%', ${alias}.code, '%')
					OR it.reason LIKE CONCAT('%', ${alias}.code, '%')
				)
			)
		)
		WHERE it.type = 'EXPORT'
			AND it.documentStatus = 'POSTED'
			AND it.cancelledAt IS NULL
			${clause}
		GROUP BY ${alias}.id, itd.packagingId
	`;
	return { sql, params };
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
		console.log(
			`Phạm vi: ${orderCode ? `mã lệnh ${orderCode}` : "tất cả lệnh"}${
				month ? ` · tháng ${month}` : ""
			}`,
		);

		await conn.beginTransaction();
		try {
			const aggUpdate = buildAggSql("po_sub");
			const [updateRes] = await conn.query<mysql.ResultSetHeader>(
				`
				UPDATE production_order_materials_v1 pom
				JOIN (${aggUpdate.sql}) exp
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
				aggUpdate.params,
			);

			const aggInsert = buildAggSql("po_sub");
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
				FROM (${aggInsert.sql}) exp
				JOIN productpackagings pp ON pp.id = exp.packagingId
				LEFT JOIN production_order_materials_v1 existing
					ON existing.orderId = exp.orderId AND existing.packagingId = exp.packagingId
				WHERE existing.id IS NULL
				`,
				aggInsert.params,
			);

			const aggSyncUnit = buildAggSql("po_sub");
			const outerWhere = buildWhereClause("po_outer");
			const [syncOtherUnitsRes] = await conn.query<mysql.ResultSetHeader>(
				`
				UPDATE production_order_materials_v1 pom
				JOIN productionorders po_outer ON po_outer.id = pom.orderId
				JOIN (${aggSyncUnit.sql}) exp ON exp.packagingId = pom.packagingId
				SET pom.unit = 'kg'
				WHERE pom.unit = 'g'
					AND ROUND(pom.totalValue, 2) > 0
					AND ROUND(pom.totalValue, 2) = ROUND(exp.issuedValue, 2)
					${outerWhere.clause}
				`,
				[...aggSyncUnit.params, ...outerWhere.params],
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
