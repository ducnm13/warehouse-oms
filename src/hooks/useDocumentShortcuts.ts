import { useEffect, useRef } from "react";

export interface DocumentShortcutConfig {
	/** Bật/tắt toàn bộ phím tắt của trang. */
	enabled?: boolean;
	/** Trả về true khi đang có dialog/preview khác chặn phím tắt. */
	isBlocked?: () => boolean;
	/** Ctrl/Cmd + S */
	onSave?: () => void;
	/** Ctrl/Cmd + Q */
	onSaveAndClose?: () => void;
	/** Ctrl/Cmd + P */
	onPrint?: () => void;
	/** Ctrl/Cmd + E */
	onEdit?: () => void;
	/** Ctrl/Cmd + D */
	onDelete?: () => void;
	/** Ctrl/Cmd + Shift + C */
	onDuplicate?: () => void;
}

/**
 * Đăng ký phím tắt chứng từ ở cấp trang:
 * Ctrl+S lưu, Ctrl+Q cất & đóng, Ctrl+P in, Ctrl+E sửa,
 * Ctrl+D xóa, Ctrl+Shift+C nhân bản.
 */
export function useDocumentShortcuts(config: DocumentShortcutConfig) {
	const latest = useRef(config);
	latest.current = config;

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			const cfg = latest.current;
			if (cfg.enabled === false) return;
			if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
			if (event.defaultPrevented || cfg.isBlocked?.()) return;

			const key = event.key.toLowerCase();
			let action: (() => void) | undefined;

			if (key === "s" && !event.shiftKey) action = cfg.onSave;
			else if (key === "q" && !event.shiftKey) action = cfg.onSaveAndClose;
			else if (key === "p" && !event.shiftKey) action = cfg.onPrint;
			else if (key === "e" && !event.shiftKey) action = cfg.onEdit;
			else if (key === "d" && !event.shiftKey) action = cfg.onDelete;
			else if (key === "c" && event.shiftKey) action = cfg.onDuplicate;

			if (!action) return;
			event.preventDefault();
			event.stopPropagation();
			action();
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);
}
