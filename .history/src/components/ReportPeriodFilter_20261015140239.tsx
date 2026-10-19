import React from "react";
import DateRangeCalendar from "./DateRangeCalendar";

// ── Bộ chọn kỳ báo cáo dùng chung (trang báo cáo, drawer lọc) ──
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) =>
	`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => {
	const c = new Date(d);
	c.setDate(c.getDate() + n);
	return c;
};
const monthBounds = (y: number, m0: number) => ({
	from: fmt(new Date(y, m0, 1)),
	to: fmt(new Date(y, m0 + 1, 0)),
});
const quarterBounds = (y: number, q: number) => ({
	from: fmt(new Date(y, q * 3, 1)),
	to: fmt(new Date(y, q * 3 + 3, 0)),
});

export function resolvePeriodPreset(
	key: string,
): { from: string; to: string } | null {
	const now = new Date();
	const y = now.getFullYear();
	const m = now.getMonth();
	const dowMon0 = (now.getDay() + 6) % 7; // 0 = Thứ 2
	const monday = addDays(now, -dowMon0);
	const month = monthBounds(y, m);
	const quarter = quarterBounds(y, Math.floor(m / 3));
	switch (key) {
		case "today":
			return { from: fmt(now), to: fmt(now) };
		case "this_week":
			return { from: fmt(monday), to: fmt(addDays(monday, 6)) };
		case "week_to_now":
			return { from: fmt(monday), to: fmt(now) };
		case "this_month":
			return month;
		case "month_to_now":
			return { from: month.from, to: fmt(now) };
		case "this_quarter":
			return quarter;
		case "quarter_to_now":
			return { from: quarter.from, to: fmt(now) };
		case "q1":
			return quarterBounds(y, 0);
		case "q2":
			return quarterBounds(y, 1);
		case "q3":
			return quarterBounds(y, 2);
		case "q4":
			return quarterBounds(y, 3);
		case "this_year":
			return { from: `${y}-01-01`, to: `${y}-12-31` };
		case "year_to_now":
			return { from: `${y}-01-01`, to: fmt(now) };
		case "first_half":
			return { from: `${y}-01-01`, to: `${y}-06-30` };
		case "second_half":
			return { from: `${y}-07-01`, to: `${y}-12-31` };
		default: {
			const mm = key.match(/^month_(\d{1,2})$/);
			if (mm) {
				const mi = Math.min(12, Math.max(1, Number(mm[1]))) - 1;
				return monthBounds(y, mi);
			}
			return null;
		}
	}
}

export const PERIOD_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: "custom", label: "Tùy chọn" },
	{ value: "today", label: "Hôm nay" },
	{ value: "this_week", label: "Tuần này" },
	{ value: "week_to_now", label: "Đầu tuần đến hiện tại" },
	{ value: "this_month", label: "Tháng này" },
	{ value: "month_to_now", label: "Đầu tháng đến hiện tại" },
	{ value: "this_quarter", label: "Quý này" },
	{ value: "quarter_to_now", label: "Đầu quý đến hiện tại" },
	{ value: "q1", label: "Quý 1" },
	{ value: "q2", label: "Quý 2" },
	{ value: "q3", label: "Quý 3" },
	{ value: "q4", label: "Quý 4" },
	{ value: "this_year", label: "Năm nay" },
	{ value: "year_to_now", label: "Đầu năm đến hiện tại" },
	{ value: "first_half", label: "Sáu tháng đầu năm" },
	{ value: "second_half", label: "Sáu tháng cuối năm" },
	...Array.from({ length: 12 }, (_, i) => ({
		value: `month_${i + 1}`,
		label: `Tháng ${i + 1}`,
	})),
];

interface ReportPeriodFilterProps {
	from: string;
	to: string;
	onChange: (from: string, to: string) => void;
}

export default function ReportPeriodFilter({
	from,
	to,
	onChange,
}: ReportPeriodFilterProps) {
	const [preset, setPreset] = React.useState("custom");
	const pickPreset = (key: string) => {
		setPreset(key);
		if (key === "custom") return;
		const range = resolvePeriodPreset(key);
		if (range) onChange(range.from, range.to);
	};
	return (
		<div className="grid gap-2 grid-cols-2">
			<label className="md:col-span-1">
				Kỳ báo cáo
				<select value={preset} onChange={e => pickPreset(e.target.value)}>
					{PERIOD_OPTIONS.map(o => (
						<option key={o.value} value={o.value}>
							{o.label}
						</option>
					))}
				</select>
			</label>
			<div className="md:col-span-2">
				<span className="mb-1 block">Khoảng ngày</span>
				<DateRangeCalendar
					from={from}
					to={to}
					onChange={(nextFrom, nextTo) => {
						setPreset("custom");
						onChange(nextFrom, nextTo);
					}}
				/>
			</div>
		</div>
	);
}
