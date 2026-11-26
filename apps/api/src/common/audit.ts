import { Prisma } from "@challenge/database";

/**
 * Nhật ký kiểm toán theo từng trường.
 *
 * Mỗi bản ghi audit_logs có thể kèm `changes` dạng JSON:
 *   [{ field, label, oldValue, newValue }]
 * để truy vết chính xác ai đã đổi trường nào, từ giá trị nào sang giá trị nào.
 */
export type AuditField = { key: string; label: string };

export type AuditChange = {
	field: string;
	label: string;
	oldValue: unknown;
	newValue: unknown;
};

export type AuditEntry = {
	action: string;
	details?: string | null;
	entityType?: string | null;
	entityId?: string | number | bigint | null;
	entityCode?: string | null;
	userId?: number | null;
	userName?: string | null;
	createdAt?: string;
	/** Danh sách thay đổi đã chuẩn bị sẵn. */
	changes?: AuditChange[] | null;
	/** Hoặc để helper tự so sánh trước/sau theo các trường cho trước. */
	before?: Record<string, any> | null;
	after?: Record<string, any> | null;
	fields?: AuditField[] | null;
};

const normalize = (value: unknown): unknown => {
	if (value === null || value === undefined) return null;
	if (value instanceof Date) return value.toISOString();
	if (Prisma.Decimal.isDecimal(value)) return value.toString();
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value === "bigint") return value.toString();
	if (typeof value === "string" || typeof value === "boolean") return value;
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
};

const isSame = (left: unknown, right: unknown) =>
	JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));

/** Ảnh chụp các trường của bản ghi mới tạo (oldValue = null). */
export function snapshotFields(
	source: Record<string, any> | null | undefined,
	fields: AuditField[],
): AuditChange[] {
	if (!source) return [];
	return fields
		.filter(({ key }) => source[key] !== undefined)
		.map(({ key, label }) => ({
			field: key,
			label,
			oldValue: null,
			newValue: normalize(source[key]),
		}));
}

/** So sánh hai object (header chứng từ, danh mục...) theo danh sách trường cần ghi. */
export function diffFields(
	before: Record<string, any> | null | undefined,
	after: Record<string, any> | null | undefined,
	fields: AuditField[],
): AuditChange[] {
	if (!before || !after) return [];
	return fields
		.filter(({ key }) => !isSame(before[key], after[key]))
		.map(({ key, label }) => ({
			field: key,
			label,
			oldValue: normalize(before[key]),
			newValue: normalize(after[key]),
		}));
}

/**
 * So sánh hai mảng dòng hàng theo thứ tự hiển thị.
 * Ghi rõ từng trường của từng dòng: details[0].quantity, details[0].unitPrice...
 */
export function diffLines(
	beforeLines: Array<Record<string, any>> | null | undefined,
	afterLines: Array<Record<string, any>> | null | undefined,
	fields: AuditField[],
	prefix = "details",
): AuditChange[] {
	const before = beforeLines || [];
	const after = afterLines || [];
	const changes: AuditChange[] = [];
	const length = Math.max(before.length, after.length);
	for (let index = 0; index < length; index++) {
		const oldLine = before[index];
		const newLine = after[index];
		for (const { key, label } of fields) {
			const oldValue = oldLine?.[key];
			const newValue = newLine?.[key];
			if (isSame(oldValue, newValue)) continue;
			changes.push({
				field: `${prefix}[${index}].${key}`,
				label: `Dòng ${index + 1} - ${label}`,
				oldValue: normalize(oldValue),
				newValue: normalize(newValue),
			});
		}
	}
	return changes;
}

/** Ghi một bản ghi audit, tự động lấy IP/User-Agent từ request context. */
export async function recordAudit(tx: any, entry: AuditEntry) {
	const changes =
		entry.changes ??
		(entry.before && entry.after && entry.fields
			? diffFields(entry.before, entry.after, entry.fields)
			: []);
	const payload = changes.length
		? JSON.stringify(
				changes.map(change => ({
					field: change.field,
					label: change.label,
					oldValue: normalize(change.oldValue),
					newValue: normalize(change.newValue),
				})),
			)
		: null;
	const data = {
		action: entry.action,
		details: entry.details ?? entry.entityCode ?? null,
		entityType: entry.entityType ?? null,
		entityId: entry.entityId === null || entry.entityId === undefined ? null : String(entry.entityId),
		entityCode: entry.entityCode ?? null,
		changes: payload,
		userId: entry.userId ?? null,
		userName: entry.userName ?? (entry.userId ? String(entry.userId) : null),
		createdAt: entry.createdAt ?? new Date().toISOString(),
	};
	await tx.audit_logs.create({ data });
	return data;
}

/** Nhãn hiển thị cho các trường phổ biến, dùng lại giữa các service. */
export const FIELD_LABELS = {
	code: "Mã chứng từ",
	status: "Trạng thái",
	documentStatus: "Trạng thái",
	documentDate: "Ngày chứng từ",
	orderDate: "Ngày đơn",
	deliveryDate: "Ngày giao",
	dueDate: "Hạn thanh toán",
	customerId: "Khách hàng",
	supplierId: "Nhà cung cấp",
	warehouseId: "Kho",
	fromWarehouseId: "Kho xuất",
	toWarehouseId: "Kho nhập",
	note: "Ghi chú",
	reason: "Lý do",
	description: "Diễn giải",
	paymentMethod: "Phương thức thanh toán",
	paymentIntent: "Hình thức thanh toán",
	paymentStatus: "Trạng thái thanh toán",
	paidAmount: "Đã thanh toán",
	totalAmount: "Tổng tiền",
	subtotal: "Tiền hàng",
	discountAmount: "Chiết khấu",
	taxAmount: "Thuế",
	taxRate: "Thuế suất",
	purchaseCost: "Chi phí mua",
	inventoryValue: "Giá trị nhập kho",
	type: "Loại chứng từ",
	quantity: "Số lượng",
	unitPrice: "Đơn giá",
	discountRate: "Chiết khấu (%)",
	lineTotal: "Thành tiền",
	lineAmount: "Thành tiền",
	packagingId: "Mã hàng hóa",
	unitCost: "Giá vốn",
	batchNumber: "Số lô",
	expiryDate: "Hạn sử dụng",
} satisfies Record<string, string>;

export const lineFieldLabels = (): AuditField[] => [
	{ key: "packagingId", label: FIELD_LABELS.packagingId },
	{ key: "quantity", label: FIELD_LABELS.quantity },
	{ key: "unitPrice", label: FIELD_LABELS.unitPrice },
	{ key: "discountRate", label: FIELD_LABELS.discountRate },
	{ key: "taxRate", label: FIELD_LABELS.taxRate },
	{ key: "lineTotal", label: FIELD_LABELS.lineTotal },
	{ key: "lineAmount", label: FIELD_LABELS.lineAmount },
	{ key: "unitCost", label: FIELD_LABELS.unitCost },
	{ key: "batchNumber", label: FIELD_LABELS.batchNumber },
	{ key: "expiryDate", label: FIELD_LABELS.expiryDate },
	{ key: "note", label: FIELD_LABELS.note },
];
