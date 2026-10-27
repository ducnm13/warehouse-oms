import React from "react";
import { SalesReturnV1 } from "../types";
import { formatDate, formatNumber, formatProductName } from "../lib/utils";
import {
	numberToVietnameseWords,
	resolvePrintSigners,
	type CompanyPrintProfile,
} from "../lib/printTemplate";
import PrintAppFooter from "./PrintAppFooter";
import { DocumentSignatures } from "./DocumentPrintShell";

interface SalesReturnDocumentProps {
	document: SalesReturnV1;
	company?: CompanyPrintProfile | null;
}

export const SalesReturnDocument = React.forwardRef<
	HTMLDivElement,
	SalesReturnDocumentProps
>(({ document, company }, ref) => {
	const lines = document.lines || [];
	const date = new Date(document.returnDate);
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = date.getFullYear();
	const vatRate =
		Number(document.subtotal || 0) > 0
			? (Number(document.taxAmount || 0) / Number(document.subtotal || 0)) * 100
			: 0;
	const signers = resolvePrintSigners(company, [
		{ code: "PREPARER", fallbackTitle: "Người lập phiếu" },
		{ code: "WAREHOUSE_KEEPER", fallbackTitle: "Thủ kho" },
		{ code: "CHIEF_ACCOUNTANT", fallbackTitle: "Kế toán" },
		{ code: "CUSTOMER", fallbackTitle: "Khách hàng" },
	]);

	return (
		<div
			ref={ref}
			className="p-16 text-black bg-white font-serif leading-relaxed"
			style={{ fontFamily: '"Montserrat", sans-serif' }}
		>
			<div className="flex justify-between items-start mb-6">
				<div className="text-[11px] leading-tight flex-1">
					<h1 className="font-bold uppercase text-[13px] mb-1">
						{company?.name || "CÔNG TY TNHH SX-TM-DV CHALLENGE"}
					</h1>
					{(company?.address
						? company.address
								.split(/\\n|\r?\n/)
								.map(line => line.trim())
								.filter(Boolean)
						: [
								"Trụ sở chính: 159 Hùng Vương, phường Đạo Thạnh, tỉnh Đồng Tháp",
								"Nhà máy: 260 Nguyễn Quân, phường Đạo Thạnh, tỉnh Đồng Tháp",
							]
					).map((line, index) => (
						<p key={index}>
							<i>{line}</i>
						</p>
					))}
				</div>
				<div className="text-right flex-shrink-0 ml-4">
					<img src={company?.logoUrl || "/images/logo.png"} width="120px" />
				</div>
			</div>
			<h1 className="text-xl font-bold text-center mt-6 uppercase tracking-wide">
				PHIẾU TRẢ HÀNG
			</h1>
			<div className="text-center text-[12px]">
				<p className="italic font-medium">
					Ngày {day} tháng {month} năm {year}
				</p>
				<p className="font-semibold">Số: {document.code}</p>
				{document.originalSalesOrderCode && (
					<p className="text-[11px] text-gray-600">
						Đơn bán gốc: {document.originalSalesOrderCode}
					</p>
				)}
			</div>

			<div className="mb-2 space-y-3 text-sm">
				<div className="flex items-end">
					<span>Khách hàng:</span>
					<span className="font-medium pl-1 uppercase">
						{document.customerName || ""}
					</span>
				</div>
				<div className="grid grid-cols-2 gap-0">
					<div className="flex items-end">
						<span>Kho nhận:</span>
						<span className="font-medium pl-1">{document.warehouseName || ""}</span>
					</div>
					<div className="flex items-end">
						<span>Ngày trả:</span>
						<span className="font-medium pl-1">{formatDate(document.returnDate)}</span>
					</div>
				</div>
				<div className="flex items-end">
					<span>Lý do trả:</span>
					<span className="font-medium pl-1">{document.reason || ""}</span>
				</div>
			</div>

			<div className="mb-0 text-[12px]">
				<table className="w-full border-collapse border border-black">
					<thead>
						<tr className="bg-gray-50 uppercase">
							<th className="border border-black p-2 font-bold text-center w-10">
								STT
							</th>
							<th className="border border-black p-2 font-bold text-center">
								Hàng hóa
							</th>
							<th className="border border-black p-2 font-bold text-center w-16">
								ĐVT
							</th>
							<th className="border border-black p-2 font-bold text-center w-20">
								SL trả
							</th>
							<th className="border border-black p-2 font-bold text-center w-24">
								Đơn giá
							</th>
							<th className="border border-black p-2 font-bold text-center w-28">
								Thành tiền
							</th>
						</tr>
					</thead>
					<tbody>
						{lines.map((line, index) => (
							<tr key={line.id ?? index}>
								<td className="border border-black py-1 text-center">{index + 1}</td>
								<td className="border border-black py-1 pl-1 font-medium text-left">
									{formatProductName(line.productName, line.packagingName) ||
										line.sku}
									{line.note && (
										<span className="block text-xs font-normal italic text-gray-600">
											{line.note}
										</span>
									)}
								</td>
								<td className="border border-black py-1 text-center">
									{line.unit || ""}
								</td>
								<td className="border border-black py-1 text-center font-medium">
									{formatNumber(Number(line.quantity || 0))}
								</td>
								<td className="border border-black py-1 px-2 text-right">
									{formatNumber(Number(line.unitPrice || 0))}
								</td>
								<td className="border border-black py-1 px-2 text-right font-medium">
									{formatNumber(Number(line.lineTotal || 0))}
								</td>
							</tr>
						))}
						<tr className="bg-gray-50 font-bold">
							<td colSpan={5} className="border border-black p-1 text-center">
								Cộng tiền hàng
							</td>
							<td className="border border-black p-1 text-right font-bold">
								{formatNumber(Number(document.subtotal || 0))}
							</td>
						</tr>
						<tr className="bg-gray-50 font-bold">
							<td colSpan={5} className="border border-black p-1 text-center">
								Thuế (VAT){vatRate > 0 ? ` ${formatNumber(vatRate)}%` : ""}
							</td>
							<td className="border border-black p-1 text-right font-bold">
								{formatNumber(Number(document.taxAmount || 0))}
							</td>
						</tr>
						<tr className="bg-gray-50 font-bold">
							<td colSpan={5} className="border border-black p-1 text-center">
								Giá trị trả (giảm trừ công nợ)
							</td>
							<td className="border border-black p-1 text-right font-bold">
								{formatNumber(Number(document.totalAmount || 0))}
							</td>
						</tr>
					</tbody>
				</table>
				<div className="mt-2 space-y-1 text-sm italic">
					<div>
						<span className="text-gray-700">Số tiền bằng chữ: </span>
						<span className="font-semibold">
							{numberToVietnameseWords(Number(document.totalAmount || 0))}
						</span>
					</div>
					<p className="text-[12px] text-gray-700">
						Giá trị trả được giảm trừ công nợ. Phần vượt công nợ được ghi nhận
						thành số dư có của khách và tự động trừ vào đơn bán tiếp theo.
					</p>
				</div>
			</div>

			<DocumentSignatures signers={signers} />
			<PrintAppFooter />
		</div>
	);
});

SalesReturnDocument.displayName = "SalesReturnDocument";
