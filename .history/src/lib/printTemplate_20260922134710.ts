import type ExcelJS from "exceljs";

export const cellText = (value: any): string => {
	if (value === null || value === undefined) return "";
	if (typeof value === "object") {
		if (Array.isArray((value as any).richText))
			return (value as any).richText.map((part: any) => part.text).join("");
		if ((value as any).text !== undefined) return String((value as any).text);
		if ((value as any).result !== undefined)
			return cellText((value as any).result);
		return "";
	}
	if (typeof value === "number") return value.toLocaleString("vi-VN");
	return String(value);
};

// export const APP_COMPANY =
//   "CÔNG TY TNHH SẢN XUẤT THƯƠNG MẠI DỊCH VỤ CHALLENGE";

export interface GenericColumn {
	key: string;
	header: string;
	span: number;
	align?: "left" | "center" | "right";
}

export interface GenericSigner {
	label: string;
	code: string;
}

export interface GenericLayout {
	title: string;
	partnerLabel: string;
	columns: GenericColumn[];
	signers: GenericSigner[];
	totalKey?: string;
	totalLabel?: string;
}

/** Vị trí cố định dùng chung cho các mẫu in sinh tự động (scripts/generate-print-templates.ts). */
export const GENERIC_LAYOUT_ROWS = {
	itemHeaderRow: 9,
	dataStart: 10,
	totalRow: 11,
	wordsRow: 12,
	signerLabelRow: 14,
	signerNameRow: 15,
	columnCount: 10,
} as const;

export const GENERIC_SIGNER_GROUP_STARTS = [1, 4, 7, 9];

export const GENERIC_LAYOUTS: Record<string, GenericLayout> = {
	purchase: {
		title: "CHỨNG TỪ MUA HÀNG",
		partnerLabel: "Nhà cung cấp",
		totalKey: "amount",
		columns: [
			{ key: "stt", header: "STT", span: 1, align: "center" },
			{ key: "sku", header: "Mã", span: 2, align: "left" },
			{ key: "name", header: "Tên hàng hóa, dịch vụ", span: 3, align: "left" },
			{ key: "unit", header: "ĐVT", span: 1, align: "center" },
			{ key: "quantity", header: "Số lượng", span: 1, align: "right" },
			{ key: "unitPrice", header: "Đơn giá", span: 1, align: "right" },
			{ key: "amount", header: "Thành tiền", span: 1, align: "right" },
		],
		signers: [
			{ label: "Người lập", code: "PREPARER" },
			{ label: "Thủ kho", code: "WAREHOUSE_KEEPER" },
			{ label: "Kế toán", code: "CHIEF_ACCOUNTANT" },
			{ label: "Giám đốc", code: "DIRECTOR" },
		],
	},
	payment: {
		title: "PHIẾU THU / PHIẾU CHI",
		partnerLabel: "Đối tượng",
		totalKey: "amount",
		totalLabel: "Số tiền",
		columns: [
			{ key: "stt", header: "STT", span: 1, align: "center" },
			{ key: "document", header: "Chứng từ", span: 5, align: "left" },
			{ key: "note", header: "Diễn giải", span: 3, align: "left" },
			{ key: "amount", header: "Số tiền", span: 1, align: "right" },
		],
		signers: [
			{ label: "Người lập", code: "PREPARER" },
			{ label: "Kế toán trưởng", code: "CHIEF_ACCOUNTANT" },
			{ label: "Thủ quỹ", code: "TREASURER" },
			{ label: "Giám đốc", code: "DIRECTOR" },
		],
	},
	stocktake: {
		title: "BIÊN BẢN KIỂM KÊ",
		partnerLabel: "Kho",
		columns: [
			{ key: "stt", header: "STT", span: 1, align: "center" },
			{ key: "sku", header: "Mã", span: 2, align: "left" },
			{ key: "name", header: "Tên hàng hóa", span: 3, align: "left" },
			{ key: "unit", header: "ĐVT", span: 1, align: "center" },
			{ key: "expected", header: "Tồn sổ sách", span: 1, align: "right" },
			{ key: "actual", header: "Tồn thực tế", span: 1, align: "right" },
			{ key: "difference", header: "Chênh lệch", span: 1, align: "right" },
		],
		signers: [
			{ label: "Người lập", code: "PREPARER" },
			{ label: "Thủ kho", code: "WAREHOUSE_KEEPER" },
			{ label: "Kế toán", code: "CHIEF_ACCOUNTANT" },
			{ label: "Giám đốc", code: "DIRECTOR" },
		],
	},
	salesReturn: {
		title: "PHIẾU TRẢ HÀNG",
		partnerLabel: "Khách hàng",
		totalKey: "amount",
		columns: [
			{ key: "stt", header: "STT", span: 1, align: "center" },
			{ key: "sku", header: "Mã", span: 2, align: "left" },
			{ key: "name", header: "Tên hàng hóa, dịch vụ", span: 3, align: "left" },
			{ key: "unit", header: "ĐVT", span: 1, align: "center" },
			{ key: "quantity", header: "Số lượng", span: 1, align: "right" },
			{ key: "unitPrice", header: "Đơn giá", span: 1, align: "right" },
			{ key: "amount", header: "Thành tiền", span: 1, align: "right" },
		],
		signers: [
			{ label: "Người lập", code: "PREPARER" },
			{ label: "Thủ kho", code: "WAREHOUSE_KEEPER" },
			{ label: "Kế toán", code: "CHIEF_ACCOUNTANT" },
			{ label: "Giám đốc", code: "DIRECTOR" },
		],
	},
	opening: {
		title: "BIÊN BẢN TỒN ĐẦU KỲ",
		partnerLabel: "Kho",
		totalKey: "amount",
		columns: [
			{ key: "stt", header: "STT", span: 1, align: "center" },
			{ key: "sku", header: "Mã", span: 2, align: "left" },
			{ key: "name", header: "Tên hàng hóa", span: 3, align: "left" },
			{ key: "unit", header: "ĐVT", span: 1, align: "center" },
			{ key: "quantity", header: "Số lượng", span: 1, align: "right" },
			{ key: "unitPrice", header: "Đơn giá vốn", span: 1, align: "right" },
			{ key: "amount", header: "Thành tiền", span: 1, align: "right" },
		],
		signers: [
			{ label: "Người lập", code: "PREPARER" },
			{ label: "Thủ kho", code: "WAREHOUSE_KEEPER" },
			{ label: "Kế toán", code: "CHIEF_ACCOUNTANT" },
			{ label: "Giám đốc", code: "DIRECTOR" },
		],
	},
};

export interface GenericDocumentFill {
	code: string;
	documentDate: string;
	title?: string;
	partner?: string | null;
	dienGiai?: string | null;
	rows: Array<Record<string, string | number | null | undefined>>;
	total?: number;
}

/** Điền một trong các mẫu in sinh tự động (GENERIC_LAYOUTS) theo layout tương ứng. */
export const fillGenericDocument = (
	worksheet: ExcelJS.Worksheet,
	company: CompanyPrintProfile | null,
	layout: GenericLayout,
	data: GenericDocumentFill,
) => {
	const {
		dataStart,
		totalRow: baseTotalRow,
		wordsRow: baseWordsRow,
		signerNameRow,
	} = GENERIC_LAYOUT_ROWS;
	const count = data.rows.length;
	const extra = expandDataRows(
		worksheet,
		dataStart,
		count,
		GENERIC_LAYOUT_ROWS.columnCount,
	);
	const date = new Date(data.documentDate);
	const dateText = `${String(date.getDate()).padStart(2, "0")}/${String(
		date.getMonth() + 1,
	).padStart(2, "0")}/${date.getFullYear()}`;
	replacePlaceholders(worksheet, {
		"##Ma_phieu##": data.code,
		"##Doi_tac##": data.partner || "",
		"##Dien_giai##": data.dienGiai || "",
		"##dd/mm/yyyy##": dateText,
		"##dd##": String(date.getDate()).padStart(2, "0"),
		"##mm##": String(date.getMonth() + 1).padStart(2, "0"),
		"##yyyy##": String(date.getFullYear()),
	});
	if (data.title) worksheet.getCell("A5").value = data.title;
	const starts: Record<string, number> = {};
	let column = 1;
	for (const definition of layout.columns) {
		starts[definition.key] = column;
		column += definition.span;
	}
	for (const [index, row] of data.rows.entries()) {
		for (const [key, value] of Object.entries(row)) {
			if (value === null || value === undefined) continue;
			const startColumn = starts[key];
			if (!startColumn) continue;
			worksheet.getCell(`${toColName(startColumn)}${dataStart + index}`).value =
				value;
		}
	}
	const totalRow = baseTotalRow + extra;
	if (typeof data.total === "number") {
		const totalKey = layout.totalKey;
		if (totalKey && starts[totalKey]) {
			worksheet.getCell(`${toColName(starts[totalKey])}${totalRow}`).value =
				data.total;
		}
		const wordsRow = baseWordsRow + extra;
		worksheet.getCell(`A${wordsRow}`).value =
			`${layout.totalLabel || "Tổng số tiền"}: ${numberToVietnameseWords(data.total)}`;
	} else {
		const labelCell = worksheet.getCell(`B${totalRow}`);
		if (cellText(labelCell.value) === "Cộng") labelCell.value = null;
		worksheet.getCell(`A${baseWordsRow + extra}`).value = null;
	}
	stripPlaceholders(worksheet);
	applySigners(
		worksheet,
		company,
		layout.signers.map((signer, index) => ({
			row: signerNameRow + extra,
			col: GENERIC_SIGNER_GROUP_STARTS[index] || 1,
			code: signer.code,
		})),
	);
};

export interface CompanySignaturePrint {
	code: string;
	signerName?: string | null;
	signerTitle?: string | null;
	positionTitle?: string | null;
	displayOrder?: number;
	isActive?: boolean;
}

export interface CompanyPrintProfile {
	id?: number;
	name?: string | null;
	address?: string | null;
	taxCode?: string | null;
	phone?: string | null;
	website?: string | null;
	email?: string | null;
	logoUrl?: string | null;
	signatures?: CompanySignaturePrint[] | null;
	printSettings?: {
		printSignerNames?: boolean;
		preparerFromLoggedInUser?: boolean;
	} | null;
}

/** Ghép dữ liệu trả về từ GET /api/v1/company ({ profile, signatures, printSettings }) */
export const buildCompanyPrintProfile = (
	data: any,
): CompanyPrintProfile | null => {
	const profile = data?.profile || data || null;
	if (!profile) return null;
	return {
		...profile,
		signatures: data?.signatures ?? profile.signatures ?? null,
		printSettings: data?.printSettings ?? profile.printSettings ?? null,
	};
};

/** Thay thế tất cả placeholder ##...## trên toàn sheet (merged cells cũng được xử lý qua master cell). */
export const replacePlaceholders = (
	worksheet: ExcelJS.Worksheet,
	replacements: Record<string, string | number>,
) => {
	worksheet.eachRow((row: any) => {
		row.eachCell((cell: any) => {
			if (typeof cell.value !== "string") return;
			let text = cell.value;
			for (const [key, value] of Object.entries(replacements)) {
				text = text.split(key).join(String(value));
			}
			if (text !== cell.value) cell.value = text;
		});
	});
};

/** Xóa các placeholder ##...## còn sót lại (tránh in ra rác khi dữ liệu bị thiếu). */
export const stripPlaceholders = (worksheet: ExcelJS.Worksheet) => {
	const pattern = /#+#[A-Za-z0-9_/]+#+#/g;
	worksheet.eachRow((row: any) => {
		row.eachCell((cell: any) => {
			if (typeof cell.value !== "string") return;
			const cleaned = cell.value
				.replace(pattern, "")
				.replace(/\s{2,}/g, " ")
				.trim();
			if (cleaned !== cell.value) cell.value = cleaned;
		});
	});
};

/** Header doanh nghiệp (đọc từ /api/v1/company) cho 4 dòng đầu của mẫu. */
export const applyCompanyHeader = (
	worksheet: ExcelJS.Worksheet,
	company?: CompanyPrintProfile | null,
) => {
	const setCell = (address: string, value?: string | null) => {
		if (value) worksheet.getCell(address).value = value;
	};
	setCell(
		"A1",
		company?.name ? String(company.name).toUpperCase() : APP_COMPANY,
	);
	setCell("A2", company?.address || undefined);
	setCell(
		"A3",
		company?.taxCode ? `Mã số thuế: ${company.taxCode}` : undefined,
	);
	const extras = [
		company?.website || "",
		company?.phone ? `ĐT: ${company.phone}` : "",
		company?.email ? `Email: ${company.email}` : "",
	]
		.filter(Boolean)
		.join(" | ");
	setCell("A4", extras || undefined);
};

/**
 * Thêm N-1 dòng dữ liệu ngay dưới dataStartRow, giữ nguyên style và cấu trúc
 * merge của dòng gốc; mọi merge nằm dưới dataStartRow đều được dời xuống đúng vị trí.
 * Chỉ merge nội bộ theo cột (merged vertical ranges không được bảo toàn - tránh dùng).
 */
export const expandDataRows = (
	worksheet: ExcelJS.Worksheet,
	dataStartRow: number,
	count: number,
	columns = 12,
): number => {
	const extra = Math.max(0, count - 1);
	if (extra <= 0) return 0;
	const allMerges = (worksheet as any)._merges || {};
	const bottom: Array<{
		top: number;
		left: number;
		bottom: number;
		right: number;
		key: string;
	}> = [];
	const intra: Array<{ left: number; right: number }> = [];
	for (const key of Object.keys(allMerges)) {
		const m = allMerges[key];
		if (m.top === dataStartRow && m.bottom === dataStartRow) {
			intra.push({ left: m.left, right: m.right });
		} else if (m.top >= dataStartRow + 1) {
			bottom.push({
				top: m.top,
				left: m.left,
				bottom: m.bottom,
				right: m.right,
				key,
			});
		}
	}
	for (const m of bottom) worksheet.unMergeCells(m.key);
	const styleSource = worksheet.getRow(dataStartRow);
	worksheet.insertRows(
		dataStartRow + 1,
		Array.from({ length: extra }, () => []),
		"h",
	);
	for (let i = 0; i < extra; i++) {
		const target = worksheet.getRow(dataStartRow + 1 + i);
		target.height = styleSource.height;
		for (let c = 1; c <= columns; c++) {
			const style = (styleSource.getCell(c) as any).style;
			if (style && Object.keys(style).length) {
				(target.getCell(c) as any).style = JSON.parse(JSON.stringify(style));
			}
		}
	}
	const shift = extra;
	for (const m of bottom) {
		worksheet.mergeCells(m.top + shift, m.left, m.bottom + shift, m.right);
	}
	for (let i = 0; i < extra; i++) {
		const row = dataStartRow + 1 + i;
		for (const m of intra) worksheet.mergeCells(row, m.left, row, m.right);
	}
	return extra;
};

export const toColName = (col: number) => {
	let name = "";
	let value = col;
	while (value > 0) {
		const remainder = (value - 1) % 26;
		name = String.fromCharCode(65 + remainder) + name;
		value = Math.floor((value - 1) / 26);
	}
	return name;
};

/** Ghi dữ liệu vào một dòng theo map cột -> giá trị (value null/false sẽ bị bỏ qua). */
export const writeDataRow = (
	worksheet: ExcelJS.Worksheet,
	row: number,
	values: Record<string, string | number | null | undefined>,
) => {
	for (const [col, value] of Object.entries(values)) {
		if (value === null || value === undefined) continue;
		worksheet.getCell(`${col}${row}`).value = value;
	}
};

export interface SignerSpec {
	row: number;
	col: number;
	code: string;
}

const CURRENT_USER_KEY = "user";

const currentUserName = (): string => {
	if (typeof window === "undefined") return "";
	try {
		const user = JSON.parse(localStorage.getItem(CURRENT_USER_KEY) || "{}");
		return typeof user?.fullName === "string" ? user.fullName : "";
	} catch {
		return "";
	}
};

/**
 * Điền tên người ký vào các ô "(Ký, họ tên)" nếu công ty bật
 * printSettings.printSignerNames. Người lập phiếu (PREPARER) lấy tên
 * người đang đăng nhập nếu printSettings.preparerFromLoggedInUser.
 */
export const applySigners = (
	worksheet: ExcelJS.Worksheet,
	company?: CompanyPrintProfile | null,
	specs: SignerSpec[] = [],
) => {
	const settings = company?.printSettings;
	if (!settings?.printSignerNames) return;
	const byCode = new Map(
		(company?.signatures || []).map(sig => [sig.code, sig]),
	);
	for (const spec of specs) {
		const signature = byCode.get(spec.code);
		let name =
			signature && signature.isActive !== false
				? signature.signerName || ""
				: "";
		if (
			!name &&
			spec.code === "PREPARER" &&
			settings.preparerFromLoggedInUser !== false
		) {
			name = currentUserName();
		}
		if (!name) continue;
		const cell = worksheet.getCell(`${toColName(spec.col)}${spec.row}`);
		cell.value = name;
	}
};

export interface ProductionOrderLine {
	sku?: string | null;
	name?: string | null;
	unit?: string | null;
	quantity: number;
}

export interface ProductionOrderFill {
	code: string;
	orderDate: string;
	note?: string | null;
	outputs: ProductionOrderLine[];
	materials: ProductionOrderLine[];
}

/** Layout mẫu Lenh-san-xuat.xlsx: thành phẩm R10, định mức NVL R14, chữ ký R16/17. */
const LSX_LAYOUT = {
	outputDataStart: 10,
	nvlHeaderStart: 13,
	nvlDataStart: 14,
	signerLabel: 16,
	signerCols: [
		{ col: 1, code: "PREPARER" },
		{ col: 4, code: "" },
		{ col: 6, code: "" },
		{ col: 9, code: "DIRECTOR" },
	],
} as const;

/** Điền lệnh sản xuất (template Lenh-san-xuat.xlsx): đủ dòng thành phẩm + NVL. */
export const fillProductionOrder = (
	worksheet: ExcelJS.Worksheet,
	company: CompanyPrintProfile | null,
	options: ProductionOrderFill,
) => {
	const { outputDataStart, nvlDataStart, signerLabel, signerCols } = LSX_LAYOUT;
	const outCount = options.outputs.length;
	const outExtra = expandDataRows(worksheet, outputDataStart, outCount, 12);
	const nvlStart = nvlDataStart + outExtra;
	const matCount = options.materials.length;
	const matExtra = expandDataRows(worksheet, nvlStart, matCount, 12);
	const date = new Date(options.orderDate);
	const dateText = `${String(date.getDate()).padStart(2, "0")}/${String(
		date.getMonth() + 1,
	).padStart(2, "0")}/${date.getFullYear()}`;
	replacePlaceholders(worksheet, {
		"##Ma_LSX##": options.code,
		"##Ngay_tao_lenh##": dateText,
		"##dd##": String(date.getDate()).padStart(2, "0"),
		"##mm##": String(date.getMonth() + 1).padStart(2, "0"),
		"##yyyy##": String(date.getFullYear()),
		"##Dien_giai##": options.note || "",
	});
	for (const [index, output] of options.outputs.entries()) {
		writeDataRow(worksheet, outputDataStart + index, {
			A: output.sku || "",
			D: output.name || "",
			G: output.unit || "",
			H: Number(output.quantity || 0),
			I: "",
		});
	}
	for (const [index, material] of options.materials.entries()) {
		writeDataRow(worksheet, nvlStart + index, {
			A: material.sku || "",
			D: material.name || "",
			H: material.unit || "",
			I: Number(material.quantity || 0),
		});
	}
	stripPlaceholders(worksheet);
	applySigners(
		worksheet,
		company,
		signerCols.map(spec => ({
			row: signerLabel + 1 + outExtra + matExtra,
			col: spec.col,
			code: spec.code,
		})),
	);
};

/** Layout mẫu Phieu-xuat-chuyen-kho.xlsx. */
const CHUYEN_KHO_LAYOUT = {
	dataStart: 11,
	totalRow: 12,
	wordsRow: 13,
	signerNameRow: 16,
	signerCols: [
		{ col: 1, code: "PREPARER" },
		{ col: 5, code: "WAREHOUSE_KEEPER" },
		{ col: 9, code: "WAREHOUSE_KEEPER" },
		{ col: 13, code: "" },
	],
} as const;

export interface WarehouseTransferFill {
	code: string;
	transferDate: string;
	fromWarehouseName?: string | null;
	toWarehouseName?: string | null;
	note?: string | null;
	address?: string | null;
	details: WarehouseDocumentLine[];
}

/** Điền phiếu xuất chuyển kho (template Phieu-xuat-chuyen-kho.xlsx). */
export const fillWarehouseTransfer = (
	worksheet: ExcelJS.Worksheet,
	company: CompanyPrintProfile | null,
	options: WarehouseTransferFill,
) => {
	const {
		dataStart,
		totalRow: baseTotalRow,
		wordsRow: baseWordsRow,
		signerNameRow,
		signerCols,
	} = CHUYEN_KHO_LAYOUT;
	const count = options.details.length;
	const extra = expandDataRows(worksheet, dataStart, count, 14);
	const total = options.details.reduce(
		(sum, line) => sum + Number(line.totalValue || 0),
		0,
	);
	const date = new Date(options.transferDate);
	const dateText = `${String(date.getDate()).padStart(2, "0")}/${String(
		date.getMonth() + 1,
	).padStart(2, "0")}/${date.getFullYear()}`;
	replacePlaceholders(worksheet, {
		"##Ma_phieu##": options.code,
		"##dd/mm/yyyy##": dateText,
		"##dd##": String(date.getDate()).padStart(2, "0"),
		"##mm##": String(date.getMonth() + 1).padStart(2, "0"),
		"##yyyy##": String(date.getFullYear()),
		"##Dien_giai##": options.note || "",
		"##Dia_chi##": options.address || "",
	});
	for (const [index, line] of options.details.entries()) {
		writeDataRow(worksheet, dataStart + index, {
			A: index + 1,
			B: line.sku || "",
			D: [line.productName, line.packagingName]
				.filter(name => Boolean(name))
				.join(" - "),
			I: line.unit || "",
			J: Number(line.quantity || 0),
			K: Number(line.unitCost || 0),
			M: Number(line.totalValue || 0),
		});
	}
	const totalRow = baseTotalRow + extra;
	worksheet.getCell(`M${totalRow}`).value = total;
	worksheet.getCell(`J${totalRow}`).value = null;
	const wordsRow = baseWordsRow + extra;
	const wordsCell = worksheet.getCell(`A${wordsRow}`);
	wordsCell.value = `- Tổng số tiền (Viết bằng chữ): ${numberToVietnameseWords(total)}`;
	stripPlaceholders(worksheet);
	applySigners(
		worksheet,
		company,
		signerCols.map(spec => ({
			row: signerNameRow + extra,
			col: spec.col,
			code: spec.code,
		})),
	);
};

export const numberToVietnameseWords = (amount: number) => {
	if (!Number.isFinite(amount)) return "Không đồng";
	const digits = [
		"không",
		"một",
		"hai",
		"ba",
		"bốn",
		"năm",
		"sáu",
		"bảy",
		"tám",
		"chín",
	];
	const scales = ["", "nghìn", "triệu", "tỷ", "nghìn tỷ", "triệu tỷ"];
	const readBlock = (value: number, full: boolean) => {
		const hundred = Math.floor(value / 100),
			ten = Math.floor((value % 100) / 10),
			unit = value % 10;
		const words: string[] = [];
		if (hundred || full) words.push(`${digits[hundred]} trăm`);
		if (ten > 1) {
			words.push(`${digits[ten]} mươi`);
			if (unit === 1) words.push("mốt");
			else if (unit === 5) words.push("lăm");
			else if (unit) words.push(digits[unit]);
		} else if (ten === 1) {
			words.push("mười");
			if (unit === 5) words.push("lăm");
			else if (unit) words.push(digits[unit]);
		} else if (unit) {
			if (hundred || full) words.push("lẻ");
			words.push(digits[unit]);
		}
		return words.join(" ");
	};
	let value = Math.round(Math.abs(amount));
	if (!value) return "Không đồng";
	const blocks: number[] = [];
	while (value > 0) {
		blocks.push(value % 1000);
		value = Math.floor(value / 1000);
	}
	const words: string[] = [];
	for (let index = blocks.length - 1; index >= 0; index--)
		if (blocks[index]) {
			words.push(
				readBlock(
					blocks[index],
					index < blocks.length - 1 && blocks[index] < 100,
				),
			);
			if (scales[index]) words.push(scales[index]);
		}
	const text = words.join(" ").replace(/\s+/g, " ").trim();
	return `${text.charAt(0).toUpperCase()}${text.slice(1)} đồng`;
};

export interface WarehouseDocumentLine {
	sku?: string | null;
	productName?: string | null;
	packagingName?: string | null;
	unit?: string | null;
	quantity: number;
	unitCost: number;
	totalValue: number;
}

export interface WarehouseDocumentFill {
	type: "EXPORT" | "IMPORT";
	code: string;
	transactionDate: string;
	warehouseName?: string | null;
	partner?: string | null;
	address?: string | null;
	dienGiai?: string | null;
	details: WarehouseDocumentLine[];
}

/** Layout mẫu Phieu-xuat.xlsx / Phieu-nhap.xlsx (dòng data, dòng Cộng, dòng chữ, dòng ngày, dòng chữ ký). */
const WAREHOUSE_LAYOUT = {
	EXPORT: {
		dataStart: 14,
		signerLabel: 18,
		signerCols: [
			{ col: 1, code: "PREPARER" },
			{ col: 5, code: "" },
			{ col: 9, code: "DIRECTOR" },
		],
	},
	IMPORT: {
		dataStart: 13,
		signerLabel: 17,
		signerCols: [
			{ col: 1, code: "PREPARER" },
			{ col: 5, code: "" },
			{ col: 7, code: "" },
			{ col: 9, code: "DIRECTOR" },
		],
	},
} as const;

/** Điền phiếu xuất/nhập kho (template Phieu-xuat.xlsx / Phieu-nhap.xlsx). */
export const fillWarehouseDocument = (
	worksheet: ExcelJS.Worksheet,
	company: CompanyPrintProfile | null,
	options: WarehouseDocumentFill,
) => {
	const layout = WAREHOUSE_LAYOUT[options.type];
	const dataStart = layout.dataStart;
	const count = options.details.length;
	const extra = expandDataRows(worksheet, dataStart, count);
	const total = options.details.reduce(
		(sum, line) => sum + Number(line.totalValue || 0),
		0,
	);
	const date = new Date(options.transactionDate);
	replacePlaceholders(worksheet, {
		"##Ma_phieu##": options.code,
		"##Nguoi_giao##": options.partner || "",
		"##Khach_hang##": options.partner || "",
		"##Dia_chi##": options.address || "",
		"##Dien_giai##": options.dienGiai || "",
		"##Ten_kho##": options.warehouseName || "",
		"##dd##": String(date.getDate()).padStart(2, "0"),
		"##mm##": String(date.getMonth() + 1).padStart(2, "0"),
		"##yyyy##": String(date.getFullYear()),
	});
	for (const [index, line] of options.details.entries()) {
		writeDataRow(worksheet, dataStart + index, {
			A: index + 1,
			B: line.sku || "",
			D: [line.productName, line.packagingName]
				.filter(name => Boolean(name))
				.join(" - "),
			G: line.unit || "",
			H: Number(line.quantity || 0),
			I: Number(line.unitCost || 0),
			K: Number(line.totalValue || 0),
		});
	}
	const totalRow = dataStart + count;
	worksheet.getCell(`K${totalRow}`).value = total;
	const wordsCell = worksheet.getCell(`D${totalRow + 1}`);
	wordsCell.value = `- Tổng số tiền (Viết bằng chữ): ${numberToVietnameseWords(total)}`;
	stripPlaceholders(worksheet);
	applySigners(
		worksheet,
		company,
		layout.signerCols.map(spec => ({
			row: layout.signerLabel + 1 + extra,
			col: spec.col,
			code: spec.code,
		})),
	);
};
