import mysql from "mysql2/promise";

const HOST = process.env.DB_HOST || process.env.HOST || "localhost";
const PORT = Number(process.env.DB_PORT || 3306);
const USER = process.env.DB_USER || "root";
const PASSWORD = process.env.DB_PASS || "";
const DATABASE = process.env.DB_NAME || "warehouse_oms_v2";

async function resetDatabase() {
  const admin = await mysql.createConnection({ host: HOST, port: PORT, user: USER, password: PASSWORD, multipleStatements: true });
  console.log(`Dropping database ${DATABASE}...`);
  await admin.query(`DROP DATABASE IF EXISTS \`${DATABASE}\``);
  console.log(`Creating database ${DATABASE}...`);
  await admin.query(`CREATE DATABASE \`${DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();
  console.log("DATABASE_RESET_OK");
}

resetDatabase().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
