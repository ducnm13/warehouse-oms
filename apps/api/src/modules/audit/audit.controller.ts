import { auditService } from "./audit.service";

const query = (req: any) => ({
	page: req.query.page ? Number(req.query.page) : undefined,
	limit: req.query.limit ? Number(req.query.limit) : undefined,
	search: typeof req.query.search === "string" ? req.query.search : undefined,
	action: typeof req.query.action === "string" ? req.query.action : undefined,
	entityType: typeof req.query.entityType === "string" ? req.query.entityType : undefined,
	entityId: typeof req.query.entityId === "string" ? req.query.entityId : undefined,
	userId: req.query.userId ? Number(req.query.userId) : undefined,
	from: typeof req.query.from === "string" ? req.query.from : undefined,
	to: typeof req.query.to === "string" ? req.query.to : undefined,
});

export const auditController = {
	async list(req: any, res: any) {
		const result = await auditService.list(query(req));
		res.json({ success: true, message: "OK", data: result.data, meta: result.meta });
	},

	async filters(_req: any, res: any) {
		res.json({ success: true, message: "OK", data: await auditService.filters() });
	},

	async get(req: any, res: any) {
		res.json({ success: true, message: "OK", data: await auditService.get(Number(req.params.id)) });
	},

	async entityHistory(req: any, res: any) {
		const data = await auditService.entityHistory(
			String(req.params.entityType),
			String(req.params.entityId),
			req.query.limit ? Number(req.query.limit) : undefined,
		);
		res.json({ success: true, message: "OK", data });
	},
};
