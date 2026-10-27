import React, { forwardRef } from "react";
import { formatDate, formatNumber } from "../lib/utils";
import type { CompanyPrintProfile } from "../lib/printTemplate";
import type { StocktakeV1 } from "../types";
import PrintAppFooter from "./PrintAppFooter";

interface StocktakeDocumentProps {
	stocktake: StocktakeV1;
	company?: CompanyPrintProfile | null;
}

export const StocktakeDocument = forwardRef<
	HTMLDivElement,
	StocktakeDocumentProps
>(({ stocktake, company }, ref) => {
	const details = stocktake.details || [];
	const companyAddress = (company?.address || "")
		.split(/\\n|\r?\n/)
		.map(line => line.trim())
		.filter(Boolean);

	const differenceClass = (value: number) =>
		value > 0
			? "text-emerald-700"
			: value < 0
				? "text-red-600"
				: "text-slate-500";

	const signedDifference = (value: number) =>
		`${value > 0 ? "+" : ""}${formatNumber(value)}`;

	return (
		<div
			ref={ref}
			className="sales-print-view min-h-[297mm] bg-white p-16 font-serif leading-relaxed text-black"
			style={{ fontFamily: '"Montserrat", sans-serif' }}
		>
			<div className="mb-6 flex items-start justify-between">
				<div className="flex-1 text-[11px] leading-tight">
					<h1 className="text-[14px] font-bold uppercase">
						{company?.name || "CÔNG TY TNHH SX-TM-DV CHALLENGE"}
					</h1>
					{(companyAddress.length
						? companyAddress
						: [
								"Trụ sở chính: 159 Hưng Vượng, phường Đạo Thạnh, tỉnh Đồng Tháp",
								"Nhà máy: 260 Nguyễn Quân, phường Đạo Thạnh, tỉnh Đồng Tháp",
							]
					).map((line, index) => (
						<p key={index}>
							<i>{line}</i>
						</p>
					))}
					{company?.taxCode && (
						<p>
							<i>Mã số thuế: {company.taxCode}</i>
						</p>
					)}
					{company?.phone && (
						<p>
							<i>Điện thoại: {company.phone}</i>
						</p>
					)}
				</div>
				<div className="ml-4 flex-shrink-0 text-right">
					<img
						src={company?.logoUrl || "/images/logo.png"}
						width="120px"
						alt="Logo"
					/>
				</div>
			</div>

			<h1 className="mb-8 mt-6 text-center text-xl font-bold uppercase tracking-wide">
				BIÊN BẢN KIỂM KÊ KHO
			</h1>

			<div className="mb-6 ml-6 space-y-3 text-sm">
				<div className="grid grid-cols-2 gap-x-8 gap-y-3">
					<div className="flex items-end">
						<span className="w-32">Mã phiếu kiểm kê:</span>
						<div className="ml-2 mb-1 flex-1 border-b border-dotted border-black font-bold uppercase">
							{stocktake.code}
						</div>
					</div>
					<div className="flex items-end">
						<span className="w-24">Ngày kiểm kê:</span>
						<div className="ml-2 mb-1 flex-1 border-b border-dotted border-black font-bold">
							{formatDate(stocktake.date)}
						</div>
					</div>
					<div className="flex items-end">
						<span className="w-32">Kho kiểm kê:</span>
						<div className="ml-2 mb-1 flex-1 border-b border-dotted border-black font-bold">
							{stocktake.warehouseName || ""}
						</div>
					</div>
					<div className="flex items-end">
						<span className="w-24">Người lập:</span>
						<div className="ml-2 mb-1 flex-1 border-b border-dotted border-black">
							{stocktake.creatorName || ""}
						</div>
					</div>
				</div>
				<div className="flex items-end">
					<span className="w-32">Diễn giải:</span>
					<div className="ml-2 mb-1 flex-1 border-b border-dotted border-black">
						{stocktake.note || ""}
					</div>
				</div>
			</div>

			<table className="mt-8 w-full border-collapse border border-black text-sm">
				<thead className="text-center">
					<tr className="bg-gray-50 text-[11px] uppercase">
						<th className="w-10 border border-black p-1 text-center font-bold">
							STT
						</th>
						<th className="w-28 border border-black p-1 text-center font-bold">
							Mã hàng
						</th>
						<th className="border border-black p-1 text-center font-bold">
							Hàng hóa
						</th>
						<th className="w-16 border border-black p-1 text-center font-bold">
							ĐVT
						</th>
						<th className="w-24 border border-black p-1 text-right font-bold">
							Tồn sổ
						</th>
						<th className="w-24 border border-black p-1 text-right font-bold">
							Thực tế
						</th>
						<th className="w-24 border border-black p-1 text-right font-bold">
							Chênh lệch
						</th>
						<th className="w-32 border border-black p-1 text-center font-bold">
							Ghi chú
						</th>
					</tr>
				</thead>
				<tbody>
					{details.map((line, index) => {
						const difference = Number(line.difference || 0);
						return (
							<tr key={line.id ?? index}>
								<td className="border border-black p-2 text-center">
									{index + 1}
								</td>
								<td className="border border-black p-2 text-left font-mono text-xs">
									{line.sku || ""}
								</td>
								<td className="border border-black p-2 text-left">
									<b>{line.productName}</b>
									{/* {line.packagingName && (
										<small className="block text-slate-600">
											{line.packagingName}
										</small>
									)} */}
								</td>
								<td className="border border-black p-2 text-center">
									{line.unit || ""}
								</td>
								<td className="border border-black p-2 text-right">
									{formatNumber(line.expectedQuantity)}
								</td>
								<td className="border border-black p-2 text-right font-semibold">
									{formatNumber(line.actualQuantity)}
								</td>
								<td
									className={`border border-black p-2 text-right font-bold ${differenceClass(difference)}`}
								>
									{signedDifference(difference)}
								</td>
								<td className="border border-black p-2 text-left text-xs"></td>
							</tr>
						);
					})}
					{!details.length && (
						<tr>
							<td
								colSpan={8}
								className="border border-black p-4 text-center text-slate-500"
							>
								Không có dòng kiểm kê
							</td>
						</tr>
					)}
				</tbody>
			</table>

			<div className="mb-20 mt-16 flex justify-around text-sm italic">
				<div className="text-center">
					<p className="font-bold uppercase not-italic">Người lập</p>
					<p className="text-xs">(Ký, họ tên)</p>
				</div>
				<div className="text-center">
					<p className="font-bold uppercase not-italic">Thủ kho</p>
					<p className="text-xs">(Ký, họ tên)</p>
				</div>
				{/* <div className="text-center">
						<p className="font-bold uppercase not-italic">Kế toán</p>
						<p className="text-xs">(Ký, họ tên)</p>
					</div> */}
				<div className="text-center">
					<p className="font-bold uppercase not-italic">Quản đốc</p>
					<p className="text-xs">(Ký, đóng dấu)</p>
				</div>
			</div>
			<PrintAppFooter />
		</div>
	);
});

StocktakeDocument.displayName = "StocktakeDocument";
