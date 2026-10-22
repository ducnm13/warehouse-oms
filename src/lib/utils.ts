import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n);
}

export function formatInteger(n: number) {
  return Number.isInteger(n) 
    ? new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(n)
    : new Intl.NumberFormat('vi-VN').format(n);
}

export function parseNumberWithSeparators(str: string): number {
  return Number(str.replace(/[,.]/g, '')) || 0;
}

export function formatNumberInput(value: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value);
}

// Số lượng chỉ cho phép thập phân với đơn vị khối lượng (kg); các đơn vị đếm
// (gói, hộp, chai, túi...) phải là số nguyên.
export function quantityAllowsDecimal(unit?: string | null) {
  return (unit || '').trim().toLowerCase() === 'kg';
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('vi-VN');
}

function normalizeProductPart(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export function collapseRepeatedName(value?: string | null) {
  const normalized = normalizeProductPart(value);
  if (!normalized) return '';
  const parts = normalized
    .split(/\s+-\s+/)
    .map(part => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return normalized;
  const seen = new Set<string>();
  const unique = parts.filter(part => {
    const key = part.toLocaleLowerCase('vi');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique.join(' - ');
}

export function formatProductName(
  productName?: string | null,
  packagingName?: string | null,
) {
  const pn = collapseRepeatedName(productName);
  const pkn = collapseRepeatedName(packagingName);
  if (!pn) return pkn;
  if (!pkn) return pn;
  const pnKey = pn.toLocaleLowerCase('vi');
  const pknKey = pkn.toLocaleLowerCase('vi');
  if (pnKey === pknKey || pnKey.includes(pknKey)) return pn;
  if (pknKey.includes(pnKey)) return pkn;
  return collapseRepeatedName(`${pn} - ${pkn}`);
}
