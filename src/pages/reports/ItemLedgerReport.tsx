import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import SearchableSelect from "../../components/SearchableSelect";
import RightDrawer from "../../components/RightDrawer";
import { apiV1, legacyApi } from "../../lib/apiV1";
import { formatDate, formatProductName } from "../../lib/utils";
import { ledgerSourceTypeLabel } from "../../lib/ledger-labels";
import type {
	ItemLedgerReportV1,
	LedgerDocumentReportV1,
	Product,
} from "../../types";
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

export default function ItemLedgerReport() {
	const [searchParams] = useSearchParams();
	const [from, setFrom] = useState(searchParams.get("from") || monthStart());
	const [to, setTo] = useState(searchParams.get("to") || today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [packagingId, setPackagingId] = useState(
		Number(searchParams.get("packagingId") || 0),
	);
	const [includeReversals, setIncludeReversals] = useState(false);
	const [documentRef, setDocumentRef] = useState<{
		sourceType: string;
		sourceId: number;
	} | null>(null);
	const refs = useReportRefs();
	const products = useQuery({
		queryKey: ["report-products"],
		staleTime: 5 * 60 * 1000,
		queryFn: () => legacyApi<Product[]>("/api/products"),
	});
	const packagings = useMemo(
		() =>
			(products.data || []).flatMap(product =>
				(product.packagings || []).map(packaging => ({
					...packaging,
					productName: product.name,
				})),
			),
		[products.data],
	);
	const packagingOptions = useMemo(
		() =>
			packagings.map(packaging => ({
				value: packaging.id,
				label: `${packaging.productName} - ${packaging.name}`,
				subLabel: [packaging.sku, packaging.unit].filter(Boolean).join(" · "),
			})),
		[packagings],
	);
	const params = new URLSearchParams({
		from,
		to,
		packagingId: String(packagingId),
		includeReversals: includeReversals ? "true" : "false",
	});
	if (warehouseId) params.set("warehouseId", String(warehouseId));
	const query = useQuery({
		queryKey: [
			"report-item-ledger",
			from,
			to,
			warehouseId,
			packagingId,
			includeReversals,
		],
		enabled: packagingId > 0,
		queryFn: () =>
			apiV1<ItemLedgerReportV1>(
				`/api/v1/reports/item-ledger?${params.toString()}`,
			),
	});
	const documentQuery = useQuery({
		queryKey: ["report-ledger-document", documentRef],
		enabled: !!documentRef,
		queryFn: () => {
			const detailParams = new URLSearchParams({
				sourceType: documentRef?.sourceType || "",
				sourceId: String(documentRef?.sourceId || 0),
			});
			return apiV1<LedgerDocumentReportV1>(
				`/api/v1/reports/item-ledger/document?${detailParams.toString()}`,
			);
		},
	});
	const documentData = documentQuery.data?.data;
	const data = query.data?.data;
	const rows = data?.rows || [];
	const totalInbound = rows.reduce(
		(sum, row) => sum + Number(row.inboundQuantity || 0),
		0,
	);
	const totalOutbound = rows.reduce(
		(sum, row) => sum + Number(row.outboundQuantity || 0),
		0,
	);
	const exportExcel = useReportExport();
	const onExport = () =>
		exportExcel(
			`So_chi_tiet_vat_tu_${from}_${to}.xlsx`,
			"So chi tiet",
			[
				{
					header: "Thời gian",
					value: (r: ItemLedgerReportV1["rows"][number]) => r.occurredAt,
					width: 20,
				},
				{ header: "Chứng từ", value: r => r.documentCode, width: 18 },
				{
					header: "Loại",
					value: r =>
						ledgerSourceTypeLabel(
							r.sourceType,
							r.sourceModule,
							r.direction,
							r.description,
						),
					width: 26,
				},
				{ header: "Diễn giải", value: r => r.description || "", width: 36 },
				{ header: "Kho", value: r => r.warehouseName, width: 20 },
				{ header: "Nhập SL", value: r => r.inboundQuantity, width: 12 },
				{ header: "Xuất SL", value: r => r.outboundQuantity, width: 12 },
				{ header: "Đơn giá", value: r => r.unitCost, width: 14 },
				{ header: "Tồn SL", value: r => r.runningQuantity, width: 12 },
				{ header: "Tồn giá trị", value: r => r.runningValue, width: 16 },
			],
			rows,
		);

	return (
		<ReportShell
			title="Sổ chi tiết vật tư"
			description="Toàn bộ phát sinh nhập – xuất và số dư lũy kế của một mã hàng"
			actions={<ExportButton onClick={onExport} />}
		>
			<FilterBar>
				<div className="md:col-span-2">
					<ReportPeriodFilter
						from={from}
						to={to}
						onChange={(f, t) => {
							setFrom(f);
							setTo(t);
						}}
					/>
				</div>
				{/* <WarehouseSelect
					value={warehouseId}
					onChange={setWarehouseId}
					warehouses={refs.data?.warehouses || []}
				/> */}
				<label>
					Mặt hàng
					<SearchableSelect
						value={packagingId}
						options={packagingOptions}
						onChange={setPackagingId}
						placeholder="Nhập tên/SKU để chọn mặt hàng"
					/>
				</label>
				<label className="flex items-end gap-2 pb-2 text-sm">
					<input
						type="checkbox"
						checked={includeReversals}
						onChange={e => setIncludeReversals(e.target.checked)}
					/>
					Hiện bút toán hủy
				</label>
			</FilterBar>

			{packagingId > 0 && data ? (
				<>
					<div className="text-lg font-bold text-center erp-card p-4">
						{data.packaging.productName || "-"}
					</div>

					<StatGrid>
						{/* <StatCard
        label="Mặt hàng"
        value={data.packaging.productName || "-"}
        hint={data.packaging.name}
    /> */}
						<StatCard
							label="Tồn đầu kỳ"
							value={`${qty(data.openingQuantity)} ${data.packaging.unit || ""}`}
							hint={money(data.openingValue)}
						/>
						{/* <StatCard label="Số phát sinh" value={qty(rows.length)} /> */}
						<StatCard
							label="Tổng số lượng nhập"
							value={`${qty(totalInbound)} ${data.packaging.unit || ""}`}
							tone="positive"
						/>
						<StatCard
							label="Tổng số lượng xuất"
							value={`${qty(totalOutbound)} ${data.packaging.unit || ""}`}
							tone="negative"
						/>
						<StatCard
							label="Tồn cuối kỳ"
							value={`${qty(data.closingQuantity)} ${data.packaging.unit || ""}`}
							hint={money(data.closingValue)}
							tone="info"
						/>
					</StatGrid>
				</>
			) : null}

			<ReportCard
				title="Sổ chi tiết"
				description={
					packagingId > 0
						? `${rows.length} phát sinh`
						: "Chọn một mặt hàng để xem"
				}
			>
				{packagingId === 0 ? (
					<div className="erp-empty p-12 text-center text-slate-400">
						Vui lòng chọn một mặt hàng để xem sổ chi tiết.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="erp-table">
							<thead>
								<tr>
									<th>Thời gian</th>
									<th>Chứng từ</th>
									<th>Loại</th>
									<th>Diễn giải</th>
									<th>Kho</th>
									<th className="text-right">Nhập</th>
									<th className="text-right">Xuất</th>
									<th className="text-right">Đơn giá</th>
									<th className="text-right">Tồn SL</th>
									<th className="text-right">Tồn giá trị</th>
								</tr>
							</thead>
							<TableState
								colSpan={10}
								loading={query.isLoading}
								error={query.isError ? (query.error as Error).message : null}
								empty={!rows.length}
							>
								{rows.map(row => (
									<tr key={row.id}>
										<td>{formatDate(row.occurredAt)}</td>
										<td>
											<button
												type="button"
												className="font-bold text-[#422afb] hover:underline"
												onClick={() =>
													setDocumentRef({
														sourceType: row.sourceType,
														sourceId: row.sourceId,
													})
												}
											>
												{row.documentCode}
											</button>
										</td>
										<td>
											{ledgerSourceTypeLabel(
												row.sourceType,
												row.sourceModule,
												row.direction,
												row.description,
											)}
										</td>
										<td className="max-w-[320px] truncate" title={row.description || ""}>
											{row.description || "-"}
										</td>
										<td>{row.warehouseName}</td>
										<td className="text-right text-emerald-600">
											{row.inboundQuantity ? qty(row.inboundQuantity) : "-"}
										</td>
										<td className="text-right text-red-600">
											{row.outboundQuantity ? qty(row.outboundQuantity) : "-"}
										</td>
										<td className="text-right">{money(row.unitCost)}</td>
										<td className="text-right font-semibold">
											{qty(row.runningQuantity)}
										</td>
										<td className="text-right">{money(row.runningValue)}</td>
									</tr>
								))}
							</TableState>
						</table>
					</div>
				)}
			</ReportCard>

			<RightDrawer
				open={!!documentRef}
				title={
					documentData
						? `${documentData.documentType} ${documentData.code}`
						: "Chi tiết chứng từ"
				}
				subtitle={
					documentData
						? [documentData.documentDate ? formatDate(documentData.documentDate) : "", documentData.status]
								.filter(Boolean)
								.join(" · ")
						: undefined
				}
				widthClass="max-w-[64rem]"
				onClose={() => setDocumentRef(null)}
			>
				{documentQuery.isLoading ? (
					<div className="py-10 text-center text-sm text-slate-500">
						Đang tải chi tiết chứng từ...
					</div>
				) : documentQuery.isError ? (
					<div className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
						{(documentQuery.error as Error).message}
					</div>
				) : documentData ? (
					<div className="space-y-4">
						<div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
							<div>
								<small>Mã chứng từ</small>
								<b className="block">{documentData.code}</b>
							</div>
							<div>
								<small>Loại chứng từ</small>
								<b className="block">{documentData.documentType}</b>
							</div>
							<div>
								<small>Ngày chứng từ</small>
								<b className="block">
									{documentData.documentDate
										? formatDate(documentData.documentDate)
										: "-"}
								</b>
							</div>
							<div>
								<small>Trạng thái</small>
								<b className="block">{documentData.status || "-"}</b>
							</div>
							<div>
								<small>Kho / Đối tượng</small>
								<b className="block">
									{documentData.warehouseName || documentData.partnerName || "-"}
								</b>
								{documentData.warehouseName && documentData.partnerName ? (
									<span className="text-xs text-slate-500">
										{documentData.partnerName}
									</span>
								) : null}
							</div>
							<div>
								<small>Diễn giải</small>
								<b className="block">{documentData.note || "-"}</b>
								{documentData.cancelReason ? (
									<span className="text-xs text-red-600">
										Lý do hủy: {documentData.cancelReason}
									</span>
								) : null}
							</div>
						</div>
						<div className="overflow-x-auto rounded-lg border border-slate-200">
							<table className="erp-table w-full min-w-[720px]">
								<thead>
									<tr>
										<th>STT</th>
										<th>Mã hàng</th>
										<th>Tên hàng hóa</th>
										<th>ĐVT</th>
										<th className="text-right">Số lượng</th>
										<th className="text-right">Đơn giá</th>
										<th className="text-right">Thành tiền</th>
										<th>Ghi chú</th>
									</tr>
								</thead>
								<tbody>
									{documentData.lines.length ? (
										documentData.lines.map((line, index) => (
											<tr key={line.id}>
												<td>{index + 1}</td>
												<td className="font-mono">{line.sku || "-"}</td>
												<td>
													{formatProductName(
														line.productName,
														line.packagingName,
													) || "-"}
												</td>
												<td>{line.unit || ""}</td>
												<td className="text-right">
													{qty(
														line.actualQuantity ??
															line.quantity,
													)}
													{line.actualQuantity != null &&
													line.plannedQuantity != null ? (
														<small>
															KH: {qty(line.plannedQuantity)}
														</small>
													) : null}
												</td>
												<td className="text-right">
													{line.unitCost == null
														? "-"
														: money(line.unitCost)}
												</td>
												<td className="text-right">
													{line.totalValue == null
														? "-"
														: money(line.totalValue)}
												</td>
												<td>{line.note || "-"}</td>
											</tr>
										))
									) : (
										<tr>
											<td colSpan={8} className="py-8 text-center text-slate-400">
												Không có dòng chi tiết
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
					</div>
				) : (
					<div className="py-10 text-center text-sm text-slate-500">
						Không có dữ liệu chi tiết.
					</div>
				)}
			</RightDrawer>
		</ReportShell>
	);
}
