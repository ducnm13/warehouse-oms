import type {
	CostAllocationMethod,
	CostCenterCategory,
	CostEntryStatus,
	CostSheetStatus,
	CostTier,
} from "../types";

export const COST_CATEGORY_META: Record<
	CostCenterCategory,
	{ label: string; short: string; css: string }
> = {
	ELECTRIC_WATER: {
		label: "Điện nước",
		short: "Điện nước",
		css: "bg-sky-100 text-sky-700",
	},
	LABOR: {
		label: "Nhân công sản xuất",
		short: "Nhân công",
		css: "bg-violet-100 text-violet-700",
	},
	PACKAGING: {
		label: "Bao bì & vật tư đóng gói",
		short: "Bao bì",
		css: "bg-amber-100 text-amber-700",
	},
	EQUIPMENT: {
		label: "Khấu hao máy móc thiết bị",
		short: "Máy móc",
		css: "bg-indigo-100 text-indigo-700",
	},
	MAINTENANCE: {
		label: "Vật tư bảo dưỡng & sửa chữa",
		short: "Bảo dưỡng",
		css: "bg-rose-100 text-rose-700",
	},
	OTHER: { label: "Chi phí khác", short: "Khác", css: "bg-slate-100 text-slate-600" },
};

export const ALLOCATION_METHOD_META: Record<
	CostAllocationMethod,
	{ label: string; hint: string }
> = {
	BY_ACTUAL_QTY: {
		label: "Theo sản lượng thực tế",
		hint: "Phân bổ theo số gói thành phẩm thực tế",
	},
	BY_POWDER_KG: {
		label: "Theo kg bột",
		hint: "Phân bổ theo lượng bột tiêu thụ",
	},
	BY_MATERIAL_VALUE: {
		label: "Theo giá trị NVL",
		hint: "Phân bổ theo giá trị nguyên vật liệu trực tiếp",
	},
	MANUAL: {
		label: "Thủ công (tạm tính theo sản lượng)",
		hint: "Chưa hỗ trợ nhập tay từng dòng; tạm phân bổ theo sản lượng",
	},
};

export const COST_ENTRY_STATUS_META: Record<
	CostEntryStatus,
	{ label: string; css: string }
> = {
	DRAFT: { label: "Nháp", css: "bg-slate-100 text-slate-600" },
	POSTED: { label: "Đã hạch toán", css: "bg-emerald-100 text-emerald-700" },
	CANCELLED: { label: "Đã hủy", css: "bg-red-100 text-red-700" },
};

export const COST_SHEET_STATUS_META: Record<
	CostSheetStatus,
	{ label: string; css: string }
> = {
	DRAFT: { label: "Nháp", css: "bg-slate-100 text-slate-600" },
	POSTED: { label: "Đã chốt", css: "bg-emerald-100 text-emerald-700" },
};

export const COST_COMPONENT_LABEL: Record<string, string> = {
	MATERIAL: "Nguyên vật liệu trực tiếp",
	PACK_COST: "Tiền gói thành phần",
	ASSEMBLY_MATERIAL: "Hộp, keo dán & thùng",
	ASSEMBLY_EXTRA: "Chi phí lắp ráp",
	...Object.fromEntries(
		Object.entries(COST_CATEGORY_META).map(([key, meta]) => [key, meta.label]),
	),
};

export const COST_TIER_META: Record<
	CostTier,
	{ label: string; short: string; css: string; hint: string }
> = {
	PACK: {
		label: "Gói sản xuất",
		short: "Gói",
		css: "bg-sky-100 text-sky-700",
		hint: "Chi phí tính cho gói thành phẩm từ lệnh sản xuất",
	},
	ASSEMBLY: {
		label: "Hộp / Túi lắp ráp",
		short: "Hộp/Túi",
		css: "bg-indigo-100 text-indigo-700",
		hint: "Chi phí tính cho quy cách đóng gói từ lệnh lắp ráp",
	},
};

export type QuickCostPreset = {
	key: string;
	label: string;
	centerCode: string;
	category: CostCenterCategory;
	tier: CostTier;
	hint: string;
};

/**
 * Các khoản chi phí nhập nhanh từ báo cáo tổng quan sản xuất.
 * Chỉ cần bấm chọn loại chi phí, nhập số tiền là xong.
 */
export const QUICK_COST_PRESETS: QuickCostPreset[] = [
	{
		key: "DIEN_NUOC",
		label: "Điện nước",
		centerCode: "DIEN_NUOC",
		category: "ELECTRIC_WATER",
		tier: "PACK",
		hint: "Phân bổ theo kg bột",
	},
	{
		key: "CONG_NHAN",
		label: "Công nhân",
		centerCode: "CONG_NHAN",
		category: "LABOR",
		tier: "PACK",
		hint: "Phân bổ theo sản lượng gói",
	},
	{
		key: "BAO_BI",
		label: "Bao bì",
		centerCode: "BAO_BI",
		category: "PACKAGING",
		tier: "PACK",
		hint: "Bao bì, nhãn mác khi đóng gói",
	},
	{
		key: "MAY_MOC",
		label: "Máy móc",
		centerCode: "MAY_MOC",
		category: "EQUIPMENT",
		tier: "PACK",
		hint: "Khấu hao máy móc sản xuất",
	},
	{
		key: "BAO_DUONG",
		label: "Bảo dưỡng",
		centerCode: "BAO_DUONG",
		category: "MAINTENANCE",
		tier: "PACK",
		hint: "Vật tư sửa chữa, bảo dưỡng",
	},
	{
		key: "HOP_KEO_THUNG",
		label: "Hộp / Keo dán / Thùng",
		centerCode: "HOP_KEO_THUNG",
		category: "PACKAGING",
		tier: "ASSEMBLY",
		hint: "Chỉ tính cho tầng hộp / túi lắp ráp",
	},
];

export const formatCostDate = (value?: string | null) => {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value || "—";
	return date.toLocaleDateString("vi-VN");
};

export const formatCostDateTime = (value?: string | null) => {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value || "—";
	return date.toLocaleString("vi-VN");
};

export const todayIso = () => new Date().toISOString().slice(0, 10);
export const monthStartIso = () => `${todayIso().slice(0, 7)}-01`;
