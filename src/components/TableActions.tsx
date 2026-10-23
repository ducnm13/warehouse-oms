import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export type TableActionTone =
	| "default"
	| "primary"
	| "success"
	| "warning"
	| "danger";

export interface TableAction {
	key: string;
	label: string;
	icon: React.ReactNode;
	onClick: () => void;
	disabled?: boolean;
	hidden?: boolean;
	tone?: TableActionTone;
}

const toneClass: Record<TableActionTone, string> = {
	default: "text-slate-600 hover:bg-slate-50 hover:text-slate-800",
	primary: "text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700",
	success: "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
	warning: "text-amber-600 hover:bg-amber-50 hover:text-amber-700",
	danger: "text-red-500 hover:bg-red-50 hover:text-red-600",
};

const MENU_WIDTH = 208;

export default function TableActions({
	actions,
	className = "",
	label = "Chức năng",
}: {
	actions: TableAction[];
	className?: string;
	label?: string;
}) {
	const visible = actions.filter(action => !action.hidden);
	const [open, setOpen] = useState(false);
	const [position, setPosition] = useState({ top: 0, left: 0 });
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const close = () => setOpen(false);
		const onPointerDown = (event: MouseEvent) => {
			const target = event.target as Node;
			if (
				triggerRef.current?.contains(target) ||
				menuRef.current?.contains(target)
			)
				return;
			close();
		};
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") close();
		};
		document.addEventListener("mousedown", onPointerDown);
		document.addEventListener("keydown", onKeyDown);
		window.addEventListener("scroll", close, true);
		window.addEventListener("resize", close);
		return () => {
			document.removeEventListener("mousedown", onPointerDown);
			document.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("scroll", close, true);
			window.removeEventListener("resize", close);
		};
	}, [open]);

	if (!visible.length) return null;

	const toggle = () => {
		if (!open && triggerRef.current) {
			const rect = triggerRef.current.getBoundingClientRect();
			const menuHeight = visible.length * 40 + 12;
			const top =
				rect.bottom + 6 + menuHeight > window.innerHeight
					? Math.max(8, rect.top - menuHeight - 6)
					: rect.bottom + 6;
			const left = Math.min(
				Math.max(8, rect.right - MENU_WIDTH),
				window.innerWidth - MENU_WIDTH - 8,
			);
			setPosition({ top, left });
		}
		setOpen(value => !value);
	};

	return (
		<div className={`inline-flex ${className}`}>
			<button
				ref={triggerRef}
				type="button"
				onClick={toggle}
				aria-haspopup="menu"
				aria-expanded={open}
				className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] font-semibold text-indigo-600 transition-colors hover:text-indigo-700"
			>
				{label}
				<ChevronDown
					size={15}
					className={`transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>
			{open &&
				createPortal(
					<div
						ref={menuRef}
						role="menu"
						style={{
							top: position.top,
							left: position.left,
							width: MENU_WIDTH,
						}}
						className="fixed z-[9999] overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl shadow-slate-900/10"
					>
						{visible.map(action => (
							<button
								key={action.key}
								type="button"
								role="menuitem"
								disabled={action.disabled}
								title={action.label}
								onClick={() => {
									if (action.disabled) return;
									setOpen(false);
									action.onClick();
								}}
								className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${toneClass[action.tone || "default"]}`}
							>
								<span className="flex h-5 w-5 shrink-0 items-center justify-center">
									{action.icon}
								</span>
								<span className="truncate">{action.label}</span>
							</button>
						))}
					</div>,
					document.body,
				)}
		</div>
	);
}
