import React, { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import {
	CheckCircle2,
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
import {
	formatDate,
	formatNumber,
	formatInteger,
	formatProductName,
} from "../lib/utils";
import { buildCompanyPrintProfile } from "../lib/printTemplate";
import type { Product, ProductionOrderV1, User, Warehouse } from "../types";
import { useMultiEscapeKey } from "../hooks/useEscapeKey";
import { DateInput } from "../components/DateRangeCalendar";

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
const sm = {
	DRAFT: ["Nháp", "bg-slate-100 text-slate-700"],
	IN_PROGRESS: ["Đang sản xuất", "bg-amber-100 text-amber-700"],
	COMPLETED: ["Hoàn thành", "bg-emerald-100 text-emerald-700"],
	CANCELLED: ["Đã hủy", "bg-red-100 text-red-700"],
} as const;

export default function Production({
	user,
	onNavigate,
}: {
	user: User;
	onNavigate?: (tab: string) => void;
}) {
	const qc = useQueryClient();
	const manage = user.role === "ADMIN" || user.role === "P_MANAGER";
	const [month, setMonth] = useState(today().slice(0, 7));
	const [status, setStatus] = useState("");
	const [search, setSearch] = useState("");
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
			}>) {
				costMap.set(row.packagingId, Number(row.price || 0));
			}
			return { warehouses, products, costMap };
		},
	});
	const docs = useQuery({
		queryKey: ["production-v1", month, status, search],
		queryFn: () =>
			apiV1<ProductionOrderV1[]>(
				`/api/v1/production-orders?page=1&limit=100&month=${month}&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}`,
			),
	});
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
				})),
			),
		[refs.data],
	);
	// Thành phẩm lệnh SX chỉ là gói lẻ (packCount <= 1); các mã hộp/túi đóng gói
	// sau ở trang quản lý SX nên ẩn khỏi ô chọn thành phẩm
	const productSearchOptions = useMemo(
		() =>
			packagingOptions
				.filter(item => Number((item as any).packCount ?? 1) <= 1)
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
			const payload = {
				code: code || undefined,
				orderDate,
				mfgDate: orderDate,
				expDate: orderDate,
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
			a: "confirm" | "complete" | "cancel";
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
				a === "confirm" ? "confirm" : a === "complete" ? "complete" : "cancel";
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
		const details = type === "EXPORT" ? order.materials : baseOutputs(order);
		if (!details.length) {
			toast.error("Lệnh chưa có dòng để lập phiếu");
			return;
		}
		const costMap = refs.data?.costMap || new Map<number, number>();
		const draft = {
			productionOrderId: order.id,
			productionOrderCode: order.code,
			fromProduction: true,
			initialType: type,
			form: {
				type,
				transactionDate: today(),
				warehouseId: order.warehouseId,
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
				const quantity =
					type === "EXPORT" && itemBomUnit && itemPkgUnit
						? convertUnitValue(
								Number(item.plannedQuantity || 0),
								itemBomUnit,
								itemPkgUnit,
							)
						: Number(item.plannedQuantity || 0);
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
			window.open("/inventory-import?productionDraft=1", "_blank");
		}
		toast.success(
			type === "EXPORT"
				? "Đã mở phiếu xuất NVL nháp, chỉnh số lượng rồi lưu để trừ kho"
				: "Đã mở phiếu nhập thành phẩm nháp, nhập số lượng tay rồi lưu",
		);
	};

	const createIssueDraft = (order: ProductionOrderV1) =>
		openInventoryDraft(order, "EXPORT");
	const createReceiptDraft = (order: ProductionOrderV1) =>
		openInventoryDraft(order, "IMPORT");

	// Kho mặc định cho lệnh mới: ưu tiên kho thành phẩm, nếu không có thì lấy kho đầu tiên
	const defaultWarehouseId = () => {
		const warehouses = refs.data?.warehouses || [];
		return (
			warehouses.find(w => w.name.toLowerCase().includes("thành phẩm"))?.id ||
			warehouses[0]?.id ||
			0
		);
	};
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
					<p>
						Mã LSX tự tăng, đa thành phẩm, BOM trực tiếp, phiếu xuất/nhập liên
						kết
					</p>
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
						<span>Đang SX</span>
						<strong>
							{
								(docs.data?.data || []).filter(x => x.status === "IN_PROGRESS")
									.length
							}
						</strong>
					</div>
				</div>
				<div className="erp-stat">
					<CheckCircle2 />
					<div>
						<span>Hoàn thành</span>
						<strong>
							{
								(docs.data?.data || []).filter(x => x.status === "COMPLETED")
									.length
							}
						</strong>
					</div>
				</div>
			</div>
			<div className="erp-card overflow-hidden">
				<div className="erp-toolbar">
					<div className="erp-search">
						<Search size={17} />
						<input
							value={search}
							onChange={e => setSearch(e.target.value)}
							placeholder="Tìm mã LSX, diễn giải..."
						/>
					</div>
					<input
						type="month"
						value={month}
						onChange={e => setMonth(e.target.value)}
					/>
					<select value={status} onChange={e => setStatus(e.target.value)}>
						<option value="">Mọi trạng thái</option>
						{Object.entries(sm).map(([k, v]) => (
							<option key={k} value={k}>
								{v[0]}
							</option>
						))}
					</select>
				</div>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Mã lệnh</th>
								<th>Ngày</th>
								<th>Thành phẩm</th>
								<th>Trạng thái</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{(docs.data?.data || []).map(d => (
								<tr key={d.id}>
									<td>
										<button
											className="font-bold text-indigo-700"
											onClick={() => setSelected(d)}
										>
											{d.code}
										</button>
										<small>v{d.version}</small>
									</td>
									<td>{formatDate(d.orderDate)}</td>
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
									<td>
										<span className={`erp-badge ${sm[d.status][1]}`}>
											{sm[d.status][0]}
										</span>
									</td>
									<td>
										<div className="flex gap-1">
											<button
												className="erp-icon-btn"
												onClick={() => setSelected(d)}
											>
												<Eye size={16} />
											</button>
											{manage && (
												<>
													<button
														className="erp-icon-btn"
														disabled={d.status !== "DRAFT"}
														onClick={() => edit(d)}
													>
														<Edit size={16} />
													</button>
													<button
														className="erp-icon-btn text-amber-600"
														disabled={d.status !== "DRAFT"}
														onClick={() => handleConfirm(d)}
													>
														<Play size={16} />
													</button>
													<button
														className="erp-icon-btn text-emerald-600"
														disabled={d.status !== "IN_PROGRESS"}
														onClick={() => handleComplete(d)}
													>
														<CheckCircle2 size={16} />
													</button>
													<button
														className="erp-icon-btn text-red-600"
														disabled={d.status === "CANCELLED"}
														onClick={() => cancel(d)}
													>
														<Undo2 size={16} />
													</button>
													{["DRAFT", "CANCELLED"].includes(d.status) &&
														manage && (
															<button
																className="erp-icon-btn text-red-600"
																onClick={async () => {
																	if (await confirm(`Xóa lệnh ${d.code}?`))
																		deleteMutation.mutate(d);
																}}
																title="Xóa"
															>
																<Trash2 size={16} />
															</button>
														)}
												</>
											)}
										</div>
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
												<col style={{ width: "170px" }} />
												<col style={{ width: "280px" }} />
												<col style={{ width: "70px" }} />
												<col style={{ width: "120px" }} />
												<col style={{ width: "48px" }} />
											</colgroup>
											<thead>
												<tr>
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
														<col style={{ width: "120px" }} />
														<col style={{ minWidth: "200px" }} />
														<col style={{ width: "120px" }} />
														<col style={{ width: "120px" }} />
														<col style={{ width: "120px" }} />
													</colgroup>
													<thead>
														<tr>
															<th className="bom-code-cell">Mã</th>
															<th className="bom-name-cell">Tên nguyên liệu</th>
															<th className="text-right">Số lượng</th>
															<th className="text-right">Đơn giá vốn</th>
															<th className="text-right">Thành tiền</th>
														</tr>
													</thead>
													<tbody>
														{bomPreview.map(row => (
															<tr key={`${row.packagingId}-${row.unit}`}>
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
								<span className={`erp-badge ${sm[selected.status][1]}`}>
									{sm[selected.status][0]}
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
														window.open(
															`/inventory-export?code=${encodeURIComponent(x.linkedCode)}`,
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
								<tbody>
									{baseOutputs(selected).map(x => (
										<tr key={x.id} className="font-semibold text-slate-700">
											<td>
												{x.sku} - {x.packagingName}
											</td>
											<td>{x.unit}</td>
											<td className="text-right text-xl">
												{formatInteger(x.plannedQuantity)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
							<h3>Định mức nguyên liệu</h3>
							<table className="erp-table">
								<thead>
									<tr>
										<th>Nguyên liệu</th>
										<th>ĐVT</th>
										<th className="text-right">Số lượng</th>
										<th className="text-right">Đơn giá vốn</th>
										<th className="text-right">Thành tiền</th>
									</tr>
								</thead>
								<tbody>
									{selected.materials.map(x => {
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
							{manage && selected.status === "DRAFT" && (
								<button
									type="button"
									className="erp-btn erp-btn-post"
									disabled={action.isPending}
									onClick={() => handleConfirm(selected)}
								>
									<Play size={15} /> Ghi sổ
								</button>
							)}
							{manage && selected.status === "IN_PROGRESS" && (
								<button
									type="button"
									className="erp-btn erp-btn-post"
									disabled={action.isPending}
									onClick={() => handleComplete(selected)}
								>
									<CheckCircle2 size={15} /> Ghi sổ
								</button>
							)}
							{manage && selected.status !== "CANCELLED" && (
								<button
									type="button"
									className="erp-btn erp-btn-unpost"
									disabled={action.isPending}
									onClick={() => cancel(selected)}
								>
									<Undo2 size={15} /> Bỏ ghi
								</button>
							)}
							<button
								type="button"
								className="erp-btn"
								onClick={() => setReportOrder(selected)}
							>
								<Printer size={15} /> In
							</button>
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
								className="px-10 py-2 bg-indigo-600 text-white rounded-lg font-black hover:bg-indigo-700 transition-all shadow-lg uppercase text-[10px] tracking-widest flex items-center gap-2"
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
