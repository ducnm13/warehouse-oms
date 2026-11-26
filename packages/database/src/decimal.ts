import { Prisma } from "@prisma/client";

/**
 * Helper Decimal dùng chung cho toàn hệ thống.
 *
 * Quy ước làm tròn:
 *  - Tiền / thành tiền / công nợ: 2 chữ số thập phân (DECIMAL(18,2)).
 *  - Đơn giá / định mức / số lượng: 4 chữ số thập phân (DECIMAL(18,4)).
 *  - Luôn ROUND_HALF_UP để khớp với MySQL DECIMAL và kỳ vọng kế toán.
 */
export type DecimalInput = number | string | Prisma.Decimal | null | undefined;

const ROUNDING = Prisma.Decimal.ROUND_HALF_UP;
const MONEY_PLACES = 2;
const DECIMAL_PLACES = 4;

/**
 * Ép mọi giá trị về Prisma.Decimal an toàn.
 * null/undefined/chuỗi rỗng/NaN/Infinity đều trả về 0 thay vì ném lỗi.
 */
export function toDecimal(value: DecimalInput): Prisma.Decimal {
	if (value === null || value === undefined || value === "") return new Prisma.Decimal(0);
	if (value instanceof Prisma.Decimal) return value.isFinite() ? value : new Prisma.Decimal(0);
	try {
		const parsed = new Prisma.Decimal(value);
		return parsed.isFinite() ? parsed : new Prisma.Decimal(0);
	} catch {
		return new Prisma.Decimal(0);
	}
}

/** Tiền / công nợ: làm tròn 2 chữ số thập phân (ROUND_HALF_UP). */
export const money = (value: DecimalInput): Prisma.Decimal =>
	toDecimal(value).toDecimalPlaces(MONEY_PLACES, ROUNDING);

/** Tiền / công nợ cho cột nullable: null giữ nguyên null. */
export const moneyOrNull = (value: DecimalInput): Prisma.Decimal | null =>
	value === null || value === undefined || value === "" ? null : money(value);

/** Đơn giá / định mức / số lượng: làm tròn 4 chữ số thập phân (ROUND_HALF_UP). */
export const decimal = (value: DecimalInput): Prisma.Decimal =>
	toDecimal(value).toDecimalPlaces(DECIMAL_PLACES, ROUNDING);

/** Đơn giá / định mức / số lượng cho cột nullable: null giữ nguyên null. */
export const decimalOrNull = (value: DecimalInput): Prisma.Decimal | null =>
	value === null || value === undefined || value === "" ? null : decimal(value);

/** Chuyển Decimal (hoặc giá trị thô từ raw SQL) về number để serialize/DTO. */
export const toNumber = (value: DecimalInput): number => {
	if (value === null || value === undefined || value === "") return 0;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
};
