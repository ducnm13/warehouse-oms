import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";
import DateRangeCalendar from "./DateRangeCalendar";

export type FilterOption = { value: string; label: string };

export type FilterField =
	| {
			type: "select";
			key: string;
			label: string;
			options: FilterOption[];
			placeholder?: string;
	  }
	| {
			type: "dateRange";
			key: string;
			label: string;
			fromKey?: string;
			toKey?: string;
	  };

export type FilterValues = Record<string, string>;

export interface FilterDefinition {
	fields: FilterField[];
	values: FilterValues;
}

export function isEmptyFilterValue(value: string | undefined) {
	return !value || value === "ALL";
}

export function getFilterRangeKeys(field: FilterField) {
	if (field.type !== "dateRange") return null;
	return {
		from: field.fromKey || `${field.key}From`,
		to: field.toKey || `${field.key}To`,
	};
}

export function countActiveFilters(fields: FilterField[], values: FilterValues) {
	return fields.reduce((count, field) => {
		if (field.type === "dateRange") {
			const keys = getFilterRangeKeys(field)!;
			return count + (values[keys.from] || values[keys.to] ? 1 : 0);
		}
		return count + (isEmptyFilterValue(values[field.key]) ? 0 : 1);
	}, 0);
}

export function describeActiveFilters(
	fields: FilterField[],
	values: FilterValues,
) {
	const parts: string[] = [];
	for (const field of fields) {
		if (field.type === "dateRange") {
			const keys = getFilterRangeKeys(field)!;
			const from = values[keys.from];
			const to = values[keys.to];
			if (!from && !to) continue;
			parts.push(`${field.label}: ${formatDate(from)} - ${formatDate(to)}`);
			continue;
		}
		if (isEmptyFilterValue(values[field.key])) continue;
		const option = field.options.find(item => item.value === values[field.key]);
		parts.push(`${field.label}: ${option?.label || values[field.key]}`);
	}
	return parts;
}

function formatDate(value?: string) {
	if (!value) return "...";
	const [year, month, day] = value.split("-");
	if (!year || !month || !day) return value;
	return `${day}/${month}/${year}`;
}

interface FilterDrawerProps {
	open: boolean;
	onClose: () => void;
	fields: FilterField[];
	values: FilterValues;
	onApply: (values: FilterValues) => void;
	onClear: () => void;
	title?: string;
}

export default function FilterDrawer({
	open,
	onClose,
	fields,
	values,
	onApply,
	onClear,
	title = "Bộ lọc",
}: FilterDrawerProps) {
	const [draft, setDraft] = useState<FilterValues>(values);

	useEffect(() => {
		if (open) setDraft(values);
	}, [open, values]);

	useEffect(() => {
		if (!open) return;
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.stopPropagation();
				onClose();
			}
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [open, onClose]);

	const activeCount = useMemo(
		() => countActiveFilters(fields, draft),
		[fields, draft],
	);

	if (!open) return null;

	const update = (key: string, value: string) =>
		setDraft(current => ({ ...current, [key]: value }));

	return createPortal(
		<div className="fixed inset-0 z-[500] flex justify-end bg-slate-900/55">
			<div className="filter-drawer flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl">
				<div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
					<div>
						<h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
							<SlidersHorizontal size={18} className="text-[#422afb]" />
							{title}
						</h2>
						<p className="mt-1 text-xs text-slate-500">
							Chọn điều kiện để thu hẹp danh sách hiển thị.
						</p>
					</div>
					<button
						type="button"
						title="Đóng"
						onClick={onClose}
						className="erp-icon-btn"
					>
						<X size={18} />
					</button>
				</div>

				<div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
					{fields.map(field => {
						if (field.type === "dateRange") {
							const keys = getFilterRangeKeys(field)!;
							return (
								<div key={field.key}>
									<span className="mb-1.5 block text-[13px] font-semibold text-slate-700">
										{field.label}
									</span>
									<DateRangeCalendar
										from={draft[keys.from] || ""}
										to={draft[keys.to] || ""}
										onChange={(from, to) =>
											setDraft(current => ({
												...current,
												[keys.from]: from,
												[keys.to]: to,
											}))
										}
									/>
								</div>
							);
						}
						return (
							<label key={field.key} className="block">
								<span className="mb-1.5 block text-[13px] font-semibold text-slate-700">
									{field.label}
								</span>
								<select
									value={draft[field.key] || ""}
									onChange={event => update(field.key, event.target.value)}
								>
									<option value="">
										{field.placeholder || `Tất cả ${field.label.toLowerCase()}`}
									</option>
									{field.options.map(option => (
										<option key={option.value} value={option.value}>
											{option.label}
										</option>
									))}
								</select>
							</label>
						);
					})}
				</div>

				<div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
					<button
						type="button"
						className="erp-btn"
						onClick={() => {
							setDraft({});
							onClear();
							onClose();
						}}
					>
						<RotateCcw size={15} /> Xóa lọc
					</button>
					<div className="flex items-center gap-2">
						<button type="button" className="erp-btn" onClick={onClose}>
							Hủy
						</button>
						<button
							type="button"
							className="erp-btn erp-btn-primary"
							onClick={() => {
								onApply(draft);
								onClose();
							}}
						>
							Áp dụng{activeCount ? ` (${activeCount})` : ""}
						</button>
					</div>
				</div>
			</div>
		</div>,
		document.body,
	);
}
