import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { ShoppingCart, TrendingUp } from "lucide-react";
import { apiV1 } from "../../lib/apiV1";
import { formatNumber } from "../../lib/utils";
import {
	ExportButton,
	FilterBar,
	money,
	qty,
	ReportCard,
	ReportShell,
	StatCard,
	StatGrid,
	TableState,
	useReportExport,
} from "../../components/reports/ReportKit";

const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => today().slice(0, 7);

interface Stats {
	totalRevenue: number;
	totalOrders: number;
	dailyRevenue: Array<{ date: string; revenue: number }>;
	monthlyRevenue: Array<{ month: string; revenue: number }>;
}
interface TopRow {
	productName: string;
	unit?: string;
	quantity: number;
	revenue: number;
	orders: number;
}

export default function OnlineReport() {
	const [month, setMonth] = useState(thisMonth());
	const stats = useQuery({
		queryKey: ["report-online-stats"],
		queryFn: () => apiV1<Stats>("/api/v1/online/stats"),
	});
	const top = useQuery({
		queryKey: ["report-online-top", month],
		queryFn: () => {
			const params = new URLSearchParams({ limit: "50" });
			if (month) params.set("month", month);
			return apiV1<TopRow[]>(`/api/v1/online/reports/top-products?${params.toString()}`);
		},
	});
	const monthly = useQuery({
		queryKey: ["report-online-monthly"],
		queryFn: () => apiV1<Array<{ month: string; orders: number; revenue: number }>>("/api/v1/online/reports/monthly?months=12"),
	});
	const rows = top.data?.data || [];
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(`Bao_cao_online_${month}.xlsx`, "Online", [
			{ header: "Sản phẩm", value: (r: TopRow) => r.productName, width: 30 },
			{ header: "ĐVT", value: r => r.unit || "", width: 10 },
			{ header: "Số lượng", value: r => r.quantity, width: 12 },
			{ header: "Số đơn", value: r => r.orders, width: 12 },
			{ header: "Doanh thu", value: r => r.revenue, width: 16 },
		], rows);
	const chartData = (monthly.data?.data || []).map(row => {
		const [year, monthPart] = String(row.month || "").split("-");
		return { ...row, label: monthPart && year ? `T${Number(monthPart)}/${year.slice(2)}` : row.month };
	});

	return (
		<ReportShell title="Bán hàng online" description="Doanh thu, số đơn và sản phẩm bán chạy trên kênh online" actions={<ExportButton onClick={onExport} />}>
			<FilterBar>
				<label>
					Tháng xem sản phẩm
					<input type="month" value={month} onChange={e => setMonth(e.target.value)} />
				</label>
			</FilterBar>

			<StatGrid>
				<StatCard label="Tổng doanh thu" value={money(stats.data?.data.totalRevenue || 0)} icon={TrendingUp} tone="positive" />
				<StatCard label="Tổng đơn hàng" value={qty(stats.data?.data.totalOrders || 0)} icon={ShoppingCart} />
				<StatCard label="Doanh thu tháng này" value={money(chartData[chartData.length - 1]?.revenue || 0)} />
				<StatCard label="Sản phẩm bán chạy" value={qty(rows.length)} />
			</StatGrid>

			<ReportCard title="Doanh thu online theo tháng" description="12 tháng gần nhất">
				<div className="p-4">
					<div className="h-72">
						{chartData.length ? (
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={chartData} barCategoryGap="28%" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
									<CartesianGrid stroke="#eaecf0" strokeDasharray="4 4" vertical={false} />
									<XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#eaecf0" }} tick={{ fontSize: 12, fill: "#667085" }} />
									<YAxis tickLine={false} axisLine={false} width={56} tick={{ fontSize: 12, fill: "#667085" }} tickFormatter={v => `${Math.round(v / 1000000)}tr`} />
									<Tooltip cursor={{ fill: "rgba(70,95,255,0.08)" }} contentStyle={{ borderRadius: 12, border: "1px solid #eaecf0", fontSize: 12 }} formatter={(v: any) => [`${formatNumber(Number(v))} ₫`, "Doanh thu"]} />
									<Bar dataKey="revenue" name="Doanh thu" fill="#465fff" radius={[6, 6, 0, 0]} maxBarSize={28} />
								</BarChart>
							</ResponsiveContainer>
						) : (
							<div className="flex h-full items-center justify-center rounded-lg bg-[#f9fafb] text-sm text-[#98a2b3]">
								{monthly.isLoading ? "Đang tải dữ liệu..." : "Chưa có dữ liệu"}
							</div>
						)}
					</div>
				</div>
			</ReportCard>

			<ReportCard title="Sản phẩm bán chạy" description={`Tháng ${month} · ${rows.length} sản phẩm`}>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Sản phẩm</th>
								<th className="text-right">Số lượng</th>
								<th className="text-right">Số đơn</th>
								<th className="text-right">Doanh thu</th>
							</tr>
						</thead>
						<TableState colSpan={4} loading={top.isLoading} error={top.isError ? (top.error as Error).message : null} empty={!rows.length}>
							{rows.map((row, index) => (
								<tr key={`${row.productName}-${index}`}>
									<td><b>{index + 1}.</b> {row.productName}</td>
									<td className="text-right">{qty(row.quantity)} {row.unit || ""}</td>
									<td className="text-right">{qty(row.orders)}</td>
									<td className="text-right font-semibold">{money(row.revenue)}</td>
								</tr>
							))}
						</TableState>
					</table>
				</div>
			</ReportCard>
		</ReportShell>
	);
}
