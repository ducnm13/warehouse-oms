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

export function formatProductName(productName?: string, packagingName?: string) {
  const pn = (productName || '').trim();
  const pkn = (packagingName || '').trim();
  if (!pn) return pkn;
  if (!pkn) return pn;
  if (pn === pkn) return pn;
  return `${pn} - ${pkn}`;
}
