import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, X } from "lucide-react";
import { apiV1 } from "../lib/apiV1";

export interface EntityHistoryChange {
	field: string;
	label: string;
	oldValue: unknown;
	newValue: unknown;
}

export interface EntityHistoryRow {
	id: number;
	action: string;
	details: string | null;
	entityType: string | null;
	entityId: string | null;
	entityCode: string | null;
	changes: EntityHistoryChange[];
	userName: string | null;
	username: string | null;
	role: string | null;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: string | null;
}

const displayValue = (value: unknown) => {
	if (value === null || value === undefined || value === "") return "—";
	if (typeof value === "boolean") return value ? "Có" : "Không";
	return String(value);
};

const formatTime = (iso: string | null) => {
	if (!iso) return "—";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return iso;
	return date.toLocaleString("vi-VN", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
};

export function EntityHistoryModal({
	entityType,
	entityId,
	entityCode,
	onClose,
}: {
	entityType: string;
	entityId: string | number;
	entityCode?: string | null;
	onClose: () => void;
}) {
	const query = useQuery({
		queryKey: ["entity-history", entityType, String(entityId)],
		queryFn: () =>
			apiV1<EntityHistoryRow[]>(
				`/api/v1/audit-logs/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(String(entityId))}?limit=200`,
			),
	});

	const rows = query.data?.data || [];

	return (
		<div className="erp-modal-backdrop" style={{ zIndex: 320 }} onClick={onClose}>
			<div className="erp-modal max-w-4xl" onClick={event => event.stopPropagation()}>
				<div className="erp-modal-header">
					<div>
						<h2>Lịch sử thay đổi</h2>
						<p>
							{entityCode ? `${entityCode} · ` : ""}
							{entityType} #{entityId}
						</p>
					</div>
					<button onClick={onClose}>
						<X />
					</button>
				</div>
				<div className="erp-modal-body space-y-3">
					{query.isLoading ? (
						<p className="py-10 text-center text-sm font-bold uppercase tracking-widest text-slate-400">
							Đang tải lịch sử...
						</p>
					) : query.isError ? (
						<p className="py-10 text-center text-sm font-bold text-red-500">
							Không tải được lịch sử: {(query.error as Error)?.message}
						</p>
					) : rows.length === 0 ? (
						<div className="py-12 text-center">
							<History className="mx-auto mb-3 text-slate-200" size={40} />
							<p className="text-sm font-black uppercase tracking-widest text-slate-400">
								Chưa có lịch sử
							</p>
						</div>
					) : (
						rows.map(row => (
							<div key={row.id} className="rounded-[14px] border border-[#e9edf7] bg-white p-4">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<span className="erp-badge bg-[#e9e3ff] text-[#3311db]">{row.action}</span>
									<span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
										{formatTime(row.createdAt)}
									</span>
								</div>
								<p className="mt-2 text-xs font-semibold text-slate-600">
									{row.userName || row.username || "—"}
									{row.ipAddress ? ` · IP ${row.ipAddress}` : ""}
								</p>
								{row.details && (
									<p className="mt-1 whitespace-pre-wrap break-words text-xs font-medium text-slate-500">
										{row.details}
									</p>
								)}
								{row.changes.length > 0 && (
									<div className="mt-3 overflow-x-auto">
										<table className="w-full text-left text-xs">
											<thead>
												<tr className="border-b border-[#e9edf7]">
													<th className="py-1.5 pr-3 font-black uppercase tracking-wider text-slate-400">Trường</th>
													<th className="py-1.5 pr-3 font-black uppercase tracking-wider text-slate-400">Trước</th>
													<th className="py-1.5 font-black uppercase tracking-wider text-slate-400">Sau</th>
												</tr>
											</thead>
											<tbody>
												{row.changes.map((change, index) => (
													<tr key={`${change.field}-${index}`} className="border-b border-[#f1f4fb] last:border-0">
														<td className="py-1.5 pr-3 align-top">
															<span className="block font-bold text-slate-700">{change.label}</span>
															<span className="block font-mono text-[10px] text-slate-400">{change.field}</span>
														</td>
														<td className="py-1.5 pr-3 align-top font-semibold text-[#d14343]">
															{displayValue(change.oldValue)}
														</td>
														<td className="py-1.5 align-top font-semibold text-[#05a660]">
															{displayValue(change.newValue)}
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</div>
						))
					)}
				</div>
				<div className="erp-modal-footer">
					<button className="erp-btn" onClick={onClose}>
						Đóng
					</button>
				</div>
			</div>
		</div>
	);
}

export function EntityHistoryButton({
	entityType,
	entityId,
	entityCode,
	className = "erp-btn",
	label = "Lịch sử",
}: {
	entityType: string;
	entityId: string | number;
	entityCode?: string | null;
	className?: string;
	label?: string;
}) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button type="button" className={className} onClick={() => setOpen(true)}>
				<History size={14} /> {label}
			</button>
			{open && (
				<EntityHistoryModal
					entityType={entityType}
					entityId={entityId}
					entityCode={entityCode}
					onClose={() => setOpen(false)}
				/>
			)}
		</>
	);
}
