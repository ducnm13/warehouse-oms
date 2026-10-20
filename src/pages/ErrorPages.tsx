import React from "react";
import { AlertTriangle, ArrowLeft, CloudOff, Home, SearchX, ServerCrash } from "lucide-react";
import Button from "../components/ui/button";

interface ErrorPageProps {
	code: "404" | "500" | "503";
	title: string;
	description: string;
	onHome: () => void;
	onBack?: () => void;
}

function ErrorShell({ code, title, description, onHome, onBack, icon }: ErrorPageProps & { icon: React.ReactNode }) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-white">
			<div className="absolute inset-0 bg-black/50" />
			<div className="relative w-full max-w-xl rounded-2xl border border-[#e9edf7] bg-white p-10 text-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]">
				<div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e9e3ff] text-[#422afb]">
					{icon}
				</div>
				<p className="text-6xl font-extrabold tracking-tight text-[#1b2559]">{code}</p>
				<h1 className="mt-3 text-xl font-bold text-[#1b2559]">{title}</h1>
				<p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#a3aed0]">{description}</p>
				<div className="mt-6 flex flex-wrap justify-center gap-2.5">
					{onBack && (
						<Button variant="outline" onClick={onBack}>
							<ArrowLeft size={16} /> Quay lại
						</Button>
					)}
					<Button variant="primary" onClick={onHome}>
						<Home size={16} /> Về trang tổng quan
					</Button>
				</div>
			</div>
		</div>
	);
}

export function NotFoundPage({ onHome, onBack }: { onHome: () => void; onBack?: () => void }) {
	return (
		<ErrorShell
			code="404"
			title="Không tìm thấy trang"
			description="Địa chỉ bạn truy cập không tồn tại hoặc đã bị di chuyển. Kiểm tra lại menu điều hướng hoặc quay về trang tổng quan."
			onHome={onHome}
			onBack={onBack}
			icon={<SearchX size={28} />}
		/>
	);
}

export function ServerErrorPage({ onHome, onBack }: { onHome: () => void; onBack?: () => void }) {
	return (
		<ErrorShell
			code="500"
			title="Lỗi máy chủ nội bộ"
			description="Hệ thống gặp sự cố bất ngờ khi xử lý yêu cầu. Thao tác của bạn đã được ghi log, vui lòng thử lại sau ít phút."
			onHome={onHome}
			onBack={onBack}
			icon={<ServerCrash size={28} />}
		/>
	);
}

export function MaintenancePage({ onHome, onBack }: { onHome: () => void; onBack?: () => void }) {
	return (
		<ErrorShell
			code="503"
			title="Hệ thống đang bảo trì"
			description="Máy chủ kho tạm ngừng để nâng cấp dữ liệu. Vui lòng quay lại sau hoặc liên hệ quản trị viên nếu cần xử lý gấp."
			onHome={onHome}
			onBack={onBack}
			icon={<CloudOff size={28} />}
		/>
	);
}

export function PermissionDeniedPage({ onHome, onBack }: { onHome: () => void; onBack?: () => void }) {
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-white">
			<div className="absolute inset-0 bg-black/50" />
			<div className="relative w-full max-w-lg rounded-2xl border border-[#fedf89] bg-[#fffaeb] p-8 text-center shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)]">
				<div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#dc6803] shadow-sm">
					<AlertTriangle size={26} />
				</div>
				<h1 className="text-lg font-bold text-[#1b2559]">Không có quyền truy cập</h1>
				<p className="mx-auto mt-2 max-w-md text-sm text-[#a3aed0]">Tài khoản của bạn thiếu quyền cho chức năng này. Liên hệ quản trị viên để được phân quyền phù hợp.</p>
				<div className="mt-5 flex flex-wrap justify-center gap-2.5">
					{onBack && <Button variant="outline" onClick={onBack}><ArrowLeft size={16} /> Quay lại</Button>}
					<Button variant="primary" onClick={onHome}><Home size={16} /> Về trang tổng quan</Button>
				</div>
			</div>
		</div>
	);
}
