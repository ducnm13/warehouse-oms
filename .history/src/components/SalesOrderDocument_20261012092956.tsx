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
			<div className="text-center text-sm">
				<p className="italic font-medium">
					Ngày {day} tháng {month} năm {year}
				</p>
				<p className="font-bold">Số: {order.code}</p>
				{/* <span className="text-gray-600"> · {statusLabel[order.status] || order.status}</span> */}
			</div>

			{/* Section 1: Thông tin đơn */}
			<div className="mb-8 space-y-3 text-sm mt-4">
				{/* <h3 className="font-bold underline italic">1. THÔNG TIN ĐƠN HÀNG</h3> */}
				<div className="grid grid-cols-2 gap-2">
					<div className="flex items-end">
						<span>Khách hàng:</span>
						<span className="font-semibold pl-1">
							{order.customerName || ""}{" "}
							{order.customerPhone ? ` — ĐT: ${order.customerPhone}` : ""}
						</span>
					</div>
					{/* <div className="flex items-end">
						<span>Mã số thuế:</span>
						<div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
							{order.customerTaxCode || ""}
						</div>
					</div>
					<div className="flex items-end">
						<span>Kho xuất:</span>
						<div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
							{order.warehouseName || ""}
						</div>
					</div> */}
				</div>
				<div className="grid grid-cols-1 gap-2">
					<div className="flex items-end">
						<span>Địa chỉ:</span>
						<span className="pl-1">{order.customerAddress || ""}</span>
					</div>
					<div className="flex items-end">
						<span>Mã số thuế:</span>
						<div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
							{order.customerTaxCode || ""}
						</div>
					</div>
					<div className="flex items-end">
						<span>Thanh toán:</span>
						<div className="flex-1 border-b border-black border-dotted mb-1 ml-2 font-bold">
							{paymentMethodLabel[order.paymentMethod || ""] ||
								order.paymentMethod ||
								""}
							{order.paymentIntent === "PAID"
								? " — Thu ngay"
								: " — Ghi công nợ"}
						</div>
					</div>
				</div>
			</div>

			{/* Section 2: Chi tiết hàng hóa */}
			<div className="mb-10 text-sm">
				<h3 className="font-bold underline italic mb-4">
					2. CHI TIẾT HÀNG HÓA
				</h3>
				<table className="w-full border-collapse border border-black">
					<thead>
						<tr className="bg-gray-50 uppercase text-[11px]">
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
								Số lượng
							</th>
							<th className="border border-black p-2 font-bold text-center w-24">
								Đơn giá
							</th>
							<th className="border border-black p-2 font-bold text-center w-16">
								CK%
							</th>
							<th className="border border-black p-2 font-bold text-center w-28">
								Thành tiền
							</th>
						</tr>
					</thead>
					<tbody>
						{details.map((d, i) => (
							<tr key={d.id ?? i}>
								<td className="border border-black p-2 text-center">{i + 1}</td>
								<td className="border border-black p-2 font-bold text-left">
									{[d.productName, d.packagingName]
										.filter(Boolean)
										.join(" - ") || d.sku}
									{d.lineType === "PROMOTION" && (
										<span className="block text-xs font-normal italic text-gray-600">
											Hàng tặng{d.promotionCode ? ` (${d.promotionCode})` : ""}
										</span>
									)}
									{d.lineType !== "PROMOTION" && d.note && (
										<span className="block text-xs font-normal italic text-gray-600">
											{d.note}
										</span>
									)}
								</td>
								<td className="border border-black p-2 text-center">
									{d.unit || ""}
								</td>
								<td className="border border-black p-2 text-center font-bold">
									{formatNumber(Number(d.quantity || 0))}
								</td>
								<td className="border border-black p-2 text-right">
									{formatNumber(Number(d.unitPrice || 0))}
								</td>
								<td className="border border-black p-2 text-center">
									{Number(d.discountRate || 0) > 0
										? Number(d.discountRate)
										: ""}
								</td>
								<td className="border border-black p-2 text-right font-bold">
									{formatNumber(lineTotal(d))}
								</td>
							</tr>
						))}
					</tbody>
				</table>
				<div className="mt-3 ml-auto w-80 space-y-1 text-sm">
					<div className="flex justify-between">
						<span>Cộng tiền hàng:</span>
						<b>{formatNumber(Number(order.subtotal || 0))} ₫</b>
					</div>
					<div className="flex justify-between">
						<span>Chiết khấu:</span>
						<b>{formatNumber(Number(order.discountAmount || 0))} ₫</b>
					</div>
					<div className="flex justify-between">
						<span>VAT:</span>
						<b>{formatNumber(Number(order.taxAmount || 0))} ₫</b>
					</div>
					<div className="flex justify-between border-t border-black pt-1 text-base">
						<span className="font-bold uppercase">Tổng thanh toán:</span>
						<b className="text-indigo-700">
							{formatNumber(Number(order.totalAmount || 0))} ₫
						</b>
					</div>
					<p className="italic text-gray-700">
						Bằng chữ: {numberToVietnameseWords(Number(order.totalAmount || 0))}
					</p>
					{order.note && (
						<p className="italic text-gray-700">Ghi chú: {order.note}</p>
					)}
				</div>
			</div>

			{/* Footer: Signatures */}
			<div className="flex justify-around text-sm mt-12 mb-8 italic">
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
