import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	Boxes,
	HandCoins,
	Landmark,
	ReceiptText,
	ShoppingBag,
	TrendingUp,
	WalletCards,
} from "lucide-react";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import { apiV1 } from "../../lib/apiV1";
import { formatNumber } from "../../lib/utils";
import type { FinancialSummaryReportV1 } from "../../types";
import {
	ExportButton,
	FilterBar,
	money,
	ReportCard,
	ReportShell,
	StatCard,
	StatGrid,
	TableState,
	useReportExport,
} from "../../components/reports/ReportKit";

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

export default function FinancialSummaryReport() {
	const [from, setFrom] = useState(monthStart());
	const [to, setTo] = useState(today());
	const query = useQuery({
		queryKey: ["report-financial-summary", from, to],
		queryFn: () =>
			apiV1<FinancialSummaryReportV1>(
				`/api/v1/reports/financial-summary?from=${from}&to=${to}`,
			),
	});
	const data = query.data?.data;
	const exportExcel = useReportExport();
	const chartData = useMemo(
		() =>
			(data?.monthly || []).map(row => {
				const [year, month] = String(row.monthKey || "").split("-");
				return {
					...row,
					label: month && year ? `T${Number(month)}/${year.slice(2)}` : row.monthKey,
				};
			}),
		[data?.monthly],
	);

	const onExport = () =>
		exportExcel(
			`Bao_cao_tai_chinh_${from}_${to}.xlsx`,
			"Tai chinh",
			[
				{ header: "Chỉ tiêu", value: (row: { label: string; value: string }) => row.label, width: 34 },
				{ header: "Giá trị", value: (row: { label: string; value: string }) => row.value, width: 22 },
			],
			data
				? [
						{ label: "Doanh thu gộp", value: money(data.revenue) },
						{ label: "Trả hàng bán", value: money(data.returnsTotal) },
						{ label: "Doanh thu thuần", value: money(data.netRevenue) },
						{ label: "Giá vốn hàng bán", value: money(data.cogs) },
						{ label: "Lợi nhuận gộp", value: money(data.grossProfit) },
						{ label: "Biên lợi nhuận gộp", value: `${data.grossMarginPercent}%` },
						{ label: "Mua hàng", value: money(data.purchases) },
						{ label: "Công nợ phải thu", value: money(data.receivables) },
						{ label: "Công nợ phải trả", value: money(data.payables) },
						{ label: "Giá trị tồn kho", value: money(data.inventoryValue) },
					]
				: [],
		);

	return (
		<ReportShell
			title="Tổng quan tài chính"
			description="Doanh thu, giá vốn, lợi nhuận, mua hàng, công nợ và giá trị tồn kho theo kỳ"
			actions={<ExportButton onClick={onExport} />}
		>
			<FilterBar>
				<div className="md:col-span-2 xl:col-span-2">
					<ReportPeriodFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
				</div>
			</FilterBar>

			<StatGrid>
				<StatCard label="Doanh thu thuần" value={money(data?.netRevenue || 0)} icon={TrendingUp} tone="positive" hint={`Gộp ${money(data?.revenue || 0)}`} />
				<StatCard label="Lợi nhuận gộp" value={money(data?.grossProfit || 0)} icon={ReceiptText} tone={(data?.grossProfit || 0) >= 0 ? "info" : "negative"} hint={`Biên ${data?.grossMarginPercent || 0}%`} />
				<StatCard label="Mua hàng" value={money(data?.purchases || 0)} icon={ShoppingBag} hint={`Còn nợ ${money(data?.purchasesOutstanding || 0)}`} />
				<StatCard label="Giá trị tồn kho" value={money(data?.inventoryValue || 0)} icon={Boxes} />
				<StatCard label="Công nợ phải thu" value={money(data?.receivables || 0)} icon={HandCoins} tone="warning" />
				<StatCard label="Công nợ phải trả" value={money(data?.payables || 0)} icon={WalletCards} tone="warning" />
				<StatCard label="Giá vốn hàng bán" value={money(data?.cogs || 0)} icon={Landmark} />
				<StatCard label="Trả hàng bán" value={money(data?.returnsTotal || 0)} icon={ReceiptText} tone="negative" />
			</StatGrid>

			<ReportCard title="Doanh thu – Giá vốn – Lợi nhuận theo tháng" description="12 tháng gần nhất">
				<div className="p-4">
					<div className="mb-3 flex flex-wrap items-center gap-4 text-[12.5px] font-medium text-[#475467]">
						<span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#465fff]" /> Doanh thu</span>
						<span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#f79009]" /> Giá vốn</span>
						<span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#12b76a]" /> Lợi nhuận</span>
						<span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#98a2b3]" /> Mua hàng</span>
					</div>
					<div className="h-80">
						{chartData.length ? (
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={chartData} barCategoryGap="24%" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
									<CartesianGrid stroke="#eaecf0" strokeDasharray="4 4" vertical={false} />
									<XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#eaecf0" }} tick={{ fontSize: 12, fill: "#667085" }} />
									<YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 12, fill: "#667085" }} tickFormatter={v => `${Math.round(v / 1000000)}tr`} />
									<Tooltip cursor={{ fill: "rgba(70,95,255,0.08)" }} contentStyle={{ borderRadius: 12, border: "1px solid #eaecf0", fontSize: 12 }} formatter={(v: any, name: any) => [`${formatNumber(Number(v))} ₫`, name]} />
									<Legend />
									<Bar dataKey="revenue" name="Doanh thu" fill="#465fff" radius={[6, 6, 0, 0]} maxBarSize={22} />
									<Bar dataKey="cogs" name="Giá vốn" fill="#f79009" radius={[6, 6, 0, 0]} maxBarSize={22} />
									<Bar dataKey="profit" name="Lợi nhuận" fill="#12b76a" radius={[6, 6, 0, 0]} maxBarSize={22} />
									<Bar dataKey="purchases" name="Mua hàng" fill="#98a2b3" radius={[6, 6, 0, 0]} maxBarSize={22} />
								</BarChart>
							</ResponsiveContainer>
						) : (
							<div className="flex h-full items-center justify-center rounded-lg bg-[#f9fafb] text-sm text-[#98a2b3]">
								{query.isLoading ? "Đang tải dữ liệu..." : "Chưa có dữ liệu"}
							</div>
						)}
					</div>
				</div>
			</ReportCard>

			<ReportCard title="Công nợ khách hàng lớn nhất">
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Mã KH</th>
								<th>Khách hàng</th>
								<th className="text-right">Dư nợ</th>
							</tr>
						</thead>
						<TableState colSpan={3} loading={query.isLoading} error={query.isError ? (query.error as Error).message : null} empty={!data?.topCustomerDebts?.length}>
							{data?.topCustomerDebts.map(row => (
								<tr key={row.id}>
									<td><b>{row.code || "-"}</b></td>
									<td>{row.name}</td>
									<td className="text-right font-bold text-red-600">{money(row.debt)}</td>
								</tr>
							))}
						</TableState>
					</table>
				</div>
			</ReportCard>
		</ReportShell>
	);
}
