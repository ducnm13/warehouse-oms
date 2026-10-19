import React, { useState } from "react";
import { Camera, CheckCircle2, KeyRound, Mail, MapPin, Phone, Shield, User as UserIcon } from "lucide-react";
import toast from "./ui/toast";
import Button from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import Badge from "./ui/badge";
import { Field, FieldLabel, PasswordInput } from "./ui/input";

const ROLE_LABELS: Record<string, string> = {
	ADMIN: "Quản trị viên",
	W_MANAGER: "Quản lý kho",
	P_MANAGER: "Quản lý sản xuất",
	S_SALES: "Nhân viên kinh doanh",
	QD: "Kế toán",
};

export default function Profile() {
	const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
	const [tab, setTab] = useState<"info" | "security">("info");
	const [loading, setLoading] = useState(false);
	const [formData, setFormData] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });

	const handleChangePassword = async (e: React.FormEvent) => {
		e.preventDefault();
		if (formData.newPassword.length < 6) {
			toast.error("Mật khẩu mới phải có ít nhất 6 ký tự!");
			return;
		}
		if (formData.newPassword !== formData.confirmPassword) {
			toast.error("Nhập lại mật khẩu mới không trùng khớp!");
			return;
		}
		setLoading(true);
		try {
			const res = await fetch("/api/user/change-password", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
				body: JSON.stringify({ oldPassword: formData.oldPassword, newPassword: formData.newPassword }),
			});
			const data = await res.json();
			if (res.ok) {
				toast.success("Đổi mật khẩu thành công!");
				setFormData({ oldPassword: "", newPassword: "", confirmPassword: "" });
			} else {
				toast.error(data.message || "Lỗi khi đổi mật khẩu");
			}
		} catch {
			toast.error("Có lỗi xảy ra, vui lòng thử lại sau!");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Hồ sơ cá nhân</h1>
					<p>Thông tin tài khoản, vai trò và bảo mật đăng nhập</p>
				</div>
				<Badge tone="success">Đang hoạt động</Badge>
			</div>

			<Card className="overflow-hidden !p-0">
				<div className="relative h-32 bg-gradient-to-r from-[#465fff] via-[#3641f4] to-[#101828]">
					<div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 30%, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
				</div>
				<div className="flex flex-col gap-4 px-6 pb-6 md:flex-row md:items-end md:justify-between">
					<div className="-mt-10 flex items-end gap-4">
						<div className="relative">
							<div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-3xl font-bold text-[#465fff] shadow-lg ring-4 ring-white">
								{currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : "U"}
							</div>
							<button type="button" title="Đổi ảnh đại diện" className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#101828] text-white shadow hover:bg-[#344054]">
								<Camera size={13} />
							</button>
						</div>
						<div className="pb-1">
							<h2 className="text-xl font-bold tracking-tight text-[#101828]">{currentUser.fullName || "Chưa cập nhật"}</h2>
							<p className="text-sm text-[#667085]">@{currentUser.username || "username"}</p>
							<div className="mt-1.5 flex flex-wrap gap-1.5">
								<Badge tone="brand">{ROLE_LABELS[currentUser.role] || currentUser.role || "Nhân viên"}</Badge>
							</div>
						</div>
					</div>
					<div className="flex gap-2">
						<Button variant={tab === "info" ? "primary" : "outline"} size="sm" onClick={() => setTab("info")}>
							<UserIcon size={15} /> Thông tin
						</Button>
						<Button variant={tab === "security" ? "primary" : "outline"} size="sm" onClick={() => setTab("security")}>
							<KeyRound size={15} /> Bảo mật
						</Button>
					</div>
				</div>
			</Card>

			{tab === "info" ? (
				<div className="grid gap-4 lg:grid-cols-3">
					<Card>
						<CardHeader><CardTitle>Thông tin liên hệ</CardTitle></CardHeader>
						<CardContent className="space-y-3 text-sm">
							<p className="flex items-center gap-2.5 text-[#344054]"><Mail size={16} className="text-[#98a2b3]" /> {currentUser.email || "Chưa cập nhật email"}</p>
							<p className="flex items-center gap-2.5 text-[#344054]"><Phone size={16} className="text-[#98a2b3]" /> {currentUser.phone || "Chưa cập nhật SĐT"}</p>
							<p className="flex items-center gap-2.5 text-[#344054]"><MapPin size={16} className="text-[#98a2b3]" /> {currentUser.address || "Chưa cập nhật địa chỉ"}</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader><CardTitle>Vai trò hệ thống</CardTitle></CardHeader>
						<CardContent className="space-y-3">
							<p className="flex items-center gap-2.5 rounded-lg bg-[#f9fafb] px-3 py-2.5 text-sm font-medium text-[#344054]"><Shield size={16} className="text-[#465fff]" /> {ROLE_LABELS[currentUser.role] || currentUser.role || "Nhân viên"}</p>
							<p className="flex items-center gap-2.5 rounded-lg bg-[#ecfdf3] px-3 py-2.5 text-sm font-medium text-[#027a48]"><CheckCircle2 size={16} /> Tài khoản đang hoạt động</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader><CardTitle>Phiên đăng nhập</CardTitle></CardHeader>
						<CardContent className="space-y-2 text-sm text-[#667085]">
							<p>Tên đăng nhập: <b className="text-[#101828]">{currentUser.username || "-"}</b></p>
							<p>Mã người dùng: <b className="text-[#101828]">#{currentUser.id || "-"}</b></p>
							<p>Đổi mật khẩu định kỳ để bảo vệ kho và chứng từ.</p>
						</CardContent>
					</Card>
				</div>
			) : (
				<Card>
					<CardHeader><CardTitle>Đổi mật khẩu</CardTitle></CardHeader>
					<CardContent>
						<form onSubmit={handleChangePassword} className="grid max-w-2xl gap-4">
							<Field>
								<FieldLabel required>Mật khẩu hiện tại</FieldLabel>
								<PasswordInput required name="oldPassword" value={formData.oldPassword} onChange={e => setFormData({ ...formData, oldPassword: e.target.value })} placeholder="••••••••" />
							</Field>
							<div className="grid gap-4 md:grid-cols-2">
								<Field>
									<FieldLabel required>Mật khẩu mới (tối thiểu 6 ký tự)</FieldLabel>
									<PasswordInput required name="newPassword" value={formData.newPassword} onChange={e => setFormData({ ...formData, newPassword: e.target.value })} placeholder="••••••••" />
								</Field>
								<Field>
									<FieldLabel required>Nhập lại mật khẩu mới</FieldLabel>
									<PasswordInput required name="confirmPassword" value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} placeholder="••••••••" />
								</Field>
							</div>
							<div className="flex justify-end">
								<Button type="submit" variant="primary" disabled={loading}>{loading ? "Đang xử lý..." : "Cập nhật mật khẩu"}</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
