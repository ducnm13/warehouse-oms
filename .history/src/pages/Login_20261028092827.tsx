import React, { useState } from "react";
import {
	Boxes,
	Lock,
	ShieldCheck,
	User as UserIcon,
	Warehouse,
} from "lucide-react";
import toast from "../components/ui/toast";
import Button from "../components/ui/button";

interface LoginProps {
	onLogin: (token: string, user: any, refreshToken?: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [remember, setRemember] = useState(true);
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		try {
			const res = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, password }),
			});
			const data = await res.json();
			if (res.ok) {
				if (!remember) localStorage.setItem("erp-session-only", "1");
				// Legacy API returns { token, user }
				onLogin(data.token, data.user, "");
				toast.success(`Chào mừng trở lại, ${data.user.fullName}`);
			} else {
				toast.error(data.error || "Đăng nhập thất bại");
			}
		} catch (err) {
			console.error("Login error:", err);
			toast.error("Lỗi kết nối máy chủ");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="grid min-h-screen bg-[#f4f7fe] lg:grid-cols-2">
			<div className="relative hidden flex-col justify-between overflow-hidden bg-[#1b2559] p-10 text-white lg:flex">
				<div
					className="absolute inset-0 opacity-30"
					style={{
						backgroundImage:
							"radial-gradient(circle at 20% 20%, #7551ff 0, transparent 32%), radial-gradient(circle at 85% 15%, #00b5d8 0, transparent 26%), radial-gradient(circle at 70% 90%, #422afb 0, transparent 24%)",
					}}
				/>
				<div className="relative flex items-center gap-3">
					<div>
						<img src="/public/images/logo2.png" alt="" className="w-40" />
					</div>
					{/* <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#422afb] font-bold">
						C
					</span> */}
					<div>
						{/* <p className="font-semibold tracking-tight">Challenge ERP</p> */}
						<p className="text-xs text-white/60">ERP</p>
						<p className="text-xs text-white/60">Version v1.0.2</p>
					</div>
				</div>
				<div className="relative space-y-6">
					<h1 className="text-4xl font-bold leading-tight tracking-tight">
						Quản lý kho, mua bán và sản xuất trên một nền tảng.
					</h1>
					<p className="max-w-md text-sm leading-relaxed text-white/70">
						Theo dõi tồn kho theo thời gian thực, duyệt chứng từ mua bán, quản
						lý công nợ và lệnh sản xuất.
					</p>
					<div className="grid max-w-md grid-cols-4 gap-2">
						{[
							["99.9%", "Uptime"],
							["30+", "Phân hệ"],
							["24/7", "Vận hành"],
						].map(([value, label]) => (
							<div
								key={label}
								className="rounded-xl border border-white/10 bg-white/5 p-3"
							>
								<p className="text-lg font-bold">{value}</p>
								<p className="text-xs text-white/60">{label}</p>
							</div>
						))}
					</div>
				</div>
				<p className="relative text-xl text-white/50">
					© 2026 Challenge ERP · All rights reserved. Designed by{" "}
					<a
						href="https://Chance.vn"
						target="_blank"
						rel="noopener noreferrer"
						className="text-blue-500 hover:underline"
					>
						Chance.vn
					</a>
				</p>
			</div>

			<div className="flex min-w-0 flex-1 items-center justify-center p-6 sm:p-10">
				<div className="w-full max-w-md rounded-[20px] bg-white p-8 shadow-[14px_17px_40px_4px_rgba(112,144,176,0.08)]">
					<div>
						<div className="mb-6 flex items-center gap-3">
							<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e9e3ff] text-[#422afb]">
								<Warehouse size={20} />
							</span>
							<div>
								<h1 className="text-2xl font-bold tracking-tight text-[#1b2559]">
									Đăng nhập
								</h1>
								<p className="text-sm text-[#a3aed0]">
									Chào mừng trở lại hệ thống kho Challenge
								</p>
							</div>
						</div>

						<form onSubmit={handleSubmit} className="space-y-4">
							<div>
								<label className="mb-1.5 block text-sm font-medium text-[#2b3674]">
									Tên đăng nhập <span className="text-[#f04438]">*</span>
								</label>
								<div className="relative block">
									<input
										required
										value={username}
										onChange={e => setUsername(e.target.value)}
										placeholder="Nhập tên đăng nhập"
										autoComplete="username"
										style={{
											display: "block",
											width: "100%",
											height: 44,
											border: "1px solid #e0e5f2",
											borderRadius: 14,
											background: "#fff",
											padding: "0 12px 0 40px",
											fontSize: 14,
											color: "#2b3674",
										}}
									/>
									<UserIcon
										size={17}
										style={{
											position: "absolute",
											left: 12,
											top: "50%",
											transform: "translateY(-50%)",
											color: "#a3aed0",
											pointerEvents: "none",
										}}
									/>
								</div>
							</div>
							<div>
								<label className="mb-1.5 block text-sm font-medium text-[#2b3674]">
									Mật khẩu <span className="text-[#f04438]">*</span>
								</label>
								<div className="relative block">
									<input
										required
										type="password"
										value={password}
										onChange={e => setPassword(e.target.value)}
										placeholder="Nhập mật khẩu"
										autoComplete="current-password"
										style={{
											display: "block",
											width: "100%",
											height: 44,
											border: "1px solid #e0e5f2",
											borderRadius: 14,
											background: "#fff",
											padding: "0 12px 0 40px",
											fontSize: 14,
											color: "#2b3674",
										}}
									/>
									<Lock
										size={17}
										style={{
											position: "absolute",
											left: 12,
											top: "50%",
											transform: "translateY(-50%)",
											color: "#a3aed0",
											pointerEvents: "none",
										}}
									/>
								</div>
							</div>

							<div className="flex items-center justify-between text-sm">
								<label className="inline-flex cursor-pointer items-center gap-2 text-[#2b3674]">
									<input
										type="checkbox"
										checked={remember}
										onChange={e => setRemember(e.target.checked)}
										className="h-4 w-4 accent-[#422afb]"
									/>
									Ghi nhớ đăng nhập
								</label>
								{/* <span className="font-medium text-[#422afb]">
									Liên hệ quản trị để cấp lại
								</span> */}
							</div>

							<Button
								type="submit"
								variant="primary"
								disabled={loading}
								className="h-11 w-full text-[15px]"
							>
								{loading ? "Đang xử lý..." : "Đăng nhập"}
							</Button>

							{/* <div className="flex items-center gap-2 rounded-lg bg-[#f4f7fe] px-3 py-2.5 text-xs text-[#a3aed0]">
								<ShieldCheck size={15} className="shrink-0 text-[#12b76a]" />
								Phiên đăng nhập được bảo vệ bằng JWT và refresh token.
							</div> */}

							{/* <div className="rounded-lg border border-dashed border-[#e0e5f2] p-3 text-xs text-[#a3aed0]">
								<p className="mb-1 flex items-center gap-1.5 font-semibold text-[#2b3674]">
									<Boxes size={14} /> Tài khoản demo
								</p>
								<p>
									admin / admin123 · thu_kho / user123 · quan_ly_sx / user123
								</p>
							</div> */}
						</form>
					</div>
				</div>
			</div>
		</div>
	);
}
