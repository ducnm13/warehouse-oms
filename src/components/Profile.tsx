import React, { useState } from "react";
import {
	Camera,
	CheckCircle2,
	KeyRound,
	Mail,
	MapPin,
	Phone,
	Shield,
	User as UserIcon,
} from "lucide-react";
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
	const [avatar, setAvatar] = useState<string | null>(currentUser.avatarUrl || null);
	const [avatarSaving, setAvatarSaving] = useState(false);
	const fileRef = React.useRef<HTMLInputElement>(null);

	const persistAvatar = (next: string | null) => {
		try {
			localStorage.setItem("user", JSON.stringify({ ...currentUser, avatarUrl: next }));
		} catch {
			// Bỏ qua khi localStorage đầy (ảnh data URL lớn)
		}
		setAvatar(next);
	};

	const handleAvatarFile = (file: File | undefined) => {
		if (!file) return;
		if (!file.type.startsWith("image/")) {
			toast.error("Chỉ chọn file ảnh (PNG/JPG/GIF/WebP)");
			return;
		}
		if (file.size > 2 * 1024 * 1024) {
			toast.error("Ảnh quá lớn, chọn ảnh dưới 2MB");
			return;
		}
		const reader = new FileReader();
		reader.onload = () => persistAvatar(String(reader.result || ""));
		reader.readAsDataURL(file);
	};

	const handleSaveAvatar = async () => {
		setAvatarSaving(true);
		try {
			const res = await fetch("/api/users/me/avatar", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
				body: JSON.stringify({ avatarUrl: avatar }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || "Lỗi khi lưu ảnh đại diện");
			persistAvatar(data.avatarUrl || null);
			toast.success("Đã cập nhật ảnh đại diện");
			window.setTimeout(() => window.location.reload(), 800);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
		} finally {
			setAvatarSaving(false);
		}
	};

	const handleRemoveAvatar = async () => {
		setAvatar(null);
		setAvatarSaving(true);
		try {
			const res = await fetch("/api/users/me/avatar", {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
				body: JSON.stringify({ avatarUrl: null }),
			});
			if (!res.ok) throw new Error("Lỗi khi xóa ảnh đại diện");
			persistAvatar(null);
			toast.success("Đã gỡ ảnh đại diện");
			window.setTimeout(() => window.location.reload(), 800);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
		} finally {
			setAvatarSaving(false);
		}
	};
	const [formData, setFormData] = useState({
		oldPassword: "",
		newPassword: "",
		confirmPassword: "",
	});

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
				<div className="relative h-32 bg-gradient-to-r from-[#422afb] via-[#3311db] to-[#1b2559]">
					<div
						className="absolute inset-0 opacity-20"
						style={{
							backgroundImage:
								"radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 30%, white 1px, transparent 1px)",
							backgroundSize: "28px 28px",
						}}
					/>
				</div>
				<div className="flex flex-col gap-4 px-6 pb-6 md:flex-row md:items-end md:justify-between">
					<div className="mt-10 flex items-end gap-4">
						<div className="relative">
							<div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white text-3xl font-bold text-[#422afb] shadow-lg ring-4 ring-white">
								{avatar ? (
									<img src={avatar} alt="Ảnh đại diện" className="h-full w-full object-cover" />
								) : currentUser.fullName ? (
									currentUser.fullName.charAt(0).toUpperCase()
								) : (
									"U"
								)}
							</div>
							<button
								type="button"
								title="Đổi ảnh đại diện"
								onClick={() => fileRef.current?.click()}
								className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#1b2559] text-white shadow hover:bg-[#2b3674]"
							>
								<Camera size={13} />
							</button>
							<input
								ref={fileRef}
								type="file"
								accept="image/png,image/jpeg,image/gif,image/webp"
								className="hidden"
								onChange={e => {
									handleAvatarFile(e.target.files?.[0]);
									e.target.value = "";
								}}
							/>
						</div>
						{(avatar || avatar !== (currentUser.avatarUrl || null)) && (
							<div className="flex gap-2 pb-1">
								{avatar !== (currentUser.avatarUrl || null) && (
									<Button size="sm" variant="primary" disabled={avatarSaving} onClick={handleSaveAvatar}>
										{avatarSaving ? "Đang lưu..." : "Lưu ảnh"}
									</Button>
								)}
								{avatar && (
									<Button size="sm" variant="outline" disabled={avatarSaving} onClick={handleRemoveAvatar}>
										Gỡ ảnh
									</Button>
								)}
							</div>
						)}
						<div className="pb-1">
							<h2 className="text-xl font-bold tracking-tight text-[#1b2559]">
								{currentUser.fullName || "Chưa cập nhật"}
							</h2>
							<p className="text-sm text-[#a3aed0]">
								@{currentUser.username || "username"}
							</p>
							<div className="mt-1.5 flex flex-wrap gap-1.5">
								<Badge tone="brand">
									{ROLE_LABELS[currentUser.role] ||
										currentUser.role ||
										"Nhân viên"}
								</Badge>
							</div>
						</div>
					</div>
					<div className="flex gap-2">
						<Button
							variant={tab === "info" ? "primary" : "outline"}
							size="sm"
							onClick={() => setTab("info")}
						>
							<UserIcon size={15} /> Thông tin
						</Button>
						<Button
							variant={tab === "security" ? "primary" : "outline"}
							size="sm"
							onClick={() => setTab("security")}
						>
							<KeyRound size={15} /> Bảo mật
						</Button>
					</div>
				</div>
			</Card>

			{tab === "info" ? (
				<div className="grid gap-4 lg:grid-cols-3">
					<Card>
						<CardHeader>
							<CardTitle>Thông tin liên hệ</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3 text-sm">
							<p className="flex items-center gap-2.5 text-[#2b3674]">
								<Mail size={16} className="text-[#a3aed0]" />{" "}
								{currentUser.email || "Chưa cập nhật email"}
							</p>
							<p className="flex items-center gap-2.5 text-[#2b3674]">
								<Phone size={16} className="text-[#a3aed0]" />{" "}
								{currentUser.phone || "Chưa cập nhật SĐT"}
							</p>
							<p className="flex items-center gap-2.5 text-[#2b3674]">
								<MapPin size={16} className="text-[#a3aed0]" />{" "}
								{currentUser.address || "Chưa cập nhật địa chỉ"}
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>Vai trò hệ thống</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							<p className="flex items-center gap-2.5 rounded-lg bg-[#f4f7fe] px-3 py-2.5 text-sm font-medium text-[#2b3674]">
								<Shield size={16} className="text-[#422afb]" />{" "}
								{ROLE_LABELS[currentUser.role] ||
									currentUser.role ||
									"Nhân viên"}
							</p>
							<p className="flex items-center gap-2.5 rounded-lg bg-[#ecfdf3] px-3 py-2.5 text-sm font-medium text-[#027a48]">
								<CheckCircle2 size={16} /> Tài khoản đang hoạt động
							</p>
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<CardTitle>Phiên đăng nhập</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 text-sm text-[#a3aed0]">
							<p>
								Tên đăng nhập:{" "}
								<b className="text-[#1b2559]">{currentUser.username || "-"}</b>
							</p>
							<p>
								Mã người dùng:{" "}
								<b className="text-[#1b2559]">#{currentUser.id || "-"}</b>
							</p>
							<p>Đổi mật khẩu định kỳ để bảo vệ kho và chứng từ.</p>
						</CardContent>
					</Card>
				</div>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>Đổi mật khẩu</CardTitle>
					</CardHeader>
					<CardContent>
						<form
							onSubmit={handleChangePassword}
							className="grid max-w-2xl gap-4"
						>
							<Field>
								<FieldLabel required>Mật khẩu hiện tại</FieldLabel>
								<PasswordInput
									required
									name="oldPassword"
									value={formData.oldPassword}
									onChange={e =>
										setFormData({ ...formData, oldPassword: e.target.value })
									}
									placeholder="••••••••"
								/>
							</Field>
							<div className="grid gap-4 md:grid-cols-2">
								<Field>
									<FieldLabel required>
										Mật khẩu mới (tối thiểu 6 ký tự)
									</FieldLabel>
									<PasswordInput
										required
										name="newPassword"
										value={formData.newPassword}
										onChange={e =>
											setFormData({ ...formData, newPassword: e.target.value })
										}
										placeholder="••••••••"
									/>
								</Field>
								<Field>
									<FieldLabel required>Nhập lại mật khẩu mới</FieldLabel>
									<PasswordInput
										required
										name="confirmPassword"
										value={formData.confirmPassword}
										onChange={e =>
											setFormData({
												...formData,
												confirmPassword: e.target.value,
											})
										}
										placeholder="••••••••"
									/>
								</Field>
							</div>
							<div className="flex justify-end">
								<Button type="submit" variant="primary" disabled={loading}>
									{loading ? "Đang xử lý..." : "Cập nhật mật khẩu"}
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
