import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search } from "lucide-react";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import { apiV1 } from "../../lib/apiV1";
import { formatDate } from "../../lib/utils";
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
	useReportRefs,
	WarehouseSelect,
} from "../../components/reports/ReportKit";

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;
const STATUS: Record<string, { label: string; cls: string }> = {
	DRAFT: { label: "Nháp", cls: "erp-badge-draft" },
	IN_TRANSIT: { label: "Đang chuyển", cls: "erp-badge-in-progress" },
	RECEIVED: { label: "Đã nhận", cls: "erp-badge-completed" },
	CANCELLED: { label: "Đã hủy", cls: "erp-badge-cancelled" },
};

interface Row {
	id: number;
	code: string;
	transferDate: string;
	status: string;
	fromWarehouseName: string;
	toWarehouseName: string;
	lineCount: number;
	quantity: number;
}
interface Result {
	rows: Row[];
	summary: { docs: number; quantity: number };
}

export default function TransfersReport() {
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
		queryKey: ["report-transfers", from, to, warehouseId, status, search],
		queryFn: () => apiV1<Result>(`/api/v1/reports/transfers?${params.toString()}`),
	});
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(`Bao_cao_chuyen_kho_${from}_${to}.xlsx`, "Chuyen kho", [
			{ header: "Mã phiếu", value: (r: Row) => r.code, width: 16 },
			{ header: "Ngày", value: r => r.transferDate, width: 14 },
			{ header: "Kho nguồn", value: r => r.fromWarehouseName, width: 22 },
			{ header: "Kho đích", value: r => r.toWarehouseName, width: 22 },
			{ header: "Trạng thái", value: r => STATUS[r.status]?.label || r.status, width: 14 },
			{ header: "Số dòng", value: r => r.lineCount, width: 10 },
			{ header: "Số lượng", value: r => r.quantity, width: 14 },
		], rows);

	return (
		<ReportShell title="Chuyển kho" description="Danh sách phiếu chuyển kho và tổng sản lượng luân chuyển giữa các kho" actions={<ExportButton onClick={onExport} />}>
			<FilterBar>
				<div className="md:col-span-2">
					<ReportPeriodFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
				</div>
				<WarehouseSelect value={warehouseId} onChange={setWarehouseId} warehouses={refs.data?.warehouses || []} placeholder="Tất cả kho (nguồn/đích)" />
				<label>
					Trạng thái
					<select value={status} onChange={e => setStatus(e.target.value)}>
						<option value="">Tất cả</option>
						<option value="DRAFT">Nháp</option>
						<option value="IN_TRANSIT">Đang chuyển</option>
						<option value="RECEIVED">Đã nhận</option>
						<option value="CANCELLED">Đã hủy</option>
					</select>
				</label>
				<label>
					Tìm kiếm
					<div className="erp-search mt-1 w-full max-w-none">
						<Search size={16} />
						<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã phiếu, ghi chú..." />
					</div>
				</label>
			</FilterBar>

			<StatGrid>
				<StatCard label="Tổng phiếu chuyển" value={qty(summary?.docs || 0)} />
				<StatCard label="Tổng sản lượng" value={qty(summary?.quantity || 0)} tone="info" />
				<StatCard label="Phiếu đã nhận" value={qty(rows.filter(r => r.status === "RECEIVED").length)} tone="positive" />
				<StatCard label="Phiếu đang chuyển" value={qty(rows.filter(r => r.status === "IN_TRANSIT").length)} tone="warning" />
			</StatGrid>

			<ReportCard title="Danh sách phiếu chuyển kho" description={`${rows.length} phiếu`}>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Mã phiếu / Ngày</th>
								<th>Kho nguồn</th>
								<th></th>
								<th>Kho đích</th>
								<th>Trạng thái</th>
								<th className="text-right">Số dòng</th>
								<th className="text-right">Số lượng</th>
							</tr>
						</thead>
						<TableState colSpan={7} loading={query.isLoading} error={query.isError ? (query.error as Error).message : null} empty={!rows.length}>
							{rows.map(row => (
								<tr key={row.id}>
									<td><b>{row.code}</b><small>{formatDate(row.transferDate)}</small></td>
									<td>{row.fromWarehouseName}</td>
									<td className="text-slate-400"><ArrowRight size={14} /></td>
									<td>{row.toWarehouseName}</td>
									<td><span className={`erp-badge ${STATUS[row.status]?.cls || ""}`}>{STATUS[row.status]?.label || row.status}</span></td>
									<td className="text-right">{qty(row.lineCount)}</td>
									<td className="text-right font-semibold">{qty(row.quantity)}</td>
								</tr>
							))}
						</TableState>
					</table>
				</div>
			</ReportCard>
		</ReportShell>
	);
}
