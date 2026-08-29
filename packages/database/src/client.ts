import { PrismaClient } from "@prisma/client";
import { ensureDatabaseUrl } from "./config";

ensureDatabaseUrl();

const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalDatabase.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

if (process.env.NODE_ENV !== "production") globalDatabase.prisma = prisma;