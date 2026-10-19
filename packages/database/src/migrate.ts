import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "./client";

// MySQL 8+ rejects the MariaDB-only "IF [NOT] EXISTS" clauses on ALTER TABLE /
// CREATE INDEX. Rewrite them to plain statements; re-running stays safe because
// the resulting duplicate/absent-object errors are ignored below.
function normalizeForMysql(statement: string) {
  return statement
    .replace(/\bADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\b/gi, "ADD COLUMN")
    .replace(/\bADD\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\b/gi, "ADD UNIQUE INDEX")
    .replace(/\bADD\s+INDEX\s+IF\s+NOT\s+EXISTS\b/gi, "ADD INDEX")
    .replace(/\bADD\s+CONSTRAINT\s+IF\s+NOT\s+EXISTS\b/gi, "ADD CONSTRAINT")
    .replace(/\bADD\s+FOREIGN\s+KEY\s+IF\s+NOT\s+EXISTS\b/gi, "ADD FOREIGN KEY")
    .replace(/\bCREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\b/gi, "CREATE UNIQUE INDEX")
    .replace(/\bCREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\b/gi, "CREATE INDEX")
    .replace(/\bDROP\s+FOREIGN\s+KEY\s+IF\s+EXISTS\b/gi, "DROP FOREIGN KEY")
    .replace(/\bDROP\s+INDEX\s+IF\s+EXISTS\b/gi, "DROP INDEX")
    .replace(/\bDROP\s+COLUMN\s+IF\s+EXISTS\b/gi, "DROP COLUMN")
    .replace(/\bDROP\s+CHECK\s+IF\s+EXISTS\b/gi, "DROP CHECK");
}

// Errors that only mean the object is already (or not yet) in the desired state.
const IGNORABLE_ERRNO = new Set([
  "1050", // table already exists
  "1060", // duplicate column name
  "1061", // duplicate key name
  "1091", // can't DROP; check that it exists
  "1826", // duplicate foreign key constraint name
  "1022", // can't write; duplicate key (duplicate FK)
]);

function isIgnorable(err: any) {
  const message = String(err?.message || "");
  const match = /Code:\s*`?(\d+)`?/.exec(message);
  if (match && IGNORABLE_ERRNO.has(match[1])) return true;
  return /already exists|Duplicate column|Duplicate key name|doesn't exist|check that it exists/i.test(message);
}

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
    for (const statement of statements) {
      try {
        await prisma.$executeRawUnsafe(normalizeForMysql(statement));
      } catch (err: any) {
        if (isIgnorable(err)) {
          console.warn(`Migration notice in ${entry.name}:`, err?.message);
        } else {
          throw err;
        }
      }
    }
    await prisma.$executeRawUnsafe("INSERT INTO schema_migrations (id) VALUES (?)", entry.name);
  }
}
