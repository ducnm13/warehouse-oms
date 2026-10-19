import React, { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import { Printer } from "lucide-react";
import toast from "react-hot-toast";
import RightDrawer from "./RightDrawer";
import { apiV1 } from "../lib/apiV1";
import {
	buildCompanyPrintProfile,
	applyCompanyHeader,
	cellText,
	type CompanyPrintProfile,
} from "../lib/printTemplate";

const esc = (value: unknown) =>
	String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

const toCssColor = (argb: any): string | null => {
	const hex = String(argb || "").replace(/[^0-9a-fA-F]/g, "");
	if (hex.length === 8) return `#${hex.slice(2)}`;
	if (hex.length === 6) return `#${hex}`;
	return null;
};

interface PrintPreviewProps {
	open: boolean;
	title: string;
	templateUrl: string;
	fill:
		| ((
				worksheet: ExcelJS.Worksheet,
				company: CompanyPrintProfile | null,
		  ) => void)
		| null;
	onClose: () => void;
}

export default function PrintPreview({
	open,
	title,
	templateUrl,
	fill,
	onClose,
}: PrintPreviewProps) {
	const [html, setHtml] = useState("");
	const [loading, setLoading] = useState(false);
	const frameId = useMemo(
		() => `print-preview-${Math.random().toString(36).slice(2)}`,
		[],
	);

	useEffect(() => {
		if (!open || !fill) return;
		let cancelled = false;
		(async () => {
			setLoading(true);
			try {
				const [templateResponse, companyResponse] = await Promise.all([
					fetch(templateUrl),
					apiV1<any>("/api/v1/company").catch(() => null),
				]);
				if (!templateResponse.ok)
					throw new Error(
						`Không tải được mẫu ${templateUrl} (HTTP ${templateResponse.status}). Kiểm tra file mẫu trong template_xlsx`,
					);
				const contentType = templateResponse.headers.get("content-type") || "";
				const templateBuffer = await templateResponse.arrayBuffer();
				if (
					templateBuffer.byteLength < 1000 ||
					contentType.includes("text/html")
				) {
					throw new Error(
						`File mẫu ${templateUrl} không phải Excel hợp lệ. Kiểm tra file trong template_xlsx`,
					);
				}
				const workbook = new ExcelJS.Workbook();
				try {
					await workbook.xlsx.load(templateBuffer);
				} catch {
					throw new Error(
						`Không đọc được mẫu ${templateUrl}. File có thể hỏng hoặc không phải .xlsx`,
					);
				}
				const worksheet = workbook.worksheets[0];
				const company = buildCompanyPrintProfile(companyResponse?.data || null);
				fill(worksheet, company);
				applyCompanyHeader(worksheet, company);
				const merges: Record<string, { min: number; max: number }> = {};
				const mergeStore = (worksheet as any)._merges || {};
				for (const key of Object.keys(mergeStore)) {
					const model = mergeStore[key]?.model;
					if (!model || model.top !== model.bottom) continue;
					merges[`${model.top}:${model.left}`] = {
						min: model.left,
						max: model.right,
					};
				}
				const columnWidths: string[] = [];
				for (let c = 1; c <= worksheet.columnCount; c += 1) {
					const width = (worksheet.getColumn(c).width || 14) * 7.2;
					columnWidths.push(
						`<col style="width:${Math.max(34, Math.min(190, width))}px" />`,
					);
				}
				const hasBorder = (cell: any) => {
					const border = (cell as any).border as any;
					if (!border) return false;
					return ["top", "left", "bottom", "right", "diagonal"].some(
						edge =>
							border[edge] &&
							border[edge].style &&
							border[edge].style !== "none" &&
							border[edge].style !== "omit",
					);
				};
				const body: string[] = [];
				worksheet.eachRow({ includeEmpty: true }, row => {
					const cells: string[] = [];
					const covered = new Set<number>();
					for (let c = 1; c <= worksheet.columnCount; c += 1) {
						const key = `${row.number}:${c}`;
						const merge = merges[key];
						const renderCell = (cell: any, colspan: number) => {
							const style: string[] = [];
							if (cell.font?.bold) style.push("font-weight:700");
							if (cell.font?.size)
								style.push(
									`font-size:${Math.min(22, Math.max(10, Number(cell.font.size)))}px`,
								);
							if (cell.font?.color && (cell.font.color as any).argb) {
								const color = toCssColor((cell.font.color as any).argb);
								if (color) style.push(`color:${color}`);
							}
							if (hasBorder(cell)) style.push("border:1px solid #1f2937");
							else style.push("border:1px solid transparent");
							const align = (cell.alignment as any)?.horizontal;
							if (align === "center") style.push("text-align:center");
							else if (align === "right") style.push("text-align:right");
							else if (row.number >= 12) style.push("text-align:left");
							const vertical = (cell.alignment as any)?.vertical;
							if (vertical === "middle" || vertical === "center")
								style.push("vertical-align:middle");
							else style.push("vertical-align:top");
							return `<td${colspan > 1 ? ` colspan="${colspan}"` : ""} style="${style.join(";")};padding:5px 7px;word-break:break-word">${esc(cellText(cell.value))}</td>`;
						};
						if (merge) {
							const cell = row.getCell(c);
							for (let k = merge.min; k <= merge.max; k += 1) covered.add(k);
							cells.push(renderCell(cell, merge.max - merge.min + 1));
						} else if (!covered.has(c)) {
							cells.push(renderCell(row.getCell(c), 1));
						}
					}
					const text = cells
						.map(cell =>
							cell
								.replace(/<[^>]+>/g, "")
								.replace(/&nbsp;/g, " ")
								.trim(),
						)
						.join("");
					if (text !== "") body.push(`<tr>${cells.join("")}</tr>`);
				});
				if (!cancelled) {
					setHtml(
						`<div style="background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif"><table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:11.5px;line-height:1.45"><colgroup>${columnWidths.join("")}</colgroup><tbody>${body.join("")}</tbody></table></div>`,
					);
				}
			} catch (e: any) {
				if (!cancelled) toast.error(e.message || "Không tải được mẫu in");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [open, templateUrl, fill]);

	const doPrint = () => {
		const frame = document.getElementById(frameId) as HTMLIFrameElement | null;
		const win = frame?.contentWindow;
		if (!win) {
			toast.error("Không mở được khung in");
			return;
		}
		win.focus();
		win.print();
	};

	return (
		<RightDrawer
			open={open}
			title={title}
			subtitle="Xem trước trang in"
			widthClass="max-w-[76rem]"
			onClose={onClose}
			footer={
				<>
					<button
						type="button"
						className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
						onClick={onClose}
					>
						Đóng
					</button>
					<button
						type="button"
						className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
						disabled={loading || !html}
						onClick={doPrint}
					>
						<span className="inline-flex items-center gap-2">
							<Printer size={15} /> In
						</span>
					</button>
				</>
			}
		>
			{loading ? (
				<div className="erp-table-loading">Đang dựng bản xem trước...</div>
			) : html ? (
				<div className="overflow-auto rounded-lg border border-slate-300 bg-[#6b7280]/20 p-4 shadow-inner">
					<div
						className="mx-auto max-w-[1000px] bg-white p-6 shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
						dangerouslySetInnerHTML={{ __html: html }}
					/>
				</div>
			) : (
				<p className="text-sm text-slate-500">Chưa có dữ liệu xem trước.</p>
			)}
			<iframe
				id={frameId}
				title="print-frame"
				style={{ display: "none" }}
				srcDoc={`<!doctype html><html lang="vi"><head><meta charset="utf-8" /><title>${esc(title)}</title><style>@page{size:A4 landscape;margin:8mm}body{font-family:Arial,sans-serif;color:#111;background:#fff}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11.5px;line-height:1.45}td{padding:5px 7px;vertical-align:top;word-break:break-word}</style></head><body>${html}</body></html>`}
			/>
		</RightDrawer>
	);
}
