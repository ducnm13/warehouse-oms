import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Lock, Plus, Search, ShieldCheck, Trash2, Users as UsersIcon, X } from "lucide-react";
import toast from "../components/ui/toast";
import { confirm } from "../components/ui/confirm";
import { apiV1 } from "../lib/apiV1";
import ListToolbar from "../components/ListToolbar";
import type { FilterField, FilterValues } from "../components/FilterDrawer";
import { exportExcelFile } from "../lib/excelExport";

interface Permission {
	id: number;
	code: string;
	name: string;
	resource: string;
	action: string;
}

interface Role {
	id: number;
	code: string;
	name: string;
	description?: string | null;
	isSystem: boolean;
	permissionCodes: string[];
	userCount: number;
}

const RESOURCE_META: Record<string, string> = {
	dashboard: "Tổng quan",
	sales: "Bán hàng",
	"sales.return": "Trả hàng bán",
	purchase: "Mua hàng",
	inventory: "Kho",
	transfer: "Chuyển kho",
	production: "Sản xuất",
	assembly: "Lắp ráp & Tháo dỡ",
	debt: "Công nợ",
	report: "Báo cáo",
	promotion: "Khuyến mãi",
	customer: "Khách hàng",
	catalog: "Danh mục & Giá",
	online: "Bán hàng online",
	company: "Doanh nghiệp",
	employee: "Nhân viên",
	iam: "Người dùng & Phân quyền",
	system: "Hệ thống",
};

const resourceLabel = (resource: string) => RESOURCE_META[resource] || resource;

export default function Roles() {
	const queryClient = useQueryClient();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editing, setEditing] = useState<Role | null>(null);
	const [code, setCode] = useState("");
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [selected, setSelected] = useState<string[]>([]);
	const [permSearch, setPermSearch] = useState("");
	const [search, setSearch] = useState("");
	const [filters, setFilters] = useState<FilterValues>({});

	const permissionsQuery = useQuery({
		queryKey: ["iam-permissions"],
		queryFn: () => apiV1<Permission[]>("/api/v1/iam/permissions"),
	});
	const rolesQuery = useQuery({
		queryKey: ["iam-roles"],
		queryFn: () => apiV1<Role[]>("/api/v1/iam/roles"),
	});

	const permissions = useMemo(() => permissionsQuery.data?.data || [], [permissionsQuery.data]);
	const roles = useMemo(() => rolesQuery.data?.data || [], [rolesQuery.data]);

	const groups = useMemo(() => {
		const keyword = permSearch.trim().toLowerCase();
		const map = new Map<string, Permission[]>();
		for (const perm of permissions) {
			if (keyword && !`${perm.code} ${perm.name}`.toLowerCase().includes(keyword)) continue;
			const list = map.get(perm.resource) || [];
			list.push(perm);
			map.set(perm.resource, list);
		}
		return [...map.entries()].sort((a, b) => resourceLabel(a[0]).localeCompare(resourceLabel(b[0]), "vi"));
	}, [permissions, permSearch]);

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: ["iam-roles"] });
	};

	const saveMutation = useMutation({
		mutationFn: () => {
			if (!name.trim()) throw new Error("Nhập tên vai trò");
			if (!editing && !code.trim()) throw new Error("Nhập mã vai trò (VD: KE_TOAN)");
			const body = { name: name.trim(), description: description.trim(), permissionCodes: selected };
			return editing
				? apiV1(`/api/v1/iam/roles/${editing.id}`, { method: "PUT", body: JSON.stringify(body) })
				: apiV1("/api/v1/iam/roles", { method: "POST", body: JSON.stringify({ ...body, code: code.trim().toUpperCase() }) });
		},
		onSuccess: () => {
			toast.success(editing ? "Đã cập nhật vai trò" : "Đã tạo vai trò");
			setIsModalOpen(false);
			invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const deleteMutation = useMutation({
		mutationFn: (role: Role) => apiV1(`/api/v1/iam/roles/${role.id}`, { method: "DELETE" }),
		onSuccess: () => {
			toast.success("Đã xóa vai trò");
			invalidate();
		},
		onError: (e: Error) => toast.error(e.message),
	});

	const openCreate = () => {
		setEditing(null);
		setCode("");
		setName("");
		setDescription("");
		setSelected([]);
		setPermSearch("");
		setIsModalOpen(true);
	};

	const openEdit = (role: Role) => {
		setEditing(role);
		setCode(role.code);
		setName(role.name);
		setDescription(role.description || "");
		setSelected(role.permissionCodes);
		setPermSearch("");
		setIsModalOpen(true);
	};

	const togglePerm = (permCode: string) =>
		setSelected(prev => (prev.includes(permCode) ? prev.filter(c => c !== permCode) : [...prev, permCode]));

	const toggleGroup = (perms: Permission[]) => {
		const codes = perms.map(p => p.code);
		const all = codes.every(c => selected.includes(c));
		setSelected(prev => (all ? prev.filter(c => !codes.includes(c)) : [...new Set([...prev, ...codes])]));
	};

	const handleDelete = async (role: Role) => {
		if (role.isSystem) {
			toast.error("Không thể xóa vai trò hệ thống");
			return;
		}
		if (role.userCount > 0) {
			toast.error(`Vai trò đang gán cho ${role.userCount} tài khoản, gỡ gán trước khi xóa`);
			return;
		}
		if (!(await confirm(`Xóa vai trò ${role.name} (${role.code})?`))) return;
		deleteMutation.mutate(role);
	};

	const loading = permissionsQuery.isLoading || rolesQuery.isLoading;
	const forbidden = (permissionsQuery.error as any)?.status === 403 || (rolesQuery.error as any)?.status === 403;
	const filteredRoles = useMemo(() => {
		const keyword = search.trim().toLowerCase();
		return roles.filter(role => {
			const matchSearch =
				!keyword ||
				role.name.toLowerCase().includes(keyword) ||
				role.code.toLowerCase().includes(keyword);
			const matchType =
				!filters.type ||
				(filters.type === "SYSTEM" ? role.isSystem : !role.isSystem);
			return matchSearch && matchType;
		});
	}, [roles, search, filters.type]);
	const filterFields: FilterField[] = [
		{
			type: "select",
			key: "type",
			label: "Loại vai trò",
			options: [
				{ value: "SYSTEM", label: "Hệ thống" },
				{ value: "CUSTOM", label: "Tùy chỉnh" },
			],
		},
	];
	const exportRoles = () =>
		exportExcelFile(
			"vai-tro.xlsx",
			"Vai tro",
			[
				{ header: "Mã", value: (role: Role) => role.code },
				{ header: "Tên vai trò", value: (role: Role) => role.name, width: 28 },
				{
					header: "Loại",
					value: (role: Role) => (role.isSystem ? "Hệ thống" : "Tùy chỉnh"),
				},
				{
					header: "Số quyền",
					value: (role: Role) => role.permissionCodes.length,
				},
				{ header: "Tài khoản", value: (role: Role) => role.userCount },
				{
					header: "Mô tả",
					value: (role: Role) => role.description || "",
					width: 36,
				},
			],
			filteredRoles,
		);

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Vai trò</h1>
					<p>Tạo vai trò, chọn quyền từ bảng phân quyền và gán cho tài khoản</p>
				</div>
				<button onClick={openCreate} className="erp-btn erp-btn-primary">
					<Plus size={16} /> Thêm vai trò
				</button>
			</div>

			<div className="grid gap-4 md:grid-cols-3">
				<div className="erp-stat">
					<ShieldCheck />
					<div>
						<span>Tổng vai trò</span>
						<strong>{roles.length}</strong>
					</div>
				</div>
				<div className="erp-stat">
					<Lock />
					<div>
						<span>Hệ thống</span>
						<strong>{roles.filter(r => r.isSystem).length}</strong>
					</div>
				</div>
				<div className="erp-stat">
					<UsersIcon />
					<div>
						<span>Tổng quyền</span>
						<strong>{permissions.length}</strong>
					</div>
				</div>
			</div>

			<div className="erp-card overflow-hidden">
				<ListToolbar
					fields={filterFields}
					values={filters}
					onChange={setFilters}
					onExport={exportRoles}
					exportDisabled={filteredRoles.length === 0}
					search={
						<div className="erp-search">
							<Search size={16} />
							<input
								value={search}
								onChange={event => setSearch(event.target.value)}
								placeholder="Tìm mã hoặc tên vai trò..."
							/>
						</div>
					}
				/>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Mã / Tên vai trò</th>
								<th>Quyền</th>
								<th>Tài khoản</th>
								<th className="text-right">Thao tác</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td colSpan={4} className="py-12 text-center text-slate-400">Đang tải...</td>
								</tr>
							) : forbidden ? (
								<tr>
									<td colSpan={4} className="py-12 text-center text-slate-400">Bạn không có quyền quản lý vai trò</td>
								</tr>
							) : filteredRoles.length === 0 ? (
								<tr>
									<td colSpan={4} className="py-12 text-center text-slate-400">Chưa có vai trò nào</td>
								</tr>
							) : (
								filteredRoles.map(role => (
									<tr key={role.id}>
										<td>
											<div className="flex items-center gap-2">
												<b>{role.name}</b>
												{role.isSystem && (
													<span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-500">
														<Lock size={10} /> Hệ thống
													</span>
												)}
											</div>
											<small className="font-mono">{role.code}</small>
											{role.description && <small>{role.description}</small>}
										</td>
										<td>
											<b>{role.permissionCodes.length} quyền</b>
											<small>
												{role.permissionCodes.slice(0, 3).join(", ")}
												{role.permissionCodes.length > 3 && ` +${role.permissionCodes.length - 3}`}
											</small>
										</td>
										<td>
											<b>{role.userCount}</b>
										</td>
										<td className="text-right">
											<div className="flex items-center justify-end gap-1">
												<button onClick={() => openEdit(role)} className="erp-icon-btn" title="Chỉnh sửa quyền">
													<Edit size={16} />
												</button>
												<button
													onClick={() => handleDelete(role)}
													disabled={role.isSystem || role.userCount > 0}
													className="erp-icon-btn text-red-500 disabled:opacity-30"
													title={role.isSystem ? "Vai trò hệ thống" : role.userCount > 0 ? "Đang gán cho tài khoản" : "Xóa"}
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

			{isModalOpen && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-2xl">
						<div className="erp-modal-header">
							<div>
								<h2>{editing ? `Chỉnh sửa ${editing.code}` : "Thêm vai trò"}</h2>
								<p>Đặt tên và chọn các quyền cho vai trò</p>
							</div>
							<button onClick={() => setIsModalOpen(false)}>
								<X size={18} />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							<div className="grid gap-4 md:grid-cols-2">
								<label className="block text-[13px] font-medium text-slate-700">
									<span className="mb-1 block">Mã vai trò <span className="text-red-500">*</span></span>
									<input
										type="text"
										value={code}
										disabled={!!editing}
										onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""))}
										placeholder="VD: KE_TOAN"
										className="font-mono disabled:bg-slate-50"
									/>
								</label>
								<label className="block text-[13px] font-medium text-slate-700">
									<span className="mb-1 block">Tên vai trò <span className="text-red-500">*</span></span>
									<input
										type="text"
										value={name}
										onChange={e => setName(e.target.value)}
										placeholder="VD: Kế toán"
									/>
								</label>
							</div>
							<label className="block text-[13px] font-medium text-slate-700">
								<span className="mb-1 block">Mô tả</span>
								<input
									type="text"
									value={description}
									onChange={e => setDescription(e.target.value)}
									placeholder="Mô tả ngắn về vai trò"
								/>
							</label>
							<div>
								<div className="mb-2 flex items-center justify-between">
									<span className="text-[13px] font-medium text-slate-700">
										Quyền đã chọn: <b>{selected.length}/{permissions.length}</b>
									</span>
									<div className="erp-search w-56">
										<Search size={16} />
										<input
											type="text"
											placeholder="Tìm quyền..."
											value={permSearch}
											onChange={e => setPermSearch(e.target.value)}
										/>
									</div>
								</div>
								<div className="max-h-80 space-y-3 overflow-y-auto rounded-lg border border-slate-200 p-3">
									{groups.map(([resource, perms]) => {
										const codes = perms.map(p => p.code);
										const checkedCount = codes.filter(c => selected.includes(c)).length;
										return (
											<div key={resource}>
												<label className="mb-1 flex cursor-pointer items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-slate-600">
													<input
														type="checkbox"
														checked={checkedCount === codes.length && codes.length > 0}
														ref={el => {
															if (el) el.indeterminate = checkedCount > 0 && checkedCount < codes.length;
														}}
														onChange={() => toggleGroup(perms)}
														className="h-3.5 w-3.5 accent-indigo-600"
													/>
													{resourceLabel(resource)} ({checkedCount}/{codes.length})
												</label>
												<div className="ml-5 space-y-1">
													{perms.map(perm => (
														<label key={perm.code} className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-[13px] text-slate-700 hover:bg-slate-50">
															<input
																type="checkbox"
																checked={selected.includes(perm.code)}
																onChange={() => togglePerm(perm.code)}
																className="mt-1 h-3.5 w-3.5 accent-indigo-600"
															/>
															<span>
																{perm.name}
																<span className="ml-1 font-mono text-[11px] text-slate-400">{perm.code}</span>
															</span>
														</label>
													))}
												</div>
											</div>
										);
									})}
									{groups.length === 0 && (
										<p className="py-6 text-center text-sm text-slate-400">Không tìm thấy quyền nào</p>
									)}
								</div>
							</div>
						</div>
						<div className="erp-modal-footer">
							<button type="button" onClick={() => setIsModalOpen(false)} className="erp-btn">
								Hủy
							</button>
							<button
								type="button"
								onClick={() => saveMutation.mutate()}
								disabled={saveMutation.isPending}
								className="erp-btn erp-btn-primary disabled:opacity-50"
							>
								{saveMutation.isPending ? "Đang lưu..." : editing ? "Cập nhật" : "Tạo vai trò"}
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
