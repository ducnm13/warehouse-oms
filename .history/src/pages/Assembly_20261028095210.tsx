import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Eye, Plus, Printer, Search, Trash2, Undo2 } from "lucide-react";
import toast from "../components/ui/toast";
import { confirm, prompt } from "../components/ui/confirm";
import { apiV1, legacyApi } from "../lib/apiV1";
import SearchableSelect from "../components/SearchableSelect";
import RightDrawer from "../components/RightDrawer";
import DocumentActions from "../components/DocumentActions";
import TableActions from "../components/TableActions";
import ListToolbar from "../components/ListToolbar";
import type { FilterField, FilterValues } from "../components/FilterDrawer";
import { exportExcelFile } from "../lib/excelExport";
import PrintDocumentPreview from "../components/PrintDocumentPreview";
import { AssemblyDocument } from "../components/AssemblyDocument";
import NumberInput from "../components/NumberInput";
import { formatDate, formatNumber, formatProductName } from "../lib/utils";
import { hasPermission } from "../lib/permissions";
import {
	buildCompanyPrintProfile,
	type CompanyPrintProfile,
} from "../lib/printTemplate";
import { DateInput } from "../components/DateRangeCalendar";
import {
	componentWarehouseId,
	finishedGoodsWarehouseId,
} from "../lib/warehouse-defaults";
import type {
	AssemblyOrderV1,
	DisassemblyOrderV1,
	Product,
	User,
	Warehouse,
} from "../types";

type Tab = "ASSEMBLY" | "DISASSEMBLY";
interface OrderLine {
	packagingId: number;
	plannedQuantity: number;
	note: string;
}
interface BomRow {
	packagingId: number;
	sku?: string;
	productName?: string;
	packagingName?: string;
	unit?: string;
	warehouseName?: string;
	quantity: number;
	unitCost: number;
	totalValue: number;
}

const today = () => new Date().toISOString().slice(0, 10);
const badge: Record<string, string> = {
	DRAFT: "bg-slate-100 text-slate-700",
	POSTED: "bg-emerald-100 text-emerald-700",
	COMPLETED: "bg-emerald-100 text-emerald-700",
	CANCELLED: "bg-red-100 text-red-700",
};
const statusLabel: Record<string, string> = {
	DRAFT: "Nháp",
	POSTED: "Hoàn thành",
	COMPLETED: "Hoàn thành",
	CANCELLED: "Đã hủy",
};

const ASSEMBLY_FILTER_FIELDS: FilterField[] = [
	{
		type: "select",
		key: "status",
		label: "Trạng thái",
		options: [
			{ value: "DRAFT", label: "Nháp" },
			{ value: "COMPLETED", label: "Hoàn thành" },
			{ value: "CANCELLED", label: "Đã hủy" },
		],
	},
	{
		type: "dateRange",
		key: "orderDate",
		label: "Ngày lệnh",
		fromKey: "dateFrom",
		toKey: "dateTo",
	},
];

export default function Assembly({ user }: { user: User }) {
	const qc = useQueryClient();
	const manage = hasPermission(user.role, user.permissions, "assembly.manage");
	const [tab, setTab] = useState<Tab>("ASSEMBLY");
	const [search, setSearch] = useState("");
	const [filters, setFilters] = useState<FilterValues>({});
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState<
		AssemblyOrderV1 | DisassemblyOrderV1 | null
	>(null);
	const [selected, setSelected] = useState<any | null>(null);

	const [code, setCode] = useState("");
	const [note, setNote] = useState("");
	const [orderDate, setOrderDate] = useState(today());
	const [lines, setLines] = useState<OrderLine[]>([
		{ packagingId: 0, plannedQuantity: 1, note: "" },
	]);

	const refs = useQuery({
		queryKey: ["assembly-refs-v2"],
		queryFn: async () => {
			const [warehouses, products, costPrices] = await Promise.all([
				legacyApi<Warehouse[]>("/api/warehouses"),
				legacyApi<Product[]>("/api/products?category=PRODUCT"),
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
			}>)
				costMap.set(row.packagingId, Number(row.price || 0));
			return { warehouses, products, costMap };
		},
	});
	const companyQuery = useQuery({
		queryKey: ["company-profile"],
		queryFn: async () => {
			try {
				const response = await apiV1<any>("/api/v1/company");
				return buildCompanyPrintProfile(response.data);
			} catch {
				return null as CompanyPrintProfile | null;
			}
		},
	});
	const orders = useQuery({
		queryKey: ["assembly-orders-v2", tab],
		queryFn: () =>
			apiV1<Array<AssemblyOrderV1 | DisassemblyOrderV1>>(
				`/api/v1/assembly/${tab === "ASSEMBLY" ? "orders" : "disassembly-orders"}?page=1&limit=100`,
			),
	});
	const nextCode = useQuery({
		queryKey: ["next-code", tab],
		queryFn: async () => {
			try {
				const response = await apiV1<{ code: string }>(
					`/api/v1/next-code/${tab === "ASSEMBLY" ? "assembly" : "disassembly"}`,
				);
				return (
					response.data?.code || (tab === "ASSEMBLY" ? "LR00001" : "TD00001")
				);
			} catch {
				return tab === "ASSEMBLY" ? "LR00001" : "TD00001";
			}
		},
	});

	const packagingOptions = useMemo(
		() =>
			(refs.data?.products || []).flatMap(product =>
				(product.packagings || []).map(packaging => ({
					...packaging,
					productName: product.name,
				})),
			),
		[refs.data],
	);
	const productSearchOptions = useMemo(
		() =>
			packagingOptions.map(item => ({
				value: item.id,
				label: item.productName,
				subLabel:
					(item.name !== item.productName ? `${item.name}` : "") +
					(item.sku ? ` | SKU: ${item.sku}` : "") +
					(item.unit ? ` | ${item.unit}` : ""),
			})),
		[packagingOptions],
	);

	const bomRows: BomRow[] = useMemo(() => {
		const costMap = refs.data?.costMap || new Map<number, number>();
		const aggregated = new Map<number, BomRow>();
		const allPackagings = (refs.data?.products || []).flatMap(p =>
			p.packagings.map(pk => ({ product: p, packaging: pk })),
		);
		for (const line of lines) {
			if (!line.packagingId || line.plannedQuantity <= 0) continue;
			const output = allPackagings.find(
				x => x.packaging.id === line.packagingId,
			);
			for (const bom of (output?.packaging as any)?.boms || []) {
				const material = allPackagings.find(
					x => x.packaging.id === bom.materialPackagingId,
				);
				const unitCost = costMap.get(bom.materialPackagingId) || 0;
				const quantity =
					Number(bom.quantity || 0) * Number(line.plannedQuantity || 0);
				const current = aggregated.get(bom.materialPackagingId) || {
					packagingId: bom.materialPackagingId,
					sku: material?.packaging.sku,
					productName: material?.product.name,
					packagingName: material?.packaging.name,
					unit: (bom as any).unit || material?.packaging.unit,
					warehouseName: "",
					quantity: 0,
					unitCost,
					totalValue: 0,
				};
				current.quantity += quantity;
				current.totalValue = current.quantity * unitCost;
				aggregated.set(bom.materialPackagingId, current);
			}
		}
		return [...aggregated.values()];
	}, [lines, refs.data]);

	const totalCost = useMemo(
		() =>
			lines.reduce((sum, line) => {
				const unitCost = refs.data?.costMap.get(line.packagingId) || 0;
				return sum + Number(line.plannedQuantity || 0) * unitCost;
			}, 0),
		[lines, refs.data],
	);
	const invalidate = () =>
		Promise.all([
			qc.invalidateQueries({ queryKey: ["assembly-orders-v2"] }),
			qc.invalidateQueries({ queryKey: ["next-code"] }),
			qc.invalidateQueries({ queryKey: ["inventory-documents-v1"] }),
		]);

	const save = useMutation({
		mutationFn: () => {
			const normalizedLines = lines
				.map(line => ({
					packagingId: Number(line.packagingId || 0),
					plannedQuantity: Number(line.plannedQuantity || 0),
					note: line.note || "",
				}))
				.filter(line => line.packagingId > 0);
			if (
				!normalizedLines.length ||
				normalizedLines.some(line => !(line.plannedQuantity > 0))
			) {
				throw Error(
					"Nhập đủ mã thành phẩm, số lượng lớn hơn 0. Kho sẽ chọn khi lập phiếu xuất/nhập.",
				);
			}
			const componentWarehouse =
				componentWarehouseId(refs.data?.warehouses) || 1;
			const finishedWarehouse =
				finishedGoodsWarehouseId(refs.data?.warehouses) || componentWarehouse;
			const payload = {
				code: code || undefined,
				orderDate,
				note,
				outputs: normalizedLines,
				...(tab === "ASSEMBLY"
					? {
							componentWarehouseId: componentWarehouse,
							outputWarehouseId: finishedWarehouse,
							assemblyCost: 0,
						}
					: {
							sourceWarehouseId: finishedWarehouse,
							recoveryWarehouseId: componentWarehouse,
						}),
			};
			const base =
				tab === "ASSEMBLY"
					? "/api/v1/assembly/orders"
					: "/api/v1/assembly/disassembly-orders";
			return editing
				? apiV1(`${base}/${editing.id}`, {
						method: "PUT",
						body: JSON.stringify({ ...payload, version: editing.version }),
					})
				: apiV1(base, { method: "POST", body: JSON.stringify(payload) });
		},
		onSuccess: (r: any) => {
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

	const cancelOrder = useMutation({
		mutationFn: async (row: AssemblyOrderV1 | DisassemblyOrderV1) => {
			const reason = await prompt({
				title: "Hủy lệnh",
				message: "Nhập lý do hủy:",
				minLength: 3,
			});
			if (!reason) throw Error("Đã bỏ hủy");
			const base =
				tab === "ASSEMBLY"
					? "/api/v1/assembly/orders"
					: "/api/v1/assembly/disassembly-orders";
			return apiV1(`${base}/${row.id}/cancel`, {
				method: "POST",
				body: JSON.stringify({ version: row.version, reason: reason.trim() }),
			});
		},
		onSuccess: (r: any) => {
			toast.success(r.message);
			void invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const deleteOrder = useMutation({
		mutationFn: async (row: AssemblyOrderV1 | DisassemblyOrderV1) => {
			if (
				!(await confirm(
					`Xóa lệnh nháp ${row.code}? Thao tác này không thể hoàn tác.`,
				))
			)
				throw Error("Đã bỏ xóa");
			const base =
				tab === "ASSEMBLY"
					? "/api/v1/assembly/orders"
					: "/api/v1/assembly/disassembly-orders";
			return apiV1(`${base}/${row.id}/delete`, {
				method: "POST",
				body: JSON.stringify({ version: row.version }),
			});
		},
		onSuccess: (r: any) => {
			toast.success(r.message);
			setSelected(null);
			void invalidate();
		},
		onError: (e: Error) => {
			if (e.message !== "Đã bỏ xóa") toast.error(e.message);
		},
	});

	const unpostOrder = useMutation({
		mutationFn: async (row: AssemblyOrderV1 | DisassemblyOrderV1) => {
			if (
				!(await confirm(
					`Hủy lưu lệnh ${row.code}? Tồn kho sẽ được hoàn lại và lệnh trở về nháp.`,
				))
			)
				throw Error("Đã bỏ hủy lưu");
			const base =
				tab === "ASSEMBLY"
					? "/api/v1/assembly/orders"
					: "/api/v1/assembly/disassembly-orders";
			return apiV1(`${base}/${row.id}/unpost`, {
				method: "POST",
				body: JSON.stringify({
					version: row.version,
					reason: "Hủy lưu để chỉnh sửa",
				}),
			});
		},
		onSuccess: (r: any) => {
			toast.success(r.message);
			void invalidate();
		},
		onError: (e: Error) => {
			if (e.message !== "Đã bỏ hủy lưu") toast.error(e.message);
		},
	});

	const create = () => {
		setEditing(null);
		setCode(nextCode.data || (tab === "ASSEMBLY" ? "LR00001" : "TD00001"));
		setNote("");
		setOrderDate(today());
		setLines([{ packagingId: 0, plannedQuantity: 1, note: "" }]);
		setOpen(true);
	};

	const [voucherDraft, setVoucherDraft] = useState<null | {
		order: any;
		type: "IMPORT" | "EXPORT";
		warehouseId: number;
		lines: Array<{
			packagingId: number;
			sku?: string;
			productName?: string;
			packagingName?: string;
			unit?: string;
			quantity: number;
			unitCost: number;
		}>;
	}>(null);

	const openDraft = (
		order: any,
		type: "IMPORT" | "EXPORT",
		detailLines: Array<{ packagingId: number; quantity: number }>,
	) => {
		const enriched = detailLines
			.map(line => {
				const item = packagingOptions.find(x => x.id === line.packagingId);
				return {
					packagingId: line.packagingId,
					sku: item?.sku,
					productName: item?.productName,
					packagingName: item?.name,
					unit: item?.unit,
					quantity: Number(Number(line.quantity || 0).toFixed(3)),
					unitCost: refs.data?.costMap.get(line.packagingId) || 0,
				};
			})
			.filter(line => line.packagingId > 0 && line.quantity > 0);
		if (!enriched.length) {
			toast.error("Lệnh chưa có dòng hợp lệ để lập phiếu");
			return;
		}
		const isAssemblyOrder =
			!!order.componentWarehouseId || !!order.outputWarehouseId;
		const orderWarehouseId =
			type === "EXPORT"
				? order.componentWarehouseId || order.sourceWarehouseId
				: order.outputWarehouseId || order.recoveryWarehouseId;
		const defaultWarehouseId =
			type === "EXPORT"
				? isAssemblyOrder
					? componentWarehouseId(refs.data?.warehouses)
					: finishedGoodsWarehouseId(refs.data?.warehouses)
				: isAssemblyOrder
					? finishedGoodsWarehouseId(refs.data?.warehouses)
					: componentWarehouseId(refs.data?.warehouses);
		setVoucherDraft({
			order,
			type,
			warehouseId:
				orderWarehouseId ||
				defaultWarehouseId ||
				refs.data?.warehouses[0]?.id ||
				0,
			lines: enriched,
		});
	};

	const [savingVoucher, setSavingVoucher] = useState(false);
	const confirmDraftToInventory = async () => {
		if (!voucherDraft || savingVoucher) return;
		const { order, type, warehouseId, lines } = voucherDraft;
		if (!warehouseId) {
			toast.error("Chọn kho xuất/nhập trước khi lưu phiếu");
			return;
		}
		const normalized = lines
			.map(line => ({
				packagingId: Number(line.packagingId || 0),
				quantity: Number(line.quantity || 0),
				unitCost: Number(line.unitCost || 0),
				note: order.code,
			}))
			.filter(line => line.packagingId > 0 && line.quantity > 0);
		if (!normalized.length) {
			toast.error("Phiếu chưa có dòng hợp lệ để lưu");
			return;
		}
		setSavingVoucher(true);
		try {
			const created = await apiV1<any>("/api/v1/inventory/documents", {
				method: "POST",
				body: JSON.stringify({
					type,
					transactionDate: today(),
					warehouseId,
					recipient: type === "EXPORT" ? "Tổ lắp ráp" : "Kho thành phẩm",
					reason: `${
						tab === "ASSEMBLY" ? "Lắp ráp" : "Tháo dỡ"
					} lệnh ${order.code}`,
					note: `${
						type === "EXPORT" ? "Xuất cho" : "Nhập từ"
					} lệnh ${tab === "ASSEMBLY" ? "lắp ráp" : "tháo dỡ"} ${order.code}`,
					details: normalized,
				}),
			});
			const base =
				tab === "ASSEMBLY"
					? "/api/v1/assembly/orders"
					: "/api/v1/assembly/disassembly-orders";
			await apiV1(`${base}/${order.id}/link-inventory`, {
				method: "POST",
				body: JSON.stringify({
					linkType: type === "EXPORT" ? "INVENTORY_ISSUE" : "INVENTORY_RECEIPT",
					linkedId: created.data.id,
					linkedCode: created.data.code,
				}),
			});
			toast.success(
				`Đã lưu ${type === "EXPORT" ? "phiếu xuất" : "phiếu nhập"} ${created.data.code} ngay trong lệnh ${order.code}`,
			);
			setVoucherDraft(null);
			await viewOrder({ ...order, id: order.id } as any);
			void invalidate();
		} catch (e: any) {
			const detail = e?.fieldErrors
				? Object.entries(e.fieldErrors)
						.map(
							([field, messages]) =>
								`${field}: ${(messages as string[]).join(", ")}`,
						)
						.join("; ")
				: "";
			toast.error(
				[e.message || "Không lưu được phiếu kho", detail]
					.filter(Boolean)
					.join("\n"),
			);
		} finally {
			setSavingVoucher(false);
		}
	};

	const openEditor = (order: any, duplicate = false) => {
		setSelected(null);
		setEditing(duplicate ? null : order);
		setCode(
			duplicate
				? nextCode.data || (tab === "ASSEMBLY" ? "LR00001" : "TD00001")
				: order.code,
		);
		setNote(duplicate ? "" : order.note || "");
		setOrderDate(duplicate ? today() : order.orderDate);
		const sourceLines = order.outputs?.length
			? order.outputs
			: order.sources || [];
		setLines(
			sourceLines.map((row: any) => ({
				packagingId:
					row.packagingId ||
					row.outputPackagingId ||
					row.sourcePackagingId ||
					0,
				plannedQuantity: Number(row.plannedQuantity || 0),
				note: row.note || "",
			})),
		);
		setOpen(true);
	};

	const printOrder = async (row: AssemblyOrderV1 | DisassemblyOrderV1) => {
		try {
			const base =
				tab === "ASSEMBLY"
					? "/api/v1/assembly/orders"
					: "/api/v1/assembly/disassembly-orders";
			const response = await apiV1<any>(`${base}/${row.id}`);
			setPrintTarget(response.data);
		} catch (e: any) {
			toast.error(e.message || "Không tải được lệnh để in");
		}
	};

	const duplicateOrder = async (row: AssemblyOrderV1 | DisassemblyOrderV1) => {
		try {
			const base =
				tab === "ASSEMBLY"
					? "/api/v1/assembly/orders"
					: "/api/v1/assembly/disassembly-orders";
			const response = await apiV1<any>(`${base}/${row.id}`);
			openEditor(response.data, true);
			toast.success(`Đã sao chép lệnh ${row.code}`);
		} catch (e: any) {
			toast.error(e.message || "Không sao chép được lệnh");
		}
	};

	const viewOrder = async (row: AssemblyOrderV1 | DisassemblyOrderV1) => {
		try {
			const base =
				tab === "ASSEMBLY"
					? "/api/v1/assembly/orders"
					: "/api/v1/assembly/disassembly-orders";
			const response = await apiV1<any>(`${base}/${row.id}`);
			setSelected(response.data);
		} catch (e: any) {
			toast.error(e.message);
		}
	};

	const [printTarget, setPrintTarget] = useState<any | null>(null);
	const printIsDisassembly =
		!!printTarget &&
		(String(printTarget.sourceModule || "").includes("DISASSEMBLY") ||
			(!!printTarget.sources?.length && !printTarget.outputs?.length));
	const orderOutputs = (order: any) =>
		order.outputs?.length
			? order.outputs
			: order.sources?.length
				? order.sources.map((row: any) => ({
						sku: row.sku,
						packagingName: row.packagingName,
						productName: row.productName,
						unit: row.unit,
						plannedQuantity: row.plannedQuantity,
					}))
				: [
						{
							sku: (order as any).output?.sku || (order as any).source?.sku,
							packagingName:
								(order as any).output?.packagingName ||
								(order as any).source?.packagingName,
							productName:
								(order as any).output?.productName ||
								(order as any).source?.productName,
							unit: (order as any).output?.unit,
							plannedQuantity: (order as any).plannedQuantity,
						},
					];
	const orderOutputLabel = (order: any) =>
		orderOutputs(order)
			.map(
				(output: any) =>
					[output.productName, output.packagingName]
						.filter(Boolean)
						.join(" - ") ||
					output.sku ||
					"",
			)
			.filter(Boolean)
			.join("; ");
	const outputAmount = (output: any) => {
		const stored = Number(output.totalValue || 0);
		if (stored) return stored;
		const quantity =
			Number(output.actualQuantity || 0) || Number(output.plannedQuantity || 0);
		const unitCost =
			Number(output.unitCost || 0) ||
			refs.data?.costMap.get(Number(output.packagingId)) ||
			0;
		return quantity * unitCost;
	};
	const orderAmount = (order: any) =>
		Number(order.outputTotalValue || order.sourceTotalValue || 0) ||
		orderOutputs(order).reduce(
			(sum: number, output: any) => sum + outputAmount(output),
			0,
		);
	const allRows: any[] = orders.data?.data || [];
	const keyword = search.trim().toLowerCase();
	const visibleRows = allRows.filter(row => {
		if (filters.status) {
			const completed = row.status === "COMPLETED" || row.status === "POSTED";
			if (
				filters.status === "COMPLETED"
					? !completed
					: row.status !== filters.status
			)
				return false;
		}
		const date = String(row.orderDate || "").slice(0, 10);
		if (filters.dateFrom && date < filters.dateFrom) return false;
		if (filters.dateTo && date > filters.dateTo) return false;
		if (!keyword) return true;
		const haystack = [
			row.code,
			row.note,
			row.orderDate,
			formatDate(row.orderDate),
			row.bomCode,
			row.cancelReason,
			statusLabel[row.status],
			row.componentWarehouseName,
			row.outputWarehouseName,
			row.sourceWarehouseName,
			row.recoveryWarehouseName,
			row.output?.packagingName,
			row.output?.productName,
			row.output?.sku,
			row.source?.packagingName,
			row.source?.productName,
			row.source?.sku,
			...orderOutputs(row).flatMap((output: any) => [
				output.sku,
				output.productName,
				output.packagingName,
				output.unit,
			]),
			...(row.lines || []).flatMap((line: any) => [
				line.sku,
				line.productName,
				line.packagingName,
				line.unit,
				line.note,
				line.componentSku,
				line.componentName,
				line.componentProductName,
				line.component?.sku,
				line.component?.name,
				line.component?.products?.name,
			]),
		]
			.filter(Boolean)
			.join(" ")
			.toLowerCase();
		return haystack.includes(keyword);
	});
	const selectedIsAssembly =
		!!selected?.componentWarehouseId || !!selected?.outputWarehouseId;
	const selectedSourceWarehouse =
		selected?.componentWarehouseName ||
		selected?.sourceWarehouseName ||
		selected?.componentWarehouse?.name ||
		selected?.sourceWarehouse?.name ||
		"-";
	const selectedTargetWarehouse =
		selected?.outputWarehouseName ||
		selected?.recoveryWarehouseName ||
		selected?.outputWarehouse?.name ||
		selected?.recoveryWarehouse?.name ||
		"-";
	const exportAssemblyList = () =>
		exportExcelFile(
			tab === "ASSEMBLY" ? "lenh-lap-rap.xlsx" : "lenh-thao-do.xlsx",
			tab === "ASSEMBLY" ? "Lenh lap rap" : "Lenh thao do",
			[
				{ header: "Mã lệnh", value: (row: any) => row.code },
				{ header: "Ngày", value: (row: any) => row.orderDate },
				{
					header: "Thành phẩm",
					value: (row: any) =>
						orderOutputs(row)
							.map((output: any) => output.packagingName || output.sku || "")
							.join("; "),
					width: 32,
				},
				{
					header: "Tổng tiền",
					value: (row: any) => orderAmount(row),
				},
				{
					header: "Trạng thái",
					value: (row: any) => statusLabel[row.status] || row.status,
				},
				{
					header: "Diễn giải",
					value: (row: any) => row.note || "",
					width: 36,
				},
			],
			visibleRows,
		);

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>{tab === "ASSEMBLY" ? "Lệnh lắp ráp" : "Lệnh tháo dỡ"}</h1>
					<p>
						{tab === "ASSEMBLY"
							? "Lập lệnh lắp ráp thành phẩm từ linh kiện theo định mức"
							: "Lập lệnh tháo dỡ thành phẩm ra linh kiện theo định mức"}
					</p>
				</div>
				<div className="flex gap-2">
					<button
						className={`erp-btn ${tab === "ASSEMBLY" ? "erp-btn-primary" : ""}`}
						onClick={() => setTab("ASSEMBLY")}
					>
						Lắp ráp
					</button>
					<button
						className={`erp-btn ${tab === "DISASSEMBLY" ? "erp-btn-primary" : ""}`}
						onClick={() => setTab("DISASSEMBLY")}
					>
						Tháo dỡ
					</button>
					{manage && (
						<button className="erp-btn erp-btn-primary" onClick={create}>
							<Plus size={16} /> Tạo lệnh{" "}
							{tab === "ASSEMBLY" ? "lắp ráp" : "tháo dỡ"}
						</button>
					)}
				</div>
			</div>

			<div className="erp-card overflow-hidden">
				<ListToolbar
					fields={ASSEMBLY_FILTER_FIELDS}
					values={filters}
					onChange={setFilters}
					onExport={exportAssemblyList}
					exportDisabled={visibleRows.length === 0}
					search={
						<div className="erp-search">
							<Search size={16} />
							<input
								value={search}
								onChange={e => setSearch(e.target.value)}
								placeholder="Tìm mã lệnh, sản phẩm, diễn giải..."
							/>
						</div>
					}
				/>
				<table className="erp-table">
					<thead>
						<tr>
							<th>Mã lệnh</th>
							<th>Ngày</th>
							<th>Thành phẩm</th>
							<th className="text-right">Tổng tiền</th>
							<th>Trạng thái</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{visibleRows.length === 0 && (
							<tr>
								<td
									colSpan={6}
									className="py-10 text-center text-sm text-[#a3aed0]"
								>
									Không có dữ liệu
								</td>
							</tr>
						)}
						{visibleRows.map((row: any) => (
							<tr key={row.id}>
								<td>
									<button
										className="font-bold text-[#422afb] hover:underline"
										onClick={() => viewOrder(row)}
									>
										{row.code}
									</button>
								</td>
								<td>{formatDate(row.orderDate)}</td>
								<td>
									<div
										className="max-w-[360px] truncate"
										title={orderOutputLabel(row)}
									>
										{orderOutputLabel(row) || "-"}
									</div>
								</td>
								<td className="text-right font-semibold">
									{formatNumber(orderAmount(row))}
								</td>
								<td>
									<span className={`erp-badge ${badge[row.status]}`}>
										{statusLabel[row.status] || row.status}
									</span>
								</td>
								<td>
									<TableActions
										actions={[
											{
												key: "view",
												label: "Xem chi tiết",
												icon: <Eye size={15} />,
												onClick: () => viewOrder(row),
											},
											{
												key: "duplicate",
												label: "Nhân bản",
												icon: <Copy size={15} />,
												hidden: !manage,
												onClick: () => duplicateOrder(row),
											},
											{
												key: "print",
												label: "In lệnh",
												icon: <Printer size={15} />,
												onClick: () => printOrder(row),
											},
											{
												key: "cancel",
												label: "Hủy lệnh",
												icon: <Undo2 size={15} />,
												tone: "danger",
												hidden: !manage || row.status !== "DRAFT",
												onClick: () => cancelOrder.mutate(row),
											},
											{
												key: "unpost",
												label: "Hủy lưu",
												icon: <Undo2 size={15} />,
												tone: "danger",
												hidden: !manage || row.status !== "POSTED",
												onClick: () => unpostOrder.mutate(row),
											},
											{
												key: "delete",
												label: "Xóa lệnh",
												icon: <Trash2 size={15} />,
												tone: "danger",
												hidden: !manage || row.status !== "DRAFT",
												onClick: () => deleteOrder.mutate(row),
											},
										]}
									/>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<RightDrawer
				open={open}
				title={
					editing
						? `Sửa lệnh ${editing.code}`
						: `Tạo lệnh ${tab === "ASSEMBLY" ? "lắp ráp" : "tháo dỡ"} mới`
				}
				subtitle={`Tạo lệnh ${tab === "ASSEMBLY" ? "lắp ráp hộp/túi từ bán thành phẩm" : "tháo dỡ từ thành phẩm ra bán thành phẩm"}`}
				widthClass="max-w-[76rem]"
				onClose={() => setOpen(false)}
				footer={
					<>
						<button
							type="button"
							className="erp-btn"
							onClick={() => setOpen(false)}
						>
							Hủy
						</button>
						<button
							type="button"
							className="erp-btn erp-btn-primary"
							disabled={save.isPending}
							onClick={() => save.mutate()}
						>
							{save.isPending ? "Đang lưu..." : "Lưu"}
						</button>
					</>
				}
			>
				<div className="space-y-4">
					<div className="grid gap-4 md:grid-cols-3">
						<div>
							<label className="mb-1 block text-[13px] font-medium text-slate-700">
								Diễn giải
							</label>
							<textarea
								rows={3}
								value={note}
								onChange={e => setNote(e.target.value)}
								placeholder=""
							/>
						</div>
						<div className="space-y-3">
							<div>
								<label className="mb-1 block text-[13px] font-medium text-slate-700">
									Ngày tạo lệnh
								</label>
								<DateInput
									value={orderDate}
									onChange={value => setOrderDate(value)}
								/>
							</div>
							<div>
								<label className="mb-1 block text-[13px] font-medium text-slate-700">
									Mã lệnh
								</label>
								<input
									value={code}
									onChange={e => setCode(e.target.value.toUpperCase())}
									placeholder={
										nextCode.data ||
										(tab === "ASSEMBLY" ? "LR00001" : "TD00001")
									}
								/>
							</div>
						</div>
						<div className="flex h-full flex-col justify-center rounded-lg bg-emerald-50 p-3">
							<p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
								Tổng tiền
							</p>
							<p className="mt-1 text-xl font-bold text-emerald-700">
								{formatNumber(totalCost)} ₫
							</p>
							<p className="mt-1 text-xs text-emerald-700">
								Theo giá vốn thành phẩm cần{" "}
								{tab === "ASSEMBLY" ? "lắp ráp" : "tháo dỡ"}
							</p>
						</div>
					</div>

					<div className="grid items-start gap-4 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
						<div className="min-w-0">
							<b>Thành phẩm ({lines.length})</b>
							<div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
								<table className="erp-table w-full min-w-[720px]">
									<thead>
										<tr>
											<th className="w-9">STT</th>
											<th className="w-48">Mã hàng hóa</th>
											<th className="min-w-56">Tên hàng hóa</th>
											<th className="w-16">ĐVT</th>
											<th className="w-28 text-right">Số lượng</th>
											<th className="w-28 text-right">Đơn giá</th>
											<th className="w-32 text-right">Thành tiền</th>
											<th className="w-9"></th>
										</tr>
									</thead>
									<tbody>
										{lines.map((line, index) => {
											const item = packagingOptions.find(
												x => x.id === line.packagingId,
											);
											const unitCost =
												refs.data?.costMap.get(line.packagingId) || 0;
											return (
												<tr key={index}>
													<td>{index + 1}</td>
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
															placeholder="Tìm mã/tên"
															required
														/>
													</td>
													<td
														className="max-w-56 truncate"
														title={
															item
																? formatProductName(item.productName, item.name)
																: ""
														}
													>
														{item ? (
															formatProductName(item.productName, item.name)
														) : (
															<span className="text-slate-400">Chưa chọn</span>
														)}
													</td>
													<td>{item?.unit || ""}</td>
													<td>
														<input
															className="w-full text-right"
															type="number"
															min={0.0001}
															step="any"
															value={line.plannedQuantity}
															onChange={e =>
																setLines(current =>
																	current.map((l, i) =>
																		i === index
																			? {
																					...l,
																					plannedQuantity: Number(
																						e.target.value,
																					),
																				}
																			: l,
																	),
																)
															}
														/>
													</td>
													<td className="text-right">
														{formatNumber(unitCost)}
													</td>
													<td className="text-right font-semibold">
														{formatNumber(line.plannedQuantity * unitCost)}
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
							<div className="mt-2 flex items-center">
								<div className="flex rounded border border-slate-200 overflow-hidden">
									<button
										type="button"
										className="erp-btn px-3"
										onClick={() =>
											setLines(current => [
												...current,
												{ packagingId: 0, plannedQuantity: 1, note: "" },
											])
										}
									>
										<Plus size={15} /> Thêm dòng
									</button>
									<div className="w-px bg-slate-200" />
									<button
										type="button"
										className="erp-btn px-3 text-red-500 hover:bg-red-50"
										onClick={() => setLines([])}
									>
										<Trash2 size={15} /> Xóa hết dòng
									</button>
								</div>
							</div>
						</div>
						<div className="min-w-0">
							<b>Linh kiện lắp ráp theo BOM</b>
							{!bomRows.length ? (
								<p className="mt-2 rounded bg-slate-50 p-3 text-sm text-slate-500">
									Chọn thành phẩm có BOM để tự tổng hợp linh kiện.
								</p>
							) : (
								<div className="mt-2 overflow-x-auto rounded-lg border border-slate-200">
									<table className="erp-table w-full min-w-[380px]">
										<thead>
											<tr>
												<th className="w-9">STT</th>
												<th>Tên</th>
												<th className="w-20">ĐVT</th>
												<th className="w-28 text-right">Số lượng</th>
											</tr>
										</thead>
										<tbody>
											{bomRows.map((row, index) => (
												<tr key={row.packagingId}>
													<td>{index + 1}</td>
													<td>
														<b className="font-mono">{row.sku}</b>
														<small>
															{formatProductName(
																row.productName,
																row.packagingName,
															)}
														</small>
													</td>
													<td>{row.unit || ""}</td>
													<td className="text-right font-semibold">
														{formatNumber(row.quantity)}
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
			</RightDrawer>

			<RightDrawer
				open={!!selected}
				title={selected?.code || "Chi tiết lệnh"}
				subtitle={
					selected
						? `${formatDate(selected.orderDate)} · ${selected.note || ""}`
						: ""
				}
				widthClass="max-w-[60rem]"
				onClose={() => setSelected(null)}
				footer={
					<>
						<DocumentActions
							status={selected?.status || "DRAFT"}
							canEdit={!(selected?.links || []).length}
							printing={false}
							unposting={unpostOrder.isPending}
							onUnpost={() => selected && unpostOrder.mutate(selected)}
							onPrint={() => selected && setPrintTarget(selected)}
							onEdit={() => selected && openEditor(selected)}
							onDuplicate={() => {
								if (!selected) return;
								const order = selected;
								setSelected(null);
								void duplicateOrder(order);
							}}
						/>
						{selected?.status === "DRAFT" ? (
							<button
								type="button"
								className="erp-btn text-red-600"
								onClick={() => deleteOrder.mutate(selected)}
							>
								<Trash2 size={15} /> Xóa
							</button>
						) : null}
						{selected &&
							["DRAFT"].includes(selected.status) &&
							!(selected.links || []).some(
								(link: any) => link.linkType === "INVENTORY_ISSUE",
							) && (
								<button
									type="button"
									className="erp-btn erp-btn-primary"
									onClick={() => {
										openDraft(
											selected,
											"EXPORT",
											(selected.lines || []).map((line: any) => ({
												packagingId:
													line.packagingId || line.componentPackagingId,
												quantity: Number(line.plannedQuantity || 0),
											})),
										);
									}}
								>
									Lập phiếu xuất
								</button>
							)}
						{selected &&
							["DRAFT"].includes(selected.status) &&
							!(selected.links || []).some(
								(link: any) => link.linkType === "INVENTORY_RECEIPT",
							) && (
								<button
									type="button"
									className="erp-btn erp-btn-primary"
									onClick={() => {
										const outputs = selected.outputs?.length
											? selected.outputs
											: selected.sources?.length
												? selected.sources.map((row: any) => ({
														packagingId:
															row.sourcePackagingId || row.packagingId,
														plannedQuantity: row.plannedQuantity,
													}))
												: [
														{
															packagingId:
																(selected as any).output?.packagingId ||
																(selected as any).source?.packagingId,
															plannedQuantity: (selected as any)
																.plannedQuantity,
														},
													];
										openDraft(
											selected,
											"IMPORT",
											outputs
												.filter((x: any) => x.packagingId)
												.map((x: any) => ({
													packagingId: x.packagingId,
													quantity: Number(x.plannedQuantity || 0),
												})),
										);
									}}
								>
									Lập phiếu nhập
								</button>
							)}
						<button
							type="button"
							className="erp-btn"
							onClick={() => setSelected(null)}
						>
							Đóng
						</button>
					</>
				}
			>
				{selected && (
					<div className="space-y-4">
						<div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
							<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
								<div>
									<small>Mã lệnh</small>
									<b className="block">{selected.code}</b>
								</div>
								<div>
									<small>Ngày lệnh</small>
									<b className="block">{formatDate(selected.orderDate)}</b>
								</div>
								<div>
									<small>
										{selectedIsAssembly ? "Kho linh kiện" : "Kho nguồn"}
									</small>
									<b className="block">Kho thành phẩm</b>
								</div>
								<div>
									<small>
										{selectedIsAssembly ? "Kho thành phẩm" : "Kho thu hồi"}
									</small>
									<b className="block">Kho thành phẩm</b>
								</div>
								<div className="md:col-span-2">
									<small>Diễn giải</small>
									<div className="mt-1 text-sm text-slate-700">
										{selected.note || "-"}
									</div>
								</div>
								<div>
									<small>Tổng tiền</small>
									<b className="block text-emerald-700">
										{formatNumber(orderAmount(selected))} đ
									</b>
								</div>
								<div>
									<small>Tham chiếu</small>
									<div className="mt-1 flex flex-wrap gap-1">
										{(selected.links || []).length ? (
											selected.links.map((link: any) => (
												<button
													key={link.id}
													type="button"
													title={`Mở phiếu kho ${link.linkedCode}`}
													className="erp-badge bg-blue-100 text-blue-700 hover:bg-blue-200"
													onClick={() => {
														const path =
															link.linkType === "INVENTORY_ISSUE"
																? "inventory-export"
																: link.linkType === "INVENTORY_RECEIPT"
																	? "inventory-import"
																	: "transactions";
														window.open(
															`/${path}?code=${encodeURIComponent(link.linkedCode || "")}`,
															"_blank",
														);
													}}
												>
													{link.linkType === "INVENTORY_ISSUE"
														? "Phiếu xuất"
														: link.linkType === "INVENTORY_RECEIPT"
															? "Phiếu nhập"
															: link.linkType}
													: {link.linkedCode} ↗
												</button>
											))
										) : (
											<span className="text-xs text-slate-400">
												Chưa có phiếu liên kết
											</span>
										)}
									</div>
								</div>
							</div>
						</div>
						<table className="erp-table">
							<thead>
								<tr>
									<th className="w-12 text-center">STT</th>
									<th>Mã thành phẩm</th>
									<th>Tên thành phẩm</th>
									<th className="text-right">Số lượng</th>
									<th className="text-right">Thành tiền</th>
								</tr>
							</thead>
							<tbody>
								{orderOutputs(selected).map((row: any, index: number) => (
									<tr key={index}>
										<td className="text-center">{index + 1}</td>
										<td className="font-mono">{row.sku || "-"}</td>
										<td>{row.productName || row.packagingName || "-"}</td>
										<td className="text-right">
											{formatNumber(row.plannedQuantity || 0)} {row.unit || ""}
										</td>
										<td className="text-right font-semibold">
											{formatNumber(outputAmount(row))}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</RightDrawer>

			<RightDrawer
				open={!!voucherDraft}
				title={
					voucherDraft
						? `${voucherDraft.type === "EXPORT" ? "Phiếu xuất" : "Phiếu nhập"} nháp cho ${voucherDraft.order.code}`
						: "Phiếu nháp"
				}
				subtitle="Kiểm tra lại sản phẩm, số lượng, đơn giá vốn rồi lưu ngay tại đây"
				widthClass="max-w-[68rem]"
				onClose={() => setVoucherDraft(null)}
				footer={
					<>
						<button
							type="button"
							className="erp-btn"
							onClick={() => setVoucherDraft(null)}
						>
							Đóng
						</button>
						<button
							type="button"
							className="erp-btn erp-btn-primary"
							disabled={savingVoucher}
							onClick={() => void confirmDraftToInventory()}
						>
							{savingVoucher ? "Đang lưu phiếu..." : "Lưu phiếu"}
						</button>
					</>
				}
			>
				{voucherDraft && (
					<div className="space-y-4">
						<div className="grid gap-3 md:grid-cols-3">
							<div className="rounded bg-slate-50 p-3">
								<small>Kho xuất/nhập</small>
								<select
									className="mt-1"
									value={voucherDraft.warehouseId}
									onChange={e =>
										setVoucherDraft(current =>
											current
												? { ...current, warehouseId: Number(e.target.value) }
												: current,
										)
									}
								>
									<option value={0}>Chọn kho khi chuyển phiếu</option>
									{refs.data?.warehouses.map(w => (
										<option key={w.id} value={w.id}>
											{w.name}
										</option>
									))}
								</select>
							</div>
							<div className="rounded bg-slate-50 p-3">
								<small>Loại phiếu</small>
								<b className="block">
									{voucherDraft.type === "EXPORT" ? "Xuất kho" : "Nhập kho"}
								</b>
							</div>
							<div className="rounded bg-emerald-50 p-3">
								<small>Tổng giá vốn</small>
								<b className="block text-emerald-700">
									{formatNumber(
										voucherDraft.lines.reduce(
											(sum, line) => sum + line.quantity * line.unitCost,
											0,
										),
									)}{" "}
									₫
								</b>
							</div>
						</div>
						<div className="overflow-x-auto rounded-lg border border-slate-200">
							<table className="erp-table w-full min-w-[640px]">
								<thead>
									<tr>
										<th>STT</th>
										<th>Mã hàng hóa</th>
										<th>Tên hàng hóa</th>
										<th>ĐVT</th>
										<th className="text-right">Số lượng</th>
										<th className="text-right">Đơn giá vốn</th>
										<th className="text-right">Thành tiền</th>
									</tr>
								</thead>
								<tbody>
									{voucherDraft.lines.map((line, index) => (
										<tr key={index}>
											<td>{index + 1}</td>
											<td className="font-mono font-semibold">
												{line.sku || "-"}
											</td>
											<td>
												{formatProductName(
													line.productName,
													line.packagingName,
												) || "-"}
											</td>
											<td>{line.unit || ""}</td>
											<td>
												<NumberInput
													value={line.quantity}
													onChange={v =>
														setVoucherDraft(current =>
															current
																? {
																		...current,
																		lines: current.lines.map((l, i) =>
																			i === index ? { ...l, quantity: v } : l,
																		),
																	}
																: current,
														)
													}
													min={0.0001}
													decimals={3}
													className="w-28"
												/>
											</td>
											<td className="text-right">
												{formatNumber(line.unitCost)}
											</td>
											<td className="text-right font-semibold">
												{formatNumber(line.quantity * line.unitCost)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</RightDrawer>

			<PrintDocumentPreview
				open={!!printTarget}
				title={printIsDisassembly ? "Lệnh tháo dỡ" : "Lệnh lắp ráp"}
				code={printTarget?.code}
				documentTitle={
					printTarget
						? `Lenh-${printIsDisassembly ? "thao-do" : "lap-rap"}-${printTarget.code}`
						: "Lenh-lap-rap"
				}
				onClose={() => setPrintTarget(null)}
			>
				{ref => {
					if (!printTarget) return null;
					return (
						<AssemblyDocument
							ref={ref}
							order={printTarget}
							isDisassembly={printIsDisassembly}
							company={companyQuery.data}
						/>
					);
				}}
			</PrintDocumentPreview>
		</div>
	);
}
