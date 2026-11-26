import type {
	TechnicalIncidentCategory,
	TechnicalIncidentSeverity,
	TechnicalIncidentStatus,
} from "../types";

export const TECHNICAL_CATEGORY_META: Record<
	TechnicalIncidentCategory,
	{ label: string; css: string }
> = {
	REPAIR: { label: "Sửa chữa", css: "bg-rose-100 text-rose-700" },
	MAINTENANCE: { label: "Bảo dưỡng", css: "bg-sky-100 text-sky-700" },
	INSPECTION: { label: "Kiểm tra", css: "bg-indigo-100 text-indigo-700" },
	OTHER: { label: "Khác", css: "bg-slate-100 text-slate-600" },
};

export const TECHNICAL_SEVERITY_META: Record<
	TechnicalIncidentSeverity,
	{ label: string; css: string }
> = {
	LOW: { label: "Thấp", css: "bg-slate-100 text-slate-600" },
	MEDIUM: { label: "Trung bình", css: "bg-sky-100 text-sky-700" },
	HIGH: { label: "Cao", css: "bg-amber-100 text-amber-700" },
	CRITICAL: { label: "Nghiêm trọng", css: "bg-red-100 text-red-700" },
};

export const TECHNICAL_STATUS_META: Record<
	TechnicalIncidentStatus,
	{ label: string; css: string }
> = {
	OPEN: { label: "Mới tiếp nhận", css: "bg-red-100 text-red-700" },
	IN_PROGRESS: { label: "Đang xử lý", css: "bg-amber-100 text-amber-700" },
	RESOLVED: { label: "Đã hoàn tất", css: "bg-emerald-100 text-emerald-700" },
	CANCELLED: { label: "Đã hủy", css: "bg-slate-100 text-slate-600" },
};

export const formatIncidentTime = (value?: string | null) => {
	if (!value) return "—";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return date.toLocaleString("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
};

export const toDateTimeLocalInput = (value?: string | null) => {
	const date = value ? new Date(value) : new Date();
	if (Number.isNaN(date.getTime())) return "";
	const pad = (part: number) => String(part).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
