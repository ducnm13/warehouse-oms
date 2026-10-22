import { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrl } from "./config";
import { getAuditContext } from "./request-context";

ensureDatabaseUrl();

const globalDatabase = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

function createClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  return base.$extends({
    name: "audit-request-context",
    query: {
      audit_logs: {
        async create({ args, query }) {
          const context = getAuditContext();
          if (context && args.data) {
            const data = Array.isArray(args.data)
              ? args.data.map(row => ({
                  ...row,
                  ipAddress: row.ipAddress ?? context.ipAddress ?? null,
                  userAgent: row.userAgent ?? context.userAgent ?? null,
                }))
              : {
                  ...args.data,
                  ipAddress: args.data.ipAddress ?? context.ipAddress ?? null,
                  userAgent: args.data.userAgent ?? context.userAgent ?? null,
                };
            return query({ ...args, data } as typeof args);
          }
          return query(args);
        },
      },
    },
  });
}

export const prisma = globalDatabase.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalDatabase.prisma = prisma;
