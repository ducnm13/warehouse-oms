import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "./client";

export async function runMigrations() {
  await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id VARCHAR(100) PRIMARY KEY,
    applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  )`);
  const root = path.resolve(process.cwd(), "packages/database/prisma/migrations");
  const entries = (await fs.readdir(root, { withFileTypes: true }))
    .filter(entry => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const applied = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      "SELECT id FROM schema_migrations WHERE id = ? LIMIT 1", entry.name,
    );
    if (applied.length) continue;
    const sql = await fs.readFile(path.join(root, entry.name, "migration.sql"), "utf8");
    const statements = sql.split(/;\s*(?:\r?\n|$)/).map(value => value.trim()).filter(Boolean);
    // MySQL implicitly commits DDL. Record the migration only after every
    // idempotent statement succeeds, so a retry remains safe.
    for (const statement of statements) await prisma.$executeRawUnsafe(statement);
    await prisma.$executeRawUnsafe("INSERT INTO schema_migrations (id) VALUES (?)", entry.name);
  }
}