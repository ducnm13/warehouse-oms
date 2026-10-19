import React, { useState } from "react";
import { ProductionOrderV1 } from "../types";
import { formatNumber, formatDate } from "../lib/utils";
import type { CompanyPrintProfile } from "../lib/printTemplate";

interface ProductionDocumentProps {
	order: ProductionOrderV1;
	company?: CompanyPrintProfile | null;
}

// Số chốt lưu theo GÓI → cột Hộp/túi = gói / packCount, cột Quy đổi = gói
const packsPerBox = (packCount?: number) => {
	const pc = Number(packCount || 0);
	return pc > 0 ? pc : 1;
};

export const ProductionDocument = React.forwardRef<
	HTMLDivElement,
	ProductionDocumentProps
>(({ order, company }, ref) => {
	// KHÓA THỜI GIAN IN: Chỉ lấy thời gian 1 lần duy nhất khi mở phiếu
	const [printTime] = useState(() => {
		const now = new Date();
		return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} ngày ${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
	});
	const outputs = order.outputs || [];
	const hasSavedActualQuantity = outputs.some(
		detail => (Number(detail.actualQuantity) || 0) > 0,
	);
	// Lệnh đã chốt: ưu tiên thực tế, chưa có thực tế thì dùng kế hoạch
	const getDisplayedPacks = (detail: (typeof outputs)[number]) =>
		order.status === "COMPLETED"
			? hasSavedActualQuantity
				? Number(detail.actualQuantity) || 0
				: Number(detail.plannedQuantity) || 0
			: Number(detail.plannedQuantity) || 0;

	const rows = outputs.filter(d => getDisplayedPacks(d) > 0);
	const totalBoxes = rows.reduce(
		(sum, d) => sum + getDisplayedPacks(d) / packsPerBox(d.packCount),
		0,
	);
	const totalPacks = rows.reduce((sum, d) => sum + getDisplayedPacks(d), 0);
	const mainOutput = outputs[0];
	const dateOrDots = (v?: string) =>
		v ? formatDate(v) : "....................";

	return (
		<div
			ref={ref}
			className="p-16 text-black bg-white min-h-[297mm] font-serif leading-relaxed"
			style={{ fontFamily: '"Montserrat", sans-serif' }}
		>
			<div className="text-right text-[10px] italic text-gray-600 mb-2">
				{/* Thời gian in: {printTime} */}
			</div>

			{/* Header Section — đồng bộ từ bảng company_profiles */}
			<div className="flex justify-between items-start mb-6">
				<div className="text-[11px] leading-tight flex-1">
					<h1 className="font-bold uppercase text-[14px]">
						{company?.name || "CÔNG TY TNHH SX-TM-DV CHALLENGE"}
					</h1>
					<p>
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
					</p>
					<p>
						{company?.taxCode && (
							<p>
								<i>Mã số thuế: {company.taxCode}</i>
							</p>
						)}
					</p>
					<p>
						{company?.website && (
							<p>
								<i>Website: {company.website}</i>
							</p>
						)}
					</p>
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
			<h1 className="text-xl font-bold text-center mt-6 uppercase tracking-wide">
				BÁO CÁO BÁN THÀNH PHẨM SẢN XUẤT
			</h1>

			{/* Section 1: Thông tin sản xuất */}
			<div className="mb-8 space-y-3 text-sm mt-6">
				<h3 className="font-bold underline italic">1. THÔNG TIN SẢN XUẤT</h3>
				<div className="grid grid-cols-2 gap-2 ml-6">
					<div className="flex items-end">
						<span>Lệnh sản xuất số:</span>
						<div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
							{order.code}
						</div>
					</div>
					<div className="flex items-end">
						<span>Số lô sản xuất:</span>
						<div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold uppercase">
							{order.batchNumber || "...................."}
						</div>
					</div>
					<div className="flex items-end">
						<span>Ngày tạo lệnh:</span>
						<div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
							{dateOrDots(order.orderDate)}
						</div>
					</div>
					<div className="flex items-end">
						<span>Số lượng:</span>
						<div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
							{formatNumber(
								(order.targetSachets || 0) > 0
									? order.targetSachets || 0
									: order.totalSachets || 0,
							)}{" "}
							gói
						</div>
					</div>
				</div>
				<div className="grid grid-cols-1 gap-2 ml-6">
					<div className="flex items-end">
						<span>Tên thành phẩm:</span>
						<div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
							{order.productName || mainOutput?.packagingName || ""}
						</div>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-2 ml-6">
					<div className="flex items-end">
						<span>Ngày sản xuất:</span>
						<div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
							{dateOrDots(order.mfgDate)}
						</div>
					</div>
					<div className="flex items-end">
						<span>Hạn sử dụng:</span>
						<div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
							{dateOrDots(order.expDate)}
						</div>
					</div>
				</div>
				<div className="grid grid-cols-1 gap-2 ml-6">
					<div className="flex items-end">
						<span>Diễn giải:</span>
						<div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
							{order.productName || mainOutput?.packagingName || ""}
						</div>
					</div>
				</div>
			</div>

			{/* Section 2: Quá trình sản xuất */}
			<div className="mb-10 text-sm">
				<h3 className="font-bold underline italic mb-4">
					2. QUÁ TRÌNH SẢN XUẤT
				</h3>
				<table className="w-full border-collapse border border-black">
					<thead>
						<tr className="bg-gray-50 uppercase text-[11px]">
							<th className="border border-black p-2 font-bold text-center">
								Sản phẩm
							</th>
							<th className="border border-black p-2 font-bold text-center w-24">
								Ngày sản xuất
							</th>
							<th className="border border-black p-2 font-bold text-center w-24">
								Hạn sử dụng
							</th>
							<th className="border border-black p-2 font-bold text-center w-24">
								Số lượng (Hộp/túi)
							</th>
							<th className="border border-black p-2 font-bold text-center w-28">
								Quy đổi (Gói)
							</th>
							<th className="border border-black p-2 font-bold text-center w-32">
								Ghi chú
							</th>
						</tr>
					</thead>
					<tbody>
						{rows.map((d, i) => {
							const packs = getDisplayedPacks(d);
							const boxes = packs / packsPerBox(d.packCount);
							return (
								<tr key={d.id ?? i}>
									<td className="border border-black p-3 font-bold text-left">
										{d.packagingName}
									</td>
									<td className="border border-black p-3 text-center">
										{dateOrDots(order.mfgDate)}
									</td>
									<td className="border border-black p-3 text-center">
										{dateOrDots(order.expDate)}
									</td>
									<td className="border border-black p-3 text-center font-bold">
										{formatNumber(boxes)}
									</td>
									<td className="border border-black p-3 text-center font-bold">
										{formatNumber(packs)}
									</td>
									<td className="border border-black p-3 text-xs italic text-gray-800 font-medium">
										{d.note || ""}
									</td>
								</tr>
							);
						})}
						<tr className="bg-gray-50 font-bold uppercase text-[14px]">
							<td
								colSpan={3}
								className="border border-black p-3 text-center font"
							>
								Tổng cộng sản lượng
							</td>
							<td className="border border-black p-3 text-center">
								{formatNumber(totalBoxes)}
							</td>
							<td className="border border-black p-3 text-center text-indigo-700">
								{formatNumber(totalPacks)}
							</td>
							<td className="border border-black p-3 text-center">-</td>
						</tr>
					</tbody>
				</table>
			</div>

			{/* Footer: Signatures */}
			<div className="space-y-4 text-sm italic mb-12 mt-8">
				<div className="flex items-end">
					<span>Ghi chú:</span>
					<div className="flex-1 border-b border-black border-dotted mb-1 ml-2"></div>
				</div>
			</div>

			<div className="flex justify-around text-sm mt-12 mb-20 italic">
				<div className="text-center">
					<p className="font-bold uppercase not-italic">Phụ trách sản xuất</p>
					<p className="text-xs">(ký, họ tên)</p>
					<div className="mt-10">
						<p className="font-bold uppercase text-[12px]">NGUYỄN LÝ NGÂN</p>
					</div>
				</div>
				<div className="text-center">
					<p className="font-bold uppercase not-italic tracking-tight">
						Người thực hiện
					</p>
					<p className="text-xs">(ký, họ tên)</p>
				</div>
			</div>
		</div>
	);
});

ProductionDocument.displayName = "ProductionDocument";
