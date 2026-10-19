import React from "react";
import { Transaction, InventoryDocumentV1 } from "../types";
import { formatDate, formatNumber } from "../lib/utils";
import type { CompanyPrintProfile } from "../lib/printTemplate";
import PrintAppFooter from "./PrintAppFooter";

interface InventoryDocumentProps {
	transaction: Transaction | InventoryDocumentV1;
	company?: CompanyPrintProfile | null;
}

export const InventoryDocument = React.forwardRef<
	HTMLDivElement,
	InventoryDocumentProps
>(({ transaction, company }, ref) => {
	// Chuẩn hóa 2 kiểu dữ liệu (legacy Transaction và InventoryDocumentV1)
	const t: any = transaction;
	const type = t.type;
	const code = t.code;
	const txnDate = t.transactionDate || t.transaction_date || "";
	const inoutDate = t.entry_date || t.exit_date || t.postedAt || txnDate;
	const partner = t.customerName || t.recipient || "";
	const reasonText = t.note || t.reason || "";
	const warehouseName = t.warehouseName || "";
	const creatorName = t.creatorName || "";
	const details: any[] = t.details || [];
	const totalQuantity = details.reduce(
		(sum, d) => sum + Number(d.quantity || 0),
		0,
	);
	const dateOrEmpty = (v?: string) => (v ? formatDate(v) : "");

	return (
		<div
			ref={ref}
			className="p-8 bg-white text-black print:p-0"
			style={{
				minWidth: "800px",
				fontFamily: '"Montserrat", sans-serif',
			}}
		>
			{/* Header Section — đồng bộ từ bảng company_profiles */}
			<div className="flex justify-between items-start mb-6">
				<div className="text-[11px] leading-tight flex-1">
					<h1 className="font-bold uppercase text-[14px]">
						{company?.name || "CÔNG TY TNHH SX-TM-DV CHALLENGE"}
					</h1>
					{(company?.address
						? company.address
								.split(/\\n|\r?\n/)
								.map(l => l.trim())
								.filter(Boolean)
						: [
								"Trụ sở chính: 159 Hùng Vương, phường Đạo Thạnh, tỉnh Đồng Tháp",
								"Nhà máy: 260 Nguyễn Quân, phường Đạo Thạnh, tỉnh Đồng Tháp",
							]
					).map((line, i) => (
						<p key={i}>
							<i>{line}</i>
						</p>
					))}
					{company?.taxCode && (
						<p>
							<i>Mã số thuế: {company.taxCode}</i>
						</p>
					)}
					{company?.website && (
						<p>
							<i>Website: {company.website}</i>
						</p>
					)}
				</div>
				{(company?.logoUrl || "/images/logo.png") && (
					<div className="text-right flex-shrink-0 ml-4">
						<img
							src={company?.logoUrl || "/images/logo.png"}
							width="120px"
						></img>
					</div>
				)}
			</div>

			{/* Title Section */}
			<div className="text-center mb-2">
				<h2 className="text-xl font-bold text-center mt-6 uppercase tracking-wide">
					PHIẾU {type === "IMPORT" ? "NHẬP" : "XUẤT"} KHO
				</h2>
				<div className="flex justify-center gap-12 mt-2 text-sm">
					<p className="italic">Ngày lập: {dateOrEmpty(txnDate)}</p>
					{/* <p className="font-bold">
						{type === "IMPORT" ? "Ngày nhập: " : "Ngày xuất: "}
						{dateOrEmpty(inoutDate)}
					</p> */}
					<p className="">Số: {code}</p>
				</div>
			</div>

			{/* Info Section */}
			<div className="flex items-baseline">
				<span className="w-24 font-medium">
					{type === "IMPORT" ? "Người giao:" : "Nơi nhận:"}
				</span>
				<span className="border-b border-dotted border-black flex-1 font-bold">
					{partner || ""}
				</span>
			</div>
			<div className="mb- space-y-2 text-sm">
				{warehouseName && (
					<div className="flex items-baseline">
						<span className="w-24 font-medium">Kho:</span>
						<span className="border-b border-dotted border-black flex-1 font-bold">
							{warehouseName}
						</span>
					</div>
				)}
				<div className="flex items-baseline">
					<span className="w-24 font-medium">Diễn giải:</span>
					<span className="border-b border-dotted border-black flex-1 italic">
						{reasonText || ""}
					</span>
				</div>
			</div>

			{/* Table Section */}
			<table className="mt-4 w-full border-2 border-black text-[12px] mb-8 border-collapse">
				<thead>
					<tr className="bg-gray-200 border-b-2 border-black">
						<th className="border-r-2 border-black p-2 w-12 text-center uppercase tracking-tighter">
							STT
						</th>
						<th className="border-r-2 border-black p-2 text-left uppercase tracking-tighter">
							Tên hàng hóa
						</th>
						<th className="border-r-2 border-black p-2 w-24 text-center uppercase tracking-tighter">
							Mã hàng
						</th>
						<th className="border-r-2 border-black p-2 w-20 text-center uppercase tracking-tighter">
							Đơn vị
						</th>
						<th className="border-r-2 border-black p-2 w-24 text-center uppercase tracking-tighter">
							Số lượng
						</th>
						<th className="p-2 w-32 text-left uppercase tracking-tighter">
							Ghi chú
						</th>
					</tr>
				</thead>
				<tbody>
					{details.map((d, i) => (
						<tr key={i} className="border-b border-black">
							<td className="border-r-2 border-black p-2 text-center">
								{i + 1}
							</td>
							<td className="border-r-2 border-black p-2 font-medium">
								{d.productName || "Sản phẩm"} - {d.packagingName || "Quy cách"}
							</td>
							<td className="border-r-2 border-black p-2 text-center font-mono text-[10px]">
								{d.sku || d.packagingId}
							</td>
							<td className="border-r-2 border-black p-2 text-center uppercase">
								{d.unit || d.packagingName?.split(" ").pop() || "Gói"}
							</td>
							<td className="border-r-2 border-black p-2 text-right font-bold pr-4">
								{formatNumber(d.quantity)}
							</td>
							<td className="p-2 italic text-gray-800 text-[11px] font-medium">
								{(d as any).note || ""}
							</td>
						</tr>
					))}
					{/* Empty rows removed per user request */}
				</tbody>
				<tfoot>
					<tr className="font-bold bg-gray-100 uppercase italic">
						<td colSpan={4} className="border-r-2 border-black p-2 text-center">
							CỘNG
						</td>
						<td className="border-r-2 border-black p-2 text-right pr-4 text-sm font-black">
							{formatNumber(totalQuantity)}
						</td>
						<td className="p-2"></td>
					</tr>
				</tfoot>
			</table>

			{/* Footer Section - Signatures */}
			<div className="grid grid-cols-3 gap-4 text-center text-sm font-medium mt-12 pb-12">
				<div className="space-y-16">
					<div>
						<p className="font-bold">Người lập phiếu</p>
						<p className="italic text-[11px]">(Ký, họ tên)</p>
					</div>
					<p className="font-bold uppercase text-[12px]">{creatorName}</p>
				</div>
				<div>
					<p className="font-bold">Người nhận hàng</p>
					<p className="italic text-[11px]">(Ký, họ tên)</p>
				</div>
				<div>
					<p className="font-bold">Quản đốc</p>
					<p className="italic text-[11px]">(Ký, họ tên)</p>
				</div>
			</div>

			<PrintAppFooter />

			{/* Print Styles */}
			<style
				dangerouslySetInnerHTML={{
					__html: `
          @media print {
            body { background: white !important; }
            .no-print { display: none !important; }
            @page { margin: 15mm; size: auto; }
          }
        `,
				}}
			/>
		</div>
	);
});

InventoryDocument.displayName = "InventoryDocument";
