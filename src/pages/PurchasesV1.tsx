import React, { useMemo, useRef, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
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
import toast from "../components/ui/toast";
import { confirm, prompt } from "../components/ui/confirm";
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
import { PurchaseDocumentPrint } from "../components/PurchaseDocumentPrint";
import { buildCompanyPrintProfile } from "../lib/printTemplate";
import { useMultiEscapeKey } from "../hooks/useEscapeKey";
import { DateInput } from "../components/DateRangeCalendar";

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
	const [supplierModal, setSupplierModal] = useState(false);
	const [supplierSaving, setSupplierSaving] = useState(false);
	const [nextSupplierCode, setNextSupplierCode] = useState("NCC00001");
	const [supplierForm, setSupplierForm] = useState({
		name: "",
		phone: "",
		taxCode: "",
		address: "",
		contactPerson: "",
		paymentTermDays: 0,
	});

	useMultiEscapeKey([
		{ isOpen: open, onClose: () => setOpen(false), priority: 1 },
		{ isOpen: !!editing, onClose: () => setEditing(null), priority: 2 },
		{ isOpen: !!selected, onClose: () => setSelected(null), priority: 3 },
		{ isOpen: !!printTarget, onClose: () => setPrintTarget(null), priority: 4 },
		{
			isOpen: supplierModal,
			onClose: () => setSupplierModal(false),
			priority: 5,
		},
	]);

	// In chứng từ mua hàng (xem trước + in HTML, cùng giao diện phiếu nhập kho)
	const printRef = useRef<HTMLDivElement>(null);
	const handlePrintReport = useReactToPrint({
		contentRef: printRef,
		documentTitle: printTarget
			? `Chung-tu-mua-hang-${printTarget.code}`
			: "Chung-tu-mua-hang",
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

	const supplierSearchOptions = useMemo(
		() =>
			(references.data?.suppliers || []).map(supplier => ({
				value: supplier.id,
				label: supplier.code
					? `${supplier.code} - ${supplier.name}`
					: supplier.name,
				subLabel:
					[
						supplier.phone ? `ĐT: ${supplier.phone}` : "",
						supplier.taxCode ? `MST: ${supplier.taxCode}` : "",
					]
						.filter(Boolean)
						.join(" · ") || undefined,
			})),
		[references.data],
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
	// Mở popup tạo nhanh NCC + lấy mã tự sinh
	const openSupplierModal = async () => {
		setSupplierForm({
			name: "",
			phone: "",
			taxCode: "",
			address: "",
			contactPerson: "",
			paymentTermDays: 0,
		});
		setSupplierModal(true);
		try {
			const res = await fetch("/api/next-code/supplier", {
				headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
			});
			if (res.ok) {
				const data = await res.json();
				if (data.code) setNextSupplierCode(data.code);
			}
		} catch {
			// Giữ mã mặc định khi không lấy được sequence
		}
	};
	// Lưu NCC mới rồi tự động chọn vào chứng từ đang lập
	const saveSupplier = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!supplierForm.name.trim()) {
			toast.error("Tên nhà cung cấp là bắt buộc");
			return;
		}
		setSupplierSaving(true);
		try {
			const res = await fetch("/api/suppliers", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
				body: JSON.stringify({
					code: nextSupplierCode,
					name: supplierForm.name.trim(),
					phone: supplierForm.phone.trim(),
					taxCode: supplierForm.taxCode.trim(),
					address: supplierForm.address.trim(),
					contactPerson: supplierForm.contactPerson.trim(),
					paymentTermDays: Math.max(
						0,
						Number(supplierForm.paymentTermDays) || 0,
					),
				}),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok)
				throw new Error(data.error || data.message || "Có lỗi xảy ra");
			const newId = Number(data.id || 0);
			toast.success("Đã thêm nhà cung cấp");
			setSupplierModal(false);
			await queryClient.refetchQueries({ queryKey: ["purchase-references"] });
			if (newId) form.setValue("supplierId", newId, { shouldValidate: true });
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Có lỗi hệ thống");
		} finally {
			setSupplierSaving(false);
		}
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
												{formatDate(document.documentDate)}
												{/* · v {document.version} */}
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
															onClick={async () => {
																if (
																	await confirm(
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
												{document.documentStatus === "CANCELLED" && (
													<button
														className="erp-icon-btn text-red-600"
														onClick={async () => {
															if (
																await confirm(
																	`Xóa chứng từ đã hủy ${document.code}?`,
																)
															)
																deleteMutation.mutate(document);
														}}
														title="Xóa"
													>
														<Trash2 size={16} />
													</button>
												)}
												{document.documentStatus === "POSTED" &&
													document.links?.some(
														link => link.linkType === "PAYABLE_CHARGE",
													) && (
														<button
															className="erp-icon-btn text-red-500"
															onClick={async () => {
																const reason = await prompt({
																	title: "Hủy chứng từ mua hàng",
																	message: "Nhập lý do hủy chứng từ:",
																	minLength: 3,
																});
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
										<div className="flex gap-2">
											<div className="min-w-0 flex-1">
												<SearchableSelect
													value={form.watch("supplierId") || 0}
													options={supplierSearchOptions}
													onChange={supplierId =>
														form.setValue("supplierId", supplierId, {
															shouldValidate: true,
														})
													}
													placeholder="Nhập tên/mã/SĐT nhà cung cấp"
													required
												/>
											</div>
											<button
												type="button"
												title="Thêm nhà cung cấp mới"
												onClick={() => void openSupplierModal()}
												className="erp-btn erp-btn-primary shrink-0 !px-3"
											>
												<Plus size={16} />
											</button>
										</div>
										<small className="text-red-500">
											{form.formState.errors.supplierId?.message}
										</small>
									</label>
									<label>
										Ngày chứng từ
										<DateInput
											value={form.watch("documentDate") || ""}
											onChange={value =>
												form.setValue("documentDate", value, {
													shouldValidate: true,
												})
											}
										/>
										<small className="text-red-500">
											{form.formState.errors.documentDate?.message}
										</small>
									</label>
									<label>
										Hạn thanh toán
										<DateInput
											value={form.watch("dueDate") || ""}
											placeholder="Không thời hạn"
											onChange={value =>
												form.setValue("dueDate", value, {
													shouldValidate: true,
												})
											}
										/>
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
							{selected.documentStatus === "DRAFT" && (
								<button
									type="button"
									className="erp-btn erp-btn-post"
									disabled={actionMutation.isPending}
									onClick={() =>
										actionMutation.mutate({
											document: selected,
											action: "post",
										})
									}
								>
									<CheckCircle2 size={16} />{" "}
									{actionMutation.isPending ? "Đang ghi sổ..." : "Ghi sổ"}
								</button>
							)}
							{selected.documentStatus === "POSTED" && (
								<button
									type="button"
									className="erp-btn erp-btn-unpost"
									disabled={actionMutation.isPending}
									onClick={async () => {
										const reason = await prompt({
											title: "Bỏ ghi chứng từ mua hàng",
											message: "Nhập lý do bỏ ghi:",
											minLength: 3,
										});
										if (reason)
											actionMutation.mutate({
												document: selected,
												action: "cancel",
												reason,
											});
									}}
								>
									<Undo2 size={16} /> Bỏ ghi
								</button>
							)}
							{selected.documentStatus === "CANCELLED" && (
								<button
									type="button"
									className="erp-btn !border-red-200 !bg-red-50 !text-red-700 hover:!bg-red-100"
									onClick={async () => {
										if (await confirm(`Xóa chứng từ đã hủy ${selected.code}?`))
											deleteMutation.mutate(selected);
									}}
								>
									<Trash2 size={16} /> Xóa
								</button>
							)}
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
			{supplierModal && (
				<div className="erp-modal-backdrop" style={{ zIndex: 300 }}>
					<div className="erp-modal max-w-2xl">
						<div className="erp-modal-header">
							<div>
								<h2>Thêm nhà cung cấp mới</h2>
								<p>
									Nhà cung cấp mới sẽ được tự động chọn vào chứng từ đang lập
								</p>
							</div>
							<button type="button" onClick={() => setSupplierModal(false)}>
								<X size={18} />
							</button>
						</div>
						<form onSubmit={saveSupplier}>
							<div className="erp-modal-body space-y-4">
								<div className="grid gap-4 md:grid-cols-2">
									<label>
										Mã nhà cung cấp (tự sinh)
										<input
											type="text"
											readOnly
											value={nextSupplierCode}
											className="font-mono bg-slate-50 text-slate-600"
										/>
									</label>
									<label>
										Số điện thoại
										<input
											type="text"
											placeholder="09xxx..."
											value={supplierForm.phone}
											onChange={e =>
												setSupplierForm({
													...supplierForm,
													phone: e.target.value,
												})
											}
										/>
									</label>
									<label className="md:col-span-2">
										Tên nhà cung cấp <span className="text-red-500">*</span>
										<input
											type="text"
											required
											placeholder="Công ty TNHH..."
											value={supplierForm.name}
											onChange={e =>
												setSupplierForm({
													...supplierForm,
													name: e.target.value,
												})
											}
										/>
									</label>
									<label>
										Mã số thuế
										<input
											type="text"
											placeholder="370xxxxx..."
											value={supplierForm.taxCode}
											onChange={e =>
												setSupplierForm({
													...supplierForm,
													taxCode: e.target.value,
												})
											}
										/>
									</label>
									<label>
										Người liên hệ
										<input
											type="text"
											placeholder="Nguyễn Văn A"
											value={supplierForm.contactPerson}
											onChange={e =>
												setSupplierForm({
													...supplierForm,
													contactPerson: e.target.value,
												})
											}
										/>
									</label>
									<label>
										Công nợ (ngày)
										<input
											type="number"
											min="0"
											value={supplierForm.paymentTermDays}
											onChange={e =>
												setSupplierForm({
													...supplierForm,
													paymentTermDays: Number(e.target.value) || 0,
												})
											}
										/>
									</label>
									<label className="md:col-span-2">
										Địa chỉ
										<textarea
											rows={2}
											placeholder="Số nhà, đường, phường/xã..."
											value={supplierForm.address}
											onChange={e =>
												setSupplierForm({
													...supplierForm,
													address: e.target.value,
												})
											}
										/>
									</label>
								</div>
							</div>
							<div className="erp-modal-footer">
								<button
									type="button"
									className="erp-btn"
									onClick={() => setSupplierModal(false)}
								>
									Hủy
								</button>
								<button
									className="erp-btn erp-btn-primary"
									disabled={supplierSaving}
								>
									{supplierSaving ? "Đang lưu..." : "Thêm nhà cung cấp"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
			{printTarget && (
				<div className="sales-print-view fixed inset-0 z-[9999] flex flex-col bg-gray-900/90 backdrop-blur-md">
					<div className="bg-white border-b p-4 flex items-center justify-between no-print shadow-md">
						<div className="flex items-center gap-4">
							<h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">
								Chứng từ mua hàng
							</h3>
							<span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-500">
								{printTarget.code}
							</span>
						</div>
						<div className="flex items-center gap-3">
							<button
								onClick={() => setPrintTarget(null)}
								className="px-6 py-2 border rounded-lg font-black text-gray-500 hover:bg-gray-50 transition-all uppercase text-[10px] tracking-widest"
							>
								Đóng
							</button>
							<button
								onClick={handlePrintReport}
								className="px-10 py-2 bg-indigo-600 text-white rounded-lg font-black hover:bg-indigo-700 transition-all shadow-lg uppercase text-[10px] tracking-widest flex items-center gap-2"
							>
								<Printer size={16} /> In chứng từ ngay
							</button>
						</div>
					</div>
					<div className="flex-1 overflow-auto p-8 bg-gray-200/50">
						<div
							ref={printRef}
							className="sales-print-view shadow-2xl bg-white mx-auto mb-8 w-[210mm] max-w-full"
						>
							<PurchaseDocumentPrint
								document={printTarget}
								company={companyQuery.data}
							/>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
