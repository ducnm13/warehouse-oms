const LEDGER_SOURCE_TYPE_LABELS: Record<string, string> = {
	OPENING: "Tồn đầu kỳ",
	OPENING_CANCEL: "Hủy tồn đầu kỳ",
	INVENTORY_DOCUMENT: "Phiếu kho",
	INVENTORY_DOCUMENT_CANCEL: "Hủy phiếu kho",
	STOCKTAKE: "Kiểm kê",
	STOCKTAKE_CANCEL: "Hủy kiểm kê",
	PURCHASE: "Nhập mua hàng",
	PURCHASE_CANCEL: "Hủy nhập mua hàng",
	SALE: "Xuất bán hàng",
	SALE_CANCEL: "Hủy xuất bán hàng",
	SALE_UNPOST: "Bỏ ghi sổ xuất bán",
	SALES_RETURN: "Nhập trả hàng bán",
	SALES_RETURN_CANCEL: "Hủy nhập trả hàng bán",
	TRANSFER_SHIPMENT: "Xuất chuyển kho",
	TRANSFER_RECEIPT: "Nhập chuyển kho",
	TRANSFER_CANCEL: "Hủy chuyển kho",
	PRODUCTION_OUTPUT: "Nhập thành phẩm sản xuất",
	PRODUCTION_OUTPUT_CANCEL: "Hủy nhập thành phẩm sản xuất",
	PRODUCTION_MATERIAL_RETURN: "Nhập lại nguyên vật liệu",
	PRODUCTION_MATERIAL_RETURN_CANCEL: "Hủy nhập lại nguyên vật liệu",
	ASSEMBLY_COMPONENT: "Xuất linh kiện lắp ráp",
	ASSEMBLY_COMPONENT_CANCEL: "Hủy xuất linh kiện lắp ráp",
	ASSEMBLY_OUTPUT: "Nhập thành phẩm lắp ráp",
	ASSEMBLY_OUTPUT_CANCEL: "Hủy nhập thành phẩm lắp ráp",
	DISASSEMBLY_SOURCE: "Xuất hàng tháo dỡ",
	DISASSEMBLY_SOURCE_CANCEL: "Hủy xuất hàng tháo dỡ",
	DISASSEMBLY_RECOVERY: "Nhập hàng thu hồi",
	DISASSEMBLY_RECOVERY_CANCEL: "Hủy nhập hàng thu hồi",
};

const withoutVersion = (value: string) => value.replace(/_V\d+$/i, "");

export function ledgerSourceTypeLabel(sourceType?: string | null): string {
	const raw = (sourceType || "").trim();
	if (!raw) return "-";
	if (LEDGER_SOURCE_TYPE_LABELS[raw]) return LEDGER_SOURCE_TYPE_LABELS[raw];

	const normalized = withoutVersion(raw);
	if (LEDGER_SOURCE_TYPE_LABELS[normalized]) return LEDGER_SOURCE_TYPE_LABELS[normalized];

	if (normalized.endsWith("_CANCEL")) {
		const base = withoutVersion(normalized.slice(0, -"_CANCEL".length));
		const baseLabel = LEDGER_SOURCE_TYPE_LABELS[base];
		if (baseLabel) return `Hủy ${baseLabel.charAt(0).toLowerCase()}${baseLabel.slice(1)}`;
	}

	return "Khác";
}
