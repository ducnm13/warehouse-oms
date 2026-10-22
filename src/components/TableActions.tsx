import React from "react";

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
	default: "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
	primary: "text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700",
	success: "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700",
	warning: "text-amber-600 hover:bg-amber-50 hover:text-amber-700",
	danger: "text-red-500 hover:bg-red-50 hover:text-red-600",
};

export default function TableActions({
	actions,
	className = "",
}: {
	actions: TableAction[];
	className?: string;
}) {
	const visible = actions.filter(action => !action.hidden);
	if (!visible.length) return null;
	return (
		<div
			className={`inline-flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white ${className}`}
			role="group"
		>
			{visible.map(action => (
				<button
					key={action.key}
					type="button"
					title={action.label}
					aria-label={action.label}
					disabled={action.disabled}
					onClick={action.onClick}
					className={`flex h-8 w-9 items-center justify-center border-l border-slate-200 transition-colors first:border-l-0 disabled:cursor-not-allowed disabled:opacity-40 ${toneClass[action.tone || "default"]}`}
				>
					{action.icon}
				</button>
			))}
		</div>
	);
}
