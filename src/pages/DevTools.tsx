import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	AlertTriangle,
	Clock,
	Cpu,
	Database,
	GitBranch,
	HardDrive,
	Loader2,
	MemoryStick,
	Play,
	RefreshCw,
	Save,
	Search,
	Server,
	ShieldAlert,
	Table2,
	Terminal,
} from "lucide-react";
import { apiV1 } from "../lib/apiV1";
import { confirm, prompt } from "../components/ui/confirm";
import toast from "../components/ui/toast";

type Tab = "overview" | "database" | "scripts";

interface Overview {
	generatedAt: string;
	projectRoot: string;
	process: {
		pid: number;
		nodeVersion: string;
		platform: string;
		arch: string;
		env: string;
		uptimeSeconds: number;
		rssBytes: number;
		heapUsedBytes: number;
		heapTotalBytes: number;
	};
	host: {
		hostname: string;
		osType: string;
		osRelease: string;
		arch: string;
		uptimeSeconds: number;
		cpuModel: string | null;
		cpuCount: number;
		loadAverage: number[];
		totalMemoryBytes: number;
		freeMemoryBytes: number;
		usedMemoryBytes: number;
	};
	database: {
		databaseName: string | null;
		version: string | null;
		serverTime: string | null;
		tableCount: number;
		sizeBytes: number;
		host: string;
		port: number;
	};
	disks: { path: string; totalBytes: number; usedBytes: number; freeBytes: number }[] | null;
	pm2:
		| {
				name: string;
				pid: number | null;
				status: string | null;
				cpu: number;
				memoryBytes: number;
				restarts: number;
				uptimeMs: number;
				mode: string | null;
				version: string | null;
		  }[]
		| null;
	git: { commit: string; branch: string; subject: string } | null;
}

interface TableInfo {
	name: string;
	engine: string | null;
	approxRows: number;
	dataBytes: number;
	indexBytes: number;
	collation: string | null;
}

interface QueryResult {
	columns: string[];
	rows: Record<string, any>[];
	rowCount: number;
	truncated: boolean;
	durationMs: number;
	affectedRows?: number;
}

interface TableColumn {
	name: string;
	dataType: string;
	nullable: boolean;
	primaryKey: boolean;
	defaultValue: unknown;
	extra: string;
}

interface TableData {
	name: string;
	columns: TableColumn[];
	primaryKey: string[];
	rows: Record<string, any>[];
	limit: number;
	offset: number;
}

type RowEdits = Record<number, Record<string, any>>;

interface ScriptInfo {
	id: string;
	label: string;
	description: string;
	dangerous: boolean;
	confirmPhrase: string | null;
	timeoutMs: number;
	command: string;
}

interface ScriptRunResult {
	scriptId: string;
	exitCode: number | null;
	timedOut: boolean;
	durationMs: number;
	output: string;
}

const formatBytes = (value: number) => {
	if (!value) return "0 B";
	const units = ["B", "KB", "MB", "GB", "TB"];
	const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
	return `${(value / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatDuration = (seconds: number) => {
	const total = Math.max(0, Math.floor(seconds));
	const days = Math.floor(total / 86400);
	const hours = Math.floor((total % 86400) / 3600);
	const minutes = Math.floor((total % 3600) / 60);
	if (days) return `${days} ngày ${hours} giờ`;
	if (hours) return `${hours} giờ ${minutes} phút`;
	if (minutes) return `${minutes} phút`;
	return `${total} giây`;
};

const stripAnsi = (value: string) => value.replace(/\u001b\[[0-9;]*m/g, "");

const cellText = (value: any) => {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
};

const RateBar = ({ percent, tone = "primary" }: { percent: number; tone?: "primary" | "warning" | "danger" }) => {
	const color = tone === "danger" ? "#ee5d50" : tone === "warning" ? "#ffb547" : "#422afb";
	return (
		<div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#eef2fb]">
			<div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, percent))}%`, background: color }} />
		</div>
	);
};

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
	<div className="flex items-start justify-between gap-4 border-b border-[#f1f4fb] py-2 last:border-0">
		<span className="text-[12.5px] text-[#a3aed0]">{label}</span>
		<span className="max-w-[65%] break-words text-right text-[12.5px] font-semibold text-[#2b3674]">{value}</span>
	</div>
);

const DevTools = () => {
	const [tab, setTab] = useState<Tab>("overview");
	const [tableSearch, setTableSearch] = useState("");
	const [sql, setSql] = useState("SELECT * FROM `inventory_ledger` ORDER BY id DESC LIMIT 50;");
	const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
	const [queryError, setQueryError] = useState<string | null>(null);
	const [querying, setQuerying] = useState(false);
	const [tableView, setTableView] = useState<TableData | null>(null);
	const [tableLoading, setTableLoading] = useState(false);
	const [tableError, setTableError] = useState<string | null>(null);
	const [rowEdits, setRowEdits] = useState<RowEdits>({});
	const [editingCell, setEditingCell] = useState<{ row: number; column: string } | null>(null);
	const [saving, setSaving] = useState(false);
	const [runningId, setRunningId] = useState<string | null>(null);
	const [scriptResult, setScriptResult] = useState<ScriptRunResult | null>(null);
	const [scriptError, setScriptError] = useState<string | null>(null);

	const access = useQuery({
		queryKey: ["devtools-access"],
		queryFn: () => apiV1<{ allowed: boolean }>("/api/v1/devtools/access"),
		staleTime: 5 * 60_000,
		retry: false,
	});
	const allowed = access.data?.data.allowed === true;

	const overview = useQuery({
		queryKey: ["devtools-overview"],
		queryFn: () => apiV1<Overview>("/api/v1/devtools/overview"),
		enabled: allowed,
		refetchInterval: tab === "overview" ? 10_000 : false,
	});
	const tables = useQuery({
		queryKey: ["devtools-tables"],
		queryFn: () => apiV1<TableInfo[]>("/api/v1/devtools/database/tables"),
		enabled: allowed && tab === "database",
		staleTime: 60_000,
	});
	const scripts = useQuery({
		queryKey: ["devtools-scripts"],
		queryFn: () => apiV1<{ scripts: ScriptInfo[]; running: { id: string; startedAt: string } | null }>("/api/v1/devtools/scripts"),
		enabled: allowed && tab === "scripts",
		staleTime: 60_000,
	});

	useEffect(() => {
		if (overview.isError) toast.error(`Không tải được thông tin hệ thống\n${(overview.error as Error).message}`);
	}, [overview.isError, overview.error]);

	const runQuery = async (statement = sql) => {
		if (!statement.trim()) {
			toast.error("Vui lòng nhập câu lệnh SQL");
			return;
		}
		setQuerying(true);
		setQueryError(null);
		setTableView(null);
		setRowEdits({});
		setEditingCell(null);
		try {
			const response = await apiV1<QueryResult>("/api/v1/devtools/database/query", {
				method: "POST",
				body: JSON.stringify({ sql: statement }),
			});
			setQueryResult(response.data);
		} catch (error) {
			setQueryResult(null);
			setQueryError((error as Error).message);
		} finally {
			setQuerying(false);
		}
	};

	const loadTable = async (name: string) => {
		setTableLoading(true);
		setTableError(null);
		try {
			const response = await apiV1<TableData>(`/api/v1/devtools/database/tables/${encodeURIComponent(name)}?limit=100`);
			setTableView(response.data);
			setRowEdits({});
			setEditingCell(null);
			return response.data;
		} catch (error) {
			setTableView(null);
			setTableError((error as Error).message);
			return null;
		} finally {
			setTableLoading(false);
		}
	};

	const openTable = (table: TableInfo) => {
		const statement = `SELECT * FROM \`${table.name}\` LIMIT 50;`;
		setSql(statement);
		setQueryResult(null);
		setQueryError(null);
		void loadTable(table.name);
	};

	const editedRowIndexes = Object.keys(rowEdits)
		.map(Number)
		.filter(index => Object.keys(rowEdits[index] || {}).length > 0);

	const saveEdits = async () => {
		if (!tableView) return;
		if (!tableView.primaryKey.length) {
			toast.error("Bảng không có khóa chính nên không thể sửa trực tiếp");
			return;
		}
		if (!editedRowIndexes.length) {
			toast.error("Chưa có thay đổi nào để lưu");
			return;
		}
		const rowsSnapshot = tableView.rows;
		setSaving(true);
		try {
			for (const index of editedRowIndexes) {
				const changes = rowEdits[index];
				const source = rowsSnapshot[index];
				const keys: Record<string, any> = {};
				for (const primaryKey of tableView.primaryKey) {
					keys[primaryKey] = source[primaryKey];
				}
				await apiV1("/api/v1/devtools/database/row", {
					method: "POST",
					body: JSON.stringify({ table: tableView.name, keys, changes }),
				});
			}
			toast.success(`Đã lưu ${editedRowIndexes.length} dòng`);
			await loadTable(tableView.name);
		} catch (error) {
			toast.error(`Không lưu được thay đổi\n${(error as Error).message}`);
		} finally {
			setSaving(false);
		}
	};

	const runScript = async (script: ScriptInfo) => {
		let confirmText: string | undefined;
		if (script.dangerous) {
			const input = await prompt({
				title: "Xác nhận chạy script",
				message: `Nhập chính xác "${script.confirmPhrase}" để chạy: ${script.label}`,
				placeholder: script.confirmPhrase || "",
				confirmText: "Chạy script",
				tone: "danger",
			});
			if (input === null) return;
			confirmText = input;
		} else {
			const ok = await confirm({ title: "Chạy script", message: `Chạy "${script.label}"?`, tone: "primary", confirmText: "Chạy" });
			if (!ok) return;
		}

		setRunningId(script.id);
		setScriptError(null);
		try {
			const response = await apiV1<ScriptRunResult>(`/api/v1/devtools/scripts/${script.id}/run`, {
				method: "POST",
				body: JSON.stringify({ confirm: confirmText }),
			});
			setScriptResult(response.data);
			if (response.data.exitCode === 0 && !response.data.timedOut) toast.success("Script đã chạy xong");
			else toast.error(`Script kết thúc với lỗi\nExit code: ${response.data.exitCode ?? "-"}`);
		} catch (error) {
			setScriptResult(null);
			setScriptError((error as Error).message);
			toast.error(`Không chạy được script\n${(error as Error).message}`);
		} finally {
			setRunningId(null);
		}
	};

	if (access.isLoading) {
		return (
			<div className="erp-page">
				<div className="erp-card flex items-center justify-center gap-2 p-12 text-[13px] text-[#a3aed0]">
					<Loader2 className="animate-spin" size={18} /> Đang kiểm tra quyền truy cập…
				</div>
			</div>
		);
	}

	if (!allowed) {
		return (
			<div className="erp-page">
				<div className="erp-card p-10 text-center">
					<ShieldAlert className="mx-auto mb-3 text-[#ee5d50]" size={40} />
					<h2 className="text-[18px] font-bold text-[#1b2559]">Tài khoản chưa được cấp quyền Dev Tools</h2>
					<p className="mt-1 text-[13px] text-[#a3aed0]">Liên hệ quản trị viên để thêm username vào DEV_TOOLS_USERS.</p>
				</div>
			</div>
		);
	}

	const data = overview.data?.data;
	const memoryPercent = data ? (data.host.usedMemoryBytes / Math.max(1, data.host.totalMemoryBytes)) * 100 : 0;
	const filteredTables = (tables.data?.data || []).filter(table => table.name.toLowerCase().includes(tableSearch.trim().toLowerCase()));

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Developer Tools</h1>
					<p>CSDL, script vận hành và giám sát máy chủ — chỉ dành cho quản trị viên.</p>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					{data ? <span className="erp-badge bg-[#e9e3ff] text-[#3311db]">{data.process.env}</span> : null}
					<button className="erp-btn" onClick={() => overview.refetch()} disabled={overview.isFetching}>
						{overview.isFetching ? <Loader2 className="animate-spin" size={15} /> : <RefreshCw size={15} />}
						Làm mới
					</button>
				</div>
			</div>

			<div className="flex flex-wrap gap-1 border-b border-[#e9edf7]">
				{[
					{ id: "overview" as Tab, label: "Tổng quan VPS", icon: Activity },
					{ id: "database" as Tab, label: "Cơ sở dữ liệu", icon: Database },
					{ id: "scripts" as Tab, label: "Script", icon: Terminal },
				].map(item => {
					const active = tab === item.id;
					return (
						<button
							key={item.id}
							onClick={() => setTab(item.id)}
							className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13px] font-semibold transition-colors ${
								active ? "border-[#422afb] text-[#422afb]" : "border-transparent text-[#a3aed0] hover:text-[#2b3674]"
							}`}
						>
							<item.icon size={16} />
							{item.label}
						</button>
					);
				})}
			</div>

			{tab === "overview" ? (
				overview.isLoading ? (
					<div className="erp-card flex items-center justify-center gap-2 p-12 text-[13px] text-[#a3aed0]">
						<Loader2 className="animate-spin" size={18} /> Đang tải thông tin hệ thống…
					</div>
				) : overview.isError ? (
					<div className="erp-card p-8 text-center text-[13px] text-[#ee5d50]">{(overview.error as Error).message}</div>
				) : data ? (
					<>
						<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
							<div className="erp-card p-5">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-[12px] font-medium text-[#a3aed0]">CPU</p>
										<p className="mt-1 text-[22px] font-bold text-[#1b2559]">{data.host.cpuCount} nhân</p>
									</div>
									<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e9e3ff] text-[#422afb]">
										<Cpu size={20} />
									</span>
								</div>
								<p className="mt-2 truncate text-[11.5px] text-[#a3aed0]" title={data.host.cpuModel || ""}>
									{data.host.cpuModel || "Không xác định"}
								</p>
								<p className="mt-1 text-[11.5px] text-[#707eae]">Load: {data.host.loadAverage.map(value => value.toFixed(2)).join(" / ")}</p>
							</div>

							<div className="erp-card p-5">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-[12px] font-medium text-[#a3aed0]">RAM</p>
										<p className="mt-1 text-[22px] font-bold text-[#1b2559]">{memoryPercent.toFixed(0)}%</p>
									</div>
									<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e6f8f3] text-[#05cd99]">
										<MemoryStick size={20} />
									</span>
								</div>
								<RateBar percent={memoryPercent} tone={memoryPercent > 90 ? "danger" : memoryPercent > 75 ? "warning" : "primary"} />
								<p className="mt-2 text-[11.5px] text-[#707eae]">
									{formatBytes(data.host.usedMemoryBytes)} / {formatBytes(data.host.totalMemoryBytes)}
								</p>
							</div>

							<div className="erp-card p-5">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-[12px] font-medium text-[#a3aed0]">Ổ đĩa</p>
										<p className="mt-1 text-[22px] font-bold text-[#1b2559]">
											{data.disks?.length ? formatBytes(data.disks[0].freeBytes) : "—"}
										</p>
									</div>
									<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff4e5] text-[#ffb547]">
										<HardDrive size={20} />
									</span>
								</div>
								{data.disks?.length ? (
									<>
										<RateBar percent={(data.disks[0].usedBytes / Math.max(1, data.disks[0].totalBytes)) * 100} />
										<p className="mt-2 text-[11.5px] text-[#707eae]">
											Còn trống {formatBytes(data.disks[0].freeBytes)} / {formatBytes(data.disks[0].totalBytes)}
										</p>
									</>
								) : (
									<p className="mt-2 text-[11.5px] text-[#a3aed0]">Không đọc được dung lượng ổ đĩa</p>
								)}
							</div>

							<div className="erp-card p-5">
								<div className="flex items-center justify-between">
									<div>
										<p className="text-[12px] font-medium text-[#a3aed0]">CSDL</p>
										<p className="mt-1 text-[22px] font-bold text-[#1b2559]">{formatBytes(data.database.sizeBytes)}</p>
									</div>
									<span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e9e3ff] text-[#422afb]">
										<Database size={20} />
									</span>
								</div>
								<p className="mt-2 text-[11.5px] text-[#707eae]">
									{data.database.databaseName} · {data.database.tableCount} bảng
								</p>
								<p className="mt-1 truncate text-[11.5px] text-[#a3aed0]">MySQL {data.database.version}</p>
							</div>
						</div>

						<div className="grid gap-4 lg:grid-cols-2">
							<div className="erp-card p-5">
								<h2 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-[#1b2559]">
									<Server size={17} className="text-[#422afb]" /> Máy chủ
								</h2>
								<InfoRow label="Hostname" value={data.host.hostname} />
								<InfoRow label="Hệ điều hành" value={`${data.host.osType} ${data.host.osRelease} (${data.host.arch})`} />
								<InfoRow label="Uptime máy chủ" value={formatDuration(data.host.uptimeSeconds)} />
								<InfoRow label="Tiến trình Node" value={`PID ${data.process.pid} · ${data.process.nodeVersion}`} />
								<InfoRow label="Uptime ứng dụng" value={formatDuration(data.process.uptimeSeconds)} />
								<InfoRow label="RAM tiến trình" value={`${formatBytes(data.process.rssBytes)} (heap ${formatBytes(data.process.heapUsedBytes)})`} />
								<InfoRow label="Thư mục chạy" value={data.projectRoot} />
								<InfoRow
									label="Git"
									value={
										data.git ? (
											<span className="inline-flex items-center gap-1.5">
												<GitBranch size={13} /> {data.git.branch} @ {data.git.commit}
											</span>
										) : (
											"Không có"
										)
									}
								/>
								{data.git ? <p className="mt-2 truncate text-[11.5px] text-[#a3aed0]">{data.git.subject}</p> : null}
							</div>

							<div className="erp-card overflow-hidden">
								<div className="flex items-center justify-between border-b border-[#e9edf7] px-5 py-3">
									<h2 className="flex items-center gap-2 text-[14px] font-bold text-[#1b2559]">
										<Activity size={17} className="text-[#422afb]" /> PM2
									</h2>
									<span className="text-[11.5px] text-[#a3aed0]">Cập nhật mỗi 10 giây</span>
								</div>
								{data.pm2?.length ? (
									<div className="overflow-x-auto">
										<table className="erp-table">
											<thead>
												<tr>
													<th>Tiến trình</th>
													<th>Trạng thái</th>
													<th className="text-right">CPU</th>
													<th className="text-right">RAM</th>
													<th className="text-right">Restart</th>
													<th className="text-right">Uptime</th>
												</tr>
											</thead>
											<tbody>
												{data.pm2.map(process => (
													<tr key={`${process.name}-${process.pid}`}>
														<td>
															<b>{process.name}</b>
															<small>PID {process.pid || "-"}</small>
														</td>
														<td>
															<span className={`erp-badge ${process.status === "online" ? "erp-badge-success" : "erp-badge-danger"}`}>
																{process.status || "-"}
															</span>
														</td>
														<td className="text-right">{process.cpu}%</td>
														<td className="text-right">{formatBytes(process.memoryBytes)}</td>
														<td className="text-right">{process.restarts}</td>
														<td className="text-right">{formatDuration(process.uptimeMs / 1000)}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								) : (
									<div className="p-6 text-center text-[12.5px] text-[#a3aed0]">
										Không đọc được PM2 (có thể chưa cài hoặc ứng dụng không chạy bằng PM2).
									</div>
								)}
							</div>
						</div>

						<div className="erp-card p-5">
							<h2 className="mb-3 flex items-center gap-2 text-[14px] font-bold text-[#1b2559]">
								<Database size={17} className="text-[#422afb]" /> Kết nối CSDL
							</h2>
							<div className="grid gap-x-8 sm:grid-cols-2">
								<InfoRow label="Máy chủ" value={`${data.database.host}:${data.database.port}`} />
								<InfoRow label="Cơ sở dữ liệu" value={data.database.databaseName || "-"} />
								<InfoRow label="Phiên bản" value={data.database.version || "-"} />
								<InfoRow label="Thời gian máy chủ" value={data.database.serverTime ? new Date(data.database.serverTime).toLocaleString("vi-VN") : "-"} />
								<InfoRow label="Dung lượng" value={formatBytes(data.database.sizeBytes)} />
								<InfoRow label="Số bảng" value={data.database.tableCount} />
							</div>
						</div>
					</>
				) : null
			) : null}

			{tab === "database" ? (
				<div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
					<div className="erp-card flex max-h-[720px] min-h-[420px] flex-col overflow-hidden">
						<div className="border-b border-[#e9edf7] p-3">
							<div className="relative">
								<Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#a3aed0]" />
								<input
									className="!pl-10"
									placeholder="Tìm bảng…"
									value={tableSearch}
									onChange={event => setTableSearch(event.target.value)}
								/>
							</div>
						</div>
						<div className="custom-scrollbar flex-1 overflow-y-auto p-2">
							{tables.isLoading ? (
								<div className="flex items-center justify-center gap-2 p-6 text-[12.5px] text-[#a3aed0]">
									<Loader2 className="animate-spin" size={16} /> Đang tải…
								</div>
							) : tables.isError ? (
								<div className="p-4 text-[12.5px] text-[#ee5d50]">{(tables.error as Error).message}</div>
							) : filteredTables.length ? (
								filteredTables.map(table => (
									<button
										key={table.name}
										onClick={() => openTable(table)}
										className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[#f4f7fe]"
									>
										<Table2 size={14} className="shrink-0 text-[#a3aed0]" />
										<span className="min-w-0 flex-1">
											<span className="block truncate text-[12.5px] font-semibold text-[#2b3674]">{table.name}</span>
											<span className="block text-[10.5px] text-[#a3aed0]">
												≈ {table.approxRows.toLocaleString("vi-VN")} dòng · {formatBytes(table.dataBytes + table.indexBytes)}
											</span>
										</span>
									</button>
								))
							) : (
								<p className="p-4 text-center text-[12.5px] text-[#a3aed0]">Không có bảng phù hợp</p>
							)}
						</div>
						<div className="border-t border-[#e9edf7] px-3 py-2 text-[11px] text-[#a3aed0]">
							{tables.data?.data.length || 0} bảng · bấm để xem &amp; sửa dữ liệu
						</div>
					</div>

					<div className="flex min-w-0 flex-col gap-4">
						<div className="erp-card overflow-hidden">
							<div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e9edf7] px-4 py-3">
								<div>
									<h2 className="flex items-center gap-2 text-[14px] font-bold text-[#1b2559]">
										<Terminal size={17} className="text-[#422afb]" /> SQL Console
									</h2>
									<p className="text-[11.5px] text-[#a3aed0]">SELECT / SHOW / DESCRIBE / EXPLAIN và INSERT / UPDATE / DELETE / REPLACE · nhiều câu lệnh cách nhau bởi dấu ; · tối đa 1.000 dòng</p>
								</div>
								<button className="erp-btn erp-btn-primary" onClick={() => void runQuery()} disabled={querying}>
									{querying ? <Loader2 className="animate-spin" size={15} /> : <Play size={15} />}
									Chạy (Ctrl+Enter)
								</button>
							</div>
							<textarea
								value={sql}
								onChange={event => setSql(event.target.value)}
								onKeyDown={event => {
									if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
										event.preventDefault();
										void runQuery();
									}
								}}
								spellCheck={false}
								className="min-h-[170px] rounded-none border-0 font-mono !text-[13px]"
							/>
						</div>

						{queryError ? (
							<div className="erp-card flex items-start gap-2 border border-[#fde3e3] bg-[#fff7f7] p-4 text-[12.5px] text-[#c02626]">
								<AlertTriangle className="mt-0.5 shrink-0" size={16} /> {queryError}
							</div>
						) : null}

						<div className="erp-card overflow-hidden">
							<div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e9edf7] px-4 py-3">
								<div>
									<h2 className="text-[14px] font-bold text-[#1b2559]">
										{tableView ? `Dữ liệu bảng ${tableView.name}` : "Kết quả"}
									</h2>
									{tableView ? (
										<p className="text-[11.5px] text-[#a3aed0]">
											Bấm vào ô để sửa · nhập NULL để xóa giá trị · khóa chính: {tableView.primaryKey.join(", ") || "không có"}
										</p>
									) : null}
								</div>
								{tableView ? (
									<div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[#a3aed0]">
										<span className="erp-badge bg-[#e9e3ff] text-[#3311db]">{tableView.rows.length.toLocaleString("vi-VN")} dòng</span>
										{editedRowIndexes.length ? (
											<span className="text-[#b45309]">{editedRowIndexes.length} dòng đã sửa</span>
										) : null}
										<button
											className="erp-btn erp-btn-primary"
											onClick={() => void saveEdits()}
											disabled={saving || !editedRowIndexes.length}
										>
											{saving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
											{saving ? "Đang lưu…" : "Lưu thay đổi"}
										</button>
									</div>
								) : queryResult ? (
									<div className="flex flex-wrap items-center gap-2 text-[11.5px] text-[#a3aed0]">
										{queryResult.rows.length ? (
											<span className="erp-badge bg-[#e9e3ff] text-[#3311db]">{queryResult.rowCount.toLocaleString("vi-VN")} dòng</span>
										) : (
											<span className="erp-badge bg-[#e6f8f3] text-[#059669]">{queryResult.affectedRows ?? 0} dòng bị ảnh hưởng</span>
										)}
										<span className="inline-flex items-center gap-1">
											<Clock size={12} /> {queryResult.durationMs} ms
										</span>
										{queryResult.truncated ? <span className="text-[#ffb547]">Đã giới hạn 1.000 dòng</span> : null}
									</div>
								) : null}
							</div>
							{tableView ? (
								tableLoading ? (
									<div className="flex items-center justify-center gap-2 p-10 text-[13px] text-[#a3aed0]">
										<Loader2 className="animate-spin" size={18} /> Đang tải dữ liệu bảng…
									</div>
								) : tableError ? (
									<div className="p-8 text-center text-[12.5px] text-[#ee5d50]">{tableError}</div>
								) : tableView.rows.length ? (
									<div className="max-h-[520px] overflow-auto">
										<table className="erp-table">
											<thead>
												<tr>
													{tableView.columns.map(column => (
														<th key={column.name}>
															{column.name}
															{column.primaryKey ? <span className="ml-1 text-[#422afb]">*</span> : null}
														</th>
													))}
												</tr>
											</thead>
											<tbody>
												{tableView.rows.map((row, index) => (
													<tr key={index}>
														{tableView.columns.map(column => {
															const edited = Object.prototype.hasOwnProperty.call(rowEdits[index] || {}, column.name);
															const value = edited ? rowEdits[index][column.name] : row[column.name];
															const isEditing = editingCell?.row === index && editingCell.column === column.name;
															const text = cellText(value);
															return (
																<td
																	key={column.name}
																	className={`cursor-text ${edited ? "bg-[#fff8e6]" : ""}`}
																	title={tableView.primaryKey.length ? "Bấm để sửa" : "Bảng không có khóa chính"}
																	onClick={() => {
																		if (tableView.primaryKey.length) setEditingCell({ row: index, column: column.name });
																	}}
																>
																	{isEditing ? (
																		<input
																			autoFocus
																			value={value === null || value === undefined ? "" : String(value)}
																			placeholder="NULL"
																			className="!h-7 !min-h-0 !px-1.5 !py-0 font-mono !text-[11.5px]"
																			onChange={event =>
																				setRowEdits(previous => ({
																					...previous,
																					[index]: { ...(previous[index] || {}), [column.name]: event.target.value },
																				}))
																			}
																			onClick={event => event.stopPropagation()}
																			onBlur={() => setEditingCell(null)}
																			onKeyDown={event => {
																				if (event.key === "Enter" || event.key === "Escape") {
																					event.preventDefault();
																					setEditingCell(null);
																				}
																			}}
																		/>
																	) : (
																		<span className="block max-w-[360px] truncate font-mono text-[11.5px]" title={text}>
																			{value === null || value === undefined ? <em className="text-[#a3aed0]">NULL</em> : text}
																		</span>
																	)}
																</td>
															);
														})}
													</tr>
												))}
											</tbody>
										</table>
									</div>
								) : (
									<div className="p-8 text-center text-[12.5px] text-[#a3aed0]">Bảng không có dữ liệu.</div>
								)
							) : querying ? (
								<div className="flex items-center justify-center gap-2 p-10 text-[13px] text-[#a3aed0]">
									<Loader2 className="animate-spin" size={18} /> Đang chạy truy vấn…
								</div>
							) : queryResult ? (
								queryResult.rows.length ? (
									<div className="max-h-[520px] overflow-auto">
										<table className="erp-table">
											<thead>
												<tr>
													{queryResult.columns.map(column => (
														<th key={column}>{column}</th>
													))}
												</tr>
											</thead>
											<tbody>
												{queryResult.rows.map((row, index) => (
													<tr key={index}>
														{queryResult.columns.map(column => {
															const text = cellText(row[column]);
															return (
																<td key={column}>
																	<span className="block max-w-[360px] truncate font-mono text-[11.5px]" title={text}>
																		{row[column] === null || row[column] === undefined ? <em className="text-[#a3aed0]">NULL</em> : text}
																	</span>
																</td>
															);
														})}
													</tr>
												))}
											</tbody>
										</table>
									</div>
								) : (
									<div className="p-8 text-center text-[12.5px] text-[#a3aed0]">
										{queryResult.affectedRows !== undefined ? `Đã thực thi, ${queryResult.affectedRows} dòng bị ảnh hưởng.` : "Truy vấn không trả về dòng nào."}
									</div>
								)
							) : (
								<div className="p-8 text-center text-[12.5px] text-[#a3aed0]">Chọn một bảng bên trái hoặc nhập câu lệnh SQL để bắt đầu.</div>
							)}
						</div>
					</div>
				</div>
			) : null}

			{tab === "scripts" ? (
				<div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
					<div className="erp-card overflow-hidden">
						<div className="border-b border-[#e9edf7] px-4 py-3">
							<h2 className="text-[14px] font-bold text-[#1b2559]">Script vận hành</h2>
							<p className="text-[11.5px] text-[#a3aed0]">Chạy trên máy chủ đang phục vụ ứng dụng. Chỉ ADMIN được phép.</p>
						</div>
						<div className="divide-y divide-[#f1f4fb]">
							{scripts.isLoading ? (
								<div className="flex items-center justify-center gap-2 p-10 text-[13px] text-[#a3aed0]">
									<Loader2 className="animate-spin" size={18} /> Đang tải…
								</div>
							) : scripts.isError ? (
								<div className="p-5 text-[12.5px] text-[#ee5d50]">{(scripts.error as Error).message}</div>
							) : (
								(scripts.data?.data.scripts || []).map(script => (
									<div key={script.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-4">
										<div className="min-w-0 flex-1">
											<div className="flex flex-wrap items-center gap-2">
												<h3 className="text-[13.5px] font-bold text-[#1b2559]">{script.label}</h3>
												{script.dangerous ? (
													<span className="erp-badge bg-[#fde3e3] text-[#c02626]">
														<ShieldAlert size={11} /> Nguy hiểm
													</span>
												) : (
													<span className="erp-badge bg-[#e6f8f3] text-[#059669]">An toàn</span>
												)}
											</div>
											<p className="mt-1 text-[12px] text-[#707eae]">{script.description}</p>
											<code className="mt-1.5 block truncate rounded-lg bg-[#f4f7fe] px-2 py-1 text-[11px] text-[#2b3674]">{script.command}</code>
										</div>
										<button
											className={`erp-btn ${script.dangerous ? "erp-btn-danger" : "erp-btn-primary"}`}
											onClick={() => void runScript(script)}
											disabled={!!runningId}
										>
											{runningId === script.id ? <Loader2 className="animate-spin" size={15} /> : <Play size={15} />}
											{runningId === script.id ? "Đang chạy…" : "Chạy"}
										</button>
									</div>
								))
							)}
						</div>
					</div>

					<div className="erp-card flex min-h-[420px] flex-col overflow-hidden">
						<div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e9edf7] px-4 py-3">
							<h2 className="flex items-center gap-2 text-[14px] font-bold text-[#1b2559]">
								<Terminal size={17} className="text-[#422afb]" /> Kết quả
							</h2>
							{scriptResult ? (
								<div className="flex flex-wrap items-center gap-2 text-[11.5px]">
									<span className={`erp-badge ${scriptResult.exitCode === 0 && !scriptResult.timedOut ? "erp-badge-success" : "erp-badge-danger"}`}>
										{scriptResult.timedOut ? "Hết thời gian" : `Exit ${scriptResult.exitCode ?? "-"}`}
									</span>
									<span className="text-[#a3aed0]">{(scriptResult.durationMs / 1000).toFixed(1)} giây</span>
								</div>
							) : null}
						</div>
						{scriptError ? (
							<div className="m-4 flex items-start gap-2 rounded-xl border border-[#fde3e3] bg-[#fff7f7] p-3 text-[12.5px] text-[#c02626]">
								<AlertTriangle className="mt-0.5 shrink-0" size={16} /> {scriptError}
							</div>
						) : null}
						<pre className="custom-scrollbar m-4 flex-1 overflow-auto whitespace-pre-wrap rounded-2xl bg-[#0b1020] p-4 font-mono text-[12px] leading-relaxed text-[#d7e0ff]">
							{scriptResult ? stripAnsi(scriptResult.output) : "Chọn một script và bấm Chạy để xem output."}
						</pre>
					</div>
				</div>
			) : null}
		</div>
	);
};

export default DevTools;
