const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
require("dotenv").config({ quiet: true });
if (!process.env.DATABASE_URL) {
  const host = process.env.HOST || process.env.DB_HOST || "localhost";
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASS || "";
  const database = process.env.DB_NAME || "challenge_db";
  process.env.DATABASE_URL = `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:3306/${database}`;
}
const checks = [
  ["validate", "npx prisma validate --schema packages/database/prisma/schema.prisma"],
  ["generate", "npm run prisma:generate"],
  ["contracts", "npm run typecheck -w @challenge/contracts"],
  ["database", "npm run typecheck -w @challenge/database"],
  ["api", "npm run typecheck -w @challenge/api"],
];
const result = {};
for (const [name, command] of checks) {
  const run = spawnSync("cmd.exe", ["/d", "/s", "/c", command], { encoding: "utf8", timeout: 180000, maxBuffer: 20 * 1024 * 1024, env: process.env });
  result[name] = { status: run.status, signal: run.signal, error: run.error ? String(run.error) : null, stdout: run.stdout, stderr: run.stderr };
  fs.writeFileSync("debt-check-result.json", JSON.stringify(result, null, 2));
  if (run.status !== 0) break;
}