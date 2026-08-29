import React, { useState, useEffect } from 'react';
import { UserPlus, Edit, Trash2, Shield, User as UserIcon, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { User, Role } from '../types';
import { cn } from '../lib/utils';

const Users = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Partial<User> & { password?: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

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
      toast.error('Lỗi khi tải danh sách nhân viên');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

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
        body: JSON.stringify(selectedUser)
      });

      if (res.ok) {
        toast.success(isEdit ? 'Cập nhật thành công' : 'Thêm nhân viên thành công');
        setIsModalOpen(false);
        fetchUsers();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Có lỗi xảy ra');
      }
    } catch (err) {
      toast.error('Có lỗi hệ thống');
    }
  };

  const getRoleLabel = (role: Role) => {
    switch (role) {
      case "ADMIN":
        return "Quản trị viên";
      case "W_MANAGER":
        return "Thủ kho";
      case "P_MANAGER":
        return "Quản lý sản xuất";
      case "S_SALES":
        return "Kinh doanh";
      case "QD":
        return "Quản lý";
      default:
        return role;
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-800">Quản lý nhân viên</h2>
        <button
          onClick={() => {
            setSelectedUser({
              fullName: "",
              username: "",
              role: "W_MANAGER",
              password: "",
            });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 rounded bg-primary py-2 px-4 text-sm font-bold text-white hover:bg-opacity-90 transition-all shadow-sm"
        >
          <UserPlus size={16} /> THÊM NHÂN VIÊN
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-gray-400 border-b">
              <th className="pb-3 font-medium">Họ tên & Tài khoản</th>
              <th className="pb-3 font-medium">Chức vụ</th>
              <th className="pb-3 font-medium text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b hover:bg-gray-50 transition-colors"
              >
                <td className="py-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold border border-indigo-100 shadow-sm">
                    {user.fullName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{user.fullName}</p>
                    <p className="text-xs text-gray-400 font-mono">
                      @{user.username}
                    </p>
                  </div>
                </td>
                <td className="py-4 text-sm">
                  <span
                    className={cn(
                      "px-2 py-1 text-[10px] font-bold rounded uppercase flex items-center gap-1 w-fit",
                      user.role === "ADMIN"
                        ? "bg-purple-100 text-purple-700"
                        : user.role === "W_MANAGER"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-orange-100 text-orange-700",
                    )}
                  >
                    <Shield size={10} />
                    {getRoleLabel(user.role)}
                  </span>
                </td>
                <td className="py-4 text-right">
                  <div className="flex items-center justify-end gap-3 text-gray-400">
                    <button
                      onClick={() => {
                        setSelectedUser({ ...user, password: "" });
                        setIsModalOpen(true);
                      }}
                      className="hover:text-primary transition-colors"
                      title="Chỉnh sửa"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      className="hover:text-red-500 transition-colors"
                      title="Xóa"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl animate-in fade-in zoom-in duration-200">
            <div className="mb-6 flex items-center justify-between border-b pb-4">
              <h3 className="text-xl font-bold text-gray-800 uppercase tracking-tight">
                {selectedUser?.id
                  ? "Chỉnh sửa nhân viên"
                  : "Thêm nhân viên mới"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Họ và tên
                </label>
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
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-primary font-bold text-gray-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Tên đăng nhập
                </label>
                <input
                  type="text"
                  required
                  value={selectedUser?.username || ""}
                  onChange={(e) =>
                    setSelectedUser({
                      ...selectedUser!,
                      username: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-primary font-mono text-gray-700"
                />
              </div>
              {!selectedUser?.id && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Mật khẩu
                  </label>
                  <input
                    type="password"
                    required
                    value={selectedUser?.password || ""}
                    onChange={(e) =>
                      setSelectedUser({
                        ...selectedUser!,
                        password: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-primary"
                  />
                </div>
              )}
              {selectedUser?.id && (
                <div>
                  <label className="mb-1 block text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Đổi mật khẩu (Để trống nếu không đổi)
                  </label>
                  <input
                    type="password"
                    value={selectedUser?.password || ""}
                    onChange={(e) =>
                      setSelectedUser({
                        ...selectedUser!,
                        password: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-primary"
                  />
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Chức vụ
                </label>
                <select
                  value={selectedUser?.role || "W_MANAGER"}
                  onChange={(e) =>
                    setSelectedUser({
                      ...selectedUser!,
                      role: e.target.value as Role,
                    })
                  }
                  className="w-full rounded-lg border border-gray-200 p-2.5 text-sm outline-none focus:border-primary font-bold text-gray-700"
                >
                  <option value="W_MANAGER">Thủ kho</option>
                  <option value="P_MANAGER">Quản lý sản xuất</option>
                  <option value="ADMIN">Quản trị viên</option>
                  <option value="S_SALES">Kinh doanh</option>
                  <option value="QD">Quản lý 1</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-gray-600 uppercase"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-6 py-2 text-sm font-bold text-white hover:bg-opacity-90 shadow-md uppercase tracking-wide"
                >
                  LƯU THAY ĐỔI
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
