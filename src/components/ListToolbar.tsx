import React, { useMemo, useState } from "react";
import { Download, Filter, SlidersHorizontal, X } from "lucide-react";
import FilterDrawer, {
	countActiveFilters,
	describeActiveFilters,
	type FilterField,
	type FilterValues,
} from "./FilterDrawer";

interface ListToolbarProps {
	search?: React.ReactNode;
	extra?: React.ReactNode;
	fields: FilterField[];
	values: FilterValues;
	onChange: (values: FilterValues) => void;
	onExport?: () => void;
	exportDisabled?: boolean;
	exportTitle?: string;
	filterTitle?: string;
	className?: string;
}

export default function ListToolbar({
	search,
	extra,
	fields,
	values,
	onChange,
	onExport,
	exportDisabled,
	exportTitle = "Xuất danh sách ra Excel",
	filterTitle = "Bộ lọc",
	className = "",
}: ListToolbarProps) {
	const [open, setOpen] = useState(false);
	const activeCount = useMemo(
		() => countActiveFilters(fields, values),
		[fields, values],
	);
	const summary = useMemo(
		() => describeActiveFilters(fields, values),
		[fields, values],
	);

	return (
		<>
			<div className={`erp-toolbar list-toolbar ${className}`.trim()}>
				{summary.length > 0 && (
					<div className="list-toolbar-summary" title={summary.join(" · ")}>
						<Filter size={14} />
						<span className="list-toolbar-summary-text">
							Bộ lọc: {summary.join(" · ")}
						</span>
						<button
							type="button"
							title="Xóa bộ lọc"
							aria-label="Xóa bộ lọc"
							onClick={() => onChange({})}
							className="list-toolbar-clear"
						>
							<X size={14} />
						</button>
					</div>
				)}
				{search}
				{extra}
				<button
					type="button"
					title={filterTitle}
					aria-label={filterTitle}
					onClick={() => setOpen(true)}
					className="erp-icon-btn list-toolbar-icon relative"
				>
					<SlidersHorizontal size={17} />
					{activeCount > 0 && (
						<span className="list-toolbar-count">{activeCount}</span>
					)}
				</button>
				{onExport && (
					<button
						type="button"
						title={exportTitle}
						aria-label={exportTitle}
						onClick={onExport}
						disabled={exportDisabled}
						className="erp-icon-btn list-toolbar-icon"
					>
						<Download size={17} />
					</button>
				)}
			</div>
			<FilterDrawer
				open={open}
				onClose={() => setOpen(false)}
				fields={fields}
				values={values}
				onApply={onChange}
				onClear={() => onChange({})}
				title={filterTitle}
			/>
		</>
	);
}
