import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Edit,
	Eye,
	FileSpreadsheet,
	Plus,
	Printer,
	Search,
	Trash2,
	Undo2,
	X,
} from "lucide-react";
import toast from "react-hot-toast";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { apiV1, legacyApi } from "../lib/apiV1";
import SearchableSelect from "../components/SearchableSelect";
import RightDrawer from "../components/RightDrawer";
import { formatDate, formatNumber } from "../lib/utils";
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
	CANCELLED: "bg-red-100 text-red-700",
};

export default function Assembly({ user }: { user: User }) {
	const qc = useQueryClient();
	const manage = user.role === "ADMIN" || user.role === "P_MANAGER";
	const [tab, setTab] = useState<Tab>("ASSEMBLY");
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState<
		AssemblyOrderV1 | DisassemblyOrderV1 | null
	>(null);
	const [selected, setSelected] = useState<any | null>(null);

	const [code, setCode] = useState("");
	const [note, setNote] = useState("");
	const [orderDate, setOrderDate] = useState(today());
	const [warehouseId, setWarehouseId] = useState(0);
	const [lines, setLines] = useState<OrderLine[]>([
		{ packagingId: 0, plannedQuantity: 1, note: "" },
	]);

	const refs = useQuery({
		queryKey: ["assembly-refs-v2"],
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
			}>)
				costMap.set(row.packagingId, Number(row.price || 0));
			return { warehouses, products, costMap };
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
				label: item.sku || `${item.productName} - ${item.name}`,
				subLabel: `${item.productName} - ${item.name}${item.unit ? ` (${item.unit})` : ""}`,
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
				!warehouseId ||
				!normalizedLines.length ||
				normalizedLines.some(line => !(line.plannedQuantity > 0))
			) {
				throw Error("Chọn kho và nhập đủ mã thành phẩm, số lượng lớn hơn 0");
			}
			const payload = {
				code: code || undefined,
				orderDate,
				note,
				outputs: normalizedLines,
				...(tab === "ASSEMBLY"
					? {
							componentWarehouseId: warehouseId,
							outputWarehouseId: warehouseId,
							assemblyCost: 0,
						}
					: {
							sourceWarehouseId: warehouseId,
							recoveryWarehouseId: warehouseId,
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
		mutationFn: (row: AssemblyOrderV1 | DisassemblyOrderV1) => {
			const reason = window.prompt("Lý do hủy (ít nhất 3 ký tự):");
			if (!reason || reason.trim().length < 3) throw Error("Đã bỏ hủy");
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

	const create = () => {
		setEditing(null);
		setCode(nextCode.data || (tab === "ASSEMBLY" ? "LR00001" : "TD00001"));
		setNote("");
		setOrderDate(today());
		setWarehouseId(refs.data?.warehouses[0]?.id || 0);
		setLines([{ packagingId: 0, plannedQuantity: 1, note: "" }]);
		setOpen(true);
	};

	const openDraft = (
		order: any,
		type: "IMPORT" | "EXPORT",
		detailLines: Array<{ packagingId: number; quantity: number }>,
	) => {
		const draft = {
			fromAssembly: true,
			initialType: type,
			form: {
				type,
				transactionDate: today(),
				warehouseId:
					order.componentWarehouseId ||
					order.sourceWarehouseId ||
					order.outputWarehouseId ||
					order.recoveryWarehouseId ||
					warehouseId,
				recipient: type === "EXPORT" ? "Tổ lắp ráp" : "Kho thành phẩm",
				reason:
					type === "EXPORT"
						? "Xuất linh kiện lắp ráp"
						: "Nhập thành phẩm lắp ráp",
				note: `${type === "EXPORT" ? "Xuất cho" : "Nhập từ"} lệnh ${order.code}`,
			},
			lines: detailLines.map(line => ({
				packagingId: line.packagingId,
				quantity: Number(line.quantity || 0),
				unitCost: 0,
				note: order.code,
			})),
		};
		sessionStorage.setItem("inventory-assembly-draft", JSON.stringify(draft));
		window.open("/inventory-import?assemblyDraft=1", "_blank");
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

	const printOrder = async (order: any) => {
		try {
			const response = await fetch("/Template-LSX.xlsx");
			if (!response.ok) throw new Error("Không tải được mẫu Template-LSX.xlsx");
			const workbook = new ExcelJS.Workbook();
			await workbook.xlsx.load(await response.arrayBuffer());
			const worksheet = workbook.worksheets[0];
			worksheet.eachRow(row => {
				row.eachCell(cell => {
					if (typeof cell.value === "string") {
						cell.value = cell.value
							.replace("{MA_LENH}", order.code)
							.replace("{NGAY}", formatDate(order.orderDate))
							.replace("{DIEN_GIAI}", order.note || "");
					}
				});
			});
			let rowIndex = 12;
			const outputs = order.outputs?.length
				? order.outputs
				: [
						{
							sku: (order as any).output?.sku,
							packagingName:
								(order as any).output?.packagingName ||
								(order as any).source?.packagingName,
							unit: (order as any).output?.unit,
							plannedQuantity: (order as any).plannedQuantity,
						},
					];
			for (const output of outputs) {
				worksheet.getCell(`A${rowIndex}`).value = output.sku || "";
				worksheet.getCell(`B${rowIndex}`).value = output.packagingName || "";
				worksheet.getCell(`C${rowIndex}`).value = output.unit || "";
				worksheet.getCell(`D${rowIndex}`).value = output.plannedQuantity;
				rowIndex += 1;
			}
			const buffer = await workbook.xlsx.writeBuffer();
			saveAs(
				new Blob([buffer], {
					type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
				}),
				`${tab === "ASSEMBLY" ? "LR" : "TD"}_${order.code}.xlsx`,
			);
			toast.success("Đã xuất file theo mẫu Template-LSX.xlsx");
		} catch (e: any) {
			toast.error(e.message || "Không in được lệnh");
		}
	};

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>{tab === "ASSEMBLY" ? "Lệnh lắp ráp" : "Lệnh tháo dỡ"}</h1>
					<p>
						{tab === "ASSEMBLY"
							? "Ráp thành phẩm từ linh kiện theo BOM danh mục"
							: "Tháo thành phẩm đã đóng gói ra linh kiện theo BOM"}
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
				<div className="erp-toolbar">
					<div className="erp-search">
						<Search size={16} />
						<input placeholder="Tìm mã lệnh, diễn giải..." />
					</div>
				</div>
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
						{(orders.data?.data || []).map((row: any) => (
							<tr key={row.id}>
								<td>
									<button
										className="font-bold text-indigo-700"
										onClick={() => viewOrder(row)}
									>
										{row.code}
									</button>
								</td>
								<td>{formatDate(row.orderDate)}</td>
								<td>
									{
										(
											row.outputs || [
												{
													packagingName:
														row.output?.packagingName ||
														row.source?.packagingName,
												},
											]
										).length
									}{" "}
									mã
								</td>
								<td className="text-right font-semibold">
									{formatNumber(
										row.outputTotalValue || row.sourceTotalValue || 0,
									)}
								</td>
								<td>
									<span className={`erp-badge ${badge[row.status]}`}>
										{row.status}
									</span>
								</td>
								<td>
									<div className="flex gap-1">
										<button
											className="erp-icon-btn"
											onClick={() => viewOrder(row)}
										>
											<Eye size={16} />
										</button>
										{manage && row.status !== "CANCELLED" && (
											<button
												className="erp-icon-btn text-red-500"
												onClick={() => cancelOrder.mutate(row)}
											>
												<Undo2 size={16} />
											</button>
										)}
									</div>
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
				subtitle={`Mã tự tăng ${tab === "ASSEMBLY" ? "LR00001" : "TD00001"}, nhập tay khi cần`}
				widthClass="max-w-[76rem]"
				onClose={() => setOpen(false)}
				footer={
					<>
						<button
							type="button"
							className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
							onClick={() => setOpen(false)}
						>
							Hủy
						</button>
						<button
							type="button"
							className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
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
								Diễn giải cho lệnh {tab === "ASSEMBLY" ? "lắp ráp" : "tháo dỡ"}
							</label>
							<textarea
								rows={3}
								value={note}
								onChange={e => setNote(e.target.value)}
								placeholder="Diễn giải..."
							/>
						</div>
						<div className="space-y-3">
							<div>
								<label className="mb-1 block text-[13px] font-medium text-slate-700">
									Ngày tạo lệnh
								</label>
								<input
									type="date"
									value={orderDate}
									onChange={e => setOrderDate(e.target.value)}
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
							<div>
								<label className="mb-1 block text-[13px] font-medium text-slate-700">
									Kho
								</label>
								<select
									value={warehouseId}
									onChange={e => setWarehouseId(Number(e.target.value))}
								>
									<option value={0}>Chọn kho</option>
									{refs.data?.warehouses.map(w => (
										<option key={w.id} value={w.id}>
											{w.name}
										</option>
									))}
								</select>
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
															item ? `${item.productName} - ${item.name}` : ""
														}
													>
														{item ? (
															`${item.productName} - ${item.name}`
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
							<div className="mt-2 flex gap-2">
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
									<Plus size={15} /> Thêm dòng
								</button>
								<button
									type="button"
									className="erp-btn"
									onClick={() => setLines([])}
								>
									<Trash2 className="text-red-500" size={15} /> Xóa hết dòng
								</button>
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
															{row.productName} - {row.packagingName}
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
						<button
							type="button"
							className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
							onClick={() => selected && printOrder(selected)}
						>
							In mẫu
						</button>
						{selected && ["DRAFT"].includes(selected.status) && (
							<button
								type="button"
								className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
								onClick={() => {
									const outputs = selected.outputs?.length
										? selected.outputs
										: [
												{
													packagingId: (selected as any).output?.packagingId,
													plannedQuantity: (selected as any).plannedQuantity,
												},
											];
									openDraft(
										selected,
										"EXPORT",
										(selected.lines || []).map((line: any) => ({
											packagingId:
												line.packagingId || line.componentPackagingId,
											quantity: Number(line.plannedQuantity || 0),
										})),
									);
									void outputs;
								}}
							>
								Lập phiếu xuất
							</button>
						)}
						{selected && ["DRAFT"].includes(selected.status) && (
							<button
								type="button"
								className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
								onClick={() => {
									const outputs = selected.outputs?.length
										? selected.outputs
										: [
												{
													packagingId:
														(selected as any).output?.packagingId ||
														(selected as any).source?.packagingId,
													plannedQuantity: (selected as any).plannedQuantity,
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
							className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
							onClick={() => setSelected(null)}
						>
							Đóng
						</button>
					</>
				}
			>
				{selected && (
					<div className="space-y-4">
						<div className="grid gap-3 md:grid-cols-3">
							<div className="rounded bg-slate-50 p-3">
								<small>Tham chiếu</small>
								<div className="mt-1 flex flex-wrap gap-1">
									{(selected.links || []).length ? (
										selected.links.map((link: any) => (
											<span
												key={link.id}
												className="erp-badge bg-blue-100 text-blue-700"
											>
												{link.linkType}: {link.linkedCode}
											</span>
										))
									) : (
										<span className="text-xs text-slate-400">
											Chưa có phiếu liên kết
										</span>
									)}
								</div>
							</div>
							<div className="rounded bg-slate-50 p-3">
								<small>Ngày</small>
								<b className="block">{formatDate(selected.orderDate)}</b>
							</div>
							<div className="rounded bg-emerald-50 p-3">
								<small>Tổng tiền</small>
								<b className="block text-emerald-700">
									{formatNumber(
										(selected as any).outputTotalValue ||
											(selected as any).sourceTotalValue ||
											0,
									)}{" "}
									₫
								</b>
							</div>
						</div>
						<table className="erp-table">
							<thead>
								<tr>
									<th>Thành phẩm</th>
									<th className="text-right">Kế hoạch</th>
									<th className="text-right">Thực tế</th>
								</tr>
							</thead>
							<tbody>
								{((selected as any).outputs?.length
									? (selected as any).outputs
									: [
											{
												packagingName:
													(selected as any).output?.packagingName ||
													(selected as any).source?.packagingName,
												plannedQuantity: (selected as any).plannedQuantity,
												actualQuantity: (selected as any).actualQuantity,
											},
										]
								).map((row: any, index: number) => (
									<tr key={index}>
										<td>{row.packagingName || row.sku}</td>
										<td className="text-right">
											{formatNumber(row.plannedQuantity || 0)}
										</td>
										<td className="text-right">
											{formatNumber(row.actualQuantity || 0)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</RightDrawer>
		</div>
	);
}
