import React, { forwardRef } from "react";
import { formatDate, formatNumber, formatProductName } from "../lib/utils";
import {
	numberToVietnameseWords,
	resolvePrintSigners,
	type CompanyPrintProfile,
} from "../lib/printTemplate";
import { DocumentPrintShell, DocumentSignatures } from "./DocumentPrintShell";

export interface AssemblyPrintOrder {
	code: string;
	orderDate: string;
	sourceModule?: string;
	status?: string;
	note?: string;
	bomCode?: string;
	bomVersion?: number;
	plannedQuantity?: number;
	actualQuantity?: number;
	componentWarehouseName?: string;
	outputWarehouseName?: string;
	sourceWarehouseName?: string;
	recoveryWarehouseName?: string;
	componentWarehouse?: { name?: string } | null;
	outputWarehouse?: { name?: string } | null;
	sourceWarehouse?: { name?: string } | null;
	recoveryWarehouse?: { name?: string } | null;
	output?: Record<string, any> | null;
	source?: Record<string, any> | null;
	outputs?: Array<Record<string, any>>;
	sources?: Array<Record<string, any>>;
	lines?: Array<Record<string, any>>;
	outputTotalValue?: number;
	sourceTotalValue?: number;
	[key: string]: any;
}

interface AssemblyDocumentProps {
	order: AssemblyPrintOrder;
	isDisassembly: boolean;
	company?: CompanyPrintProfile | null;
}

const rowName = (row: Record<string, any>) =>
	formatProductName(row.productName, row.packagingName) || row.name || "";

const lineName = (line: Record<string, any>) => {
	const product =
		line.componentProductName ??
		line.component?.products?.name ??
		line.productName;
	const packaging =
		line.componentName ?? line.component?.name ?? line.packagingName;
	return (
		formatProductName(product, packaging) ||
		line.name ||
		line.componentName ||
		""
	);
};

export const AssemblyDocument = forwardRef<
	HTMLDivElement,
	AssemblyDocumentProps
>(({ order, isDisassembly, company }, ref) => {
	const outputRows = order.outputs?.length
		? order.outputs
		: order.sources?.length
			? order.sources
			: [
					{
						...(order.output || order.source || {}),
						plannedQuantity: order.plannedQuantity,
					},
				];

	const componentRows = order.lines || [];
	const rows = [
		...outputRows
			.filter(row => row?.sku || row?.packagingName || row?.productName)
			.map((row, index) => {
				const quantity = Number(row.plannedQuantity ?? row.quantity ?? 0);
				const unitCost = Number(row.unitCost || 0);
				return {
					key: `output-${index}`,
					index: index + 1,
					type: isDisassembly ? "Nguồn" : "Thành phẩm",
					sku: row.sku || "",
					name: rowName(row),
					unit: row.unit || "",
					quantity,
					unitCost,
					amount: Number(row.totalValue ?? quantity * unitCost),
				};
			}),
		...componentRows.map((line, index) => {
			const quantity = Number(line.plannedQuantity ?? line.quantity ?? 0);
			const unitCost = Number(line.unitCost || 0);
			return {
				key: `line-${line.id ?? index}`,
				index: outputRows.length + index + 1,
				type: isDisassembly ? "Thành phẩm" : "Linh kiện",
				sku: line.componentSku || line.component?.sku || line.sku || "",
				name: lineName(line),
				unit: line.componentUnit || line.component?.unit || line.unit || "",
				quantity,
				unitCost,
				amount: Number(line.totalValue ?? quantity * unitCost),
			};
		}),
	];
	const total = rows
		.filter(row => row.type === (isDisassembly ? "Thành phẩm" : "Linh kiện"))
		.reduce((sum, row) => sum + row.amount, 0);
	const sourceWarehouse = isDisassembly
		? order.sourceWarehouse?.name || order.sourceWarehouseName
		: order.componentWarehouse?.name || order.componentWarehouseName;
	const targetWarehouse = isDisassembly
		? order.recoveryWarehouse?.name || order.recoveryWarehouseName
		: order.outputWarehouse?.name || order.outputWarehouseName;
	const signers = resolvePrintSigners(company, [
		{ code: "PREPARER", fallbackTitle: "Người lập" },
		{
			code: isDisassembly ? "WAREHOUSE_KEEPER_OUT" : "WAREHOUSE_KEEPER",
			fallbackTitle: isDisassembly ? "Thủ kho nguồn" : "Thủ kho",
		},
		...(isDisassembly
			? [
					{
						code: "WAREHOUSE_KEEPER_IN",
						fallbackTitle: "Thủ kho nhập",
					},
				]
			: [
					{
						code: "CHIEF_ACCOUNTANT",
						fallbackTitle: "Kế toán",
					},
				]),
		{ code: "DIRECTOR", fallbackTitle: "Giám đốc", note: "(Ký, đóng dấu)" },
	]);

	return (
		<DocumentPrintShell
			ref={ref}
			title={isDisassembly ? "LỆNH THÁO DỠ" : "LỆNH LẮP RÁP"}
			company={company}
		>
			<div className="mb-6 ml-6 space-y-3 text-sm">
				<div className="grid grid-cols-2 gap-x-8 gap-y-3">
					<div className="flex items-end">
						<span className="w-32">Mã lệnh:</span>
						<div className="ml-2 mb-1 flex-1 border-b border-dotted border-black font-bold uppercase">
							{order.code}
						</div>
					</div>
					<div className="flex items-end">
						<span className="w-24">Ngày lệnh:</span>
						<div className="ml-2 mb-1 flex-1 border-b border-dotted border-black font-bold">
							{formatDate(order.orderDate)}
						</div>
					</div>
					{/* <div className="flex items-end">
						<span className="w-32">
							{isDisassembly ? "Kho nguồn:" : "Kho linh kiện:"}
						</span>
						<div className="ml-2 mb-1 flex-1 border-b border-dotted border-black font-bold break-words">
							{sourceWarehouse || ""}
						</div>
					</div> */}
					{/* <div className="flex items-end">
						<span className="w-24">
							{isDisassembly ? "Kho thu hồi:" : "Kho thành phẩm:"}
						</span>
						<div className="ml-2 mb-1 flex-1 border-b border-dotted border-black font-bold break-words">
							{targetWarehouse || ""}
						</div>
					</div> */}
					{/* <div className="flex items-end">
						<span className="w-32">BOM:</span>
						<div className="ml-2 mb-1 flex-1 border-b border-dotted border-black">
							{order.bomCode
								? `${order.bomCode}${order.bomVersion ? ` (v${order.bomVersion})` : ""}`
								: ""}
						</div>
					</div> */}
				</div>
				<div className="flex items-end">
					<span className="w-32">Diễn giải:</span>
					<div className="ml-2 mb-1 flex-1 border-b border-dotted border-black break-words">
						{order.note || ""}
					</div>
				</div>
			</div>

			<table className="mt-8 w-full table-fixed border-collapse border border-black text-sm">
				<thead className="text-center">
					<tr className="bg-gray-50 text-[11px] uppercase">
						<th className="w-10 border border-black p-1 text-center font-bold">
							STT
						</th>
						<th className="w-20 border border-black p-1 text-center font-bold">
							Loại
						</th>
						<th className="w-24 border border-black p-1 text-center font-bold">
							Mã hàng
						</th>
						<th className="border border-black p-1 text-center font-bold">
							Tên hàng hóa
						</th>
						<th className="w-14 border border-black p-1 text-center font-bold">
							ĐVT
						</th>
						<th className="w-20 border border-black p-1 text-center font-bold">
							Số lượng
						</th>
						<th className="w-24 border border-black p-1 text-center font-bold">
							Đơn giá
						</th>
						<th className="w-28 border border-black p-1 text-center font-bold">
							Thành tiền
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map(row => (
						<tr key={row.key}>
							<td className="border border-black p-2 text-center">
								{row.index}
							</td>
							<td className="border border-black p-2 text-center">
								{row.type}
							</td>
							<td className="border border-black p-2 text-left font-mono text-xs break-words">
								{row.sku}
							</td>
							<td className="border border-black p-2 text-left break-words">
								{row.name}
							</td>
							<td className="border border-black p-2 text-center">
								{row.unit}
							</td>
							<td className="border border-black p-2 text-right">
								{formatNumber(row.quantity)}
							</td>
							<td className="border border-black p-2 text-right">
								{formatNumber(row.unitCost)}
							</td>
							<td className="border border-black p-2 text-right font-semibold">
								{formatNumber(row.amount)}
							</td>
						</tr>
					))}
					{!rows.length && (
						<tr>
							<td
								colSpan={8}
								className="border border-black p-4 text-center text-slate-500"
							>
								Không có dòng hàng hóa
							</td>
						</tr>
					)}
				</tbody>
				<tfoot>
					<tr className="bg-gray-50 font-bold">
						<td
							colSpan={6}
							className="border border-black p-2 text-right uppercase"
						>
							Tổng cộng
						</td>
						<td className="border border-black p-2"></td>
						<td className="border border-black p-2 text-right">
							{formatNumber(total)}
						</td>
					</tr>
				</tfoot>
			</table>

			{total > 0 && (
				<p className="mt-3 text-sm italic break-words">
					Tổng tiền bằng chữ: {numberToVietnameseWords(total)}
				</p>
			)}

			<DocumentSignatures signers={signers} />
		</DocumentPrintShell>
	);
});

AssemblyDocument.displayName = "AssemblyDocument";
