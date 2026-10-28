import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import {
	CheckCircle2,
	Copy,
	Edit,
	Eye,
	Factory,
	FileSpreadsheet,
	Play,
	Plus,
	Printer,
	Search,
	Trash2,
	Undo2,
	X,
} from "lucide-react";
import toast from "../components/ui/toast";
import { confirm, prompt } from "../components/ui/confirm";
import { apiV1, legacyApi } from "../lib/apiV1";
import SearchableSelect from "../components/SearchableSelect";
import NumberInput from "../components/NumberInput";
import { ProductionOrderDocument } from "../components/ProductionOrderDocument";
import { formatDate, formatInteger, formatNumber } from "../lib/utils";
import { buildCompanyPrintProfile } from "../lib/printTemplate";
import {
	finishedGoodsWarehouseId,
	materialWarehouseId as findMaterialWarehouseId,
} from "../lib/warehouse-defaults";
import type { Product, ProductionOrderV1, User, Warehouse } from "../types";
import { useMultiEscapeKey } from "../hooks/useEscapeKey";
import { DateInput } from "../components/DateRangeCalendar";
import TableActions from "../components/TableActions";
import DetailOptionsMenu from "../components/DetailOptionsMenu";
import ListToolbar from "../components/ListToolbar";
import type { FilterField, FilterValues } from "../components/FilterDrawer";
import { exportExcelFile } from "../lib/excelExport";

interface OrderLine {
	packagingId: number;
	plannedQuantity: number;
	note: string;
}
interface BomPreview {
	packagingId: number;
	sku?: string;
	productName?: string;
	packagingName?: string;
	unit?: string;
	quantity: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const addMonths = (dateStr: string, months: number) => {
	const d = new Date(dateStr);
	if (isNaN(d.getTime())) return dateStr;
	d.setMonth(d.getMonth() + months);
	return d.toISOString().slice(0, 10);
};
// Dòng tạo lúc lập lệnh (plannedQuantity > 0). Dòng phân bổ thêm khi CHỐT
// (plannedQuantity = 0) chỉ thuộc trang Quản lý SX — ẩn khỏi trang Lệnh SX.
const baseOutputs = (order: ProductionOrderV1) =>
	(order.outputs || []).filter(x => Number(x.plannedQuantity || 0) > 0);
// Đổi giá trị giữa 2 đơn vị metric (g<->kg, ml<->l); khác hệ hoặc không đổi được thì giữ nguyên
const convertUnitValue = (
	value: number,
	fromUnit: string,
	toUnit: string,
): number => {
	const normalize = (u: string) =>
		(u || "").toLowerCase().replace(/[^a-z]/g, "");
	const from = normalize(fromUnit);
	const to = normalize(toUnit);
	if (!from || !to || from === to) return value;
	// Mass units: g, gram, gr <-> kg, kilogram, kilo
	const massFrom = ["g", "gram", "gr"].includes(from);
	const massTo = ["g", "gram", "gr"].includes(to);
	const kgFrom = ["kg", "kilogram", "kilo"].includes(from);
	const kgTo = ["kg", "kilogram", "kilo"].includes(to);
	// Volume units: ml <-> l
	const mlFrom = ["ml", "mililit"].includes(from);
	const mlTo = ["ml", "mililit"].includes(to);
	const lFrom = ["l", "lit", "liter"].includes(from);
	const lTo = ["l", "lit", "liter"].includes(to);
	if (massFrom && kgTo) return value / 1000;
	if (kgFrom && massTo) return value * 1000;
	if (mlFrom && lTo) return value / 1000;
	if (lFrom && mlTo) return value * 1000;
	return value;
};
const documentStatusMeta = {
	DRAFT: ["Nháp", "bg-slate-100 text-slate-700"],
	WAITING_RECEIPT: ["Chưa lập phiếu nhập", "bg-amber-100 text-amber-700"],
	FULL: ["Đã lập đủ phiếu", "bg-emerald-100 text-emerald-700"],
	CANCELLED: ["Đã hủy", "bg-red-100 text-red-700"],
} as const;
type DocumentStatusKey = keyof typeof documentStatusMeta;
const documentStatusOf = (order: ProductionOrderV1): DocumentStatusKey =>
	order.status === "CANCELLED" ? "CANCELLED" : order.documentStatus || "DRAFT";

const PRODUCTION_FILTER_FIELDS: FilterField[] = [
	{
		type: "select",
		key: "status",
		label: "Trạng thái",
		options: Object.entries(documentStatusMeta).map(([value, meta]) => ({
			value,
			label: meta[0],
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

export default function Production({
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
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState<ProductionOrderV1 | null>(null);
	const [selected, setSelected] = useState<ProductionOrderV1 | null>(null);
	const [reportOrder, setReportOrder] = useState<ProductionOrderV1 | null>(
		null,
	);
	const reportRef = useRef<HTMLDivElement>(null);
	const handlePrintReport = useReactToPrint({
		contentRef: reportRef,
		documentTitle: reportOrder
			? `Phieu-lenh-${reportOrder.code}`
			: "Phieu-lenh-san-xuat",
		// Lề 0 để trình duyệt ẩn header/footer (địa chỉ web, số trang) trên giấy in
		pageStyle: "@page { size: A4; margin: 0; }",
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

	useMultiEscapeKey([
		{ isOpen: open, onClose: () => setOpen(false), priority: 1 },
		{ isOpen: !!editing, onClose: () => setEditing(null), priority: 2 },
		{ isOpen: !!selected, onClose: () => setSelected(null), priority: 3 },
		{ isOpen: !!reportOrder, onClose: () => setReportOrder(null), priority: 4 },
	]);

	const [code, setCode] = useState("");
	const [note, setNote] = useState("");
	// Số lô giữ nguyên khi sửa nháp; lệnh mới để trống, bổ sung ở Quản lý SX
	const [batchNumber, setBatchNumber] = useState("");
	const [orderDate, setOrderDate] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [lines, setLines] = useState<OrderLine[]>([
		{ packagingId: 0, plannedQuantity: 1, note: "" },
	]);

	const refs = useQuery({
		queryKey: ["production-refs"],
		queryFn: async () => {
			const [warehouses, products, costPrices] = await Promise.all([
				legacyApi<Warehouse[]>("/api/warehouses"),
				legacyApi<Product[]>("/api/products"),
				apiV1<Array<{ packagingId: number; price: number }>>(
					"/api/v1/catalog/packaging-cost-prices",
				)
					.then(r => r.data || [])
					.catch(() => []),
			]);
			const costMap = new Map<number, number>();
			for (const row of costPrices as Array<{
				packagingId: number;
				price: number;
			}>) {
				costMap.set(row.packagingId, Number(row.price || 0));
			}
			return { warehouses, products, costMap };
		},
	});
	const docs = useQuery({
		queryKey: ["production-v1", filters.dateFrom, filters.dateTo, search],
		queryFn: () => {
			const params = new URLSearchParams({ page: "1", limit: "100" });
			if (search) params.set("search", search);
			if (filters.dateFrom) params.set("from", filters.dateFrom);
			if (filters.dateTo) params.set("to", filters.dateTo);
			return apiV1<ProductionOrderV1[]>(
				`/api/v1/production-orders?${params.toString()}`,
			);
		},
	});
	const rows = useMemo(
		() =>
			(docs.data?.data || []).filter(
				order => !status || documentStatusOf(order) === status,
			),
		[docs.data, status],
	);
	const exportProductionList = () =>
		exportExcelFile(
			"lenh-san-xuat.xlsx",
			"Lenh san xuat",
			[
				{ header: "Mã lệnh", value: (row: ProductionOrderV1) => row.code },
				{ header: "Ngày", value: (row: ProductionOrderV1) => row.orderDate },
				{
					header: "Diễn giải",
					value: (row: ProductionOrderV1) => row.note || "",
					width: 36,
				},
				{
					header: "Thành phẩm",
					value: (row: ProductionOrderV1) =>
						baseOutputs(row)
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
						documentStatusMeta[documentStatusOf(row)]?.[0] ||
						documentStatusOf(row),
				},
			],
			rows,
		);
	const nextCode = useQuery({
		queryKey: ["next-code-production"],
		queryFn: async () => {
			const response = await apiV1<{ code: string }>(
				"/api/v1/next-code/production",
			);
			return response.data?.code || "LSX00001";
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
	// Mã thành phẩm cho lệnh SX: chỉ những sản phẩm được đánh dấu "Sản xuất được"
	// trong danh mục vật tư; gồm mọi quy cách (gói lẻ và hộp/túi đóng gói).
	const productSearchOptions = useMemo(
		() =>
			packagingOptions
				.filter(item => item.canBeProduced)
				.map(item => ({
					value: item.id,
					label: item.productName,
					subLabel:
						(item.name !== item.productName ? `${item.name}` : "") +
						(item.sku ? ` | SKU: ${item.sku}` : "") +
						(item.unit ? ` | ${item.unit}` : ""),
				})),
		[packagingOptions],
	);

	const bomDetails = useQuery({
		queryKey: [
			"production-bom-preview",
			lines
				.map(line => `${line.packagingId}:${line.plannedQuantity}`)
				.join("|"),
		],
		queryFn: async () => {
			const activeLines = lines.filter(
				line => line.packagingId > 0 && line.plannedQuantity > 0,
			);
			if (!activeLines.length) return [] as BomPreview[];
			// Gộp theo (nguyên liệu + ĐVT định mức) để hiển thị đúng ĐVT đã thiết lập,
			// không trộn số lượng khác đơn vị vào nhau
			const aggregated = new Map<string, BomPreview>();
			await Promise.all(
				activeLines.map(async line => {
					const response = await apiV1<
						Array<{
							materialPackagingId: number;
							quantity: number;
							unit: string;
							materialName?: string;
							materialSku?: string;
							materialUnit?: string;
						}>
					>(`/api/v1/catalog/product-boms/${line.packagingId}`).catch(() => ({
						data: [] as Array<{
							materialPackagingId: number;
							quantity: number;
							unit: string;
							materialName?: string;
							materialSku?: string;
							materialUnit?: string;
						}>,
					}));
					for (const bom of response.data || []) {
						const key = `${bom.materialPackagingId}||${bom.unit}`;
						const current = aggregated.get(key) || {
							packagingId: bom.materialPackagingId,
							sku: bom.materialSku,
							productName: bom.materialName,
							packagingName: "",
							unit: bom.unit,
							quantity: 0,
						};
						current.quantity +=
							Number(bom.quantity || 0) * Number(line.plannedQuantity || 0);
						aggregated.set(key, current);
					}
				}),
			);
			return [...aggregated.values()];
		},
	});
	const bomPreview = useMemo(() => {
		const costMap = refs.data?.costMap || new Map<number, number>();
		const pkgMap = new Map<number, { unit: string }>();
		(refs.data?.products || [])
			.flatMap(p => p.packagings || [])
			.forEach(pkg => {
				pkgMap.set(pkg.id, { unit: pkg.unit || "" });
			});
		// Simple metric unit conversion to base unit
		const convertToBaseUnit = (
			value: number,
			fromUnit: string,
			toUnit: string,
		): number => {
			const normalize = (u: string) => u.toLowerCase().replace(/[^a-z]/g, "");
			const from = normalize(fromUnit);
			const to = normalize(toUnit);
			if (from === to) return value;
			// Mass units: g, gram, gr -> base gram; kg, kilogram, kilo -> base kilogram
			const massFrom = ["g", "gram", "gr"].includes(from);
			const massTo = ["g", "gram", "gr"].includes(to);
			const kgFrom = ["kg", "kilogram", "kilo"].includes(from);
			const kgTo = ["kg", "kilogram", "kilo"].includes(to);
			// Volume units: ml, mililit, mililit -> base mililiter; l, lit, liter -> base liter
			const mlFrom = ["ml", "mililit", "mililít"].includes(from);
			const mlTo = ["ml", "mililit", "mililít"].includes(to);
			const lFrom = ["l", "lit", "liter", "lít"].includes(from);
			const lTo = ["l", "lit", "liter", "lít"].includes(to);
			// g <-> kg conversion
			if (massFrom && kgTo) return value / 1000;
			if (kgFrom && massTo) return value * 1000;
			// ml <-> l conversion
			if (mlFrom && lTo) return value / 1000;
			if (lFrom && mlTo) return value * 1000;
			return value; // fallback: no conversion
		};
		// Hiển thị đúng số lượng + ĐVT đã thiết lập trong định mức (VD: 500 g).
		// Đơn giá vốn lưu theo ĐVT của quy cách nên phải đổi sang ĐVT định mức
		// để thành tiền vẫn đúng (VD: 50.000đ/kg -> 50đ/g).
		return (bomDetails.data || []).map(row => {
			const pkgUnit = pkgMap.get(row.packagingId)?.unit || row.unit;
			const bomUnit = row.unit;
			const baseCost = costMap.get(row.packagingId) || 0;
			const unitCost = baseCost * convertToBaseUnit(1, bomUnit, pkgUnit);
			return {
				...row,
				unit: bomUnit,
				quantity: row.quantity,
				unitCost,
			};
		});
	}, [bomDetails.data, refs.data]);

	const invalidate = () =>
		Promise.all([
			qc.invalidateQueries({ queryKey: ["production-v1"] }),
			qc.invalidateQueries({ queryKey: ["next-code-production"] }),
			qc.invalidateQueries({ queryKey: ["inventory-balances-v1"] }),
		]);

	const save = useMutation({
		mutationFn: () => {
			if (!warehouseId) {
				throw Error("Chưa có kho khả dụng để lập lệnh sản xuất");
			}
			if (lines.some(line => !line.packagingId || line.plannedQuantity <= 0)) {
				throw Error("Nhập đủ mã thành phẩm, số lượng");
			}
			const mainPkg = packagingOptions.find(
				p => p.id === lines[0]?.packagingId,
			);
			const mfgDate = editing?.mfgDate || orderDate;
			const expDate =
				editing?.expDate ||
				addMonths(orderDate, mainPkg?.shelfLifeMonths ?? 24);
			const payload = {
				code: code || undefined,
				orderDate,
				mfgDate,
				expDate,
				warehouseId,
				batchNumber: editing ? batchNumber : "",
				totalPowderKg: 0,
				targetSachets: 0,
				lossPercent: 0,
				note,
				outputs: lines.map(line => ({
					packagingId: line.packagingId,
					plannedQuantity: line.plannedQuantity,
					allocationPercent: 0,
					note: line.note || "",
				})),
			};
			return editing
				? apiV1<ProductionOrderV1>(`/api/v1/production-orders/${editing.id}`, {
						method: "PUT",
						body: JSON.stringify({ ...payload, version: editing.version }),
					})
				: apiV1<ProductionOrderV1>("/api/v1/production-orders", {
						method: "POST",
						body: JSON.stringify(payload),
					});
		},
		onSuccess: r => {
			toast.success(r.message);
			setSelected(r.data);
			setOpen(false);
			void invalidate();
		},
		onError: (e: any) => {
			const detail = e?.fieldErrors
				? Object.entries(e.fieldErrors)
						.map(
							([field, messages]) =>
								`${field}: ${(messages as string[]).join(", ")}`,
						)
						.join("; ")
				: "";
			toast.error([e.message, detail].filter(Boolean).join("\n"));
		},
	});

	const action = useMutation({
		mutationFn: ({
			d,
			a,
			reason,
			completionData,
		}: {
			d: ProductionOrderV1;
			a: "confirm" | "complete" | "cancel" | "unpost";
			reason?: string;
			completionData?: {
				outputs: Array<{
					detailId: number;
					allocationPercent?: number;
					actualQuantity?: number;
					note?: string;
				}>;
				materials?: Array<{ materialId: number; actualQuantity: number }>;
			};
		}) => {
			const endpoint =
				a === "confirm"
					? "confirm"
					: a === "complete"
						? "complete"
						: a === "unpost"
							? "unpost"
							: "cancel";
			const body: any = { version: d.version };
			if (a === "cancel") body.reason = reason;
			if (a === "confirm") body.outputs = completionData?.outputs;
			if (a === "complete")
				((body.outputs = completionData?.outputs),
					(body.materials = completionData?.materials || []));
			return apiV1<ProductionOrderV1>(
				`/api/v1/production-orders/${d.id}/${endpoint}`,
				{
					method: "POST",
					body: JSON.stringify(body),
				},
			);
		},
		onSuccess: r => {
			toast.success(r.message);
			setSelected(r.data);
			void invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const deleteMutation = useMutation({
		mutationFn: (order: ProductionOrderV1) =>
			apiV1(`/api/v1/production-orders/${order.id}/delete`, {
				method: "POST",
				body: JSON.stringify({ version: order.version }),
			}),
		onSuccess: () => {
			toast.success("Đã xóa lệnh sản xuất");
			void invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const openInventoryDraft = (
		order: ProductionOrderV1,
		type: "IMPORT" | "EXPORT",
	) => {
		// Phiếu nhập thành phẩm lấy đúng số lượng thực tế đã chốt bên Quản lý sản xuất.
		// Lệnh đã chốt có thể phát sinh dòng bổ sung (plannedQuantity = 0) nên không dùng baseOutputs.
		const hasActual = order.outputs.some(
			o => Number(o.actualQuantity || 0) > 0,
		);
		const details =
			type === "EXPORT"
				? order.materials
				: hasActual
					? order.outputs.filter(o => Number(o.actualQuantity || 0) > 0)
					: baseOutputs(order);
		if (!details.length) {
			toast.error("Lệnh chưa có dòng để lập phiếu");
			return;
		}
		const costMap = refs.data?.costMap || new Map<number, number>();
		// Phiếu xuất NVL: mặc định chọn kho nguyên liệu (nếu có), ngược lại lấy kho của lệnh
		const materialWarehouseId = findMaterialWarehouseId(refs.data?.warehouses);
		const draft = {
			productionOrderId: order.id,
			productionOrderCode: order.code,
			fromProduction: true,
			initialType: type,
			form: {
				type,
				transactionDate: today(),
				warehouseId:
					type === "EXPORT"
						? materialWarehouseId || order.warehouseId
						: order.warehouseId,
				recipient: type === "EXPORT" ? "Tổ sản xuất" : "Kho thành phẩm",
				reason:
					type === "EXPORT" ? "Xuất NVL sản xuất" : "Nhập thành phẩm sản xuất",
				note:
					type === "EXPORT"
						? `Xuất NVL cho ${order.code}`
						: `Nhập thành phẩm ${order.code}`,
			},
			// NVL lưu theo ĐVT định mức (VD: gram) nhưng phiếu kho tính theo ĐVT quy cách (VD: kg).
			// Phải đổi đơn vị trước khi xuất, nếu không tồn kho trừ sai và thành tiền (gram x đơn giá/kg) phình rất lớn.
			lines: details.map(item => {
				const itemBomUnit = (item as any).bomUnit || (item as any).unit || "";
				const itemPkgUnit =
					packagingOptions.find(p => p.id === item.packagingId)?.unit ||
					(item as any).unit ||
					itemBomUnit;
				const actualQuantity = Number((item as any).actualQuantity || 0);
				const sourceQuantity =
					type === "IMPORT" && actualQuantity > 0
						? actualQuantity
						: Number(item.plannedQuantity || 0);
				const quantity =
					type === "EXPORT" && itemBomUnit && itemPkgUnit
						? convertUnitValue(sourceQuantity, itemBomUnit, itemPkgUnit)
						: sourceQuantity;
				return {
					packagingId: item.packagingId,
					quantity: Number(quantity.toFixed(3)),
					unitCost: Number(item.unitCost || costMap.get(item.packagingId) || 0),
					note: order.code,
				};
			}),
		};
		sessionStorage.setItem("inventory-production-draft", JSON.stringify(draft));
		if (onNavigate) {
			onNavigate(type === "EXPORT" ? "inventory-export" : "inventory-import");
		} else {
			window.open(
				type === "EXPORT"
					? "/inventory-export?productionDraft=1"
					: "/inventory-import?productionDraft=1",
				"_blank",
			);
		}
		toast.success(
			type === "EXPORT"
				? "Đã mở phiếu xuất NVL nháp, chỉnh số lượng rồi lưu để trừ kho"
				: "Đã mở phiếu nhập thành phẩm nháp với số lượng thực tế đã chốt, kho xác nhận và lưu",
		);
	};

	const createIssueDraft = (order: ProductionOrderV1) =>
		openInventoryDraft(order, "EXPORT");
	const createReceiptDraft = (order: ProductionOrderV1) =>
		openInventoryDraft(order, "IMPORT");

	// Kho mặc định cho lệnh mới: ưu tiên kho thành phẩm, nếu không có thì lấy kho đầu tiên
	const defaultWarehouseId = () =>
		finishedGoodsWarehouseId(refs.data?.warehouses);
	const create = () => {
		setEditing(null);
		setCode(nextCode.data || "LSX00001");
		setNote("");
		setBatchNumber("");
		setOrderDate(today());
		setWarehouseId(defaultWarehouseId());
		setLines([{ packagingId: 0, plannedQuantity: 1, note: "" }]);
		setOpen(true);
	};
	const edit = (d: ProductionOrderV1) => {
		setEditing(d);
		setCode(d.code);
		setNote((d as any).note || "");
		setBatchNumber((d as any).batchNumber || "");
		setOrderDate(d.orderDate);
		setWarehouseId(d.warehouseId);
		setLines(
			d.outputs.map(x => ({
				packagingId: x.packagingId,
				plannedQuantity: x.plannedQuantity,
				note: x.note || "",
			})),
		);
		setOpen(true);
	};
	const duplicate = (d: ProductionOrderV1) => {
		setEditing(null);
		setCode(nextCode.data || "LSX00001");
		setNote((d as any).note || "");
		setBatchNumber((d as any).batchNumber || "");
		setOrderDate(today());
		setWarehouseId(d.warehouseId);
		setLines(
			d.outputs.map(x => ({
				packagingId: x.packagingId,
				plannedQuantity: x.plannedQuantity,
				note: x.note || "",
			})),
		);
		setOpen(true);
	};
	const cancel = async (d: ProductionOrderV1) => {
		const reason = await prompt({
			title: "Hủy lệnh sản xuất",
			message: "Nhập lý do hủy:",
			minLength: 3,
		});
		if (reason) action.mutate({ d, a: "cancel", reason: reason.trim() });
	};
	const handleConfirm = async (d: ProductionOrderV1) => {
		const outputs = d.outputs.map(o => ({
			detailId: o.id,
			allocationPercent:
				o.allocationPercent || (d.outputs.length === 1 ? 100 : 0),
		}));
		const totalAllocation = outputs.reduce(
			(sum, o) => sum + o.allocationPercent,
			0,
		);
		if (totalAllocation > 0 && Math.abs(totalAllocation - 100) > 0.01) {
			toast.error(
				"Tổng % phân bổ phải bằng 100%. Vui lòng mở Sửa để thiết lập phân bổ.",
			);
			return;
		}
		if (totalAllocation === 0) {
			toast.error("Chưa thiết lập % phân bổ. Vui lòng mở Sửa để thiết lập.");
			return;
		}
		if (!(await confirm(`Xác nhận sản xuất ${d.code}?`))) return;
		action.mutate({ d, a: "confirm", completionData: { outputs } });
	};
	const handleComplete = async (d: ProductionOrderV1) => {
		const outputs = d.outputs.map(o => ({
			detailId: o.id,
			actualQuantity: o.actualQuantity || o.plannedQuantity,
			note: o.note || "",
		}));
		const materials = (d.materials || []).map(m => ({
			materialId: Number(m.id),
			actualQuantity: m.actualQuantity || m.plannedQuantity,
		}));
		if (!(await confirm(`Hoàn thành lệnh ${d.code}?`))) return;
		action.mutate({ d, a: "complete", completionData: { outputs, materials } });
	};

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Lệnh sản xuất</h1>
					<p>Quản lý sản xuất, theo dõi tiến độ.</p>
				</div>
				{manage && (
					<button className="erp-btn erp-btn-primary" onClick={create}>
						<Plus size={17} /> Tạo lệnh
					</button>
				)}
			</div>
			<div className="grid gap-4 md:grid-cols-3">
				<div className="erp-stat">
					<Factory />
					<div>
						<span>Tổng lệnh</span>
						<strong>{docs.data?.meta?.total || 0}</strong>
					</div>
				</div>
				<div className="erp-stat">
					<Play />
					<div>
						<span>Chưa lập phiếu nhập</span>
						<strong>
							{
								(docs.data?.data || []).filter(
									x => documentStatusOf(x) === "WAITING_RECEIPT",
								).length
							}
						</strong>
					</div>
				</div>
				<div className="erp-stat">
					<CheckCircle2 />
					<div>
						<span>Đã lập đủ phiếu</span>
						<strong>
							{
								(docs.data?.data || []).filter(
									x => documentStatusOf(x) === "FULL",
								).length
							}
						</strong>
					</div>
				</div>
			</div>
			<div className="erp-card overflow-hidden">
				<ListToolbar
					fields={PRODUCTION_FILTER_FIELDS}
					values={filters}
					onChange={setFilters}
					onExport={exportProductionList}
					exportDisabled={rows.length === 0}
					search={
						<div className="erp-search">
							<Search size={17} />
							<input
								value={search}
								onChange={e => setSearch(e.target.value)}
								placeholder="Tìm mã LSX, diễn giải..."
							/>
						</div>
					}
				/>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Ngày</th>
								<th>Mã lệnh</th>
								<th>Diễn giải</th>
								<th>Thành phẩm</th>
								<th className="text-center">Đã lập đủ PN</th>
								<th className="text-center">Đã lập đủ PX</th>
								{/* <th>Trạng thái</th> */}
								<th>Thao tác</th>
							</tr>
						</thead>
						<tbody>
							{rows.map(d => (
								<tr key={d.id}>
									<td>{formatDate(d.orderDate)}</td>
									<td>
										<button
											className="font-bold text-[#422afb] hover:underline"
											onClick={() => setSelected(d)}
										>
											{d.code}
										</button>
										{/* <small>v{d.version}</small> */}
									</td>
									<td className="max-w-[260px] whitespace-normal text-slate-600">
										{d.note || "—"}
									</td>

									<td>
										{baseOutputs(d).map((x, i) => (
											<div key={i} className="text-sm">
												{x.packagingName || x.sku}
												<small className="text-slate-400">
													{" "}
													×{formatInteger(x.plannedQuantity)} {x.unit}
												</small>
											</div>
										))}
									</td>
									<td className="text-center">
										<input
											type="checkbox"
											disabled
											className="h-4 w-4 accent-emerald-600"
											checked={(d.links || []).some(
												link => link.linkType === "INVENTORY_RECEIPT",
											)}
											title={
												(d.links || [])
													.filter(link => link.linkType === "INVENTORY_RECEIPT")
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
											checked={(d.links || []).some(
												link => link.linkType === "INVENTORY_ISSUE",
											)}
											title={
												(d.links || [])
													.filter(link => link.linkType === "INVENTORY_ISSUE")
													.map(link => link.linkedCode)
													.filter(Boolean)
													.join(", ") || "Chưa lập phiếu xuất"
											}
										/>
									</td>
									{/* <td>
										<span
											className={`erp-badge ${documentStatusMeta[documentStatusOf(d)][1]}`}
										>
											{documentStatusMeta[documentStatusOf(d)][0]}
										</span>
									</td> */}
									<td>
										<TableActions
											actions={[
												{
													key: "view",
													label: "Xem chi tiết",
													icon: <Eye size={15} />,
													onClick: () => setSelected(d),
												},
												{
													key: "duplicate",
													label: "Nhân bản",
													icon: <Copy size={15} />,
													onClick: () => duplicate(d),
												},
												{
													key: "print",
													label: "In lệnh",
													icon: <Printer size={15} />,
													onClick: () => setReportOrder(d),
												},
												{
													key: "confirm",
													label: "Bắt đầu sản xuất",
													icon: <Play size={15} />,
													tone: "warning",
													hidden: !manage || d.status !== "DRAFT",
													onClick: () => handleConfirm(d),
												},
												{
													key: "complete",
													label: "Hoàn thành",
													icon: <CheckCircle2 size={15} />,
													tone: "success",
													hidden: !manage || d.status !== "IN_PROGRESS",
													onClick: () => handleComplete(d),
												},
												{
													key: "cancel",
													label: "Hủy lệnh",
													icon: <Undo2 size={15} />,
													tone: "danger",
													hidden: !manage || d.status !== "DRAFT",
													onClick: () => cancel(d),
												},
												{
													key: "unpost",
													label: "Hủy lưu",
													icon: <Undo2 size={15} />,
													tone: "danger",
													hidden:
														!manage ||
														!["IN_PROGRESS", "COMPLETED"].includes(d.status),
													onClick: async () => {
														if (
															await confirm(
																`Hủy lưu lệnh ${d.code}? Lệnh sẽ trở về nháp để chỉnh sửa.`,
															)
														)
															action.mutate({ d, a: "unpost" });
													},
												},
												{
													key: "delete",
													label: "Xóa lệnh",
													icon: <Trash2 size={15} />,
													tone: "danger",
													hidden:
														!manage ||
														!["DRAFT", "CANCELLED"].includes(d.status),
													onClick: async () => {
														if (await confirm(`Xóa lệnh ${d.code}?`))
															deleteMutation.mutate(d);
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
			</div>

			{open && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal" style={{ width: "min(100%, 88rem)" }}>
						<div className="erp-modal-header">
							<div>
								<h2>{editing ? `Sửa ${editing.code}` : "Tạo lệnh sản xuất"}</h2>
								<p>Tạo chứng từ tạo lệnh sản xuất</p>
							</div>
							<button onClick={() => setOpen(false)}>
								<X />
							</button>
						</div>
						<form
							onSubmit={e => {
								e.preventDefault();
								save.mutate();
							}}
						>
							<div className="erp-modal-body space-y-4">
								<div className="grid gap-4 md:grid-cols-2">
									<label>
										Mã lệnh
										<input
											value={code}
											onChange={e => setCode(e.target.value.toUpperCase())}
											placeholder={nextCode.data || "LSX00001"}
										/>
									</label>
									<label>
										Ngày
										<DateInput
											value={orderDate}
											onChange={value => setOrderDate(value)}
										/>
									</label>
								</div>
								<label>
									Diễn giải
									<textarea
										rows={2}
										value={note}
										onChange={e => setNote(e.target.value)}
										placeholder="Diễn giải lệnh sản xuất..."
									/>
								</label>
								<div className="grid gap-4 lg:grid-cols-3">
									<div className="lg:col-span-2">
										<div className="mb-2 flex items-center justify-between">
											<b>Thành phẩm ({lines.length} mã)</b>
											<button
												type="button"
												className="erp-btn"
												onClick={() =>
													setLines(current => [
														...current,
														{ packagingId: 0, plannedQuantity: 1, note: "" },
													])
												}
											>
												<Plus size={14} /> Thêm dòng
											</button>
										</div>
										<table
											className="erp-table"
											style={{ tableLayout: "fixed", width: "100%" }}
										>
											<colgroup>
												<col style={{ width: "48px" }} />
												<col style={{ width: "170px" }} />
												<col style={{ width: "280px" }} />
												<col style={{ width: "70px" }} />
												<col style={{ width: "120px" }} />
												<col style={{ width: "48px" }} />
											</colgroup>
											<thead>
												<tr>
													<th className="text-center">STT</th>
													<th>Mã thành phẩm</th>
													<th>Tên thành phẩm</th>
													<th>ĐVT</th>
													<th className="text-right">Số lượng</th>
													<th></th>
												</tr>
											</thead>
											<tbody>
												{lines.map((line, index) => {
													const item = packagingOptions.find(
														x => x.id === line.packagingId,
													);
													return (
														<tr key={index}>
															<td className="text-center">{index + 1}</td>
															<td>
																<SearchableSelect
																	value={line.packagingId}
																	options={productSearchOptions}
																	onChange={packagingId =>
																		setLines(current =>
																			current.map((l, i) =>
																				i === index ? { ...l, packagingId } : l,
																			),
																		)
																	}
																	placeholder="Mã"
																	required
																/>
															</td>
															<td className="font-medium text-slate-700">
																{item ? (
																	`${item.name}`
																) : (
																	<span className="text-slate-400">
																		Chưa chọn
																	</span>
																)}
															</td>
															<td>{item?.unit || ""}</td>
															<td>
																<NumberInput
																	value={line.plannedQuantity}
																	onChange={v =>
																		setLines(current =>
																			current.map((l, i) =>
																				i === index
																					? { ...l, plannedQuantity: v }
																					: l,
																			),
																		)
																	}
																	min={1}
																	integerOnly
																/>
															</td>
															<td>
																<button
																	type="button"
																	className="erp-icon-btn text-red-500"
																	onClick={() =>
																		setLines(current =>
																			current.filter((_, i) => i !== index),
																		)
																	}
																>
																	<Trash2 size={15} />
																</button>
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
									<div className="min-w-0">
										<b>Định mức nguyên liệu</b>
										{bomDetails.isLoading ? (
											<p className="mt-2 rounded bg-slate-50 p-3 text-sm text-slate-500">
												Đang tải định mức...
											</p>
										) : !bomPreview.length ? (
											<p className="mt-2 rounded bg-slate-50 p-3 text-sm text-slate-500">
												Chọn thành phẩm có BOM để tự tổng hợp nguyên liệu.
											</p>
										) : (
											<div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
												<table
													className="erp-table mt-2 bom-material-table"
													style={{ tableLayout: "fixed", width: "100%" }}
												>
													<colgroup>
														<col style={{ width: "48px" }} />
														<col style={{ width: "120px" }} />
														<col style={{ minWidth: "200px" }} />
														<col style={{ width: "120px" }} />
														<col style={{ width: "120px" }} />
														<col style={{ width: "120px" }} />
													</colgroup>
													<thead>
														<tr>
															<th className="text-center">STT</th>
															<th className="bom-code-cell">Mã</th>
															<th className="bom-name-cell">Tên nguyên liệu</th>
															<th className="text-right">Số lượng</th>
															<th className="text-right">Đơn giá vốn</th>
															<th className="text-right">Thành tiền</th>
														</tr>
													</thead>
													<tbody>
														{bomPreview.map((row, index) => (
															<tr key={`${row.packagingId}-${row.unit}`}>
																<td className="text-center">{index + 1}</td>
																<td className="bom-code-cell font-mono font-semibold">
																	{row.sku || `PKG-${row.packagingId}`}
																</td>
																<td className="bom-name-cell font-medium text-slate-700">
																	{row.productName || "-"}
																	<small>{row.unit || ""}</small>
																</td>
																<td className="text-right font-semibold">
																	{formatNumber(row.quantity)}
																</td>
																<td className="text-right">
																	{formatNumber(row.unitCost || 0)}
																</td>
																<td className="text-right font-semibold text-emerald-700">
																	{formatNumber(
																		(row.quantity || 0) * (row.unitCost || 0),
																	)}
																</td>
															</tr>
														))}
													</tbody>
												</table>
											</div>
										)}
									</div>
								</div>
							</div>
							<div className="erp-modal-footer">
								<button
									type="button"
									className="erp-btn"
									onClick={() => setOpen(false)}
								>
									Hủy
								</button>
								<button
									disabled={save.isPending}
									className="erp-btn erp-btn-primary"
								>
									{save.isPending ? "Đang lưu..." : "Lưu lệnh"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{selected && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal" style={{ width: "min(100%, 72rem)" }}>
						<div className="erp-modal-header">
							<div>
								<h2>{selected.code}</h2>
								<p>
									{formatDate(selected.orderDate)} ·{" "}
									{(selected as any).note || selected.batchNumber}
								</p>
							</div>
							<button onClick={() => setSelected(null)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							<div className="flex flex-wrap items-center gap-2">
								<span
									className={`erp-badge ${documentStatusMeta[documentStatusOf(selected)][1]}`}
								>
									{documentStatusMeta[documentStatusOf(selected)][0]}
								</span>
								{selected.links.length > 0 && (
									<div className="flex flex-wrap gap-1.5">
										{selected.links.map(x => (
											<button
												key={x.id}
												type="button"
												className="erp-badge bg-blue-100 text-blue-700 hover:bg-blue-200"
												title="Mở phiếu kho liên kết ở tab mới"
												onClick={() => {
													if (x.linkedCode) {
														const tab =
															x.linkType === "INVENTORY_ISSUE"
																? "inventory-export"
																: "inventory-import";
														window.open(
															`/${tab}?code=${encodeURIComponent(x.linkedCode)}`,
															"_blank",
														);
													}
												}}
											>
												{x.linkType === "INVENTORY_ISSUE"
													? "Phiếu xuất"
													: "Phiếu nhập"}
												: {x.linkedCode} ↗
											</button>
										))}
									</div>
								)}
							</div>
							<h3>Thành phẩm</h3>
							<table className="erp-table">
								<thead>
									<tr>
										<th className="w-12 text-center">STT</th>
										<th>Thành phẩm</th>
										<th className="text-right">Số lượng</th>
									</tr>
								</thead>
								<tbody>
									{baseOutputs(selected).map((x, index) => (
										<tr key={x.id} className="font-semibold text-xl">
											<td className="text-center">{index + 1}</td>
											<td>
												{x.sku} - {x.packagingName}
											</td>

											<td className="text-right text-xl">
												{formatInteger(x.plannedQuantity)} {x.unit}
											</td>
										</tr>
									))}
								</tbody>
							</table>
							<h3>Định mức nguyên liệu</h3>
							<table className="erp-table">
								<thead>
									<tr>
										<th className="w-12 text-center">STT</th>
										<th>Nguyên liệu</th>
										<th>ĐVT</th>
										<th className="text-right">Số lượng</th>
										<th className="text-right">Đơn giá vốn</th>
										<th className="text-right">Thành tiền</th>
									</tr>
								</thead>
								<tbody>
									{selected.materials.map((x, index) => {
										const pkg = packagingOptions.find(
											p => p.id === x.packagingId,
										);
										const pkgUnit = pkg?.unit || x.unit;
										const bomUnit = x.bomUnit || x.unit;
										const convertToBaseUnit = (
											value: number,
											fromUnit: string,
											toUnit: string,
										): number => {
											const normalize = (u: string) =>
												u.toLowerCase().replace(/[^a-z]/g, "");
											const from = normalize(fromUnit);
											const to = normalize(toUnit);
											if (from === to) return value;
											// Mass units: g, gram, gr -> base gram; kg, kilogram, kilo -> base kilogram
											const massFrom = ["g", "gram", "gr"].includes(from);
											const massTo = ["g", "gram", "gr"].includes(to);
											const kgFrom = ["kg", "kilogram", "kilo"].includes(from);
											const kgTo = ["kg", "kilogram", "kilo"].includes(to);
											// Volume units: ml, mililit, mililít -> base mililiter; l, lit, liter -> base liter
											const mlFrom = ["ml", "mililit", "mililít"].includes(
												from,
											);
											const mlTo = ["ml", "mililit", "mililít"].includes(to);
											const lFrom = ["l", "lit", "liter", "lít"].includes(from);
											const lTo = ["l", "lit", "liter", "lít"].includes(to);
											// g <-> kg conversion
											if (massFrom && kgTo) return value / 1000;
											if (kgFrom && massTo) return value * 1000;
											// ml <-> l conversion
											if (mlFrom && lTo) return value / 1000;
											if (lFrom && mlTo) return value * 1000;
											return value;
										};
										// Hiển thị đúng ĐVT định mức; đổi đơn giá vốn sang ĐVT đó để thành tiền đúng
										const convertedCost =
											(x.unitCost || 0) *
											convertToBaseUnit(1, bomUnit, pkgUnit);
										return (
											<tr key={x.id}>
												<td className="text-center">{index + 1}</td>
												<td>
													{/* {x.sku} - {x.productName} - {x.packagingName} */}
													{x.sku} - {x.productName}
												</td>
												<td>{bomUnit}</td>
												<td className="text-right">
													{formatNumber(x.plannedQuantity || 0)}
												</td>
												<td className="text-right">
													{formatNumber(convertedCost)}
												</td>
												<td className="text-right font-semibold text-emerald-700">
													{formatNumber(
														(x.plannedQuantity || 0) * convertedCost,
													)}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
							{selected.cancelReason && (
								<div className="rounded bg-red-50 p-3 text-red-700">
									{selected.cancelReason}
								</div>
							)}
						</div>
						<div className="erp-modal-footer">
							{!selected.links.some(
								(l: any) => l.linkType === "INVENTORY_ISSUE",
							) && (
								<button
									type="button"
									className="erp-btn"
									onClick={() => createIssueDraft(selected)}
								>
									<FileSpreadsheet size={15} /> Lập phiếu xuất
								</button>
							)}
							{!selected.links.some(
								(l: any) => l.linkType === "INVENTORY_RECEIPT",
							) && (
								<button
									type="button"
									className="erp-btn"
									onClick={() => createReceiptDraft(selected)}
								>
									<FileSpreadsheet size={15} /> Lập phiếu nhập
								</button>
							)}
							{manage && (
								<button
									type="button"
									className="erp-btn erp-btn-primary"
									disabled={selected.status !== "DRAFT"}
									title={
										selected.status === "DRAFT"
											? "Sửa lệnh"
											: "Lệnh đã lưu — hủy lưu để khôi phục tồn kho trước khi sửa"
									}
									onClick={() => {
										setSelected(null);
										edit(selected);
									}}
								>
									<Edit size={15} /> Sửa lệnh
								</button>
							)}
							{manage &&
								["IN_PROGRESS", "COMPLETED"].includes(selected.status) && (
									<button
										type="button"
										className="erp-btn erp-btn-unpost"
										disabled={action.isPending}
										onClick={async () => {
											if (
												await confirm(
													`Hủy lưu lệnh ${selected.code}? Lệnh sẽ trở về nháp để chỉnh sửa.`,
												)
											)
												action.mutate({ d: selected, a: "unpost" });
										}}
									>
										<Undo2 size={15} /> Hủy lưu
									</button>
								)}
							<DetailOptionsMenu
								actions={[
									{
										key: "print",
										label: "In lệnh",
										icon: <Printer size={15} />,
										onClick: () => setReportOrder(selected),
									},
									{
										key: "duplicate",
										label: "Nhân bản",
										icon: <Copy size={15} />,
										onClick: () => {
											setSelected(null);
											duplicate(selected);
										},
									},
								]}
							/>
							<button
								type="button"
								className="erp-btn"
								onClick={() => setSelected(null)}
							>
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
								Phiếu lệnh sản xuất
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
							<ProductionOrderDocument
								order={reportOrder}
								company={companyQuery.data}
								warehouseName={
									refs.data?.warehouses.find(
										w => w.id === reportOrder.warehouseId,
									)?.name
								}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
