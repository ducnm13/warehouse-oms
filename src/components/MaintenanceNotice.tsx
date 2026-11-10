import { RefreshCw, Settings, Wrench } from "lucide-react";

interface MaintenanceNoticeProps {
	message?: string;
	onDevTools?: () => void;
}

export default function MaintenanceNotice({
	message,
	onDevTools,
}: MaintenanceNoticeProps) {
	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#f4f7fe] p-6">
			<div className="w-full max-w-xl rounded-3xl border border-[#e9edf7] bg-white p-8 text-center shadow-[0_25px_60px_-20px_rgba(27,37,89,0.35)] sm:p-10">
				<div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-[#fff4e5] text-[#ffb547]">
					<Wrench size={36} />
				</div>
				<span className="inline-flex items-center rounded-full bg-[#fff4e5] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[#b45309]">
					Đang bảo trì
				</span>
				<h1 className="mt-4 text-2xl font-black text-[#1b2559]">
					Hệ thống đang bảo trì
				</h1>
				<p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#707eae]">
					{message ||
						"Hệ thống đang được cập nhật để nâng cao chất lượng dịch vụ. Vui lòng quay lại sau ít phút."}
				</p>
				<div className="mt-6 flex flex-wrap justify-center gap-2.5">
					<button
						type="button"
						className="erp-btn erp-btn-primary"
						onClick={() => window.location.reload()}
					>
						<RefreshCw size={16} /> Thử lại
					</button>
					{onDevTools && (
						<button type="button" className="erp-btn" onClick={onDevTools}>
							<Settings size={16} /> Mở Dev Tools
						</button>
					)}
				</div>
				<p className="mt-6 text-[11.5px] text-[#a3aed0]">
					Lịch bảo trì: liên hệ quản trị viên nếu cần hỗ trợ khẩn cấp.
				</p>
			</div>
		</div>
	);
}
