import React from "react";
import { PurchaseDocument } from "../types";
import { formatDate, formatNumber } from "../lib/utils";
import {
	numberToVietnameseWords,
	type CompanyPrintProfile,
} from "../lib/printTemplate";
import PrintAppFooter from "./PrintAppFooter";

interface PurchaseDocumentPrintProps {
	document: PurchaseDocument;
	company?: CompanyPrintProfile | null;
}

export const PurchaseDocumentPrint = React.forwardRef<
	HTMLDivElement,
	PurchaseDocumentPrintProps
>(({ document, company }, ref) => {
	const details = document.details || [];
	const totalQuantity = details.reduce(
		(sum, d) => sum + Number(d.quantity || 0),
		0,
	);
	const goodsAmount = Number(
		document.goodsAmount ??
			details.reduce(
				(sum, d) =>
					sum +
					Number(
						d.lineAmount ?? Number(d.quantity || 0) * Number(d.unitPrice || 0),
					),
				0,
			),
	);
	const taxAmount = Number(document.taxAmount || 0);
	const totalAmount = Number(document.totalAmount ?? goodsAmount + taxAmount);
	const date = document.documentDate
		? new Date(document.documentDate)
		: new Date();
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = date.getFullYear();
	const vatRate =
		Number(document.subtotal || 0) > 0
			? (Number(document.taxAmount || 0) / Number(document.subtotal || 0)) * 100
			: 0;
	const lineTotal = (d: (typeof details)[number]) =>
		Number(
			d.lineTotal ??
				Number(d.quantity || 0) *
					Number(d.unitPrice || 0) *
					(1 - Number(d.discountRate || 0) / 100),
		);
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
				<div className="text-right flex-shrink-0 ml-4">
					<img src={company?.logoUrl || "/images/logo.png"} width="120px"></img>
				</div>
			</div>

			{/* Title Section */}
			<div className="text-center mb-2">
				<h2 className="text-xl font-bold text-center mt-4 uppercase tracking-wide">
					CHỨNG TỪ MUA HÀNG
				</h2>
				<div className="flex justify-center gap-12 mt-1 text-sm">
					<p className="italic">
						Ngày {day} tháng {month} năm {year}
					</p>
					<p className="">Số: {document.code}</p>
				</div>
			</div>

			{/* Info Section */}
			<div className="flex items-baseline">
				<span className="w-28 font-medium">Nhà cung cấp:</span>
				<span className="border-b border-dotted border-black flex-1 font-bold">
					{document.supplierName || ""}
					{document.supplierTaxCode
						? ` — MST: ${document.supplierTaxCode}`
						: ""}
				</span>
			</div>
			<div className="space-y-2 text-sm">
				{document.deliveryPerson && (
					<div className="flex items-baseline">
						<span className="w-28 font-medium">Người giao:</span>
						<span className="border-b border-dotted border-black flex-1 font-bold">
							{document.deliveryPerson}
						</span>
					</div>
				)}
				{document.supplierAddress && (
					<div className="flex items-baseline">
						<span className="w-28 font-medium">Địa chỉ:</span>
						<span className="border-b border-dotted border-black flex-1">
							{document.supplierAddress}
						</span>
					</div>
				)}
				<div className="flex items-baseline">
					<span className="w-28 font-medium">Diễn giải:</span>
					<span className="border-b border-dotted border-black flex-1 italic">
						{document.description || ""}
					</span>
				</div>
			</div>

			{/* Table Section */}
			<table className="mt-4 w-full border-1 border-black text-[12px] mb-8 border-collapse">
				<thead>
					<tr className="bg-gray-200 border-b-1 border-black">
						<th className="border-r-1 border-black p-2 w-12 text-center uppercase tracking-tighter">
							STT
						</th>
						<th className="border-r-1 border-black p-2 w-24 text-center uppercase tracking-tighter">
							Mã hàng
						</th>
						<th className="border-r-1 border-black p-2 text-center uppercase tracking-tighter">
							Tên hàng hóa
						</th>
						<th className="border-r-1 border-black p-2 w-20 text-center uppercase tracking-tighter">
							ĐVT
						</th>
						<th className="border-r-1 border-black p-2 w-24 text-center uppercase tracking-tighter">
							Số lượng
						</th>
						<th className="border-r-1 border-black p-2 w-28 text-center uppercase tracking-tighter">
							Đơn giá
						</th>
						<th className="p-2 w-32 text-center uppercase tracking-tighter">
							Thành tiền
						</th>
					</tr>
				</thead>
				<tbody>
					{details.map((d, i) => {
						const amount = Number(
							d.lineAmount ??
								Number(d.quantity || 0) * Number(d.unitPrice || 0),
						);
						return (
							<tr key={d.id ?? i} className="border-b border-black">
								<td className="border-r-1 border-black p-2 text-center">
									{i + 1}
								</td>
								<td className="border-r-1 border-black p-2 text-center text-[10px]">
									{d.sku || d.packagingId}
								</td>
								<td className="border-r-1 border-black p-2 font-medium">
									{[d.productName].filter(Boolean).join(" - ") || "Sản phẩm"}
									{d.note && (
										<span className="block text-[11px] font-normal italic text-gray-700">
											{d.note}
										</span>
									)}
								</td>
								<td className="border-r-1 border-black p-2 text-center">
									{d.unit || ""}
								</td>
								<td className="border-r-1 border-black p-2 text-right font-bold pr-4">
									{formatNumber(Number(d.quantity || 0))}
								</td>
								<td className="border-r-1 border-black p-2 text-right pr-4">
									{formatNumber(Number(d.unitPrice || 0))}
								</td>
								<td className="p-2 text-right font-bold pr-4">
									{formatNumber(amount)}
								</td>
							</tr>
						);
					})}
				</tbody>
				<tfoot>
					<tr className="font-bold bg-gray-100 uppercase italic">
						<td colSpan={6} className="border-r-1 border-black p-2 text-center">
							TỔNG CỘNG
						</td>
						{/* <td className="border-r-1 border-black p-2 text-right pr-4 text-sm font-black">
							{formatNumber(totalQuantity)}
						</td> */}
						{/* <td className="border-r-1 border-black p-2 text-right pr-4">
							Cộng tiền hàng
						</td> */}
						<td className="p-2 text-center pr-4 font-black">
							{formatNumber(goodsAmount)}
						</td>
					</tr>
					{taxAmount > 0 && (
						<tr className="font-bold bg-gray-100 italic">
							<td
								colSpan={6}
								className="border-r-1 border-black p-2 text-right pr-4"
							>
								Thuế (VAT){vatRate > 0 ? ` ${formatNumber(vatRate)}%` : ""}
							</td>
							<td className="p-2 text-center pr-4 font-black">
								{formatNumber(taxAmount)}
							</td>
						</tr>
					)}
					<tr className="font-bold bg-gray-100 uppercase italic">
						<td
							colSpan={6}
							className="border-r-2 border-black p-2 text-right pr-4"
						>
							Tổng tiền thanh toán
						</td>
						<td className="p-2 text-right pr-4 text-sm font-black">
							{formatNumber(totalAmount)}
						</td>
					</tr>
				</tfoot>
			</table>

			<div className="text-sm italic mb-8">
				<span className="text-gray-700">Số tiền bằng chữ: </span>
				<span className="font-semibold">
					{numberToVietnameseWords(totalAmount)}
				</span>
			</div>

			{/* Footer Section - Signatures */}
			<div className="grid grid-cols-3 gap-4 text-center text-sm font-medium mt-12 pb-12">
				<div className="space-y-16">
					<div>
						<p className="font-bold">Người lập phiếu</p>
						<p className="italic text-[11px]">(Ký, họ tên)</p>
					</div>
					<p className="font-bold uppercase text-[12px]">
						{document.creatorName || ""}
					</p>
				</div>
				<div>
					<p className="font-bold">Người giao hàng</p>
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

PurchaseDocumentPrint.displayName = "PurchaseDocumentPrint";
