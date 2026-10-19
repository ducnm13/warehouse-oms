import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import { apiV1 } from "../../lib/apiV1";
import {
	ExportButton,
	FilterBar,
	qty,
	ReportCard,
	ReportShell,
	StatCard,
	StatGrid,
	TableState,
	useReportExport,
} from "../../components/reports/ReportKit";

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

interface Row {
	programId: number;
	programCode: string;
	programName: string;
	packagingId: number;
	sku?: string;
	packagingName: string;
	unit?: string;
	productName: string;
	orders: number;
	giftQty: number;
}
interface Result {
	rows: Row[];
	summary: { programs: number; orders: number; giftQty: number };
}

export default function PromotionUsageReport() {
	const [from, setFrom] = useState(monthStart());
	const [to, setTo] = useState(today());
	const query = useQuery({
		queryKey: ["report-promotion-usage", from, to],
		queryFn: () => apiV1<Result>(`/api/v1/promotions/usage-summary?from=${from}&to=${to}`),
	});
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(`Bao_cao_khuyen_mai_${from}_${to}.xlsx`, "Khuyen mai", [
			{ header: "Mã CT", value: (r: Row) => r.programCode, width: 16 },
			{ header: "Chương trình", value: r => r.programName, width: 30 },
			{ header: "Quà tặng", value: r => r.productName, width: 28 },
			{ header: "Quy cách", value: r => r.packagingName, width: 22 },
			{ header: "SKU", value: r => r.sku || "", width: 16 },
			{ header: "Số đơn", value: r => r.orders, width: 10 },
			{ header: "SL quà tặng", value: r => r.giftQty, width: 14 },
		], rows);

	return (
		<ReportShell title="Sử dụng khuyến mãi" description="Thống kê số đơn và số lượng quà tặng đã phát sinh theo chương trình khuyến mãi" actions={<ExportButton onClick={onExport} />}>
			<FilterBar>
				<div className="md:col-span-2">
					<ReportPeriodFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
				</div>
			</FilterBar>

			<StatGrid>
				<StatCard label="Số chương trình" value={qty(summary?.programs || 0)} />
				<StatCard label="Số đơn áp dụng" value={qty(summary?.orders || 0)} tone="info" />
				<StatCard label="Tổng quà tặng" value={qty(summary?.giftQty || 0)} tone="positive" />
				<StatCard label="Số dòng quà tặng" value={qty(rows.length)} />
			</StatGrid>

			<ReportCard title="Chi tiết theo chương trình và quà tặng" description={`${rows.length} dòng`}>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Mã CT</th>
								<th>Chương trình</th>
								<th>Quà tặng</th>
								<th>SKU</th>
								<th className="text-right">Số đơn</th>
								<th className="text-right">SL quà tặng</th>
							</tr>
						</thead>
						<TableState colSpan={6} loading={query.isLoading} error={query.isError ? (query.error as Error).message : null} empty={!rows.length}>
							{rows.map(row => (
								<tr key={`${row.programId}-${row.packagingId}`}>
									<td><b>{row.programCode}</b></td>
									<td>{row.programName}</td>
									<td>{row.productName}<small>{row.packagingName}</small></td>
									<td>{row.sku || "-"}</td>
									<td className="text-right">{qty(row.orders)}</td>
									<td className="text-right font-semibold">{qty(row.giftQty)} {row.unit || ""}</td>
								</tr>
							))}
						</TableState>
					</table>
				</div>
			</ReportCard>
		</ReportShell>
	);
}
