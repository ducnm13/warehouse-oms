const DEFAULT_DEV_TOOLS_USERS = "ducnm,admin";

export function getDevToolsUsers(): string[] {
  return (process.env.DEV_TOOLS_USERS || DEFAULT_DEV_TOOLS_USERS)
    .split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

export function isDevToolsAllowed(username?: string | null): boolean {
  const value = String(username || "").trim().toLowerCase();
  return Boolean(value) && getDevToolsUsers().includes(value);
}
