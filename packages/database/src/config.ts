const encode = (value: string) => encodeURIComponent(value);

export function ensureDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const host = process.env.HOST || process.env.DB_HOST || "localhost";
  const user = process.env.DB_USER || "root";
  const password = process.env.DB_PASS || "";
  const database = process.env.DB_NAME || "challenge_db";
  const url = `mysql://${encode(user)}:${encode(password)}@${host}:3306/${database}`;
  process.env.DATABASE_URL = url;
  return url;
}