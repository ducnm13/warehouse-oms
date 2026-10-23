export type ProductionDocumentStatus = "DRAFT" | "WAITING_RECEIPT" | "FULL";

type ProductionLink = {
	linkType?: string | null;
	linkedId?: number | bigint | string | null;
};

type ProductionRow = {
	id: number;
	production_order_document_links_v1?: ProductionLink[];
};

/**
 * Trạng thái chứng từ của lệnh sản xuất (độc lập với trạng thái xử lý):
 * - DRAFT: chưa lưu phiếu xuất NVL.
 * - WAITING_RECEIPT: đã lưu phiếu xuất NVL, chưa lập phiếu nhập thành phẩm.
 * - FULL: đã lưu phiếu xuất NVL và đã lập phiếu nhập thành phẩm.
 */
export async function resolveProductionDocumentStatuses(
	db: any,
	rows: ProductionRow[],
): Promise<Map<number, ProductionDocumentStatus>> {
	const linkedIds = [
		...new Set(
			rows.flatMap(row =>
				(row.production_order_document_links_v1 || [])
					.map(link => Number(link.linkedId))
					.filter(id => Number.isFinite(id) && id > 0),
			),
		),
	];
	const documents: Array<{ id: number; documentStatus: string }> =
		linkedIds.length > 0
			? await db.inventorytransactions.findMany({
					where: { id: { in: linkedIds } },
					select: { id: true, documentStatus: true },
				})
			: [];
	const statusById = new Map(
		documents.map(document => [Number(document.id), document.documentStatus]),
	);
	const result = new Map<number, ProductionDocumentStatus>();
	for (const row of rows) {
		const links = row.production_order_document_links_v1 || [];
		const hasPostedIssue = links.some(
			link =>
				link.linkType === "INVENTORY_ISSUE" &&
				statusById.get(Number(link.linkedId)) === "POSTED",
		);
		const hasActiveReceipt = links.some(link => {
			if (link.linkType !== "INVENTORY_RECEIPT") return false;
			const status = statusById.get(Number(link.linkedId));
			return status === "POSTED" || status === "DRAFT";
		});
		result.set(
			row.id,
			hasPostedIssue
				? hasActiveReceipt
					? "FULL"
					: "WAITING_RECEIPT"
				: "DRAFT",
		);
	}
	return result;
}
