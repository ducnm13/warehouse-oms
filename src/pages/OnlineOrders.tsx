import React, { useState, useEffect } from "react";
import {
	Plus,
	Edit,
	Eye,
	Trash2,
	X,
	Search,
	Package,
	Truck,
	RefreshCw,
	Save,
	TrendingUp,
	ShoppingCart,
	Clock3,
	CheckCircle2,
	ExternalLink,
	MapPin,
} from "lucide-react";
import toast from "../components/ui/toast";
import DeliveryPromise from "../components/DeliveryPromise";
import { confirm } from "../components/ui/confirm";
import { apiV1, legacyApi } from "../lib/apiV1";
import SearchableSelect from "../components/SearchableSelect";
import { formatNumber, formatDate } from "../lib/utils";
import type { Product } from "../types";

interface OnlineProduct {
	id: number;
	packagingId?: number | null;
	name: string;
	price: number;
	unit?: string;
	packagingName?: string | null;
	packagingSku?: string | null;
}

interface OnlineOrderItem {
	productName: string;
	quantity: number;
	price: number;
	unit: string;
	packagingId?: number | null;
	onlineProductId?: number | null;
}

interface OnlineOrder {
	id: number;
	orderCode: string;
	orderDate: string;
	recipientName: string;
	phone: string;
	address: string;
	shippingFee: number;
	totalAmount: number;
	status: string;
	trackingNumber?: string | null;
	items: OnlineOrderItem[];
}

const STATUS_META: Record<string, { label: string; css: string }> = {
	Pending: { label: "Chờ đóng gói", css: "bg-amber-100 text-amber-700" },
	Packing: { label: "Đang đóng gói", css: "bg-indigo-100 text-indigo-700" },
	Shipping: { label: "Đang giao hàng", css: "bg-sky-100 text-sky-700" },
	Shipped: { label: "Đã giao vận chuyển", css: "bg-blue-100 text-blue-700" },
	Delivered: {
		label: "Giao thành công",
		css: "bg-emerald-100 text-emerald-700",
	},
	Cancelled: { label: "Đã hủy", css: "bg-red-100 text-red-700" },
};

const newOrderCode = () => `DH${Math.floor(100000 + Math.random() * 900000)}`;

const OnlineOrders = () => {
	const [tab, setTab] = useState<
		"dashboard" | "create" | "orders" | "products" | "reports"
	>("dashboard");
	const [reportMonth, setReportMonth] = useState(() =>
		new Date().toISOString().slice(0, 7),
	);
	const [topProducts, setTopProducts] = useState<
		Array<{
			productName: string;
			unit: string;
			quantity: number;
			revenue: number;
			orders: number;
		}>
	>([]);
	const [monthlyRows, setMonthlyRows] = useState<
		Array<{ month: string; orders: number; revenue: number }>
	>([]);
	const [reportLoading, setReportLoading] = useState(false);
	const [orders, setOrders] = useState<OnlineOrder[]>([]);
	const [products, setProducts] = useState<OnlineProduct[]>([]);
	const [erpProducts, setErpProducts] = useState<Product[]>([]);
	const [companyBook, setCompanyBook] = useState<{
		id: number;
		name: string;
		code: string;
	} | null>(null);
	const [companyPrices, setCompanyPrices] = useState<Map<number, number>>(
		new Map(),
	);
	const [stats, setStats] = useState<{
		totalRevenue: number;
		totalOrders: number;
		dailyRevenue: Array<{ date: string; revenue: number }>;
		monthlyRevenue?: Array<{ month: string; revenue: number }>;
	} | null>(null);
	const [revenueMode, setRevenueMode] = useState<"days" | "months">("months");
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	// Bộ lọc đơn
	const [searchTerm, setSearchTerm] = useState("");
	const [statusFilter, setStatusFilter] = useState("ALL");
	const [page, setPage] = useState(1);
	const [totalPages, setTotalPages] = useState(1);

	// Form tạo đơn
	const [orderCode, setOrderCode] = useState("");

	const fetchNextOrderCode = async () => {
		try {
			const res = await apiV1<{ code: string }>("/api/v1/online/next-code");
			if (res.data?.code) {
				setOrderCode(res.data.code);
				return;
			}
		} catch {
			// rớt mạng/API cũ: dùng mã ngẫu nhiên như trước
		}
		setOrderCode(newOrderCode());
	};
	const [recipientName, setRecipientName] = useState("");
	const [phone, setPhone] = useState("");
	const [address, setAddress] = useState("");
	const [shippingFee, setShippingFee] = useState(30000);
	const emptyItem = (): OnlineOrderItem => ({
		productName: "",
		quantity: 1,
		price: 0,
		unit: "Cái",
		packagingId: null,
		onlineProductId: null,
	});
	const [items, setItems] = useState<OnlineOrderItem[]>([emptyItem()]);

	// Tracking
	const [trackingOrderId, setTrackingOrderId] = useState<number | null>(null);
	const [trackingNumber, setTrackingNumber] = useState("");
	const [trackingInfo, setTrackingInfo] = useState<any>(null);
	const [trackingModal, setTrackingModal] = useState(false);
	const [detailOrder, setDetailOrder] = useState<OnlineOrder | null>(null);
	const [syncing, setSyncing] = useState(false);

	const handleSpxSync = async () => {
		const loadingId = toast.loading("Đang hỏi SPX trạng thái các đơn đang giao...");
		setSyncing(true);
		try {
			const res = await apiV1<{
				checked: number;
				succeeded: number;
				failed: number;
				changed: number;
				delivered: string[];
			}>("/api/v1/online/tracking-sync", { method: "POST" });
			const d = res.data;
			toast.success(
				`Đã đồng bộ ${d.checked} đơn` +
					(d.changed ? `, ${d.changed} đổi trạng thái` : ", không đổi") +
					(d.delivered.length ? `: ${d.delivered.join(", ")} đã giao` : "") +
					(d.failed ? `, ${d.failed} lỗi` : ""),
				{ id: loadingId },
			);
			fetchOrders();
			fetchStats();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lỗi khi đồng bộ SPX", { id: loadingId });
		} finally {
			setSyncing(false);
		}
	};

	const handleDeleteOrder = async (order: OnlineOrder) => {
    if (!(await confirm(`Xóa đơn hàng ${order.orderCode}?`))) return;
		try {
			await apiV1(`/api/v1/online/orders/${order.id}`, { method: "DELETE" });
			toast.success("Đã xóa đơn hàng");
			if (detailOrder?.id === order.id) setDetailOrder(null);
			fetchOrders();
			fetchStats();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lỗi khi xóa đơn");
		}
	};

	// Form sản phẩm
	const [editingProduct, setEditingProduct] = useState<OnlineProduct | null>(
		null,
	);
	const [prodName, setProdName] = useState("");
	const [prodPrice, setProdPrice] = useState("");
	const [prodUnit, setProdUnit] = useState("Cái");
	const [prodPackagingId, setProdPackagingId] = useState(0);

	const fetchOrders = async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams({ page: String(page), limit: "20" });
			if (searchTerm.trim()) params.set("search", searchTerm.trim());
			if (statusFilter !== "ALL") params.set("status", statusFilter);
			const res = await apiV1<OnlineOrder[]>(
				`/api/v1/online/orders?${params.toString()}`,
			);
			const rows = res.data || [];
			setOrders(rows);
			setTotalPages((res.meta as any)?.totalPages || 1);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lỗi tải đơn hàng");
			setOrders([]);
		} finally {
			setLoading(false);
		}
	};

	const fetchProducts = async () => {
		try {
			const res = await apiV1<OnlineProduct[]>("/api/v1/online/products");
			setProducts(res.data || []);
		} catch {
			setProducts([]);
		}
	};

	const fetchStats = async () => {
		try {
			const res = await apiV1<any>("/api/v1/online/stats");
			setStats(res.data);
		} catch {
			setStats(null);
		}
	};

	const fetchErpProducts = async () => {
		try {
			const rows = await legacyApi<Product[]>("/api/products?category=PRODUCT");
			setErpProducts(Array.isArray(rows) ? rows : []);
		} catch {
			setErpProducts([]);
		}
	};

	// Bảng giá công ty: ưu tiên bảng tên/mã "công ty", rồi mới tới mặc định
	const fetchCompanyPrices = async () => {
		try {
			const list = await apiV1<
				Array<{ id: number; code: string; name: string; isDefault?: boolean }>
			>("/api/v1/catalog/price-books?limit=100");
			const books = list.data || [];
			const norm = (s: string) => (s || "").toLowerCase();
			const book =
				books.find(
					b =>
						norm(`${b.name} ${b.code}`).includes("công ty") ||
						norm(b.code).startsWith("bgct"),
				) ||
				books.find(b => (b as any).isDefault) ||
				books[0];
			if (!book) return;
			setCompanyBook({ id: book.id, name: book.name, code: book.code });
			const detail = await apiV1<{
				items?: Array<{ packagingId: number; salePrice: number }>;
			}>(`/api/v1/catalog/price-books/${book.id}`);
			const payload: any = detail.data;
			const arr = Array.isArray(payload) ? payload : payload?.items || [];
			const map = new Map<number, number>();
			for (const item of arr) {
				const price = Number(item.salePrice || 0);
				if (item.packagingId && price > 0) map.set(item.packagingId, price);
			}
			setCompanyPrices(map);
		} catch {
			setCompanyPrices(new Map());
		}
	};

	useEffect(() => {
		fetchProducts();
		fetchStats();
		fetchErpProducts();
		fetchCompanyPrices();
		fetchNextOrderCode();
	}, []);

	useEffect(() => {
		if (tab === "orders") fetchOrders();
		if (tab === "reports") fetchReports(reportMonth);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [tab, page, statusFilter]);

	useEffect(() => {
		if (tab === "reports") fetchReports(reportMonth);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [reportMonth]);

	useEffect(() => {
		if (tab !== "orders") return;
		const t = setTimeout(() => {
			setPage(1);
			fetchOrders();
		}, 400);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [searchTerm]);

	const subtotal = items.reduce(
		(s, i) => s + Number(i.quantity || 0) * Number(i.price || 0),
		0,
	);
	const total = subtotal + Number(shippingFee || 0);

	const companyPriceOf = (packagingId?: number | null) =>
		packagingId ? companyPrices.get(packagingId) : undefined;

	const handleProductSelect = (index: number, productId: number | null) => {
		if (!productId) {
			// Bỏ chọn: giữ tên/giá đã nhập, chỉ gỡ liên kết
			setItems(
				items.map((item, i) =>
					i === index ? { ...item, onlineProductId: null } : item,
				),
			);
			return;
		}
		const p = products.find(x => x.id === productId);
		if (!p) return;
		// Ưu tiên giá bảng công ty cho SP đã link, thiếu mới dùng giá riêng
		const price = companyPriceOf(p.packagingId) ?? p.price;
		setItems(
			items.map((item, i) =>
				i === index
					? {
							...item,
							productName: p.name,
							price,
							unit: p.unit || "Cái",
							packagingId: p.packagingId || null,
							onlineProductId: p.id,
						}
					: item,
			),
		);
	};

	// Đồng bộ giá bán theo bảng giá công ty cho các SP đã link kho
	const fetchReports = async (month: string) => {
		setReportLoading(true);
		try {
			const [top, monthly] = await Promise.all([
				apiV1<
					Array<{
						productName: string;
						unit: string;
						quantity: number;
						revenue: number;
						orders: number;
					}>
				>(`/api/v1/online/reports/top-products?month=${month}&limit=50`),
				apiV1<Array<{ month: string; orders: number; revenue: number }>>(
					"/api/v1/online/reports/monthly?months=12",
				),
			]);
			setTopProducts(top.data || []);
			setMonthlyRows(monthly.data || []);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lỗi tải báo cáo");
		} finally {
			setReportLoading(false);
		}
	};

	const downloadCsv = (
		filename: string,
		headers: string[],
		rows: Array<Array<string | number>>,
	) => {
		const esc = (v: string | number) =>
			`"${String(v ?? "").replace(/"/g, '""')}"`;
		const csv =
			"﻿" +
			[headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))].join(
				"\n",
			);
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = filename;
		link.click();
		URL.revokeObjectURL(url);
	};

	const exportTopProducts = () => {
		downloadCsv(
			`top-san-pham-${reportMonth}.csv`,
			["Hạng", "Sản phẩm", "ĐVT", "SL bán", "Số đơn", "Doanh thu (đ)"],
			topProducts.map((p, i) => [
				i + 1,
				p.productName,
				p.unit || "",
				p.quantity,
				p.orders,
				p.revenue,
			]),
		);
		toast.success(`Đã xuất ${topProducts.length} sản phẩm bán chạy`);
	};

	const exportMonthly = () => {
		downloadCsv(
			"doanh-so-theo-thang.csv",
			["Tháng", "Số đơn", "Doanh thu (đ)"],
			monthlyRows.map(r => [
				r.month.slice(5, 7) + "/" + r.month.slice(0, 4),
				r.orders,
				r.revenue,
			]),
		);
		toast.success(`Đã xuất doanh số ${monthlyRows.length} tháng`);
	};

	const handleSyncCompanyPrices = async () => {
		const targets = products.filter(
			p =>
				p.packagingId &&
				companyPriceOf(p.packagingId) !== undefined &&
				Number(companyPriceOf(p.packagingId)) !== Number(p.price),
		);
		if (!targets.length) {
			toast.success("Giá đã khớp bảng công ty");
			return;
		}
		let done = 0;
		for (const p of targets) {
			try {
				await apiV1(`/api/v1/online/products/${p.id}`, {
					method: "PUT",
					body: JSON.stringify({
						name: p.name,
						price: Number(companyPriceOf(p.packagingId)),
						unit: p.unit || "Cái",
						packagingId: p.packagingId,
					}),
				});
				done += 1;
			} catch {
				// bỏ qua dòng lỗi, báo tổng cuối
			}
		}
		toast.success(
			`Đã đồng bộ ${done}/${targets.length} sản phẩm theo ${companyBook ? `${companyBook.name} (${companyBook.code})` : "bảng giá công ty"}`,
		);
		fetchProducts();
	};

	const handleCreateOrder = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!recipientName.trim() || !phone.trim() || !address.trim()) {
			toast.error("Nhập đủ tên, SĐT và địa chỉ người nhận");
			return;
		}
		if (
			!items.length ||
			items.some(i => !i.productName.trim() || Number(i.quantity) <= 0)
		) {
			toast.error("Mỗi dòng cần tên sản phẩm và số lượng > 0");
			return;
		}
		setSaving(true);
		try {
			const payload = () => ({
				orderCode,
				recipientName: recipientName.trim(),
				phone: phone.trim(),
				address: address.trim(),
				shippingFee: Number(shippingFee || 0),
				items: items.map(i => ({
					productName: i.productName.trim(),
					quantity: Number(i.quantity),
					price: Number(i.price || 0),
					unit: i.unit || "Cái",
					...(i.packagingId ? { packagingId: i.packagingId } : {}),
				})),
			});
			let finalCode = orderCode;
			try {
				await apiV1("/api/v1/online/orders", {
					method: "POST",
					body: JSON.stringify(payload()),
				});
			} catch (err) {
				// Trùng mã do tạo song song: lấy mã kế tiếp rồi thử lại 1 lần
				if ((err as any)?.code !== "ONLINE_ORDER_CODE_EXISTS") throw err;
				const fresh = await apiV1<{ code: string }>(
					"/api/v1/online/next-code",
				).catch(() => null);
				if (!fresh?.data?.code) throw err;
				finalCode = fresh.data.code;
				setOrderCode(finalCode);
				await apiV1("/api/v1/online/orders", {
					method: "POST",
					body: JSON.stringify({ ...payload(), orderCode: finalCode }),
				});
			}
			toast.success(`Đã tạo đơn hàng ${finalCode} (đã báo Zalo cho kho)`);
			fetchNextOrderCode();
			setRecipientName("");
			setPhone("");
			setAddress("");
			setShippingFee(30000);
			setItems([emptyItem()]);
			fetchOrders();
			fetchStats();
			setTab("orders");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lỗi khi tạo đơn");
		} finally {
			setSaving(false);
		}
	};

	const handleUpdateStatus = async (id: number, status: string) => {
		try {
			await apiV1(`/api/v1/online/orders/${id}/status`, {
				method: "PUT",
				body: JSON.stringify({ status }),
			});
			toast.success(
				`Đã cập nhật trạng thái thành ${STATUS_META[status]?.label || status}`,
			);
			fetchOrders();
			fetchStats();
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Lỗi cập nhật trạng thái",
			);
		}
	};

	const handleUpdateTracking = async (id: number) => {
		if (!trackingNumber.trim()) return;
		try {
			await apiV1(`/api/v1/online/orders/${id}/tracking`, {
				method: "PUT",
				body: JSON.stringify({ tracking_number: trackingNumber.trim() }),
			});
			toast.success("Đã cập nhật mã vận đơn");
			setTrackingOrderId(null);
			setTrackingNumber("");
			fetchOrders();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lỗi cập nhật vận đơn");
		}
	};

	const handleViewTracking = async (tn: string) => {
		try {
			setLoading(true);
			const res = await apiV1<any>(
				`/api/v1/online/tracking/${encodeURIComponent(tn)}`,
			);
			setTrackingInfo(res.data);
			setTrackingModal(true);
			fetchOrders();
			fetchStats();
		} catch {
			toast.error("Không lấy được thông tin vận đơn từ SPX");
		} finally {
			setLoading(false);
		}
	};

	const resetProductForm = () => {
		setEditingProduct(null);
		setProdName("");
		setProdPrice("");
		setProdUnit("Cái");
		setProdPackagingId(0);
	};

	const handleSaveProduct = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!prodName.trim()) {
			toast.error("Tên sản phẩm là bắt buộc");
			return;
		}
		if (!(Number(prodPrice) > 0)) {
			toast.error("Đơn giá phải lớn hơn 0");
			return;
		}
		try {
			const payload = {
				name: prodName.trim(),
				price: Number(prodPrice || 0),
				unit: prodUnit || "Cái",
				packagingId: prodPackagingId || null,
			};
			if (editingProduct) {
				await apiV1(`/api/v1/online/products/${editingProduct.id}`, {
					method: "PUT",
					body: JSON.stringify(payload),
				});
				toast.success("Đã cập nhật sản phẩm");
			} else {
				await apiV1("/api/v1/online/products", {
					method: "POST",
					body: JSON.stringify(payload),
				});
				toast.success("Đã thêm sản phẩm");
			}
			resetProductForm();
			fetchProducts();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lỗi lưu sản phẩm");
		}
	};

	const handleSyncNames = async () => {
		try {
			const res = await apiV1<{ updated: number }>(
				"/api/v1/online/products/sync-names",
				{ method: "POST" },
			);
			toast.success(`Đã đồng bộ ${res.data?.updated || 0} tên từ kho`);
			fetchProducts();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lỗi đồng bộ tên");
		}
	};

	const erpPackagings = erpProducts.flatMap(p =>
		(p.packagings || []).map(pk => ({ ...pk, productName: p.name })),
	);

	const revenueSeries =
		revenueMode === "months"
			? (stats?.monthlyRevenue || []).map(d => ({
					label: d.month.slice(5, 7) + "/" + d.month.slice(0, 4),
					revenue: Number(d.revenue || 0),
				}))
			: (stats?.dailyRevenue || []).map(d => ({
					label: formatDate(String(d.date).slice(0, 10)),
					revenue: Number(d.revenue || 0),
				}));
	const maxRevenue = revenueSeries.length
		? Math.max(...revenueSeries.map(d => d.revenue), 1)
		: 1;

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Bán hàng online</h1>
					<p>Đơn online, đóng gói, vận chuyển SPX và doanh số</p>
				</div>
			</div>

			<div className="mb-4 flex items-center gap-1 border-b border-slate-200">
				{(
					[
						["dashboard", "Tổng quan"],
						["create", "Tạo đơn mới"],
						["orders", "Đơn hàng & Đóng gói"],
						["products", "Sản phẩm"],
						["reports", "Báo cáo"],
					] as const
				).map(([key, label]) => (
					<button
						key={key}
						type="button"
						onClick={() => setTab(key)}
						className={`relative px-4 py-2.5 text-sm font-semibold transition-colors ${
							tab === key
								? "text-[#422afb]"
								: "text-[#a3aed0] hover:text-[#2b3674]"
						}`}
					>
						{label}
						{tab === key && (
							<span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#422afb]" />
						)}
					</button>
				))}
			</div>

			{tab === "dashboard" && (
				<>
					<div className="grid gap-4 md:grid-cols-4">
						<div className="erp-stat">
							<TrendingUp />
							<div>
								<span>Tổng doanh thu</span>
								<strong>
									{formatNumber(Number(stats?.totalRevenue || 0))} ₫
								</strong>
							</div>
						</div>
						<div className="erp-stat">
							<ShoppingCart />
							<div>
								<span>Tổng đơn hàng</span>
								<strong>{stats?.totalOrders || 0} đơn</strong>
							</div>
						</div>
						<div className="erp-stat">
							<Clock3 />
							<div>
								<span>Chờ đóng gói</span>
								<strong>
									{orders.filter(o => o.status === "Pending").length} đơn
								</strong>
							</div>
						</div>
						<div className="erp-stat">
							<CheckCircle2 />
							<div>
								<span>Giao thành công</span>
								<strong>
									{orders.filter(o => o.status === "Delivered").length} đơn
								</strong>
							</div>
						</div>
					</div>
					<div className="erp-card overflow-hidden">
						<div className="erp-toolbar">
							<b>Biểu đồ doanh thu</b>
							<div className="flex gap-1 rounded-lg bg-slate-100 p-1">
								{(["days", "months"] as const).map(mode => (
									<button
										key={mode}
										type="button"
										onClick={() => setRevenueMode(mode)}
										className={`rounded-md px-3 py-1 text-xs font-bold transition-colors ${
											revenueMode === mode
												? "bg-white text-emerald-700 shadow"
												: "text-[#a3aed0] hover:text-[#2b3674]"
										}`}
									>
										{mode === "days" ? "7 ngày" : "12 tháng"}
									</button>
								))}
							</div>
						</div>
						<div className="flex h-56 items-end justify-between gap-3 overflow-x-auto p-4">
							{revenueSeries.length ? (
								revenueSeries.map((d, i) => (
									<div
										key={i}
										className="flex h-full min-w-[44px] flex-1 flex-col items-center justify-end"
										title={`${formatNumber(d.revenue)} ₫`}
									>
										<div
											className="w-full max-w-[52px] rounded-t-lg bg-emerald-500"
											style={{
												height: `${Math.max((d.revenue / maxRevenue) * 100, 6)}%`,
											}}
										/>
										<small className="mt-2 whitespace-nowrap font-bold text-slate-500">
											{d.label}
										</small>
									</div>
								))
							) : (
								<p className="w-full text-center text-slate-400">
									Chưa có dữ liệu doanh thu
								</p>
							)}
						</div>
					</div>
				</>
			)}

			{tab === "create" && (
				<form onSubmit={handleCreateOrder} className="erp-card space-y-4 p-4">
					<div className="grid gap-4 md:grid-cols-3">
						<label className="text-[13px] font-medium text-slate-700">
							<span className="mb-1 block">Mã đơn hàng (tự sinh)</span>
							<div className="flex gap-2">
								<input
									type="text"
									value={orderCode}
									readOnly
									className="flex-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-600 outline-none"
								/>
								<button
									type="button"
									title="Mã mới"
									onClick={() => fetchNextOrderCode()}
									className="erp-btn !px-3"
								>
									<RefreshCw size={15} />
								</button>
							</div>
						</label>
						<label className="text-[13px] font-medium text-slate-700">
							<span className="mb-1 block">
								Tên người nhận <span className="text-red-500">*</span>
							</span>
							<input
								type="text"
								required
								value={recipientName}
								onChange={e => setRecipientName(e.target.value)}
								placeholder="VD: Nguyễn Văn A"
								className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
							/>
						</label>
						<label className="text-[13px] font-medium text-slate-700">
							<span className="mb-1 block">
								Số điện thoại <span className="text-red-500">*</span>
							</span>
							<input
								type="text"
								required
								value={phone}
								onChange={e => setPhone(e.target.value)}
								placeholder="VD: 0912345678"
								className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
							/>
						</label>
					</div>
					<label className="block text-[13px] font-medium text-slate-700">
						<span className="mb-1 block">
							Địa chỉ giao hàng <span className="text-red-500">*</span>
						</span>
						<input
							type="text"
							required
							value={address}
							onChange={e => setAddress(e.target.value)}
							placeholder="Số nhà, đường, phường/xã..."
							className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
						/>
					</label>
					<div>
						<div className="mb-2 flex items-center justify-between">
							<b>Danh sách sản phẩm</b>
							<button
								type="button"
								onClick={() => setItems([...items, emptyItem()])}
								className="erp-btn"
							>
								<Plus size={14} /> Thêm dòng
							</button>
						</div>
						<div className="space-y-2">
							{items.map((item, index) => (
								<div
									key={index}
									className="grid items-center gap-2 md:grid-cols-[1fr_90px_80px_130px_120px_40px]"
								>
									<SearchableSelect
										value={item.onlineProductId || 0}
										options={products.map(p => ({
											value: p.id,
											label: p.name,
											subLabel: `${formatNumber(p.price)}đ/${p.unit || "Cái"}`,
										}))}
										onChange={id => handleProductSelect(index, id || null)}
										placeholder="Gõ để tìm sản phẩm..."
									/>
									<input
										type="text"
										value={item.unit}
										onChange={e =>
											setItems(
												items.map((x, i) =>
													i === index ? { ...x, unit: e.target.value } : x,
												),
											)
										}
										placeholder="ĐVT"
										className="rounded border border-slate-300 px-3 py-2 text-center text-sm outline-none focus:border-emerald-500"
									/>
									<input
										type="number"
										min={1}
										value={item.quantity}
										onChange={e =>
											setItems(
												items.map((x, i) =>
													i === index
														? { ...x, quantity: Number(e.target.value) }
														: x,
												),
											)
										}
										placeholder="SL"
										className="rounded border border-slate-300 px-3 py-2 text-center text-sm outline-none focus:border-emerald-500"
									/>
									<input
										type="number"
										min={0}
										value={item.price}
										onChange={e =>
											setItems(
												items.map((x, i) =>
													i === index
														? { ...x, price: Number(e.target.value) }
														: x,
												),
											)
										}
										placeholder="Đơn giá"
										className="rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
									/>
									<b className="text-right text-emerald-700">
										{formatNumber(
											Number(item.quantity || 0) * Number(item.price || 0),
										)}{" "}
										₫
									</b>
									{items.length > 1 ? (
										<button
											type="button"
											onClick={() =>
												setItems(items.filter((_, i) => i !== index))
											}
											className="erp-icon-btn text-red-500"
											title="Xóa dòng"
										>
											<Trash2 size={15} />
										</button>
									) : (
										<span />
									)}
								</div>
							))}
						</div>
					</div>
					<div className="space-y-2 rounded-lg bg-slate-50 p-4">
						<div className="flex justify-between text-sm">
							<span>Tiền hàng:</span>
							<b>{formatNumber(subtotal)} ₫</b>
						</div>
						<div className="flex items-center justify-between text-sm">
							<span>Phí ship:</span>
							<input
								type="number"
								min={0}
								value={shippingFee}
								onChange={e => setShippingFee(Number(e.target.value))}
								className="w-36 rounded border border-slate-300 px-3 py-2 text-right text-sm outline-none focus:border-emerald-500"
							/>
						</div>
						<div className="flex justify-between border-t border-slate-200 pt-2 text-lg font-black text-emerald-700">
							<span>Tổng thanh toán:</span>
							<span>{formatNumber(total)} ₫</span>
						</div>
					</div>
					<button
						type="submit"
						disabled={saving}
						className="erp-btn erp-btn-primary w-full py-3 text-base"
					>
						{saving ? "Đang lưu..." : "Lưu đơn hàng"}
					</button>
				</form>
			)}

			{tab === "orders" && (
				<div className="erp-card overflow-hidden">
					<div className="erp-toolbar">
						<div className="erp-search">
							<Search size={16} />
							<input
								type="text"
								placeholder="Tìm mã đơn, tên, SĐT, địa chỉ, mã vận đơn..."
								value={searchTerm}
								onChange={e => setSearchTerm(e.target.value)}
							/>
						</div>
						<select
							value={statusFilter}
							onChange={e => {
								setStatusFilter(e.target.value);
								setPage(1);
							}}
							className="w-52 rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
						>
							<option value="ALL">Tất cả trạng thái</option>
							{Object.entries(STATUS_META).map(([key, v]) => (
								<option key={key} value={key}>
									{v.label}
								</option>
							))}
						</select>
						<button
							type="button"
							onClick={handleSpxSync}
							disabled={syncing}
							className="erp-btn"
							title="Hỏi SPX trạng thái mới nhất của các đơn đang giao"
						>
							<RefreshCw size={14} /> {syncing ? "Đang đồng bộ..." : "Đồng bộ SPX"}
						</button>
					</div>
					<div className="overflow-x-auto">
						<table className="erp-table">
							<thead>
								<tr>
									<th>Mã đơn</th>
									<th>Người nhận</th>
									<th>Sản phẩm</th>
									<th className="text-right">Tổng tiền</th>
									<th>Trạng thái</th>
									<th className="text-right">Thao tác</th>
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr>
										<td
											colSpan={6}
											className="py-12 text-center text-slate-400"
										>
											Đang tải...
										</td>
									</tr>
								) : orders.length === 0 ? (
									<tr>
										<td
											colSpan={6}
											className="py-12 text-center text-slate-400"
										>
											Không tìm thấy đơn hàng nào
										</td>
									</tr>
								) : (
									orders.map(order => (
										<tr key={order.id}>
											<td>
												<b>{order.orderCode}</b>
												<small className="block">
													{formatDate(String(order.orderDate).slice(0, 10))}
												</small>
												{order.trackingNumber && (
													<button
														onClick={() =>
															handleViewTracking(order.trackingNumber!)
														}
														className="mt-1 inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-600 hover:bg-indigo-100"
														title="Xem hành trình SPX"
													>
														<Truck size={12} /> {order.trackingNumber}{" "}
														<ExternalLink size={10} />
													</button>
												)}
											</td>
											<td>
												<b>{order.recipientName}</b>
												<small className="block text-indigo-600">
													{order.phone}
												</small>
												<small className="block max-w-xs truncate text-slate-500">
													{order.address}
												</small>
											</td>
											<td>
												{(order.items || []).map((item, i) => (
													<div key={i} className="text-xs text-slate-600">
														•{" "}
														<b className="text-slate-800">{item.productName}</b>{" "}
														(x{item.quantity} {item.unit || "Cái"}) -{" "}
														{formatNumber(item.price)} ₫
													</div>
												))}
												<small className="text-slate-400">
													Phí ship: {formatNumber(order.shippingFee)} ₫
												</small>
											</td>
											<td className="text-right font-black">
												{formatNumber(order.totalAmount)} ₫
											</td>
											<td>
												<span
													className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${STATUS_META[order.status]?.css || "bg-slate-100 text-slate-600"}`}
												>
													{STATUS_META[order.status]?.label || order.status}
												</span>
											</td>
											<td className="text-right">
												<div className="flex flex-col items-end gap-1">
													<div className="flex items-center justify-end gap-1">
														<button onClick={() => setDetailOrder(order)} className="erp-icon-btn" title="Xem chi tiết">
															<Eye size={15} />
														</button>
														<button onClick={() => handleDeleteOrder(order)} className="erp-icon-btn text-red-500" title="Xóa đơn">
															<Trash2 size={15} />
														</button>
													</div>
													{order.status === "Pending" && (
														<button
															onClick={() =>
																handleUpdateStatus(order.id, "Packing")
															}
															className="erp-btn"
														>
															Đóng gói
														</button>
													)}
													{(order.status === "Pending" ||
														order.status === "Packing") &&
														(trackingOrderId === order.id ? (
															<div className="flex gap-1">
																<input
																	autoFocus
																	type="text"
																	placeholder="Nhập mã vận đơn..."
																	value={trackingNumber}
																	onChange={e =>
																		setTrackingNumber(e.target.value)
																	}
																	className="w-36 rounded border border-slate-300 px-2 py-1 text-xs outline-none focus:border-emerald-500"
																/>
																<button
																	onClick={() => handleUpdateTracking(order.id)}
																	className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
																>
																	OK
																</button>
																<button
																	onClick={() => {
																		setTrackingOrderId(null);
																		setTrackingNumber("");
																	}}
																	className="rounded bg-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-300"
																>
																	Hủy
																</button>
															</div>
														) : (
															<button
																onClick={() => setTrackingOrderId(order.id)}
																className="erp-btn"
															>
																Giao vận chuyển
															</button>
														))}
													{order.status === "Shipped" && (
														<button
															onClick={() =>
																handleUpdateStatus(order.id, "Cancelled")
															}
															className="erp-btn text-red-600"
														>
															Hủy đơn
														</button>
													)}
												</div>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
					{totalPages > 1 && (
						<div className="erp-pagination">
							<button
								className="erp-btn"
								disabled={page <= 1}
								onClick={() => setPage(p => p - 1)}
							>
								Trước
							</button>
							<span>
								Trang {page}/{totalPages}
							</span>
							<button
								className="erp-btn"
								disabled={page >= totalPages}
								onClick={() => setPage(p => p + 1)}
							>
								Sau
							</button>
						</div>
					)}
				</div>
			)}

			{tab === "products" && (
				<>
					<form onSubmit={handleSaveProduct} className="erp-card space-y-4 p-4">
						<div className="flex items-center justify-between">
							<b>
								{editingProduct
									? `Đang sửa: ${editingProduct.name}`
									: "Thêm sản phẩm mới"}
							</b>
							<div className="flex flex-wrap items-center gap-2">
								{companyBook && (
									<small className="text-slate-500">
										Giá theo:{" "}
										<b>
											{companyBook.name} ({companyBook.code})
										</b>
									</small>
								)}
								{editingProduct && (
									<button
										type="button"
										onClick={resetProductForm}
										className="erp-btn"
									>
										Hủy sửa
									</button>
								)}
								<button
									type="button"
									onClick={handleSyncNames}
									className="erp-btn"
									title="Cập nhật tên theo danh mục kho cho SP đã link"
								>
									<RefreshCw size={14} /> Đồng bộ tên từ kho
								</button>
								<button
									type="button"
									onClick={handleSyncCompanyPrices}
									className="erp-btn"
									title="Cập nhật giá bán theo bảng giá công ty cho SP đã link"
								>
									<RefreshCw size={14} /> Đồng bộ giá công ty
								</button>
							</div>
						</div>
						<div className="grid gap-4 md:grid-cols-2">
							<label className="text-[13px] font-medium text-slate-700 md:col-span-2">
								<span className="mb-1 block">
									Link thành phẩm kho (giữ tên đồng bộ)
								</span>
								<SearchableSelect
									value={prodPackagingId}
									options={erpPackagings.map(p => ({
										value: p.id,
										label:
											p.productName === p.name
												? p.name
												: `${p.productName} - ${p.name}`,
										subLabel: p.sku ? `SKU: ${p.sku}` : undefined,
									}))}
									onChange={id => {
										setProdPackagingId(id || 0);
										if (!id) return;
										const found = erpPackagings.find(p => p.id === id);
										if (found) {
											setProdName(
												found.productName === found.name
													? found.name
													: `${found.productName} - ${found.name}`,
											);
											if (found.unit) setProdUnit(found.unit);
											const bp = companyPriceOf(found.id);
											if (bp !== undefined) setProdPrice(String(bp));
										}
									}}
									placeholder="Gõ tên/SKU để tìm, X để nhập tay"
								/>
							</label>
							<label className="text-[13px] font-medium text-slate-700">
								<span className="mb-1 block">
									Tên sản phẩm <span className="text-red-500">*</span>
								</span>
								<input
									type="text"
									required
									value={prodName}
									onChange={e => setProdName(e.target.value)}
									placeholder="VD: Cà phê COP28 - Hộp 10 gói"
									className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
								/>
							</label>
							<label className="text-[13px] font-medium text-slate-700">
								<span className="mb-1 block">Đơn vị tính</span>
								<input
									type="text"
									value={prodUnit}
									onChange={e => setProdUnit(e.target.value)}
									placeholder="VD: Cái, Hộp..."
									className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
								/>
							</label>
							<label className="text-[13px] font-medium text-slate-700">
								<span className="mb-1 block">
									Đơn giá (đ) <span className="text-red-500">*</span>
								</span>
								<input
									type="number"
									min={0}
									required
									value={prodPrice}
									onChange={e => setProdPrice(e.target.value)}
									placeholder="VD: 350000"
									className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
								/>
							</label>
							<div className="flex items-end">
								<button
									type="submit"
									className="erp-btn erp-btn-primary w-full"
								>
									<Save size={14} />{" "}
									{editingProduct ? "Cập nhật" : "Thêm sản phẩm"}
								</button>
							</div>
						</div>
					</form>
					<div className="erp-card overflow-hidden">
						<div className="overflow-x-auto">
							<table className="erp-table">
								<thead>
									<tr>
										<th>ID</th>
										<th>Tên sản phẩm</th>
										<th className="text-right">Đơn giá</th>
										<th className="text-right">Giá công ty</th>
										<th>ĐVT</th>
										<th>Link kho</th>
										<th className="text-right">Thao tác</th>
									</tr>
								</thead>
								<tbody>
									{products.length === 0 ? (
										<tr>
											<td
												colSpan={7}
												className="py-12 text-center text-slate-400"
											>
												Chưa có sản phẩm nào
											</td>
										</tr>
									) : (
										products.map(p => {
											const bookPrice = companyPriceOf(p.packagingId);
											return (
												<tr
													key={p.id}
													className={
														editingProduct?.id === p.id ? "bg-amber-50" : ""
													}
												>
													<td className="font-bold text-slate-500">#{p.id}</td>
													<td className="font-bold">{p.name}</td>
													<td className="text-right font-bold text-emerald-700">
														{formatNumber(p.price)} ₫
													</td>
													<td className="text-right">
														{bookPrice !== undefined ? (
															<span className="font-bold text-indigo-600">
																{formatNumber(bookPrice)} ₫
															</span>
														) : (
															<span className="text-slate-400">—</span>
														)}
													</td>
													<td>{p.unit || "Cái"}</td>
													<td>
														{p.packagingSku ? (
															<span className="font-mono text-xs text-slate-500">
																{p.packagingSku}
															</span>
														) : (
															<span className="text-slate-400">—</span>
														)}
													</td>
													<td className="text-right">
														<button
															onClick={() => {
																setEditingProduct(p);
																setProdName(p.name);
																setProdPrice(String(p.price));
																setProdUnit(p.unit || "Cái");
																setProdPackagingId(p.packagingId || 0);
															}}
															className="erp-icon-btn text-blue-600"
															title="Sửa"
														>
															<Edit size={15} />
														</button>
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</div>
				</>
			)}

			{tab === "reports" && (
				<>
					<div className="erp-card overflow-hidden">
						<div className="erp-toolbar">
							<b>Sản phẩm bán chạy theo tháng</b>
							<div className="flex items-center gap-2">
								<input
									type="month"
									value={reportMonth}
									onChange={e =>
										e.target.value && setReportMonth(e.target.value)
									}
									className="rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
								/>
								<button
									type="button"
									onClick={exportTopProducts}
									className="erp-btn"
								>
									Xuất CSV
								</button>
							</div>
						</div>
						<div className="overflow-x-auto">
							<table className="erp-table">
								<thead>
									<tr>
										<th>Hạng</th>
										<th>Sản phẩm</th>
										<th>ĐVT</th>
										<th className="text-right">SL bán</th>
										<th className="text-right">Số đơn</th>
										<th className="text-right">Doanh thu</th>
									</tr>
								</thead>
								<tbody>
									{reportLoading ? (
										<tr>
											<td
												colSpan={6}
												className="py-12 text-center text-slate-400"
											>
												Đang tải...
											</td>
										</tr>
									) : topProducts.length === 0 ? (
										<tr>
											<td
												colSpan={6}
												className="py-12 text-center text-slate-400"
											>
												Chưa có số liệu tháng này
											</td>
										</tr>
									) : (
										topProducts.map((p, i) => (
											<tr key={i}>
												<td className="font-black text-slate-500">#{i + 1}</td>
												<td className="font-bold">{p.productName}</td>
												<td>{p.unit || ""}</td>
												<td className="text-right font-bold">
													{formatNumber(p.quantity)}
												</td>
												<td className="text-right">{formatNumber(p.orders)}</td>
												<td className="text-right font-bold text-emerald-700">
													{formatNumber(p.revenue)} ₫
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
					<div className="erp-card overflow-hidden">
						<div className="erp-toolbar">
							<b>Doanh số 12 tháng gần nhất</b>
							<button type="button" onClick={exportMonthly} className="erp-btn">
								Xuất CSV
							</button>
						</div>
						<div className="overflow-x-auto">
							<table className="erp-table">
								<thead>
									<tr>
										<th>Tháng</th>
										<th className="text-right">Số đơn</th>
										<th className="text-right">Doanh thu</th>
									</tr>
								</thead>
								<tbody>
									{monthlyRows.length === 0 ? (
										<tr>
											<td
												colSpan={3}
												className="py-12 text-center text-slate-400"
											>
												Chưa có số liệu
											</td>
										</tr>
									) : (
										monthlyRows.map(r => (
											<tr key={r.month}>
												<td className="font-bold">
													{r.month.slice(5, 7)}/{r.month.slice(0, 4)}
												</td>
												<td className="text-right">{formatNumber(r.orders)}</td>
												<td className="text-right font-bold text-emerald-700">
													{formatNumber(r.revenue)} ₫
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
				</>
			)}

			{detailOrder && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-2xl">
						<div className="erp-modal-header">
							<div>
								<h2>Đơn {detailOrder.orderCode}</h2>
								<p>
									{formatDate(String(detailOrder.orderDate).slice(0, 10))} ·{" "}
									{STATUS_META[detailOrder.status]?.label || detailOrder.status}
									{detailOrder.trackingNumber ? ` · Vận đơn: ${detailOrder.trackingNumber}` : ""}
								</p>
							</div>
							<button onClick={() => setDetailOrder(null)}><X /></button>
						</div>
						<div className="erp-modal-body space-y-4">
							<div className="grid gap-3 md:grid-cols-2">
								<div><small>Người nhận</small><b className="block">{detailOrder.recipientName}</b></div>
								<div><small>SĐT</small><b className="block">{detailOrder.phone}</b></div>
							</div>
							<div><small>Địa chỉ</small><b className="block">{detailOrder.address}</b></div>
						<div>
							<small className="mb-1 block">Cam kết giao hàng</small>
							<DeliveryPromise address={detailOrder.address} status={detailOrder.status} />
						</div>
							<table className="erp-table">
								<thead>
									<tr>
										<th>Sản phẩm</th>
										<th className="text-right">SL</th>
										<th className="text-right">Đơn giá</th>
										<th className="text-right">Thành tiền</th>
									</tr>
								</thead>
								<tbody>
									{(detailOrder.items || []).map((item, i) => (
										<tr key={i}>
											<td><b>{item.productName}</b><small>{item.unit || ""}</small></td>
											<td className="text-right">{formatNumber(item.quantity)}</td>
											<td className="text-right">{formatNumber(item.price)} ₫</td>
											<td className="text-right font-bold">{formatNumber(Number(item.quantity || 0) * Number(item.price || 0))} ₫</td>
										</tr>
									))}
								</tbody>
							</table>
							<div className="space-y-1 text-sm">
								<div className="flex justify-between"><span>Phí ship:</span><b>{formatNumber(detailOrder.shippingFee)} ₫</b></div>
								<div className="flex justify-between text-base font-black text-emerald-700">
									<span>Tổng thanh toán:</span><span>{formatNumber(detailOrder.totalAmount)} ₫</span>
								</div>
							</div>
						</div>
						<div className="erp-modal-footer">
							<button type="button" className="erp-btn text-red-600" onClick={() => handleDeleteOrder(detailOrder)}>
								Xóa đơn
							</button>
							<button type="button" className="erp-btn" onClick={() => setDetailOrder(null)}>
								Đóng
							</button>
						</div>
					</div>
				</div>
			)}

			{trackingModal && trackingInfo && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-2xl">
						<div className="erp-modal-header">
							<div>
								<h2>Vận đơn SPX</h2>
								<p>Theo dõi hành trình trực tiếp từ SPX</p>
							</div>
							<button onClick={() => setTrackingModal(false)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							{trackingInfo.retcode === 0 ? (
								<>
									<div className="grid gap-3 md:grid-cols-2">
										<div className="rounded bg-slate-50 p-3">
											<small>Mã vận đơn</small>
											<b className="block text-indigo-600">
												{trackingInfo.data?.sls_tracking_info?.sls_tn || "N/A"}
											</b>
										</div>
										<div className="rounded bg-slate-50 p-3">
											<small>Trạng thái hiện tại</small>
											<b className="block text-emerald-600">
												{trackingInfo.data?.sls_tracking_info?.records?.[0]
													?.description || "N/A"}
											</b>
										</div>
									</div>
									<div className="space-y-3">
										{(trackingInfo.data?.sls_tracking_info?.records || []).map(
											(step: any, idx: number) => (
												<div key={idx} className="flex gap-3">
													<span
														className={`mt-1 h-3 w-3 shrink-0 rounded-full ${idx === 0 ? "bg-indigo-600" : "bg-slate-300"}`}
													/>
													<div>
														<p
															className={`text-sm font-bold ${idx === 0 ? "text-indigo-600" : "text-slate-700"}`}
														>
															{step.description}
														</p>
														<small className="text-slate-500">
															{step.actual_time
																? new Date(
																		step.actual_time * 1000,
																	).toLocaleString("vi-VN")
																: ""}
														</small>
														{step.current_location?.location_name && (
															<small className="flex items-center gap-1 text-slate-400">
																<MapPin size={11} />
																{step.current_location.location_name}
															</small>
														)}
													</div>
												</div>
											),
										)}
									</div>
								</>
							) : (
								<div className="py-8 text-center text-slate-400">
									<p className="font-bold">Không tìm thấy thông tin vận đơn</p>
									<small>{trackingInfo.message}</small>
								</div>
							)}
						</div>
						<div className="erp-modal-footer">
							<button
								type="button"
								className="erp-btn"
								onClick={() => setTrackingModal(false)}
							>
								Đóng
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default OnlineOrders;
