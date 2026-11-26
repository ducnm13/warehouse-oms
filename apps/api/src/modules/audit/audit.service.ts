import { prisma } from "@challenge/database";
import { HttpError } from "../../common/http-error";

export type AuditListQuery = {
	page?: number;
	limit?: number;
	search?: string;
	action?: string;
	entityType?: string;
	entityId?: string;
	userId?: number;
	from?: string;
	to?: string;
};

type AuditRow = {
	id: number;
	action: string;
	details: string | null;
	entityType: string | null;
	entityId: string | null;
	entityCode: string | null;
	changes: string | null;
	userId: number | null;
	userName: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: string | null;
	users?: { username: string | null; fullName: string | null; role: string | null } | null;
};

const parseChanges = (raw: string | null) => {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
};

const mapRow = (row: AuditRow) => ({
	id: row.id,
	action: row.action,
	details: row.details,
	entityType: row.entityType,
	entityId: row.entityId,
	entityCode: row.entityCode,
	changes: parseChanges(row.changes),
	userId: row.userId,
	userName: row.users?.fullName || row.users?.username || row.userName,
	username: row.users?.username || null,
	role: row.users?.role || null,
	ipAddress: row.ipAddress,
	userAgent: row.userAgent,
	createdAt: row.createdAt,
});

async function buildWhere(query: AuditListQuery) {
	const where: any = {};
	const and: any[] = [];
	if (query.action?.trim()) where.action = query.action.trim();
	if (query.entityType?.trim()) where.entityType = query.entityType.trim();
	if (query.entityId?.trim()) where.entityId = query.entityId.trim();
	if (query.userId && Number(query.userId) > 0) where.userId = Number(query.userId);
	if (query.from) where.createdAt = { ...(where.createdAt || {}), gte: `${query.from}T00:00:00.000Z` };
	if (query.to) where.createdAt = { ...(where.createdAt || {}), lte: `${query.to}T23:59:59.999Z` };
	const search = query.search?.trim();
	if (search) {
		and.push({
			OR: [
				{ action: { contains: search } },
				{ details: { contains: search } },
				{ entityType: { contains: search } },
				{ entityCode: { contains: search } },
				{ entityId: { contains: search } },
				{ users: { is: { OR: [{ fullName: { contains: search } }, { username: { contains: search } }] } } },
			],
		});
	}
	if (and.length) where.AND = and;
	return where;
}

export const auditService = {
	async list(query: AuditListQuery) {
		const page = Math.max(1, Number(query.page) || 1);
		const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));
		const where = await buildWhere(query);
		const [rows, total] = await Promise.all([
			prisma.audit_logs.findMany({
				where,
				include: { users: { select: { username: true, fullName: true, role: true } } },
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				skip: (page - 1) * limit,
				take: limit,
			}),
			prisma.audit_logs.count({ where }),
		]);
		return {
			data: rows.map(row => mapRow(row as AuditRow)),
			meta: { total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) },
		};
	},

	async filters() {
		const [actions, entityTypes] = await Promise.all([
			prisma.audit_logs.findMany({
				where: { action: { not: "" } },
				distinct: ["action"],
				select: { action: true },
				orderBy: { action: "asc" },
			}),
			prisma.audit_logs.findMany({
				where: { entityType: { not: null } },
				distinct: ["entityType"],
				select: { entityType: true },
				orderBy: { entityType: "asc" },
			}),
		]);
		return {
			actions: actions.map(row => row.action),
			entityTypes: entityTypes.map(row => row.entityType).filter(Boolean),
		};
	},

	async get(id: number) {
		const row = await prisma.audit_logs.findUnique({
			where: { id },
			include: { users: { select: { username: true, fullName: true, role: true } } },
		});
		if (!row) throw new HttpError(404, "AUDIT_LOG_NOT_FOUND", "Không tìm thấy bản ghi nhật ký");
		return mapRow(row as AuditRow);
	},

	/**
	 * Toàn bộ lịch sử của một đối tượng (đơn bán, phiếu mua, phiếu thu/chi...).
	 * Sắp xếp tăng dần để hiển thị như timeline.
	 */
	async entityHistory(entityType: string, entityId: string, limit = 200) {
		const rows = await prisma.audit_logs.findMany({
			where: { entityType, entityId: String(entityId) },
			include: { users: { select: { username: true, fullName: true, role: true } } },
			orderBy: [{ createdAt: "asc" }, { id: "asc" }],
			take: Math.min(500, Math.max(1, Number(limit) || 200)),
		});
		return rows.map(row => mapRow(row as AuditRow));
	},
};
