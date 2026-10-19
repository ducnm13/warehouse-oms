import React, { useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Banknote,
	CheckCircle2,
	Edit,
	Eye,
	FileClock,
	PackagePlus,
	Plus,
	Printer,
	Search,
	ShoppingBag,
	Trash2,
	Undo2,
	X,
} from "lucide-react";
import toast from "react-hot-toast";
import type {
	Product,
	PurchaseDocument,
	PurchaseDocumentDetail,
	Supplier,
	Warehouse,
} from "../types";
import { formatDate, formatNumber } from "../lib/utils";
import { apiV1, legacyApi } from "../lib/apiV1";
import SearchableSelect from "../components/SearchableSelect";
import PrintPreview from "../components/PrintPreview";
import {
	fillGenericDocument,
	GENERIC_LAYOUTS,
	type CompanyPrintProfile,
} from "../lib/printTemplate";
import { useMultiEscapeKey } from "../hooks/useEscapeKey";

const headerSchema = z.object({
	documentDate: z.string().min(1, "Chọn ngày chứng từ"),
	dueDate: z.string().optional(),
	type: z.enum(["DOMESTIC_INVENTORY", "DOMESTIC_NO_INVENTORY"]),
	paymentIntent: z.enum(["UNPAID", "PAID"]),
	paymentMethod: z.enum(["CASH", "BANK"]),
	invoiceOption: z.enum(["WITH_INVOICE", "NO_INVOICE"]),
	supplierId: z.number().positive("Chọn nhà cung cấp"),
	deliveryPerson: z.string().max(255),
	buyerName: z.string().max(255),
	description: z.string().max(1000),
	purchaseCost: z.number().min(0),
});
type HeaderForm = z.infer<typeof headerSchema>;

type Line = Pick<
	PurchaseDocumentDetail,
	"packagingId" | "warehouseId" | "quantity" | "unitPrice" | "taxRate" | "note"
>;
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({
	packagingId: 0,
	warehouseId: 0,
	quantity: 1,
	unitPrice: 0,
	taxRate: 8,
	note: "",
});
const statusMeta = {
	DRAFT: { label: "Nháp", css: "bg-slate-100 text-slate-700" },
	POSTED: { label: "Đã ghi sổ", css: "bg-emerald-100 text-emerald-700" },
	CANCELLED: { label: "Đã hủy", css: "bg-red-100 text-red-700" },
} as const;

const linkTypeLabel = (type: string) => {
	switch (type) {
		case "INVENTORY_RECEIPT":
			return "Phiếu nhập kho";
		case "INVENTORY_ISSUE":
			return "Phiếu xuất kho";
		case "PAYMENT_VOUCHER":
			return "Phiếu chi";
		case "PAYMENT_RECEIPT":
			return "Phiếu thu";
		case "PAYABLE_CHARGE":
			return "Phiếu chi phí";
		case "PRODUCTION":
			return "Lệnh sản xuất";
		case "INVENTORY_REVERSAL":
			return "Phiếu đảo";
		default:
			return type;
	}
};

export default function PurchasesV1() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<"" | keyof typeof statusMeta>("");
	const [page, setPage] = useState(1);
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState<PurchaseDocument | null>(null);
	const [selected, setSelected] = useState<PurchaseDocument | null>(null);
	const [printTarget, setPrintTarget] = useState<PurchaseDocument | null>(null);
	const [lines, setLines] = useState<Line[]>([emptyLine()]);

	useMultiEscapeKey([
		{ isOpen: open, onClose: () => setOpen(false), priority: 1 },
		{ isOpen: !!editing, onClose: () => setEditing(null), priority: 2 },
		{ isOpen: !!selected, onClose: () => setSelected(null), priority: 3 },
		{ isOpen: !!printTarget, onClose: () => setPrintTarget(null), priority: 4 },
	]);

	const form = useForm<HeaderForm>({
		resolver: zodResolver(headerSchema),
		defaultValues: {
			documentDate: today(),
			dueDate: "",
			type: "DOMESTIC_INVENTORY",
			paymentIntent: "UNPAID",
			paymentMethod: "CASH",
			invoiceOption: "WITH_INVOICE",
			supplierId: 0,
			deliveryPerson: "",
			buyerName: "",
			description: "",
			purchaseCost: 0,
		},
	});
	const type = form.watch("type");
	const purchaseCost = Number(form.watch("purchaseCost") || 0);

	const references = useQuery({
		queryKey: ["purchase-references"],
		queryFn: async () => {
			const [suppliers, warehouses, products, costPrices] = await Promise.all([
				legacyApi<Supplier[]>("/api/suppliers"),
				legacyApi<Warehouse[]>("/api/warehouses"),
				legacyApi<Product[]>("/api/products"),
				apiV1<Array<{ packagingId: number; price: number }>>(
					"/api/v1/catalog/packaging-cost-prices",
				)
					.then(response => response.data || [])
					.catch(() => []),
			]);
			const costPriceMap = new Map<number, number>();
			for (const row of costPrices)
				costPriceMap.set(row.packagingId, Number(row.price || 0));
			return { suppliers, warehouses, products, costPriceMap };
		},
	});
	const documents = useQuery({
		queryKey: ["purchase-documents-v1", page, search, status],
		queryFn: () =>
			apiV1<PurchaseDocument[]>(
				`/api/v1/purchase-documents?page=${page}&limit=20&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}`,
			),
	});
	const packagingOptions = useMemo(
		() =>
			(references.data?.products || []).flatMap(product =>
				(product.packagings || []).map(packaging => ({
					...packaging,
					productName: product.name,
				})),
			),
		[references.data],
	);
	const productSearchOptions = useMemo(
		() =>
			packagingOptions.map(item => ({
				value: item.id,
				label: item.productName,
				subLabel:
					item.name !== item.productName
						? `${item.name}${item.sku ? ` | SKU: ${item.sku}` : ""}`
						: item.sku
							? `SKU: ${item.sku}`
							: undefined,
			})),
		[packagingOptions],
	);

	const applyPackagingCost = (index: number, packagingId: number) => {
		const cost = references.data?.costPriceMap?.get(packagingId) || 0;
		if (cost > 0) updateLine(index, { packagingId, unitPrice: cost });
		else updateLine(index, { packagingId });
	};

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["purchase-documents-v1"] });
	const saveMutation = useMutation({
		mutationFn: async (input: HeaderForm) => {
			if (
				lines.some(
					line =>
						!line.packagingId ||
						line.quantity <= 0 ||
						line.unitPrice < 0 ||
						(input.type === "DOMESTIC_INVENTORY" && !line.warehouseId),
				)
			) {
				throw new Error("Kiểm tra lại hàng hóa, kho, số lượng và đơn giá");
			}
			const payload = { ...input, details: lines };
			return editing
				? apiV1<PurchaseDocument>(`/api/v1/purchase-documents/${editing.id}`, {
						method: "PUT",
						body: JSON.stringify({ ...payload, version: editing.version }),
					})
				: apiV1<PurchaseDocument>("/api/v1/purchase-documents", {
						method: "POST",
						body: JSON.stringify(payload),
					});
		},
		onSuccess: response => {
			toast.success(response.message);
			setSelected(response.data);
			setOpen(false);
			setEditing(null);
			invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const actionMutation = useMutation({
		mutationFn: ({
			document,
			action,
			reason,
		}: {
			document: PurchaseDocument;
			action: "post" | "cancel";
			reason?: string;
		}) =>
			apiV1<PurchaseDocument>(
				`/api/v1/purchase-documents/${document.id}/${action}`,
				{
					method: "POST",
					body: JSON.stringify(
						action === "cancel"
							? { version: document.version, reason }
							: { version: document.version },
					),
				},
			),
		onSuccess: response => {
			toast.success(response.message);
			setSelected(null);
			invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const deleteMutation = useMutation({
		mutationFn: (document: PurchaseDocument) =>
			apiV1<PurchaseDocument>(
				`/api/v1/purchase-documents/${document.id}/delete`,
				{
					method: "POST",
					body: JSON.stringify({ version: document.version }),
				},
			),
		onSuccess: response => {
			toast.success(response.message);
			setSelected(null);
			invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const openCreate = () => {
		setEditing(null);
		setLines([emptyLine()]);
		form.reset({
			documentDate: today(),
			dueDate: "",
			type: "DOMESTIC_INVENTORY",
			paymentIntent: "UNPAID",
			paymentMethod: "CASH",
			invoiceOption: "WITH_INVOICE",
			supplierId: references.data?.suppliers[0]?.id || 0,
			deliveryPerson: "",
			buyerName: "",
			description: "",
			purchaseCost: 0,
		});
		setOpen(true);
	};
	const openEdit = (document: PurchaseDocument) => {
		setEditing(document);
		setLines(
			document.details.map(line => ({
				packagingId: line.packagingId,
				warehouseId: line.warehouseId || 0,
				quantity: Number(line.quantity),
				unitPrice: Number(line.unitPrice),
				taxRate: Number(line.taxRate),
				note: line.note || "",
			})),
		);
		form.reset({
			documentDate: document.documentDate,
			dueDate: document.dueDate || "",
			type: document.type,
			paymentIntent: document.paymentIntent || "UNPAID",
			paymentMethod: document.paymentMethod || "CASH",
			invoiceOption: document.invoiceOption,
			supplierId: document.supplierId,
			deliveryPerson: document.deliveryPerson || "",
			buyerName: document.buyerName || "",
			description: document.description || "",
			purchaseCost: Number(document.purchaseCost),
		});
		setOpen(true);
	};
	const updateLine = (index: number, patch: Partial<Line>) =>
		setLines(current =>
			current.map((line, position) =>
				position === index ? { ...line, ...patch } : line,
			),
		);
	const goods = lines.reduce(
		(sum, line) => sum + Number(line.quantity) * Number(line.unitPrice),
		0,
	);
	const tax = lines.reduce(
		(sum, line) =>
			sum +
			(Number(line.quantity) * Number(line.unitPrice) * Number(line.taxRate)) /
				100,
		0,
	);
	const total = goods + tax + purchaseCost;
	const rows = documents.data?.data || [];
	const meta = documents.data?.meta as any;

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Mua hàng</h1>
					<p>Quản lý việc mua hàng, lập chứng từ mua hàng đến nhập kho</p>
				</div>
				<button
					className="erp-btn erp-btn-primary"
					onClick={openCreate}
					disabled={!references.data?.suppliers.length}
				>
					<Plus size={17} /> Thêm chứng từ
				</button>
			</div>
			<div className="grid gap-4 md:grid-cols-3">
				<div className="erp-stat">
					<ShoppingBag />
					<div>
						<span>Tổng chứng từ</span>
						<strong>{meta?.total || 0}</strong>
					</div>
				</div>
				<div className="erp-stat">
					<FileClock />
					<div>
						<span>Chứng từ nháp trang này</span>
						<strong>
							{rows.filter(x => x.documentStatus === "DRAFT").length}
						</strong>
					</div>
				</div>
				<div className="erp-stat">
					<Banknote />
					<div>
						<span>Tổng thanh toán trang này</span>
						<strong>
							{formatNumber(
								rows.reduce((sum, row) => sum + Number(row.totalAmount), 0),
							)}{" "}
							₫
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
							onChange={event => {
								setSearch(event.target.value);
								setPage(1);
							}}
							placeholder="Tìm số chứng từ, nhà cung cấp..."
						/>
					</div>
					<select
						value={status}
						onChange={event => {
							setStatus(event.target.value as any);
							setPage(1);
						}}
					>
						<option value="">Tất cả trạng thái</option>
						<option value="DRAFT">Nháp</option>
						<option value="POSTED">Đã ghi sổ</option>
						<option value="CANCELLED">Đã hủy</option>
					</select>
				</div>
				{documents.isLoading ? (
					<div className="p-12 text-center">Đang tải chứng từ...</div>
				) : documents.isError ? (
					<div className="p-12 text-center text-red-600">
						{(documents.error as Error).message}
					</div>
				) : rows.length === 0 ? (
					<div className="erp-empty">
						<PackagePlus size={48} />
						<p>Chưa có bảng giá nào</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="erp-table">
							<thead>
								<tr>
									<th>Số chứng từ / Ngày</th>
									<th>Nhà cung cấp</th>
									<th>Trạng thái</th>
									<th className="text-right">Tiền hàng</th>
									<th className="text-right">Thanh toán</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{rows.map(document => (
									<tr key={document.id}>
										<td>
											<button
												className="font-semibold text-emerald-700"
												onClick={() => setSelected(document)}
											>
												{document.code}
											</button>
											<small>
												{formatDate(document.documentDate)} · v
												{document.version}
											</small>
										</td>
										<td>
											<b>{document.supplierName}</b>
											<small>{document.supplierCode}</small>
										</td>
										<td>
											<span
												className={`erp-badge ${statusMeta[document.documentStatus || "POSTED"].css}`}
											>
												{statusMeta[document.documentStatus || "POSTED"].label}
											</span>
											{document.paymentStatus === "PAID" && (
												<small>Đã thanh toán</small>
											)}
										</td>
										<td className="text-right">
											{formatNumber(document.goodsAmount)} ₫
										</td>
										<td className="text-right font-semibold">
											{formatNumber(document.totalAmount)} ₫
										</td>
										<td>
											<div className="flex justify-end gap-1">
												<button
													className="erp-icon-btn"
													onClick={() => setSelected(document)}
													title="Xem"
												>
													<Eye size={16} />
												</button>
												{document.documentStatus === "DRAFT" && (
													<>
														<button
															className="erp-icon-btn"
															onClick={() => openEdit(document)}
															title="Sửa"
														>
															<Edit size={16} />
														</button>
														<button
															className="erp-icon-btn text-emerald-700"
															onClick={() =>
																actionMutation.mutate({
																	document,
																	action: "post",
																})
															}
															title="Ghi sổ"
														>
															<CheckCircle2 size={17} />
														</button>
														<button
															className="erp-icon-btn text-red-600"
															onClick={() => {
																if (
																	window.confirm(
																		`Xóa chứng từ ${document.code}?`,
																	)
																)
																	deleteMutation.mutate(document);
															}}
															title="Xóa"
														>
															<Trash2 size={16} />
														</button>
													</>
												)}
												{document.documentStatus === "POSTED" &&
													document.links?.some(
														link => link.linkType === "PAYABLE_CHARGE",
													) && (
														<button
															className="erp-icon-btn text-red-500"
															onClick={() => {
																const reason = window.prompt(
																	"Nhập lý do hủy chứng từ:",
																);
																if (reason)
																	actionMutation.mutate({
																		document,
																		action: "cancel",
																		reason,
																	});
															}}
															title="Hủy và đảo"
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
				)}
				{meta?.totalPages > 1 && (
					<div className="flex justify-end gap-2 p-3">
						<button
							className="erp-btn"
							disabled={page <= 1}
							onClick={() => setPage(value => value - 1)}
						>
							Trước
						</button>
						<span className="px-3 py-2 text-sm">
							Trang {page}/{meta.totalPages}
						</span>
						<button
							className="erp-btn"
							disabled={page >= meta.totalPages}
							onClick={() => setPage(value => value + 1)}
						>
							Sau
						</button>
					</div>
				)}
			</div>
			{open && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-6xl">
						<div className="erp-modal-header">
							<div>
								<h2>
									{editing ? "Sửa chứng từ nháp" : "Thêm chứng từ mua hàng"}
								</h2>
								<p>Lưu nháp không ảnh hưởng kho và công nợ</p>
							</div>
							<button onClick={() => setOpen(false)}>
								<X />
							</button>
						</div>
						<form
							onSubmit={form.handleSubmit(values =>
								saveMutation.mutate(values),
							)}
						>
							<div className="erp-modal-body space-y-5">
								<div className="grid gap-4 md:grid-cols-4">
									<label>
										Loại chứng từ
										<select {...form.register("type")}>
											<option value="DOMESTIC_INVENTORY">Mua nhập kho</option>
											<option value="DOMESTIC_NO_INVENTORY">
												Không qua kho
											</option>
										</select>
									</label>
									<label>
										Nhà cung cấp
										<select
											{...form.register("supplierId", { valueAsNumber: true })}
										>
											<option value="0">Chọn nhà cung cấp</option>
											{references.data?.suppliers.map(s => (
												<option key={s.id} value={s.id}>
													{s.code} - {s.name}
												</option>
											))}
										</select>
										<small className="text-red-500">
											{form.formState.errors.supplierId?.message}
										</small>
									</label>
									<label>
										Ngày chứng từ
										<input type="date" {...form.register("documentDate")} />
									</label>
									<label>
										Hạn thanh toán
										<input type="date" {...form.register("dueDate")} />
									</label>
									<label>
										Ý định thanh toán
										<select {...form.register("paymentIntent")}>
											<option value="UNPAID">Chưa thanh toán</option>
											<option value="PAID">Thanh toán khi ghi sổ</option>
										</select>
									</label>
									<label>
										Phương thức
										<select {...form.register("paymentMethod")}>
											<option value="CASH">Tiền mặt</option>
											<option value="BANK">Chuyển khoản</option>
										</select>
									</label>
									<label>
										Hóa đơn
										<select {...form.register("invoiceOption")}>
											<option value="WITH_INVOICE">Có hóa đơn GTGT</option>
											<option value="NO_INVOICE">Không có hóa đơn</option>
										</select>
									</label>
									<label>
										Người giao
										<input {...form.register("deliveryPerson")} />
									</label>
								</div>
								<div className="overflow-x-auto border rounded">
									<table className="erp-table">
										<thead>
											<tr>
												<th>Hàng hóa / Quy cách</th>
												{type === "DOMESTIC_INVENTORY" && <th>Kho</th>}
												<th>SL</th>
												<th>Đơn giá</th>
												<th>Thuế %</th>
												<th className="text-right">Thành tiền</th>
												<th></th>
											</tr>
										</thead>
										<tbody>
											{lines.map((line, index) => (
												<tr key={index}>
													<td className="min-w-64">
														<SearchableSelect
															value={line.packagingId}
															options={productSearchOptions}
															onChange={packagingId =>
																applyPackagingCost(index, packagingId)
															}
															placeholder="Nhập tên/SKU để chọn hàng hóa"
															required
														/>
													</td>
													{type === "DOMESTIC_INVENTORY" && (
														<td>
															<select
																value={line.warehouseId || 0}
																onChange={event =>
																	updateLine(index, {
																		warehouseId: +event.target.value,
																	})
																}
															>
																<option value={0}>Chọn kho</option>
																{references.data?.warehouses.map(w => (
																	<option key={w.id} value={w.id}>
																		{w.name}
																	</option>
																))}
															</select>
														</td>
													)}
													<td>
														<input
															className="w-24"
															type="number"
															min="0.0001"
															step="any"
															value={line.quantity}
															onChange={event =>
																updateLine(index, {
																	quantity: +event.target.value,
																})
															}
														/>
													</td>
													<td>
														<input
															className="w-32"
															type="number"
															min="0"
															step="any"
															value={line.unitPrice}
															onChange={event =>
																updateLine(index, {
																	unitPrice: +event.target.value,
																})
															}
														/>
													</td>
													<td>
														<input
															className="w-20"
															type="number"
															min="0"
															max="100"
															value={line.taxRate}
															onChange={event =>
																updateLine(index, {
																	taxRate: +event.target.value,
																})
															}
														/>
													</td>
													<td className="text-right font-semibold">
														{formatNumber(
															line.quantity *
																line.unitPrice *
																(1 + line.taxRate / 100),
														)}
													</td>
													<td>
														<button
															type="button"
															className="erp-icon-btn text-red-500"
															disabled={lines.length === 1}
															onClick={() =>
																setLines(current =>
																	current.filter(
																		(_, position) => position !== index,
																	),
																)
															}
														>
															<X size={15} />
														</button>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
								<button
									type="button"
									className="erp-btn"
									onClick={() => setLines(current => [...current, emptyLine()])}
								>
									<Plus size={15} /> Thêm dòng
								</button>
								<div className="grid gap-4 md:grid-cols-2">
									<label>
										Diễn giải
										<textarea rows={3} {...form.register("description")} />
									</label>
									<div className="ml-auto w-full max-w-sm space-y-2">
										<div className="flex justify-between">
											<span>Tiền hàng</span>
											<b>{formatNumber(goods)} ₫</b>
										</div>
										<div className="flex justify-between">
											<span>Thuế</span>
											<b>{formatNumber(tax)} ₫</b>
										</div>
										<div className="flex items-center justify-between">
											<span>Chi phí mua</span>
											<input
												className="w-32"
												type="number"
												min="0"
												{...form.register("purchaseCost", {
													valueAsNumber: true,
												})}
											/>
										</div>
										<div className="flex justify-between border-t pt-2 text-lg text-emerald-700">
											<b>Tổng thanh toán</b>
											<b>{formatNumber(total)} ₫</b>
										</div>
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
									disabled={saveMutation.isPending}
									className="erp-btn erp-btn-primary"
								>
									{saveMutation.isPending ? "Đang lưu..." : "Lưu nháp"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
			{selected && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-4xl">
						<div className="erp-modal-header">
							<div>
								<h2>{selected.code}</h2>
								<p>
									{selected.supplierName} ·{" "}
									{statusMeta[selected.documentStatus || "POSTED"].label}
								</p>
							</div>
							<button onClick={() => setSelected(null)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							<table className="erp-table">
								<thead>
									<tr>
										<th>Hàng hóa</th>
										<th>Kho</th>
										<th>SL</th>
										<th className="text-right">Đơn giá</th>
										<th className="text-right">Tiền + thuế</th>
									</tr>
								</thead>
								<tbody>
									{selected.details.map(line => (
										<tr key={line.id}>
											<td>
												{line.productName} - {line.packagingName}
												<small>{line.sku}</small>
											</td>
											<td>{line.warehouseName || "-"}</td>
											<td>
												{formatNumber(line.quantity)} {line.unit}
											</td>
											<td className="text-right">
												{formatNumber(line.unitPrice)}
											</td>
											<td className="text-right font-semibold">
												{formatNumber(
													Number(line.lineAmount) + Number(line.taxAmount),
												)}{" "}
												₫
											</td>
										</tr>
									))}
								</tbody>
							</table>
							<div className="rounded bg-slate-50 p-3">
								<b>Chứng từ liên quan</b>
								{selected.links?.length ? (
									<div className="mt-2 flex flex-wrap gap-2">
										{selected.links.map(link => {
											const linkedCode =
												link.linkedCode || String(link.linkedId);
											return (
												<span
													className="erp-badge bg-blue-100 text-blue-700 cursor-pointer hover:bg-blue-200"
													key={link.id}
													onClick={() => {
														if (!linkedCode) return;
														if (link.linkType === "INVENTORY_RECEIPT") {
															window.open(
																`/inventory-import?code=${encodeURIComponent(linkedCode)}`,
																"_blank",
															);
														} else if (link.linkType === "INVENTORY_ISSUE") {
															window.open(
																`/inventory-export?code=${encodeURIComponent(linkedCode)}`,
																"_blank",
															);
														} else if (
															link.linkType === "PAYMENT_VOUCHER" ||
															link.linkType === "PAYMENT_RECEIPT"
														) {
															window.open(
																`/debt?vouchers&search=${encodeURIComponent(linkedCode)}`,
																"_blank",
															);
														} else if (link.linkType === "PRODUCTION") {
															window.open(
																`/production-mgmt?code=${encodeURIComponent(linkedCode)}`,
																"_blank",
															);
														} else {
															window.open(
																`/purchases?search=${encodeURIComponent(linkedCode)}`,
																"_blank",
															);
														}
													}}
													title={`Mở ${linkTypeLabel(link.linkType)}: ${linkedCode}`}
												>
													{linkTypeLabel(link.linkType)}: {linkedCode}
												</span>
											);
										})}
									</div>
								) : (
									<p className="mt-1 text-sm text-slate-400">
										Chưa phát sinh ledger hoặc chứng từ liên kết.
									</p>
								)}
							</div>
							{selected.cancelReason && (
								<div className="rounded bg-red-50 p-3 text-red-700">
									Lý do hủy: {selected.cancelReason}
								</div>
							)}
							<div className="mt-4 ml-auto w-fit p-4 text-right bg-emerald-50 border-2 border-emerald-200 rounded-xl">
								<div className="text-sm text-emerald-700 font-medium uppercase tracking-wider mb-1">
									Tổng thanh toán
								</div>
								<div className="text-2xl font-extrabold text-emerald-800">
									{formatNumber(selected.totalAmount)} ₫
								</div>
							</div>
						</div>
						<div className="erp-modal-footer">
							<button
								type="button"
								className="erp-btn"
								onClick={() => setPrintTarget(selected)}
							>
								<Printer size={16} /> In chứng từ
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
			<PrintPreview
				open={!!printTarget}
				title={
					printTarget
						? `Xem trước chứng từ mua hàng ${printTarget.code}`
						: "Xem trước in"
				}
				fill={
					printTarget
						? (workbook: any, company: any) => {
								const worksheet = workbook.addWorksheet("Sheet1");
								fillGenericDocument(
									worksheet,
									company as CompanyPrintProfile | null,
									GENERIC_LAYOUTS.purchase,
									{
										code: printTarget.code,
										documentDate: printTarget.documentDate,
										partner: [
											printTarget.supplierName,
											printTarget.supplierTaxCode
												? `MST: ${printTarget.supplierTaxCode}`
												: "",
										]
											.filter(Boolean)
											.join(" - "),
										dienGiai: printTarget.description || "",
										total: Number(printTarget.goodsAmount || 0),
										rows: printTarget.details.map((line, index) => ({
											stt: index + 1,
											sku: line.sku || "",
											name: [line.productName, line.packagingName]
												.filter(Boolean)
												.join(" - "),
											unit: line.unit || "",
											quantity: Number(line.quantity || 0),
											unitPrice: Number(line.unitPrice || 0),
											amount: Number(
												line.lineAmount ?? line.quantity * line.unitPrice,
											),
										})),
									},
								);
							}
						: null
				}
				onClose={() => setPrintTarget(null)}
			/>
		</div>
	);
}
