import { useCallback, useEffect, useRef } from "react";

const EDITABLE_SELECTOR =
	'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

/**
 * Gắn vào <table> dòng hàng. Khi người dùng nhấn Tab ở ô nhập cuối cùng
 * của dòng cuối, tự thêm dòng mới và focus ô đầu tiên của dòng mới.
 * Dùng callback ref để tự gắn/gỡ listener khi bảng được mount/unmount
 * (bảng thường chỉ render khi mở drawer).
 */
export function useLineTableTab(onAddRow: () => void) {
	const addRowRef = useRef(onAddRow);
	addRowRef.current = onAddRow;
	const cleanupRef = useRef<(() => void) | null>(null);

	const tableRef = useCallback((table: HTMLTableElement | null) => {
		cleanupRef.current?.();
		cleanupRef.current = null;
		if (!table) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Tab" || event.shiftKey || event.defaultPrevented)
				return;
			const active = document.activeElement as HTMLElement | null;
			if (!active || !table.contains(active)) return;

			const rows = Array.from(
				table.querySelectorAll<HTMLTableRowElement>("tbody tr"),
			);
			if (!rows.length) return;
			const lastRow = rows[rows.length - 1];
			if (!lastRow.contains(active)) return;

			const fields = Array.from(
				lastRow.querySelectorAll<HTMLElement>(EDITABLE_SELECTOR),
			);
			if (!fields.length || fields[fields.length - 1] !== active) return;

			event.preventDefault();
			addRowRef.current();
			window.setTimeout(() => {
				const nextRows =
					table.querySelectorAll<HTMLTableRowElement>("tbody tr");
				const newLastRow = nextRows[nextRows.length - 1];
				const firstField =
					newLastRow?.querySelector<HTMLElement>(EDITABLE_SELECTOR);
				firstField?.focus();
			}, 40);
		};

		table.addEventListener("keydown", handleKeyDown);
		cleanupRef.current = () => table.removeEventListener("keydown", handleKeyDown);
	}, []);

	useEffect(
		() => () => {
			cleanupRef.current?.();
		},
		[],
	);

	return tableRef;
}
