import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import { apiV1 } from "../../lib/apiV1";
import { formatDate } from "../../lib/utils";
import type { SalesReturnReportV1 } from "../../types";
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
	useReportRefs,
	WarehouseSelect,
} from "../../components/reports/ReportKit";

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;
const STATUS: Record<string, { label: string; cls: string }> = {
	DRAFT: { label: "Nháp", cls: "erp-badge-draft" },
	POSTED: { label: "Đã lưu", cls: "erp-badge-posted" },
	CANCELLED: { label: "Đã hủy", cls: "erp-badge-cancelled" },
};

export default function SalesReturnsReport() {
	const [from, setFrom] = useState(monthStart());
	const [to, setTo] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [status, setStatus] = useState("");
	const [search, setSearch] = useState("");
	const refs = useReportRefs();
	const params = new URLSearchParams({ from, to });
	if (warehouseId) params.set("warehouseId", String(warehouseId));
	if (status) params.set("status", status);
	if (search.trim()) params.set("search", search.trim());
	const query = useQuery({
		queryKey: ["report-sales-returns", from, to, warehouseId, status, search],
		queryFn: () => apiV1<SalesReturnReportV1>(`/api/v1/reports/sales-returns?${params.toString()}`),
	});
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(`Bao_cao_tra_hang_ban_${from}_${to}.xlsx`, "Tra hang", [
			{ header: "Mã phiếu", value: (r: SalesReturnReportV1["rows"][number]) => r.code, width: 16 },
			{ header: "Ngày", value: r => r.returnDate, width: 14 },
			{ header: "Đơn gốc", value: r => r.originalOrderCode, width: 16 },
			{ header: "Khách hàng", value: r => r.customerName, width: 28 },
			{ header: "Kho", value: r => r.warehouseName, width: 20 },
			{ header: "Trạng thái", value: r => STATUS[r.status]?.label || r.status, width: 14 },
			{ header: "Tiền hàng", value: r => r.subtotal, width: 16 },
			{ header: "Thuế", value: r => r.taxAmount, width: 14 },
			{ header: "Tổng tiền", value: r => r.totalAmount, width: 16 },
			{ header: "Giá vốn", value: r => r.costAmount, width: 16 },
			{ header: "Lý do", value: r => r.reason, width: 30 },
		], rows);

	return (
		<ReportShell title="Trả hàng bán" description="Danh sách phiếu trả hàng bán theo kỳ, khách hàng và kho" actions={<ExportButton onClick={onExport} />}>
			<FilterBar>
				<div className="md:col-span-2">
					<ReportPeriodFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
				</div>
				<WarehouseSelect value={warehouseId} onChange={setWarehouseId} warehouses={refs.data?.warehouses || []} />
				<label>
					Trạng thái
					<select value={status} onChange={e => setStatus(e.target.value)}>
						<option value="">Tất cả</option>
						<option value="DRAFT">Nháp</option>
						<option value="POSTED">Đã lưu</option>
						<option value="CANCELLED">Đã hủy</option>
					</select>
				</label>
				<label>
					Tìm kiếm
					<div className="erp-search mt-1 w-full max-w-none">
						<Search size={16} />
						<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã phiếu, khách hàng..." />
					</div>
				</label>
			</FilterBar>

			<StatGrid>
				<StatCard label="Tổng phiếu" value={qty(summary?.documents || 0)} hint={`${summary?.posted || 0} đã lưu`} />
				<StatCard label="Tổng tiền trả" value={money(summary?.totalAmount || 0)} tone="negative" />
				<StatCard label="Tiền hàng" value={money(summary?.subtotal || 0)} />
				<StatCard label="Giá vốn nhập lại" value={money(summary?.costAmount || 0)} tone="info" />
			</StatGrid>

			<ReportCard title="Danh sách phiếu trả hàng" description={`${rows.length} phiếu`}>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Mã phiếu / Ngày</th>
								<th>Đơn gốc</th>
								<th>Khách hàng</th>
								<th>Kho</th>
								<th>Trạng thái</th>
								<th className="text-right">Tiền hàng</th>
								<th className="text-right">Tổng tiền</th>
							</tr>
						</thead>
						<TableState colSpan={7} loading={query.isLoading} error={query.isError ? (query.error as Error).message : null} empty={!rows.length}>
							{rows.map(row => (
								<tr key={row.id}>
									<td><b>{row.code}</b><small>{formatDate(row.returnDate)}</small></td>
									<td>{row.originalOrderCode}</td>
									<td>{row.customerName}<small>{row.customerCode || "-"}</small></td>
									<td>{row.warehouseName}</td>
									<td><span className={`erp-badge ${STATUS[row.status]?.cls || ""}`}>{STATUS[row.status]?.label || row.status}</span></td>
									<td className="text-right">{money(row.subtotal)}</td>
									<td className="text-right font-bold text-red-600">{money(row.totalAmount)}</td>
								</tr>
							))}
						</TableState>
					</table>
				</div>
			</ReportCard>
		</ReportShell>
	);
}
