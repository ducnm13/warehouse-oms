import React, { useRef, type ReactNode, type Ref } from "react";
import { Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";

interface PrintDocumentPreviewProps {
	open: boolean;
	title: string;
	code?: string;
	documentTitle: string;
	onClose: () => void;
	children: (ref: Ref<HTMLDivElement>) => ReactNode;
}

export default function PrintDocumentPreview({
	open,
	title,
	code,
	documentTitle,
	onClose,
	children,
}: PrintDocumentPreviewProps) {
	const printRef = useRef<HTMLDivElement>(null);
	const handlePrint = useReactToPrint({
		contentRef: printRef,
		documentTitle,
		pageStyle: "@page { size: A4; margin: 0; }",
	});

	if (!open) return null;

	return (
		<div className="sales-print-view fixed inset-0 z-[9999] flex flex-col bg-gray-900/90 backdrop-blur-md">
			<div className="no-print flex items-center justify-between border-b bg-white p-4 shadow-md">
				<div className="flex items-center gap-4">
					<h3 className="text-lg font-black uppercase tracking-tight text-gray-800">
						{title}
					</h3>
					{code && (
						<span className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-500">
							{code}
						</span>
					)}
				</div>
				<div className="flex items-center gap-3">
					<button
						onClick={onClose}
						className="rounded-lg border px-6 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 transition-all hover:bg-gray-50"
					>
						Đóng
					</button>
					<button
						onClick={handlePrint}
						className="erp-btn erp-btn-primary !px-6 text-[10px] uppercase tracking-widest"
					>
						<Printer size={16} /> In
					</button>
				</div>
			</div>
			<div className="flex-1 overflow-auto bg-gray-200/50 p-8">
				<div className="sales-print-view mx-auto mb-8 w-[210mm] max-w-full bg-white shadow-2xl">
					{children(printRef)}
				</div>
			</div>
		</div>
	);
}
