import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('vi-VN').format(n);
}

export function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('vi-VN');
}
