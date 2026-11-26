import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
	Boxes,
	Calculator,
	History,
	Package,
	Plus,
	Search,
	Wallet,
	X,
} from "lucide-react";
import ReportPeriodFilter from "../../components/ReportPeriodFilter";
import { useCanViewMoney } from "../../hooks/useCanViewMoney";
import { useHasPermission } from "../../hooks/useHasPermission";
import { apiV1 } from "../../lib/apiV1";
import { confirm } from "../../components/ui/confirm";
import toast from "../../components/ui/toast";
import {
	COST_CATEGORY_META,
	COST_TIER_META,
	QUICK_COST_PRESETS,
} from "../../lib/costing";
import type {
	CostBreakdownItemV1,
	CostCenterV1,
	CostSheetV1,
	CostTier,
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

interface Row {
	packagingId: number;
	sku?: string;
	packagingName: string;
	unit?: string;
	productName: string;
	orders: number;
	plannedPacks: number;
	actualPacks: number;
	powderKg: number;
	materialValue: number;
	materialCostPerUnit: number;
	overheadCost: number;
	overheadBreakdown: CostBreakdownItemV1[];
	totalCost: number;
	costPerUnit: number;
}
interface Summary {
	plannedPacks: number;
	actualPacks: number;
	powderKg: number;
	materialValue: number;
	overheadCost: number;
	totalCost: number;
	avgMaterialCostPerUnit: number;
	avgCostPerUnit: number;
	overheadBreakdown: CostBreakdownItemV1[];
}
interface AssemblyComponent {
	packagingId: number;
	sku: string | null;
	name: string;
	unit: string | null;
	quantity: number;
	unitCost: number;
	value: number;
	source: "PRODUCTION" | "INVENTORY";
}
interface AssemblyRow {
	packagingId: number;
	sku: string | null;
	packagingName: string;
	unit: string | null;
	productName: string;
	orders: number;
	actualQty: number;
	plannedQty: number;
	packValue: number;
	assemblyMaterialValue: number;
	assemblyExtraCost: number;
	externalCost: number;
	materialCostPerUnit: number;
	powderKg: number;
	overheadCost: number;
	overheadBreakdown: CostBreakdownItemV1[];
	totalCost: number;
	costPerUnit: number;
	inventoryValue: number;
	components: AssemblyComponent[];
}
interface AssemblySummary {
	orders: number;
	actualQty: number;
	plannedQty: number;
	packValue: number;
	assemblyMaterialValue: number;
	assemblyExtraCost: number;
	externalCost: number;
	overheadCost: number;
	totalCost: number;
	avgMaterialCostPerUnit: number;
	avgCostPerUnit: number;
	inventoryValue: number;
	overheadBreakdown: CostBreakdownItemV1[];
}
interface Result {
	tier: "ALL" | CostTier;
	rows: Row[];
	summary: Summary;
	assembly: {
		rows: AssemblyRow[];
		summary: AssemblySummary;
	};
}

type TierTab = "ALL" | CostTier;
type ApplyTo = "ALL" | "PRODUCTION" | "ASSEMBLY";

const TIER_TABS: Array<{ key: TierTab; label: string }> = [
	{ key: "ALL", label: "Tất cả" },
	{ key: "PACK", label: "Gói sản xuất" },
	{ key: "ASSEMBLY", label: "Hộp / Túi lắp ráp" },
];

type ExportRow = {
	tier: string;
	productName: string;
	packagingName: string;
	sku: string;
	orders: number;
	quantity: number;
	unit: string;
	packOrMaterialValue: number;
	assemblyMaterialValue: number;
	assemblyExtraCost: number;
	overheadCost: number;
	totalCost: number;
	costPerUnit: number;
};

export default function ProductionOverviewReport() {
	const [from, setFrom] = useState(monthStart());
	const [to, setTo] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [search, setSearch] = useState("");
	const [tier, setTier] = useState<TierTab>("ALL");
	const [drawer, setDrawer] = useState<
		| { kind: "PACK"; row: Row }
		| { kind: "ASSEMBLY"; row: AssemblyRow }
		| null
	>(null);
	const showMoney = useCanViewMoney();
	const canManageCosting = useHasPermission(["costing.manage", "system.admin"]);
	const refs = useReportRefs();
	const navigate = useNavigate();
	const qc = useQueryClient();
	const params = new URLSearchParams({ from, to });
	if (warehouseId) params.set("warehouseId", String(warehouseId));
	if (search.trim()) params.set("search", search.trim());
	const query = useQuery({
		queryKey: ["report-production-overview", from, to, warehouseId, search],
		queryFn: () => apiV1<Result>(`/api/v1/reports/production-overview?${params.toString()}`),
	});
	const data = query.data?.data;
	const rows = data?.rows || [];
	const summary = data?.summary;
	const assemblyRows = data?.assembly?.rows || [];
	const assemblySummary = data?.assembly?.summary;
	const exportExcel = useReportExport();

	const closeSheet = useMutation({
		mutationFn: () =>
			apiV1<CostSheetV1>("/api/v1/costing/sheets", {
				method: "POST",
				body: JSON.stringify({
					fromDate: from,
					toDate: to,
					warehouseId: warehouseId || null,
					status: "POSTED",
				}),
			}),
		onSuccess: response => {
			toast.success(`Đã chốt bảng tính giá thành ${response.data.code}`);
			void qc.invalidateQueries({ queryKey: ["report-production-overview"] });
			void qc.invalidateQueries({ queryKey: ["cost-sheets"] });
		},
		onError: error => toast.error((error as Error).message),
	});

	const askCloseSheet = async () => {
		if (
			await confirm({
				message: `Chốt bảng tính giá thành kỳ ${from} → ${to}? Số liệu hiện tại sẽ được lưu vào lịch sử.`,
				tone: "primary",
				confirmText: "Chốt bảng tính",
			})
		) {
			closeSheet.mutate();
		}
	};

	const costingLink = (tab?: string) => {
		const query = new URLSearchParams({ from, to });
		if (warehouseId) query.set("warehouseId", String(warehouseId));
		if (tab) query.set("tab", tab);
		return `/production/costing?${query.toString()}`;
	};
	const openCosting = () => navigate(costingLink());
	const openCostingHistory = () => navigate(costingLink("sheets"));

	// ── Quick cost entry ─────────────────────────────────────────────────────
	const [quickOpen, setQuickOpen] = useState(false);
	const [quickForm, setQuickForm] = useState({
		preset: QUICK_COST_PRESETS[0].key,
		costDate: today(),
		amount: 0,
		applyTo: "ALL" as ApplyTo,
		tier: "PACK" as CostTier,
		allocationMethod: "BY_ACTUAL_QTY" as string,
		productionOrderId: 0,
		assemblyOrderId: 0,
		note: "",
	});

	const centersQuery = useQuery({
		queryKey: ["cost-centers"],
		queryFn: () => apiV1<CostCenterV1[]>("/api/v1/costing/cost-centers"),
		staleTime: 60_000,
		enabled: quickOpen,
	});
	const centers = centersQuery.data?.data || [];
	const quickPreset =
		QUICK_COST_PRESETS.find(preset => preset.key === quickForm.preset) ||
		QUICK_COST_PRESETS[0];
	const quickCenter =
		centers.find(center => center.isActive && center.code === quickPreset.centerCode) ||
		centers.find(center => center.isActive && center.category === quickPreset.category) ||
		centers.find(center => center.isActive);

	const productionOrdersQuery = useQuery({
		queryKey: ["costing-production-orders"],
		queryFn: () =>
			apiV1<
				Array<{
					id: number;
					code: string | null;
					status: string | null;
					products: { name: string } | null;
				}>
			>("/api/v1/costing/production-orders"),
		staleTime: 60_000,
		enabled: quickOpen && quickForm.applyTo === "PRODUCTION",
	});
	const productionOrders = productionOrdersQuery.data?.data || [];

	const assemblyOrdersQuery = useQuery({
		queryKey: ["costing-assembly-orders"],
		queryFn: () =>
			apiV1<
				Array<{
					id: number;
					code: string | null;
					actualQuantity: number | null;
					output: { name: string; unit: string | null } | null;
				}>
			>("/api/v1/costing/assembly-orders"),
		staleTime: 60_000,
		enabled: quickOpen && quickForm.applyTo === "ASSEMBLY",
	});
	const assemblyOrders = assemblyOrdersQuery.data?.data || [];

	const openQuickEntry = (presetKey?: string) => {
		const preset =
			QUICK_COST_PRESETS.find(item => item.key === presetKey) ||
			QUICK_COST_PRESETS[0];
		setQuickForm({
			preset: preset.key,
			costDate: to || today(),
			amount: 0,
			applyTo: "ALL",
			tier: preset.tier,
			allocationMethod: "BY_ACTUAL_QTY",
			productionOrderId: 0,
			assemblyOrderId: 0,
			note: "",
		});
		setQuickOpen(true);
	};

	const saveQuickEntry = useMutation({
		mutationFn: () => {
			if (!quickCenter) {
				throw new Error("Chưa có đối tượng chi phí phù hợp");
			}
			if (quickForm.amount <= 0) {
				throw new Error("Nhập số tiền chi phí");
			}
			if (quickForm.applyTo === "PRODUCTION" && !quickForm.productionOrderId) {
				throw new Error("Chọn lệnh sản xuất cần gắn chi phí");
			}
			if (quickForm.applyTo === "ASSEMBLY" && !quickForm.assemblyOrderId) {
				throw new Error("Chọn lệnh lắp ráp cần gắn chi phí");
			}
			return apiV1<{ id: number; code: string }>("/api/v1/costing/entries", {
				method: "POST",
				body: JSON.stringify({
					costDate: quickForm.costDate,
					costCenterId: quickCenter.id,
					warehouseId: warehouseId || null,
					productionOrderId:
						quickForm.applyTo === "PRODUCTION"
							? quickForm.productionOrderId
							: null,
					assemblyOrderId:
						quickForm.applyTo === "ASSEMBLY" ? quickForm.assemblyOrderId : null,
					costTier:
						quickForm.applyTo === "PRODUCTION"
							? "PACK"
							: quickForm.applyTo === "ASSEMBLY"
								? "ASSEMBLY"
								: quickForm.tier,
					amount: quickForm.amount,
					allocationMethod: quickForm.allocationMethod || null,
					note: quickForm.note,
					status: "POSTED",
				}),
			});
		},
		onSuccess: response => {
			toast.success(`Đã ghi nhận chi phí ${response.data.code}. Báo cáo đã cập nhật.`);
			setQuickOpen(false);
			void qc.invalidateQueries({ queryKey: ["report-production-overview"] });
			void qc.invalidateQueries({ queryKey: ["cost-entries"] });
		},
		onError: error => toast.error((error as Error).message),
	});

	const exportRows: ExportRow[] = [
		...(tier === "ASSEMBLY"
			? []
			: rows.map(row => ({
					tier: COST_TIER_META.PACK.label,
					productName: row.productName,
					packagingName: row.packagingName,
					sku: row.sku || "",
					orders: row.orders,
					quantity: row.actualPacks,
					unit: row.unit || "Gói",
					packOrMaterialValue: row.materialValue,
					assemblyMaterialValue: 0,
					assemblyExtraCost: 0,
					overheadCost: row.overheadCost,
					totalCost: row.totalCost,
					costPerUnit: row.costPerUnit,
				}))),
		...(tier === "PACK"
			? []
			: assemblyRows.map(row => ({
					tier: COST_TIER_META.ASSEMBLY.label,
					productName: row.productName,
					packagingName: row.packagingName,
					sku: row.sku || "",
					orders: row.orders,
					quantity: row.actualQty,
					unit: row.unit || "Hộp",
					packOrMaterialValue: row.packValue,
					assemblyMaterialValue: row.assemblyMaterialValue,
					assemblyExtraCost: row.assemblyExtraCost,
					overheadCost: row.overheadCost,
					totalCost: row.totalCost,
					costPerUnit: row.costPerUnit,
				}))),
	];

	const onExport = () =>
		exportExcel(
			`Bao_cao_gia_thanh_2_tang_${from}_${to}.xlsx`,
			"Gia thanh 2 tang",
			[
				{ header: "Tầng", value: (r: ExportRow) => r.tier, width: 20 },
				{ header: "Sản phẩm", value: r => r.productName, width: 30 },
				{ header: "Quy cách", value: r => r.packagingName, width: 24 },
				{ header: "SKU", value: r => r.sku, width: 16 },
				{ header: "Số lệnh", value: r => r.orders, width: 10 },
				{ header: "Số lượng thực tế", value: r => r.quantity, width: 16 },
				{ header: "ĐVT", value: r => r.unit, width: 10 },
				...(!showMoney
					? []
					: [
							{
								header: "Tiền gói / NVL",
								value: (r: ExportRow) => r.packOrMaterialValue,
								width: 18,
							},
							{
								header: "Hộp / keo dán / thùng",
								value: (r: ExportRow) => r.assemblyMaterialValue,
								width: 20,
							},
							{
								header: "Chi phí lắp ráp",
								value: (r: ExportRow) => r.assemblyExtraCost,
								width: 18,
							},
							{
								header: "Chi phí phân bổ",
								value: (r: ExportRow) => r.overheadCost,
								width: 18,
							},
							{ header: "Tổng giá thành", value: (r: ExportRow) => r.totalCost, width: 18 },
							{
								header: "Giá cost / đơn vị",
								value: (r: ExportRow) => r.costPerUnit,
								width: 18,
							},
						]),
			],
			exportRows,
		);

	const showPack = tier !== "ASSEMBLY";
	const showAssembly = tier !== "PACK";

	return (
		<ReportShell
			title="Tổng quan sản xuất"
			description="Giá thành 2 tầng: gói sản xuất → hộp / túi lắp ráp, tự cập nhật theo kỳ và kho đã chọn"
			actions={
				<>
					{canManageCosting ? (
						<>
							<button className="erp-btn" onClick={() => openQuickEntry()}>
								<Plus size={16} /> Nhập chi phí nhanh
							</button>
							<button className="erp-btn" onClick={openCosting}>
								<Wallet size={16} /> Quản lý chi phí
							</button>
							<button
								className="erp-btn"
								disabled={closeSheet.isPending}
								onClick={() => void askCloseSheet()}
							>
								<Calculator size={16} /> Chốt bảng tính cost
							</button>
							<button className="erp-btn" onClick={openCostingHistory}>
								<History size={16} /> Lịch sử giá thành
							</button>
						</>
					) : null}
					<ExportButton onClick={onExport} />
				</>
			}
		>
			<FilterBar>
				<div className="md:col-span-2">
					<ReportPeriodFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} />
				</div>
				<WarehouseSelect value={warehouseId} onChange={setWarehouseId} warehouses={refs.data?.warehouses || []} placeholder="Tất cả kho SX" />
				<label>
					Tìm kiếm
					<div className="erp-search mt-1 w-full max-w-none">
						<Search size={16} />
						<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Sản phẩm, mã lệnh..." />
					</div>
				</label>
			</FilterBar>

			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="flex gap-1 rounded-lg bg-slate-100 p-1">
					{TIER_TABS.map(tab => (
						<button
							key={tab.key}
							type="button"
							onClick={() => setTier(tab.key)}
							className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
								tier === tab.key
									? "bg-white text-emerald-700 shadow"
									: "text-slate-500 hover:text-slate-800"
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>
				{canManageCosting ? (
					<button
						className="erp-btn"
						onClick={() => openQuickEntry("HOP_KEO_THUNG")}
					>
						<Package size={16} /> Nhập hộp / keo dán / thùng
					</button>
				) : null}
			</div>

			{showPack ? (
				<StatGrid>
					<StatCard label="Kế hoạch (gói)" value={qty(summary?.plannedPacks || 0)} />
					<StatCard label="Thực tế (gói)" value={qty(summary?.actualPacks || 0)} tone="info" />
					<StatCard label="Tỷ lệ hoàn thành" value={`${summary?.plannedPacks ? Math.round((summary.actualPacks / summary.plannedPacks) * 10000) / 100 : 0}%`} tone="positive" />
					<StatCard label="Bột sử dụng" value={`${qty(summary?.powderKg || 0)} kg`} />
					{showMoney ? <StatCard label="Giá trị NVL trực tiếp" value={money(summary?.materialValue || 0)} /> : null}
					{showMoney ? <StatCard label="Chi phí phân bổ tầng gói" value={money(summary?.overheadCost || 0)} tone="warning" hint="Điện nước, nhân công, bao bì, máy móc, bảo dưỡng..." /> : null}
					{showMoney ? <StatCard label="Tổng giá thành gói" value={money(summary?.totalCost || 0)} tone="positive" /> : null}
					{showMoney ? <StatCard label="Giá cost bình quân / gói" value={money(summary?.avgCostPerUnit || 0)} tone="info" hint={`NVL: ${money(summary?.avgMaterialCostPerUnit || 0)}`} /> : null}
				</StatGrid>
			) : null}

			{showAssembly ? (
				<StatGrid>
					<StatCard label="Số lệnh lắp ráp" value={qty(assemblySummary?.orders || 0)} />
					<StatCard
						label="Hộp / túi tính giá"
						value={qty(assemblySummary?.actualQty || 0)}
						tone="info"
						hint={
							assemblySummary?.plannedQty
								? `Có ${qty(assemblySummary.plannedQty)} lấy theo kế hoạch (lệnh chưa nhập thực tế)`
								: undefined
						}
					/>
					{showMoney ? <StatCard label="Tiền gói thành phần" value={money(assemblySummary?.packValue || 0)} hint="Lấy từ giá cost tầng 1" /> : null}
					{showMoney ? <StatCard label="Hộp / keo dán / thùng" value={money(assemblySummary?.assemblyMaterialValue || 0)} hint="Vật tư xuất cho lắp ráp" /> : null}
					{showMoney ? <StatCard label="Chi phí phân bổ tầng lắp ráp" value={money(assemblySummary?.overheadCost || 0)} tone="warning" /> : null}
					{showMoney ? <StatCard label="Tổng giá thành hộp / túi" value={money(assemblySummary?.totalCost || 0)} tone="positive" /> : null}
					{showMoney ? <StatCard label="Giá cost bình quân" value={money(assemblySummary?.avgCostPerUnit || 0)} tone="info" hint={`Gói + vật tư: ${money(assemblySummary?.avgMaterialCostPerUnit || 0)}`} /> : null}
				</StatGrid>
			) : null}

			{showPack ? (
				<ReportCard
					title="Tầng 1 · Giá thành gói sản xuất"
					description={`${rows.length} mặt hàng · bấm vào dòng để xem cách tính`}
					action={
						canManageCosting ? (
							<button className="erp-btn" onClick={() => openQuickEntry("DIEN_NUOC")}>
								<Plus size={14} /> Thêm chi phí
							</button>
						) : null
					}
				>
					<div className="overflow-x-auto">
						<table className="erp-table">
							<thead>
								<tr>
									<th>Sản phẩm / Quy cách</th>
									<th className="text-right">Số lệnh</th>
									<th className="text-right">Kế hoạch (gói)</th>
									<th className="text-right">Thực tế (gói)</th>
									<th className="text-right">Chênh lệch</th>
									<th className="text-right">Bột (kg)</th>
									{showMoney ? <th className="text-right">Giá trị NVL</th> : null}
									{showMoney ? <th className="text-right">Chi phí phân bổ</th> : null}
									{showMoney ? <th className="text-right">Tổng giá thành</th> : null}
									{showMoney ? <th className="text-right">Giá cost / gói</th> : null}
								</tr>
							</thead>
							<TableState colSpan={showMoney ? 10 : 6} loading={query.isLoading} error={query.isError ? (query.error as Error).message : null} empty={!rows.length}>
								{rows.map(row => {
									const diff = row.actualPacks - row.plannedPacks;
									return (
										<tr
											key={row.packagingId}
											className="cursor-pointer hover:bg-slate-50"
											onClick={() => setDrawer({ kind: "PACK", row })}
											title="Xem cách tính giá thành"
										>
											<td><b>{row.productName}</b><small>{row.packagingName}</small></td>
											<td className="text-right">{qty(row.orders)}</td>
											<td className="text-right">{qty(row.plannedPacks)}</td>
											<td className="text-right font-semibold">{qty(row.actualPacks)}</td>
											<td className={`text-right ${diff >= 0 ? "text-emerald-600" : "text-red-600"}`}>{diff > 0 ? "+" : ""}{qty(diff)}</td>
											<td className="text-right">{qty(row.powderKg)}</td>
											{showMoney ? <td className="text-right">{money(row.materialValue)}</td> : null}
											{showMoney ? (
												<td className="text-right">
													<span className="inline-flex items-center gap-1 font-semibold text-amber-700">
														<Wallet size={14} />
														{money(row.overheadCost)}
													</span>
												</td>
											) : null}
											{showMoney ? <td className="text-right font-semibold">{money(row.totalCost)}</td> : null}
											{showMoney ? (
												<td className="text-right font-semibold">
													<div>{money(row.costPerUnit)}</div>
													<small className="font-normal text-slate-400">NVL: {money(row.materialCostPerUnit)}</small>
												</td>
											) : null}
										</tr>
									);
								})}
							</TableState>
						</table>
					</div>
				</ReportCard>
			) : null}

			{showAssembly ? (
				<ReportCard
					title="Tầng 2 · Giá thành hộp / túi lắp ráp"
					description={`${assemblyRows.length} quy cách · tiền gói lấy từ tầng 1, vật tư lắp ráp lấy giá vốn hiện có`}
					action={
						canManageCosting ? (
							<button className="erp-btn" onClick={() => openQuickEntry("HOP_KEO_THUNG")}>
								<Plus size={14} /> Thêm hộp / keo dán / thùng
							</button>
						) : null
					}
				>
					<div className="overflow-x-auto">
						<table className="erp-table">
							<thead>
								<tr>
									<th>Sản phẩm / Quy cách</th>
									<th className="text-right">Số lệnh</th>
									<th className="text-right">Số lượng</th>
									{showMoney ? <th className="text-right">Tiền gói</th> : null}
									{showMoney ? <th className="text-right">Hộp / keo / thùng</th> : null}
									{showMoney ? <th className="text-right">Chi phí lắp ráp</th> : null}
									{showMoney ? <th className="text-right">Chi phí phân bổ</th> : null}
									{showMoney ? <th className="text-right">Tổng giá thành</th> : null}
									{showMoney ? <th className="text-right">Giá cost / hộp-túi</th> : null}
								</tr>
							</thead>
							<TableState colSpan={showMoney ? 9 : 3} loading={query.isLoading} error={query.isError ? (query.error as Error).message : null} empty={!assemblyRows.length}>
								{assemblyRows.map(row => (
									<tr
										key={row.packagingId}
										className="cursor-pointer hover:bg-slate-50"
										onClick={() => setDrawer({ kind: "ASSEMBLY", row })}
										title="Xem cách tính giá thành"
									>
										<td>
											<b>{row.productName || row.packagingName}</b>
											<small>
												{row.packagingName}
												{row.unit ? ` · ${row.unit}` : ""}
											</small>
										</td>
										<td className="text-right">{qty(row.orders)}</td>
										<td className="text-right font-semibold">
											<div>{qty(row.actualQty)}</div>
											{row.plannedQty ? (
												<small className="font-normal text-amber-600">
													{qty(row.plannedQty)} theo kế hoạch
												</small>
											) : null}
										</td>
										{showMoney ? <td className="text-right">{money(row.packValue)}</td> : null}
										{showMoney ? <td className="text-right">{money(row.assemblyMaterialValue)}</td> : null}
										{showMoney ? <td className="text-right">{money(row.assemblyExtraCost)}</td> : null}
										{showMoney ? (
											<td className="text-right">
												<span className="inline-flex items-center gap-1 font-semibold text-amber-700">
													<Wallet size={14} />
													{money(row.overheadCost)}
												</span>
											</td>
										) : null}
										{showMoney ? <td className="text-right font-semibold">{money(row.totalCost)}</td> : null}
										{showMoney ? (
											<td className="text-right font-semibold">
												<div>{money(row.costPerUnit)}</div>
												<small className="font-normal text-slate-400">
													Gói + vật tư: {money(row.materialCostPerUnit)}
												</small>
											</td>
										) : null}
									</tr>
								))}
							</TableState>
						</table>
					</div>
				</ReportCard>
			) : null}

			{drawer ? (
				<CostDrawer drawer={drawer} showMoney={showMoney} onClose={() => setDrawer(null)} />
			) : null}

			{quickOpen ? (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-2xl">
						<div className="erp-modal-header">
							<div>
								<h2>Nhập nhanh chi phí sản xuất</h2>
								<p>
									Chọn loại chi phí, nhập số tiền và phạm vi áp dụng. Báo cáo tự
									tính lại ngay, không cần chốt.
								</p>
							</div>
							<button onClick={() => setQuickOpen(false)}>
								<X />
							</button>
						</div>
						<form
							onSubmit={event => {
								event.preventDefault();
								saveQuickEntry.mutate();
							}}
						>
							<div className="erp-modal-body space-y-4">
								<div>
									<span className="block text-xs font-semibold text-slate-600">Loại chi phí</span>
									<div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
										{QUICK_COST_PRESETS.map(preset => (
											<button
												key={preset.key}
												type="button"
												onClick={() =>
													setQuickForm(current => ({
														...current,
														preset: preset.key,
														tier:
															current.applyTo === "ALL"
																? preset.tier
																: current.tier,
													}))
												}
												className={`rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
													quickForm.preset === preset.key
														? "border-emerald-500 bg-emerald-50 text-emerald-800"
														: "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
												}`}
											>
												<b className="block text-[13px]">{preset.label}</b>
												<span className="text-[11px] text-slate-500">
													{preset.hint}
												</span>
											</button>
										))}
									</div>
								</div>

								<div className="grid gap-4 md:grid-cols-2">
									<label>
										Ngày chi phí <span className="text-red-500">*</span>
										<input
											required
											type="date"
											value={quickForm.costDate}
											onChange={event =>
												setQuickForm(current => ({
													...current,
													costDate: event.target.value,
												}))
											}
										/>
									</label>
									<label>
										Số tiền <span className="text-red-500">*</span>
										<input
											required
											type="number"
											min={0}
											step="0.01"
											value={quickForm.amount}
											onChange={event =>
												setQuickForm(current => ({
													...current,
													amount: Number(event.target.value || 0),
												}))
											}
										/>
									</label>
									<label>
										Áp dụng cho
										<select
											value={quickForm.applyTo}
											onChange={event => {
												const applyTo = event.target.value as ApplyTo;
												setQuickForm(current => ({
													...current,
													applyTo,
													tier:
														applyTo === "PRODUCTION"
															? "PACK"
															: applyTo === "ASSEMBLY"
																? "ASSEMBLY"
																: quickPreset.tier,
												}));
											}}
										>
											<option value="ALL">Tất cả trong kỳ (phân bổ)</option>
											<option value="PRODUCTION">Một lệnh sản xuất (tầng gói)</option>
											<option value="ASSEMBLY">Một lệnh lắp ráp (tầng hộp/túi)</option>
										</select>
									</label>
									<label>
										Phân bổ theo
										<select
											value={quickForm.allocationMethod}
											onChange={event =>
												setQuickForm(current => ({
													...current,
													allocationMethod: event.target.value,
												}))
											}
										>
											<option value="BY_ACTUAL_QTY">Sản lượng thực tế</option>
											<option value="BY_POWDER_KG">Kg bột</option>
											<option value="BY_MATERIAL_VALUE">Giá trị NVL</option>
											<option value="">Theo đối tượng chi phí</option>
										</select>
									</label>

									{quickForm.applyTo === "ALL" ? (
										<label>
											Tầng chi phí
											<select
												value={quickForm.tier}
												onChange={event =>
													setQuickForm(current => ({
														...current,
														tier: event.target.value as CostTier,
													}))
												}
											>
												{(Object.keys(COST_TIER_META) as CostTier[]).map(value => (
													<option key={value} value={value}>
														{COST_TIER_META[value].label}
													</option>
												))}
											</select>
										</label>
									) : null}

									{quickForm.applyTo === "PRODUCTION" ? (
										<label className="md:col-span-2">
											Lệnh sản xuất <span className="text-red-500">*</span>
											<select
												required
												value={quickForm.productionOrderId}
												onChange={event =>
													setQuickForm(current => ({
														...current,
														productionOrderId: Number(event.target.value),
													}))
												}
											>
												<option value={0}>-- Chọn lệnh sản xuất --</option>
												{productionOrders.map(order => (
													<option key={order.id} value={order.id}>
														{order.code} · {order.products?.name || ""}
													</option>
												))}
											</select>
										</label>
									) : null}

									{quickForm.applyTo === "ASSEMBLY" ? (
										<label className="md:col-span-2">
											Lệnh lắp ráp <span className="text-red-500">*</span>
											<select
												required
												value={quickForm.assemblyOrderId}
												onChange={event =>
													setQuickForm(current => ({
														...current,
														assemblyOrderId: Number(event.target.value),
													}))
												}
											>
												<option value={0}>-- Chọn lệnh lắp ráp --</option>
												{assemblyOrders.map(order => (
													<option key={order.id} value={order.id}>
														{order.code} · {order.output?.name || ""}
														{order.actualQuantity
															? ` (${qty(order.actualQuantity)} ${order.output?.unit || ""})`
															: ""}
													</option>
												))}
											</select>
										</label>
									) : null}

									<div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 md:col-span-2">
										Đối tượng chi phí:{" "}
										<b>{quickCenter ? `${quickCenter.code} · ${quickCenter.name}` : "Chưa cấu hình"}</b>
										{warehouseId ? (
											<span>
												{" "}
												· Kho:{" "}
												<b>
													{refs.data?.warehouses?.find(item => item.id === warehouseId)?.name ||
														"Đã chọn"}
												</b>
											</span>
										) : (
											<span> · Toàn xưởng</span>
										)}
									</div>

									<label className="md:col-span-2">
										Ghi chú
										<textarea
											rows={2}
											maxLength={500}
											value={quickForm.note}
											onChange={event =>
												setQuickForm(current => ({
													...current,
													note: event.target.value,
												}))
											}
											placeholder="Ví dụ: tiền điện tháng này, hộp carton đợt 2..."
										/>
									</label>
								</div>
							</div>
							<div className="erp-modal-footer">
								<button className="erp-btn" type="button" onClick={() => setQuickOpen(false)}>
									Hủy
								</button>
								<button
									className="erp-btn erp-btn-primary"
									type="submit"
									disabled={saveQuickEntry.isPending || !quickCenter}
								>
									{saveQuickEntry.isPending ? "Đang lưu..." : "Lưu chi phí"}
								</button>
							</div>
						</form>
					</div>
				</div>
			) : null}
		</ReportShell>
	);
}

function CostDrawer({
	drawer,
	showMoney,
	onClose,
}: {
	drawer: { kind: "PACK"; row: Row } | { kind: "ASSEMBLY"; row: AssemblyRow };
	showMoney: boolean;
	onClose: () => void;
}) {
	const pack = drawer.kind === "PACK" ? drawer.row : null;
	const assembly = drawer.kind === "ASSEMBLY" ? drawer.row : null;
	const row = drawer.row;
	const isPack = pack !== null;
	const actualQty = pack ? pack.actualPacks : assembly!.actualQty;
	const quantityUnit = pack ? "gói" : assembly!.unit || "hộp/túi";
	return (
		<div className="fixed inset-0 z-50">
			<div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
			<aside className="absolute right-0 top-0 flex h-full w-full max-w-4xl flex-col bg-white shadow-2xl">
				<div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
					<div>
						<span
							className={`erp-badge ${isPack ? COST_TIER_META.PACK.css : COST_TIER_META.ASSEMBLY.css}`}
						>
							{isPack ? COST_TIER_META.PACK.label : COST_TIER_META.ASSEMBLY.label}
						</span>
						<h2 className="mt-2 text-lg font-bold text-slate-800">
							{row.productName || row.packagingName}
						</h2>
						<p className="text-sm text-slate-500">
							{row.packagingName}
							{row.sku ? ` · ${row.sku}` : ""}
						</p>
					</div>
					<button className="erp-icon-btn" onClick={onClose} title="Đóng">
						<X size={18} />
					</button>
				</div>

				<div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
					<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
						<p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
							Cách tính
						</p>
						<p className="mt-1 text-sm text-emerald-900">
							{isPack
								? "Giá cost / đơn vị = (Tiền gói/NVL + Chi phí phân bổ) ÷ Số lượng thực tế"
								: "Giá cost / đơn vị = (Tiền gói/NVL + Tiền hộp/keo dán/thùng + Chi phí lắp ráp + Chi phí phân bổ) ÷ Số lượng thực tế"}
						</p>
						{showMoney ? (
							<>
								<p className="mt-3 font-mono text-sm text-emerald-900">
									{pack
										? `(${money(pack.materialValue)} + ${money(row.overheadCost)}) ÷ ${qty(actualQty)} = ${money(row.costPerUnit)}`
										: `(${money(assembly!.packValue)} + ${money(assembly!.assemblyMaterialValue)} + ${money(assembly!.assemblyExtraCost)} + ${money(row.overheadCost)}) ÷ ${qty(actualQty)} = ${money(row.costPerUnit)}`}
								</p>
								<p className="mt-2 text-xs text-emerald-800">
									Thành tiền: <b>{money(row.totalCost)}</b> cho{" "}
									<b>
										{qty(actualQty)} {quantityUnit}
									</b>
								</p>
							</>
						) : null}
						{assembly && assembly.plannedQty ? (
							<p className="mt-2 text-xs text-emerald-700">
								Trong đó <b>{qty(assembly.plannedQty)}</b> {quantityUnit} lấy theo
								kế hoạch vì lệnh lắp ráp chưa nhập số lượng thực tế.
							</p>
						) : null}
					</div>

					{showMoney ? (
						<div>
							<h3 className="mb-2 text-sm font-bold text-slate-700">
								Cấu thành chi phí
							</h3>
							<table className="erp-table">
								<thead>
									<tr>
										<th>Khoản mục</th>
										<th className="text-right">Số tiền</th>
										<th className="text-right">Giá / đơn vị</th>
									</tr>
								</thead>
								<tbody>
									{pack ? (
										<tr>
											<td>
												<b>Nguyên vật liệu trực tiếp</b>
											</td>
											<td className="text-right">{money(pack.materialValue)}</td>
											<td className="text-right">{money(pack.materialCostPerUnit)}</td>
										</tr>
									) : (
										<>
											<tr>
												<td>
													<b>Tiền gói thành phần</b>
													<small>Lấy từ giá cost gói tầng 1</small>
												</td>
												<td className="text-right">{money(assembly!.packValue)}</td>
												<td className="text-right">
													{money(actualQty ? assembly!.packValue / actualQty : 0)}
												</td>
											</tr>
											<tr>
												<td>
													<b>Hộp, keo dán, thùng</b>
													<small>Vật tư xuất kho cho lắp ráp</small>
												</td>
												<td className="text-right">{money(assembly!.assemblyMaterialValue)}</td>
												<td className="text-right">
													{money(
														actualQty
															? assembly!.assemblyMaterialValue / actualQty
															: 0,
													)}
												</td>
											</tr>
											<tr>
												<td>
													<b>Chi phí lắp ráp</b>
													<small>Nhập thêm trên lệnh lắp ráp</small>
												</td>
												<td className="text-right">{money(assembly!.assemblyExtraCost)}</td>
												<td className="text-right">
													{money(
														actualQty ? assembly!.assemblyExtraCost / actualQty : 0,
													)}
												</td>
											</tr>
										</>
									)}
									{(row.overheadBreakdown || []).map(item => (
										<tr key={item.costCenterId}>
											<td>
												<b>{item.name}</b>
												<small>
													{item.code} ·{" "}
													{COST_CATEGORY_META[item.category]?.label || item.category}
												</small>
											</td>
											<td className="text-right">{money(item.amount)}</td>
											<td className="text-right">
												{money(actualQty ? item.amount / actualQty : 0)}
											</td>
										</tr>
									))}
									<tr>
										<td>
											<b>Tổng giá thành</b>
										</td>
										<td className="text-right font-bold">{money(row.totalCost)}</td>
										<td className="text-right font-bold">{money(row.costPerUnit)}</td>
									</tr>
								</tbody>
							</table>
						</div>
					) : null}

					{assembly && assembly.inventoryValue > 0 ? (
						<p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
							Có {money(assembly.inventoryValue)} vật tư dùng <b>giá vốn hiện có</b> vì
							chưa có giá sản xuất trong kỳ.
						</p>
					) : null}

					{assembly && assembly.components.length ? (
						<div>
							<h3 className="mb-2 text-sm font-bold text-slate-700">
								Vật tư cấu thành quy cách
							</h3>
							<table className="erp-table">
								<thead>
									<tr>
										<th>Vật tư</th>
										<th className="text-right">Số lượng</th>
										{showMoney ? <th className="text-right">Đơn giá</th> : null}
										{showMoney ? <th className="text-right">Giá trị</th> : null}
										<th>Nguồn giá</th>
									</tr>
								</thead>
								<tbody>
									{assembly!.components.map(component => (
										<tr key={component.packagingId}>
											<td>
												<b>{component.name || component.sku || "—"}</b>
												<small>{component.sku || ""}</small>
											</td>
											<td className="text-right">
												{qty(component.quantity)} {component.unit || ""}
											</td>
											{showMoney ? <td className="text-right">{money(component.unitCost)}</td> : null}
											{showMoney ? <td className="text-right">{money(component.value)}</td> : null}
											<td>
												<span
													className={`erp-badge ${
														component.source === "PRODUCTION"
															? "bg-emerald-100 text-emerald-700"
															: "bg-slate-100 text-slate-600"
													}`}
												>
													{component.source === "PRODUCTION"
														? "Giá SX trong kỳ"
														: "Giá vốn hiện có"}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					) : null}

					{pack ? (
						<div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
							<Boxes size={14} className="mr-1 inline" />
							Lệnh sản xuất: <b>{qty(pack.orders)}</b> · Bột sử dụng:{" "}
							<b>{qty(pack.powderKg)} kg</b>
						</div>
					) : null}
				</div>

				<div className="border-t border-slate-100 px-5 py-3 text-right">
					<button className="erp-btn" onClick={onClose}>
						Đóng
					</button>
				</div>
			</aside>
		</div>
	);
}
