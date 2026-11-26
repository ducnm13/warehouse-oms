import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Calculator,
	CheckCircle2,
	Edit,
	FileSpreadsheet,
	History,
	Layers,
	Plus,
	ReceiptText,
	Search,
	Trash2,
	Upload,
	Wallet,
	X,
} from "lucide-react";
import toast from "../components/ui/toast";
import { confirm } from "../components/ui/confirm";
import { apiV1 } from "../lib/apiV1";
import { formatNumber } from "../lib/utils";
import { exportExcelFile } from "../lib/excelExport";
import {
	ALLOCATION_METHOD_META,
	COST_CATEGORY_META,
	COST_COMPONENT_LABEL,
	COST_ENTRY_STATUS_META,
	COST_SHEET_STATUS_META,
	COST_TIER_META,
	formatCostDate,
	formatCostDateTime,
	monthStartIso,
	todayIso,
} from "../lib/costing";
import { useHasPermission } from "../hooks/useHasPermission";
import type {
	CostAllocationMethod,
	CostCenterCategory,
	CostCenterV1,
	CostEntryStatus,
	CostEntryV1,
	CostSheetV1,
	CostTier,
	UnbilledIncidentV1,
} from "../types";

type Tab = "entries" | "centers" | "sheets";

type EntryForm = {
	code: string;
	costDate: string;
	costCenterId: number;
	warehouseId: number | null;
	productionOrderId: number | null;
	assemblyOrderId: number | null;
	costTier: CostTier;
	incidentId: number | null;
	amount: number;
	allocationMethod: CostAllocationMethod | "";
	note: string;
	status: CostEntryStatus;
};

type CenterForm = {
	code: string;
	name: string;
	category: CostCenterCategory;
	defaultAllocationMethod: CostAllocationMethod;
	description: string;
	isActive: boolean;
};

const money = (value: unknown) => `${formatNumber(Number(value || 0))} ₫`;

const emptyEntry = (): EntryForm => ({
	code: "",
	costDate: todayIso(),
	costCenterId: 0,
	warehouseId: null,
	productionOrderId: null,
	assemblyOrderId: null,
	costTier: "PACK",
	incidentId: null,
	amount: 0,
	allocationMethod: "",
	note: "",
	status: "POSTED",
});

const emptyCenter = (): CenterForm => ({
	code: "",
	name: "",
	category: "OTHER",
	defaultAllocationMethod: "BY_ACTUAL_QTY",
	description: "",
	isActive: true,
});

const entryFrom = (entry: CostEntryV1): EntryForm => ({
	code: entry.code,
	costDate: entry.costDate,
	costCenterId: entry.costCenterId,
	warehouseId: entry.warehouseId,
	productionOrderId: entry.productionOrderId,
	assemblyOrderId: entry.assemblyOrderId,
	costTier: entry.costTier || "PACK",
	incidentId: entry.incidentId,
	amount: entry.amount,
	allocationMethod: entry.allocationMethod || "",
	note: entry.note || "",
	status: entry.status,
});

const centerFrom = (center: CostCenterV1): CenterForm => ({
	code: center.code,
	name: center.name,
	category: center.category,
	defaultAllocationMethod: center.defaultAllocationMethod,
	description: center.description || "",
	isActive: center.isActive,
});

export default function ProductionCosting() {
	const qc = useQueryClient();
	const canManage = useHasPermission(["costing.manage", "system.admin"]);
	const [searchParams] = useSearchParams();
	const [tab, setTab] = useState<Tab>(
		searchParams.get("tab") === "sheets" ? "sheets" : "entries",
	);

	const [from, setFrom] = useState(searchParams.get("from") || monthStartIso());
	const [to, setTo] = useState(searchParams.get("to") || todayIso());
	const [warehouseId, setWarehouseId] = useState(
		Number(searchParams.get("warehouseId")) || 0,
	);
	const [costCenterId, setCostCenterId] = useState(0);
	const [status, setStatus] = useState("");
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);

	const [entryOpen, setEntryOpen] = useState(false);
	const [editingEntry, setEditingEntry] = useState<CostEntryV1 | null>(null);
	const [entryForm, setEntryForm] = useState<EntryForm>(emptyEntry());

	const [centerOpen, setCenterOpen] = useState(false);
	const [editingCenter, setEditingCenter] = useState<CostCenterV1 | null>(null);
	const [centerForm, setCenterForm] = useState<CenterForm>(emptyCenter());

	const [importOpen, setImportOpen] = useState(false);
	const [selectedIncidents, setSelectedIncidents] = useState<number[]>([]);
	const [importCostCenterId, setImportCostCenterId] = useState(0);

	const [sheetOpen, setSheetOpen] = useState(false);
	const [viewSheet, setViewSheet] = useState<CostSheetV1 | null>(null);
	const [sheetStatus, setSheetStatus] = useState("");
	const [sheetPage, setSheetPage] = useState(1);

	const centersQuery = useQuery({
		queryKey: ["cost-centers"],
		queryFn: () => apiV1<CostCenterV1[]>("/api/v1/costing/cost-centers"),
		staleTime: 60_000,
	});
	const centers = centersQuery.data?.data || [];
	const activeCenters = centers.filter(center => center.isActive);

	const warehousesQuery = useQuery({
		queryKey: ["costing-warehouses"],
		queryFn: () =>
			apiV1<Array<{ id: number; code: string | null; name: string }>>(
				"/api/v1/costing/warehouses",
			),
		staleTime: 5 * 60_000,
	});
	const warehouses = warehousesQuery.data?.data || [];

	const entryParams = new URLSearchParams({ page: String(page), limit: "50" });
	entryParams.set("from", from);
	entryParams.set("to", to);
	if (warehouseId) entryParams.set("warehouseId", String(warehouseId));
	if (costCenterId) entryParams.set("costCenterId", String(costCenterId));
	if (status) entryParams.set("status", status);
	if (search.trim()) entryParams.set("search", search.trim());

	const entriesQuery = useQuery({
		queryKey: [
			"cost-entries",
			from,
			to,
			warehouseId,
			costCenterId,
			status,
			search,
			page,
		],
		queryFn: () =>
			apiV1<CostEntryV1[]>(`/api/v1/costing/entries?${entryParams.toString()}`),
	});
	const entries = entriesQuery.data?.data || [];
	const entryMeta = entriesQuery.data?.meta || {};

	const productionOrdersQuery = useQuery({
		queryKey: ["costing-production-orders"],
		queryFn: () =>
			apiV1<
				Array<{
					id: number;
					code: string | null;
					status: string | null;
					completedAt: string | null;
					products: { name: string } | null;
				}>
			>("/api/v1/costing/production-orders"),
		staleTime: 60_000,
		enabled: entryOpen,
	});
	const productionOrders = productionOrdersQuery.data?.data || [];

	const assemblyOrdersQuery = useQuery({
		queryKey: ["costing-assembly-orders"],
		queryFn: () =>
			apiV1<
				Array<{
					id: number;
					code: string | null;
					status: string | null;
					orderDate: string | null;
					actualQuantity: number | null;
					output: {
						name: string;
						sku: string | null;
						unit: string | null;
						products: { name: string } | null;
					} | null;
				}>
			>("/api/v1/costing/assembly-orders"),
		staleTime: 60_000,
		enabled: entryOpen,
	});
	const assemblyOrders = assemblyOrdersQuery.data?.data || [];

	const unbilledQuery = useQuery({
		queryKey: ["costing-unbilled-incidents", from, to],
		queryFn: () => {
			const params = new URLSearchParams({ limit: "200" });
			if (from) params.set("from", from);
			if (to) params.set("to", to);
			return apiV1<UnbilledIncidentV1[]>(
				`/api/v1/costing/unbilled-incidents?${params.toString()}`,
			);
		},
		enabled: importOpen || entryOpen,
	});
	const unbilled = unbilledQuery.data?.data || [];

	const sheetParams = new URLSearchParams({ page: String(sheetPage), limit: "20" });
	if (from) sheetParams.set("from", from);
	if (to) sheetParams.set("to", to);
	if (warehouseId) sheetParams.set("warehouseId", String(warehouseId));
	if (sheetStatus) sheetParams.set("status", sheetStatus);
	const sheetsQuery = useQuery({
		queryKey: ["cost-sheets", from, to, warehouseId, sheetStatus, sheetPage],
		queryFn: () =>
			apiV1<CostSheetV1[]>(`/api/v1/costing/sheets?${sheetParams.toString()}`),
		enabled: tab === "sheets",
	});
	const sheets = sheetsQuery.data?.data || [];
	const sheetMeta = sheetsQuery.data?.meta || {};

	const refreshEntries = () => {
		void qc.invalidateQueries({ queryKey: ["cost-entries"] });
		void qc.invalidateQueries({ queryKey: ["report-production-overview"] });
		void qc.invalidateQueries({ queryKey: ["cost-sheets"] });
	};

	const saveEntry = useMutation({
		mutationFn: () => {
			const body: any = {
				costDate: entryForm.costDate,
				costCenterId: entryForm.costCenterId,
				warehouseId: entryForm.warehouseId,
				productionOrderId: entryForm.productionOrderId,
				assemblyOrderId: entryForm.assemblyOrderId,
				costTier: entryForm.productionOrderId
					? "PACK"
					: entryForm.assemblyOrderId
						? "ASSEMBLY"
						: entryForm.costTier,
				incidentId: entryForm.incidentId,
				amount: entryForm.amount,
				allocationMethod: entryForm.allocationMethod || null,
				note: entryForm.note,
				status: entryForm.status,
			};
			if (editingEntry) {
				return apiV1<CostEntryV1>(`/api/v1/costing/entries/${editingEntry.id}`, {
					method: "PATCH",
					body: JSON.stringify(body),
				});
			}
			body.code = entryForm.code;
			return apiV1<CostEntryV1>("/api/v1/costing/entries", {
				method: "POST",
				body: JSON.stringify(body),
			});
		},
		onSuccess: response => {
			toast.success(response.message);
			setEntryOpen(false);
			setEditingEntry(null);
			refreshEntries();
		},
		onError: error => toast.error((error as Error).message),
	});

	const deleteEntry = useMutation({
		mutationFn: (entry: CostEntryV1) =>
			apiV1<null>(`/api/v1/costing/entries/${entry.id}`, { method: "DELETE" }),
		onSuccess: response => {
			toast.success(response.message);
			refreshEntries();
		},
		onError: error => toast.error((error as Error).message),
	});

	const saveCenter = useMutation({
		mutationFn: () => {
			const body = { ...centerForm };
			if (editingCenter) {
				return apiV1<CostCenterV1>(
					`/api/v1/costing/cost-centers/${editingCenter.id}`,
					{ method: "PATCH", body: JSON.stringify(body) },
				);
			}
			return apiV1<CostCenterV1>("/api/v1/costing/cost-centers", {
				method: "POST",
				body: JSON.stringify(body),
			});
		},
		onSuccess: response => {
			toast.success(response.message);
			setCenterOpen(false);
			setEditingCenter(null);
			void qc.invalidateQueries({ queryKey: ["cost-centers"] });
			void qc.invalidateQueries({ queryKey: ["report-production-overview"] });
		},
		onError: error => toast.error((error as Error).message),
	});

	const toggleCenter = useMutation({
		mutationFn: (center: CostCenterV1) =>
			apiV1<CostCenterV1>(`/api/v1/costing/cost-centers/${center.id}`, {
				method: "PATCH",
				body: JSON.stringify({ isActive: !center.isActive }),
			}),
		onSuccess: () => {
			toast.success("Đã cập nhật trạng thái đối tượng chi phí");
			void qc.invalidateQueries({ queryKey: ["cost-centers"] });
		},
		onError: error => toast.error((error as Error).message),
	});

	const importIncidents = useMutation({
		mutationFn: () =>
			apiV1<{ created: number; skipped: number }>(
				"/api/v1/costing/unbilled-incidents/import",
				{
					method: "POST",
					body: JSON.stringify({
						incidentIds: selectedIncidents,
						costCenterId: importCostCenterId,
						status: "POSTED",
					}),
				},
			),
		onSuccess: response => {
			toast.success(
				`Đã nhập ${response.data.created} chi phí từ sự cố` +
					(response.data.skipped ? `, bỏ qua ${response.data.skipped}` : ""),
			);
			setImportOpen(false);
			setSelectedIncidents([]);
			refreshEntries();
			void qc.invalidateQueries({ queryKey: ["costing-unbilled-incidents"] });
		},
		onError: error => toast.error((error as Error).message),
	});

	const createSheet = useMutation({
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
			setViewSheet(response.data);
			void qc.invalidateQueries({ queryKey: ["cost-sheets"] });
			void qc.invalidateQueries({ queryKey: ["report-production-overview"] });
		},
		onError: error => toast.error((error as Error).message),
	});

	const deleteSheet = useMutation({
		mutationFn: (sheet: CostSheetV1) =>
			apiV1<null>(`/api/v1/costing/sheets/${sheet.id}`, { method: "DELETE" }),
		onSuccess: response => {
			toast.success(response.message);
			void qc.invalidateQueries({ queryKey: ["cost-sheets"] });
			void qc.invalidateQueries({ queryKey: ["report-production-overview"] });
		},
		onError: error => toast.error((error as Error).message),
	});

	const askDeleteSheet = async (sheet: CostSheetV1) => {
		const ok = await confirm({
			message: `Xóa bảng tính giá thành ${sheet.code} (${sheet.fromDate} → ${sheet.toDate})? Thao tác không thể hoàn tác.`,
			tone: "danger",
			confirmText: "Xóa bảng tính",
		});
		if (ok) deleteSheet.mutate(sheet);
	};

	const openCreateEntry = (incident?: UnbilledIncidentV1) => {
		const maintenance =
			activeCenters.find(center => center.category === "MAINTENANCE") ||
			activeCenters[0];
		setEditingEntry(null);
		setEntryForm({
			...emptyEntry(),
			costCenterId: incident
				? importCostCenterId || maintenance?.id || 0
				: maintenance?.id || activeCenters[0]?.id || 0,
			amount: incident?.cost || 0,
			incidentId: incident?.id || null,
			note: incident ? `Sự cố ${incident.code}: ${incident.title}` : "",
		});
		setEntryOpen(true);
	};

	const openEditEntry = (entry: CostEntryV1) => {
		setEditingEntry(entry);
		setEntryForm(entryFrom(entry));
		setEntryOpen(true);
	};

	const askDeleteEntry = async (entry: CostEntryV1) => {
		if (await confirm(`Xóa chứng từ chi phí ${entry.code}? Thao tác không thể hoàn tác.`)) {
			deleteEntry.mutate(entry);
		}
	};

	const openCreateCenter = () => {
		setEditingCenter(null);
		setCenterForm(emptyCenter());
		setCenterOpen(true);
	};
	const openEditCenter = (center: CostCenterV1) => {
		setEditingCenter(center);
		setCenterForm(centerFrom(center));
		setCenterOpen(true);
	};

	const viewSheetDetail = async (sheet: CostSheetV1) => {
		try {
			const response = await apiV1<CostSheetV1>(
				`/api/v1/costing/sheets/${sheet.id}`,
			);
			setViewSheet(response.data);
		} catch (error) {
			toast.error((error as Error).message);
		}
	};

	const openImport = () => {
		const maintenance =
			activeCenters.find(center => center.category === "MAINTENANCE") ||
			activeCenters[0];
		setImportCostCenterId(maintenance?.id || 0);
		setSelectedIncidents([]);
		setImportOpen(true);
	};

	const exportEntries = () =>
		exportExcelFile(
			`chi-phi-san-xuat-${from}_${to}.xlsx`,
			"Chi phi san xuat",
			[
				{ header: "Mã chứng từ", value: (row: CostEntryV1) => row.code },
				{ header: "Ngày chi phí", value: (row: CostEntryV1) => row.costDate },
				{
					header: "Đối tượng chi phí",
					value: (row: CostEntryV1) => row.costCenterName || "",
					width: 28,
				},
				{ header: "Nhóm chi phí", value: (row: CostEntryV1) => row.costCenterCategory || "" },
				{ header: "Số tiền", value: (row: CostEntryV1) => row.amount, width: 18 },
				{ header: "Kho sản xuất", value: (row: CostEntryV1) => row.warehouseName || "" },
				{ header: "Lệnh sản xuất", value: (row: CostEntryV1) => row.productionOrderCode || "" },
				{ header: "Lệnh lắp ráp", value: (row: CostEntryV1) => row.assemblyOrderCode || "" },
				{
					header: "Tầng chi phí",
					value: (row: CostEntryV1) =>
						COST_TIER_META[row.costTier || "PACK"]?.label || row.costTier,
				},
				{ header: "Sự cố", value: (row: CostEntryV1) => row.incidentCode || "" },
				{
					header: "Trạng thái",
					value: (row: CostEntryV1) => COST_ENTRY_STATUS_META[row.status]?.label || row.status,
				},
				{ header: "Ghi chú", value: (row: CostEntryV1) => row.note || "", width: 34 },
			],
			entries,
		);

	const totalEntryAmount = Number(entryMeta.totalAmount || 0);
	const entryTierLocked = Boolean(
		entryForm.productionOrderId || entryForm.assemblyOrderId,
	);
	const entryTier: CostTier = entryForm.productionOrderId
		? "PACK"
		: entryForm.assemblyOrderId
			? "ASSEMBLY"
			: entryForm.costTier;
	const selectedIncidentCost = useMemo(
		() =>
			unbilled
				.filter(incident => selectedIncidents.includes(incident.id))
				.reduce((sum, incident) => sum + incident.cost, 0),
		[unbilled, selectedIncidents],
	);

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Chi phí &amp; giá thành sản xuất</h1>
					<p>
						Tập hợp chi phí điện nước, nhân công, bao bì, máy móc, bảo dưỡng
						và phân bổ vào giá thành từng mặt hàng.
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					{tab === "entries" && canManage ? (
						<>
							<button className="erp-btn" onClick={openImport}>
								<Upload size={16} /> Nhập từ sự cố
							</button>
							<button className="erp-btn" onClick={exportEntries}>
								<FileSpreadsheet size={16} /> Xuất Excel
							</button>
							<button className="erp-btn erp-btn-primary" onClick={() => openCreateEntry()}>
								<Plus size={16} /> Thêm chứng từ
							</button>
						</>
					) : null}
					{tab === "centers" && canManage ? (
						<button className="erp-btn erp-btn-primary" onClick={openCreateCenter}>
							<Plus size={16} /> Thêm đối tượng
						</button>
					) : null}
					{tab === "sheets" && canManage ? (
						<button
							className="erp-btn erp-btn-primary"
							disabled={createSheet.isPending}
							onClick={async () => {
								if (
									await confirm({
										message: `Chốt bảng tính giá thành kỳ ${from} → ${to}? Số liệu sẽ được lưu lại làm lịch sử.`,
										tone: "primary",
										confirmText: "Chốt bảng tính",
									})
								) {
									createSheet.mutate();
								}
							}}
						>
							<Calculator size={16} /> Chốt bảng tính
						</button>
					) : null}
				</div>
			</div>

			<div className="erp-card flex flex-wrap gap-2 p-2">
				{(
					[
						["entries", "Chứng từ chi phí", ReceiptText],
						["centers", "Đối tượng chi phí", Layers],
						["sheets", "Lịch sử giá thành", History],
					] as const
				).map(([value, label, Icon]) => (
					<button
						key={value}
						className={`erp-btn ${tab === value ? "erp-btn-primary" : ""}`}
						onClick={() => setTab(value)}
					>
						<Icon size={16} /> {label}
					</button>
				))}
			</div>

			{(tab === "entries" || tab === "sheets") && (
				<div className="erp-card grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6">
					<label>
						Từ ngày
						<input
							type="date"
							value={from}
							onChange={event => {
								setFrom(event.target.value);
								setPage(1);
								setSheetPage(1);
							}}
						/>
					</label>
					<label>
						Đến ngày
						<input
							type="date"
							value={to}
							onChange={event => {
								setTo(event.target.value);
								setPage(1);
								setSheetPage(1);
							}}
						/>
					</label>
					<label>
						Kho sản xuất
						<select
							value={warehouseId}
							onChange={event => {
								setWarehouseId(Number(event.target.value));
								setPage(1);
								setSheetPage(1);
							}}
						>
							<option value={0}>Tất cả kho</option>
							{warehouses.map(warehouse => (
								<option key={warehouse.id} value={warehouse.id}>
									{warehouse.name}
								</option>
							))}
						</select>
					</label>
					{tab === "entries" ? (
						<label>
							Đối tượng chi phí
							<select
								value={costCenterId}
								onChange={event => {
									setCostCenterId(Number(event.target.value));
									setPage(1);
								}}
							>
								<option value={0}>Tất cả</option>
								{centers.map(center => (
									<option key={center.id} value={center.id}>
										{center.name}
									</option>
								))}
							</select>
						</label>
					) : (
						<label>
							Trạng thái
							<select
								value={sheetStatus}
								onChange={event => {
									setSheetStatus(event.target.value);
									setSheetPage(1);
								}}
							>
								<option value="">Tất cả</option>
								<option value="DRAFT">Nháp</option>
								<option value="POSTED">Đã chốt</option>
							</select>
						</label>
					)}
					{tab === "entries" ? (
						<label>
							Trạng thái
							<select
								value={status}
								onChange={event => {
									setStatus(event.target.value);
									setPage(1);
								}}
							>
								<option value="">Tất cả</option>
								<option value="DRAFT">Nháp</option>
								<option value="POSTED">Đã hạch toán</option>
								<option value="CANCELLED">Đã hủy</option>
							</select>
						</label>
					) : null}
					{tab === "entries" ? (
						<label>
							Tìm kiếm
							<div className="erp-search mt-1 w-full max-w-none">
								<Search size={16} />
								<input
									value={search}
									onChange={event => {
										setSearch(event.target.value);
										setPage(1);
									}}
									placeholder="Mã, ghi chú, lệnh SX..."
								/>
							</div>
						</label>
					) : null}
				</div>
			)}

			{tab === "entries" && (
				<>
					<div className="grid gap-4 md:grid-cols-3">
						<div className="erp-stat">
							<Wallet size={20} />
							<div>
								<span>Tổng chi phí trong kỳ</span>
								<strong>{money(totalEntryAmount)}</strong>
							</div>
						</div>
						<div className="erp-stat">
							<ReceiptText size={20} />
							<div>
								<span>Số chứng từ</span>
								<strong>{entryMeta.total || 0}</strong>
							</div>
						</div>
						<div className="erp-stat">
							<Layers size={20} />
							<div>
								<span>Đối tượng đang dùng</span>
								<strong>{activeCenters.length}</strong>
							</div>
						</div>
					</div>

					<div className="erp-card overflow-hidden">
						<div className="overflow-x-auto">
							<table className="erp-table">
								<thead>
									<tr>
										<th>Mã chứng từ</th>
										<th>Ngày</th>
										<th>Đối tượng chi phí</th>
										<th className="text-right">Số tiền</th>
										<th>Kho</th>
										<th>Đối tượng / Tầng</th>
										<th>Trạng thái</th>
										<th>Ghi chú</th>
										<th />
									</tr>
								</thead>
								<tbody>
									{entriesQuery.isLoading ? (
										<tr>
											<td colSpan={9} className="py-10 text-center text-slate-500">
												Đang tải dữ liệu...
											</td>
										</tr>
									) : entries.length === 0 ? (
										<tr>
											<td colSpan={9} className="py-10 text-center text-slate-400">
												Chưa có chứng từ chi phí trong kỳ.
											</td>
										</tr>
									) : (
										entries.map(entry => (
											<tr key={entry.id}>
												<td className="font-mono text-xs">{entry.code}</td>
												<td>{formatCostDate(entry.costDate)}</td>
												<td>
													<b>{entry.costCenterName || "—"}</b>
													<small>{entry.costCenterCode}</small>
												</td>
												<td className="text-right font-semibold">{money(entry.amount)}</td>
												<td>{entry.warehouseName || "Toàn xưởng"}</td>
												<td>
													<div className="flex flex-wrap items-center gap-1">
														{entry.productionOrderCode ? (
															<span className="font-mono text-xs">
																{entry.productionOrderCode}
															</span>
														) : entry.assemblyOrderCode ? (
															<span className="font-mono text-xs">
																{entry.assemblyOrderCode}
															</span>
														) : (
															<span className="text-slate-400">Theo kỳ</span>
														)}
														<span
															className={`erp-badge ${COST_TIER_META[entry.costTier || "PACK"]?.css || ""}`}
														>
															{COST_TIER_META[entry.costTier || "PACK"]?.short ||
																entry.costTier}
														</span>
													</div>
													{entry.incidentCode ? (
														<small>
															{entry.incidentCode} · {entry.incidentTitle}
														</small>
													) : null}
												</td>
												<td>
													<span
														className={`erp-badge ${COST_ENTRY_STATUS_META[entry.status]?.css || ""}`}
													>
														{COST_ENTRY_STATUS_META[entry.status]?.label ||
															entry.status}
													</span>
												</td>
												<td className="max-w-[220px] truncate" title={entry.note || ""}>
													{entry.note || "—"}
												</td>
												<td>
													{canManage ? (
														<div className="flex justify-end gap-1">
															<button
																className="erp-icon-btn"
																title="Cập nhật"
																onClick={() => openEditEntry(entry)}
															>
																<Edit size={15} />
															</button>
															<button
																className="erp-icon-btn text-red-600"
																title="Xóa"
																onClick={() => void askDeleteEntry(entry)}
															>
																<Trash2 size={15} />
															</button>
														</div>
													) : null}
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
						<div className="flex items-center justify-between p-3 text-sm">
							<span>
								Tổng {entryMeta.total || 0} chứng từ · {money(totalEntryAmount)}
							</span>
							<div className="flex gap-2">
								<button
									className="erp-btn"
									disabled={page <= 1}
									onClick={() => setPage(value => value - 1)}
								>
									Trước
								</button>
								<span className="self-center">
									Trang {page}/{entryMeta.totalPages || 1}
								</span>
								<button
									className="erp-btn"
									disabled={page >= Number(entryMeta.totalPages || 1)}
									onClick={() => setPage(value => value + 1)}
								>
									Sau
								</button>
							</div>
						</div>
					</div>
				</>
			)}

			{tab === "centers" && (
				<div className="erp-card overflow-hidden">
					<div className="overflow-x-auto">
						<table className="erp-table">
							<thead>
								<tr>
									<th>Mã</th>
									<th>Tên đối tượng chi phí</th>
									<th>Nhóm</th>
									<th>Tiêu thức phân bổ mặc định</th>
									<th>Trạng thái</th>
									<th>Mô tả</th>
									<th />
								</tr>
							</thead>
							<tbody>
								{centersQuery.isLoading ? (
									<tr>
										<td colSpan={7} className="py-10 text-center text-slate-500">
											Đang tải dữ liệu...
										</td>
									</tr>
								) : centers.length === 0 ? (
									<tr>
										<td colSpan={7} className="py-10 text-center text-slate-400">
											Chưa có đối tượng chi phí.
										</td>
									</tr>
								) : (
									centers.map(center => (
										<tr key={center.id}>
											<td className="font-mono text-xs">{center.code}</td>
											<td>
												<b>{center.name}</b>
											</td>
											<td>
												<span
													className={`erp-badge ${COST_CATEGORY_META[center.category]?.css || ""}`}
												>
													{COST_CATEGORY_META[center.category]?.label ||
														center.category}
												</span>
											</td>
											<td>
												{ALLOCATION_METHOD_META[center.defaultAllocationMethod]
													?.label || center.defaultAllocationMethod}
											</td>
											<td>
												<span
													className={`erp-badge ${center.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
												>
													{center.isActive ? "Đang dùng" : "Ngừng dùng"}
												</span>
											</td>
											<td className="max-w-[260px] truncate" title={center.description || ""}>
												{center.description || "—"}
											</td>
											<td>
												{canManage ? (
													<div className="flex justify-end gap-1">
														<button
															className="erp-icon-btn"
															title="Cập nhật"
															onClick={() => openEditCenter(center)}
														>
															<Edit size={15} />
														</button>
														<button
															className="erp-icon-btn"
															title={center.isActive ? "Ngừng sử dụng" : "Bật lại"}
															onClick={() => toggleCenter.mutate(center)}
														>
															<CheckCircle2 size={15} />
														</button>
													</div>
												) : null}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			)}

			{tab === "sheets" && (
				<div className="erp-card overflow-hidden">
					<div className="overflow-x-auto">
						<table className="erp-table">
							<thead>
								<tr>
									<th>Mã bảng tính</th>
									<th>Kỳ tính giá</th>
									<th>Kho</th>
									<th className="text-right">Gói sản xuất</th>
									<th className="text-right">Hộp / Túi lắp ráp</th>
									<th className="text-right">Tổng gộp</th>
									<th className="text-right">Số dòng</th>
									<th>Trạng thái</th>
									<th>Người chốt</th>
									<th>Thời điểm chốt</th>
									<th />
								</tr>
							</thead>
							<tbody>
								{sheetsQuery.isLoading ? (
									<tr>
										<td colSpan={9} className="py-10 text-center text-slate-500">
											Đang tải dữ liệu...
										</td>
									</tr>
								) : sheets.length === 0 ? (
									<tr>
										<td colSpan={9} className="py-10 text-center text-slate-400">
											Chưa có bảng tính giá thành nào trong khoảng thời gian / kho đã chọn.
										</td>
									</tr>
								) : (
									sheets.map(sheet => (
										<tr key={sheet.id}>
											<td className="font-mono text-xs">{sheet.code}</td>
											<td>
												{formatCostDate(sheet.fromDate)} → {formatCostDate(sheet.toDate)}
											</td>
											<td>{sheet.warehouseName || "Tất cả kho"}</td>
											<td className="text-right">{money(sheet.totalPackCost)}</td>
											<td className="text-right">{money(sheet.totalAssemblyCost)}</td>
											<td className="text-right font-semibold">{money(sheet.totalCost)}</td>
											<td className="text-right">{sheet.lineCount}</td>
											<td>
												<span
													className={`erp-badge ${COST_SHEET_STATUS_META[sheet.status]?.css || ""}`}
												>
													{COST_SHEET_STATUS_META[sheet.status]?.label || sheet.status}
												</span>
											</td>
											<td>{sheet.creatorName || "—"}</td>
											<td>{formatCostDateTime(sheet.postedAt || sheet.createdAt)}</td>
											<td>
												<div className="flex items-center justify-end gap-1">
													<button
														className="erp-btn"
														onClick={() => void viewSheetDetail(sheet)}
													>
														Xem
													</button>
													{canManage ? (
														<button
															className="erp-icon-btn text-rose-500"
															title="Xóa bảng tính"
															disabled={deleteSheet.isPending}
															onClick={() => void askDeleteSheet(sheet)}
														>
															<Trash2 size={15} />
														</button>
													) : null}
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
					<div className="flex items-center justify-between p-3 text-sm">
						<span>Tổng {sheetMeta.total || 0} bảng tính</span>
						<div className="flex gap-2">
							<button
								className="erp-btn"
								disabled={sheetPage <= 1}
								onClick={() => setSheetPage(value => value - 1)}
							>
								Trước
							</button>
							<span className="self-center">
								Trang {sheetPage}/{sheetMeta.totalPages || 1}
							</span>
							<button
								className="erp-btn"
								disabled={sheetPage >= Number(sheetMeta.totalPages || 1)}
								onClick={() => setSheetPage(value => value + 1)}
							>
								Sau
							</button>
						</div>
					</div>
				</div>
			)}

			{entryOpen && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-3xl">
						<div className="erp-modal-header">
							<div>
								<h2>
									{editingEntry
										? `Cập nhật ${editingEntry.code}`
										: "Nhập chứng từ chi phí sản xuất"}
								</h2>
								<p>
									Chi phí gắn lệnh sản xuất cộng vào giá gói (tầng 1); chi phí
									gắn lệnh lắp ráp cộng vào giá hộp/túi (tầng 2); chi phí theo kỳ
									phân bổ theo tầng và tiêu thức đã chọn.
								</p>
							</div>
							<button onClick={() => setEntryOpen(false)}>
								<X />
							</button>
						</div>
						<form
							onSubmit={event => {
								event.preventDefault();
								if (!entryForm.costCenterId) {
									toast.error("Chọn đối tượng chi phí");
									return;
								}
								saveEntry.mutate();
							}}
						>
							<div className="erp-modal-body space-y-4">
								<div className="grid gap-4 md:grid-cols-3">
									<label>
										Mã chứng từ
										<input
											value={entryForm.code}
											disabled={!!editingEntry}
											placeholder="Tự động"
											onChange={event =>
												setEntryForm(current => ({
													...current,
													code: event.target.value,
												}))
											}
										/>
									</label>
									<label>
										Ngày chi phí <span className="text-red-500">*</span>
										<input
											required
											type="date"
											value={entryForm.costDate}
											onChange={event =>
												setEntryForm(current => ({
													...current,
													costDate: event.target.value,
												}))
											}
										/>
									</label>
									<label>
										Trạng thái
										<select
											value={entryForm.status}
											onChange={event =>
												setEntryForm(current => ({
													...current,
													status: event.target.value as CostEntryStatus,
												}))
											}
										>
											<option value="POSTED">Đã hạch toán</option>
											<option value="DRAFT">Nháp</option>
											<option value="CANCELLED">Đã hủy</option>
										</select>
									</label>
									<label className="md:col-span-2">
										Đối tượng chi phí <span className="text-red-500">*</span>
										<select
											required
											value={entryForm.costCenterId}
											onChange={event =>
												setEntryForm(current => ({
													...current,
													costCenterId: Number(event.target.value),
												}))
											}
										>
											<option value={0}>-- Chọn đối tượng --</option>
											{activeCenters.map(center => (
												<option key={center.id} value={center.id}>
													{center.code} · {center.name}
												</option>
											))}
										</select>
									</label>
									<label>
										Số tiền <span className="text-red-500">*</span>
										<input
											required
											type="number"
											min={0}
											step="0.01"
											value={entryForm.amount}
											onChange={event =>
												setEntryForm(current => ({
													...current,
													amount: Number(event.target.value || 0),
												}))
											}
										/>
									</label>
									<label>
										Kho sản xuất
										<select
											value={entryForm.warehouseId ?? 0}
											onChange={event =>
												setEntryForm(current => ({
													...current,
													warehouseId: Number(event.target.value) || null,
												}))
											}
										>
											<option value={0}>Toàn xưởng / không gắn kho</option>
											{warehouses.map(warehouse => (
												<option key={warehouse.id} value={warehouse.id}>
													{warehouse.name}
												</option>
											))}
										</select>
									</label>
									<label>
										Lệnh sản xuất
										<select
											value={entryForm.productionOrderId ?? 0}
											onChange={event => {
												const value = Number(event.target.value) || null;
												setEntryForm(current => ({
													...current,
													productionOrderId: value,
													assemblyOrderId: value ? null : current.assemblyOrderId,
													costTier: value ? "PACK" : current.costTier,
												}));
											}}
										>
											<option value={0}>Không gắn lệnh sản xuất</option>
											{productionOrders.map(order => (
												<option key={order.id} value={order.id}>
													{order.code} · {order.products?.name || ""}
												</option>
											))}
										</select>
									</label>
									<label>
										Lệnh lắp ráp
										<select
											value={entryForm.assemblyOrderId ?? 0}
											onChange={event => {
												const value = Number(event.target.value) || null;
												setEntryForm(current => ({
													...current,
													assemblyOrderId: value,
													productionOrderId: value ? null : current.productionOrderId,
													costTier: value ? "ASSEMBLY" : current.costTier,
												}));
											}}
										>
											<option value={0}>Không gắn lệnh lắp ráp</option>
											{assemblyOrders.map(order => (
												<option key={order.id} value={order.id}>
													{order.code} · {order.output?.name || ""}
													{order.actualQuantity
														? ` (${formatNumber(order.actualQuantity)} ${order.output?.unit || ""})`
														: ""}
												</option>
											))}
										</select>
									</label>
									<label>
										Tầng chi phí
										<select
											value={entryTier}
											disabled={entryTierLocked}
											onChange={event =>
												setEntryForm(current => ({
													...current,
													costTier: event.target.value as CostTier,
												}))
											}
										>
											{Object.entries(COST_TIER_META).map(([value, meta]) => (
												<option key={value} value={value}>
													{meta.label}
												</option>
											))}
										</select>
										<small className="mt-1 block text-slate-500">
											{entryTierLocked
												? "Tự xác định theo lệnh đã chọn"
												: COST_TIER_META[entryTier].hint}
										</small>
									</label>
									<label>
										Tiêu thức phân bổ
										<select
											value={entryForm.allocationMethod}
											onChange={event =>
												setEntryForm(current => ({
													...current,
													allocationMethod:
														event.target.value as CostAllocationMethod | "",
												}))
											}
										>
											<option value="">Theo đối tượng chi phí</option>
											{Object.entries(ALLOCATION_METHOD_META).map(([value, meta]) => (
												<option key={value} value={value}>
													{meta.label}
												</option>
											))}
										</select>
									</label>
									<label className="md:col-span-2">
										Sự cố kỹ thuật (tùy chọn)
										<select
											value={entryForm.incidentId ?? 0}
											onChange={event =>
												setEntryForm(current => ({
													...current,
													incidentId: Number(event.target.value) || null,
												}))
											}
										>
											<option value={0}>Không gắn sự cố</option>
											{unbilled.map(incident => (
												<option key={incident.id} value={incident.id}>
													{incident.code} · {incident.title}
												</option>
											))}
										</select>
									</label>
									<label className="md:col-span-3">
										Ghi chú
										<textarea
											rows={2}
											maxLength={500}
											value={entryForm.note}
											onChange={event =>
												setEntryForm(current => ({
													...current,
													note: event.target.value,
												}))
											}
											placeholder="Diễn giải khoản chi phí..."
										/>
									</label>
								</div>
							</div>
							<div className="erp-modal-footer">
								<button
									type="button"
									className="erp-btn"
									onClick={() => setEntryOpen(false)}
								>
									Hủy
								</button>
								<button
									type="submit"
									className="erp-btn erp-btn-primary"
									disabled={saveEntry.isPending}
								>
									{saveEntry.isPending ? "Đang lưu..." : "Lưu chứng từ"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{centerOpen && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-2xl">
						<div className="erp-modal-header">
							<div>
								<h2>
									{editingCenter
										? `Cập nhật ${editingCenter.code}`
										: "Thêm đối tượng tập hợp chi phí"}
								</h2>
								<p>Chọn nhóm chi phí và tiêu thức phân bổ mặc định.</p>
							</div>
							<button onClick={() => setCenterOpen(false)}>
								<X />
							</button>
						</div>
						<form
							onSubmit={event => {
								event.preventDefault();
								saveCenter.mutate();
							}}
						>
							<div className="erp-modal-body space-y-4">
								<div className="grid gap-4 md:grid-cols-2">
									<label>
										Mã đối tượng <span className="text-red-500">*</span>
										<input
											required
											disabled={!!editingCenter}
											value={centerForm.code}
											onChange={event =>
												setCenterForm(current => ({
													...current,
													code: event.target.value,
												}))
											}
											placeholder="VD: DIEN_NUOC"
										/>
									</label>
									<label>
										Tên đối tượng <span className="text-red-500">*</span>
										<input
											required
											value={centerForm.name}
											onChange={event =>
												setCenterForm(current => ({
													...current,
													name: event.target.value,
												}))
											}
											placeholder="VD: Điện nước"
										/>
									</label>
									<label>
										Nhóm chi phí
										<select
											value={centerForm.category}
											onChange={event =>
												setCenterForm(current => ({
													...current,
													category: event.target.value as CostCenterCategory,
												}))
											}
										>
											{Object.entries(COST_CATEGORY_META).map(([value, meta]) => (
												<option key={value} value={value}>
													{meta.label}
												</option>
											))}
										</select>
									</label>
									<label>
										Tiêu thức phân bổ mặc định
										<select
											value={centerForm.defaultAllocationMethod}
											onChange={event =>
												setCenterForm(current => ({
													...current,
													defaultAllocationMethod:
														event.target.value as CostAllocationMethod,
												}))
											}
										>
											{Object.entries(ALLOCATION_METHOD_META).map(
												([value, meta]) => (
													<option key={value} value={value}>
														{meta.label}
													</option>
												),
											)}
										</select>
									</label>
									<label className="md:col-span-2">
										Mô tả
										<textarea
											rows={2}
											value={centerForm.description}
											onChange={event =>
												setCenterForm(current => ({
													...current,
													description: event.target.value,
												}))
											}
										/>
									</label>
									<label className="flex items-center gap-2 md:col-span-2">
										<input
											type="checkbox"
											checked={centerForm.isActive}
											onChange={event =>
												setCenterForm(current => ({
													...current,
													isActive: event.target.checked,
												}))
											}
										/>
										Đang sử dụng
									</label>
								</div>
							</div>
							<div className="erp-modal-footer">
								<button
									type="button"
									className="erp-btn"
									onClick={() => setCenterOpen(false)}
								>
									Hủy
								</button>
								<button
									type="submit"
									className="erp-btn erp-btn-primary"
									disabled={saveCenter.isPending}
								>
									{saveCenter.isPending ? "Đang lưu..." : "Lưu đối tượng"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{importOpen && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-4xl">
						<div className="erp-modal-header">
							<div>
								<h2>Nhập chi phí từ sự cố kỹ thuật</h2>
								<p>
									Chọn các sự cố đã phát sinh chi phí và chưa được hạch toán
									trong kỳ {from} → {to}.
								</p>
							</div>
							<button onClick={() => setImportOpen(false)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							<div className="grid gap-3 md:grid-cols-2">
								<label>
									Hạch toán vào đối tượng
									<select
										value={importCostCenterId}
										onChange={event => setImportCostCenterId(Number(event.target.value))}
									>
										<option value={0}>-- Chọn đối tượng --</option>
										{activeCenters.map(center => (
											<option key={center.id} value={center.id}>
												{center.code} · {center.name}
											</option>
										))}
									</select>
								</label>
								<div className="erp-stat">
									<Wallet size={18} />
									<div>
										<span>Đã chọn</span>
										<strong>
											{selectedIncidents.length} sự cố · {money(selectedIncidentCost)}
										</strong>
									</div>
								</div>
							</div>
							<div className="max-h-[52vh] overflow-auto rounded-lg border">
								<table className="erp-table">
									<thead>
										<tr>
											<th className="w-10">
												<input
													type="checkbox"
													checked={
														unbilled.length > 0 &&
														selectedIncidents.length === unbilled.length
													}
													onChange={event =>
														setSelectedIncidents(
															event.target.checked
																? unbilled.map(incident => incident.id)
																: [],
														)
													}
												/>
											</th>
											<th>Mã</th>
											<th>Sự cố</th>
											<th>Thiết bị</th>
											<th>Thời gian</th>
											<th className="text-right">Chi phí</th>
										</tr>
									</thead>
									<tbody>
										{unbilledQuery.isLoading ? (
											<tr>
												<td colSpan={6} className="py-8 text-center text-slate-500">
													Đang tải...
												</td>
											</tr>
										) : unbilled.length === 0 ? (
											<tr>
												<td colSpan={6} className="py-8 text-center text-slate-400">
													Không còn sự cố nào chưa hạch toán trong kỳ.
												</td>
											</tr>
										) : (
											unbilled.map(incident => (
												<tr key={incident.id}>
													<td>
														<input
															type="checkbox"
															checked={selectedIncidents.includes(incident.id)}
															onChange={event =>
																setSelectedIncidents(current =>
																	event.target.checked
																		? [...current, incident.id]
																		: current.filter(id => id !== incident.id),
																)
															}
														/>
													</td>
													<td className="font-mono text-xs">{incident.code}</td>
													<td>
														<b>{incident.title}</b>
														{incident.assigneeName ? (
															<small>{incident.assigneeName}</small>
														) : null}
													</td>
													<td>{incident.equipmentName || "—"}</td>
													<td>{formatCostDate(incident.resolvedAt || incident.occurredAt)}</td>
													<td className="text-right font-semibold">
														{money(incident.cost)}
													</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>
						<div className="erp-modal-footer">
							<button className="erp-btn" onClick={() => setImportOpen(false)}>
								Hủy
							</button>
							<button
								className="erp-btn erp-btn-primary"
								disabled={
									!selectedIncidents.length ||
									!importCostCenterId ||
									importIncidents.isPending
								}
								onClick={() => importIncidents.mutate()}
							>
								{importIncidents.isPending
									? "Đang nhập..."
									: `Nhập ${selectedIncidents.length} chi phí`}
							</button>
						</div>
					</div>
				</div>
			)}

			{viewSheet && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-5xl">
						<div className="erp-modal-header">
							<div>
								<h2>Bảng tính giá thành {viewSheet.code}</h2>
								<p>
									Kỳ {formatCostDate(viewSheet.fromDate)} →{" "}
									{formatCostDate(viewSheet.toDate)} ·{" "}
									{viewSheet.warehouseName || "Tất cả kho"} ·{" "}
									{COST_SHEET_STATUS_META[viewSheet.status]?.label}
								</p>
							</div>
							<button onClick={() => setViewSheet(null)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							<div className="grid gap-3 md:grid-cols-4">
								<div className="erp-stat">
									<Calculator size={18} />
									<div>
										<span>Tổng gộp 2 tầng</span>
										<strong>{money(viewSheet.totalCost)}</strong>
									</div>
								</div>
								<div className="erp-stat">
									<Layers size={18} />
									<div>
										<span>Gói sản xuất</span>
										<strong>{money(viewSheet.totalPackCost)}</strong>
									</div>
								</div>
								<div className="erp-stat">
									<Layers size={18} />
									<div>
										<span>Hộp / Túi lắp ráp</span>
										<strong>{money(viewSheet.totalAssemblyCost)}</strong>
									</div>
								</div>
								<div className="erp-stat">
									<History size={18} />
									<div>
										<span>Thời điểm chốt</span>
										<strong className="text-sm">
											{formatCostDateTime(viewSheet.postedAt || viewSheet.createdAt)}
										</strong>
									</div>
								</div>
							</div>
							<div className="max-h-[55vh] overflow-auto rounded-lg border">
								<table className="erp-table">
									<thead>
										<tr>
											<th>Sản phẩm / Quy cách</th>
											<th>Tầng</th>
											<th>Thành phần chi phí</th>
											<th className="text-right">Sản lượng</th>
											<th className="text-right">Số tiền</th>
											<th className="text-right">Giá / đơn vị</th>
										</tr>
									</thead>
									<tbody>
										{(viewSheet.lines || []).map(line => (
											<tr key={line.id}>
												<td>
													<b>{line.productName || "—"}</b>
													<small>
														{line.packagingSku ? `${line.packagingSku} · ` : ""}
														{line.packagingName}
													</small>
												</td>
												<td>
													<span
														className={`erp-badge ${COST_TIER_META[line.tier || "PACK"]?.css || ""}`}
													>
														{COST_TIER_META[line.tier || "PACK"]?.short ||
															line.tier}
													</span>
												</td>
												<td>
													{COST_COMPONENT_LABEL[line.costComponent] ||
														line.costComponent}
													{line.costCenterName ? (
														<small>{line.costCenterName}</small>
													) : null}
												</td>
												<td className="text-right">{formatNumber(line.actualQty)}</td>
												<td className="text-right font-semibold">
													{money(line.allocatedAmount)}
												</td>
												<td className="text-right">{money(line.unitCost)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
							{viewSheet.note ? (
								<p className="text-sm text-slate-600">Ghi chú: {viewSheet.note}</p>
							) : null}
						</div>
						<div className="erp-modal-footer">
							<button className="erp-btn" onClick={() => setViewSheet(null)}>
								Đóng
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
