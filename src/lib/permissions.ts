export const hasPermission = (
	role: string | undefined,
	permissions: string[] | undefined,
	permission?: string | string[],
) => {
	if (!role) return true;
	const granted = permissions || [];
	if (granted.includes("system.admin")) return true;
	if (!permission) return false;
	const list = Array.isArray(permission) ? permission : [permission];
	return list.some(item => granted.includes(item));
};

export const canViewCatalogPrices = (
	role: string | undefined,
	permissions: string[] | undefined,
	roles?: string[],
) => {
	if (permissions?.includes("system.admin")) return true;
	const roleCodes = [...new Set([...(roles || []), ...(role ? [role] : [])])];
	return !roleCodes.includes("W_MANAGER");
};

export const canViewMoney = (
	role: string | undefined,
	permissions: string[] | undefined,
	roles?: string[],
) => canViewCatalogPrices(role, permissions, roles);

export const getModuleAccess = (
	role: string | undefined,
	permissions: string[] | undefined,
) => {
	const has = (permission?: string | string[]) =>
		hasPermission(role, permissions, permission);
	const isWarehouseRole = role === "W_MANAGER";

	return {
		dashboard: has("dashboard.view"),
		sales: has("sales.view"),
		promotions: has("promotion.view"),
		salesReturns: has("sales.return.view"),
		customers: has("customer.view"),
		debt: has("debt.view"),
		online: has("online.view"),
		purchases: has("purchase.view"),
		suppliers: has("purchase.view"),
		warehouses: has("inventory.view"),
		import: has("inventory.view"),
		export: has("inventory.view"),
		transfers: has("transfer.view"),
		stocktake: has("inventory.stocktake"),
		catalog: has("catalog.view"),
		priceBooks: has("catalog.manage") && !isWarehouseRole,
		opening: has("inventory.opening") && !isWarehouseRole,
		production: has("production.view"),
		productionMgmt: has("production.manage"),
		assembly: has("assembly.view"),
		reports: has("report.view"),
		users: has("iam.manage"),
		roles: has("iam.manage"),
		auditLogs: has("audit.view"),
		company: has("company.manage"),
		devTools: has("devtools.use"),
		chat: has("chat.use"),
	} as const;
};

export type ModuleAccess = ReturnType<typeof getModuleAccess>;
export type ModuleKey = keyof ModuleAccess;
