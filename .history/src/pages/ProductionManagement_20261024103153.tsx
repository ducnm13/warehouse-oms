import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import {
	AlertCircle,
	CheckCircle2,
	Copy,
	Edit,
	Eye,
	Factory,
	FileSpreadsheet,
	Lock,
	Play,
	Plus,
	Printer,
	Save,
	Search,
	Trash2,
	Undo2,
	X,
} from "lucide-react";
import toast from "../components/ui/toast";
import { confirm, prompt } from "../components/ui/confirm";
import { apiV1, legacyApi } from "../lib/apiV1";
import { ProductionDocument } from "../components/ProductionDocument";
import { buildCompanyPrintProfile } from "../lib/printTemplate";
import { formatDate, formatNumber } from "../lib/utils";
import type { Product, ProductionOrderV1, User, Warehouse } from "../types";
import { useMultiEscapeKey } from "../hooks/useEscapeKey";
import { DateInput } from "../components/DateRangeCalendar";
import SearchableSelect from "../components/SearchableSelect";
import TableActions from "../components/TableActions";
import ListToolbar from "../components/ListToolbar";
import type { FilterField, FilterValues } from "../components/FilterDrawer";
import { exportExcelFile } from "../lib/excelExport";

const today = () => new Date().toISOString().slice(0, 10);

const statusMeta = {
	DRAFT: { label: "Nháp", css: "bg-slate-100 text-slate-700" },
	IN_PROGRESS: { label: "Đang sản xuất", css: "bg-amber-100 text-amber-700" },
	COMPLETED: { label: "Đã xong", css: "bg-emerald-100 text-emerald-700" },
	CANCELLED: { label: "Đã hủy", css: "bg-red-100 text-red-700" },
} as const;

const PRODUCTION_MGMT_FILTER_FIELDS: FilterField[] = [
	{
		type: "select",
		key: "status",
		label: "Trạng thái",
		options: Object.entries(statusMeta).map(([value, meta]) => ({
			value,
			label: meta.label,
		})),
	},
	{
		type: "dateRange",
		key: "orderDate",
		label: "Ngày lệnh",
		fromKey: "dateFrom",
		toKey: "dateTo",
	},
];

const addMonths = (dateStr: string, months: number) => {
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return "";
	d.setMonth(d.getMonth() + months);
	return d.toISOString().slice(0, 10);
};

interface AllocRow {
	packagingId: number;
	actualQuantity: number;
	note: string;
}

// Tiền tố số lô theo sản phẩm: COP28 → CO, Quán Gold → QG, Cacao → CA, Matcha → MT...
const BATCH_PREFIXES: Array<[string, string]> = [
	["COP28", "CO"],
	["QUANGOLD", "QG"],
	["CACAO", "CA"],
	["MATCHA", "MT"],
];

const batchPrefixFor = (productName?: string, sku?: string) => {
	const condensed = `${productName || ""} ${sku || ""}`
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/đ/g, "d")
		.replace(/Đ/g, "D")
		.toUpperCase()
		.replace(/\s+/g, "");
	for (const [key, prefix] of BATCH_PREFIXES) {
		if (condensed.includes(key)) return prefix;
	}
	return "";
};

// DDMMYY từ ngày YYYY-MM-DD (cắt chuỗi để tránh lệch múi giờ)
const ddmmyyOf = (dateStr: string) => {
	const m = (dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
	if (!m) return "";
	return `${m[3]}${m[2]}${m[1].slice(2)}`;
};

// Số lô tự điền: PREFIX + DDMMYY + -L01 (VD: CO151025-L01)
const autoBatchNumber = (
	mfgDate: string,
	productName?: string,
	sku?: string,
) => {
	const prefix = batchPrefixFor(productName, sku);
	const stamp = ddmmyyOf(mfgDate);
	return prefix && stamp ? `${prefix}${stamp}-L01` : "";
};

// Nhận biết số lô do phần mềm tự điền để tự cập nhật theo ngày SX (số gõ tay thì giữ nguyên)
const isAutoBatch = (batch: string) =>
	/^[A-Z]{2}\d{6}-L\d+$/i.test((batch || "").trim());

export default function ProductionManagement({
	user,
	onNavigate,
}: {
	user: User;
	onNavigate?: (tab: string) => void;
}) {
	const qc = useQueryClient();
	const manage =
		user.role === "ADMIN" ||
		user.role === "P_MANAGER" ||
		user.role === "W_MANAGER" ||
		(user.permissions || []).includes("production.manage");
	const [search, setSearch] = useState("");
	const [filters, setFilters] = useState<FilterValues>({});
	const status = filters.status || "";
	const [selected, setSelected] = useState<ProductionOrderV1 | null>(null);
	const [reportOrder, setReportOrder] = useState<ProductionOrderV1 | null>(
		null,
	);
	const reportRef = useRef<HTMLDivElement>(null);
	const handlePrintReport = useReactToPrint({
		contentRef: reportRef,
		documentTitle: reportOrder
			? `Bao-cao-chot-${reportOrder.code}`
			: "Bao-cao-chot",
		// Lề 0 để trình duyệt ẩn header/footer (địa chỉ web, số trang) trên giấy in
		pageStyle: "@page { size: A4; margin: 0; }",
	});
	const [editForm, setEditForm] = useState<{
		code: string;
		orderDate: string;
		warehouseId: number;
		batchNumber: string;
		mfgDate: string;
		expDate: string;
		targetSachets: number;
		lossPercent: number;
		totalPowderKg: number;
		note: string;
		outputs: Array<{
			detailId: number;
			packagingId: number;
			plannedQuantity: number;
			allocationPercent: number;
			actualQuantity: number;
			note: string;
			shelfLifeMonths: number;
		}>;
	} | null>(null);
	// Dòng phân bổ thêm (SKU đóng gói thêm ngoài kế hoạch) — chỉ chốt qua nút CHỐT
	const [allocRows, setAllocRows] = useState<AllocRow[]>([]);
	const [pickSku, setPickSku] = useState(0);

	useMultiEscapeKey([
		{ isOpen: !!selected, onClose: () => setSelected(null), priority: 1 },
		{ isOpen: !!reportOrder, onClose: () => setReportOrder(null), priority: 2 },
		{ isOpen: !!editForm, onClose: () => setEditForm(null), priority: 3 },
	]);

	const refs = useQuery({
		queryKey: ["production-mgmt-refs"],
		queryFn: async () => {
			const [warehouses, products] = await Promise.all([
				legacyApi<Warehouse[]>("/api/warehouses"),
				legacyApi<Product[]>("/api/products"),
			]);
			return { warehouses, products };
		},
	});

	const companyQuery = useQuery({
		queryKey: ["company-profile"],
		queryFn: async () => {
			try {
				const res = await apiV1("/api/v1/company");
				return buildCompanyPrintProfile(res.data);
			} catch {
				return null;
			}
		},
		staleTime: 5 * 60_000,
	});

	const docs = useQuery({
		queryKey: [
			"production-v1-mgmt",
			filters.dateFrom,
			filters.dateTo,
			status,
			search,
		],
		queryFn: () => {
			const params = new URLSearchParams({ page: "1", limit: "100" });
			if (search) params.set("search", search);
			if (status) params.set("status", status);
			if (filters.dateFrom) params.set("from", filters.dateFrom);
			if (filters.dateTo) params.set("to", filters.dateTo);
			return apiV1<ProductionOrderV1[]>(
				`/api/v1/production-orders?${params.toString()}`,
			);
		},
	});

	const packagingOptions = useMemo(
		() =>
			(refs.data?.products || []).flatMap(product =>
				(product.packagings || []).map(packaging => ({
					...packaging,
					productName: product.name,
					canBeProduced: Boolean((product as any).canBeProduced),
				})),
			),
		[refs.data],
	);
	// Chỉ những VTHH được đánh dấu "Sản xuất được" mới dùng để phân bổ thành phẩm
	const producibleOptions = useMemo(
		() => packagingOptions.filter(p => p.canBeProduced),
		[packagingOptions],
	);

	const warehouseNameMap = useMemo(
		() => new Map((refs.data?.warehouses || []).map(w => [w.id, w.name])),
		[refs.data],
	);

	const getWarehouseName = (warehouseId: number) =>
		warehouseNameMap.get(warehouseId) || "—";

	const invalidate = () =>
		Promise.all([
			qc.invalidateQueries({ queryKey: ["production-v1-mgmt"] }),
			qc.invalidateQueries({ queryKey: ["production-v1"] }),
			qc.invalidateQueries({ queryKey: ["inventory-balances-v1"] }),
		]);

	const updateMutation = useMutation({
		mutationFn: async (input: {
			id: number;
			version: number;
			code: string;
			orderDate: string;
			warehouseId: number;
			batchNumber: string;
			mfgDate: string;
			expDate: string;
			targetSachets: number;
			lossPercent: number;
			totalPowderKg: number;
			note: string;
			outputs: Array<{
				detailId: number;
				packagingId: number;
				plannedQuantity: number;
				allocationPercent: number;
				actualQuantity: number;
				note: string;
			}>;
		}) => {
			const { id, version, ...payload } = input;
			return apiV1<ProductionOrderV1>(`/api/v1/production-orders/${id}`, {
				method: "PUT",
				body: JSON.stringify({ ...payload, version }),
			});
		},
		onSuccess: response => {
			toast.success("Đã lưu thiết lập");
			const saved = response.data;
			setSelected(saved);
			// PUT tạo lại dòng chi tiết (id mới) → map lại actual đã nhập theo mã bao bì
			setEditForm(prev => {
				if (!prev) return prev;
				const prevActual = new Map(
					prev.outputs.map(o => [o.packagingId, o.actualQuantity]),
				);
				return {
					...prev,
					outputs: (saved.outputs || []).map(d => ({
						detailId: d.id,
						packagingId: d.packagingId,
						plannedQuantity: d.plannedQuantity,
						allocationPercent: d.allocationPercent || 0,
						actualQuantity: prevActual.get(d.packagingId) || 0,
						note: d.note || "",
						shelfLifeMonths: d.shelfLifeMonths || 24,
					})),
				};
			});
			invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const confirmMutation = useMutation({
		mutationFn: async (input: {
			id: number;
			version: number;
			outputs: Array<{ detailId: number; allocationPercent: number }>;
		}) => {
			const { id, version, outputs } = input;
			return apiV1<ProductionOrderV1>(
				`/api/v1/production-orders/${id}/confirm`,
				{
					method: "POST",
					body: JSON.stringify({ version, outputs }),
				},
			);
		},
		onSuccess: response => {
			toast.success("Đã xác nhận sản xuất — nhập thực tế rồi CHỐT");
			setSelected(response.data);
			invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const completeMutation = useMutation({
		mutationFn: async (input: {
			id: number;
			version: number;
			outputs: Array<{
				detailId?: number;
				packagingId?: number;
				actualQuantity: number;
				note: string;
			}>;
			materials: Array<{ materialId: number; actualQuantity: number }>;
		}) => {
			const { id, version, outputs, materials } = input;
			return apiV1<ProductionOrderV1>(
				`/api/v1/production-orders/${id}/complete`,
				{
					method: "POST",
					body: JSON.stringify({ version, outputs, materials }),
				},
			);
		},
		onSuccess: response => {
			const code = response.data?.code || "";
			toast.success(`Đã chốt hoàn thành ${code}`);
			setSelected(null);
			setEditForm(null);
			setAllocRows([]);
			invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const cancelMutation = useMutation({
		mutationFn: ({
			id,
			version,
			reason,
		}: {
			id: number;
			version: number;
			reason: string;
		}) =>
			apiV1<ProductionOrderV1>(`/api/v1/production-orders/${id}/cancel`, {
				method: "POST",
				body: JSON.stringify({ version, reason }),
			}),
		onSuccess: () => {
			toast.success("Đã hủy lệnh sản xuất");
			setSelected(null);
			setEditForm(null);
			invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const unpostMutation = useMutation({
		mutationFn: ({ id, version }: { id: number; version: number }) =>
			apiV1<ProductionOrderV1>(`/api/v1/production-orders/${id}/unpost`, {
				method: "POST",
				body: JSON.stringify({ version }),
			}),
		onSuccess: () => {
			toast.success("Đã hủy lưu lệnh sản xuất");
			setSelected(null);
			setEditForm(null);
			invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const syncMaterialsMutation = useMutation({
		mutationFn: (orderId: number) =>
			apiV1<ProductionOrderV1>(
				`/api/v1/production-orders/${orderId}/sync-materials`,
				{
					method: "POST",
				},
			),
		onSuccess: () => {
			toast.success("Đã đồng bộ nguyên vật liệu từ phiếu xuất kho");
			invalidate();
			if (selected) setSelected({ ...selected, version: selected.version + 1 }); // trigger refetch
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const deleteMutation = useMutation({
		mutationFn: (order: ProductionOrderV1) =>
			apiV1<ProductionOrderV1>(`/api/v1/production-orders/${order.id}/delete`, {
				method: "POST",
				body: JSON.stringify({ version: order.version }),
			}),
		onSuccess: () => {
			toast.success("Đã xóa lệnh sản xuất");
			setSelected(null);
			setEditForm(null);
			invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const openEdit = (order: ProductionOrderV1) => {
		setSelected(order);
		const shelf = order.outputs?.[0]?.shelfLifeMonths ?? 24;
		const mfg = order.mfgDate || today();
		const exp = order.expDate || addMonths(mfg, shelf);
		const mainOut = order.outputs?.[0];
		const mainPkg = packagingOptions.find(p => p.id === mainOut?.packagingId);
		const batchNumber =
			order.batchNumber ||
			autoBatchNumber(mfg, (mainPkg as any)?.productName, mainOut?.sku) ||
			"";
		setEditForm({
			code: order.code,
			orderDate: order.orderDate,
			warehouseId: order.warehouseId,
			batchNumber,
			mfgDate: mfg,
			expDate: exp,
			targetSachets: order.targetSachets || 0,
			lossPercent: order.lossPercent || 0,
			totalPowderKg: order.totalPowderKg || 0,
			note: (order as any).note || "",
			outputs: (order.outputs || []).map(d => ({
				detailId: d.id,
				packagingId: d.packagingId,
				plannedQuantity: d.plannedQuantity,
				allocationPercent: d.allocationPercent || 0,
				actualQuantity: d.actualQuantity || 0,
				note: d.note || "",
				shelfLifeMonths: d.shelfLifeMonths || 24,
			})),
		});
		setAllocRows([]);
		setPickSku(0);
	};
	const duplicate = async (order: ProductionOrderV1) => {
		const mfgDate = today();
		const shelf = order.outputs?.[0]?.shelfLifeMonths ?? 24;
		try {
			const response = await apiV1<ProductionOrderV1>(
				"/api/v1/production-orders",
				{
					method: "POST",
					body: JSON.stringify({
						code: "",
						orderDate: today(),
						mfgDate,
						expDate: addMonths(mfgDate, shelf),
						warehouseId: order.warehouseId,
						batchNumber: "",
						totalPowderKg: order.totalPowderKg || 0,
						targetSachets: order.targetSachets || 0,
						lossPercent: order.lossPercent || 0,
						note: (order as any).note || "",
						outputs: (order.outputs || []).map(output => ({
							packagingId: output.packagingId,
							plannedQuantity: output.plannedQuantity,
							allocationPercent: output.allocationPercent || 0,
							note: output.note || "",
						})),
					}),
				},
			);
			toast.success(`Đã nhân bản lệnh ${order.code}`);
			setSelected(response.data);
			invalidate();
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Không nhân bản được lệnh",
			);
		}
	};

	const handleMfgDateChange = (newMfgDate: string) => {
		if (!editForm) return;
		const months = editForm.outputs[0]?.shelfLifeMonths ?? 24;
		// Số lô trống hoặc do phần mềm tự điền thì đánh lại theo ngày SX mới; số gõ tay giữ nguyên
		let batchNumber = editForm.batchNumber;
		if (!batchNumber.trim() || isAutoBatch(batchNumber)) {
			const mainOut = editForm.outputs[0];
			const mainPkg = packagingOptions.find(p => p.id === mainOut?.packagingId);
			batchNumber =
				autoBatchNumber(
					newMfgDate,
					(mainPkg as any)?.productName,
					mainPkg?.sku,
				) || batchNumber;
		}
		setEditForm({
			...editForm,
			mfgDate: newMfgDate,
			expDate: addMonths(newMfgDate, months),
			batchNumber,
		});
	};

	const handleEditSubmit = () => {
		if (!editForm || !selected) return;
		updateMutation.mutate({
			id: selected.id,
			version: selected.version,
			...editForm,
		});
	};

	const handleConfirmSx = async (order: ProductionOrderV1) => {
		if (!(await confirm(`Xác nhận sản xuất lệnh ${order.code}?`))) return;
		confirmMutation.mutate({
			id: order.id,
			version: order.version,
			outputs: (order.outputs || []).map(d => ({
				detailId: d.id,
				allocationPercent: 0,
			})),
		});
	};

	const handleChot = async () => {
		if (!selected) return;
		const originals = (editForm?.outputs || [])
			.filter(o => Number(o.actualQuantity) > 0)
			.map(o => ({
				detailId: o.detailId,
				actualQuantity: Number(o.actualQuantity),
				note: o.note || "",
			}));
		const added = allocRows
			.filter(r => r.packagingId > 0 && Number(r.actualQuantity) > 0)
			.map(r => ({
				packagingId: r.packagingId,
				actualQuantity: Number(r.actualQuantity),
				note: r.note || "",
			}));
		const outputs = [...originals, ...added];
		if (!outputs.length) {
			toast.error("Nhập số lượng thực tế cho ít nhất một dòng phân bổ");
			return;
		}
		const total = outputs.reduce((s, o) => s + o.actualQuantity, 0);
		if (
			!(await confirm(
				`Chốt ${formatNumber(total)} gói cho ${selected.code}? Kho sẽ lập phiếu nhập theo số chốt.`,
			))
		)
			return;
		completeMutation.mutate({
			id: selected.id,
			version: selected.version,
			outputs,
			materials: [],
		});
	};

	// ── Dự kiến sản lượng = tổng bột / khối lượng tịnh 1 gói ──
	const mainOutput = selected?.outputs?.[0];
	const mainPkg = packagingOptions.find(p => p.id === mainOutput?.packagingId);
	const netWeightKg = Number((mainPkg as any)?.netWeight || 0);
	const expectedPacks =
		editForm && netWeightKg > 0 && editForm.totalPowderKg > 0
			? Math.floor(editForm.totalPowderKg / netWeightKg)
			: 0;

	// ── Gợi ý SKU cùng mã (VD: CLC28PA → CLC2806, CLC2810...) ──
	const usedPackagingIds = new Set([
		...(selected?.outputs || []).map(d => d.packagingId),
		...allocRows.map(r => r.packagingId),
	]);
	const pickSkuOptions = producibleOptions
		.filter(p => p.id > 0 && !usedPackagingIds.has(p.id))
		.map(p => ({
			value: p.id,
			label: p.productName || p.name,
			subLabel: [p.sku, p.name !== p.productName ? p.name : "", p.unit]
				.filter(Boolean)
				.join(" | "),
		}));
	const handleSuggestSkus = () => {
		const baseSku = (mainOutput?.sku || "").toUpperCase();
		const m = baseSku.match(/^([A-ZÀ-Ỹ]+)(\d+)/);
		const prefix = m ? m[1] + m[2] : baseSku.slice(0, 5);
		if (!prefix) {
			toast.error("Mã thành phẩm chính chưa rõ để gợi ý");
			return;
		}
		const found = producibleOptions
			.filter(
				p =>
					p.id > 0 &&
					!usedPackagingIds.has(p.id) &&
					(p.sku || "").toUpperCase() !== baseSku &&
					(p.sku || "").toUpperCase().startsWith(prefix),
			)
			.slice(0, 20);
		if (!found.length) {
			toast.error(`Không tìm thấy SKU cùng mã ${prefix}`);
			return;
		}
		setAllocRows(rows => [
			...rows,
			...found.map(p => ({ packagingId: p.id, actualQuantity: 0, note: "" })),
		]);
		toast.success(`Đã thêm ${found.length} gợi ý cùng mã ${prefix}`);
	};

	const handleAddPickSku = () => {
		if (!pickSku) {
			toast.error("Chọn SKU cần phân bổ thêm");
			return;
		}
		if (usedPackagingIds.has(pickSku)) {
			toast.error("SKU đã có trong bảng phân bổ");
			return;
		}
		setAllocRows(rows => [
			...rows,
			{ packagingId: pickSku, actualQuantity: 0, note: "" },
		]);
		setPickSku(0);
	};

	const allocPackagingName = (packagingId: number) => {
		const p = packagingOptions.find(x => x.id === packagingId);
		return p ? `${p.name}${p.sku ? ` (${p.sku})` : ""}` : `PKG-${packagingId}`;
	};

	// Số gói trong 1 hộp/túi (VD hộp 10 gói → 10); thiếu thì coi như 1
	const packCountOf = (packagingId: number, fallback = 1) => {
		const pc = Number(
			packagingOptions.find(p => p.id === packagingId)?.packCount || 0,
		);
		return pc > 0 ? pc : fallback;
	};
	// Hiển thị SL hộp/túi từ số gói (làm tròn 3 lẻ)
	const boxesOf = (packs: number, pc: number) =>
		Number(((Number(packs) || 0) / (pc > 0 ? pc : 1)).toFixed(3));

	const totalActual =
		(editForm?.outputs || []).reduce(
			(s, o) => s + (Number(o.actualQuantity) || 0),
			0,
		) + allocRows.reduce((s, r) => s + (Number(r.actualQuantity) || 0), 0);
	const totalPlanned = (selected?.outputs || []).reduce(
		(s, d) => s + (Number(d.plannedQuantity) || 0),
		0,
	);

	const isDraft = selected?.status === "DRAFT";
	const isProgress = selected?.status === "IN_PROGRESS";
	const isCompleted = selected?.status === "COMPLETED";
	// Được nhập/sửa thực tế khi đang SX hoặc đã chốt (chốt lại để bổ sung)
	const canActual = isProgress || isCompleted;
	// Được sửa thông tin mẻ (kg, ngày SX/HSD, số lô...) khi lệnh nháp hoặc đang SX (chưa chốt)
	const canEditBatch = isDraft || isProgress;

	const rows = docs.data?.data || [];
	const exportProductionList = () =>
		exportExcelFile(
			"quan-ly-san-xuat.xlsx",
			"Quan ly san xuat",
			[
				{ header: "Mã lệnh", value: (row: ProductionOrderV1) => row.code },
				{ header: "Ngày", value: (row: ProductionOrderV1) => row.orderDate },
				{
					header: "Thành phẩm",
					value: (row: ProductionOrderV1) =>
						(row.outputs || [])
							.filter(output => Number(output.plannedQuantity || 0) > 0)
							.map(output => output.packagingName || output.sku || "")
							.join("; "),
					width: 32,
				},
				{
					header: "Số lô",
					value: (row: ProductionOrderV1) => row.batchNumber || "",
				},
				{
					header: "Trạng thái",
					value: (row: ProductionOrderV1) =>
						statusMeta[row.status as keyof typeof statusMeta]?.label ||
						row.status,
				},
				{
					header: "Diễn giải",
					value: (row: ProductionOrderV1) => row.note || "",
					width: 36,
				},
			],
			rows,
		);

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Quản lý sản xuất</h1>
					<p>
						Theo dõi lệnh sản xuất, bổ sung thông tin mẻ, phân bổ SKU và chốt
						nhập kho
					</p>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-4">
				{(
					[
						["Tổng lệnh", rows.length, Factory],
						[
							"Nháp",
							rows.filter(x => x.status === "DRAFT").length,
							FileSpreadsheet,
						],
						[
							"Đang SX",
							rows.filter(x => x.status === "IN_PROGRESS").length,
							Factory,
						],
						[
							"Đã xong",
							rows.filter(x => x.status === "COMPLETED").length,
							CheckCircle2,
						],
					] as const
				).map(([label, value, Icon]) => (
					<div key={label} className="erp-stat">
						<Icon />
						<div>
							<span>{label}</span>
							<strong>{value}</strong>
						</div>
					</div>
				))}
			</div>

			<div className="erp-card overflow-hidden">
				<ListToolbar
					fields={PRODUCTION_MGMT_FILTER_FIELDS}
					values={filters}
					onChange={setFilters}
					onExport={exportProductionList}
					exportDisabled={rows.length === 0}
					search={
						<div className="erp-search">
							<Search size={16} />
							<input
								value={search}
								onChange={e => setSearch(e.target.value)}
								placeholder="Tìm mã lệnh, số lô..."
							/>
						</div>
					}
				/>
				{docs.isLoading ? (
					<div className="p-12 text-center">Đang tải...</div>
				) : docs.isError ? (
					<div className="p-12 text-center text-red-600">
						{(docs.error as Error).message}
					</div>
				) : rows.length === 0 ? (
					<div className="p-12 text-center text-slate-400">
						Chưa có lệnh sản xuất.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="erp-table">
							<thead>
								<tr>
									{/* <th>Ngày</th> */}
									<th>LSX/LOT</th>
									<th>NSX/HSD</th>
									<th>Thành phẩm</th>
									<th>Diễn giải</th>
									{/* <th className="text-center">Đã lập đủ PN</th>
									<th className="text-center">Đã lập đủ PX</th> */}
									<th>Trạng thái</th>
									<th>Số máy</th>
									<th>Thao tác</th>
								</tr>
							</thead>
							<tbody>
								{rows.map(order => (
									<tr
										key={order.id}
										className={
											order.status === "IN_PROGRESS" ? "bg-amber-50" : ""
										}
									>
										<td>
											<button
												className="font-bold text-[#422afb] hover:underline"
												onClick={() => setSelected(order)}
											>
												{order.code}
											</button>
										</td>
										<td>
											{order.mfgDate && (
												<p className="text co">
													{" "}
													NSX:{formatDate(order.mfgDate)}
												</p>
											)}
											{order.expDate && <p>HSD:{formatDate(order.expDate)}</p>}
											{order.batchNumber && <p>LOT:{order.batchNumber}</p>}
										</td>
										<td>
											{(order.outputs || []).map(d => (
												<div key={d.id} className="text-sm">
													<p>{d.packagingName}</p>
													<small>
														Lệnh: {formatNumber(d.plannedQuantity)} {d.unit}
													</small>
													{(d.actualQuantity || 0) > 0 && (
														<small className="block text-emerald-700">
															Chốt: {formatNumber(d.actualQuantity)} {d.unit}
														</small>
													)}
												</div>
											))}
										</td>
										<td className="max-w-[260px] whitespace-normal text-slate-600">
											{order.note || "—"}
										</td>
										{/* <td className="text-center">
											<input
												type="checkbox"
												disabled
												className="h-4 w-4 accent-emerald-600"
												checked={(order.links || []).some(
													link => link.linkType === "INVENTORY_RECEIPT",
												)}
												title={
													(order.links || [])
														.filter(
															link => link.linkType === "INVENTORY_RECEIPT",
														)
														.map(link => link.linkedCode)
														.filter(Boolean)
														.join(", ") || "Chưa lập phiếu nhập"
												}
											/>
										</td>
										<td className="text-center">
											<input
												type="checkbox"
												disabled
												className="h-4 w-4 accent-emerald-600"
												checked={(order.links || []).some(
													link => link.linkType === "INVENTORY_ISSUE",
												)}
												title={
													(order.links || [])
														.filter(link => link.linkType === "INVENTORY_ISSUE")
														.map(link => link.linkedCode)
														.filter(Boolean)
														.join(", ") || "Chưa lập phiếu xuất"
												}
											/>
										</td> */}
										<td>
											<span
												className={`erp-badge ${statusMeta[order.status as keyof typeof statusMeta]?.css || "bg-slate-100"}`}
											>
												{statusMeta[order.status as keyof typeof statusMeta]
													?.label || order.status}
											</span>
										</td>

										<td>
											<div>Máy: {formatNumber(order.targetSachets || 0)}</div>
											<small>
												Hao: {formatNumber(order.lossPercent || 0)}%
											</small>
										</td>

										<td>
											<TableActions
												actions={[
													{
														key: "view",
														label: "Xem chi tiết",
														icon: <Eye size={15} />,
														onClick: () => setSelected(order),
													},
													{
														key: "duplicate",
														label: "Nhân bản",
														icon: <Copy size={15} />,
														onClick: () => duplicate(order),
													},
													{
														key: "print",
														label: "In lệnh",
														icon: <Printer size={15} />,
														onClick: () => setReportOrder(order),
													},
													{
														key: "confirm",
														label: "Xác nhận sản xuất",
														icon: <Play size={15} />,
														tone: "success",
														hidden: !manage || order.status !== "DRAFT",
														onClick: () => handleConfirmSx(order),
													},
													{
														key: "delete",
														label: "Xóa lệnh",
														icon: <Trash2 size={15} />,
														tone: "danger",
														hidden: !manage || order.status !== "DRAFT",
														onClick: async () => {
															if (await confirm(`Xóa lệnh ${order.code}?`))
																deleteMutation.mutate(order);
														},
													},
													{
														key: "cancel",
														label: "Hủy & Đảo",
														icon: <Undo2 size={15} />,
														tone: "danger",
														hidden: !manage || order.status !== "COMPLETED",
														onClick: async () => {
															const reason = await prompt({
																title: "Hủy lệnh sản xuất",
																message: "Nhập lý do hủy:",
																minLength: 3,
															});
															if (reason)
																cancelMutation.mutate({
																	id: order.id,
																	version: order.version,
																	reason,
																});
														},
													},
												]}
											/>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{editForm && selected && (isDraft || canActual) && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-5xl">
						<div className="erp-modal-header">
							<div>
								<h2>
									Lệnh SX: {selected.code}{" "}
									<span
										className={`erp-badge ${statusMeta[selected.status as keyof typeof statusMeta]?.css || "bg-slate-100"}`}
									>
										{statusMeta[selected.status as keyof typeof statusMeta]
											?.label || selected.status}
									</span>
								</h2>
								<p>
									{isDraft
										? "Bổ sung thông tin mẻ sản xuất"
										: isProgress
											? "Sửa thông tin mẻ (tổng bột, ngày SX/HSD, số lô...) và nhập số lượng thực tế rồi CHỐT"
											: "Nhập số lượng thực tế từng SKU rồi CHỐT (kho lập phiếu nhập theo số chốt)"}
								</p>
							</div>
							<button onClick={() => setEditForm(null)}>
								<X />
							</button>
						</div>
						<form
							onSubmit={e => {
								e.preventDefault();
								handleEditSubmit();
							}}
						>
							<div className="erp-modal-body space-y-5">
								{/* ── Đồng bộ từ lệnh sản xuất ── */}
								<div className="rounded border bg-slate-50 p-4">
									<h4 className="font-semibold mb-3">
										Thông tin từ lệnh sản xuất
									</h4>
									<div className="grid gap-3 md:grid-cols-4">
										<div>
											<small>Mã lệnh</small>
											<b className="block">{selected.code}</b>
										</div>
										<div>
											<small>Ngày tạo lệnh</small>
											<b className="block">
												{selected.orderDate
													? formatDate(selected.orderDate)
													: "—"}
											</b>
										</div>
										<div>
											<small>Thành phẩm</small>
											<b className="block">
												{mainOutput
													? `${mainOutput.packagingName || ""}${mainOutput.sku ? ` (${mainOutput.sku})` : ""}`
													: "—"}
											</b>
										</div>
										<div>
											<small>SL kế hoạch</small>
											<b className="block">{formatNumber(totalPlanned)} gói</b>
										</div>
									</div>
								</div>

								{/* ── Bổ sung thông tin mẻ ── */}
								<div className="rounded border p-4">
									<h4 className="font-semibold mb-3">Thông tin mẻ sản xuất</h4>
									<div className="grid gap-4 md:grid-cols-4">
										<label>
											Mã lệnh{" "}
											<input
												disabled={!canEditBatch}
												value={editForm.code}
												onChange={e =>
													setEditForm({
														...editForm,
														code: e.target.value.toUpperCase(),
													})
												}
												placeholder="LSX00001"
											/>
										</label>
										<label>
											Ngày tạo lệnh{" "}
											<DateInput
												disabled={!canEditBatch}
												value={editForm.orderDate}
												onChange={value =>
													setEditForm({
														...editForm,
														orderDate: value,
													})
												}
											/>
										</label>
										<label>
											Kho SX{" "}
											<select
												required
												disabled={!canEditBatch}
												value={editForm.warehouseId}
												onChange={e =>
													setEditForm({
														...editForm,
														warehouseId: +e.target.value,
													})
												}
											>
												<option value={0}>Chọn kho</option>
												{refs.data?.warehouses.map(w => (
													<option key={w.id} value={w.id}>
														{w.name}
													</option>
												))}
											</select>
										</label>
										<label>
											Số lô{" "}
											<input
												required
												disabled={!canEditBatch}
												value={editForm.batchNumber}
												onChange={e =>
													setEditForm({
														...editForm,
														batchNumber: e.target.value,
													})
												}
												placeholder="CO101026-L01"
											/>
										</label>
										<label>
											Ngày Sản Xuất{" "}
											<DateInput
												disabled={!canEditBatch}
												value={editForm.mfgDate}
												onChange={value => handleMfgDateChange(value)}
											/>
										</label>
										<label>
											Hạn Sử Dụng{" "}
											<DateInput
												disabled={!canEditBatch}
												value={editForm.expDate}
												onChange={value =>
													setEditForm({ ...editForm, expDate: value })
												}
											/>
										</label>
										<label>
											Tổng bột (kg){" "}
											<input
												type="number"
												min="0"
												step="0.001"
												disabled={!canEditBatch}
												value={editForm.totalPowderKg}
												onChange={e =>
													setEditForm({
														...editForm,
														totalPowderKg: +e.target.value,
													})
												}
											/>
										</label>
										<label>
											Số gói máy chạy{" "}
											<input
												type="number"
												min="0"
												step="1"
												disabled={!canEditBatch}
												value={editForm.targetSachets}
												onChange={e =>
													setEditForm({
														...editForm,
														targetSachets: +e.target.value,
													})
												}
											/>
										</label>
										<label>
											% Hao hụt{" "}
											<input
												type="number"
												min="0"
												max="100"
												step="0.01"
												disabled={!canEditBatch}
												value={editForm.lossPercent}
												onChange={e =>
													setEditForm({
														...editForm,
														lossPercent: +e.target.value,
													})
												}
											/>
										</label>
										<label className="md:col-span-3">
											Diễn giải{" "}
											<input
												disabled={!canEditBatch}
												value={editForm.note}
												onChange={e =>
													setEditForm({ ...editForm, note: e.target.value })
												}
												placeholder="Diễn giải lệnh sản xuất..."
											/>
										</label>
									</div>
									{/* Dự kiến sản lượng */}
									<div className="mt-3">
										{netWeightKg > 0 ? (
											<div className="flex flex-wrap items-center gap-2 rounded bg-emerald-50 p-3 text-sm text-emerald-800">
												<span>
													Dự kiến sản lượng:{" "}
													<b>≈ {formatNumber(expectedPacks)} gói</b>
													<span className="text-emerald-600">
														{" "}
														({formatNumber(editForm.totalPowderKg)} kg /{" "}
														{netWeightKg} kg)
													</span>
												</span>
												{canEditBatch && expectedPacks > 0 && (
													<button
														type="button"
														className="erp-btn"
														onClick={() =>
															setEditForm({
																...editForm,
																targetSachets: expectedPacks,
															})
														}
													>
														Dùng số này
													</button>
												)}
											</div>
										) : (
											<div className="flex flex-wrap items-center gap-2 rounded bg-amber-50 p-3 text-sm text-amber-800">
												<AlertCircle size={16} />
												<span>
													Chưa khai báo khối lượng tịnh cho{" "}
													{mainOutput?.sku || "thành phẩm chính"} nên chưa tính
													được dự kiến sản lượng.
												</span>
												<button
													type="button"
													className="erp-btn"
													onClick={() => {
														if (onNavigate) onNavigate("products");
														else window.open("/products", "_blank");
													}}
												>
													Khai báo khối lượng tịnh
												</button>
											</div>
										)}
									</div>
								</div>

								{/* ── Bảng phân bổ SKU ── */}
								<div className="rounded border p-4">
									<div className="mb-3 flex flex-wrap items-center justify-between gap-2">
										<h4 className="font-semibold">Bảng phân bổ thành phẩm</h4>
										{canActual && manage && (
											<div className="flex flex-wrap items-center gap-2">
												<SearchableSelect
													value={pickSku}
													options={pickSkuOptions}
													onChange={setPickSku}
													placeholder="Chọn SKU phân bổ thêm (gõ tên/mã để tìm)"
													className="w-80"
												/>
												<button
													type="button"
													className="erp-btn"
													onClick={handleAddPickSku}
												>
													<Plus size={14} /> Thêm SKU
												</button>
												<button
													type="button"
													className="erp-btn"
													onClick={handleSuggestSkus}
												>
													<Plus size={14} /> Gợi ý SKU cùng mã
												</button>
											</div>
										)}
									</div>
									{!canActual && (
										<p className="mb-2 text-sm text-slate-500">
											Lưu thiết lập rồi xác nhận SX — nhập số thực tế và phân bổ
											SKU sau khi lệnh chạy.
										</p>
									)}
									{/* Thanh tổng cố định: theo lệnh / dự kiến / thực tế */}
									<div className="sticky top-0 z-10 mb-2 flex flex-wrap gap-x-6 gap-y-1 rounded bg-slate-100 p-2 text-sm">
										<span>
											Theo lệnh: <b>{formatNumber(totalPlanned)} gói</b>
										</span>
										<span>
											Dự kiến:{" "}
											<b>
												{expectedPacks > 0
													? `≈ ${formatNumber(expectedPacks)} gói`
													: "—"}
											</b>
										</span>
										<span>
											Thực tế:{" "}
											<b className="text-emerald-700">
												{formatNumber(totalActual)} gói
											</b>
										</span>
									</div>
									<div className="overflow-x-auto">
										<table className="erp-table">
											<thead>
												<tr>
													<th>SKU phân bổ</th>
													<th className="text-right">SL hộp/túi</th>
													<th className="text-right">Thực tế (gói)</th>
													<th>Ghi chú</th>
													{canActual && <th></th>}
												</tr>
											</thead>
											<tbody>
												{(selected.outputs || []).map(d => {
													const editOut = editForm.outputs.find(
														o => o.detailId === d.id,
													) || {
														allocationPercent: 0,
														actualQuantity: 0,
														note: "",
													};
													const pc = packCountOf(
														d.packagingId,
														d.packCount || 1,
													);
													return (
														<tr key={d.id}>
															<td>
																<b>{d.packagingName}</b>
																<small>
																	{d.sku} · {d.unit}
																	{pc > 1 ? ` · ${pc} gói/hộp` : ""}
																</small>
															</td>
															<td>
																<input
																	type="number"
																	min="0"
																	step="any"
																	className="w-28 text-right"
																	disabled={!canActual}
																	value={boxesOf(editOut.actualQuantity, pc)}
																	onChange={e => {
																		const packs = Math.round(
																			(+e.target.value || 0) * pc,
																		);
																		if (editForm)
																			setEditForm({
																				...editForm,
																				outputs: editForm.outputs.map(o =>
																					o.detailId === d.id
																						? { ...o, actualQuantity: packs }
																						: o,
																				),
																			});
																	}}
																/>
															</td>
															<td>
																<input
																	type="number"
																	min="0"
																	step="1"
																	className="w-28 text-right"
																	disabled={!canActual}
																	value={editOut.actualQuantity}
																	onChange={e => {
																		const val = +e.target.value;
																		if (editForm)
																			setEditForm({
																				...editForm,
																				outputs: editForm.outputs.map(o =>
																					o.detailId === d.id
																						? { ...o, actualQuantity: val }
																						: o,
																				),
																			});
																	}}
																/>
															</td>
															<td>
																<input
																	className="w-full"
																	disabled={!canActual}
																	value={editOut.note}
																	onChange={e => {
																		if (editForm)
																			setEditForm({
																				...editForm,
																				outputs: editForm.outputs.map(o =>
																					o.detailId === d.id
																						? { ...o, note: e.target.value }
																						: o,
																				),
																			});
																	}}
																	placeholder="Ghi chú"
																/>
															</td>
															{canActual && <td></td>}
														</tr>
													);
												})}
												{allocRows.map(r => {
													const pc = packCountOf(r.packagingId);
													return (
														<tr
															key={r.packagingId}
															className="bg-emerald-50/50"
														>
															<td>
																<b>{allocPackagingName(r.packagingId)}</b>
																<small>
																	SKU phân bổ thêm
																	{pc > 1 ? ` · ${pc} gói/hộp` : ""}
																</small>
															</td>
															<td>
																<input
																	type="number"
																	min="0"
																	step="any"
																	className="w-28 text-right"
																	value={boxesOf(r.actualQuantity, pc)}
																	onChange={e => {
																		const packs = Math.round(
																			(+e.target.value || 0) * pc,
																		);
																		setAllocRows(rows =>
																			rows.map(x =>
																				x.packagingId === r.packagingId
																					? { ...x, actualQuantity: packs }
																					: x,
																			),
																		);
																	}}
																/>
															</td>
															<td>
																<input
																	type="number"
																	min="0"
																	step="1"
																	className="w-28 text-right"
																	value={r.actualQuantity}
																	onChange={e => {
																		const val = +e.target.value;
																		setAllocRows(rows =>
																			rows.map(x =>
																				x.packagingId === r.packagingId
																					? { ...x, actualQuantity: val }
																					: x,
																			),
																		);
																	}}
																/>
															</td>
															<td>
																<input
																	className="w-full"
																	value={r.note}
																	onChange={e => {
																		setAllocRows(rows =>
																			rows.map(x =>
																				x.packagingId === r.packagingId
																					? { ...x, note: e.target.value }
																					: x,
																			),
																		);
																	}}
																	placeholder="Ghi chú"
																/>
															</td>
															<td>
																<button
																	type="button"
																	className="erp-icon-btn text-red-500"
																	onClick={() =>
																		setAllocRows(rows =>
																			rows.filter(
																				x => x.packagingId !== r.packagingId,
																			),
																		)
																	}
																	title="Bỏ dòng"
																>
																	<X size={14} />
																</button>
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								</div>
							</div>
							<div className="erp-modal-footer">
								<button
									type="button"
									className="erp-btn"
									onClick={() => setEditForm(null)}
								>
									Hủy
								</button>
								{isDraft && manage && (
									<>
										<button
											type="button"
											className="erp-btn erp-btn-primary"
											onClick={() => selected && handleConfirmSx(selected)}
											disabled={confirmMutation.isPending}
										>
											<Play size={15} />{" "}
											{confirmMutation.isPending
												? "Đang xác nhận..."
												: "Xác nhận SX"}
										</button>
										<button
											type="submit"
											className="erp-btn erp-btn-primary"
											disabled={updateMutation.isPending}
										>
											{updateMutation.isPending
												? "Đang lưu..."
												: "Lưu thiết lập"}
										</button>
									</>
								)}
								{isProgress && manage && (
									<button
										type="submit"
										className="erp-btn erp-btn-primary"
										disabled={updateMutation.isPending}
									>
										<Save size={15} />{" "}
										{updateMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
									</button>
								)}
								{canActual && manage && (
									<button
										type="button"
										className="erp-btn erp-btn-post"
										onClick={handleChot}
										disabled={completeMutation.isPending || totalActual <= 0}
									>
										<Lock size={15} />{" "}
										{completeMutation.isPending
											? "Đang chốt..."
											: isCompleted
												? "CHỐT lại"
												: "CHỐT hoàn thành"}
									</button>
								)}
							</div>
						</form>
					</div>
				</div>
			)}

			{selected && !editForm && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-5xl">
						<div className="erp-modal-header">
							<div>
								<h2>{selected.code}</h2>
								<p>
									{getWarehouseName(selected.warehouseId)} ·{" "}
									{
										statusMeta[selected.status as keyof typeof statusMeta]
											?.label
									}
								</p>
							</div>
							<button onClick={() => setSelected(null)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							<div className="grid gap-3 md:grid-cols-4">
								<div>
									<small>Số lô</small>
									<b className="block">{selected.batchNumber || "—"}</b>
								</div>
								<div>
									<small>Ngày SX</small>
									<b className="block">
										{selected.mfgDate ? formatDate(selected.mfgDate) : "—"}
									</b>
								</div>
								<div>
									<small>Hạn SD</small>
									<b className="block">
										{selected.expDate ? formatDate(selected.expDate) : "—"}
									</b>
								</div>
								<div>
									<small>Tổng bột / Máy chạy / Hao%</small>
									<b className="block">
										{formatNumber(selected.totalPowderKg || 0)} kg /{" "}
										{formatNumber(selected.targetSachets || 0)} /{" "}
										{formatNumber(selected.lossPercent || 0)}%
									</b>
								</div>
							</div>

							<div className="overflow-x-auto">
								<table className="erp-table">
									<thead>
										<tr>
											<th>Thành phẩm</th>
											<th>Kế hoạch</th>
											<th>Phân bổ %</th>
											<th>Thực tế</th>
											<th>Đơn giá vốn</th>
											<th>Thành tiền</th>
										</tr>
									</thead>
									<tbody>
										{(selected.outputs || []).map(d => (
											<tr key={d.id}>
												<td>
													<b>{d.packagingName}</b>
													<small>{d.sku}</small>
												</td>
												<td>
													{formatNumber(d.plannedQuantity)} {d.unit}
												</td>
												<td>{formatNumber(d.allocationPercent || 0)}%</td>
												<td>
													{formatNumber(d.actualQuantity || 0)} {d.unit}
												</td>
												<td>{formatNumber(d.unitCost || 0)}</td>
												<td>{formatNumber(d.totalValue || 0)}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{selected.links?.length ? (
								<div className="rounded bg-slate-50 p-3">
									<b>Phiếu kho liên kết</b>
									<div className="mt-2 flex flex-wrap gap-2">
										{selected.links.map(link => (
											<button
												key={link.id}
												type="button"
												className="erp-badge bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer"
												onClick={() => {
													if (link.linkedCode) {
														const tab =
															link.linkType === "INVENTORY_ISSUE"
																? "inventory-export"
																: "inventory-import";
														window.open(
															`/${tab}?code=${encodeURIComponent(link.linkedCode)}`,
															"_blank",
														);
													}
												}}
											>
												{link.linkType === "INVENTORY_ISSUE"
													? "Phiếu xuất"
													: link.linkType === "INVENTORY_RECEIPT"
														? "Phiếu nhập"
														: link.linkType}
												: {link.linkedCode || link.linkedId}
											</button>
										))}
									</div>
								</div>
							) : null}
						</div>
						<div className="erp-modal-footer">
							{/* {selected.links.some(
								(l: any) => l.linkType === "INVENTORY_ISSUE",
							) && (
								<button
									className="erp-btn"
									onClick={() => syncMaterialsMutation.mutate(selected.id)}
									disabled={syncMaterialsMutation.isPending}
								>
									{syncMaterialsMutation.isPending
										? "Đang đồng bộ..."
										: "Đồng bộ NVL từ phiếu xuất"}
								</button>
							)} */}
							{(selected.status === "DRAFT" ||
								selected.status === "IN_PROGRESS" ||
								selected.status === "COMPLETED") &&
								manage && (
									<button
										className="erp-btn erp-btn-primary"
										title={
											selected.status === "DRAFT"
												? "Sửa lệnh"
												: "Cập nhật số lượng thực tế và chốt lệnh"
										}
										onClick={() => openEdit(selected)}
									>
										<Edit size={15} />{" "}
										{selected.status === "DRAFT"
											? "Bổ sung thông tin"
											: selected.status === "COMPLETED"
												? "Bổ sung & chốt lại"
												: "Nhập thực tế & chốt"}
									</button>
								)}
							{selected.status === "DRAFT" && manage && (
								<button
									className="erp-btn erp-btn-post"
									onClick={() => handleConfirmSx(selected)}
									disabled={confirmMutation.isPending}
								>
									<Play size={15} /> Lưu
								</button>
							)}
							{["IN_PROGRESS", "COMPLETED"].includes(selected.status) &&
								manage && (
									<button
										className="erp-btn erp-btn-unpost"
										disabled={unpostMutation.isPending}
										onClick={async () => {
											if (
												await confirm(
													`Hủy lưu lệnh ${selected.code}? Lệnh sẽ trở về nháp để chỉnh sửa.`,
												)
											)
												unpostMutation.mutate({
													id: selected.id,
													version: selected.version,
												});
										}}
									>
										<Undo2 size={15} /> Hủy lưu
									</button>
								)}
							<button
								className="erp-btn"
								onClick={() => setReportOrder(selected)}
							>
								<Printer size={16} /> In lệnh
							</button>
							<button className="erp-btn" onClick={() => setSelected(null)}>
								Đóng
							</button>
						</div>
					</div>
				</div>
			)}

			{reportOrder && (
				<div className="sales-print-view fixed inset-0 z-[9999] flex flex-col bg-gray-900/90 backdrop-blur-md">
					<div className="bg-white border-b p-4 flex items-center justify-between no-print shadow-md">
						<div className="flex items-center gap-4">
							<h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
								Báo cáo chốt thành phẩm
							</h3>
							<span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-500">
								{reportOrder.code}
							</span>
						</div>
						<div className="flex items-center gap-3">
							<button
								onClick={() => setReportOrder(null)}
								className="px-6 py-2 border rounded-lg font-black text-gray-500 hover:bg-gray-50 transition-all uppercase text-[10px] tracking-widest"
							>
								Đóng
							</button>
							<button
								onClick={handlePrintReport}
								className="erp-btn erp-btn-primary !px-6 uppercase tracking-widest text-[10px]"
							>
								<Printer size={16} /> In
							</button>
						</div>
					</div>
					<div className="flex-1 overflow-auto p-8 bg-gray-200/50">
						<div
							ref={reportRef}
							className="sales-print-view shadow-2xl bg-white mx-auto mb-8 w-[210mm] max-w-full"
						>
							<ProductionDocument
								order={reportOrder}
								company={companyQuery.data}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
