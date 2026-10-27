import React from "react";
import { useQuery } from "@tanstack/react-query";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { AlertCircle, Download, Inbox, Loader2 } from "lucide-react";
import toast from "../ui/toast";
import { legacyApi } from "../../lib/apiV1";
import { formatNumber } from "../../lib/utils";

export const money = (value: unknown) =>
	`${formatNumber(Number(value || 0))} ₫`;
export const qty = (value: unknown) => formatNumber(Number(value || 0));
export const percent = (value: unknown) =>
	`${formatNumber(Number(value || 0))}%`;

export type ExportColumn<T> = {
	header: string;
	value: (row: T) => string | number;
	width?: number;
};

export function useReportExport() {
	return React.useCallback(
		async <T,>(
			filename: string,
			sheetName: string,
			columns: ExportColumn<T>[],
			rows: T[],
		) => {
			if (!rows.length) {
				toast.error("Không có dữ liệu để xuất");
				return;
			}
			const workbook = new ExcelJS.Workbook();
			const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || "Bao cao");
			sheet.columns = columns.map(column => ({
				header: column.header,
				key: column.header,
				width: column.width || 20,
			}));
			for (const row of rows)
				sheet.addRow(columns.map(column => column.value(row)));
			const head = sheet.getRow(1);
			head.font = { bold: true };
			head.eachCell(cell => {
				cell.fill = {
					type: "pattern",
					pattern: "solid",
					fgColor: { argb: "FFEAECF0" },
				};
			});
			const buffer = await workbook.xlsx.writeBuffer();
			saveAs(new Blob([buffer]), filename);
			toast.success("Đã xuất Excel");
		},
		[],
	);
}

export function ExportButton({ onClick }: { onClick: () => void }) {
	return (
		<button className="erp-btn erp-btn-primary" onClick={onClick}>
			<Download size={16} /> Xuất Excel
		</button>
	);
}

export function ReportShell({
	title,
	description,
	actions,
	children,
}: {
	title: string;
	description?: string;
	actions?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>{title}</h1>
					{description ? <p>{description}</p> : null}
				</div>
				{actions ? (
					<div className="flex flex-wrap items-center gap-2">{actions}</div>
				) : null}
			</div>
			{children}
		</div>
	);
}

export function ReportCard({
	title,
	description,
	action,
	children,
	className,
}: {
	title?: string;
	description?: string;
	action?: React.ReactNode;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div className={`erp-card overflow-hidden ${className || ""}`}>
			{title || action ? (
				<div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
					<div>
						<h2 className="text-[14.5px] font-bold text-slate-800">{title}</h2>
						{description ? (
							<p className="text-[12px] text-slate-500">{description}</p>
						) : null}
					</div>
					{action}
				</div>
			) : null}
			{children}
		</div>
	);
}

export function StatCard({
	label,
	value,
	icon: Icon,
	hint,
	tone = "default",
}: {
	label: string;
	value: React.ReactNode;
	icon?: React.FC<any>;
	hint?: string;
	tone?: "default" | "positive" | "negative" | "warning" | "info";
}) {
	const color =
		tone === "positive"
			? "text-emerald-600"
			: tone === "negative"
				? "text-red-600"
				: tone === "warning"
					? "text-amber-600"
					: tone === "info"
						? "text-blue-600"
						: "text-slate-800";
	return (
		<div className="erp-stat">
			{Icon ? <Icon size={18} /> : null}
			<div className="min-w-0">
				<span>{label}</span>
				<strong className={color}>{value}</strong>
				{hint ? (
					<span className="mt-0.5 text-[11px] text-slate-400">{hint}</span>
				) : null}
			</div>
		</div>
	);
}

export function StatGrid({ children }: { children: React.ReactNode }) {
	return (
		<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{children}</div>
	);
}

export function TableState({
	loading,
	error,
	empty,
	colSpan,
	children,
}: {
	loading?: boolean;
	error?: string | null;
	empty?: boolean;
	colSpan: number;
	children: React.ReactNode;
}) {
	if (loading) {
		return (
			<tbody>
				<tr>
					<td colSpan={colSpan} className="py-12 text-center text-slate-500">
						<span className="inline-flex items-center gap-2">
							<Loader2 size={16} className="animate-spin" /> Đang tải dữ liệu...
						</span>
					</td>
				</tr>
			</tbody>
		);
	}
	if (error) {
		return (
			<tbody>
				<tr>
					<td colSpan={colSpan} className="py-12 text-center text-red-600">
						<span className="inline-flex items-center gap-2">
							<AlertCircle size={16} /> {error}
						</span>
					</td>
				</tr>
			</tbody>
		);
	}
	if (empty) {
		return (
			<tbody>
				<tr>
					<td colSpan={colSpan} className="py-12 text-center text-slate-400">
						<span className="inline-flex items-center gap-2">
							<Inbox size={16} /> Không có dữ liệu phù hợp bộ lọc.
						</span>
					</td>
				</tr>
			</tbody>
		);
	}
	return <tbody>{children}</tbody>;
}

export function FilterBar({ children }: { children: React.ReactNode }) {
	return (
		<div className="erp-card space-y-3 p-4">
			<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{children}</div>
		</div>
	);
}

export type ReportRefs = {
	warehouses: Array<{ id: number; name: string }>;
	customers: Array<{ id: number; code?: string; name: string }>;
	suppliers: Array<{ id: number; code?: string; name: string }>;
};

export function useReportRefs() {
	return useQuery({
		queryKey: ["report-refs"],
		staleTime: 5 * 60 * 1000,
		queryFn: async (): Promise<ReportRefs> => {
			const [warehouses, customers, suppliers] = await Promise.all([
				legacyApi<any[]>("/api/warehouses").catch(() => []),
				legacyApi<any[]>("/api/customers").catch(() => []),
				legacyApi<any[]>("/api/suppliers").catch(() => []),
			]);
			return {
				warehouses: warehouses || [],
				customers: customers || [],
				suppliers: suppliers || [],
			};
		},
	});
}

export function WarehouseSelect({
	value,
	onChange,
	warehouses,
	placeholder = "Tất cả kho",
}: {
	value: number;
	onChange: (id: number) => void;
	warehouses: ReportRefs["warehouses"];
	placeholder?: string;
}) {
	return (
		<label>
			Kho
			<select
				value={value}
				onChange={event => onChange(Number(event.target.value))}
			>
				<option value={0}>{placeholder}</option>
				{warehouses.map(warehouse => (
					<option key={warehouse.id} value={warehouse.id}>
						{warehouse.name}
					</option>
				))}
			</select>
		</label>
	);
}
