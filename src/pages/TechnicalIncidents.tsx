import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useReactToPrint } from "react-to-print";
import {
	AlertTriangle,
	Ban,
	CheckCircle2,
	Clock3,
	Download,
	Edit,
	Eye,
	ImagePlus,
	Images,
	Plus,
	Printer,
	Search,
	Trash2,
	Wrench,
	X,
} from "lucide-react";
import toast from "../components/ui/toast";
import { confirm } from "../components/ui/confirm";
import { apiV1 } from "../lib/apiV1";
import { formatNumber } from "../lib/utils";
import { exportExcelFile } from "../lib/excelExport";
import { useMultiEscapeKey } from "../hooks/useEscapeKey";
import { useCanViewMoney } from "../hooks/useCanViewMoney";
import {
	buildCompanyPrintProfile,
	type CompanyPrintProfile,
} from "../lib/printTemplate";
import {
	formatIncidentTime,
	TECHNICAL_CATEGORY_META,
	TECHNICAL_SEVERITY_META,
	TECHNICAL_STATUS_META,
	toDateTimeLocalInput,
} from "../lib/technicalIncident";
import type {
	TechnicalIncidentAssigneeV1,
	TechnicalIncidentCategory,
	TechnicalIncidentImageV1,
	TechnicalIncidentSeverity,
	TechnicalIncidentStatus,
	TechnicalIncidentSummaryV1,
	TechnicalIncidentV1,
} from "../types";
import ListToolbar from "../components/ListToolbar";
import type { FilterField, FilterValues } from "../components/FilterDrawer";
import TableActions from "../components/TableActions";
import { EntityHistoryButton } from "../components/EntityHistoryButton";
import { TechnicalIncidentDocument } from "../components/TechnicalIncidentDocument";

type FormState = {
	code: string;
	title: string;
	equipmentName: string;
	location: string;
	category: TechnicalIncidentCategory;
	severity: TechnicalIncidentSeverity;
	status: TechnicalIncidentStatus;
	occurredAt: string;
	assigneeId: number | null;
	assigneeName: string;
	cause: string;
	solution: string;
	cost: number;
	note: string;
};

const emptyForm = (code = ""): FormState => ({
	code,
	title: "",
	equipmentName: "",
	location: "",
	category: "REPAIR",
	severity: "MEDIUM",
	status: "OPEN",
	occurredAt: toDateTimeLocalInput(new Date().toISOString()),
	assigneeId: null,
	assigneeName: "",
	cause: "",
	solution: "",
	cost: 0,
	note: "",
});

const formFromDetail = (doc: TechnicalIncidentV1): FormState => ({
	code: doc.code,
	title: doc.title,
	equipmentName: doc.equipmentName || "",
	location: doc.location || "",
	category: doc.category,
	severity: doc.severity,
	status: doc.status,
	occurredAt: toDateTimeLocalInput(doc.occurredAt),
	assigneeId: doc.assigneeId,
	assigneeName: doc.assigneeName || "",
	cause: doc.cause || "",
	solution: doc.solution || "",
	cost: Number(doc.cost || 0),
	note: doc.note || "",
});

const MAX_IMAGES = 12;
const MAX_IMAGE_PAYLOAD = 8_500_000;

const FILTER_FIELDS: FilterField[] = [
	{
		type: "select",
		key: "status",
		label: "Trạng thái",
		options: [
			{ value: "OPEN", label: "Mới tiếp nhận" },
			{ value: "IN_PROGRESS", label: "Đang xử lý" },
			{ value: "RESOLVED", label: "Đã hoàn tất" },
			{ value: "CANCELLED", label: "Đã hủy" },
		],
	},
	{
		type: "select",
		key: "severity",
		label: "Mức độ",
		options: [
			{ value: "LOW", label: "Thấp" },
			{ value: "MEDIUM", label: "Trung bình" },
			{ value: "HIGH", label: "Cao" },
			{ value: "CRITICAL", label: "Nghiêm trọng" },
		],
	},
	{
		type: "select",
		key: "category",
		label: "Loại sự cố",
		options: [
			{ value: "REPAIR", label: "Sửa chữa" },
			{ value: "MAINTENANCE", label: "Bảo dưỡng" },
			{ value: "INSPECTION", label: "Kiểm tra" },
			{ value: "OTHER", label: "Khác" },
		],
	},
	{
		type: "dateRange",
		key: "occurredAt",
		label: "Thời gian xảy ra",
		fromKey: "occurredFrom",
		toKey: "occurredTo",
	},
];

const buildIncidentListParams = (
	pageNumber: number,
	limit: number,
	search: string,
	filters: FilterValues,
) => {
	const params = new URLSearchParams({
		page: String(pageNumber),
		limit: String(limit),
	});
	if (search.trim()) params.set("search", search.trim());
	if (filters.status) params.set("status", filters.status);
	if (filters.severity) params.set("severity", filters.severity);
	if (filters.category) params.set("category", filters.category);
	if (filters.occurredFrom) params.set("from", filters.occurredFrom);
	if (filters.occurredTo) params.set("to", filters.occurredTo);
	return params.toString();
};

const compressImage = (file: File) =>
	new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error("Không đọc được tệp ảnh"));
		reader.onload = () => {
			const image = new Image();
			image.onerror = () => reject(new Error("Ảnh không hợp lệ hoặc không hỗ trợ"));
			image.onload = () => {
				const maxSize = 1600;
				const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
				const canvas = document.createElement("canvas");
				canvas.width = Math.max(1, Math.round(image.width * scale));
				canvas.height = Math.max(1, Math.round(image.height * scale));
				const context = canvas.getContext("2d");
				if (!context) {
					resolve(String(reader.result));
					return;
				}
				context.drawImage(image, 0, 0, canvas.width, canvas.height);
				resolve(canvas.toDataURL("image/jpeg", 0.82));
			};
			image.src = String(reader.result);
		};
		reader.readAsDataURL(file);
	});

export default function TechnicalIncidents() {
	const qc = useQueryClient();
	const canViewMoney = useCanViewMoney();
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [filters, setFilters] = useState<FilterValues>({});
	const [open, setOpen] = useState(false);
	const [editing, setEditing] = useState<TechnicalIncidentV1 | null>(null);
	const [selected, setSelected] = useState<TechnicalIncidentV1 | null>(null);
	const [printTarget, setPrintTarget] = useState<TechnicalIncidentV1 | null>(null);
	const [lightbox, setLightbox] = useState<TechnicalIncidentImageV1 | null>(null);
	const [form, setForm] = useState<FormState>(emptyForm());
	const [images, setImages] = useState<TechnicalIncidentImageV1[]>([]);
	const [originalImageIds, setOriginalImageIds] = useState<number[]>([]);
	const [detailLoading, setDetailLoading] = useState(false);
	const [exporting, setExporting] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const printRef = useRef<HTMLDivElement>(null);

	const handlePrint = useReactToPrint({
		contentRef: printRef,
		documentTitle: printTarget
			? `Phieu-su-co-ky-thuat-${printTarget.code}`
			: "Phieu-su-co-ky-thuat",
		pageStyle: "@page { size: A4; margin: 0; }",
	});

	useMultiEscapeKey([
		{ isOpen: open, onClose: () => closeForm(), priority: 1 },
		{ isOpen: !!selected, onClose: () => setSelected(null), priority: 2 },
		{ isOpen: !!printTarget, onClose: () => setPrintTarget(null), priority: 3 },
		{ isOpen: !!lightbox, onClose: () => setLightbox(null), priority: 4 },
	]);

	const nextCode = useQuery({
		queryKey: ["technical-incident-next-code"],
		queryFn: async () => {
			const response = await apiV1<{ code: string }>(
				"/api/v1/next-code/technical_incident",
			);
			return response.data?.code || "";
		},
		staleTime: 10_000,
		retry: false,
	});

	const assignees = useQuery({
		queryKey: ["technical-incident-assignees"],
		queryFn: () =>
			apiV1<TechnicalIncidentAssigneeV1[]>(
				"/api/v1/technical-incidents/assignees",
			),
		staleTime: 5 * 60_000,
	});

	const summary = useQuery({
		queryKey: ["technical-incidents-summary"],
		queryFn: () =>
			apiV1<TechnicalIncidentSummaryV1>("/api/v1/technical-incidents/summary"),
	});

	const queryString = useMemo(
		() => buildIncidentListParams(page, 20, search, filters),
		[page, search, filters],
	);

	const documents = useQuery({
		queryKey: ["technical-incidents", queryString],
		queryFn: () =>
			apiV1<TechnicalIncidentV1[]>(
				`/api/v1/technical-incidents?${queryString}`,
			),
	});

	const companyQuery = useQuery({
		queryKey: ["company-profile"],
		queryFn: async () => {
			try {
				const response = await apiV1<any>("/api/v1/company");
				return buildCompanyPrintProfile(response.data);
			} catch {
				return null as CompanyPrintProfile | null;
			}
		},
	});

	const invalidate = () =>
		Promise.all([
			qc.invalidateQueries({ queryKey: ["technical-incidents"] }),
			qc.invalidateQueries({ queryKey: ["technical-incidents-summary"] }),
			qc.invalidateQueries({ queryKey: ["technical-incident-next-code"] }),
		]);

	function closeForm() {
		setOpen(false);
		setEditing(null);
		setImages([]);
		setOriginalImageIds([]);
		setForm(emptyForm());
	}

	const create = () => {
		setEditing(null);
		setImages([]);
		setOriginalImageIds([]);
		setForm(emptyForm(nextCode.data || ""));
		setOpen(true);
	};

	const startEdit = async (document: TechnicalIncidentV1) => {
		try {
			const response = await apiV1<TechnicalIncidentV1>(
				`/api/v1/technical-incidents/${document.id}`,
			);
			const detail = response.data;
			setSelected(null);
			setEditing(detail);
			setForm(formFromDetail(detail));
			setImages(detail.images || []);
			setOriginalImageIds(
				(detail.images || [])
					.map(image => image.id)
					.filter((id): id is number => typeof id === "number"),
			);
			setOpen(true);
		} catch (error) {
			toast.error((error as Error).message);
		}
	};

	const view = async (document: TechnicalIncidentV1) => {
		setSelected(document);
		setDetailLoading(true);
		try {
			const response = await apiV1<TechnicalIncidentV1>(
				`/api/v1/technical-incidents/${document.id}`,
			);
			setSelected(response.data);
		} catch (error) {
			toast.error((error as Error).message);
		} finally {
			setDetailLoading(false);
		}
	};

	const viewForPrint = async (document: TechnicalIncidentV1) => {
		try {
			const response = await apiV1<TechnicalIncidentV1>(
				`/api/v1/technical-incidents/${document.id}`,
			);
			setPrintTarget(response.data);
		} catch (error) {
			toast.error((error as Error).message);
		}
	};

	const save = useMutation({
		mutationFn: () => {
			if (!form.title.trim()) throw new Error("Nhập tên sự cố");
			const occurred = new Date(form.occurredAt);
			if (Number.isNaN(occurred.getTime()))
				throw new Error("Thời gian xảy ra không hợp lệ");
			const newImages = images
				.filter(image => !image.id && image.dataUrl)
				.map(image => ({
					fileName: image.fileName,
					mimeType: image.mimeType,
					size: image.size,
					dataUrl: image.dataUrl as string,
				}));
			const payload = {
				code: form.code,
				title: form.title,
				equipmentName: form.equipmentName,
				location: form.location,
				category: form.category,
				severity: form.severity,
				status: form.status,
				occurredAt: occurred.toISOString(),
				assigneeId: form.assigneeId || null,
				assigneeName: form.assigneeName,
				cause: form.cause,
				solution: form.solution,
				cost: canViewMoney
					? Number(form.cost) || 0
					: Number(editing?.cost || 0),
				note: form.note,
				images: newImages,
			};
			if (editing) {
				const removeImageIds = originalImageIds.filter(
					id => !images.some(image => image.id === id),
				);
				return apiV1<TechnicalIncidentV1>(
					`/api/v1/technical-incidents/${editing.id}`,
					{
						method: "PUT",
						body: JSON.stringify({
							...payload,
							version: editing.version,
							removeImageIds,
						}),
					},
				);
			}
			return apiV1<TechnicalIncidentV1>("/api/v1/technical-incidents", {
				method: "POST",
				body: JSON.stringify(payload),
			});
		},
		onSuccess: response => {
			toast.success(response.message);
			const saved = response.data;
			closeForm();
			if (saved?.id) setSelected(saved);
			void invalidate();
		},
		onError: error => toast.error((error as Error).message),
	});

	const changeStatus = useMutation({
		mutationFn: (input: {
			document: TechnicalIncidentV1;
			status: TechnicalIncidentStatus;
		}) =>
			apiV1<TechnicalIncidentV1>(
				`/api/v1/technical-incidents/${input.document.id}/status`,
				{
					method: "POST",
					body: JSON.stringify({
						version: input.document.version,
						status: input.status,
					}),
				},
			),
		onSuccess: response => {
			toast.success(response.message);
			setSelected(response.data);
			void invalidate();
		},
		onError: error => toast.error((error as Error).message),
	});

	const remove = useMutation({
		mutationFn: (document: TechnicalIncidentV1) =>
			apiV1<null>(`/api/v1/technical-incidents/${document.id}/delete`, {
				method: "POST",
				body: JSON.stringify({ version: document.version }),
			}),
		onSuccess: response => {
			toast.success(response.message);
			setSelected(null);
			void invalidate();
		},
		onError: error => toast.error((error as Error).message),
	});

	const askDelete = async (document: TechnicalIncidentV1) => {
		if (
			await confirm(
				`Xóa sự cố ${document.code}? Dữ liệu sẽ được ẩn khỏi danh sách nhưng lịch sử vẫn được lưu.`,
			)
		) {
			remove.mutate(document);
		}
	};

	const askStatus = async (
		document: TechnicalIncidentV1,
		status: TechnicalIncidentStatus,
		message: string,
	) => {
		if (await confirm(message)) {
			changeStatus.mutate({ document, status });
		}
	};

	const addImages = async (files: FileList | null) => {
		if (!files?.length) return;
		const accepted: TechnicalIncidentImageV1[] = [];
		let usedChars = images.reduce(
			(sum, image) => sum + (image.dataUrl?.length || 0),
			0,
		);
		for (const file of Array.from(files)) {
			if (!file.type.startsWith("image/")) continue;
			if (images.length + accepted.length >= MAX_IMAGES) {
				toast.error(`Tối đa ${MAX_IMAGES} hình ảnh bằng chứng`);
				break;
			}
			try {
				const dataUrl = await compressImage(file);
				if (dataUrl.length > 5_000_000) {
					toast.error(`${file.name} quá lớn sau khi nén, vui lòng chọn ảnh khác`);
					continue;
				}
				if (usedChars + dataUrl.length > MAX_IMAGE_PAYLOAD) {
					toast.error(
						"Tổng dung lượng hình ảnh vượt giới hạn cho phép, vui lòng bớt ảnh hoặc chọn ảnh nhẹ hơn",
					);
					break;
				}
				usedChars += dataUrl.length;
				const mimeType =
					dataUrl.slice(5, dataUrl.indexOf(";")) || "image/jpeg";
				const base64Length = dataUrl.length - dataUrl.indexOf(",") - 1;
				accepted.push({
					fileName: file.name,
					mimeType,
					size: Math.round(base64Length * 0.75),
					dataUrl,
				});
			} catch (error) {
				toast.error((error as Error).message);
			}
		}
		if (accepted.length) {
			setImages(current => [...current, ...accepted]);
			toast.success(`Đã thêm ${accepted.length} hình ảnh`);
		}
		if (fileInputRef.current) fileInputRef.current.value = "";
	};

	const rows = documents.data?.data || [];
	const meta = documents.data?.meta || {};
	const stats = summary.data?.data;

	const exportList = async () => {
		if (exporting) return;
		setExporting(true);
		try {
			const all: TechnicalIncidentV1[] = [];
			let pageNumber = 1;
			let totalPages = 1;
			do {
				const response = await apiV1<TechnicalIncidentV1[]>(
					`/api/v1/technical-incidents?${buildIncidentListParams(pageNumber, 100, search, filters)}`,
				);
				all.push(...(response.data || []));
				totalPages = Number(response.meta?.totalPages || 1);
				pageNumber += 1;
			} while (pageNumber <= totalPages);

			if (!all.length) {
				toast.error("Không có dữ liệu để xuất");
				return;
			}

			const stamp =
				filters.occurredFrom || filters.occurredTo
					? `${filters.occurredFrom || "dau-ky"}_${filters.occurredTo || "cuoi-ky"}`
					: new Date().toISOString().slice(0, 10);

			await exportExcelFile(
				`su-co-ky-thuat_${stamp}.xlsx`,
				"Su co ky thuat",
				[
					{ header: "Mã sự cố", value: (row: TechnicalIncidentV1) => row.code },
					{
						header: "Thời gian xảy ra",
						value: (row: TechnicalIncidentV1) =>
							formatIncidentTime(row.occurredAt),
						width: 22,
					},
					{
						header: "Thời gian hoàn tất",
						value: (row: TechnicalIncidentV1) =>
							row.resolvedAt ? formatIncidentTime(row.resolvedAt) : "",
						width: 22,
					},
					{
						header: "Tên sự cố",
						value: (row: TechnicalIncidentV1) => row.title,
						width: 40,
					},
					{
						header: "Máy móc / thiết bị",
						value: (row: TechnicalIncidentV1) => row.equipmentName || "",
						width: 30,
					},
					{
						header: "Vị trí",
						value: (row: TechnicalIncidentV1) => row.location || "",
					},
					{
						header: "Loại sự cố",
						value: (row: TechnicalIncidentV1) =>
							TECHNICAL_CATEGORY_META[row.category]?.label || row.category,
					},
					{
						header: "Mức độ",
						value: (row: TechnicalIncidentV1) =>
							TECHNICAL_SEVERITY_META[row.severity]?.label || row.severity,
					},
					{
						header: "Trạng thái",
						value: (row: TechnicalIncidentV1) =>
							TECHNICAL_STATUS_META[row.status]?.label || row.status,
					},
					{
						header: "Người chịu trách nhiệm",
						value: (row: TechnicalIncidentV1) => row.assigneeName || "",
					},
					{
						header: "Nguyên nhân",
						value: (row: TechnicalIncidentV1) => row.cause || "",
						width: 40,
					},
					{
						header: "Hướng xử lý",
						value: (row: TechnicalIncidentV1) => row.solution || "",
						width: 40,
					},
					...(canViewMoney
						? [
								{
									header: "Chi phí (đ)",
									value: (row: TechnicalIncidentV1) => Number(row.cost || 0),
									width: 16,
								},
							]
						: []),
					{
						header: "Ghi chú",
						value: (row: TechnicalIncidentV1) => row.note || "",
						width: 32,
					},
					{
						header: "Người tạo",
						value: (row: TechnicalIncidentV1) => row.creatorName || "",
					},
					{
						header: "Số ảnh",
						value: (row: TechnicalIncidentV1) => row.imageCount || 0,
						width: 10,
					},
				],
				all,
			);
		} catch (error) {
			toast.error((error as Error).message);
		} finally {
			setExporting(false);
		}
	};

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>Sự cố kỹ thuật</h1>
					<p>
						Theo dõi sự cố máy móc, bảo dưỡng và sửa chữa thiết bị; lưu hình ảnh
						bằng chứng và in phiếu sự cố.
					</p>
				</div>
				<div className="flex items-center gap-2">
					<button
						className="erp-btn"
						onClick={() => void exportList()}
						disabled={exporting}
						title="Xuất toàn bộ sự cố (theo bộ lọc hiện tại) ra Excel"
					>
						<Download size={16} /> {exporting ? "Đang xuất..." : "Xuất Excel"}
					</button>
					<button className="erp-btn erp-btn-primary" onClick={create}>
						<Plus size={16} /> Báo sự cố
					</button>
				</div>
			</div>

			<div className="grid gap-4 md:grid-cols-4">
				<div className="erp-stat">
					<Wrench size={20} />
					<div>
						<span>Tổng sự cố</span>
						<strong>{stats?.total ?? meta.total ?? 0}</strong>
					</div>
				</div>
				<div className="erp-stat">
					<Clock3 size={20} />
					<div>
						<span>Đang mở</span>
						<strong>
							{(stats?.open ?? 0) + (stats?.inProgress ?? 0)}
						</strong>
					</div>
				</div>
				<div className="erp-stat">
					<AlertTriangle size={20} />
					<div>
						<span>Nghiêm trọng</span>
						<strong>{stats?.critical ?? 0}</strong>
					</div>
				</div>
				<div className="erp-stat">
					<CheckCircle2 size={20} />
					<div>
						<span>Đã hoàn tất</span>
						<strong>{stats?.resolved ?? 0}</strong>
					</div>
				</div>
			</div>

			<div className="erp-card overflow-hidden">
				<ListToolbar
					search={
						<div className="erp-search">
							<Search size={17} />
							<input
								value={search}
								onChange={event => {
									setSearch(event.target.value);
									setPage(1);
								}}
								placeholder="Tìm mã, tên sự cố, thiết bị, người phụ trách..."
							/>
						</div>
					}
					fields={FILTER_FIELDS}
					values={filters}
					onChange={next => {
						setFilters(next);
						setPage(1);
					}}
					onExport={exportList}
					exportDisabled={exporting || rows.length === 0}
					exportTitle={
						exporting ? "Đang xuất Excel..." : "Xuất toàn bộ sự cố ra Excel"
					}
				/>
				<div className="overflow-x-auto">
					<table className="erp-table">
						<thead>
							<tr>
								<th>Mã / Thời gian</th>
								<th>Sự cố</th>
								<th>Loại</th>
								<th>Mức độ</th>
								<th>Người phụ trách</th>
								<th>Trạng thái</th>
								<th className="text-center">Ảnh</th>
								<th>Thao tác</th>
							</tr>
						</thead>
						<tbody>
							{documents.isLoading ? (
								<tr>
									<td colSpan={8} className="text-center">
										Đang tải...
									</td>
								</tr>
							) : rows.length === 0 ? (
								<tr>
									<td colSpan={8} className="py-8 text-center text-slate-400">
										<Wrench className="mx-auto mb-2" size={28} />
										Chưa có sự cố kỹ thuật nào
									</td>
								</tr>
							) : (
								rows.map(document => (
									<tr key={document.id}>
										<td>
											<button
												type="button"
												className="font-bold text-[#422afb]"
												onClick={() => void view(document)}
											>
												{document.code}
											</button>
											<small>{formatIncidentTime(document.occurredAt)}</small>
										</td>
										<td className="max-w-xs">
											<b>{document.title}</b>
											<small>
												{document.equipmentName || "Chưa xác định thiết bị"}
												{document.location ? ` · ${document.location}` : ""}
											</small>
										</td>
										<td>
											<span
												className={`erp-badge ${TECHNICAL_CATEGORY_META[document.category]?.css || ""}`}
											>
												{TECHNICAL_CATEGORY_META[document.category]?.label ||
													document.category}
											</span>
										</td>
										<td>
											<span
												className={`erp-badge ${TECHNICAL_SEVERITY_META[document.severity]?.css || ""}`}
											>
												{TECHNICAL_SEVERITY_META[document.severity]?.label ||
													document.severity}
											</span>
										</td>
										<td>{document.assigneeName || "—"}</td>
										<td>
											<span
												className={`erp-badge ${TECHNICAL_STATUS_META[document.status]?.css || ""}`}
											>
												{TECHNICAL_STATUS_META[document.status]?.label ||
													document.status}
											</span>
										</td>
										<td className="text-center">
											<span className="inline-flex items-center gap-1 text-slate-500">
												<Images size={14} />
												{document.imageCount || 0}
											</span>
										</td>
										<td>
											<TableActions
												actions={[
													{
														key: "view",
														label: "Xem chi tiết",
														icon: <Eye size={15} />,
														onClick: () => void view(document),
													},
													{
														key: "edit",
														label: "Cập nhật",
														icon: <Edit size={15} />,
														onClick: () => void startEdit(document),
													},
													{
														key: "print",
														label: "In phiếu",
														icon: <Printer size={15} />,
														onClick: () => void viewForPrint(document),
													},
													{
														key: "delete",
														label: "Xóa",
														icon: <Trash2 size={15} />,
														tone: "danger",
														onClick: () => void askDelete(document),
													},
												]}
											/>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
				<div className="flex items-center justify-between p-3 text-sm">
					<span>Tổng {meta.total || 0} sự cố</span>
					<div className="flex gap-2">
						<button
							className="erp-btn"
							disabled={page <= 1}
							onClick={() => setPage(value => value - 1)}
						>
							Trước
						</button>
						<span className="self-center">
							Trang {page}/{meta.totalPages || 1}
						</span>
						<button
							className="erp-btn"
							disabled={page >= Number(meta.totalPages || 1)}
							onClick={() => setPage(value => value + 1)}
						>
							Sau
						</button>
					</div>
				</div>
			</div>

			{open && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-4xl">
						<div className="erp-modal-header">
							<div>
								<h2>
									{editing ? `Cập nhật ${editing.code}` : "Báo sự cố kỹ thuật"}
								</h2>
								<p>
									Ghi nhận thời gian, mức độ, nguyên nhân, hướng xử lý và hình
									ảnh bằng chứng.
								</p>
							</div>
							<button onClick={closeForm}>
								<X />
							</button>
						</div>
						<form
							onSubmit={event => {
								event.preventDefault();
								save.mutate();
							}}
						>
							<div className="erp-modal-body space-y-5">
								<div className="grid gap-4 md:grid-cols-3">
									<label>
										Mã sự cố
										<input
											value={form.code}
											disabled={!!editing}
											placeholder="Tự động"
											onChange={event =>
												setForm(current => ({
													...current,
													code: event.target.value,
												}))
											}
										/>
									</label>
									<label className="md:col-span-2">
										Tên sự cố <span className="text-red-500">*</span>
										<input
											required
											maxLength={255}
											value={form.title}
											onChange={event =>
												setForm(current => ({
													...current,
													title: event.target.value,
												}))
											}
											placeholder="VD: Máy hàn số 3 không lên nguồn"
										/>
									</label>
									<label>
										Máy móc / thiết bị
										<input
											maxLength={255}
											value={form.equipmentName}
											onChange={event =>
												setForm(current => ({
													...current,
													equipmentName: event.target.value,
												}))
											}
											placeholder="VD: Máy nén khí 50HP"
										/>
									</label>
									<label>
										Vị trí
										<input
											maxLength={255}
											value={form.location}
											onChange={event =>
												setForm(current => ({
													...current,
													location: event.target.value,
												}))
											}
											placeholder="VD: Xưởng sản xuất 1"
										/>
									</label>
									<label>
										Loại sự cố
										<select
											value={form.category}
											onChange={event =>
												setForm(current => ({
													...current,
													category: event.target.value as TechnicalIncidentCategory,
												}))
											}
										>
											<option value="REPAIR">Sửa chữa</option>
											<option value="MAINTENANCE">Bảo dưỡng</option>
											<option value="INSPECTION">Kiểm tra</option>
											<option value="OTHER">Khác</option>
										</select>
									</label>
									<label>
										Mức độ
										<select
											value={form.severity}
											onChange={event =>
												setForm(current => ({
													...current,
													severity: event.target.value as TechnicalIncidentSeverity,
												}))
											}
										>
											<option value="LOW">Thấp</option>
											<option value="MEDIUM">Trung bình</option>
											<option value="HIGH">Cao</option>
											<option value="CRITICAL">Nghiêm trọng</option>
										</select>
									</label>
									<label>
										Trạng thái
										<select
											value={form.status}
											onChange={event =>
												setForm(current => ({
													...current,
													status: event.target.value as TechnicalIncidentStatus,
												}))
											}
										>
											<option value="OPEN">Mới tiếp nhận</option>
											<option value="IN_PROGRESS">Đang xử lý</option>
											<option value="RESOLVED">Đã hoàn tất</option>
											<option value="CANCELLED">Đã hủy</option>
										</select>
									</label>
									<label>
										Thời gian xảy ra <span className="text-red-500">*</span>
										<input
											required
											type="datetime-local"
											value={form.occurredAt}
											onChange={event =>
												setForm(current => ({
													...current,
													occurredAt: event.target.value,
												}))
											}
										/>
									</label>
									<label>
										Người chịu trách nhiệm
										<input
											list="technical-incident-assignees"
											maxLength={255}
											value={form.assigneeName}
											onChange={event => {
												const value = event.target.value;
												const match = assignees.data?.data.find(
													item => item.fullName === value,
												);
												setForm(current => ({
													...current,
													assigneeName: value,
													assigneeId: match?.id ?? null,
												}));
											}}
											placeholder="Chọn hoặc nhập tên người phụ trách"
										/>
										<datalist id="technical-incident-assignees">
											{assignees.data?.data.map(item => (
												<option key={item.id} value={item.fullName}>
													{item.code}
													{item.jobTitle ? ` · ${item.jobTitle}` : ""}
												</option>
											))}
										</datalist>
									</label>
									{canViewMoney && (
										<label>
											Chi phí (₫)
											<input
												type="number"
												min="0"
												step="1000"
												value={form.cost}
												onChange={event =>
													setForm(current => ({
														...current,
														cost: Number(event.target.value),
													}))
												}
											/>
										</label>
									)}
								</div>

								<div className="grid gap-4 md:grid-cols-2">
									<label>
										Nguyên nhân
										<textarea
											rows={4}
											maxLength={5000}
											value={form.cause}
											onChange={event =>
												setForm(current => ({
													...current,
													cause: event.target.value,
												}))
											}
											placeholder="Mô tả nguyên nhân gây ra sự cố..."
										/>
									</label>
									<label>
										Hướng xử lý
										<textarea
											rows={4}
											maxLength={5000}
											value={form.solution}
											onChange={event =>
												setForm(current => ({
													...current,
													solution: event.target.value,
												}))
											}
											placeholder="Cách khắc phục, linh kiện thay thế, kết quả..."
										/>
									</label>
								</div>

								<label>
									Ghi chú
									<textarea
										rows={2}
										maxLength={500}
										value={form.note}
										onChange={event =>
											setForm(current => ({
												...current,
												note: event.target.value,
											}))
										}
									/>
								</label>

								<div>
									<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
										<span className="text-sm font-semibold">
											Hình ảnh bằng chứng ({images.length}/{MAX_IMAGES})
										</span>
										<button
											type="button"
											className="erp-btn"
											onClick={() => fileInputRef.current?.click()}
											disabled={images.length >= MAX_IMAGES}
										>
											<ImagePlus size={15} /> Chọn ảnh
										</button>
										<input
											ref={fileInputRef}
											type="file"
											accept="image/png,image/jpeg,image/webp,image/gif"
											multiple
											className="hidden"
											onChange={event => void addImages(event.target.files)}
										/>
									</div>
									{images.length === 0 ? (
										<div className="rounded border border-dashed p-5 text-center text-sm text-slate-400">
											Chưa có ảnh. Có thể chọn nhiều ảnh cùng lúc, ảnh sẽ được
											nén tự động trước khi lưu.
										</div>
									) : (
										<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
											{images.map((image, index) => (
												<div
													key={image.id ?? `new-${index}`}
													className="group relative"
												>
													<img
														src={image.dataUrl}
														alt={image.fileName}
														className="h-28 w-full rounded-lg border object-cover"
													/>
													<button
														type="button"
														className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white hover:bg-red-600"
														title="Xóa ảnh"
														onClick={() =>
															setImages(current =>
																current.filter((_, position) => position !== index),
															)
														}
													>
														<X size={13} />
													</button>
													<p
														className="mt-1 truncate text-[11px] text-slate-500"
														title={image.fileName}
													>
														{image.fileName}
													</p>
												</div>
											))}
										</div>
									)}
								</div>
							</div>
							<div className="erp-modal-footer">
								<button type="button" className="erp-btn" onClick={closeForm}>
									Hủy
								</button>
								<button
									className="erp-btn erp-btn-primary"
									disabled={save.isPending}
								>
									{save.isPending
										? "Đang lưu..."
										: editing
											? "Lưu cập nhật"
											: "Lưu sự cố"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}

			{selected && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-4xl">
						<div className="erp-modal-header">
							<div>
								<h2>{selected.code}</h2>
								<p>{selected.title}</p>
							</div>
							<button onClick={() => setSelected(null)}>
								<X />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							<div className="flex flex-wrap items-center gap-2">
								<span
									className={`erp-badge ${TECHNICAL_STATUS_META[selected.status]?.css || ""}`}
								>
									{TECHNICAL_STATUS_META[selected.status]?.label ||
										selected.status}
								</span>
								<span
									className={`erp-badge ${TECHNICAL_SEVERITY_META[selected.severity]?.css || ""}`}
								>
									{TECHNICAL_SEVERITY_META[selected.severity]?.label ||
										selected.severity}
								</span>
								<span
									className={`erp-badge ${TECHNICAL_CATEGORY_META[selected.category]?.css || ""}`}
								>
									{TECHNICAL_CATEGORY_META[selected.category]?.label ||
										selected.category}
								</span>
								<EntityHistoryButton
									entityType="TECHNICAL_INCIDENT"
									entityId={selected.id}
									entityCode={selected.code}
								/>
								{detailLoading && (
									<span className="text-sm text-slate-400">Đang tải...</span>
								)}
							</div>

							<div className="grid gap-3 rounded bg-slate-50 p-3 text-sm md:grid-cols-3">
								<div>
									<small>Máy móc / thiết bị</small>
									<b className="block">{selected.equipmentName || "—"}</b>
								</div>
								<div>
									<small>Vị trí</small>
									<b className="block">{selected.location || "—"}</b>
								</div>
								<div>
									<small>Thời gian xảy ra</small>
									<b className="block">
										{formatIncidentTime(selected.occurredAt)}
									</b>
								</div>
								<div>
									<small>Người chịu trách nhiệm</small>
									<b className="block">{selected.assigneeName || "—"}</b>
									{selected.assigneeJobTitle && (
										<small className="block">{selected.assigneeJobTitle}</small>
									)}
								</div>
								<div>
									<small>Người lập phiếu</small>
									<b className="block">{selected.creatorName || "—"}</b>
								</div>
								<div>
									<small>Hoàn tất lúc</small>
									<b className="block">
										{formatIncidentTime(selected.resolvedAt)}
									</b>
								</div>
								{canViewMoney && (
									<div>
										<small>Chi phí</small>
										<b className="block">
											{formatNumber(Number(selected.cost || 0))} ₫
										</b>
									</div>
								)}
							</div>

							<div className="rounded bg-slate-50 p-3">
								<small className="font-semibold uppercase text-slate-500">
									Nguyên nhân
								</small>
								<p className="whitespace-pre-wrap text-sm">
									{selected.cause || "—"}
								</p>
							</div>
							<div className="rounded bg-slate-50 p-3">
								<small className="font-semibold uppercase text-slate-500">
									Hướng xử lý / Kết quả
								</small>
								<p className="whitespace-pre-wrap text-sm">
									{selected.solution || "—"}
								</p>
							</div>
							{selected.note && (
								<div className="rounded bg-slate-50 p-3">
									<small className="font-semibold uppercase text-slate-500">
										Ghi chú
									</small>
									<p className="whitespace-pre-wrap text-sm">{selected.note}</p>
								</div>
							)}

							<div>
								<div className="mb-2 flex items-center gap-2 text-sm font-semibold">
									<Images size={16} /> Hình ảnh bằng chứng (
									{selected.images?.length || 0})
								</div>
								{selected.images?.length ? (
									<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
										{selected.images.map(image => (
											<button
												key={image.id ?? image.fileName}
												type="button"
												className="overflow-hidden rounded-lg border text-left hover:border-[#422afb]"
												onClick={() => setLightbox(image)}
											>
												<img
													src={image.dataUrl}
													alt={image.fileName}
													className="h-24 w-full object-cover"
												/>
												<span className="block truncate px-1 py-1 text-[11px] text-slate-500">
													{image.fileName}
												</span>
											</button>
										))}
									</div>
								) : (
									<div className="rounded border border-dashed p-4 text-center text-sm text-slate-400">
										Chưa có hình ảnh bằng chứng
									</div>
								)}
							</div>
						</div>
						<div className="erp-modal-footer flex flex-wrap gap-2">
							{selected.status === "OPEN" && (
								<button
									type="button"
									className="erp-btn erp-btn-post"
									disabled={changeStatus.isPending}
									onClick={() =>
										void askStatus(
											selected,
											"IN_PROGRESS",
											`Bắt đầu xử lý sự cố ${selected.code}?`,
										)
									}
								>
									<Clock3 size={16} /> Bắt đầu xử lý
								</button>
							)}
							{selected.status === "IN_PROGRESS" && (
								<button
									type="button"
									className="erp-btn erp-btn-post"
									disabled={changeStatus.isPending}
									onClick={() =>
										void askStatus(
											selected,
											"RESOLVED",
											`Đánh dấu sự cố ${selected.code} đã hoàn tất?`,
										)
									}
								>
									<CheckCircle2 size={16} /> Hoàn tất
								</button>
							)}
							{(selected.status === "OPEN" ||
								selected.status === "IN_PROGRESS") && (
								<button
									type="button"
									className="erp-btn erp-btn-danger"
									disabled={changeStatus.isPending}
									onClick={() =>
										void askStatus(
											selected,
											"CANCELLED",
											`Hủy sự cố ${selected.code}?`,
										)
									}
								>
									<Ban size={16} /> Hủy sự cố
								</button>
							)}
							{(selected.status === "RESOLVED" ||
								selected.status === "CANCELLED") && (
								<button
									type="button"
									className="erp-btn"
									disabled={changeStatus.isPending}
									onClick={() =>
										void askStatus(
											selected,
											"OPEN",
											`Mở lại sự cố ${selected.code}?`,
										)
									}
								>
									<AlertTriangle size={16} /> Mở lại
								</button>
							)}
							<button
								type="button"
								className="erp-btn"
								onClick={() => setPrintTarget(selected)}
							>
								<Printer size={16} /> In phiếu
							</button>
							<button
								type="button"
								className="erp-btn"
								onClick={() => void startEdit(selected)}
							>
								<Edit size={16} /> Sửa
							</button>
							<button
								type="button"
								className="erp-btn"
								onClick={() => setSelected(null)}
							>
								Đóng
							</button>
						</div>
					</div>
				</div>
			)}

			{printTarget && (
				<div className="sales-print-view fixed inset-0 z-[9999] flex flex-col bg-gray-900/90 backdrop-blur-md">
					<div className="no-print flex items-center justify-between border-b bg-white p-4 shadow-md">
						<div className="flex items-center gap-4">
							<h3 className="text-lg font-black uppercase tracking-tight text-gray-800">
								Phiếu sự cố kỹ thuật
							</h3>
							<span className="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-500">
								{printTarget.code}
							</span>
						</div>
						<div className="flex items-center gap-3">
							<button
								onClick={() => setPrintTarget(null)}
								className="rounded-lg border px-6 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 transition-all hover:bg-gray-50"
							>
								Đóng
							</button>
							<button
								onClick={handlePrint}
								className="erp-btn erp-btn-primary !px-6 text-[10px] uppercase tracking-widest"
							>
								<Printer size={16} /> In
							</button>
						</div>
					</div>
					<div className="flex-1 overflow-auto bg-gray-200/50 p-8">
						<div
							ref={printRef}
							className="sales-print-view mx-auto mb-8 w-[210mm] max-w-full bg-white shadow-2xl"
						>
							<TechnicalIncidentDocument
								incident={printTarget}
								company={companyQuery.data}
							/>
						</div>
					</div>
				</div>
			)}

			{lightbox?.dataUrl && (
				<div
					className="fixed inset-0 z-[400] flex items-center justify-center bg-black/85 p-6"
					onClick={() => setLightbox(null)}
				>
					<div
						className="max-h-full max-w-5xl"
						onClick={event => event.stopPropagation()}
					>
						<img
							src={lightbox.dataUrl}
							alt={lightbox.fileName}
							className="mx-auto max-h-[80vh] rounded-lg object-contain"
						/>
						<div className="mt-3 flex items-center justify-between gap-4 text-sm text-white">
							<span className="truncate">{lightbox.fileName}</span>
							<button
								type="button"
								className="rounded border border-white/40 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide hover:bg-white/10"
								onClick={() => setLightbox(null)}
							>
								Đóng
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
