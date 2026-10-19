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

// Split a comma-separated list on top-level commas only (ignore commas inside
// parentheses or string literals).
function splitTopLevel(input: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quote) {
      current += ch;
      if (ch === quote) {
        if (input[i + 1] === quote) {
          current += input[i + 1];
          i++;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

// MySQL aborts an entire ALTER TABLE if one clause fails (e.g. a column that
// already exists), which would silently skip the remaining clauses. Split
// multi-clause ALTERs so each clause is applied independently and idempotently.
function expandStatement(statement: string): string[] {
  const match = /^ALTER\s+TABLE\s+(`[^`]+`|\w+)\s+([\s\S]+)$/i.exec(statement);
  if (!match) return [statement];
  const clauses = splitTopLevel(match[2]);
  if (clauses.length <= 1) return [statement];
  return clauses.map(clause => `ALTER TABLE ${match[1]} ${clause}`);
}

// Errors that only mean the object is already (or not yet) in the desired state.
const IGNORABLE_ERRNO = new Set([
  "1022", // can't write file; duplicate key
  "1050", // table already exists
  "1051", // unknown table
  "1054", // unknown column
  "1060", // duplicate column name
  "1061", // duplicate key name
  "1064", // syntax error (MariaDB-only clause on MySQL)
  "1072", // key column doesn't exist
  "1091", // can't DROP; check that it exists
  "1146", // table doesn't exist
  "1170", // key column used without a key length
  "1824", // failed to open referenced table
  "1826", // duplicate foreign key constraint name
]);

function isIgnorable(err: any) {
  const message = String(err?.message || "");
  const match = /Code:\s*`?(\d+)`?/.exec(message);
  if (match && IGNORABLE_ERRNO.has(match[1])) return true;
  return /already exists|Duplicate column|Duplicate key name|Duplicate entry|doesn't exist|check that it exists|Unknown column/i.test(
    message,
  );
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
      for (const prepared of expandStatement(normalizeForMysql(statement))) {
        try {
          await prisma.$executeRawUnsafe(prepared);
        } catch (err: any) {
          if (isIgnorable(err)) {
            console.warn(`Migration notice in ${entry.name}:`, err?.message);
          } else {
            throw err;
          }
        }
      }
    }
    await prisma.$executeRawUnsafe("INSERT INTO schema_migrations (id) VALUES (?)", entry.name);
  }
}
