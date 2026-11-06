import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const HOST = process.env.DB_HOST || process.env.HOST || "localhost";
const PORT = Number(process.env.DB_PORT || 3306);
const USER = process.env.DB_USER || "root";
const PASSWORD = process.env.DB_PASS || "";
const DATABASE = process.env.DB_NAME || "warehouse_oms_v2";
const BACKUP_DIR = path.resolve(process.env.DUMP_DIR || path.join(process.cwd(), "backups"));

const args = process.argv.slice(2);
const fileArg = args.find(arg => arg.startsWith("--file="))?.slice("--file=".length);
const confirmed = args.includes("--yes");

async function main() {
	if (!fileArg) {
		throw new Error("Thiếu tham số --file=<đường dẫn file .sql>");
	}
	const filePath = path.resolve(fileArg);
	if (path.dirname(filePath) !== BACKUP_DIR) {
		throw new Error(`Chỉ được khôi phục file trong thư mục backups: ${BACKUP_DIR}`);
	}
	if (!filePath.toLowerCase().endsWith(".sql")) {
		throw new Error("File khôi phục phải có đuôi .sql");
	}

	let stat;
	try {
		stat = await fs.stat(filePath);
	} catch {
		throw new Error(`Không tìm thấy file: ${filePath}`);
	}
	if (!stat.isFile()) throw new Error(`Không phải file: ${filePath}`);

	console.log(`DB: ${USER}@${HOST}:${PORT}/${DATABASE}`);
	console.log(`File khôi phục: ${filePath}`);
	console.log(`Dung lượng: ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
	console.log("");
	if (!confirmed) {
		console.log("Chưa thực thi. Chạy lại với --yes để khôi phục thật.");
		return;
	}

	const sql = await fs.readFile(filePath, "utf8");
	if (!sql.trim()) throw new Error("File backup rỗng");

	const connection = await mysql.createConnection({
		host: HOST,
		port: PORT,
		user: USER,
		password: PASSWORD,
		database: DATABASE,
		multipleStatements: true,
		charset: "utf8mb4",
	});

	try {
		console.log("Đang khôi phục CSDL...");
		await connection.query(sql);
		console.log("");
		console.log("Khôi phục hoàn tất.");
	} finally {
		await connection.end();
	}
}

main().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
