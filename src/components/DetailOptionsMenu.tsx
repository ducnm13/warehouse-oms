import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface DetailOptionAction {
	key: string;
	label: string;
	icon: React.ReactNode;
	onClick: () => void;
	tone?: "default" | "danger";
	disabled?: boolean;
	hidden?: boolean;
}

interface DetailOptionsMenuProps {
	actions: DetailOptionAction[];
	label?: string;
}

export default function DetailOptionsMenu({
	actions,
	label = "Tùy chọn",
}: DetailOptionsMenuProps) {
	const [open, setOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const handleClick = (event: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
				setOpen(false);
			}
		};
		const handleKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", handleClick);
		document.addEventListener("keydown", handleKey);
		return () => {
			document.removeEventListener("mousedown", handleClick);
			document.removeEventListener("keydown", handleKey);
		};
	}, [open]);

	const visibleActions = actions.filter(action => !action.hidden);
	if (!visibleActions.length) return null;

	return (
		<div className="relative" ref={menuRef}>
			<button
				type="button"
				className="erp-btn"
				aria-haspopup="menu"
				aria-expanded={open}
				onClick={() => setOpen(value => !value)}
			>
				{label}
				<ChevronDown
					size={15}
					className={`transition-transform ${open ? "rotate-180" : ""}`}
				/>
			</button>
			{open && (
				<div
					role="menu"
					className="absolute bottom-full right-0 z-20 mb-2 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl shadow-slate-900/10"
				>
					{visibleActions.map(action => (
						<button
							key={action.key}
							type="button"
							role="menuitem"
							disabled={action.disabled}
							className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 ${
								action.tone === "danger"
									? "text-red-600 hover:bg-red-50"
									: "text-slate-600 hover:text-slate-800"
							}`}
							onClick={() => {
								setOpen(false);
								action.onClick();
							}}
						>
							{action.icon}
							{action.label}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
