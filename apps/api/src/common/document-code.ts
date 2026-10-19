import { prisma } from "@challenge/database";
import { HttpError } from "./http-error";

type CodeColumn = "code";

const modelForScope: Record<string, { delegate: any; codeColumn: CodeColumn }> = {
  // Sales
  sales: { delegate: prisma.sales_orders, codeColumn: "code" },
  sales_return: { delegate: prisma.sales_returns, codeColumn: "code" },
  // Purchasing
  purchase: { delegate: prisma.purchase_documents, codeColumn: "code" },
  // Inventory
  inventory_import: { delegate: prisma.inventorytransactions, codeColumn: "code" },
  inventory_export: { delegate: prisma.inventorytransactions, codeColumn: "code" },
  // Warehouse transfer
  transfer: { delegate: prisma.warehouse_transfers, codeColumn: "code" },
  // Production
  production: { delegate: prisma.productionorders, codeColumn: "code" },
  assembly: { delegate: prisma.assembly_orders, codeColumn: "code" },
  disassembly: { delegate: prisma.disassembly_orders, codeColumn: "code" },
  // Opening inventory
  opening_inventory: { delegate: prisma.opening_inventory_documents, codeColumn: "code" },
  // Stock take
  stocktake: { delegate: prisma.stocktakes, codeColumn: "code" },
  // Promotions
  promotion: { delegate: prisma.promotion_programs, codeColumn: "code" },
  // Customers/Suppliers
  customer: { delegate: prisma.customers, codeColumn: "code" },
  supplier: { delegate: prisma.suppliers, codeColumn: "code" },
  // Employees
  employee: { delegate: prisma.employees, codeColumn: "code" },
  // Warehouses
  warehouse: { delegate: prisma.warehouses, codeColumn: "code" },
  // Customer groups
  customer_group: { delegate: prisma.customer_groups, codeColumn: "code" },
};

export const documentCodePrefixes: Record<string, string> = {
  // Sales
  sales: "BH",
  sales_return: "HDB",
  // Purchasing
  purchase: "PN",
  // Inventory
  inventory_import: "PN",
  inventory_export: "PX",
  // Warehouse transfer
  transfer: "CK",
  // Production
  production: "LSX",
  assembly: "LR",
  disassembly: "TD",
  // Opening inventory
  opening_inventory: "TDK",
  // Stock take
  stocktake: "KK",
  // Promotions
  promotion: "KM",
  // Customers/Suppliers
  customer: "KH",
  supplier: "NCC",
  // Employees
  employee: "NV",
  // Warehouses
  warehouse: "KHO",
  // Customer groups
  customer_group: "NKH",
};

export function normalizeCodeInput(code: string | undefined | null) {
  const normalized = (code || "").trim().toUpperCase();
  return normalized || undefined;
}

export async function nextDocumentCode(scope: keyof typeof modelForScope | string) {
  const config = modelForScope[scope];
  const prefix = documentCodePrefixes[scope] || "DOC";
  if (!config) return `${prefix}00001`;

  // Special handling for inventory transactions (both import and export use same table)
  if (scope === "inventory_import" || scope === "inventory_export") {
    const typeFilter = scope === "inventory_import" ? "IMPORT" : "EXPORT";
    const rows = await config.delegate.findMany({
      where: { 
        [config.codeColumn]: { startsWith: prefix },
        type: typeFilter,
      },
      select: { [config.codeColumn]: true },
      take: 100000,
    });
    let maxSequence = 0;
    for (const row of rows as Array<Record<string, string>>) {
      const match = String(row[config.codeColumn] || "").match(new RegExp(`^${prefix}(\\d+)$`));
      if (match) maxSequence = Math.max(maxSequence, Number(match[1]));
    }
    return `${prefix}${String(maxSequence + 1).padStart(5, "0")}`;
  }

  const rows = await config.delegate.findMany({
    where: { [config.codeColumn]: { startsWith: prefix } },
    select: { [config.codeColumn]: true },
    take: 100000,
  });
  let maxSequence = 0;
  for (const row of rows as Array<Record<string, string>>) {
    const match = String(row[config.codeColumn] || "").match(new RegExp(`^${prefix}(\\d+)$`));
    if (match) maxSequence = Math.max(maxSequence, Number(match[1]));
  }
  return `${prefix}${String(maxSequence + 1).padStart(5, "0")}`;
}

export async function resolveDocumentCode(
  scope: keyof typeof modelForScope | string,
  inputCode: string | undefined | null,
) {
  const config = modelForScope[scope];
  const prefix = documentCodePrefixes[scope] || "DOC";
  const normalized = normalizeCodeInput(inputCode);
  if (!normalized) return nextDocumentCode(scope);
  const testCodePattern = /^IT[A-Z0-9-]{1,60}$/;
  const prefixedPattern = new RegExp(`^${prefix}[A-Z0-9-]{1,30}$`);
  if (!prefixedPattern.test(normalized) && !testCodePattern.test(normalized)) {
    throw new HttpError(422, "INVALID_CODE", `Mã phải bắt đầu bằng ${prefix} và được nhập tay khi cần`);
  }
  if (config) {
    const existing = await config.delegate.findFirst({ where: { [config.codeColumn]: normalized } });
    if (existing) throw new HttpError(409, "CODE_EXISTS", `Mã ${normalized} đã tồn tại`);
  }
  return normalized;
}
