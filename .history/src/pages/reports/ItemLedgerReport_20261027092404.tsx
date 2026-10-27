import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import SearchableSelect from "../../components/SearchableSelect";
import { apiV1, legacyApi } from "../../lib/apiV1";
import { formatDate } from "../../lib/utils";
import { ledgerSourceTypeLabel } from "../../lib/ledger-labels";
import type { ItemLedgerReportV1, Product } from "../../types";
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
	const [from, setFrom] = useState(monthStart());
	const [to, setTo] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [packagingId, setPackagingId] = useState(0);
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
	});
	if (warehouseId) params.set("warehouseId", String(warehouseId));
	const query = useQuery({
		queryKey: ["report-item-ledger", from, to, warehouseId, packagingId],
		enabled: packagingId > 0,
		queryFn: () =>
			apiV1<ItemLedgerReportV1>(
				`/api/v1/reports/item-ledger?${params.toString()}`,
			),
	});
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
					value: r => ledgerSourceTypeLabel(r.sourceType),
					width: 22,
				},
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
				<div className="md:col-span-3">
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
			</FilterBar>

			{packagingId > 0 && data ? (
				<>
					<div>{data.packaging.productName || "-"}</div>
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
						<StatCard label="Số phát sinh" value={qty(rows.length)} />
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
									<th>Kho</th>
									<th className="text-right">Nhập</th>
									<th className="text-right">Xuất</th>
									<th className="text-right">Đơn giá</th>
									<th className="text-right">Tồn SL</th>
									<th className="text-right">Tồn giá trị</th>
								</tr>
							</thead>
							<TableState
								colSpan={9}
								loading={query.isLoading}
								error={query.isError ? (query.error as Error).message : null}
								empty={!rows.length}
							>
								{rows.map(row => (
									<tr key={row.id}>
										<td>{formatDate(row.occurredAt)}</td>
										<td>
											<b>{row.documentCode}</b>
										</td>
										<td>{ledgerSourceTypeLabel(row.sourceType)}</td>
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
		</ReportShell>
	);
}
