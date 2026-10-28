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
	SALE_UNPOST: "Hủy lưu xuất bán",
	SALES_RETURN: "Nhập trả hàng bán",
	SALES_RETURN_CANCEL: "Hủy nhập trả hàng bán",
	TRANSFER_SHIPMENT: "Xuất chuyển kho",
	TRANSFER_RECEIPT: "Nhập chuyển kho",
	TRANSFER_CANCEL: "Hủy chuyển kho",
	PRODUCTION_OUTPUT: "Nhập thành phẩm sản xuất",
	PRODUCTION_OUTPUT_CANCEL: "Hủy nhập thành phẩm sản xuất",
	PRODUCTION_MATERIAL_RETURN: "Nhập lại nguyên vật liệu",
	PRODUCTION_MATERIAL_RETURN_CANCEL: "Hủy nhập lại nguyên vật liệu",
	ASSEMBLY_COMPONENT: "Xuất kho lắp ráp (linh kiện)",
	ASSEMBLY_COMPONENT_CANCEL: "Hủy xuất kho lắp ráp (linh kiện)",
	ASSEMBLY_OUTPUT: "Nhập kho lắp ráp (thành phẩm)",
	ASSEMBLY_OUTPUT_CANCEL: "Hủy nhập kho lắp ráp (thành phẩm)",
	DISASSEMBLY_SOURCE: "Xuất kho tháo dỡ (thành phẩm)",
	DISASSEMBLY_SOURCE_CANCEL: "Hủy xuất kho tháo dỡ (thành phẩm)",
	DISASSEMBLY_RECOVERY: "Nhập kho tháo dỡ (linh kiện)",
	DISASSEMBLY_RECOVERY_CANCEL: "Hủy nhập kho tháo dỡ (linh kiện)",
};

const withoutVersion = (value: string) => value.replace(/_V\d+$/i, "");

export function ledgerSourceTypeLabel(
	sourceType?: string | null,
	sourceModule?: string | null,
	direction?: "IN" | "OUT" | string | null,
	description?: string | null,
): string {
	const raw = (sourceType || "").trim();
	if (!raw) return "-";
	const context = `${sourceModule || ""} ${description || ""}`.toLocaleUpperCase("vi");
	if (raw === "INVENTORY_DOCUMENT" || raw === "INVENTORY_DOCUMENT_CANCEL") {
		const cancelled = raw.endsWith("_CANCEL");
		if (context.includes("ASSEMBLY") || context.includes("LẮP RÁP")) {
			const base = direction === "IN" ? "Nhập kho lắp ráp" : "Xuất kho lắp ráp";
			return cancelled ? `Hủy ${base.charAt(0).toLowerCase()}${base.slice(1)}` : base;
		}
		if (context.includes("DISASSEMBLY") || context.includes("THÁO DỠ")) {
			const base = direction === "IN" ? "Nhập kho tháo dỡ" : "Xuất kho tháo dỡ";
			return cancelled ? `Hủy ${base.charAt(0).toLowerCase()}${base.slice(1)}` : base;
		}
	}
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
