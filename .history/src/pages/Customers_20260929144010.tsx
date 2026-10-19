import React, { useState, useEffect } from "react";
import {
	UserPlus,
	Edit,
	Trash2,
	X,
	Search,
	Phone,
	MapPin,
	Mail,
	Download,
	Filter,
	Clock3,
	WalletCards,
	CircleDollarSign,
	Tag,
	Plus,
	Save,
	ChevronDown,
} from "lucide-react";
import toast from "react-hot-toast";
import { Customer } from "../types";
import RightDrawer from "../components/RightDrawer";
import { apiV1 } from "../lib/apiV1";
import { formatNumber } from "../lib/utils";

const Customers = () => {
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [loading, setLoading] = useState(true);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [selectedCustomer, setSelectedCustomer] =
		useState<Partial<Customer> | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [groupFilter, setGroupFilter] = useState("");
	const [filterMenuOpen, setFilterMenuOpen] = useState(false);
	const [nextCustomerCode, setNextCustomerCode] = useState("KH00001");
	const [customerGroups, setCustomerGroups] = useState<
		Array<{
			id: number;
			code: string;
			name: string;
			parentId?: number;
			priceBookId?: number;
			isTeam?: boolean;
		}>
	>([]);
	const [priceBooks, setPriceBooks] = useState<
		Array<{ id: number; code: string; name: string }>
	>([]);
	const [groupModalOpen, setGroupModalOpen] = useState<
		"create" | "edit" | null
	>(null);
	const [editingGroup, setEditingGroup] = useState<{
		id: number;
		code: string;
		name: string;
		parentId?: number;
		priceBookId?: number;
	} | null>(null);
	const [groupForm, setGroupForm] = useState({
		code: "",
		name: "",
		parentId: 0,
		priceBookId: 0,
	});
	const [newGroupName, setNewGroupName] = useState("");
	const [creatingGroup, setCreatingGroup] = useState(false);

	const fetchNextCode = async () => {
		try {
			const res = await fetch("/api/next-code/customer", {
				headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
			});
			if (res.ok) {
				const data = await res.json();
				if (data.code) setNextCustomerCode(data.code);
			}
		} catch {
			// Giữ mã mặc định khi không lấy được sequence.
		}
	};

	const fetchCustomerGroups = async () => {
		try {
			const res = await fetch("/api/v1/customer-groups", {
				headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
			});
			if (res.ok) {
				const data = await res.json();
				const rows = Array.isArray(data?.data) ? data.data : [];
				const flattened: Array<{
					id: number;
					code: string;
					name: string;
					parentId?: number;
					priceBookId?: number;
					priceBook?: { id: number; code: string; name: string };
				}> = rows.flatMap((group: any) => [
					{
						id: group.id,
						code: group.code,
						name: group.name,
						parentId: group.parentId,
						priceBookId: group.priceBookId,
						priceBook: group.priceBook,
					},
					...(group.children || []).map((child: any) => ({
						id: child.id,
						code: child.code,
						name: child.name,
						parentId: child.parentId,
						priceBookId: child.priceBookId,
						priceBook: child.priceBook,
					})),
				]);
				setCustomerGroups(
					Array.from(new Map(flattened.map(item => [item.id, item])).values()),
				);
			} else if (res.status === 403) {
				toast.error(
					"Tài khoản chưa có quyền xem nhóm khách hàng (customer.view)",
				);
			}
		} catch {
			// Giữ danh sách nhóm hiện tại khi không tải được.
		}
	};

	const loadPriceBooks = async () => {
		try {
			const res = await apiV1<
				Array<{ id: number; code: string; name: string }>
			>("/api/v1/catalog/price-books?limit=100");
			setPriceBooks(res.data || []);
		} catch {
			setPriceBooks([]);
		}
	};

	const handleCreateGroup = async () => {
		setGroupForm({ code: "", name: "", parentId: 0, priceBookId: 0 });
		setEditingGroup(null);
		setGroupModalOpen("create");
	};

	const openEditGroup = (group: any) => {
		setEditingGroup(group);
		setGroupForm({
			code: group.code,
			name: group.name,
			parentId: group.parentId || 0,
			priceBookId: group.priceBookId || 0,
		});
		setGroupModalOpen("edit");
	};

	const handleDeleteGroup = async (id: number) => {
		if (!window.confirm("Bạn có chắc chắn muốn xóa nhóm khách hàng này?"))
			return;
		try {
			const res = await fetch(`/api/v1/customer-groups/${id}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
			});
			if (res.ok) {
				toast.success("Đã xóa nhóm khách hàng");
				fetchCustomerGroups();
			} else {
				toast.error("Lỗi khi xóa nhóm khách hàng");
			}
		} catch {
			toast.error("Lỗi kết nối");
		}
	};

	const getDescendants = (
		groups: typeof customerGroups,
		parentId: number,
	): number[] => {
		const children = groups.filter(g => g.parentId === parentId).map(g => g.id);
		let allDescendants = [...children];
		for (const childId of children) {
			allDescendants = allDescendants.concat(
				getDescendants(customerGroups, childId),
			);
		}
		return allDescendants;
	};

	const getParentOptions = (
		groups: typeof customerGroups,
		excludeId?: number,
	) => {
		const excludeIds = new Set([
			...(editingGroup?.id ? [editingGroup.id] : []),
			...getDescendants(customerGroups, editingGroup?.id || 0),
		]);
		return groups.filter(g => !excludeIds.has(g.id));
	};

	const getGroupIndent = (group: any, groups: typeof customerGroups) => {
		let indent = "";
		let current = group;
		while (current.parentId) {
			indent += "— ";
			const parent = groups.find(g => g.id === current.parentId);
			if (!parent) break;
			current = parent;
		}
		return indent;
	};

	const handleSaveGroup = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!groupForm.name.trim()) {
			toast.error("Tên nhóm là bắt buộc");
			return;
		}
		try {
			const isEdit = groupModalOpen === "edit";
			const url = isEdit
				? `/api/v1/customer-groups/${editingGroup!.id}`
				: "/api/v1/customer-groups";
			const method = isEdit ? "PUT" : "POST";
			const res = await fetch(url, {
				method,
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
				body: JSON.stringify({
					code: groupForm.code || undefined,
					name: groupForm.name,
					parentId: groupForm.parentId || null,
					priceBookId: groupForm.priceBookId || null,
				}),
			});
			const data = await res.json().catch(() => ({}));
			if (res.ok) {
				toast.success(
					isEdit ? "Cập nhật thành công" : "Đã thêm nhóm khách hàng",
				);
				setGroupModalOpen(null);
				await fetchCustomerGroups();
				// Auto-select the newly created group in customer form
				if (!isEdit && data?.data?.id) {
					setSelectedCustomer(prev => ({
						...prev,
						groupId: data.data.id,
						groupName: groupForm.name,
					}));
				}
			} else {
				toast.error(data.message || "Có lỗi xảy ra");
			}
		} catch {
			toast.error("Có lỗi hệ thống");
		}
	};

	useEffect(() => {
		fetchCustomers();
		fetchNextCode();
		fetchCustomerGroups();
		loadPriceBooks();
	}, []);

	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (!target.closest("[data-customer-toolbar-menu]")) {
				setFilterMenuOpen(false);
			}
		};
		if (filterMenuOpen) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [filterMenuOpen]);

	const fetchCustomers = async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/customers", {
				headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
			});
			if (res.ok) {
				const data = await res.json();
				setCustomers(Array.isArray(data) ? data : data?.data || []);
			} else if (res.status === 401) {
				toast.error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
			} else {
				toast.error("Lỗi khi tải danh sách khách hàng");
			}
		} catch (err) {
			toast.error("Lỗi kết nối máy chủ");
		} finally {
			setLoading(false);
		}
	};

	const [saving, setSaving] = useState(false);
	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (saving) return;
		if (!selectedCustomer) {
			toast.error("Chưa có dữ liệu khách hàng để lưu");
			return;
		}
		if (!String(selectedCustomer.name || "").trim()) {
			toast.error("Tên khách hàng là bắt buộc");
			return;
		}
		setSaving(true);

		try {
			const isEdit = !!selectedCustomer.id;
			const url = isEdit
				? `/api/customers/${selectedCustomer.id}`
				: "/api/customers";

			const method = isEdit ? "PUT" : "POST";
			const res = await fetch(url, {
				method,
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
				body: JSON.stringify({ ...selectedCustomer, isCustomer: true }),
			});

			const data = await res.json().catch(() => ({}));
			if (res.ok) {
				toast.success(
					isEdit
						? "Cập nhật thành công"
						: `Đã thêm khách hàng ${data.id ? `#${data.id}` : selectedCustomer.code || ""}`,
				);
				setIsModalOpen(false);
				setSelectedCustomer(null);
				await fetchCustomers();
				await fetchNextCode();
			} else if (res.status === 401) {
				toast.error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
			} else {
				toast.error(data.error || "Có lỗi xảy ra");
			}
		} catch (err) {
			toast.error("Có lỗi hệ thống");
		} finally {
			setSaving(false);
		}
	};

	const handleDelete = async (id: number) => {
		if (!window.confirm("Bạn có chắc chắn muốn xóa khách hàng này?")) return;

		try {
			const res = await fetch(`/api/customers/${id}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
			});
			if (res.ok) {
				toast.success("Đã xóa khách hàng");
				fetchCustomers();
			} else {
				toast.error("Lỗi khi xóa khách hàng");
			}
		} catch (err) {
			toast.error("Lỗi kết nối");
		}
	};

	const exportCustomers = async () => {
		try {
			const res = await fetch("/api/customers", {
				headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
			});
			if (!res.ok) throw new Error("Không tải được dữ liệu");
			const data = await res.json();
			const customers = Array.isArray(data) ? data : data?.data || [];

			// Apply filters
			let filtered = customers;
			if (searchTerm) {
				const keyword = searchTerm.trim().toLowerCase();
				filtered = filtered.filter(
					c =>
						c.code?.toLowerCase().includes(keyword) ||
						c.name?.toLowerCase().includes(keyword) ||
						c.phone?.toLowerCase().includes(keyword) ||
						c.taxCode?.toLowerCase().includes(keyword) ||
						c.groupName?.toLowerCase().includes(keyword),
				);
			}
			if (groupFilter) {
				filtered = filtered.filter(c => c.groupId === Number(groupFilter));
			}

			// Generate CSV
			const headers = [
				"Mã",
				"Tên",
				"SĐT",
				"Email",
				"Địa chỉ",
				"Mã số thuế",
				"Nhóm KH",
				"Đội xe",
				"Công nợ",
				"Nợ quá hạn",
			];
			const rows = filtered.map(c => {
				const group = customerGroups.find(g => g.id === c.groupId);
				const isTeam = customerGroups.find(g => g.id === c.groupId)?.isTeam;
				return [
					c.code || "",
					c.name || "",
					c.phone || "",
					c.email || "",
					c.address || "",
					c.taxCode || "",
					customerGroups.find(g => g.id === c.groupId)?.name || "",
					isTeam ? "👥 Đội xe" : "",
					c.debt || 0,
					c.overdueDebt || 0,
				];
			});
			const csv = [
				headers.join(","),
				...rows.map(r => r.map(v => `"${v}"`).join(",")),
			].join("\n");

			// Download
			const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
			const url = URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = `khach-hang-${new Date().toISOString().slice(0, 10)}.csv`;
			link.click();
			URL.revokeObjectURL(url);

			toast.success(`Đã xuất ${filtered.length} khách hàng`);
		} catch (err) {
			toast.error("Lỗi khi xuất danh sách");
		}
	};

	const priceGroupLabel = (group?: string) => {
		if (group === "Cao tốc") return "Giá bán cao tốc";
		if (group === "Bán lẻ" || group === "Lẻ") return "Giá bán lẻ";
		if (group === "Đại lý/NPP" || group === "NPP" || group === "Sỉ")
			return "Giá bán đại lý/NPP";
		return group || "Chưa phân nhóm giá";
	};

	const keyword = searchTerm.trim().toLowerCase();
	const filteredCustomers = customers.filter(c => {
		if (!keyword && !groupFilter) return true;
		const matchKeyword =
			!keyword ||
			c.code?.toLowerCase().includes(keyword) ||
			c.name?.toLowerCase().includes(keyword) ||
			c.phone?.toLowerCase().includes(keyword) ||
			c.taxCode?.toLowerCase().includes(keyword) ||
			c.groupName?.toLowerCase().includes(keyword);
		const matchGroup = !groupFilter || c.groupId === Number(groupFilter);
		return matchKeyword && matchGroup;
	});
	const totalDebt = customers.reduce(
		(sum, customer) => sum + Number(customer.debt || 0),
		0,
	);
	const overdueDebt = customers.reduce(
		(sum, customer) => sum + Number(customer.overdueDebt || 0),
		0,
	);
	const paidLast30Days = customers.reduce(
		(sum, customer) => sum + Number(customer.paidLast30Days || 0),
		0,
	);

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Quản lý khách hàng</h1>
					<p>Danh mục khách hàng, đối tác và nhóm giá bán áp dụng</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						onClick={() => {
							setSelectedCustomer({
								code: nextCustomerCode,
								name: "",
								phone: "",
								address: "",
								email: "",
								taxCode: "",
								groupName: "Đại lý/NPP",
							});
							setIsModalOpen(true);
						}}
						className="erp-btn erp-btn-primary"
					>
						<UserPlus size={16} /> Thêm khách hàng
					</button>
					<button
						onClick={() => {
							setGroupForm({ code: "", name: "", parentId: 0, priceBookId: 0 });
							setEditingGroup(null);
							setGroupModalOpen("create");
						}}
						className="erp-btn"
					>
						<Tag size={16} /> Thêm nhóm khách hàng
					</button>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				<div className="erp-stat">
					<Clock3 />
					<div>
						<span>Nợ quá hạn</span>
						<strong className="text-red-600">
							{new Intl.NumberFormat("vi-VN").format(overdueDebt)} ₫
						</strong>
					</div>
				</div>
				<div className="erp-stat">
					<WalletCards />
					<div>
						<span>Tổng nợ phải thu</span>
						<strong>
							{new Intl.NumberFormat("vi-VN").format(totalDebt)} ₫
						</strong>
					</div>
				</div>
				<div className="erp-stat">
					<CircleDollarSign />
					<div>
						<span>Đã thanh toán (30 ngày)</span>
						<strong>
							{new Intl.NumberFormat("vi-VN").format(paidLast30Days)} ₫
						</strong>
					</div>
				</div>
			</div>

			<div className="erp-card overflow-hidden">
				<div className="erp-toolbar">
					<div className="erp-search">
						<Search size={16} />
						<input
							type="text"
							placeholder="Tìm kiếm theo tên, SĐT, mã số thuế..."
							value={searchTerm}
							onChange={e => setSearchTerm(e.target.value)}
						/>
					</div>
					<div className="flex items-center gap-2">
						<button
							className="erp-btn"
							onClick={() => setFilterMenuOpen(!filterMenuOpen)}
						>
							<Filter size={16} />
						</button>
						<button
							className="erp-btn erp-btn-primary"
							onClick={exportCustomers}
						>
							<Download size={16} /> Xuất
						</button>
						{filterMenuOpen ? (
							<div
								data-customer-toolbar-menu
								className="absolute right-0 z-50 mt-1.5 w-64 overflow-hidden rounded-xl border border-[#eaecf0] bg-white shadow-[0_12px_32px_-8px_rgba(16,24,40,0.18)]"
							>
								<div className="px-4 py-3 border-b border-slate-200">
									<label className="block text-sm font-medium text-slate-700 mb-1">
										Lọc theo nhóm
									</label>
									<div className="flex items-center gap-2">
										<select
											value={groupFilter}
											onChange={e => setGroupFilter(e.target.value)}
											className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
										>
											<option value="">Tất cả nhóm</option>
											{customerGroups.map(g => (
												<option key={g.id} value={g.id}>
													{g.name} {g.isTeam && "👥"}
												</option>
											))}
										</select>
										<button
											onClick={e => {
												e.stopPropagation();
												const group = customerGroups.find(
													g => g.id === Number(groupFilter),
												);
												if (group) {
													setEditingGroup(group);
													setGroupForm({
														code: group.code,
														name: group.name,
														parentId: group.parentId || 0,
														priceBookId: group.priceBookId || 0,
													});
													setGroupModalOpen("edit");
												}
											}}
											className="erp-icon-btn text-blue-600"
											title="Sửa nhóm"
										>
											<Edit size={14} />
										</button>
									</div>
								</div>
								<div className="px-4 py-3 border-b border-slate-200">
									<label className="block text-sm font-medium text-slate-700 mb-1">
										Tìm kiếm
									</label>
									<div className="relative">
										<Search
											size={15}
											className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
										/>
										<input
											type="text"
											placeholder="Tìm tên, SĐT, mã số thuế..."
											value={searchTerm}
											onChange={e => setSearchTerm(e.target.value)}
											className="w-full pl-10 pr-3 py-2 rounded border border-slate-300 text-sm outline-none focus:border-emerald-500"
										/>
									</div>
								</div>
							</div>
						) : null}
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Mã / Khách hàng</th>
								<th>Liên hệ</th>
								<th>Địa chỉ</th>
								<th>Mã số thuế</th>
								<th>Nhóm KH</th>
								<th className="text-right">Công nợ</th>
								<th className="text-right">Thao tác</th>
							</tr>
						</thead>
						<tbody>
							{filteredCustomers.map(customer => (
								<tr key={customer.id}>
									<td>
										<div className="flex items-center gap-3">
											<div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 font-black uppercase text-indigo-600 shadow-sm">
												{customer.name.charAt(0)}
											</div>
											<div>
												<b>{customer.name}</b>
												<small>
													{customer.code} ·{" "}
													{priceGroupLabel(customer.groupName)}
												</small>
											</div>
										</div>
									</td>
									<td>
										<div className="space-y-1">
											{customer.phone && (
												<div className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
													<Phone size={12} className="text-gray-300" />
													{customer.phone}
												</div>
											)}
											{customer.email && (
												<div className="flex items-center gap-1.5 text-xs text-gray-400">
													<Mail size={12} className="text-gray-300" />
													{customer.email}
												</div>
											)}
										</div>
									</td>
									<td>
										<p className="max-w-xs truncate text-xs font-bold text-gray-500">
											{customer.address || "-"}
										</p>
									</td>
									<td>
										<span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-bold text-gray-400">
											{customer.taxCode || "N/A"}
										</span>
									</td>
									<td>
										{(() => {
											const group = customerGroups.find(
												g => g.id === customer.groupId,
											);
											if (!group)
												return <span className="text-slate-400">—</span>;
											return (
												<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-medium">
													{group.isTeam && (
														<span className="text-orange-600">👥</span>
													)}
													{group.name}
												</span>
											);
										})()}
									</td>
									<td className="text-right">
										<div className="text-right">
											<b
												className={
													Number(customer.overdueDebt) > 0
														? "text-red-600"
														: "text-gray-700"
												}
											>
												{new Intl.NumberFormat("vi-VN").format(
													Number(customer.debt || 0),
												)}{" "}
												₫
											</b>
											{Number(customer.overdueDebt) > 0 && (
												<small className="block text-red-500">
													Quá hạn:{" "}
													{new Intl.NumberFormat("vi-VN").format(
														Number(customer.overdueDebt),
													)}{" "}
													₫
												</small>
											)}
										</div>
									</td>
									<td className="text-right">
										<div className="flex items-center justify-end gap-1">
											<button
												onClick={() => {
													setSelectedCustomer(customer);
													setIsModalOpen(true);
												}}
												className="erp-icon-btn"
												title="Chỉnh sửa"
											>
												<Edit size={16} />
											</button>
											<button
												onClick={() => handleDelete(customer.id)}
												className="erp-icon-btn text-red-500"
												title="Xóa"
											>
												<Trash2 size={16} />
											</button>
										</div>
									</td>
								</tr>
							))}
							{filteredCustomers.length === 0 && !loading && (
								<tr>
									<td colSpan={6} className="py-20 text-center">
										<div className="flex flex-col items-center justify-center opacity-20">
											<UserPlus size={64} />
											<p className="mt-4 font-black uppercase text-sm tracking-widest">
												Không tìm thấy khách hàng nào
											</p>
										</div>
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			<RightDrawer
				open={isModalOpen}
				title={
					selectedCustomer?.id ? "Chỉnh sửa khách hàng" : "Thêm khách hàng mới"
				}
				subtitle="Thông tin chi tiết đối tác và nhóm giá bán áp dụng"
				badge={
					<span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
						<span className="h-2 w-2 rounded-full bg-emerald-500" />
						{priceGroupLabel(selectedCustomer?.groupName)}
					</span>
				}
				onClose={() => setIsModalOpen(false)}
				widthClass="max-w-2xl"
				footer={
					<>
						<button
							type="button"
							onClick={() => setIsModalOpen(false)}
							className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
						>
							Hủy
						</button>
						<button
							type="button"
							disabled={saving}
							onClick={() =>
								(
									document.getElementById(
										"customer-drawer-form",
									) as HTMLFormElement | null
								)?.requestSubmit()
							}
							className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
						>
							{saving ? "Đang lưu..." : "Cất"}
						</button>
						<button
							type="button"
							disabled={saving}
							onClick={() =>
								(
									document.getElementById(
										"customer-drawer-form",
									) as HTMLFormElement | null
								)?.requestSubmit()
							}
							className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
						>
							{saving ? "Đang lưu..." : "Cất và Thêm"}
						</button>
					</>
				}
			>
				<form
					id="customer-drawer-form"
					onSubmit={handleSave}
					className="space-y-5"
				>
					<div className="grid grid-cols-2 gap-4">
						<label className="text-[13px] font-medium text-slate-700">
							<span className="mb-1 block">
								Mã khách hàng (KH00001, nhập tay khi cần)
							</span>
							<input
								type="text"
								placeholder={nextCustomerCode}
								value={selectedCustomer?.code || ""}
								onChange={e =>
									setSelectedCustomer({
										...selectedCustomer!,
										code: e.target.value.toUpperCase(),
									})
								}
							/>
						</label>
						<label className="text-[13px] font-medium text-slate-700">
							<span className="mb-1 block">Số điện thoại</span>
							<div className="relative">
								<Phone
									className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-300"
									size={16}
								/>
								<input
									type="text"
									placeholder="09xxx..."
									value={selectedCustomer?.phone || ""}
									onChange={e =>
										setSelectedCustomer({
											...selectedCustomer!,
											phone: e.target.value,
										})
									}
									style={{ paddingLeft: "2.5rem" }}
								/>
							</div>
						</label>
						<label className="col-span-2 text-[13px] font-medium text-slate-700">
							<span className="mb-1 block">
								Họ và tên / Tên công ty <span className="text-red-500">*</span>
							</span>
							<input
								type="text"
								required
								placeholder="Nguyễn Văn A / Công ty TNHH..."
								value={selectedCustomer?.name || ""}
								onChange={e =>
									setSelectedCustomer({
										...selectedCustomer!,
										name: e.target.value,
									})
								}
							/>
						</label>
						<label className="col-span-2 text-[13px] font-medium text-slate-700">
							<span className="mb-1 block">Nhóm khách hàng chuẩn</span>
							<select
								value={(selectedCustomer as any)?.groupId || ""}
								onChange={e => {
									const group = customerGroups.find(
										item => item.id === Number(e.target.value),
									);
									setSelectedCustomer({
										...selectedCustomer!,
										groupId: group?.id,
										groupName: group?.name || "",
										priceBookId: group?.priceBookId,
									} as any);
								}}
							>
								<option value="">Chưa phân nhóm chuẩn</option>
								{customerGroups.map(group => (
									<option key={group.id} value={group.id}>
										{group.name} ({group.code}){" "}
										{group.priceBookId ? `(có bảng giá)` : ""}
									</option>
								))}
							</select>
							<small>
								Nhóm chuẩn dùng để áp giá bán và lọc khuyến mãi theo nhóm. Chọn
								nhóm sẽ tự động áp dụng bảng giá liên kết.
							</small>
						</label>

						<div className="col-span-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3">
							<p className="text-[13px] font-medium text-slate-700">
								Tạo nhanh nhóm chuẩn
							</p>
							<div className="mt-2 flex gap-2">
								<input
									type="text"
									placeholder="Nhập tên nhóm mới, ví dụ Đại lý Miền Tây"
									value={newGroupName}
									onChange={e => setNewGroupName(e.target.value)}
								/>
								<button
									type="button"
									disabled={creatingGroup}
									onClick={handleCreateGroup}
									className="shrink-0 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
								>
									{creatingGroup ? "Đang tạo..." : "Tạo nhóm"}
								</button>
							</div>
						</div>
					</div>

					<label className="block text-[13px] font-medium text-slate-700">
						<span className="mb-1 block">Mã số thuế</span>
						<input
							type="text"
							placeholder="370xxxxx..."
							value={selectedCustomer?.taxCode || ""}
							onChange={e =>
								setSelectedCustomer({
									...selectedCustomer!,
									taxCode: e.target.value,
								})
							}
						/>
					</label>

					<label className="block text-[13px] font-medium text-slate-700">
						<span className="mb-1 block">Địa chỉ giao hàng / Trụ sở</span>
						<div className="relative">
							<MapPin
								className="pointer-events-none absolute left-3 top-3 text-gray-300"
								size={16}
							/>
							<textarea
								rows={3}
								placeholder="Số nhà, đường, phường/xã..."
								value={selectedCustomer?.address || ""}
								onChange={e =>
									setSelectedCustomer({
										...selectedCustomer!,
										address: e.target.value,
									})
								}
								style={{ paddingLeft: "2.5rem" }}
							/>
						</div>
					</label>
					<label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-slate-700">
						<input
							type="checkbox"
							checked={Boolean((selectedCustomer as any)?.isSupplier)}
							onChange={e =>
								setSelectedCustomer({
									...selectedCustomer!,
									isSupplier: e.target.checked,
								} as any)
							}
							className="h-4 w-4 accent-emerald-600"
						/>
						Đối tác này vừa là khách hàng, vừa là nhà cung cấp
					</label>
				</form>
			</RightDrawer>

			{/* ── Drawer: Quản lý nhóm khách hàng ── */}
			{groupModalOpen && (
				<RightDrawer
					open={true}
					title={
						groupModalOpen === "create"
							? "Thêm nhóm khách hàng"
							: `Sửa nhóm: ${editingGroup?.name}`
					}
					subtitle="Thông tin nhóm khách hàng và bảng giá áp dụng"
					onClose={() => {
						setGroupModalOpen(null);
						setEditingGroup(null);
						setGroupForm({ code: "", name: "", parentId: 0, priceBookId: 0 });
					}}
					widthClass="max-w-xl"
				>
					<form onSubmit={handleSaveGroup} className="space-y-5">
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								<label className="text-[13px] font-medium text-slate-700 mb-1">
									Mã nhóm <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									required
									value={groupForm.code}
									onChange={e =>
										setGroupForm({
											...groupForm,
											code: e.target.value.toUpperCase(),
										})
									}
									placeholder="VD: AGENT_MT"
									className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
								/>
							</div>
							<div>
								<label className="text-[13px] font-medium text-slate-700 mb-1">
									Tên nhóm <span className="text-red-500">*</span>
								</label>
								<input
									type="text"
									required
									value={groupForm.name}
									onChange={e =>
										setGroupForm({ ...groupForm, name: e.target.value })
									}
									placeholder="Ví dụ: Đại lý Miền Tây"
									className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
								/>
							</div>
							<div>
								<label className="text-[13px] font-medium text-slate-700 mb-1">
									Nhóm cha
								</label>
								<select
									value={groupForm.parentId}
									onChange={e =>
										setGroupForm({
											...groupForm,
											parentId: Number(e.target.value) || 0,
										})
									}
									className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
								>
									<option value="0">
										-- Không có nhóm cha (Nhóm cấp cao nhất) --
									</option>
									{getParentOptions(customerGroups, editingGroup?.id).map(g => (
										<option key={g.id} value={g.id}>
											{getGroupIndent(g, customerGroups)} {g.name} ({g.code})
										</option>
									))}
								</select>
							</div>
							<div>
								<label className="text-[13px] font-medium text-slate-700 mb-1">
									Bảng giá áp dụng
								</label>
								<select
									value={groupForm.priceBookId}
									onChange={e =>
										setGroupForm({
											...groupForm,
											priceBookId: Number(e.target.value) || 0,
										})
									}
									className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
								>
									<option value="0">
										-- Chọn bảng giá (mặc định theo nhóm giá khách hàng) --
									</option>
									{priceBooks.map(pb => (
										<option key={pb.id} value={pb.id}>
											{pb.name} ({pb.code})
										</option>
									))}
								</select>
							</div>
						</div>
						<div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
							<button
								type="button"
								onClick={() => {
									setGroupModalOpen(null);
									setEditingGroup(null);
									setGroupForm({
										code: "",
										name: "",
										parentId: 0,
										priceBookId: 0,
									});
								}}
								className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
							>
								Hủy
							</button>
							<button
								type="submit"
								disabled={groupForm.name.trim() === ""}
								className="inline-flex items-center gap-2 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
							>
								<Save size={14} />{" "}
								{groupModalOpen === "create" ? "Thêm nhóm" : "Cập nhật"}
							</button>
						</div>
					</form>
				</RightDrawer>
			)}
		</div>
	);
};
export default Customers;
