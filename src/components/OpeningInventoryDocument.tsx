import React, { forwardRef } from "react";
import { formatDate, formatNumber, formatProductName } from "../lib/utils";
import {
	numberToVietnameseWords,
	resolvePrintSigners,
	type CompanyPrintProfile,
} from "../lib/printTemplate";
import {
	DocumentPrintShell,
	DocumentSignatures,
} from "./DocumentPrintShell";

interface OpeningInventoryLine {
	id?: number;
	packagingId: number;
	quantity: number;
	unitCost: number;
	totalValue?: number;
	batchNumber?: string;
	expiryDate?: string;
	note?: string;
	packagingName?: string;
	productName?: string;
	sku?: string;
	unit?: string;
	packaging?: {
		id: number;
		name: string;
		sku?: string | null;
		unit?: string | null;
		products?: { name: string } | null;
	} | null;
}

export interface OpeningInventoryPrintData {
	id: number;
	code: string;
	documentDate: string;
	warehouse?: { id: number; name: string } | null;
	note?: string;
	lines: OpeningInventoryLine[];
}

interface OpeningInventoryDocumentProps {
	document: OpeningInventoryPrintData;
	company?: CompanyPrintProfile | null;
}

export const OpeningInventoryDocument = forwardRef<
	HTMLDivElement,
	OpeningInventoryDocumentProps
>(({ document, company }, ref) => {
	const lines = document.lines || [];
	const total = lines.reduce(
		(sum, line) =>
			sum +
			Number(line.totalValue ?? Number(line.quantity || 0) * Number(line.unitCost || 0)),
		0,
	);
	const signers = resolvePrintSigners(company, [
		{ code: "PREPARER", fallbackTitle: "Người lập" },
		{ code: "WAREHOUSE_KEEPER", fallbackTitle: "Thủ kho" },
		{ code: "CHIEF_ACCOUNTANT", fallbackTitle: "Kế toán" },
		{ code: "DIRECTOR", fallbackTitle: "Giám đốc", note: "(Ký, đóng dấu)" },
	]);

	return (
		<DocumentPrintShell
			ref={ref}
			title="BIÊN BẢN TỒN ĐẦU KỲ"
			company={company}
		>
			<div className="mb-6 ml-6 space-y-3 text-sm">
				<div className="grid grid-cols-2 gap-x-8 gap-y-3">
					<div className="flex items-end">
						<span className="w-32">Mã phiếu:</span>
						<div className="ml-2 mb-1 flex-1 border-b border-dotted border-black font-bold uppercase">
							{document.code}
						</div>
					</div>
					<div className="flex items-end">
						<span className="w-24">Ngày lập:</span>
						<div className="ml-2 mb-1 flex-1 border-b border-dotted border-black font-bold">
							{formatDate(document.documentDate)}
						</div>
					</div>
					<div className="flex items-end">
						<span className="w-32">Kho:</span>
						<div className="ml-2 mb-1 flex-1 border-b border-dotted border-black font-bold break-words">
							{document.warehouse?.name || ""}
						</div>
					</div>
				</div>
				<div className="flex items-end">
					<span className="w-32">Diễn giải:</span>
					<div className="ml-2 mb-1 flex-1 border-b border-dotted border-black break-words">
						{document.note || ""}
					</div>
				</div>
			</div>

			<table className="mt-8 w-full table-fixed border-collapse border border-black text-sm">
				<thead className="text-center">
					<tr className="bg-gray-50 text-[11px] uppercase">
						<th className="w-10 border border-black p-1 text-center font-bold">
							STT
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
							Đơn giá vốn
						</th>
						<th className="w-28 border border-black p-1 text-center font-bold">
							Thành tiền
						</th>
					</tr>
				</thead>
				<tbody>
					{lines.map((line, index) => {
						const amount = Number(
							line.totalValue ??
								Number(line.quantity || 0) * Number(line.unitCost || 0),
						);
						return (
							<tr key={line.id ?? index}>
								<td className="border border-black p-2 text-center">
									{index + 1}
								</td>
								<td className="border border-black p-2 text-left font-mono text-xs break-words">
									{line.sku || line.packaging?.sku || ""}
								</td>
								<td className="border border-black p-2 text-left break-words">
									{formatProductName(
										line.productName ?? line.packaging?.products?.name,
										line.packagingName ?? line.packaging?.name,
									)}
									{line.batchNumber && (
										<small className="block text-[10px] text-slate-600">
											Lô: {line.batchNumber}
										</small>
									)}
								</td>
								<td className="border border-black p-2 text-center">
									{line.unit || line.packaging?.unit || ""}
								</td>
								<td className="border border-black p-2 text-right">
									{formatNumber(line.quantity || 0)}
								</td>
								<td className="border border-black p-2 text-right">
									{formatNumber(line.unitCost || 0)}
								</td>
								<td className="border border-black p-2 text-right font-semibold">
									{formatNumber(amount)}
								</td>
							</tr>
						);
					})}
					{!lines.length && (
						<tr>
							<td
								colSpan={7}
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
							colSpan={5}
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

OpeningInventoryDocument.displayName = "OpeningInventoryDocument";
