import React, { useState, useEffect } from 'react';
import { UserPlus, Edit, Trash2, Search, Shield, Users as UsersIcon, UserCog, X, Eye, EyeOff } from 'lucide-react';
import toast from '../components/ui/toast';
import { confirm } from '../components/ui/confirm';
import { apiV1 } from '../lib/apiV1';
import { User, Role } from '../types';
import ListToolbar from '../components/ListToolbar';
import type { FilterField, FilterValues } from '../components/FilterDrawer';
import { exportExcelFile } from '../lib/excelExport';

const ROLE_META: Record<string, { label: string; css: string }> = {
  ADMIN: { label: "Quản trị viên", css: "bg-purple-100 text-purple-700" },
  W_MANAGER: { label: "Thủ kho", css: "bg-blue-100 text-blue-700" },
  P_MANAGER: { label: "Quản lý sản xuất", css: "bg-amber-100 text-amber-700" },
  S_SALES: { label: "Kinh doanh", css: "bg-emerald-100 text-emerald-700" },
  O_SALES: { label: "Bán hàng online", css: "bg-cyan-100 text-cyan-700" },
  QD: { label: "Quản lý", css: "bg-slate-100 text-slate-600" },
  FULL_ACCESS: { label: "Toàn quyền nghiệp vụ", css: "bg-indigo-100 text-indigo-700" },
};

interface RoleOption {
  id: number;
  code: string;
  name: string;
}

const getRoleLabel = (code: string, roles: RoleOption[]) =>
  roles.find(r => r.code === code)?.name || ROLE_META[code]?.label || code || "—";

const userRoleCodes = (user: User): string[] =>
  user.roles?.length ? user.roles : user.role ? [user.role] : [];

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [allRoles, setAllRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Partial<User> & { password?: string } | null>(null);
  const [selectedRoleCodes, setSelectedRoleCodes] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<FilterValues>({});
  const [showPassword, setShowPassword] = useState(false);

  const currentUserId = (() => {
    try {
      return Number(JSON.parse(localStorage.getItem("user") || "{}").id) || 0;
    } catch {
      return 0;
    }
  })();

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const res = await apiV1<RoleOption[]>('/api/v1/iam/roles');
      setAllRoles(res.data);
    } catch {
      // Không có quyền iam.manage: dùng danh sách vai trò legacy
      setAllRoles((Object.keys(ROLE_META)).map((code, i) => ({ id: -(i + 1), code, name: ROLE_META[code].label })));
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        setUsers(await res.json());
      } else {
        toast.error('Bạn không có quyền truy cập trang này');
      }
    } catch (err) {
      toast.error('Lỗi khi tải danh sách tài khoản');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    const fallback = allRoles.find(r => r.code === "W_MANAGER") || allRoles[0];
    setSelectedUser({ fullName: "", username: "", role: "W_MANAGER" as Role, password: "" });
    setSelectedRoleCodes(fallback ? [fallback.code] : []);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const openEdit = (user: User) => {
    setSelectedUser({ ...user, password: "" });
    setSelectedRoleCodes(userRoleCodes(user));
    setShowPassword(false);
    setIsModalOpen(true);
  };

  const toggleRoleCode = (code: string) =>
    setSelectedRoleCodes(prev => (prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    if (!selectedUser.fullName?.trim() || !selectedUser.username?.trim()) {
      toast.error('Nhập đủ họ tên và tên đăng nhập');
      return;
    }
    if (!selectedUser.id && !selectedUser.password) {
      toast.error('Nhập mật khẩu cho tài khoản mới');
      return;
    }
    if (!selectedRoleCodes.length) {
      toast.error('Chọn ít nhất một vai trò cho tài khoản');
      return;
    }
    const roleIds = selectedRoleCodes
      .map(code => allRoles.find(r => r.code === code)?.id)
      .filter((id): id is number => typeof id === "number" && id > 0);
    if (!roleIds.length) {
      toast.error('Vai trò đã chọn chưa có trên hệ thống, tải lại trang và thử lại');
      return;
    }

    try {
      const isEdit = !!selectedUser.id;
      const url = isEdit ? `/api/users/${selectedUser.id}` : '/api/users';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ...selectedUser, role: selectedRoleCodes[0], roleIds })
      });

      if (res.ok) {
        toast.success(isEdit
          ? `Đã cập nhật ${selectedUser.fullName} (${selectedRoleCodes.map(c => getRoleLabel(c, allRoles)).join(", ")})`
          : `Đã thêm tài khoản ${selectedUser.fullName}`);
        setIsModalOpen(false);
        setSelectedUser(null);
        fetchUsers();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      toast.error('Có lỗi hệ thống');
    }
  };

  const handleDelete = async (user: User) => {
    if (user.id === currentUserId) {
      toast.error('Không thể xóa chính tài khoản đang đăng nhập');
      return;
    }
    if (!(await confirm(`Xóa tài khoản ${user.fullName} (@${user.username})?`))) return;
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success('Đã xóa tài khoản');
        fetchUsers();
      } else {
        toast.error(data.error || 'Lỗi khi xóa tài khoản');
      }
    } catch (err) {
      toast.error('Lỗi kết nối máy chủ');
    }
  };

  const keyword = searchTerm.trim().toLowerCase();
  const filteredUsers = users.filter(u => {
    const matchKeyword = !keyword ||
      u.fullName?.toLowerCase().includes(keyword) ||
      u.username?.toLowerCase().includes(keyword);
    const codes = userRoleCodes(u);
    const matchRole = !filters.role || codes.includes(filters.role);
    return matchKeyword && matchRole;
  });

  const adminCount = users.filter(u => userRoleCodes(u).includes("ADMIN")).length;
  const filterOptions = allRoles.length
    ? allRoles
    : (Object.keys(ROLE_META)).map(code => ({ id: 0, code, name: ROLE_META[code].label }));
  const filterFields: FilterField[] = [
    {
      type: 'select',
      key: 'role',
      label: 'Vai trò',
      options: filterOptions.map(role => ({ value: role.code, label: role.name })),
    },
  ];
  const exportUsers = () =>
    exportExcelFile(
      'tai-khoan.xlsx',
      'Tai khoan',
      [
        { header: 'Tên đăng nhập', value: (user: User) => user.username },
        { header: 'Họ tên', value: (user: User) => user.fullName, width: 28 },
        {
          header: 'Vai trò',
          value: (user: User) =>
            userRoleCodes(user)
              .map(code => getRoleLabel(code, allRoles))
              .join(', '),
          width: 28,
        },
        {
          header: 'Quyền',
          value: (user: User) => (user.permissions || []).length,
        },
      ],
      filteredUsers,
    );

  return (
    <div className="erp-page">
      <div className="erp-page-header">
        <div>
          <h1>Tài khoản</h1>
          <p>Tài khoản đăng nhập và phân quyền sử dụng hệ thống</p>
        </div>
        <button onClick={openCreate} className="erp-btn erp-btn-primary">
          <UserPlus size={16} /> Thêm tài khoản
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="erp-stat">
          <UsersIcon />
          <div>
            <span>Tổng tài khoản</span>
            <strong>{users.length}</strong>
          </div>
        </div>
        <div className="erp-stat">
          <Shield />
          <div>
            <span>Quản trị viên</span>
            <strong className="text-purple-600">{adminCount}</strong>
          </div>
        </div>
        <div className="erp-stat">
          <UserCog />
          <div>
            <span>Nhân viên</span>
            <strong>{users.length - adminCount}</strong>
          </div>
        </div>
      </div>

      <div className="erp-card overflow-hidden">
        <ListToolbar
          fields={filterFields}
          values={filters}
          onChange={setFilters}
          onExport={exportUsers}
          exportDisabled={filteredUsers.length === 0}
          search={
            <div className="erp-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Tìm theo tên, tên đăng nhập..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          }
        />

        <div className="overflow-x-auto">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Họ tên / Tài khoản</th>
                <th>Vai trò</th>
                <th className="text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="py-12 text-center text-slate-400">
                    Đang tải...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-20 text-center">
                    <div className="flex flex-col items-center justify-center opacity-20">
                      <UserCog size={64} />
                      <p className="mt-4 font-black uppercase text-sm tracking-widest">
                        Không tìm thấy tài khoản nào
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 font-black uppercase text-indigo-600 shadow-sm">
                          {user.fullName.charAt(0)}
                        </div>
                        <div>
                          <b>{user.fullName}</b>
                          <small>
                            @{user.username}
                            {user.id === currentUserId && " · (bạn)"}
                          </small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {userRoleCodes(user).map(code => (
                          <span key={code} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold uppercase ${ROLE_META[code]?.css || "bg-slate-100 text-slate-600"}`}>
                            <Shield size={10} />
                            {getRoleLabel(code, allRoles)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(user)}
                          className="erp-icon-btn"
                          title="Chỉnh sửa"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(user)}
                          disabled={user.id === currentUserId}
                          className="erp-icon-btn text-red-500 disabled:opacity-30"
                          title={user.id === currentUserId ? "Không thể xóa chính mình" : "Xóa"}
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
          <div className="erp-modal max-w-lg">
            <div className="erp-modal-header">
              <div>
                <h2>{selectedUser?.id ? "Chỉnh sửa tài khoản" : "Thêm tài khoản mới"}</h2>
                <p>Thông tin đăng nhập và vai trò hệ thống</p>
              </div>
              <button onClick={() => setIsModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="erp-modal-body space-y-4">
                <label className="block text-[13px] font-medium text-slate-700">
                  <span className="mb-1 block">
                    Họ và tên <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={selectedUser?.fullName || ""}
                    onChange={(e) =>
                      setSelectedUser({
                        ...selectedUser!,
                        fullName: e.target.value,
                      })
                    }
                    placeholder="Nguyễn Văn A"
                  />
                </label>
                <label className="block text-[13px] font-medium text-slate-700">
                  <span className="mb-1 block">
                    Tên đăng nhập <span className="text-red-500">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={selectedUser?.username || ""}
                    onChange={(e) =>
                      setSelectedUser({
                        ...selectedUser!,
                        username: e.target.value.trim(),
                      })
                    }
                    placeholder="vd: thu_kho"
                    className="font-mono"
                  />
                </label>
                <label className="block text-[13px] font-medium text-slate-700">
                  <span className="mb-1 block">
                    {selectedUser?.id ? "Đổi mật khẩu (để trống nếu không đổi)" : (
                      <>Mật khẩu <span className="text-red-500">*</span></>
                    )}
                  </span>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required={!selectedUser?.id}
                      value={selectedUser?.password || ""}
                      onChange={(e) =>
                        setSelectedUser({
                          ...selectedUser!,
                          password: e.target.value,
                        })
                      }
                      className="w-full pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>
                <div className="block text-[13px] font-medium text-slate-700">
                  <span className="mb-1 block">
                    Vai trò <span className="text-red-500">*</span>
                    <span className="ml-1 font-normal text-slate-400">(tích chọn, vai trò đầu tiên là vai trò chính)</span>
                  </span>
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                    {allRoles.map(role => (
                      <label key={role.code} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          checked={selectedRoleCodes.includes(role.code)}
                          onChange={() => toggleRoleCode(role.code)}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        <span className="font-mono text-xs text-slate-400">{role.code}</span>
                        <span>{role.name}</span>
                      </label>
                    ))}
                    {allRoles.length === 0 && (
                      <p className="py-4 text-center text-sm text-slate-400">Chưa tải được danh sách vai trò</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="erp-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="erp-btn"
                >
                  Hủy
                </button>
                <button type="submit" className="erp-btn erp-btn-primary">
                  {selectedUser?.id ? "Cập nhật" : "Thêm tài khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
