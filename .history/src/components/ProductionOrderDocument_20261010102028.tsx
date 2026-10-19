import React, { useState } from "react";
import { ProductionOrderV1 } from "../types";
import { formatNumber, formatDate } from "../lib/utils";
import type { CompanyPrintProfile } from "../lib/printTemplate";

interface ProductionOrderDocumentProps {
	order: ProductionOrderV1;
	company?: CompanyPrintProfile | null;
	warehouseName?: string;
}

export const ProductionOrderDocument = React.forwardRef<
	HTMLDivElement,
	ProductionOrderDocumentProps
>(({ order, company, warehouseName }, ref) => {
	// KHÓA THỜI GIAN IN: Chỉ lấy thời gian 1 lần duy nhất khi mở phiếu
	const [printTime] = useState(() => {
		const now = new Date();
		return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")} ngày ${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
	});
	// Chỉ dòng tạo lúc lập lệnh (dòng phân bổ thêm khi CHỐT có plannedQuantity = 0)
	const outputs = (order.outputs || []).filter(
		d => Number(d.plannedQuantity || 0) > 0,
	);
	const materials = order.materials || [];
	const totalPlanned = outputs.reduce(
		(s, d) => s + Number(d.plannedQuantity || 0),
		0,
	);
	const dateOrDots = (v?: string) =>
		v ? formatDate(v) : "....................";

	return (
		<div
			ref={ref}
			className="p-16 text-black bg-white min-h-[297mm] font-serif leading-relaxed"
			style={{ fontFamily: '"Montserrat", sans-serif' }}
		>
			{/* Header Section — đồng bộ từ bảng company_profiles */}
			<div className="flex justify-between items-start mb-6">
				<div className="text-[11px] leading-tight flex-1">
					<h1 className="font-bold uppercase text-[13px] ">
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
				LỆNH SẢN XUẤT
			</h1>
			{/* Section 1: Thông tin lệnh */}
			<div className="mb-3 space-y-3 text-sm mt-2">
				{/* <h3 className="font-bold underline italic">1. THÔNG TIN LỆNH</h3> */}
				<div className="flex justify-between m-0">
					<div className="flex items-end">
						<span>Số: </span>
						<span className="font-semibold pl-1">{order.code}</span>
					</div>
					<div className="flex items-end">
						<span>Ngày:</span>
						<span className="font-semibold pl-1">
							{dateOrDots(order.orderDate)}
						</span>
					</div>
				</div>
				<div className="flex items-end">
					<span>Diễn giải:</span>
					<span className="pl-1">{order.note}</span>
				</div>
			</div>

			{/* Section 2: Thành phẩm kế hoạch */}
			<div className="mb-10 text-sm">
				<h3 className="font-semibold mb-2">1. Thành phẩm:</h3>
				<table className="w-full border-collapse border border-black">
					<thead>
						<tr className="bg-gray-50 text-[14px]">
							<th className="border border-dots p-2 font-bold text-center">
								Mã thành phẩm
							</th>
							<th className="border border-black p-2 font-bold text-center">
								Tên thành phẩm
							</th>
							<th className="border border-black p-2 font-bold text-center w-24">
								ĐVT
							</th>
							<th className="border border-black p-2 font-bold text-center w-28">
								Số lượng
							</th>
						</tr>
					</thead>
					<tbody>
						{outputs.map(d => (
							<tr key={d.id}>
								<td className="border border-black p-3 font-mono font-semibold">
									{d.sku || `PKG-${d.packagingId}`}
								</td>
								<td className="border border-black p-3 font-bold text-left">
									{d.packagingName}
								</td>
								<td className="border border-black p-3 text-center">
									{d.unit || ""}
								</td>
								<td className="border border-black p-3 text-center font-bold">
									{formatNumber(Number(d.plannedQuantity || 0))}
								</td>
							</tr>
						))}
						<tr className="bg-gray-50 font-bold uppercase text-[14px]">
							<td
								colSpan={3}
								className="border border-black p-3 text-center font"
							>
								Tổng cộng kế hoạch
							</td>
							<td className="border border-black p-3 text-center text-indigo-700">
								{formatNumber(totalPlanned)}
							</td>
						</tr>
					</tbody>
				</table>
			</div>

			{/* Section 3: Định mức nguyên liệu */}
			<div className="mb-10 text-sm">
				<h3 className="font-bold underline italic mb-4">
					3. ĐỊNH MỨC NGUYÊN LIỆU
				</h3>
				<table className="w-full border-collapse border border-black">
					<thead>
						<tr className="bg-gray-50 uppercase text-[11px]">
							<th className="border border-black p-2 font-bold text-center">
								Mã
							</th>
							<th className="border border-black p-2 font-bold text-center">
								Tên nguyên liệu
							</th>
							<th className="border border-black p-2 font-bold text-center w-24">
								ĐVT
							</th>
							<th className="border border-black p-2 font-bold text-center w-28">
								Số lượng
							</th>
						</tr>
					</thead>
					<tbody>
						{materials.length === 0 ? (
							<tr>
								<td
									colSpan={4}
									className="border border-black p-3 text-center italic text-gray-500"
								>
									Chưa đồng bộ định mức — lập phiếu xuất NVL để lấy số liệu
								</td>
							</tr>
						) : (
							materials.map(m => (
								<tr key={m.id}>
									<td className="border border-black p-3 font-mono font-semibold">
										{m.sku || `PKG-${m.packagingId}`}
									</td>
									<td className="border border-black p-3 font-bold text-left">
										{m.productName || m.packagingName}
									</td>
									<td className="border border-black p-3 text-center">
										{m.bomUnit || m.unit || ""}
									</td>
									<td className="border border-black p-3 text-center font-bold">
										{formatNumber(Number(m.plannedQuantity || 0))}
									</td>
								</tr>
							))
						)}
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

ProductionOrderDocument.displayName = "ProductionOrderDocument";
