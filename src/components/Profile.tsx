import React, { useState } from "react";
import {
  User,
  Lock,
  KeyRound,
  Shield,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import toast from "react-hot-toast";

export default function Profile() {
  // Lấy thông tin user hiện tại từ localStorage
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState({
    old: false,
    new: false,
    confirm: false,
  });
  const [formData, setFormData] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const togglePasswordVisibility = (field: "old" | "new" | "confirm") => {
    setShowPassword({ ...showPassword, [field]: !showPassword[field] });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // Kiểm tra dữ liệu hợp lệ cơ bản
    if (formData.newPassword.length < 6) {
      toast.error("Mật khẩu mới phải có ít nhất 6 ký tự!");
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error("Nhập lại mật khẩu mới không trùng khớp!");
      return;
    }

    setLoading(false);
    setLoading(true);
    try {
      const res = await fetch("/api/user/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          oldPassword: formData.oldPassword,
          newPassword: formData.newPassword,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Đổi mật khẩu thành công!");
        setFormData({ oldPassword: "", newPassword: "", confirmPassword: "" });
      } else {
        toast.error(data.message || "Lỗi khi đổi mật khẩu");
      }
    } catch (err) {
      toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300 font-sans">
      {/* TIÊU ĐỀ TRANG */}
      <div>
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">
          HỒ SƠ CÁ NHÂN
        </h2>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
          Quản lý thông tin tài khoản và bảo mật nâng cao
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* THẺ THÔNG TIN NHÂN VIÊN */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-24 h-24 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-extrabold text-3xl shadow-inner border border-indigo-100/50">
            {currentUser.fullName
              ? currentUser.fullName.charAt(0).toUpperCase()
              : "U"}
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800">
              {currentUser.fullName || "Chưa cập nhật"}
            </h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-0.5 font-mono">
              @{currentUser.username || "username"}
            </p>
          </div>

          <div className="w-full pt-4 border-t border-slate-100 flex flex-col gap-2 text-left">
            <div className="flex items-center gap-2.5 text-slate-600 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
              <Shield size={16} className="text-indigo-500 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Chức vụ hệ thống
                </p>
                <p className="text-xs font-extrabold text-slate-700 uppercase mt-0.5">
                  {currentUser.role || "Nhân viên"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-slate-600 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
              <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Trạng thái tài khoản
                </p>
                <p className="text-xs font-extrabold text-emerald-600 uppercase mt-0.5">
                  Đang hoạt động
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FORM ĐỔI MẬT KHẨU */}
        <div className="md:col-span-2 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center gap-2">
            <KeyRound size={18} className="text-indigo-500" />
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-wide">
              Thay đổi mật khẩu thiết bị
            </h4>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-4">
            {/* Mật khẩu cũ */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Mật khẩu hiện tại
              </label>
              <div className="relative">
                <input
                  type={showPassword.old ? "text" : "password"}
                  name="oldPassword"
                  value={formData.oldPassword}
                  onChange={handleInputChange}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 pl-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
                />
                <Lock
                  size={16}
                  className="absolute left-3.5 top-3.5 text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility("old")}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword.old ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Mật khẩu mới */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Mật khẩu mới (Tối thiểu 6 ký tự)
              </label>
              <div className="relative">
                <input
                  type={showPassword.new ? "text" : "password"}
                  name="newPassword"
                  value={formData.newPassword}
                  onChange={handleInputChange}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 pl-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
                />
                <KeyRound
                  size={16}
                  className="absolute left-3.5 top-3.5 text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility("new")}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword.new ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Xác nhận mật khẩu mới */}
            <div>
              <label className="mb-1.5 block text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Nhập lại mật khẩu mới
              </label>
              <div className="relative">
                <input
                  type={showPassword.confirm ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 pl-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-slate-700"
                />
                <KeyRound
                  size={16}
                  className="absolute left-3.5 top-3.5 text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility("confirm")}
                  className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword.confirm ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
            </div>

            {/* Nút bấm Lưu */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-md shadow-indigo-100 uppercase text-xs tracking-wider"
              >
                {loading ? "Đang xử lý..." : "CẬP NHẬT MẬT KHẨU"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
