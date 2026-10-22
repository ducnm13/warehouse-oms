import { AsyncLocalStorage } from "node:async_hooks";

export type RequestAuditContext = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

const storage = new AsyncLocalStorage<RequestAuditContext>();

export const runWithAuditContext = <T>(context: RequestAuditContext, callback: () => T): T =>
  storage.run(context, callback);

export const getAuditContext = () => storage.getStore();
