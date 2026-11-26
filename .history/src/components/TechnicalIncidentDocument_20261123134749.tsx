import React, { forwardRef } from "react";
import { formatNumber } from "../lib/utils";
import {
	resolvePrintSigners,
	type CompanyPrintProfile,
} from "../lib/printTemplate";
import {
	formatIncidentTime,
	TECHNICAL_CATEGORY_META,
	TECHNICAL_SEVERITY_META,
	TECHNICAL_STATUS_META,
} from "../lib/technicalIncident";
import type { TechnicalIncidentV1 } from "../types";
import PrintAppFooter from "./PrintAppFooter";
import { DocumentSignatures } from "./DocumentPrintShell";

interface TechnicalIncidentDocumentProps {
	incident: TechnicalIncidentV1;
	company?: CompanyPrintProfile | null;
}

const Field = ({
	label,
	children,
	className = "",
}: {
	label: string;
	children: React.ReactNode;
	className?: string;
}) => (
	<div className={`flex items-end ${className}`}>
		<span className="w-40 flex-shrink-0">{label}:</span>
		<div className="mb-1 ml-2 flex-1 border-b border-dotted border-black">
			{children}
		</div>
	</div>
);

const Section = ({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) => (
	<div className="mt-4">
		<p className="mb-1 text-sm font-bold uppercase">{title}</p>
		<div className="min-h-[44px] whitespace-pre-wrap border border-black p-2 text-sm">
			{children || "—"}
		</div>
	</div>
);

export const TechnicalIncidentDocument = forwardRef<
	HTMLDivElement,
	TechnicalIncidentDocumentProps
>(({ incident, company }, ref) => {
	const companyAddress = (company?.address || "")
		.split(/\\n|\r?\n/)
		.map(line => line.trim())
		.filter(Boolean);
	const signers = resolvePrintSigners(company, [
		// {
		// 	code: "PREPARER",
		// 	fallbackTitle: "Người lập phiếu",
		// 	name: incident.creatorName || "",
		// },
		{
			code: "TECHNICIAN",
			fallbackTitle: "Người chịu trách nhiệm",
			name: incident.assigneeName || "",
		},
		{
			code: "TECHNICAL_MANAGER",
			fallbackTitle: "Quản đốc",
			note: "(Ký, họ tên)",
		},
	]);
	const printedDate = new Date(incident.createdAt || incident.occurredAt);
	const day = String(printedDate.getDate()).padStart(2, "0");
	const month = String(printedDate.getMonth() + 1).padStart(2, "0");
	const year = printedDate.getFullYear();
	const images = (incident.images || []).filter(image => image.dataUrl);

	return (
		<div
			ref={ref}
			className="min-h-[297mm] w-full bg-white p-16 font-serif leading-relaxed text-black"
			style={{ fontFamily: '"Montserrat", sans-serif' }}
		>
			<div className="mb-6 flex items-start justify-between">
				<div className="flex-1 text-[11px] leading-tight break-words">
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
						className="h-auto max-w-full"
						alt="Logo"
					/>
				</div>
			</div>

			<h1 className="mb-1 mt-6 text-center text-xl font-bold uppercase tracking-wide">
				PHIẾU SỰ CỐ KỸ THUẬT
			</h1>
			<div className="mb-6 text-center text-[12px] italic">
				Ngày {day} tháng {month} năm {year}
			</div>

			<div className="mb-4 space-y-2 text-sm">
				<div className="grid grid-cols-2 gap-x-8">
					<Field label="Số phiếu" className="font-semibold">
						{incident.code}
					</Field>
					<Field label="Trạng thái" className="font-semibold">
						{TECHNICAL_STATUS_META[incident.status]?.label || incident.status}
					</Field>
				</div>
				<Field label="Tên sự cố" className="font-semibold">
					{incident.title}
				</Field>
				<div className="grid grid-cols-2 gap-x-8">
					<Field label="Máy móc / thiết bị">
						{incident.equipmentName || "—"}
					</Field>
					<Field label="Vị trí">{incident.location || "—"}</Field>
				</div>
				<div className="grid grid-cols-2 gap-x-8">
					<Field label="Loại sự cố">
						{TECHNICAL_CATEGORY_META[incident.category]?.label ||
							incident.category}
					</Field>
					<Field label="Mức độ">
						{TECHNICAL_SEVERITY_META[incident.severity]?.label ||
							incident.severity}
					</Field>
				</div>
				<div className="grid grid-cols-2 gap-x-8">
					<Field label="Thời gian xảy ra">
						{formatIncidentTime(incident.occurredAt)}
					</Field>
					<Field label="Người chịu trách nhiệm">
						{incident.assigneeName || "—"}
					</Field>
				</div>
				<div className="grid grid-cols-2 gap-x-8">
					<Field label="Người lập phiếu">{incident.creatorName || "—"}</Field>
					<Field label="Hoàn tất lúc">
						{formatIncidentTime(incident.resolvedAt)}
					</Field>
				</div>
				{incident.cost > 0 && (
					<Field label="Chi phí">
						{formatNumber(Number(incident.cost || 0))} ₫
					</Field>
				)}
			</div>

			<Section title="Nguyên nhân">{incident.cause}</Section>
			<Section title="Hướng xử lý / Kết quả">{incident.solution}</Section>
			{incident.note && <Section title="Ghi chú">{incident.note}</Section>}

			{images.length > 0 && (
				<div className="mt-5">
					<p className="mb-2 text-sm font-bold uppercase">
						Hình ảnh bằng chứng
					</p>
					<div className="grid grid-cols-2 gap-3">
						{images.map((image, index) => (
							<figure key={image.id ?? index} className="text-center">
								<img
									src={image.dataUrl}
									alt={image.fileName}
									className="mx-auto max-h-56 w-auto border border-black object-contain"
								/>
								{/* <figcaption className="mt-1 text-[10px] italic">
									Ảnh {index + 1}: {image.fileName}
								</figcaption> */}
							</figure>
						))}
					</div>
				</div>
			)}

			<DocumentSignatures signers={signers} />
			<PrintAppFooter />
		</div>
	);
});

TechnicalIncidentDocument.displayName = "TechnicalIncidentDocument";
