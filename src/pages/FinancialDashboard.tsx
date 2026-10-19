import React, { useEffect, useState } from "react";
import {
	ArrowDownCircle,
	ArrowUpCircle,
	Boxes,
	CircleDollarSign,
	HandCoins,
	Scale,
	TrendingUp,
	WalletCards,
} from "lucide-react";
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
import toast from "../components/ui/toast";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import Badge from "../components/ui/badge";
import { formatNumber } from "../lib/utils";

type Data = {
	revenue: number;
	expense: number;
	profit: number;
	receivables: number;
	payables: number;
	inventoryValue: number;
	monthly: Array<{ monthKey: string; revenue: number; expense: number }>;
	customerDebts: Array<{
		id: number;
		code: string;
		name: string;
		debt: number;
	}>;
	lowStock: Array<{
		id: number;
		sku: string;
		productName: string;
		packagingName: string;
		stock: number;
		minStock: number;
	}>;
};
const initial: Data = {
	revenue: 0,
	expense: 0,
	profit: 0,
	receivables: 0,
	payables: 0,
	inventoryValue: 0,
	monthly: [],
	customerDebts: [],
	lowStock: [],
};
export default function FinancialDashboard() {
	console.debug('[FinancialDashboard] component rendered');
	const [data, setData] = useState<Data>(initial),
		[loading, setLoading] = useState(true);
	useEffect(() => {
		const token = localStorage.getItem("token");
		console.debug('[FinancialDashboard] token from localStorage:', token);
		fetch("/api/dashboard/financial", {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then(async r => {
				console.debug('[FinancialDashboard] response status:', r.status);
				const d = await r.json();
				if (!r.ok) throw new Error(d.error);
				setData(d);
			})
			.catch(e => toast.error(e.message))
			.finally(() => setLoading(false));
	}, []);
	const cards = [
		["Doanh thu", data.revenue, ArrowUpCircle, "text-emerald-600"],
		["Chi phí", data.expense, ArrowDownCircle, "text-red-500"],
		[
			"Lợi nhuận tạm tính",
			data.profit,
			TrendingUp,
			data.profit >= 0 ? "text-blue-600" : "text-red-600",
		],
		["Công nợ phải thu", data.receivables, HandCoins, "text-amber-600"],
		["Công nợ phải trả", data.payables, WalletCards, "text-violet-600"],
		["Giá trị tồn kho", data.inventoryValue, Boxes, "text-cyan-600"],
	] as const;
	const chartData = useMemo(() => {
		const rows = [...(data.monthly || [])].slice(-6);
		return rows.map(item => {
			const [year, month] = String(item.monthKey || "").split("-");
			return {
				...item,
				label: month && year ? `T${Number(month)}/${year.slice(2)}` : item.monthKey,
				profit: Number(item.revenue || 0) - Number(item.expense || 0),
			};
		});
	}, [data.monthly]);
	const chartTotal = useMemo(() => chartData.reduce((sum, item) => ({
		revenue: sum.revenue + Number(item.revenue || 0),
		expense: sum.expense + Number(item.expense || 0),
	}), { revenue: 0, expense: 0 }), [chartData]);
	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Tổng quan tài chính</h1>
					<p>Doanh thu, chi phí, công nợ và tồn kho theo dữ liệu vận hành</p>
				</div>
			</div>
			{loading ? (
				<div className="erp-card p-10 text-center">
					Đang tổng hợp dữ liệu...
				</div>
			) : (
				<>
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
						{cards.map(([label, value, Icon, color]) => (
							<div className="erp-stat" key={label}>
								<Icon className={color} />
								<div>
									<span>{label}</span>
									<strong>{formatNumber(value)} ₫</strong>
								</div>
							</div>
						))}
					</div>
					<div className="grid gap-4 xl:grid-cols-3">
						<Card className="xl:col-span-2">
							<CardHeader>
								<div>
									<CardTitle>Doanh thu và chi phí 6 tháng gần nhất</CardTitle>
									<p className="mt-1 text-[12.5px] text-[#667085]">
										So sánh doanh thu, chi phí và lợi nhuận theo tháng
									</p>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<Badge tone="success">Doanh thu {formatNumber(chartTotal.revenue)} ₫</Badge>
									<Badge tone="error">Chi phí {formatNumber(chartTotal.expense)} ₫</Badge>
								</div>
							</CardHeader>
							<CardContent>
								<div className="flex flex-wrap items-center gap-4 pb-3 text-[12.5px] font-medium text-[#475467]">
									<span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#465fff]" /> Doanh thu</span>
									<span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#12b76a]" /> Chi phí</span>
									<span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#f79009]" /> Lợi nhuận</span>
								</div>
								<div className="h-80">
									{chartData.length ? (
										<ResponsiveContainer width="100%" height="100%">
											<BarChart data={chartData} barCategoryGap="28%" margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
												<CartesianGrid stroke="#eaecf0" strokeDasharray="4 4" vertical={false} />
												<XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#eaecf0" }} tick={{ fontSize: 12, fill: "#667085" }} />
												<YAxis
													tickLine={false}
													axisLine={false}
													width={56}
													tick={{ fontSize: 12, fill: "#667085" }}
													tickFormatter={v => `${Math.round(v / 1000000)}tr`}
												/>
												<Tooltip
													cursor={{ fill: "rgba(70,95,255,0.08)" }}
													contentStyle={{ borderRadius: 12, border: "1px solid #eaecf0", boxShadow: "0 12px 32px -8px rgba(16,24,40,.18)", fontSize: 12 }}
													formatter={(v: any, name: any) => [`${formatNumber(Number(v))} ₫`, name]}
													labelStyle={{ fontWeight: 600, marginBottom: 4 }}
												/>
												<Bar dataKey="revenue" name="Doanh thu" fill="#465fff" radius={[6, 6, 0, 0]} maxBarSize={28} />
												<Bar dataKey="expense" name="Chi phí" fill="#12b76a" radius={[6, 6, 0, 0]} maxBarSize={28} />
												<Bar dataKey="profit" name="Lợi nhuận" fill="#f79009" radius={[6, 6, 0, 0]} maxBarSize={28} />
											</BarChart>
										</ResponsiveContainer>
									) : (
										<div className="flex h-full items-center justify-center rounded-lg bg-[#f9fafb] text-sm text-[#98a2b3]">
											Chưa có dữ liệu 6 tháng gần nhất
										</div>
									)}
								</div>
							</CardContent>
						</Card>
						<div className="erp-card p-5">
							<h2 className="mb-4 flex items-center gap-2 font-bold">
								<CircleDollarSign size={18} /> Công nợ khách hàng lớn
							</h2>
							<div className="space-y-3">
								{data.customerDebts.length ? (
									data.customerDebts.map(c => (
										<div key={c.id} className="border-b pb-3">
											<div className="flex justify-between gap-2">
												<b>{c.name}</b>
												<b className="text-amber-700">
													{formatNumber(c.debt)} ₫
												</b>
											</div>
											<small className="text-slate-400">{c.code}</small>
										</div>
									))
								) : (
									<p className="text-sm text-slate-400">
										Không có công nợ phải thu.
									</p>
								)}
							</div>
						</div>
					</div>
					<div className="erp-card overflow-hidden">
						<div className="p-4">
							<h2 className="flex items-center gap-2 font-bold">
								<Scale size={18} /> Cảnh báo tồn kho
							</h2>
						</div>
						<table className="erp-table">
							<thead>
								<tr>
									<th>Mã hàng</th>
									<th>Hàng hóa / Quy cách</th>
									<th className="text-right">Tồn hiện tại</th>
									<th className="text-right">Tồn tối thiểu</th>
									<th>Trạng thái</th>
								</tr>
							</thead>
							<tbody>
								{data.lowStock.map(x => (
									<tr key={x.id}>
										<td>{x.sku}</td>
										<td>
											{x.productName} - {x.packagingName}
										</td>
										<td className="text-right font-bold">
											{formatNumber(Number(x.stock || 0))}
										</td>
										<td className="text-right">
											{formatNumber(Number(x.minStock || 0))}
										</td>
										<td>
											<span
												className={`erp-badge ${Number(x.stock) <= 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}
											>
												{Number(x.stock) <= 0 ? "Hết hàng" : "Sắp hết"}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			)}
		</div>
	);
}
