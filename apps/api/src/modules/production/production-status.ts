// Đồng bộ trạng thái lệnh sản xuất theo chứng từ kho đã ghi sổ:
// - Có phiếu xuất NVL (INVENTORY_ISSUE) đã ghi sổ -> IN_PROGRESS (Đang sản xuất)
// - Có đủ CẢ phiếu xuất NVL + phiếu nhập thành phẩm (INVENTORY_RECEIPT) đã ghi sổ -> COMPLETED (Hoàn thành)
// Nếu lệnh đang COMPLETED mà thiếu chứng từ (hoặc phiếu nhập bị hủy) thì hạ về IN_PROGRESS.
export async function syncProductionStatusFromDocuments(
	tx: any,
	orderId: number,
	actorId = 0,
) {
	const order = await tx.productionorders.findUnique({ where: { id: orderId } });
	if (!order || order.status === "CANCELLED") return;
	const links: any[] = await tx.production_order_document_links_v1.findMany({
		where: { orderId },
	});
	if (!links.length) return;
	const ids = links.map((l: any) => Number(l.linkedId));
	const postedDocs: any[] = await tx.inventorytransactions.findMany({
		where: { id: { in: ids }, documentStatus: "POSTED" },
		select: { id: true },
	});
	const posted = new Set(postedDocs.map((d: any) => String(d.id)));
	const hasIssue = links.some(
		(l: any) => l.linkType === "INVENTORY_ISSUE" && posted.has(String(l.linkedId)),
	);
	const hasReceipt = links.some(
		(l: any) =>
			l.linkType === "INVENTORY_RECEIPT" && posted.has(String(l.linkedId)),
	);
	const next =
		hasIssue && hasReceipt ? "COMPLETED" : hasIssue ? "IN_PROGRESS" : null;
	if (!next || next === order.status) return;
	const at = new Date();
	const ts = at.toISOString();
	const data: any = { status: next, version: { increment: 1 }, updatedAt: ts };
	if (next === "IN_PROGRESS" && !order.startedAt) {
		data.startedAt = at;
		data.startedBy = actorId || order.createdBy;
	}
	if (next === "COMPLETED") {
		data.completedAt = at;
		data.completedBy = actorId || order.createdBy;
	}
	await tx.productionorders.update({ where: { id: orderId }, data });
	await tx.audit_logs.create({
		data: {
			action: "Cập nhật trạng thái lệnh SX theo chứng từ",
			details: `${order.code}: ${order.status} -> ${next}`,
			userId: actorId || order.createdBy || 0,
			userName: String(actorId || order.createdBy || 0),
			createdAt: ts,
		},
	});
}
