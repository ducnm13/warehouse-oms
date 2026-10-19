import React, { useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	Check,
	ChevronRight,
	CircleDollarSign,
	Edit,
	FileSpreadsheet,
	PackageCheck,
	PackagePlus,
	Plus,
	Printer,
	Search,
	Send,
	ShoppingCart,
	Trash2,
	Undo2,
	X,
} from "lucide-react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import toast from "react-hot-toast";
import type {
	Customer,
	Product,
	SalesOrder,
	SalesOrderDetail,
	Warehouse,
} from "../types";
import { apiV1, legacyApi } from "../lib/apiV1";
import SearchableSelect from "../components/SearchableSelect";
import Button from "../components/ui/button";
import Badge from "../components/ui/badge";
import { Card } from "../components/ui/card";
import { formatDate, formatNumber } from "../lib/utils";
import {
	applyCompanyHeader,
	buildCompanyPrintProfile,
	numberToVietnameseWords,
	type CompanyPrintProfile,
} from "../lib/printTemplate";

const headerSchema = z.object({
	code: z.string().trim().max(20).default(""),
	orderDate: z.string().min(1, "Chọn ngày đơn"),
	deliveryDate: z.string().optional(),
	dueDate: z.string().optional(),
	customerId: z.number().positive("Chọn khách hàng"),
	warehouseId: z.number().positive("Chọn kho xuất"),
	taxRate: z.number().min(0).max(100),
	orderDiscountRate: z.number().min(0).max(100).default(0),
	paymentIntent: z.enum(["UNPAID", "PAID"]),
	paymentMethod: z.enum(["CASH", "BANK"]),
	note: z.string().max(1000),
});
type HeaderForm = z.infer<typeof headerSchema>;
type Line = Pick<
	SalesOrderDetail,
	"packagingId" | "quantity" | "unitPrice" | "discountRate" | "note"
> & {
	lineType?: "SALE" | "PROMOTION";
	promotionProgramId?: number;
	promotionCode?: string;
	promotionName?: string;
};
type GiftPreview = {
	packagingId: number;
	quantity: number;
	unitPrice: 0;
	discountRate: 0;
	note: string;
	lineType: "PROMOTION";
	promotionProgramId: number;
	promotionCode: string;
	promotionName: string;
};
type V1Status =
	| "DRAFT"
	| "PENDING"
	| "APPROVED"
	| "REJECTED"
	| "POSTED"
	| "CANCELLED";

const tokenHeader = () => ({
	Authorization: `Bearer ${localStorage.getItem("token")}`,
});
const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): Line => ({
	packagingId: 0,
	quantity: 1,
	unitPrice: 0,
	discountRate: 0,
	note: "",
	lineType: "SALE",
});
const statusMeta: Record<
	V1Status,
	{ label: string; css: string; row: string }
> = {
	DRAFT: {
		label: "Nháp",
		css: "bg-slate-100 text-slate-600",
		row: "bg-slate-50",
	},
	PENDING: {
		label: "Chờ duyệt",
		css: "bg-amber-100 text-amber-700",
		row: "bg-amber-50/70",
	},
	APPROVED: {
		label: "Đã duyệt",
		css: "bg-blue-100 text-blue-700",
		row: "bg-blue-50/70",
	},
	REJECTED: {
		label: "Từ chối",
		css: "bg-red-100 text-red-700",
		row: "bg-red-50/70",
	},
	POSTED: {
		label: "Đã ghi sổ",
		css: "bg-emerald-100 text-emerald-700",
		row: "",
	},
	CANCELLED: {
		label: "Đã hủy",
		css: "bg-rose-100 text-rose-700",
		row: "bg-rose-50/60",
	},
};

const cloneRowStyle = (source: ExcelJS.Row, target: ExcelJS.Row) => {
	target.height = source.height;
	for (let column = 1; column <= 14; column++) {
		const sourceCell = source.getCell(column),
			targetCell = target.getCell(column);
		targetCell.style = { ...sourceCell.style };
		targetCell.numFmt = sourceCell.numFmt;
	}
};

export default function SalesOrdersV1() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<"" | V1Status>("");
	const [page, setPage] = useState(1);
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState<SalesOrder | null>(null);
	const [selected, setSelected] = useState<SalesOrder | null>(null);
	const [paymentOrder, setPaymentOrder] = useState<SalesOrder | null>(null);
	const [paymentAmount, setPaymentAmount] = useState(0);
	const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK">("BANK");
	const [paymentNote, setPaymentNote] = useState("");
	const [relatedDetail, setRelatedDetail] = useState<{
		type: string;
		code: string;
		data: any;
	} | null>(null);
	const [relatedLoading, setRelatedLoading] = useState(false);
	const [inventoryIssues, setInventoryIssues] = useState<any[]>([]);
	const [inventoryLoading, setInventoryLoading] = useState(false);
	const relatedTypeMeta: Record<string, string> = {
		INVENTORY_ISSUE: "Phiếu xuất kho",
		INVENTORY_REVERSAL: "Phiếu đảo kho",
		RECEIVABLE_CHARGE: "Phải thu phát sinh",
		RECEIVABLE_PAYMENT: "Thu tiền khách hàng",
		RECEIVABLE_REVERSAL: "Đảo phải thu",
		PAYMENT_RECEIPT: "Phiếu thu tiền",
		PAYMENT_REVERSAL: "Phiếu đảo thu tiền",
	};
	const relatedTypeLabel = (type: string) => relatedTypeMeta[type] || type;
	const [lines, setLines] = useState<Line[]>([emptyLine()]);
	const [promotionModal, setPromotionModal] = useState(false);
	const [promotionChoices, setPromotionChoices] = useState<
		Array<GiftPreview & { selected: boolean }>
	>([]);
	React.useEffect(() => {
		if (
			!open &&
			!selected &&
			!promotionModal &&
			!relatedDetail &&
			!paymentOrder
		)
			return;
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (paymentOrder) setPaymentOrder(null);
			else if (relatedDetail) setRelatedDetail(null);
			else if (promotionModal) setPromotionModal(false);
			else if (selected) setSelected(null);
			else if (open) setOpen(false);
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [open, selected, promotionModal, relatedDetail, paymentOrder]);
	const nextSalesCode = useQuery({
		queryKey: ["next-code-sales"],
		queryFn: async () => {
			const response = await apiV1<{ code: string }>("/api/v1/next-code/sales");
			return response.data?.code || "BH00001";
		},
		staleTime: 30_000,
	});
	const form = useForm({
		resolver: zodResolver(headerSchema),
		defaultValues: {
			code: "",
			orderDate: today(),
			deliveryDate: today(),
			dueDate: "",
			customerId: 0,
			warehouseId: 0,
			taxRate: 0,
			orderDiscountRate: 0,
			paymentIntent: "UNPAID",
			paymentMethod: "CASH",
			note: "",
		},
	});

	const references = useQuery({
		queryKey: ["sales-references"],
		queryFn: async () => {
			const [customers, warehouses, products, retailPrices] = await Promise.all(
				[
					legacyApi<Customer[]>("/api/customers"),
					legacyApi<Warehouse[]>("/api/warehouses"),
					legacyApi<Product[]>("/api/products?category=PRODUCT"),
					apiV1<
						Array<{ packagingId: number; priceType: string; price: number }>
					>("/api/v1/catalog/packaging-retail-prices")
						.then(response => response.data || [])
						.catch(() => []),
				],
			);
			const retailPriceMap = new Map<number, number>();
			for (const row of retailPrices as Array<{
				packagingId: number;
				price: number;
			}>) {
				retailPriceMap.set(row.packagingId, Number(row.price || 0));
			}
			return { customers, warehouses, products, retailPriceMap };
		},
	});
	const documents = useQuery({
		queryKey: ["sales-documents-v1", page, search, status],
		queryFn: () =>
			apiV1<SalesOrder[]>(
				`/api/v1/sales-documents?page=${page}&limit=20&search=${encodeURIComponent(search)}${status ? `&status=${status}` : ""}`,
			),
	});
	const orders = documents.data?.data || [];
	const meta = documents.data?.meta as any;
	const finishedGoodsWarehouseId = useMemo(() => {
		const warehouses = references.data?.warehouses || [];
		const byName = warehouses.find(warehouse =>
			warehouse.name.toLowerCase().includes("thành phẩm"),
		);
		return byName?.id || warehouses[0]?.id || 0;
	}, [references.data]);
	const packagingOptions = useMemo(
		() =>
			(references.data?.products || [])
				.filter(
					(product: any) => !product.category || product.category === "PRODUCT",
				)
				.flatMap(product =>
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
	const customerSearchOptions = useMemo(
		() =>
			(references.data?.customers || []).map(customer => ({
				value: customer.id,
				label: customer.code
					? `${customer.code} - ${customer.name}`
					: customer.name,
				subLabel: customer.phone ? `ĐT: ${customer.phone}` : undefined,
			})),
		[references.data],
	);
	const gross = lines.reduce(
		(sum, line) =>
			sum + Number(line.quantity || 0) * Number(line.unitPrice || 0),
		0,
	);
	const subtotal = lines.reduce(
		(sum, line) =>
			sum +
			Number(line.quantity || 0) *
				Number(line.unitPrice || 0) *
				(1 - Number(line.discountRate || 0) / 100),
		0,
	);
	const lineDiscountAmount = lines.reduce(
		(sum, line) =>
			sum +
			Number(line.quantity || 0) *
				Number(line.unitPrice || 0) *
				(Math.min(Math.max(Number(line.discountRate || 0), 0), 100) / 100),
		0,
	);
	const taxRate = Number(form.watch("taxRate") || 0);
	const orderDiscountRate = Math.min(
		Math.max(Number(form.watch("orderDiscountRate") || 0), 0),
		100,
	);
	const orderDiscountAmount = (subtotal * orderDiscountRate) / 100;
	const taxableAmount = subtotal - orderDiscountAmount;
	const taxAmount = (taxableAmount * taxRate) / 100;
	const total = taxableAmount + taxAmount;
	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["sales-documents-v1"] });

	const saveMutation = useMutation({
		mutationFn: (input: HeaderForm & { orderDiscountRate: number }) => {
			if (
				lines.some(
					line =>
						!line.packagingId ||
						line.quantity <= 0 ||
						line.unitPrice < 0 ||
						Number(line.discountRate || 0) < 0 ||
						Number(line.discountRate || 0) > 100,
				)
			)
				throw new Error("Chi tiết hàng hóa hoặc chiết khấu dòng không hợp lệ");
			if (
				Number(input.orderDiscountRate || 0) < 0 ||
				Number(input.orderDiscountRate || 0) > 100
			)
				throw new Error("Chiết khấu đơn phải từ 0 đến 100%");
			const { orderDiscountRate, ...rest } = input;
			const clampedOrderDiscount = Math.min(
				Math.max(Number(orderDiscountRate || 0), 0),
				100,
			);
			const normalizedLines = lines.map(line => ({
				...line,
				quantity: Number(line.quantity || 0),
				unitPrice: Number(line.unitPrice || 0),
				discountRate: Math.min(
					Math.max(Number(line.discountRate || 0), 0),
					100,
				),
				lineType: line.lineType || "SALE",
			}));
			const mergedDetails: typeof normalizedLines = [];
			for (const line of normalizedLines) {
				const existing = mergedDetails.find(
					item =>
						item.packagingId === line.packagingId &&
						item.unitPrice === line.unitPrice &&
						item.discountRate === line.discountRate &&
						(item.lineType || "SALE") === (line.lineType || "SALE") &&
						(item.promotionProgramId || 0) === (line.promotionProgramId || 0),
				);
				if (existing) {
					existing.quantity =
						Number(existing.quantity || 0) + Number(line.quantity || 0);
					existing.note = [existing.note, line.note].filter(Boolean).join("\n");
				} else {
					mergedDetails.push({ ...line });
				}
			}
			if (mergedDetails.some(line => !line.packagingId || line.quantity <= 0))
				throw new Error("Chi tiết hàng hóa sau khi gộp dòng không hợp lệ");
			const payload = {
				...rest,
				taxRate: Number(rest.taxRate || 0),
				code: rest.code || undefined,
				note: [
					rest.note || "",
					clampedOrderDiscount > 0
						? `Chiết khấu đơn ${clampedOrderDiscount}%`
						: "",
				]
					.filter(Boolean)
					.join("\n"),
				details: mergedDetails,
			};
			return editing
				? apiV1<SalesOrder>(`/api/v1/sales-documents/${editing.id}`, {
						method: "PUT",
						body: JSON.stringify({ ...payload, version: editing.version }),
					})
				: apiV1<SalesOrder>("/api/v1/sales-documents", {
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
		onError: (error: any) => {
			const fieldErrors = error?.fieldErrors
				? Object.entries(error.fieldErrors)
						.map(
							([field, messages]) =>
								`${field}: ${(messages as string[]).join(", ")}`,
						)
						.join("\n")
				: "";
			toast.error([error.message, fieldErrors].filter(Boolean).join("\n"));
		},
	});
	const actionMutation = useMutation({
		mutationFn: ({
			document,
			action,
			extra = {},
		}: {
			document: SalesOrder;
			action: string;
			extra?: Record<string, unknown>;
		}) =>
			apiV1<SalesOrder>(`/api/v1/sales-documents/${document.id}/${action}`, {
				method: "POST",
				body: JSON.stringify({ version: document.version, ...extra }),
			}),
		onSuccess: response => {
			toast.success(response.message);
			setSelected(response.data);
			invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const promotionPreview = useMutation({
		mutationFn: () => {
			const values = form.getValues();
			const saleLines = lines.filter(
				line =>
					line.packagingId > 0 &&
					line.quantity > 0 &&
					Number(line.unitPrice || 0) > 0,
			);
			const invalidLine = lines.find(
				line =>
					line.packagingId > 0 &&
					Number(line.unitPrice || 0) > 0 &&
					line.quantity <= 0,
			);
			const missingLine = lines.find(
				line =>
					Number(line.unitPrice || 0) > 0 &&
					line.quantity > 0 &&
					!line.packagingId,
			);
			if (!values.customerId) throw Error("Chưa chọn khách hàng cho đơn bán");
			if (!values.warehouseId) throw Error("Chưa chọn kho xuất cho đơn bán");
			if (!values.orderDate) throw Error("Chưa chọn ngày đơn bán");
			if (missingLine)
				throw Error(
					"Còn dòng bán chưa chọn hàng hóa, vui lòng chọn hàng hóa trước khi tính khuyến mãi",
				);
			if (invalidLine)
				throw Error(
					"Còn dòng bán có số lượng chưa hợp lệ, vui lòng nhập số lượng lớn hơn 0",
				);
			if (!saleLines.length)
				throw Error(
					"Chưa có dòng bán hợp lệ để tính khuyến mãi, vui lòng nhập hàng hóa, số lượng và đơn giá lớn hơn 0",
				);
			return apiV1<GiftPreview[]>("/api/v1/promotions/preview", {
				method: "POST",
				body: JSON.stringify({
					orderDate: values.orderDate,
					customerId: values.customerId,
					warehouseId: values.warehouseId,
					details: saleLines.map(line => ({
						packagingId: line.packagingId,
						quantity: line.quantity,
					})),
				}),
			});
		},
		onSuccess: response => {
			if (!response.data?.length) {
				setLines(current =>
					current.filter(line => Number(line.unitPrice || 0) > 0),
				);
				toast(
					"Không có chương trình phù hợp với khách hàng, kho, ngày đơn và số lượng hiện tại.",
					{ icon: "ℹ️" },
				);
			} else {
				const appliedKeys = new Set(
					lines
						.filter(
							line => Number(line.unitPrice || 0) === 0 && line.packagingId > 0,
						)
						.map(line => `${line.packagingId}`),
				);
				setPromotionChoices(
					response.data.map(gift => ({
						...gift,
						selected: appliedKeys.size
							? appliedKeys.has(`${gift.packagingId}`)
							: true,
					})),
				);
				setPromotionModal(true);
			}
		},
		onError: (error: Error) => toast.error(error.message),
	});

	const openCreate = () => {
		setEditing(null);
		setLines([emptyLine()]);
		promotionPreview.reset();
		form.reset({
			code: nextSalesCode.data || "BH00001",
			orderDate: today(),
			deliveryDate: today(),
			dueDate: "",
			customerId: references.data?.customers[0]?.id || 0,
			warehouseId: finishedGoodsWarehouseId,
			taxRate: 0,
			orderDiscountRate: 0,
			paymentIntent: "UNPAID",
			paymentMethod: "CASH",
			note: "",
		});
		setOpen(true);
	};
	const openEdit = (document: SalesOrder) => {
		if (document.status === "POSTED" || document.status === "CANCELLED") {
			toast.error(
				"Đơn đã ghi sổ phải bấm Bỏ ghi sổ để khôi phục tồn kho rồi mới sửa",
			);
			return;
		}
		if (
			document.status !== "DRAFT" &&
			document.status !== "REJECTED" &&
			document.status !== "APPROVED"
		) {
			toast.error("Trạng thái hiện tại không được sửa trực tiếp");
			return;
		}
		setEditing(document);
		setLines(
			document.details
				.filter(line => line.lineType !== "PROMOTION")
				.map(line => ({
					packagingId: line.packagingId,
					quantity: line.quantity,
					unitPrice: line.unitPrice,
					discountRate: line.discountRate,
					note: line.note || "",
					lineType: "SALE",
				})),
		);
		promotionPreview.reset();
		const rate = document.subtotal
			? (document.taxAmount / document.subtotal) * 100
			: 0;
		form.reset({
			orderDate: document.orderDate,
			deliveryDate: document.deliveryDate || "",
			dueDate: document.dueDate || "",
			customerId: document.customerId,
			warehouseId: document.warehouseId,
			taxRate: rate,
			paymentIntent: document.paymentIntent || "UNPAID",
			paymentMethod: document.paymentMethod || "CASH",
			note: document.note || "",
		});
		setOpen(true);
	};
	const mergeDuplicatePackagingLines = (
		rows: Line[],
	): { rows: Line[]; merged: boolean } => {
		const merged: Line[] = [];
		let changed = false;
		for (const row of rows) {
			if (!row.packagingId) {
				merged.push(row);
				continue;
			}
			const existingIndex = merged.findIndex(
				item =>
					item.packagingId === row.packagingId &&
					Number(item.unitPrice || 0) === Number(row.unitPrice || 0) &&
					Number(item.discountRate || 0) === Number(row.discountRate || 0) &&
					(item.lineType || "SALE") === (row.lineType || "SALE") &&
					(item.promotionProgramId || 0) === (row.promotionProgramId || 0),
			);
			if (existingIndex >= 0) {
				const existing = merged[existingIndex];
				merged[existingIndex] = {
					...existing,
					quantity: Number(existing.quantity || 0) + Number(row.quantity || 0),
					note: [existing.note, row.note].filter(Boolean).join("\n"),
				};
				changed = true;
			} else {
				merged.push(row);
			}
		}
		return { rows: merged, merged: changed };
	};
	const updateLine = (index: number, patch: Partial<Line>) =>
		setLines(current => {
			const next = current.map((line, position) =>
				position === index ? { ...line, ...patch } : line,
			);
			const merged = mergeDuplicatePackagingLines(next);
			if (merged.merged)
				toast("Đã gộp các dòng trùng mã và cộng dồn số lượng.", { icon: "ℹ️" });
			return merged.rows;
		});
	const applyPackagingPrice = async (index: number, packagingId: number) => {
		const cachedRetailPrice = references.data?.retailPriceMap?.get(packagingId);
		if (cachedRetailPrice) {
			updateLine(index, {
				packagingId,
				unitPrice: Number(cachedRetailPrice || 0),
			});
			return;
		}
		updateLine(index, { packagingId });
		if (!packagingId) return;
		try {
			const customerId = form.watch("customerId");
			const url = customerId
				? `/api/v1/sales-documents/packaging-prices?ids=${packagingId}&customerId=${customerId}`
				: `/api/v1/sales-documents/packaging-prices?ids=${packagingId}`;
			const response =
				await apiV1<
					Array<{ packagingId: number; priceType: string; price: number }>
				>(url);
			const prices = response.data || [];
			const salePrice =
				prices.find(item => item.priceType === "SALE_3") ||
				prices.find(item => item.priceType.startsWith("SALE")) ||
				prices.find(item => item.priceType === "COST");
			if (salePrice)
				updateLine(index, {
					packagingId,
					unitPrice: Number(salePrice.price || 0),
				});
		} catch {
			// Giữ đơn giá hiện tại nếu không lấy được bảng giá.
		}
	};

	const deleteMutation = useMutation({
		mutationFn: (document: SalesOrder) =>
			apiV1(`/api/v1/sales-documents/${document.id}`, {
				method: "DELETE",
				body: JSON.stringify({ version: document.version }),
			}),
		onSuccess: response => {
			toast.success(response.message);
			invalidate();
		},
		onError: (error: Error) => toast.error(error.message),
	});
	const runAction = (document: SalesOrder, action: string) => {
		if (action === "reject" || action === "cancel") {
			const reason = window.prompt(
				action === "reject"
					? "Nhập lý do từ chối:"
					: "Nhập lý do hủy và đảo chứng từ:",
			);
			if (reason)
				actionMutation.mutate({ document, action, extra: { reason } });
			return;
		}
		if (action === "delete") {
			if (document.status === "POSTED" || document.status === "CANCELLED") {
				toast.error(
					"Đơn đã ghi sổ hoặc đã hủy phải dùng Hủy và đảo, không được xóa trực tiếp",
				);
				return;
			}
			if (
				window.confirm(
					`Xóa vĩnh viễn đơn test ${document.code} ở trạng thái ${statusMeta[document.status as V1Status].label}?`,
				)
			)
				deleteMutation.mutate(document);
			return;
		}
		if (
			action === "post" &&
			!window.confirm(
				`Ghi sổ, xuất kho và ghi nhận phải thu cho ${document.code}?`,
			)
		)
			return;
		actionMutation.mutate({ document, action });
	};
	const receivePayment = (document: SalesOrder) => {
		const remaining = document.totalAmount - Number(document.paidAmount || 0);
		setPaymentOrder(document);
		setPaymentAmount(Number(remaining.toFixed(2)));
		setPaymentMethod("BANK");
		setPaymentNote(`Thu tiền ${document.code}`);
	};

	const buildOrderWorkbook = async (order: SalesOrder) => {
		try {
			const response = await fetch("/api/sales-orders/template", {
				headers: tokenHeader(),
			});
			if (!response.ok) {
				const error = await response.json().catch(() => ({}));
				throw new Error(error.error || "Không tải được file mẫu đơn hàng");
			}
			const workbook = new ExcelJS.Workbook();
			await workbook.xlsx.load(await response.arrayBuffer());
			const worksheet = workbook.worksheets[0];
			if (!worksheet) throw new Error("File mẫu không có worksheet");
			const templateCapacity = 12,
				extraRows = Math.max(0, order.details.length - templateCapacity);
			if (extraRows) {
				const styleSource = worksheet.getRow(27);
				[
					"A28:L28",
					"A29:L29",
					"A30:L30",
					"A31:L31",
					"A32:L32",
					"A33:N33",
					"A38:C38",
					"D38:G38",
					"H38:J38",
					"K38:N38",
					"A39:C39",
					"D39:G39",
					"H39:J39",
					"K39:N39",
				].forEach(range => worksheet.unMergeCells(range));
				worksheet.insertRows(
					28,
					Array.from({ length: extraRows }, () => []),
					"i",
				);
				for (let index = 0; index < extraRows; index++)
					cloneRowStyle(styleSource, worksheet.getRow(28 + index));
				for (let row = 28 + extraRows; row <= 32 + extraRows; row++)
					worksheet.mergeCells(`A${row}:L${row}`);
				worksheet.mergeCells(`A${33 + extraRows}:N${33 + extraRows}`);
				[38, 39].forEach(row => {
					worksheet.mergeCells(`A${row + extraRows}:C${row + extraRows}`);
					worksheet.mergeCells(`D${row + extraRows}:G${row + extraRows}`);
					worksheet.mergeCells(`H${row + extraRows}:J${row + extraRows}`);
					worksheet.mergeCells(`K${row + extraRows}:N${row + extraRows}`);
				});
			}
			const summaryStart = 28 + extraRows,
				rate = order.subtotal > 0 ? order.taxAmount / order.subtotal : 0;
			worksheet.getCell("G6").value = formatDate(order.orderDate);
			worksheet.getCell("I6").value = order.code;
			worksheet.getCell("C7").value = order.customerName || "";
			worksheet.getCell("C8").value =
				references.data?.customers.find(
					customer => customer.id === order.customerId,
				)?.groupName || "";
			worksheet.getCell("M8").value = order.customerPhone || "";
			worksheet.getCell("C9").value = order.customerAddress || "";
			worksheet.getCell("C10").value = order.customerAddress || "";
			worksheet.getCell("C11").value = order.customerTaxCode || "";
			worksheet.getCell("C12").value = order.creatorName || "";
			const rowCount = Math.max(
				templateCapacity + extraRows,
				order.details.length,
			);
			for (let index = 0; index < rowCount; index++) {
				const row = worksheet.getRow(16 + index);
				for (let column = 1; column <= 14; column++)
					row.getCell(column).value = null;
				const detail = order.details[index];
				if (!detail) continue;
				const fullProductName = [detail.productName, detail.packagingName]
					.filter(Boolean)
					.join(" - ");
				row.getCell(1).value = index + 1;
				row.getCell(2).value = detail.sku || "";
				row.getCell(3).value = fullProductName;
				row.getCell(4).value = detail.packagingName || "";
				row.getCell(5).value = detail.unit || "";
				row.getCell(6).value = detail.quantity;
				row.getCell(7).value =
					detail.lineType === "PROMOTION" ? detail.quantity : "";
				row.getCell(8).value =
					detail.lineType === "PROMOTION" ? fullProductName : "";
				row.getCell(9).value = detail.unitPrice;
				row.getCell(10).value = detail.unitPrice * (1 + rate);
				row.getCell(11).value = detail.unitPrice * detail.quantity;
				row.getCell(12).value = detail.discountRate / 100;
				row.getCell(13).value = detail.lineTotal || 0;
				row.getCell(14).value = detail.note || "";
			}
			worksheet.getCell(`M${summaryStart}`).value = order.subtotal;
			worksheet.getCell(`A${summaryStart + 1}`).value =
				`VAT (${(rate * 100).toLocaleString("vi-VN")}%)`;
			worksheet.getCell(`M${summaryStart + 1}`).value = order.taxAmount;
			worksheet.getCell(`M${summaryStart + 2}`).value = order.totalAmount;
			worksheet.getCell(`M${summaryStart + 3}`).value = 0;
			worksheet.getCell(`M${summaryStart + 4}`).value = order.totalAmount;
			worksheet.getCell(`A${summaryStart + 5}`).value =
				`Số tiền (bằng chữ): ${numberToVietnameseWords(order.totalAmount)}`;
			worksheet.getCell(`A${summaryStart + 6}`).value =
				`Đơn giá trên đã gồm VAT ${(rate * 100).toLocaleString("vi-VN")}% và chiết khấu thương mại.`;
			worksheet.getCell(`A${summaryStart + 8}`).value =
				`Thời gian giao hàng: ${order.deliveryDate ? formatDate(order.deliveryDate) : ""}`;
			return workbook;
		} catch (error: any) {
			toast.error(error.message || "Không thể xuất đơn hàng");
			return null;
		}
	};

	const exportOrder = async (order: SalesOrder) => {
		const workbook = await buildOrderWorkbook(order);
		if (!workbook) return;
		const companyResponse = await apiV1<any>("/api/v1/company").catch(
			() => null,
		);
		applyCompanyHeader(
			workbook.worksheets[0],
			buildCompanyPrintProfile(companyResponse?.data || null),
		);
		const buffer = await workbook.xlsx.writeBuffer();
		saveAs(
			new Blob([buffer], {
				type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			}),
			`DonDatHang_${order.code}.xlsx`,
		);
		toast.success("Đã xuất đơn hàng theo file mẫu");
	};

	const printOrderFromTemplate = async (order: SalesOrder) => {
		const workbook = await buildOrderWorkbook(order);
		if (!workbook) return;
		const companyResponse = await apiV1<any>("/api/v1/company").catch(
			() => null,
		);
		const company = buildCompanyPrintProfile(companyResponse?.data || null);
		const html = await workbookToPrintableHtml(workbook, order, company);
		const printWindow = window.open("", "_blank", "width=1024,height=768");
		if (!printWindow) {
			toast.error("Trình duyệt đã chặn cửa sổ in, vui lòng cho phép popup");
			return;
		}
		printWindow.document.open();
		printWindow.document.write(html);
		printWindow.document.close();
		printWindow.focus();
		window.setTimeout(() => {
			printWindow.print();
		}, 300);
	};

	const workbookToPrintableHtml = async (
		workbook: ExcelJS.Workbook,
		order: SalesOrder,
		company: CompanyPrintProfile | null,
	) => {
		const htmlEsc = (value: unknown) =>
			String(value ?? "")
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;")
				.replace(/"/g, "&quot;");
		const signerNameAbove = (code: string) => {
			if (!company?.printSettings?.printSignerNames) return "";
			const signature = company.signatures?.find(item => item.code === code);
			let name =
				signature && signature.isActive !== false
					? signature.signerName || ""
					: "";
			if (
				!name &&
				code === "PREPARER" &&
				company.printSettings.preparerFromLoggedInUser !== false
			) {
				try {
					name =
						JSON.parse(localStorage.getItem("user") || "{}").fullName || "";
				} catch {
					name = "";
				}
			}
			return name ? `<br/><b>${htmlEsc(name)}</b>` : "";
		};
		const customerGroup =
			references.data?.customers.find(
				customer => customer.id === order.customerId,
			)?.groupName || "";
		const rate = order.subtotal > 0 ? order.taxAmount / order.subtotal : 0;
		const cellText = (value: any): string => {
			if (value === null || value === undefined) return "";
			if (typeof value === "object") {
				if (Array.isArray(value.richText))
					return value.richText.map((part: any) => part.text).join("");
				if (value.text !== undefined) return String(value.text);
				if (value.result !== undefined) return cellText(value.result);
				if (value.formula !== undefined) return "";
				return "";
			}
			if (typeof value === "number") return formatNumber(value);
			return String(value);
		};
		const worksheet = workbook.worksheets[0];
		const merged = new Map<
			number,
			Array<{ min: number; max: number; text: string }>
		>();
		for (const range of Object.keys((worksheet as any)._merges || {})) {
			const match = String(range).match(/([A-Z]+)(\d+):([A-Z]+)(\d+)/);
			if (!match) continue;
			const colToNumber = (col: string) =>
				col.split("").reduce((sum, ch) => sum * 26 + ch.charCodeAt(0) - 64, 0);
			const rowNumber = Number(match[2]);
			const min = colToNumber(match[1]);
			const max = colToNumber(match[3]);
			const text = cellText(worksheet.getCell(`${match[1]}${rowNumber}`).value);
			if (!merged.has(rowNumber)) merged.set(rowNumber, []);
			merged.get(rowNumber)?.push({ min, max, text });
		}
		const bodyRows: string[] = [];
		worksheet.eachRow({ includeEmpty: true }, row => {
			if (row.number < 5 || row.number > 39) return;
			const rowMerges = merged.get(row.number) || [];
			const covered = new Set<number>();
			const parts: string[] = [];
			for (const item of rowMerges) {
				for (let column = item.min; column <= item.max; column++)
					covered.add(column);
				parts.push(
					`<td colspan="${item.max - item.min + 1}">${item.text}</td>`,
				);
			}
			for (let column = 1; column <= 14; column++) {
				if (covered.has(column)) continue;
				parts.push(`<td>${cellText(row.getCell(column).value)}</td>`);
			}
			bodyRows.push(`<tr>${parts.join("")}</tr>`);
		});
		return `<!doctype html><html lang="vi"><head><meta charset="utf-8" /><title>Đơn đặt hàng ${order.code}</title>
			<style>body{font-family:Arial,sans-serif;padding:20px;color:#111}.company{text-align:center;line-height:1.35}.company h2{font-size:17px;margin:0}.company p{margin:2px 0;font-size:12px}.title{text-align:center;font-size:22px;font-weight:800;margin:12px 0;font-family:"Times New Roman",serif}.meta{display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:12.5px;margin-bottom:10px}table.items{width:100%;border-collapse:collapse;font-size:11.5px}table.items td,table.items th{border:1px solid #111;padding:5px;vertical-align:top}table.items th{background:#f2f2f2;text-align:center}.right{text-align:right}.center{text-align:center}.summary{margin-top:8px;font-size:12.5px}.sign{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:18px;text-align:center;font-size:12px}@media print{@page{size:A4 landscape;margin:8mm}body{padding:0}}</style>
			</head><body>
			<div class="company"><h2>${htmlEsc(company?.name ? String(company.name).toUpperCase() : "CÔNG TY TNHH SẢN XUẤT THƯƠNG MẠI DỊCH VỤ CHALLENGE")}</h2>${company?.address ? `<p>Trụ sở chính: ${htmlEsc(company.address)}</p>` : ""}<p>${company?.website ? `Website: ${htmlEsc(company.website)}` : ""}${company?.phone ? ` - ĐT: ${htmlEsc(company.phone)}` : ""}</p></div>
			<div class="title">ĐƠN ĐẶT HÀNG</div>
			<div class="meta"><div>Ngày đặt hàng: <b>${formatDate(order.orderDate)}</b></div><div>Số phiếu: <b>${order.code}</b></div><div>Khách hàng: <b>${order.customerName || ""}</b></div><div>Số điện thoại: <b>${order.customerPhone || ""}</b></div><div>Loại hình khách hàng: <b>${customerGroup}</b></div><div>Địa chỉ xuất HĐ: <b>${order.customerAddress || ""}</b></div><div>Địa chỉ giao hàng: <b>${order.customerAddress || ""}</b></div><div>Mã số thuế: <b>${order.customerTaxCode || ""}</b></div><div>Người đặt hàng: <b>${order.creatorName || ""}</b></div><div>Thời gian giao hàng: <b>${order.deliveryDate ? formatDate(order.deliveryDate) : ""}</b></div></div>
			<table class="items"><thead><tr><th>STT</th><th>Mã hàng hóa</th><th>Tên hàng hóa</th><th>Quy cách</th><th>ĐVT</th><th>Số lượng</th><th>Số lượng hàng hỗ trợ</th><th>Sản phẩm hỗ trợ</th><th>Giá bán trước VAT</th><th>Giá bán sau VAT</th><th>Thành tiền</th><th>Chiết khấu</th><th>Thành tiền sau CK</th><th>Ghi chú</th></tr></thead><tbody>
			${order.details
				.map((line, index) => {
					const fullName = [line.productName, line.packagingName]
						.filter(Boolean)
						.join(" - ");
					const beforeVat = line.unitPrice * (1 + rate);
					return `<tr><td class="center">${index + 1}</td><td>${line.sku || ""}</td><td>${fullName}</td><td>${line.packagingName || ""}</td><td class="center">${line.unit || ""}</td><td class="right">${formatNumber(line.quantity)}</td><td class="right">${line.lineType === "PROMOTION" ? formatNumber(line.quantity) : ""}</td><td>${line.lineType === "PROMOTION" ? fullName : ""}</td><td class="right">${formatNumber(line.unitPrice)}</td><td class="right">${formatNumber(beforeVat)}</td><td class="right">${formatNumber(line.unitPrice * line.quantity)}</td><td class="right">${formatNumber(line.discountRate / 100)}</td><td class="right">${formatNumber(line.lineTotal || 0)}</td><td>${line.note || ""}</td></tr>`;
				})
				.join("")}
			</tbody></table>
			<div class="summary">Cộng tiền hàng: <b>${formatNumber(order.subtotal)} ₫</b><br/>VAT (${(rate * 100).toLocaleString("vi-VN")}%): <b>${formatNumber(order.taxAmount)} ₫</b><br/>Tổng tiền hàng sau VAT: <b>${formatNumber(order.totalAmount)} ₫</b><br/>Số tiền (bằng chữ): <b>${numberToVietnameseWords(order.totalAmount)}</b><br/>Đơn giá trên đã gồm ${(rate * 100).toLocaleString("vi-VN")}% VAT và chiết khấu thương mại.</div>
			<div class="sign"><div>ĐẠI DIỆN KHÁCH HÀNG<br/>(Ký, ghi họ tên)</div><div>NGƯỜI LẬP<br/>(Ký, ghi họ tên)${signerNameAbove("PREPARER")}</div><div>Kế Toán<br/>(Ký, ghi họ tên)${signerNameAbove("CHIEF_ACCOUNTANT")}</div><div>${htmlEsc(company?.name ? String(company.name).toUpperCase() : "CÔNG TY TNHH SẢN XUẤT THƯƠNG MẠI DỊCH VỤ CHALLENGE")}<br/>(Ký, ghi họ tên)${signerNameAbove("DIRECTOR")}</div></div>
			<script>window.onafterprint = () => window.close();<\/script></body></html>`;
	};

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Bán hàng</h1>
					<p>
						Các chứng từ bán hàng, xuất kho và ghi nhận công nợ. Duyệt đơn bán
						trước khi ghi sổ để tránh sai sót.
					</p>
				</div>
				<Button
					variant="primary"
					onClick={openCreate}
					disabled={!references.data?.customers.length}
				>
					<Plus size={17} /> Thêm đơn bán
				</Button>
			</div>
			<div className="grid gap-4 md:grid-cols-3">
				<div className="erp-stat">
					<ShoppingCart />
					<div>
						<span>Tổng chứng từ</span>
						<strong>{meta?.total || 0}</strong>
					</div>
				</div>
				<div className="erp-stat">
					<PackageCheck />
					<div>
						<span>Đã ghi sổ trang này</span>
						<strong>
							{orders.filter(order => order.status === "POSTED").length}
						</strong>
					</div>
				</div>
				<div className="erp-stat">
					<CircleDollarSign />
					<div>
						<span>Doanh số trang này</span>
						<strong>
							{formatNumber(
								orders
									.filter(order => order.status === "POSTED")
									.reduce((sum, order) => sum + order.totalAmount, 0),
							)}{" "}
							₫
						</strong>
					</div>
				</div>
			</div>
			<Card className="overflow-hidden !p-0">
				<div className="erp-toolbar">
					<div className="erp-search">
						<Search size={17} />
						<input
							value={search}
							onChange={event => {
								setSearch(event.target.value);
								setPage(1);
							}}
							placeholder="Tìm số đơn, khách hàng..."
						/>
					</div>
					<div className="list-box">
						<select
							value={status}
							onChange={event => {
								setStatus(event.target.value as any);
								setPage(1);
							}}
						>
							<option value="">Tất cả trạng thái</option>
							{Object.entries(statusMeta).map(([key, value]) => (
								<option key={key} value={key}>
									{value.label}
								</option>
							))}
						</select>
					</div>
				</div>
				{documents.isLoading ? (
					<div className="erp-table-loading">Đang tải chứng từ...</div>
				) : documents.isError ? (
					<div className="p-12 text-center">
						<p className="font-semibold text-red-600">
							{(documents.error as Error).message}
						</p>
						{(documents.error as any)?.status === 403 && (
							<p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
								Tài khoản chưa có quyền xem bán hàng. Vui lòng đăng nhập lại để
								nhận token mới, hoặc nhờ quản trị viên gán vai trò có quyền{" "}
								<b>sales.view</b> trong bảng user_roles.
							</p>
						)}
					</div>
				) : orders.length === 0 ? (
					<div className="erp-empty">
						<PackagePlus size={48} />
						<p>Chưa có chứng từ bán hàng nào</p>
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="erp-table">
							<thead>
								<tr>
									<th>Số đơn / Ngày</th>
									<th>Khách hàng</th>
									<th>Kho xuất</th>
									<th>Trạng thái</th>
									<th className="text-right">Tổng tiền / Công nợ</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{orders.map(order => (
									<tr
										key={order.id}
										className={statusMeta[order.status as V1Status]?.row}
									>
										<td>
											<button
												className="font-semibold text-emerald-700"
												onClick={async () => {
													setSelected(order);
													setInventoryIssues([]);
													const codes = (order.links || [])
														.filter(
															link =>
																link.linkType === "INVENTORY_ISSUE" ||
																link.linkType === "INVENTORY_REVERSAL",
														)
														.map(
															link => link.linkedCode || String(link.linkedId),
														)
														.filter(Boolean);
													if (!codes.length) return;
													setInventoryLoading(true);
													try {
														const response = await apiV1<any>(
															`/api/v1/inventory/documents/by-codes?codes=${encodeURIComponent(codes.join(","))}`,
														);
														setInventoryIssues(
															Array.isArray(response.data) ? response.data : [],
														);
													} catch {
														setInventoryIssues([]);
													} finally {
														setInventoryLoading(false);
													}
												}}
											>
												{order.code}
											</button>
											<small>
												{formatDate(order.orderDate)} · v{order.version}
											</small>
										</td>
										<td>
											<b>{order.customerName}</b>
											<small>{order.customerPhone}</small>
										</td>
										<td>{order.warehouseName}</td>
										<td>
											<span
												className={`erp-badge ${statusMeta[order.status as V1Status].css}`}
											>
												{statusMeta[order.status as V1Status].label}
											</span>
											{order.status === "POSTED" && (
												<small>
													{order.paymentStatus === "PAID"
														? "Đã thu đủ"
														: order.paymentStatus === "PARTIAL"
															? "Thu một phần"
															: "Chưa thu tiền"}
												</small>
											)}
										</td>
										<td className="text-right font-semibold">
											{formatNumber(order.totalAmount)} ₫
											{order.status === "POSTED" && (
												<small>
													Còn nợ:{" "}
													{formatNumber(
														order.totalAmount - Number(order.paidAmount || 0),
													)}{" "}
													₫
												</small>
											)}
										</td>
										<td>
											<div className="flex justify-end gap-1">
												<button
													className="erp-icon-btn"
													title="Xuất Excel"
													onClick={() => exportOrder(order)}
												>
													<FileSpreadsheet size={17} />
												</button>
												{(order.status === "DRAFT" ||
													order.status === "REJECTED") && (
													<>
														<button
															className="erp-icon-btn"
															title="Sửa"
															onClick={() => openEdit(order)}
														>
															<Edit size={16} />
														</button>
														<button
															className="erp-icon-btn"
															title="Gửi duyệt"
															onClick={() => runAction(order, "submit")}
														>
															<Send size={17} />
														</button>
													</>
												)}
												{order.status !== "POSTED" &&
													order.status !== "CANCELLED" && (
														<button
															className="erp-icon-btn text-red-500"
															title="Xóa đơn test"
															disabled={deleteMutation.isPending}
															onClick={() => runAction(order, "delete")}
														>
															<Trash2 size={16} />
														</button>
													)}
												{order.status === "PENDING" && (
													<>
														<button
															className="erp-icon-btn text-emerald-600"
															title="Duyệt"
															onClick={() => runAction(order, "approve")}
														>
															<Check size={17} />
														</button>
														<button
															className="erp-icon-btn text-red-500"
															title="Từ chối"
															onClick={() => runAction(order, "reject")}
														>
															<X size={17} />
														</button>
													</>
												)}
												{order.status === "APPROVED" && (
													<button
														className="erp-btn erp-btn-primary py-1.5"
														onClick={() => runAction(order, "post")}
													>
														Ghi sổ <ChevronRight size={15} />
													</button>
												)}
												{order.status === "POSTED" && (
													<>
														{order.paymentStatus !== "PAID" && (
															<button
																className="erp-btn py-1.5 text-emerald-700"
																onClick={() => receivePayment(order)}
															>
																Thu tiền
															</button>
														)}
														<button
															className="erp-btn py-1.5 text-amber-700"
															title="Bỏ ghi sổ để khôi phục tồn kho rồi sửa"
															disabled={actionMutation.isPending}
															onClick={() => {
																if (
																	window.confirm(
																		`Bỏ ghi sổ ${order.code} để khôi phục tồn kho và sửa lại?`,
																	)
																) {
																	actionMutation.mutate({
																		document: order,
																		action: "unpost",
																	});
																}
															}}
														>
															Bỏ ghi sổ
														</button>
														<button
															className="erp-icon-btn text-red-500"
															title="Hủy và đảo"
															onClick={() => runAction(order, "cancel")}
														>
															<Undo2 size={16} />
														</button>
													</>
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
			</Card>
			{open && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal sales-order-drawer">
						<div className="erp-modal-header">
							<div>
								<h2>{editing ? "Sửa đơn bán hàng" : "Thêm đơn bán hàng"}</h2>
								<p>Nháp không tác động tồn kho hoặc công nợ</p>
							</div>
							<button onClick={() => setOpen(false)}>
								<X />
							</button>
						</div>
						<form
							onSubmit={form.handleSubmit(input => saveMutation.mutate(input))}
						>
							<div className="erp-modal-body space-y-5">
								<div className="grid gap-4 md:grid-cols-4">
									<label>
										Mã chứng từ
										<input
											{...form.register("code")}
											placeholder={nextSalesCode.data || "BH00001"}
										/>
									</label>
									<label>
										Ngày đơn
										<input type="date" {...form.register("orderDate")} />
									</label>
									<label>
										Ngày giao
										<input type="date" {...form.register("deliveryDate")} />
									</label>
									<label>
										Hạn thanh toán
										<input type="date" {...form.register("dueDate")} />
									</label>
									<label>
										Khách hàng
										<SearchableSelect
											value={form.watch("customerId") || 0}
											options={customerSearchOptions}
											onChange={customerId =>
												form.setValue("customerId", customerId, {
													shouldValidate: true,
												})
											}
											placeholder="Nhập tên/mã/SĐT khách hàng"
											required
										/>
										<small className="text-red-500">
											{form.formState.errors.customerId?.message}
										</small>
									</label>
									<label>
										Kho xuất
										<select
											{...form.register("warehouseId", { valueAsNumber: true })}
										>
											<option value={0}>Chọn kho</option>
											{references.data?.warehouses.map(warehouse => (
												<option key={warehouse.id} value={warehouse.id}>
													{warehouse.name}
												</option>
											))}
										</select>
									</label>
									<label>
										Ý định thu tiền
										<select {...form.register("paymentIntent")}>
											<option value="UNPAID">Ghi công nợ</option>
											<option value="PAID">Thu ngay khi ghi sổ</option>
										</select>
									</label>
									<label>
										Phương thức
										<select {...form.register("paymentMethod")}>
											<option value="CASH">Tiền mặt</option>
											<option value="BANK">Chuyển khoản</option>
										</select>
									</label>
								</div>
								<div className="overflow-x-auto border rounded">
									<table className="erp-table">
										<thead>
											<tr>
												<th>Hàng hóa / Quy cách</th>
												<th>SL</th>
												<th>Đơn giá</th>
												<th>CK %</th>
												<th>Ghi chú sản phẩm</th>
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
																void applyPackagingPrice(index, packagingId)
															}
															placeholder="Nhập tên/SKU để chọn hàng hóa"
															required
														/>
													</td>
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
															value={line.discountRate}
															onChange={event =>
																updateLine(index, {
																	discountRate: +event.target.value,
																})
															}
														/>
													</td>
													<td>
														<input
															className="min-w-44"
															value={line.note || ""}
															placeholder="Ghi chú cho sản phẩm..."
															onChange={event =>
																updateLine(index, { note: event.target.value })
															}
														/>
													</td>
													<td className="text-right font-semibold">
														{formatNumber(
															Number(line.quantity || 0) *
																Number(line.unitPrice || 0) *
																(1 -
																	Math.min(
																		Math.max(Number(line.discountRate || 0), 0),
																		100,
																	) /
																		100),
														)}
													</td>
													<td>
														<button
															type="button"
															className="erp-icon-btn text-red-500 hover:bg-red-50"
															disabled={lines.length === 1}
															onClick={() =>
																setLines(current =>
																	current.filter(
																		(_, position) => position !== index,
																	),
																)
															}
														>
															<Trash2 size={15} />
														</button>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
								<div className="flex flex-wrap items-center gap-2">
									<button
										type="button"
										className="erp-btn"
										onClick={() =>
											setLines(current => [...current, emptyLine()])
										}
									>
										<Plus size={15} /> Thêm dòng
									</button>
									<button
										type="button"
										className="erp-btn text-emerald-700"
										disabled={promotionPreview.isPending}
										onClick={() => promotionPreview.mutate()}
									>
										{promotionPreview.isPending
											? "Đang tính..."
											: "Tính khuyến mãi"}
									</button>
									{promotionPreview.data?.data.length && !promotionModal ? (
										<span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
											Đã thêm {promotionPreview.data.data.length} dòng hàng tặng
										</span>
									) : promotionPreview.isSuccess &&
									  !promotionPreview.data?.data.length ? (
										<span className="text-xs text-slate-500">
											Không có chương trình phù hợp.
										</span>
									) : null}
								</div>
								<div className="grid gap-4 md:grid-cols-2">
									<label>
										Diễn giải
										<textarea rows={3} {...form.register("note")} />
									</label>
									<div className="ml-auto w-full max-w-sm space-y-2">
										<div className="flex justify-between">
											<span>Tiền hàng</span>
											<b>{formatNumber(gross)} ₫</b>
										</div>
										<div className="flex justify-between">
											<span>Chiết khấu dòng</span>
											<b>-{formatNumber(lineDiscountAmount)} ₫</b>
										</div>
										<div className="flex items-center justify-between gap-2">
											<span>Chiết khấu đơn (%)</span>
											<input
												className="w-20 text-right"
												type="number"
												min="0"
												max="100"
												step="any"
												{...form.register("orderDiscountRate", {
													valueAsNumber: true,
												})}
											/>
											<b className="min-w-24 text-right">
												-{formatNumber(orderDiscountAmount)} ₫
											</b>
										</div>
										<div className="flex items-center justify-between gap-2">
											<span>Thuế GTGT (%)</span>
											<input
												className="w-20 text-right"
												type="number"
												min="0"
												max="100"
												step="any"
												{...form.register("taxRate", { valueAsNumber: true })}
											/>
											<b className="min-w-24 text-right">
												+{formatNumber(taxAmount)} ₫
											</b>
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
									onClick={() =>
										selected && void printOrderFromTemplate(selected)
									}
								>
									<Printer size={15} /> In
								</button>
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
			{promotionModal && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-3xl">
						<div className="erp-modal-header">
							<div>
								<h2>Xác nhận chương trình khuyến mãi</h2>
								<p>
									Tick chọn từng chương trình rồi xác nhận để thêm hàng tặng vào
									bảng
								</p>
							</div>
							<button onClick={() => setPromotionModal(false)}>
								<Trash2 size={15} />
							</button>
						</div>
						<div className="erp-modal-body space-y-3">
							{promotionChoices.map((gift, index) => {
								const item = packagingOptions.find(
									x => x.id === gift.packagingId,
								);
								return (
									<label
										key={`${gift.promotionProgramId}-${gift.packagingId}`}
										className="flex cursor-pointer items-start gap-3 rounded border border-slate-200 p-3 hover:border-emerald-400"
									>
										<input
											type="checkbox"
											checked={gift.selected}
											onChange={event =>
												setPromotionChoices(current =>
													current.map((choice, position) =>
														position === index
															? { ...choice, selected: event.target.checked }
															: choice,
													),
												)
											}
											className="mt-1"
										/>
										<div className="flex-1 text-sm">
											<b>
												{gift.promotionCode} · {gift.promotionName}
											</b>
											<div className="mt-1">
												{item?.productName} - {item?.name}:{" "}
												<b>
													{formatNumber(gift.quantity)} {item?.unit}
												</b>
											</div>
											<small>
												Đơn giá 0, VAT 0 · Hàng tặng phục vụ in chứng từ và báo
												cáo
											</small>
											<div className="mt-1 text-xs text-slate-500">
												{gift.note}
											</div>
										</div>
									</label>
								);
							})}
						</div>
						<div className="erp-modal-footer">
							<button
								type="button"
								className="erp-btn"
								onClick={() => setPromotionModal(false)}
							>
								Hủy
							</button>
							<button
								type="button"
								className="erp-btn erp-btn-primary"
								onClick={() => {
									const approved = promotionChoices.filter(
										choice => choice.selected,
									);
									setLines(current => {
										const saleLines = current.filter(
											line =>
												line.packagingId > 0 && Number(line.unitPrice || 0) > 0,
										);
										const mergedGifts = new Map<number, Line>();
										for (const gift of approved) {
											const existing = mergedGifts.get(gift.packagingId);
											if (existing) {
												existing.quantity =
													Number(existing.quantity || 0) +
													Number(gift.quantity || 0);
												existing.note = [
													existing.note,
													`${gift.promotionCode}: +${gift.quantity}`,
												]
													.filter(Boolean)
													.join("\n");
												existing.promotionCode = [
													existing.promotionCode,
													gift.promotionCode,
												]
													.filter(Boolean)
													.join(", ");
												existing.promotionName = [
													existing.promotionName,
													gift.promotionName,
												]
													.filter(Boolean)
													.join("; ");
											} else {
												mergedGifts.set(gift.packagingId, {
													packagingId: gift.packagingId,
													quantity: gift.quantity,
													unitPrice: 0,
													discountRate: 0,
													note: gift.note,
													lineType: "PROMOTION",
													promotionProgramId: gift.promotionProgramId,
													promotionCode: gift.promotionCode,
													promotionName: gift.promotionName,
												});
											}
										}
										return [...saleLines, ...mergedGifts.values()];
									});
									setPromotionModal(false);
									if (approved.length) {
										toast.success(
											`Đã cập nhật ${approved.length} chương trình, gộp trùng mã hàng tặng`,
										);
									} else {
										toast("Đã bỏ toàn bộ hàng tặng khỏi đơn bán.", {
											icon: "ℹ️",
										});
									}
								}}
							>
								Xác nhận áp dụng
							</button>
						</div>
					</div>
				</div>
			)}
			{selected && (
				<div className="erp-modal-backdrop sales-print-view">
					<div className="erp-modal max-w-4xl">
						<div className="erp-modal-header">
							<div>
								<h2>Phiếu bán hàng {selected.code}</h2>
								<p>
									{selected.customerName} · {selected.warehouseName}
								</p>
							</div>
							<button onClick={() => setSelected(null)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							<div className="flex flex-wrap items-center justify-between gap-2">
								<span
									className={`erp-badge ${statusMeta[selected.status as V1Status].css}`}
								>
									{statusMeta[selected.status as V1Status].label}
								</span>
								<b className="text-xl text-emerald-700">
									{formatNumber(selected.totalAmount)} ₫
								</b>
							</div>
							<table className="erp-table">
								<thead>
									<tr>
										<th>Hàng hóa</th>
										<th>SL</th>
										<th className="text-right">Đơn giá</th>
										<th className="text-right">Thành tiền</th>
										<th className="text-right">Giá vốn</th>
									</tr>
								</thead>
								<tbody>
									{selected.details.map(line => (
										<tr
											key={line.id}
											className={
												line.lineType === "PROMOTION" ? "bg-emerald-50" : ""
											}
										>
											<td>
												{line.productName} - {line.packagingName}
												<small>
													{line.sku}
													{line.lineType === "PROMOTION" &&
														` · Hàng tặng ${line.promotionCode}`}
												</small>
											</td>
											<td>
												{formatNumber(line.quantity)} {line.unit}
											</td>
											<td className="text-right">
												{formatNumber(line.unitPrice)}
											</td>
											<td className="text-right font-semibold">
												{formatNumber(line.lineTotal || 0)}
											</td>
											<td className="text-right">
												{formatNumber(line.costAmount || 0)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
							<div className="rounded bg-slate-50 p-3">
								<b>Chứng từ xuất kho</b>
								{inventoryLoading ? (
									<div className="erp-table-loading">
										Đang tải phiếu xuất kho...
									</div>
								) : inventoryIssues.length ? (
									<div className="mt-2 space-y-2">
										{inventoryIssues.map((issue: any) => (
											<div
												key={issue.id}
												className="rounded border border-slate-200 bg-white p-3"
											>
												<div className="flex flex-wrap items-center justify-between gap-2">
													<b>{issue.code}</b>
													<span className="text-xs text-slate-500">
														{issue.warehouseName} ·{" "}
														{issue.transactionDate
															? formatDate(issue.transactionDate)
															: ""}
													</span>
												</div>
												<table className="erp-table mt-2">
													<thead>
														<tr>
															<th>Hàng hóa</th>
															<th className="text-right">Số lượng</th>
															<th className="text-right">Đơn giá vốn</th>
														</tr>
													</thead>
													<tbody>
														{(issue.details || []).map(
															(line: any, lineIndex: number) => (
																<tr key={line.id || lineIndex}>
																	<td>
																		<b>
																			{line.productName} - {line.packagingName}
																		</b>
																		<small>{line.sku}</small>
																	</td>
																	<td className="text-right">
																		{formatNumber(line.quantity || 0)}{" "}
																		{line.unit || ""}
																	</td>
																	<td className="text-right">
																		{formatNumber(line.unitCost || 0)}
																	</td>
																</tr>
															),
														)}
													</tbody>
												</table>
											</div>
										))}
									</div>
								) : (
									<p className="mt-1 text-sm text-slate-400">
										Chưa ghi sổ nên chưa phát sinh phiếu xuất kho.
									</p>
								)}
							</div>
							<div className="rounded bg-slate-50 p-3">
								<b>Chứng từ liên quan</b>
								{selected.links?.length ? (
									<div className="mt-2 flex flex-wrap gap-2">
										{selected.links.map(link => {
											const linkedCode =
												link.linkedCode || String(link.linkedId);
											return (
												<button
													key={link.id}
													type="button"
													title={`Mở drawer chi tiết ${relatedTypeLabel(link.linkType)} ${linkedCode}`}
													className="erp-badge bg-blue-100 text-blue-700 hover:bg-blue-200"
													onClick={async () => {
														setRelatedLoading(true);
														setRelatedDetail({
															type: link.linkType,
															code: linkedCode,
															data: null,
														});
														try {
															if (
																link.linkType === "INVENTORY_ISSUE" ||
																link.linkType === "INVENTORY_REVERSAL"
															) {
																const response = await apiV1<any>(
																	`/api/v1/inventory/documents/by-codes?codes=${encodeURIComponent(linkedCode)}`,
																);
																const rows = Array.isArray(response.data)
																	? response.data
																	: [];
																if (!rows.length) {
																	const fallback = await apiV1<any>(
																		`/api/v1/inventory/documents/${link.linkedId}`,
																	);
																	setRelatedDetail({
																		type: link.linkType,
																		code: linkedCode,
																		data: fallback.data,
																	});
																} else {
																	setRelatedDetail({
																		type: link.linkType,
																		code: linkedCode,
																		data: rows[0],
																	});
																}
															} else if (
																link.linkType.startsWith("RECEIVABLE")
															) {
																const response = await apiV1<any>(
																	`/api/v1/debt/receivables?search=${encodeURIComponent(selected?.code || linkedCode)}`,
																);
																const rows = Array.isArray(response.data)
																	? response.data
																	: response.data?.data || [];
																setRelatedDetail({
																	type: link.linkType,
																	code: linkedCode,
																	data: rows[0] || selected,
																});
															} else if (
																link.linkType === "PAYMENT_RECEIPT" ||
																link.linkType === "PAYMENT_REVERSAL"
															) {
																const response = await apiV1<any>(
																	`/api/v1/debt/receipts?page=1&limit=100&search=${encodeURIComponent(linkedCode)}`,
																);
																const rows = Array.isArray(response.data)
																	? response.data
																	: response.data?.data || [];
																const payment =
																	rows.find(
																		(row: any) => row.code === linkedCode,
																	) || rows[0];
																setRelatedDetail({
																	type: link.linkType,
																	code: linkedCode,
																	data: payment || null,
																});
															} else {
																setRelatedDetail({
																	type: link.linkType,
																	code: linkedCode,
																	data: selected,
																});
															}
														} catch (error: any) {
															const detailMessage = error?.fieldErrors
																? Object.entries(error.fieldErrors)
																		.map(
																			([field, messages]) =>
																				`${field}: ${(messages as string[]).join(", ")}`,
																		)
																		.join("; ")
																: "";
															toast.error(
																[
																	error.message ||
																		"Không tải được chứng từ liên quan",
																	detailMessage,
																]
																	.filter(Boolean)
																	.join("\n"),
															);
															setRelatedDetail(null);
														} finally {
															setRelatedLoading(false);
														}
													}}
												>
													{relatedTypeLabel(link.linkType)}: {linkedCode} ▸
												</button>
											);
										})}
									</div>
								) : (
									<p className="mt-1 text-sm text-slate-400">
										Chưa phát sinh ledger hoặc chứng từ liên kết.
									</p>
								)}
							</div>
							{selected.rejectionReason && (
								<div className="rounded bg-amber-50 p-3 text-amber-700">
									Lý do từ chối: {selected.rejectionReason}
								</div>
							)}
							{selected.cancelReason && (
								<div className="rounded bg-red-50 p-3 text-red-700">
									Lý do hủy: {selected.cancelReason}
								</div>
							)}
							{selected.status === "POSTED" &&
								Number(selected.paidAmount || 0) > 0 && (
									<div className="rounded bg-amber-50 p-3 text-sm text-amber-700">
										Đơn đã thu {formatNumber(selected.paidAmount || 0)} ₫ nên
										cần hủy các khoản thu tiền trong Công nợ trước khi bỏ ghi
										sổ.
									</div>
								)}
						</div>
						<div className="erp-modal-footer">
							<button
								type="button"
								className="erp-btn"
								onClick={() => void printOrderFromTemplate(selected)}
							>
								<Printer size={15} /> In theo mẫu Excel
							</button>
							{selected.status === "POSTED" && (
								<button
									type="button"
									className="erp-btn text-amber-700"
									disabled={actionMutation.isPending}
									onClick={() => {
										if (
											window.confirm(
												`Bỏ ghi sổ ${selected.code} để khôi phục tồn kho và sửa lại?`,
											)
										) {
											actionMutation.mutate(
												{ document: selected, action: "unpost" },
												{
													onSuccess: response => {
														setSelected(response.data);
														toast.success(
															"Đã bỏ ghi sổ, bạn có thể bấm Sửa đơn",
														);
													},
												},
											);
										}
									}}
								>
									Bỏ ghi sổ
								</button>
							)}
							{(selected.status === "APPROVED" ||
								selected.status === "DRAFT" ||
								selected.status === "REJECTED") && (
								<button
									type="button"
									className="erp-btn erp-btn-primary"
									onClick={() => {
										setSelected(null);
										openEdit(selected);
									}}
								>
									Sửa đơn
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
			{relatedDetail && (
				<div className="erp-modal-backdrop" style={{ zIndex: 300 }}>
					<div className="erp-modal max-w-4xl">
						<div className="erp-modal-header">
							<div>
								<h2>
									{relatedTypeLabel(relatedDetail.type)} {relatedDetail.code}
								</h2>
								<p>Chi tiết chứng từ liên quan, mở trực tiếp trong drawer</p>
							</div>
							<button onClick={() => setRelatedDetail(null)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							{relatedLoading ? (
								<div className="erp-table-loading">
									Đang tải chứng từ liên quan...
								</div>
							) : relatedDetail.type === "INVENTORY_ISSUE" ||
							  relatedDetail.type === "INVENTORY_REVERSAL" ? (
								<>
									<div className="grid gap-3 md:grid-cols-4">
										<div className="rounded bg-slate-50 p-3">
											<small>Mã phiếu</small>
											<b className="block">
												{relatedDetail.data?.code || relatedDetail.code}
											</b>
										</div>
										<div className="rounded bg-slate-50 p-3">
											<small>Kho</small>
											<b className="block">
												{relatedDetail.data?.warehouseName ||
													relatedDetail.data?.warehouse?.name ||
													"-"}
											</b>
										</div>
										<div className="rounded bg-slate-50 p-3">
											<small>Ngày chứng từ</small>
											<b className="block">
												{relatedDetail.data?.transactionDate
													? formatDate(relatedDetail.data.transactionDate)
													: "-"}
											</b>
										</div>
										<div className="rounded bg-slate-50 p-3">
											<small>Trạng thái</small>
											<b className="block">
												{relatedDetail.data?.status || "-"}
											</b>
										</div>
									</div>
									<table className="erp-table">
										<thead>
											<tr>
												<th>Hàng hóa</th>
												<th className="text-right">Số lượng</th>
												<th className="text-right">Đơn giá vốn</th>
												<th className="text-right">Thành tiền</th>
											</tr>
										</thead>
										<tbody>
											{(
												relatedDetail.data?.details ||
												relatedDetail.data?.lines ||
												[]
											).map((line: any, index: number) => (
												<tr key={line.id || index}>
													<td>
														<b>
															{line.productName || line.products?.name || "-"} -{" "}
															{line.packagingName ||
																line.productpackagings?.name ||
																""}
														</b>
														<small>
															{line.sku || line.productpackagings?.sku || ""}
														</small>
													</td>
													<td className="text-right">
														{formatNumber(line.quantity || 0)}{" "}
														{line.unit || line.productpackagings?.unit || ""}
													</td>
													<td className="text-right">
														{formatNumber(line.unitCost || line.unitPrice || 0)}
													</td>
													<td className="text-right font-semibold">
														{formatNumber(
															line.totalValue || line.lineTotal || 0,
														)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
									{relatedDetail.data?.note && (
										<div className="rounded bg-slate-50 p-3 text-sm">
											Ghi chú: {relatedDetail.data.note}
										</div>
									)}
								</>
							) : relatedDetail.type === "PAYMENT_RECEIPT" ||
							  relatedDetail.type === "PAYMENT_REVERSAL" ? (
								<>
									<div className="grid gap-3 md:grid-cols-4">
										<div className="rounded bg-slate-50 p-3">
											<small>Mã phiếu thu</small>
											<b className="block">
												{relatedDetail.data?.code || relatedDetail.code}
											</b>
										</div>
										<div className="rounded bg-slate-50 p-3">
											<small>Khách hàng</small>
											<b className="block">
												{relatedDetail.data?.partnerName ||
													selected?.customerName ||
													"-"}
											</b>
										</div>
										<div className="rounded bg-slate-50 p-3">
											<small>Ngày thu</small>
											<b className="block">
												{relatedDetail.data?.paymentDate
													? formatDate(relatedDetail.data.paymentDate)
													: "-"}
											</b>
										</div>
										<div className="rounded bg-slate-50 p-3">
											<small>Trạng thái</small>
											<b className="block">
												{relatedDetail.data?.status || "-"}
											</b>
										</div>
									</div>
									<table className="erp-table">
										<thead>
											<tr>
												<th>Chứng từ phân bổ</th>
												<th className="text-right">Số tiền</th>
											</tr>
										</thead>
										<tbody>
											{(relatedDetail.data?.allocations || []).map(
												(row: any) => (
													<tr key={row.id || row.documentId}>
														<td>
															<b>{row.documentCode}</b>
															<small>
																{row.note || relatedDetail.data?.note || ""}
															</small>
														</td>
														<td className="text-right font-semibold">
															{formatNumber(row.amount || 0)} ₫
														</td>
													</tr>
												),
											)}
										</tbody>
									</table>
									<div className="rounded bg-slate-50 p-3 text-sm">
										Tổng thu:{" "}
										<b>{formatNumber(relatedDetail.data?.amount || 0)} ₫</b> ·
										Phương thức: <b>{relatedDetail.data?.method || "-"}</b>
									</div>
								</>
							) : relatedDetail.type.startsWith("RECEIVABLE") ? (
								<>
									<div className="grid gap-3 md:grid-cols-4">
										<div className="rounded bg-slate-50 p-3">
											<small>Khách hàng</small>
											<b className="block">
												{relatedDetail.data?.customerName ||
													selected?.customerName ||
													"-"}
											</b>
										</div>
										<div className="rounded bg-slate-50 p-3">
											<small>Số tiền</small>
											<b className="block text-emerald-700">
												{formatNumber(
													relatedDetail.data?.amount ||
														relatedDetail.data?.totalAmount ||
														0,
												)}{" "}
												₫
											</b>
										</div>
										<div className="rounded bg-slate-50 p-3">
											<small>Đã thu</small>
											<b className="block">
												{formatNumber(relatedDetail.data?.paidAmount || 0)} ₫
											</b>
										</div>
										<div className="rounded bg-slate-50 p-3">
											<small>Còn lại</small>
											<b className="block text-red-600">
												{formatNumber(
													relatedDetail.data?.remaining ||
														relatedDetail.data?.balance ||
														0,
												)}{" "}
												₫
											</b>
										</div>
									</div>
									<div className="rounded bg-slate-50 p-3 text-sm">
										Chứng từ gốc: <b>{selected?.code}</b> · Hạn thanh toán:{" "}
										<b>
											{relatedDetail.data?.dueDate
												? formatDate(relatedDetail.data.dueDate)
												: "-"}
										</b>
									</div>
								</>
							) : relatedDetail.data ? (
								<div className="rounded bg-slate-50 p-3 text-sm">
									Đã mở đúng chứng từ gốc {relatedDetail.code}.
								</div>
							) : (
								<p className="text-sm text-slate-400">
									Không có dữ liệu chi tiết.
								</p>
							)}
						</div>
						<div className="erp-modal-footer">
							<button
								type="button"
								className="erp-btn"
								onClick={() => setRelatedDetail(null)}
							>
								Đóng
							</button>
						</div>
					</div>
				</div>
			)}
			{paymentOrder && (
				<div className="erp-modal-backdrop" style={{ zIndex: 310 }}>
					<div className="erp-modal max-w-xl">
						<div className="erp-modal-header">
							<div>
								<h2>Thu tiền {paymentOrder.code}</h2>
								<p>
									{paymentOrder.customerName} · Còn lại{" "}
									{formatNumber(
										paymentOrder.totalAmount -
											Number(paymentOrder.paidAmount || 0),
									)}{" "}
									₫
								</p>
							</div>
							<button onClick={() => setPaymentOrder(null)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							<div className="grid gap-4 md:grid-cols-2">
								<label>
									Số tiền thu
									<input
										type="number"
										min={0}
										step="any"
										value={paymentAmount}
										onChange={event =>
											setPaymentAmount(Number(event.target.value))
										}
									/>
								</label>
								<label>
									Hình thức
									<select
										value={paymentMethod}
										onChange={event =>
											setPaymentMethod(event.target.value as "CASH" | "BANK")
										}
									>
										<option value="BANK">Chuyển khoản</option>
										<option value="CASH">Tiền mặt</option>
									</select>
								</label>
							</div>
							<label>
								Ghi chú thu tiền
								<textarea
									rows={3}
									value={paymentNote}
									onChange={event => setPaymentNote(event.target.value)}
								/>
							</label>
						</div>
						<div className="erp-modal-footer">
							<button
								type="button"
								className="erp-btn"
								onClick={() => setPaymentOrder(null)}
							>
								Hủy
							</button>
							<button
								type="button"
								className="erp-btn erp-btn-primary"
								disabled={actionMutation.isPending || paymentAmount <= 0}
								onClick={() => {
									actionMutation.mutate({
										document: paymentOrder,
										action: "payments",
										extra: {
											amount: paymentAmount,
											paymentDate: today(),
											method: paymentMethod,
											note: paymentNote || `Thu tiền ${paymentOrder.code}`,
										},
									});
									setPaymentOrder(null);
								}}
							>
								Xác nhận thu tiền
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
