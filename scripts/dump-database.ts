import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const HOST = process.env.DB_HOST || process.env.HOST || "localhost";
const PORT = Number(process.env.DB_PORT || 3306);
const USER = process.env.DB_USER || "root";
const PASSWORD = process.env.DB_PASS || "";
const DATABASE = process.env.DB_NAME || "warehouse_oms_v2";
const OUT_DIR = process.env.DUMP_DIR || path.join(process.cwd(), "backups");

const timestamp = () => {
	const now = new Date();
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
};

const quoteIdentifier = (value: string) => `\`${value.replace(/`/g, "``")}\``;

const escapeString = (value: string) =>
	value
		.replace(/\\/g, "\\\\")
		.replace(/\0/g, "\\0")
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/'/g, "\\'")
		.replace(/\x1a/g, "\\Z");

const sqlValue = (value: any): string => {
	if (value === null || value === undefined) return "NULL";
	if (Buffer.isBuffer(value)) return `X'${value.toString("hex")}'`;
	if (typeof value === "bigint") return value.toString();
	if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
	if (typeof value === "boolean") return value ? "1" : "0";
	if (value instanceof Date) return `'${value.toISOString().replace("T", " ").replace("Z", "")}'`;
	if (typeof value === "object") return `'${escapeString(JSON.stringify(value))}'`;
	return `'${escapeString(String(value))}'`;
};

const BATCH_SIZE = 100;

async function main() {
	const fileName = `${DATABASE}_${timestamp()}.sql`;
	const filePath = path.join(OUT_DIR, fileName);
	await fs.mkdir(OUT_DIR, { recursive: true });

	const connection = await mysql.createConnection({
		host: HOST,
		port: PORT,
		user: USER,
		password: PASSWORD,
		database: DATABASE,
		dateStrings: true,
		charset: "utf8mb4",
	});

	let tableCount = 0;
	let rowCount = 0;
	try {
		const [objects] = await connection.query<any[]>(
			`SELECT TABLE_NAME AS name, TABLE_TYPE AS type
			 FROM information_schema.tables
			 WHERE TABLE_SCHEMA = ?
			 ORDER BY TABLE_NAME`,
			[DATABASE],
		);

		const header = [
			`-- Dump CSDL ${DATABASE}`,
			`-- Thời gian: ${new Date().toLocaleString("vi-VN")}`,
			`-- Nguồn: ${USER}@${HOST}:${PORT}`,
			"-- Khôi phục: mysql -u <user> -p <database> < file.sql",
			"",
			"SET NAMES utf8mb4;",
			"SET FOREIGN_KEY_CHECKS=0;",
			"SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';",
			"",
		].join("\n");
		await fs.writeFile(filePath, header, "utf8");

		for (const object of objects) {
			const table = String(object.name);
			const type = String(object.type);
			const identifier = quoteIdentifier(table);

			if (type === "VIEW") {
				const [createRows] = await connection.query<any[]>(`SHOW CREATE VIEW ${identifier}`);
				const createSql = createRows[0]?.["Create View"];
				if (createSql) {
					await fs.appendFile(filePath, `DROP VIEW IF EXISTS ${identifier};\n${createSql};\n\n`, "utf8");
					tableCount += 1;
					console.log(`  ${table}: view`);
				}
				continue;
			}

			const [createRows] = await connection.query<any[]>(`SHOW CREATE TABLE ${identifier}`);
			const createSql = createRows[0]?.["Create Table"];
			if (!createSql) {
				console.warn(`  Bỏ qua ${table}: không đọc được cấu trúc bảng`);
				continue;
			}

			const [columnRows] = await connection.query<any[]>(`SHOW COLUMNS FROM ${identifier}`);
			const columns = columnRows.map(column => String(column.Field));
			const columnSql = columns.map(quoteIdentifier).join(", ");

			const [rows] = await connection.query<any[]>(`SELECT * FROM ${identifier}`);
			let sql = `DROP TABLE IF EXISTS ${identifier};\n${createSql};\n\n`;
			if (rows.length) {
				for (let index = 0; index < rows.length; index += BATCH_SIZE) {
					const values = rows
						.slice(index, index + BATCH_SIZE)
						.map(row => `(${columns.map(column => sqlValue(row[column])).join(", ")})`)
						.join(",\n");
					sql += `INSERT INTO ${identifier} (${columnSql}) VALUES\n${values};\n`;
				}
			}
			await fs.appendFile(filePath, `${sql}\n`, "utf8");
			tableCount += 1;
			rowCount += rows.length;
			console.log(`  ${table}: ${rows.length} dòng`);
		}

		await fs.appendFile(filePath, "SET FOREIGN_KEY_CHECKS=1;\n", "utf8");
		const stats = await fs.stat(filePath);
		console.log("");
		console.log("Dump hoàn tất:");
		console.log(`  File: ${filePath}`);
		console.log(`  Bảng/view: ${tableCount}`);
		console.log(`  Tổng dòng: ${rowCount}`);
		console.log(`  Dung lượng: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
	} catch (error) {
		await fs.rm(filePath, { force: true }).catch(() => {});
		throw error;
	} finally {
		await connection.end();
	}
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
