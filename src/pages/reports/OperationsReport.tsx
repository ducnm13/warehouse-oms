import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import { apiV1 } from "../../lib/apiV1";
import { formatDate } from "../../lib/utils";
import type { OperationsReportV1 } from "../../types";
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
const TYPE: Record<string, { label: string; cls: string }> = {
	PRODUCTION: { label: "Sản xuất", cls: "erp-badge-info" },
	ASSEMBLY: { label: "Lắp ráp", cls: "erp-badge-success" },
	DISASSEMBLY: { label: "Tháo dỡ", cls: "erp-badge-warning" },
};

export default function OperationsReport() {
	const [from, setFrom] = useState(monthStart());
	const [to, setTo] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [type, setType] = useState("");
	const [search, setSearch] = useState("");
	const refs = useReportRefs();
	const params = new URLSearchParams({ from, to });
	if (warehouseId) params.set("warehouseId", String(warehouseId));
	if (type) params.set("type", type);
	if (search.trim()) params.set("search", search.trim());
	const query = useQuery({
		queryKey: ["report-operations", from, to, warehouseId, type, search],
		queryFn: () => apiV1<OperationsReportV1>(`/api/v1/reports/operations?${params.toString()}`),
	});
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(`Bao_cao_san_xuat_lap_rap_${from}_${to}.xlsx`, "Van hanh", [
			{ header: "Loại", value: (r: OperationsReportV1["rows"][number]) => TYPE[r.type]?.label || r.type, width: 14 },
			{ header: "Mã", value: r => r.code, width: 16 },
			{ header: "Thời gian", value: r => r.occurredAt, width: 20 },
			{ header: "Hàng hóa", value: r => r.itemName || "", width: 30 },
			{ header: "Kế hoạch", value: r => r.plannedQuantity, width: 12 },
			{ header: "Thực tế", value: r => r.actualQuantity, width: 12 },
			{ header: "Giá trị vào", value: r => r.inputValue, width: 16 },
			{ header: "Giá trị ra", value: r => r.outputValue, width: 16 },
			{ header: "Hao hụt", value: r => r.lossQuantity, width: 12 },
		], rows);

	return (
		<ReportShell title="Sản xuất – Lắp ráp – Tháo dỡ" description="Tổng hợp các chứng từ vận hành kho: sản xuất, lắp ráp và tháo dỡ" actions={<ExportButton onClick={onExport} />}>
			<FilterBar>
				<div className="md:col-span-2">
					<ReportPeriodFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
				</div>
				<WarehouseSelect value={warehouseId} onChange={setWarehouseId} warehouses={refs.data?.warehouses || []} />
				<label>
					Loại
					<select value={type} onChange={e => setType(e.target.value)}>
						<option value="">Tất cả</option>
						<option value="PRODUCTION">Sản xuất</option>
						<option value="ASSEMBLY">Lắp ráp</option>
						<option value="DISASSEMBLY">Tháo dỡ</option>
					</select>
				</label>
				<label>
					Tìm kiếm
					<div className="erp-search mt-1 w-full max-w-none">
						<Search size={16} />
						<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Mã chứng từ..." />
					</div>
				</label>
			</FilterBar>

			<StatGrid>
				<StatCard label="Số chứng từ" value={qty(summary?.orders || 0)} />
				<StatCard label="Sản lượng thực tế" value={qty(summary?.actualQuantity || 0)} tone="info" />
				<StatCard label="Giá trị đầu vào" value={money(summary?.inputValue || 0)} />
				<StatCard label="Giá trị đầu ra" value={money(summary?.outputValue || 0)} tone="positive" />
			</StatGrid>

			<ReportCard title="Danh sách chứng từ vận hành" description={`${rows.length} chứng từ`}>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Loại</th>
								<th>Mã / Thời gian</th>
								<th>Hàng hóa</th>
								<th className="text-right">Kế hoạch</th>
								<th className="text-right">Thực tế</th>
								<th className="text-right">Giá trị vào</th>
								<th className="text-right">Giá trị ra</th>
							</tr>
						</thead>
						<TableState colSpan={7} loading={query.isLoading} error={query.isError ? (query.error as Error).message : null} empty={!rows.length}>
							{rows.map(row => (
								<tr key={`${row.type}-${row.id}`}>
									<td><span className={`erp-badge ${TYPE[row.type]?.cls || ""}`}>{TYPE[row.type]?.label || row.type}</span></td>
									<td><b>{row.code}</b><small>{row.occurredAt ? formatDate(row.occurredAt) : "-"}</small></td>
									<td>{row.itemName || "-"}</td>
									<td className="text-right">{qty(row.plannedQuantity)}</td>
									<td className="text-right font-semibold">{qty(row.actualQuantity)}</td>
									<td className="text-right">{money(row.inputValue)}</td>
									<td className="text-right">{money(row.outputValue)}</td>
								</tr>
							))}
						</TableState>
					</table>
				</div>
			</ReportCard>
		</ReportShell>
	);
}
