import React, { useEffect } from "react";
import { X } from "lucide-react";

interface RightDrawerProps {
	open: boolean;
	title: string;
	subtitle?: string;
	badge?: React.ReactNode;
	onClose: () => void;
	children: React.ReactNode;
	footer?: React.ReactNode;
	widthClass?: string;
}

export default function RightDrawer({
	open,
	title,
	subtitle,
	badge,
	onClose,
	children,
	footer,
	widthClass = "max-w-6xl",
}: RightDrawerProps) {
	useEffect(() => {
		if (!open) return;
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.stopPropagation();
				onClose();
			}
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [open, onClose]);

	if (!open) return null;
	return (
		<div className="fixed inset-0 z-[400] flex justify-end bg-slate-900/55 md:pl-64">
			<div
				className={`flex h-full w-full ${widthClass} max-w-[72rem] flex-col bg-white shadow-2xl`}
			>
				<div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
					<div>
						<h2 className="text-lg font-bold text-slate-900">{title}</h2>
						{subtitle && (
							<p className="mt-1 text-xs text-slate-500">{subtitle}</p>
						)}
						{badge && (
							<div className="mt-2 flex flex-wrap items-center gap-2">
								{badge}
							</div>
						)}
					</div>
					<div className="flex items-center gap-1">
						<button
							type="button"
							title="Đóng"
							onClick={onClose}
							className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
						>
							<X size={18} />
						</button>
					</div>
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
					{children}
				</div>
				{footer && (
					<div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
						{footer}
					</div>
				)}
			</div>
		</div>
	);
}
