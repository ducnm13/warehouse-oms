import React from "react";
import { SalesOrder } from "../types";
import { formatNumber, formatDate } from "../lib/utils";
import {
	numberToVietnameseWords,
	type CompanyPrintProfile,
} from "../lib/printTemplate";
import PrintAppFooter from "./PrintAppFooter";

interface SalesOrderDocumentProps {
	order: SalesOrder;
	company?: CompanyPrintProfile | null;
}

const statusLabel: Record<string, string> = {
	DRAFT: "Nháp",
	PENDING: "Chờ duyệt",
	APPROVED: "Đã duyệt",
	REJECTED: "Từ chối",
	POSTED: "Đã ghi sổ",
	CANCELLED: "Đã hủy",
	FULFILLED: "Hoàn thành",
};

const paymentMethodLabel: Record<string, string> = {
	CASH: "Tiền mặt",
	BANK: "Chuyển khoản",
};

export const SalesOrderDocument = React.forwardRef<
	HTMLDivElement,
	SalesOrderDocumentProps
>(({ order, company }, ref) => {
	const details = order.details || [];
	const dateOrDots = (v?: string) =>
		v ? formatDate(v) : "....................";
	// Đơn hàng chỉ lưu tiền thuế → suy ra mức % để hiển thị
	const vatRate =
		Number(order.subtotal || 0) > 0
			? (Number(order.taxAmount || 0) / Number(order.subtotal || 0)) * 100
			: 0;
	const lineTotal = (d: (typeof details)[number]) =>
		Number(
			d.lineTotal ??
				Number(d.quantity || 0) *
					Number(d.unitPrice || 0) *
					(1 - Number(d.discountRate || 0) / 100),
		);

	const date = new Date(order.orderDate);
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = date.getFullYear();

	return (
		<div
			ref={ref}
			className="p-16 text-black bg-white font-serif leading-relaxed"
			style={{ fontFamily: '"Montserrat", sans-serif' }}
		>
			{/* Header Section — đồng bộ từ bảng company_profiles */}
			<div className="flex justify-between items-start mb-6">
				<div className="text-[11px] leading-tight flex-1">
					<h1 className="font-bold uppercase text-[13px] mb-1">
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
				</div>
				<div className="text-right flex-shrink-0 ml-4">
					<img src={company?.logoUrl || "/images/logo.png"} width="120px"></img>
				</div>
			</div>
			<h1 className="text-xl font-bold text-center mt-6 uppercase tracking-wide">
				PHIẾU XUẤT KHO BÁN HÀNG
			</h1>
			<div className="text-center text-[12px]">
				<p className="italic font-medium">
					Ngày {day} tháng {month} năm {year}
				</p>
				<p className="font-semibold">Số: {order.code}</p>
				{/* <span className="text-gray-600"> · {statusLabel[order.status] || order.status}</span> */}
			</div>

			{/* Section 1: Thông tin đơn */}
			<div className="mb-2 space-y-3 text-sm mt-2">
				<div className="grid grid-cols-1 gap-2">
					<div className="flex items-end">
						<span>Khách hàng:</span>
						<span className="font-medium pl-1">{order.customerName || ""}</span>
					</div>
				</div>
				{order.customerTaxCode || order.customerPhone ? (
					<div className="grid grid-cols-2 gap-2">
						{order.customerTaxCode && (
							<div className="flex items-end">
								<span>Mã số thuế:</span>
								<span className="font-medium pl-1">
									{order.customerTaxCode || ""}
								</span>
							</div>
						)}
						{order.customerPhone && (
							<div className="flex items-end">
								<span>Điện thoại:</span>
								<span className="font-medium pl-1">
									{order.customerPhone || ""}
								</span>
							</div>
						)}
					</div>
				) : (
					""
				)}
				<div className="grid grid-cols-1 gap-2">
					<div className="flex items-end">
						<span>Địa chỉ:</span>
						<span className="font-medium pl-1">
							{order.customerAddress || ""}
						</span>
					</div>
					<div className="flex items-end">
						<span>Diễn giải:</span>
						<span className="font-medium pl-1">{order.note || ""}</span>
					</div>
					{/* <div className="flex items-end">
						<span>Thanh toán:</span>
						<span className="font-medium pl-1">
							{paymentMethodLabel[order.paymentMethod || ""] ||
								order.paymentMethod ||
								""}
							{order.paymentIntent === "PAID"
								? " — Thu ngay"
								: " — Ghi công nợ"}
						</span>
					</div> */}
					{/* <div className="flex items-end">
						<span>Nhân viên bán hàng:</span>
						<span className="font-medium pl-1">{order.creatorName || ""}</span>
					</div> */}
				</div>
			</div>

			{/* Section 2: Chi tiết hàng hóa */}
			<div className="mb-2 text-[12px]">
				<table className="w-full border-collapse border border-black">
					<thead>
						<tr className="bg-gray-50 uppercase">
							<th className="border border-black p-2 font-bold text-center w-10">
								STT
							</th>
							<th className="border border-black p-2 font-bold text-center w-100">
								Hàng hóa
							</th>
							<th className="border border-black p-2 font-bold text-center w-16">
								ĐVT
							</th>
							<th className="border border-black p-2 font-bold text-center w-20">
								SL
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
						{details.map((d, i) => (
							<tr key={d.id ?? i}>
								<td className="border border-black py-1 text-center">
									{i + 1}
								</td>
								<td className="border border-black py-1 pl-1 font-medium text-left">
									{[d.productName].filter(Boolean).join(" - ") || d.sku}
									{d.lineType === "PROMOTION" && (
										<span className="block text-xs font-normal italic text-gray-600">
											Hàng tặng{d.promotionCode ? ` (${d.promotionName})` : ""}
										</span>
									)}
									{d.lineType !== "PROMOTION" && d.note && (
										<span className="block text-xs font-normal italic text-gray-600">
											{d.note}
										</span>
									)}
								</td>
								<td className="border border-black py-1 text-center">
									{d.unit || ""}
								</td>
								<td className="border border-black py-1 text-center font-medium">
									{formatNumber(Number(d.quantity || 0))}
								</td>
								<td className="border border-black py-1 px-2 text-right">
									{formatNumber(Number(d.unitPrice || 0))}
								</td>

								<td className="border border-black py-1 px-2 text-right font-medium">
									{formatNumber(lineTotal(d))}
								</td>
							</tr>
						))}
						<tr className="bg-gray-50 font-bold">
							<td
								colSpan={5}
								className="border border-black p-1 text-center font"
							>
								Cộng tiền hàng
							</td>
							<td className="border border-black p-1 text-right font-bold">
								{formatNumber(Number(order.subtotal || 0))}
							</td>
						</tr>
						<tr className="bg-gray-50 font-bold ">
							<td
								colSpan={5}
								className="border border-black p-1 text-center font"
							>
								Thuế (VAT){vatRate > 0 ? ` ${formatNumber(vatRate)}%` : ""}
							</td>
							<td className="border border-black p-1 text-right font-bold">
								{formatNumber(Number(order.taxAmount || 0))}
							</td>
						</tr>
						<tr className="bg-gray-50 font-bold">
							<td
								colSpan={5}
								className="border border-black p-1 text-center font"
							>
								Tổng tiền thanh toán
							</td>
							<td className="border border-black p-1 text-right font-bold">
								{formatNumber(Number(order.totalAmount || 0))}
							</td>
						</tr>
					</tbody>
				</table>
				<div className="mt-2 space-y-1 text-sm italic">
					<span className=" text-gray-700">Số tiền bằng chữ: </span>
					<span className="font-semibold">
						{numberToVietnameseWords(Number(order.totalAmount || 0))}
					</span>
				</div>
			</div>

			{/* Footer: Signatures */}
			<div className="grid grid-cols-2 gap-2">
				<div className="col-span-1"></div>
				<div className="col-span-1 text-center">
					<p className="italic font-medium">
						Ngày {day} tháng {month} năm {year}
					</p>
				</div>
				<div className="col-span-1 text-center">1</div>
				<div className="col-span-1 text-center">1</div>
			</div>

			<div className="flex justify-around text-sm mt-2 mb-8 italic">
				<div className="text-center">
					<p className="font-bold uppercase not-italic">Người bán hàng</p>
					<p className="text-xs">(ký, họ tên)</p>
					<div className="mt-10">
						<p className="font-bold uppercase text-[12px]">
							{order.creatorName || ""}
						</p>
					</div>
				</div>
				<div className="text-center">
					<p className="font-bold uppercase not-italic tracking-tight">
						Khách hàng
					</p>
					<p className="text-xs">(ký, họ tên)</p>
				</div>
			</div>

			<PrintAppFooter />
		</div>
	);
});

SalesOrderDocument.displayName = "SalesOrderDocument";
