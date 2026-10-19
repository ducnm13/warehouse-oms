import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import { apiV1 } from "../../lib/apiV1";
import type { PurchaseBySupplierReportV1 } from "../../types";
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
} from "../../components/reports/ReportKit";

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;

export default function PurchasesBySupplierReport() {
	const [from, setFrom] = useState(monthStart());
	const [to, setTo] = useState(today());
	const [supplierId, setSupplierId] = useState(0);
	const [search, setSearch] = useState("");
	const refs = useReportRefs();
	const params = new URLSearchParams({ from, to });
	if (supplierId) params.set("supplierId", String(supplierId));
	if (search.trim()) params.set("search", search.trim());
	const query = useQuery({
		queryKey: ["report-purchases-supplier", from, to, supplierId, search],
		queryFn: () => apiV1<PurchaseBySupplierReportV1>(`/api/v1/reports/purchases-by-supplier?${params.toString()}`),
	});
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(`Bao_cao_mua_hang_theo_ncc_${from}_${to}.xlsx`, "Theo NCC", [
			{ header: "Mã NCC", value: (r: PurchaseBySupplierReportV1["rows"][number]) => r.supplierCode || "", width: 14 },
			{ header: "Nhà cung cấp", value: r => r.supplierName, width: 30 },
			{ header: "Số chứng từ", value: r => r.documents, width: 12 },
			{ header: "Tiền hàng", value: r => r.goodsAmount, width: 16 },
			{ header: "Thuế", value: r => r.taxAmount, width: 14 },
			{ header: "Tổng tiền", value: r => r.totalAmount, width: 16 },
			{ header: "Đã trả", value: r => r.paidAmount, width: 16 },
			{ header: "Còn nợ", value: r => r.outstanding, width: 16 },
		], rows);

	return (
		<ReportShell title="Mua hàng theo nhà cung cấp" description="Giá trị nhập hàng, đã thanh toán và công nợ phải trả theo nhà cung cấp" actions={<ExportButton onClick={onExport} />}>
			<FilterBar>
				<div className="md:col-span-2">
					<ReportPeriodFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
				</div>
				<label>
					Nhà cung cấp
					<select value={supplierId} onChange={e => setSupplierId(Number(e.target.value))}>
						<option value={0}>Tất cả nhà cung cấp</option>
						{(refs.data?.suppliers || []).map(supplier => (
							<option key={supplier.id} value={supplier.id}>{supplier.name}</option>
						))}
					</select>
				</label>
				<label>
					Tìm kiếm
					<div className="erp-search mt-1 w-full max-w-none">
						<Search size={16} />
						<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nhà cung cấp, mã chứng từ..." />
					</div>
				</label>
			</FilterBar>

			<StatGrid>
				<StatCard label="Tổng mua hàng" value={money(summary?.totalAmount || 0)} tone="info" />
				<StatCard label="Đã thanh toán" value={money(summary?.paidAmount || 0)} tone="positive" />
				<StatCard label="Còn nợ" value={money(summary?.outstanding || 0)} tone="negative" />
				<StatCard label="Số nhà cung cấp" value={qty(rows.length)} hint={`${qty(summary?.documents || 0)} chứng từ`} />
			</StatGrid>

			<ReportCard title="Chi tiết theo nhà cung cấp" description={`${rows.length} nhà cung cấp`}>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Mã NCC</th>
								<th>Nhà cung cấp</th>
								<th className="text-right">Số chứng từ</th>
								<th className="text-right">Tiền hàng</th>
								<th className="text-right">Thuế</th>
								<th className="text-right">Tổng tiền</th>
								<th className="text-right">Đã trả</th>
								<th className="text-right">Còn nợ</th>
							</tr>
						</thead>
						<TableState colSpan={8} loading={query.isLoading} error={query.isError ? (query.error as Error).message : null} empty={!rows.length}>
							{rows.map(row => (
								<tr key={row.supplierId}>
									<td><b>{row.supplierCode || "-"}</b></td>
									<td>{row.supplierName}</td>
									<td className="text-right">{qty(row.documents)}</td>
									<td className="text-right">{money(row.goodsAmount)}</td>
									<td className="text-right">{money(row.taxAmount)}</td>
									<td className="text-right font-semibold">{money(row.totalAmount)}</td>
									<td className="text-right text-emerald-600">{money(row.paidAmount)}</td>
									<td className="text-right font-bold text-red-600">{money(row.outstanding)}</td>
								</tr>
							))}
						</TableState>
					</table>
				</div>
			</ReportCard>
		</ReportShell>
	);
}
