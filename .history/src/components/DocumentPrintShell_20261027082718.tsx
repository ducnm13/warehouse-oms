import React, { forwardRef, type ReactNode } from "react";
import type {
	CompanyPrintProfile,
	ResolvedPrintSigner,
} from "../lib/printTemplate";
import PrintAppFooter from "./PrintAppFooter";

interface DocumentPrintShellProps {
	title: string;
	company?: CompanyPrintProfile | null;
	children: ReactNode;
}

interface DocumentSignaturesProps {
	signers: ResolvedPrintSigner[];
}

export const DocumentSignatures = ({ signers }: DocumentSignaturesProps) => {
	if (!signers.length) return null;
	return (
		<div
			className="mb-20 mt-16 grid gap-4 text-sm italic"
			style={{
				gridTemplateColumns: `repeat(${signers.length}, minmax(0, 1fr))`,
			}}
		>
			{signers.map(signer => (
				<div key={signer.code} className="text-center">
					<p className="font-bold uppercase not-italic">{signer.title}</p>
					<p className="text-xs">{signer.note}</p>
					{signer.name && (
						<p className="mt-10 text-[12px] font-bold uppercase not-italic">
							{signer.name}
						</p>
					)}
				</div>
			))}
		</div>
	);
};

export const DocumentPrintShell = forwardRef<
	HTMLDivElement,
	DocumentPrintShellProps
>(({ title, company, children }, ref) => {
	const companyAddress = (company?.address || "")
		.split(/\\n|\r?\n/)
		.map(line => line.trim())
		.filter(Boolean);

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
					{company?.website && (
						<p>
							<i>Website: {company.website}</i>
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

			<h1 className="mb-8 mt-6 text-center text-xl font-bold uppercase tracking-wide">
				{title}
			</h1>

			{children}

			<PrintAppFooter />
		</div>
	);
});

DocumentPrintShell.displayName = "DocumentPrintShell";
