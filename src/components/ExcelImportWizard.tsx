import React, { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Download, Eye, FileSpreadsheet, UploadCloud, X } from "lucide-react";
import ExcelJS from "exceljs";
import { cn } from "../lib/utils";
import Button from "./ui/button";
import { Card } from "./ui/card";
import Badge from "./ui/badge";
import { useEscapeKey } from "../hooks/useEscapeKey";

export type ExcelImportMode = "ADD_NEW" | "UPDATE" | "OVERWRITE";
export type ExcelImportStep = 1 | 2 | 3 | 4;

export interface ExcelImportField {
	key: string;
	label: string;
	description: string;
	required: boolean;
	locked: boolean;
}

export interface ExcelImportResult {
	total: number;
	created: number;
	updated: number;
	skipped: number;
	deleted: number;
	errors: Array<{ row: number; sku: string; message: string }>;
}

interface ExcelImportWizardProps {
	title: string;
	subtitle?: string;
	fields: FieldDef[];
	stepLabels?: string[];
	modes?: Array<{ value: ExcelImportMode; title: string; description: string }>;
	templateFileName: string;
	templateSheetName?: string;
	templateRows?: Array<Record<string, string | number>>;
	accept?: string;
	validateRow?: (row: Record<string, string>) => string[];
	onImport: (payload: { mode: ExcelImportMode; rows: Array<Record<string, string>> }) => Promise<ExcelImportResult>;
	onDone?: () => void;
	onBack?: () => void;
}

type FieldDef = ExcelImportField;
const DEFAULT_STEPS = ["Chọn tệp", "Ghép dữ liệu", "Kiểm tra dữ liệu", "Kết quả"];
const DEFAULT_MODES = [
	{ value: "ADD_NEW" as ExcelImportMode, title: "Thêm mới", description: "Dòng chưa có thì thêm mới, dòng đã có thì bỏ qua" },
	{ value: "UPDATE" as ExcelImportMode, title: "Cập nhật", description: "Dòng chưa có thì thêm mới, dòng đã có thì cập nhật" },
	{ value: "OVERWRITE" as ExcelImportMode, title: "Ghi đè", description: "Thêm mới, cập nhật dòng đã có, ẩn dữ liệu không có trong file" },
];

export function Dropzone({
	accept = ".xlsx,.xls",
	fileName,
	rowCount,
	dragging,
	onSelect,
	onDropFile,
	onDragState,
	inputRef,
}: {
	accept?: string;
	fileName: string;
	rowCount: number;
	dragging: boolean;
	onSelect: (file: File | undefined) => void;
	onDropFile: (file: File | undefined) => void;
	onDragState: (dragging: boolean) => void;
	inputRef: React.RefObject<HTMLInputElement | null>;
}) {
	return (
		<div
			role="button"
			tabIndex={0}
			onClick={() => inputRef.current?.click()}
			onKeyDown={e => {
				if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
			}}
			onDragEnter={e => {
				e.preventDefault();
				onDragState(true);
			}}
			onDragOver={e => e.preventDefault()}
			onDragLeave={e => {
				e.preventDefault();
				onDragState(false);
			}}
			onDrop={e => {
				e.preventDefault();
				onDragState(false);
				onDropFile(e.dataTransfer.files?.[0]);
			}}
			className={cn(
				"flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition",
				dragging ? "border-[#422afb] bg-[#e9e3ff]/60" : "border-[#e0e5f2] bg-[#fcfcfd] hover:border-[#422afb] hover:bg-[#e9e3ff]/30",
			)}
		>
			<span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e9e3ff] text-[#422afb]">
				<UploadCloud size={22} />
			</span>
			<p className="text-sm font-semibold text-[#1b2559]">{dragging ? "Thả tệp để tải lên" : "Kéo thả tệp Excel vào đây"}</p>
			<p className="text-xs text-[#a3aed0]">hoặc bấm để chọn tệp · {accept}</p>
			{fileName ? (
				<p className="mt-1 rounded-full bg-[#ecfdf3] px-3 py-1 text-xs font-semibold text-[#027a48]">
					{fileName} · {rowCount} dòng
				</p>
			) : (
				<p className="mt-1 text-xs text-[#a3aed0]">Chưa có tệp nào được chọn</p>
			)}
			<input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => onSelect(e.target.files?.[0])} />
		</div>
	);
}

export default function ExcelImportWizard({
	title,
	subtitle,
	fields,
	stepLabels = DEFAULT_STEPS,
	modes = DEFAULT_MODES,
	templateFileName,
	templateSheetName = "Du lieu",
	templateRows = [],
	accept = ".xlsx,.xls",
	validateRow,
	onImport,
	onDone,
	onBack,
}: ExcelImportWizardProps) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [step, setStep] = useState<ExcelImportStep>(1);
	const [mode, setMode] = useState<ExcelImportMode>("ADD_NEW");
	const [dragging, setDragging] = useState(false);
	const [busy, setBusy] = useState(false);
	const [fileName, setFileName] = useState("");
	const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
	const [excelRows, setExcelRows] = useState<Array<Record<string, string>>>([]);
	const [mapping, setMapping] = useState<Record<string, string>>({});
const [result, setResult] = useState<ExcelImportResult | null>(null);
  const [errorDetailIndex, setErrorDetailIndex] = useState<number | null>(null);

  useEscapeKey(errorDetailIndex !== null, () => setErrorDetailIndex(null));

	const mappedRows = useMemo(() => excelRows.map(row => {
		const mapped: Record<string, string> = {};
		for (const field of fields) {
			const excelColumn = mapping[field.key];
			mapped[field.key] = excelColumn ? String(row[excelColumn] ?? "") : "";
		}
		return mapped;
	}), [excelRows, mapping, fields]);

	const validation = useMemo(() => mappedRows.map(row => {
		const errors: string[] = [];
		for (const field of fields.filter(item => item.required)) {
			if (!String(row[field.key] || "").trim()) errors.push(`Thiếu ${field.label.toLowerCase()}`);
		}
		if (validateRow) errors.push(...validateRow(row));
		return { valid: errors.length === 0, errors };
	}), [mappedRows, fields, validateRow]);

	const validCount = validation.filter(item => item.valid).length;
	const invalidCount = validation.length - validCount;
	const requiredMapped = fields.filter(field => field.required).every(field => mapping[field.key]);

	const downloadTemplate = async () => {
		const workbook = new ExcelJS.Workbook();
		const sheet = workbook.addWorksheet(templateSheetName);
		sheet.columns = fields.map(field => ({ header: field.label, key: field.key, width: Math.max(16, field.label.length + 4) }));
		for (const row of templateRows) sheet.addRow(row);
		const buffer = await workbook.xlsx.writeBuffer();
		const { saveAs } = await import("file-saver");
		saveAs(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), templateFileName);
	};

	const handleFile = async (file: File | undefined) => {
		if (!file) return;
		setFileName(file.name);
		const buffer = await file.arrayBuffer();
		const workbook = new ExcelJS.Workbook();
		await workbook.xlsx.load(buffer);
		const sheet = workbook.worksheets[0];
		if (!sheet) return;
		const headers: string[] = [];
		sheet.getRow(1).eachCell({ includeEmpty: false }, cell => headers.push(String(cell.value ?? "").trim()));
		const rows: Array<Record<string, string>> = [];
		sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
			if (rowNumber === 1) return;
			const record: Record<string, string> = {};
			headers.forEach((header, index) => {
				record[header] = String(row.getCell(index + 1).value ?? "").trim();
			});
			if (Object.values(record).some(value => value !== "")) rows.push(record);
		});
		setExcelHeaders(headers);
		setExcelRows(rows);
		const autoMapping: Record<string, string> = {};
		for (const field of fields) {
			const matched = headers.find(header => header.toLowerCase() === field.label.toLowerCase() || header.toLowerCase() === field.key.toLowerCase());
			if (matched) autoMapping[field.key] = matched;
		}
		setMapping(autoMapping);
		setResult(null);
	};

	const submit = async () => {
		setBusy(true);
		try {
			const payload = mappedRows
				.filter((_, index) => validation[index]?.valid)
				.map(row => ({ ...row }));
			const summary = await onImport({ mode, rows: payload });
			setResult(summary);
			setStep(4);
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="erp-page">
			<div className="erp-page-header">
				<div>
					<h1>{title}</h1>
					{subtitle && <p>{subtitle}</p>}
				</div>
				{onBack && <Button variant="outline" onClick={onBack}>Quay lại</Button>}
			</div>

			<Card className="mb-4 flex flex-wrap items-center gap-2 !p-4">
				{stepLabels.map((label, index) => {
					const current = (index + 1) as ExcelImportStep;
					const active = current === step;
					const done = current < step;
					return (
						<div key={label} className="flex items-center gap-2">
							<span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold", active ? "bg-[#422afb] text-white" : done ? "bg-[#e9e3ff] text-[#3311db]" : "bg-[#eef2fb] text-[#a3aed0]")}>
								{index + 1}
							</span>
							<span className={cn("text-sm", active ? "font-semibold text-[#1b2559]" : "text-[#a3aed0]")}>{label}</span>
							{index < stepLabels.length - 1 && <span className="mx-2 h-px w-8 bg-[#e9edf7]" />}
						</div>
					);
				})}
			</Card>

			{step === 1 && (
				<Card className="space-y-4 !p-6">
					<Dropzone
						accept={accept}
						fileName={fileName}
						rowCount={excelRows.length}
						dragging={dragging}
						inputRef={fileRef}
						onSelect={file => void handleFile(file)}
						onDropFile={file => void handleFile(file)}
						onDragState={setDragging}
					/>
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" onClick={() => void downloadTemplate()}>
							<Download size={15} /> Tải file mẫu
						</Button>
						{fileName && (
							<Button variant="ghost" onClick={() => {
								setFileName("");
								setExcelHeaders([]);
								setExcelRows([]);
								setMapping({});
							}}>
								<X size={15} /> Xóa tệp
							</Button>
						)}
					</div>
					<div className="grid gap-3 md:grid-cols-3">
						{modes.map(option => (
							<label key={option.value} className={cn("cursor-pointer rounded-xl border p-4 transition", mode === option.value ? "border-[#422afb] bg-[#e9e3ff]/50" : "border-[#e9edf7] hover:border-[#a3aed0]")}>
								<span className="flex items-center gap-2">
									<input type="radio" checked={mode === option.value} onChange={() => setMode(option.value)} className="h-4 w-4 accent-[#422afb]" />
									<b className="text-sm text-[#1b2559]">{option.title}</b>
								</span>
								<p className="mt-1 text-xs leading-relaxed text-[#a3aed0]">{option.description}</p>
							</label>
						))}
					</div>
					<div className="flex justify-end">
						<Button variant="primary" disabled={!excelRows.length} onClick={() => setStep(2)}>
							Tiếp tục
						</Button>
					</div>
				</Card>
			)}

			{step === 2 && (
				<Card className="!p-6">
					<div className="overflow-x-auto">
						<table className="erp-table">
							<thead><tr><th>Cột trên phần mềm</th><th>Cột trên file Excel</th><th>Diễn giải</th><th>Bắt buộc ghép cột</th></tr></thead>
							<tbody>
								{fields.map(field => (
									<tr key={field.key}>
										<td className="font-semibold">{field.label}</td>
										<td>
											<select value={mapping[field.key] || ""} disabled={field.locked && Boolean(mapping[field.key])} onChange={e => setMapping({ ...mapping, [field.key]: e.target.value })}>
												<option value="">Không ghép</option>
												{excelHeaders.map(header => <option key={header} value={header}>{header}</option>)}
											</select>
										</td>
										<td className="text-slate-500">{field.description}</td>
										<td>{field.required ? <CheckCircle2 size={16} className="text-emerald-600" /> : <span className="text-slate-400">Không</span>}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					<div className="mt-4 flex justify-between">
						<Button variant="outline" onClick={() => setStep(1)}><ArrowLeft size={15} /> Quay lại</Button>
						<Button variant="primary" disabled={!requiredMapped} onClick={() => setStep(3)}>Tiếp tục <ArrowRight size={15} /></Button>
					</div>
					{!requiredMapped && <p className="mt-2 text-xs text-red-500">Các trường bắt buộc phải được ghép cột.</p>}
				</Card>
			)}

			{step === 3 && (
				<Card className="!p-6">
					<p className="mb-3 flex flex-wrap gap-2 text-sm text-slate-600">
						<Badge tone="success">Hợp lệ: {validCount}</Badge>
						<Badge tone="error">Không hợp lệ: {invalidCount}</Badge>
						<Badge tone="gray">{fileName || "File Excel"}</Badge>
					</p>
					<div className="max-h-[50vh] overflow-auto">
						<table className="erp-table">
							<thead><tr><th>Dòng</th>{fields.slice(0, 5).map(field => <th key={field.key}>{field.label}</th>)}<th>Trạng thái</th><th>Chi tiết lỗi</th></tr></thead>
							<tbody>
								{mappedRows.map((row, index) => (
									<tr key={index}>
										<td>{index + 1}</td>
										{fields.slice(0, 5).map(field => <td key={field.key}>{row[field.key]}</td>)}
										<td>
											{validation[index]?.valid
												? <span className="erp-badge bg-emerald-100 text-emerald-700">Hợp lệ</span>
												: <span className="erp-badge bg-red-100 text-red-700" title={validation[index]?.errors.join("; ")}>Không hợp lệ</span>}
										</td>
										<td>
											{validation[index]?.valid ? (
												<span className="text-xs text-slate-400">—</span>
											) : (
												<Button variant="outline" size="sm" onClick={() => setErrorDetailIndex(index)}>
													<Eye size={14} /> Xem lỗi
												</Button>
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					{errorDetailIndex !== null && validation[errorDetailIndex] && (
						<div className="erp-modal-backdrop">
							<div className="erp-modal max-w-2xl">
								<div className="erp-modal-header">
									<div>
										<h2>Chi tiết lỗi dòng {errorDetailIndex + 1}</h2>
										<p>Mã: {mappedRows[errorDetailIndex]?.[fields[0]?.key] || "—"} · Tên: {mappedRows[errorDetailIndex]?.[fields[1]?.key] || "—"}</p>
									</div>
									<button onClick={() => setErrorDetailIndex(null)}><X /></button>
								</div>
								<div className="erp-modal-body space-y-3">
									{mappedRows[errorDetailIndex] && (
										<table className="erp-table">
											<thead><tr><th>Trường</th><th>Giá trị</th><th>Lỗi</th></tr></thead>
											<tbody>
												{fields.map(field => {
													const value = String(mappedRows[errorDetailIndex]?.[field.key] || "");
													const fieldErrors = validation[errorDetailIndex]?.errors.filter(error => error.toLowerCase().includes(field.label.toLowerCase()) || error.toLowerCase().includes(field.key.toLowerCase())) || [];
													return (
														<tr key={field.key}>
															<td className="font-semibold">{field.label}{field.required ? " *" : ""}</td>
															<td className="font-mono">{value || <span className="text-slate-400">Trống</span>}</td>
															<td className={fieldErrors.length ? "text-red-600" : "text-slate-400"}>{fieldErrors.length ? fieldErrors.join("; ") : "—"}</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									)}
									<div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
										<b>Tổng {validation[errorDetailIndex]?.errors.length || 0} lỗi:</b>
										<ul className="mt-1 list-disc pl-5">
											{(validation[errorDetailIndex]?.errors || []).map((error, position) => (
												<li key={position}>{error}</li>
											))}
										</ul>
									</div>
								</div>
								<div className="erp-modal-footer">
									<Button variant="outline" onClick={() => setErrorDetailIndex(null)}>Đóng</Button>
								</div>
							</div>
						</div>
					)}
					<div className="mt-4 flex justify-between">
						<Button variant="outline" onClick={() => setStep(2)}><ArrowLeft size={15} /> Quay lại</Button>
						<Button variant="primary" disabled={!validCount || busy} onClick={() => void submit()}>
							<FileSpreadsheet size={15} /> {busy ? "Đang nhập..." : `Nhập ${validCount} dòng hợp lệ`}
						</Button>
					</div>
				</Card>
			)}

			{step === 4 && (
				<Card className="!p-6">
					{result ? (
						<div className="space-y-3">
							<h2 className="text-lg font-bold text-slate-900">Kết quả nhập dữ liệu</h2>
							<div className="grid gap-3 md:grid-cols-5">
								<div className="rounded bg-slate-50 p-3 text-center"><small>Tổng</small><b className="block text-xl">{result.total}</b></div>
								<div className="rounded bg-emerald-50 p-3 text-center"><small>Thêm mới</small><b className="block text-xl text-emerald-700">{result.created}</b></div>
								<div className="rounded bg-blue-50 p-3 text-center"><small>Cập nhật</small><b className="block text-xl text-blue-700">{result.updated}</b></div>
								<div className="rounded bg-amber-50 p-3 text-center"><small>Bỏ qua</small><b className="block text-xl text-amber-700">{result.skipped}</b></div>
								<div className="rounded bg-slate-100 p-3 text-center"><small>Ẩn khỏi hệ thống</small><b className="block text-xl">{result.deleted}</b></div>
							</div>
							{result.errors.length > 0 && (
								<table className="erp-table">
									<thead><tr><th>Dòng</th><th>Mã</th><th>Lỗi</th></tr></thead>
									<tbody>
										{result.errors.map((error, index) => (
											<tr key={index}><td>{error.row}</td><td className="font-mono">{error.sku}</td><td className="text-red-600">{error.message}</td></tr>
										))}
									</tbody>
								</table>
							)}
						</div>
					) : (
						<p className="text-sm text-slate-500">Chưa có kết quả nhập.</p>
					)}
					<div className="mt-4 flex justify-between">
						<Button variant="outline" onClick={() => setStep(1)}>Nhập file khác</Button>
						{onDone && <Button variant="primary" onClick={onDone}>Hoàn tất</Button>}
					</div>
				</Card>
			)}
		</div>
	);
}
