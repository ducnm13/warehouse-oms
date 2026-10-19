import React, { useState, useEffect } from "react";
import {
	UserPlus,
	Edit,
	Trash2,
	Search,
	Phone,
	MapPin,
	RefreshCw,
} from "lucide-react";
import toast from "../components/ui/toast";
import { confirm } from "../components/ui/confirm";
import { Customer } from "../types";
import RightDrawer from "../components/RightDrawer";
import CustomerGroups from "./CustomerGroups";

interface CustomerGroupOption {
	id: number;
	code: string;
	name: string;
}

const emptyCustomerForm = (code = "") => ({
	code,
	name: "",
	phone: "",
	taxCode: "",
	address: "",
	groupId: 0,
	isSupplier: false,
});

const Customers = ({
	initialTab = "customers",
}: {
	initialTab?: "customers" | "groups";
}) => {
	const [activeTab, setActiveTab] = useState<"customers" | "groups">(initialTab);
	const [customers, setCustomers] = useState<Customer[]>([]);
	const [customerGroups, setCustomerGroups] = useState<CustomerGroupOption[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
	const [searchTerm, setSearchTerm] = useState("");
	const [groupFilter, setGroupFilter] = useState("");
	const [nextCustomerCode, setNextCustomerCode] = useState("KH00001");
	const [form, setForm] = useState(emptyCustomerForm());

	useEffect(() => {
		setActiveTab(initialTab);
	}, [initialTab]);

	const fetchCustomers = async () => {
		setLoading(true);
		try {
			const res = await fetch("/api/customers", {
				headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
			});
			if (!res.ok) throw new Error("Không tải được danh sách khách hàng");
			const data = await res.json();
			setCustomers(Array.isArray(data) ? data : data?.data || []);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lỗi kết nối máy chủ");
			setCustomers([]);
		} finally {
			setLoading(false);
		}
	};

	const fetchCustomerGroups = async () => {
		try {
			const res = await fetch("/api/v1/customer-groups", {
				headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
			});
			if (!res.ok) return;
			const data = await res.json();
			const rows = Array.isArray(data?.data)
				? data.data
				: Array.isArray(data)
					? data
					: [];
			const flattened: CustomerGroupOption[] = rows.flatMap((g: any) => [
				{ id: g.id, code: g.code, name: g.name },
				...(g.children || []).map((c: any) => ({
					id: c.id,
					code: c.code,
					name: c.name,
				})),
			]);
			setCustomerGroups(
				Array.from(new Map(flattened.map(g => [g.id, g])).values()),
			);
		} catch {
			setCustomerGroups([]);
		}
	};

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
			// Giữ mã mặc định khi không lấy được sequence
		}
	};

	useEffect(() => {
		fetchCustomers();
		fetchCustomerGroups();
		fetchNextCode();
	}, []);

	const groupNameOf = (customer: Customer) => {
		const g = customerGroups.find(x => x.id === customer.groupId);
		return g?.name || customer.groupName || "—";
	};

	const isSupplierOf = (customer: Customer) =>
		Number((customer as any).isSupplier) === 1 ||
		(customer as any).isSupplier === true;

	const handleCreate = async () => {
		await fetchNextCode();
		setEditingCustomer(null);
		setForm(emptyCustomerForm(nextCustomerCode));
		setIsModalOpen(true);
	};

	const handleEdit = (customer: Customer) => {
		setEditingCustomer(customer);
		setForm({
			code: customer.code || "",
			name: customer.name || "",
			phone: customer.phone || "",
			taxCode: customer.taxCode || "",
			address: customer.address || "",
			groupId: customer.groupId || 0,
			isSupplier: isSupplierOf(customer),
		});
		setIsModalOpen(true);
	};

	const handleDelete = async (customer: Customer) => {
    if (!(await confirm(`Xóa khách hàng "${customer.name}"?`))) return;
		try {
			const res = await fetch(`/api/customers/${customer.id}`, {
				method: "DELETE",
				headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
			});
			if (!res.ok) throw new Error("Lỗi khi xóa khách hàng");
			toast.success("Đã xóa khách hàng");
			fetchCustomers();
			fetchNextCode();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Lỗi kết nối máy chủ");
		}
	};

	const handleSave = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!form.name.trim()) {
			toast.error("Tên khách hàng là bắt buộc");
			return;
		}
		setSaving(true);
		try {
			const isEdit = !!editingCustomer;
			const group = customerGroups.find(g => g.id === form.groupId);
			const payload = {
				code: form.code.trim().toUpperCase(),
				name: form.name.trim(),
				phone: form.phone.trim(),
				taxCode: form.taxCode.trim(),
				address: form.address.trim(),
				email: editingCustomer?.email || "",
				groupId: form.groupId || null,
				groupName: group?.name || "",
				isSupplier: form.isSupplier,
			};
			const res = await fetch(
				isEdit ? `/api/customers/${editingCustomer!.id}` : "/api/customers",
				{
					method: isEdit ? "PUT" : "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${localStorage.getItem("token")}`,
					},
					body: JSON.stringify(payload),
				},
			);
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || data.message || "Có lỗi xảy ra");
			toast.success(isEdit ? "Cập nhật thành công" : "Đã thêm khách hàng");
			setIsModalOpen(false);
			setEditingCustomer(null);
			await fetchCustomers();
			await fetchNextCode();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Có lỗi hệ thống");
		} finally {
			setSaving(false);
		}
	};

	const keyword = searchTerm.trim().toLowerCase();
	const filteredCustomers = customers.filter(c => {
		const matchKeyword =
			!keyword ||
			c.code?.toLowerCase().includes(keyword) ||
			c.name?.toLowerCase().includes(keyword) ||
			c.phone?.toLowerCase().includes(keyword) ||
			c.taxCode?.toLowerCase().includes(keyword);
		const matchGroup = !groupFilter || c.groupId === Number(groupFilter);
		return matchKeyword && matchGroup;
	});

	return (
		<div className="erp-page">
			{/* ── Tabs: Khách hàng / Nhóm khách hàng ── */}
			<div className="mb-4 flex items-center gap-1 border-b border-slate-200">
				<button
					type="button"
					onClick={() => setActiveTab("customers")}
					className={`relative px-4 py-2.5 text-sm font-semibold transition-colors ${
						activeTab === "customers"
							? "text-emerald-700"
							: "text-slate-500 hover:text-slate-800"
					}`}
				>
					Quản lý khách hàng
					{activeTab === "customers" && (
						<span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-600" />
					)}
				</button>
				<button
					type="button"
					onClick={() => setActiveTab("groups")}
					className={`relative px-4 py-2.5 text-sm font-semibold transition-colors ${
						activeTab === "groups"
							? "text-emerald-700"
							: "text-slate-500 hover:text-slate-800"
					}`}
				>
					Quản lý nhóm khách hàng
					{activeTab === "groups" && (
						<span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-600" />
					)}
				</button>
			</div>

			{activeTab === "groups" ? (
				<CustomerGroups />
			) : (
				<>
					<div className="erp-page-header">
						<div>
							<h1>Quản lý khách hàng</h1>
							<p>Danh mục khách hàng và nhà cung cấp</p>
						</div>
						<div className="flex items-center gap-2">
							<button onClick={handleCreate} className="erp-btn erp-btn-primary">
								<UserPlus size={16} /> Thêm khách hàng
							</button>
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
							<select
								value={groupFilter}
								onChange={e => setGroupFilter(e.target.value)}
								className="w-52 rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
							>
								<option value="">Tất cả nhóm</option>
								{customerGroups.map(g => (
									<option key={g.id} value={g.id}>
										{g.name} ({g.code})
									</option>
								))}
							</select>
						</div>

						<div className="overflow-x-auto">
							<table className="erp-table">
								<thead>
									<tr>
										<th>Mã / Khách hàng</th>
										<th>Liên hệ</th>
										<th>Mã số thuế</th>
										<th>Địa chỉ</th>
										<th>Nhóm KH</th>
										<th>Vai trò</th>
										<th className="text-right">Thao tác</th>
									</tr>
								</thead>
								<tbody>
									{loading ? (
										<tr>
											<td colSpan={7} className="py-12 text-center text-slate-400">
												Đang tải...
											</td>
										</tr>
									) : filteredCustomers.length === 0 ? (
										<tr>
											<td colSpan={7} className="py-20 text-center">
												<div className="flex flex-col items-center justify-center opacity-20">
													<UserPlus size={64} />
													<p className="mt-4 font-black uppercase text-sm tracking-widest">
														Không tìm thấy khách hàng nào
													</p>
												</div>
											</td>
										</tr>
									) : (
										filteredCustomers.map(customer => (
											<tr key={customer.id}>
												<td>
													<div className="flex items-center gap-3">
														<div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 font-black uppercase text-indigo-600 shadow-sm">
															{customer.name.charAt(0)}
														</div>
														<div>
															<b>{customer.name}</b>
															<small>{customer.code}</small>
														</div>
													</div>
												</td>
												<td>
													{customer.phone ? (
														<div className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
															<Phone size={12} className="text-gray-300" />
															{customer.phone}
														</div>
													) : (
														<span className="text-slate-400">—</span>
													)}
												</td>
												<td>
													<span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-bold text-gray-400">
														{customer.taxCode || "N/A"}
													</span>
												</td>
												<td>
													<p className="max-w-xs truncate text-xs font-bold text-gray-500">
														{customer.address || "-"}
													</p>
												</td>
												<td>{groupNameOf(customer)}</td>
												<td>
													<div className="flex flex-col gap-1">
														<span className="inline-flex w-fit items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-medium">
															Khách hàng
														</span>
														{isSupplierOf(customer) && (
															<span className="inline-flex w-fit items-center px-2 py-0.5 rounded bg-orange-50 text-orange-700 text-xs font-medium">
																Nhà cung cấp
															</span>
														)}
													</div>
												</td>
												<td className="text-right">
													<div className="flex items-center justify-end gap-1">
														<button
															onClick={() => handleEdit(customer)}
															className="erp-icon-btn"
															title="Chỉnh sửa"
														>
															<Edit size={16} />
														</button>
														<button
															onClick={() => handleDelete(customer)}
															className="erp-icon-btn text-red-500"
															title="Xóa"
														>
															<Trash2 size={16} />
														</button>
													</div>
												</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>

					<RightDrawer
						open={isModalOpen}
						title={editingCustomer ? "Chỉnh sửa khách hàng" : "Thêm khách hàng mới"}
						subtitle="Thông tin khách hàng và nhóm áp dụng"
						onClose={() => {
							setIsModalOpen(false);
							setEditingCustomer(null);
						}}
						widthClass="max-w-2xl"
						footer={
							<>
								<button
									type="button"
									onClick={() => {
										setIsModalOpen(false);
										setEditingCustomer(null);
									}}
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
									className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
								>
									{saving ? "Đang lưu..." : editingCustomer ? "Cập nhật" : "Thêm khách hàng"}
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
									<span className="mb-1 block">Mã khách hàng (tự sinh)</span>
									<div className="flex gap-2">
										<input
											type="text"
											readOnly
											value={editingCustomer ? (form.code || editingCustomer.code || "") : nextCustomerCode}
											className="flex-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-600 outline-none"
										/>
										{!editingCustomer && (
											<button
												type="button"
												title="Lấy mã mới"
												onClick={fetchNextCode}
												className="shrink-0 rounded border border-slate-300 bg-white px-3 py-2 text-slate-600 hover:bg-slate-50"
											>
												<RefreshCw size={15} />
											</button>
										)}
									</div>
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
											value={form.phone}
											onChange={e => setForm({ ...form, phone: e.target.value })}
											style={{ paddingLeft: "2.5rem" }}
											className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
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
										value={form.name}
										onChange={e => setForm({ ...form, name: e.target.value })}
										className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
									/>
								</label>
								<label className="text-[13px] font-medium text-slate-700">
									<span className="mb-1 block">Mã số thuế</span>
									<input
										type="text"
										placeholder="370xxxxx..."
										value={form.taxCode}
										onChange={e => setForm({ ...form, taxCode: e.target.value })}
										className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
									/>
								</label>
								<label className="text-[13px] font-medium text-slate-700">
									<span className="mb-1 block">Nhóm khách hàng</span>
									<select
										value={form.groupId}
										onChange={e => setForm({ ...form, groupId: Number(e.target.value) || 0 })}
										className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
									>
										<option value={0}>-- Chưa phân nhóm --</option>
										{customerGroups.map(g => (
											<option key={g.id} value={g.id}>
												{g.name} ({g.code})
											</option>
										))}
									</select>
								</label>
							</div>

							<label className="block text-[13px] font-medium text-slate-700">
								<span className="mb-1 block">Địa chỉ</span>
								<div className="relative">
									<MapPin
										className="pointer-events-none absolute left-3 top-3 text-gray-300"
										size={16}
									/>
									<textarea
										rows={3}
										placeholder="Số nhà, đường, phường/xã..."
										value={form.address}
										onChange={e => setForm({ ...form, address: e.target.value })}
										style={{ paddingLeft: "2.5rem" }}
										className="w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
									/>
								</div>
							</label>
							<label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-slate-700">
								<input
									type="checkbox"
									checked={form.isSupplier}
									onChange={e => setForm({ ...form, isSupplier: e.target.checked })}
									className="h-4 w-4 accent-emerald-600"
								/>
								Đối tác này vừa là khách hàng, vừa là nhà cung cấp
							</label>
						</form>
					</RightDrawer>
				</>
			)}
		</div>
	);
};
export default Customers;
