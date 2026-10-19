/* Hộp xác nhận dùng chung (thay window.confirm): giữa màn hình + animation.
   Dùng: const confirm = useConfirm(); if (await confirm("Chắc chắn xóa?")) ... */
import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, HelpCircle } from "lucide-react";
import "./confirm-dialog.css";

export interface ConfirmOptions {
	message: string;
	title?: string;
	confirmText?: string;
	cancelText?: string;
	tone?: "danger" | "primary";
}

interface PendingConfirm extends Required<Omit<ConfirmOptions, "title">> {
	title: string;
	resolve: (value: boolean) => void;
}

const ConfirmContext = createContext<(options: ConfirmOptions | string) => Promise<boolean>>(
	() => Promise.resolve(false),
);

export const useConfirm = () => useContext(ConfirmContext);

export interface PromptOptions {
	message: string;
	title?: string;
	defaultValue?: string;
	placeholder?: string;
	multiline?: boolean;
	minLength?: number;
	maxLength?: number;
	confirmText?: string;
	cancelText?: string;
	tone?: "danger" | "primary";
	inputMode?: "text" | "decimal" | "numeric";
}

interface PendingPrompt extends PromptOptions {
	resolve: (value: string | null) => void;
}

let promptRequester: ((options: PromptOptions | string) => Promise<string | null>) | null = null;

export function prompt(options: PromptOptions | string): Promise<string | null> {
	if (promptRequester) return promptRequester(options);
	if (typeof window !== "undefined" && typeof window.prompt === "function") {
		return Promise.resolve(
			window.prompt(
				typeof options === "string" ? options : options.message,
				typeof options === "string" ? undefined : options.defaultValue,
			),
		);
	}
	return Promise.resolve(null);
}

// Hàm dùng trực tiếp (không cần hook): cần <ConfirmProvider> đã mount (đã có ở App).
// Trả về Promise<boolean> — luôn await khi gọi.
let requester: ((options: ConfirmOptions | string) => Promise<boolean>) | null = null;

export function confirm(options: ConfirmOptions | string): Promise<boolean> {
	if (requester) return requester(options);
	return Promise.resolve(
		typeof window !== "undefined" && typeof window.confirm === "function"
			? window.confirm(typeof options === "string" ? options : options.message)
			: false,
	);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
	const [current, setCurrent] = useState<PendingConfirm | null>(null);
	const [leaving, setLeaving] = useState(false);
	const [promptState, setPromptState] = useState<(Required<Omit<PendingPrompt, "resolve" | "tone">> & Pick<PendingPrompt, "tone"> & { resolve: (value: string | null) => void }) | null>(null);
	const [promptLeaving, setPromptLeaving] = useState(false);
	const [promptError, setPromptError] = useState("");
	const timer = useRef(0);

	const ask = useCallback((options: ConfirmOptions | string) => {
		const normalized: ConfirmOptions =
			typeof options === "string" ? { message: options } : options;
		return new Promise<boolean>(resolve => {
			window.clearTimeout(timer.current);
			setLeaving(false);
			setCurrent({
				title: normalized.title || "Xác nhận",
				message: normalized.message,
				confirmText: normalized.confirmText || "Đồng ý",
				cancelText: normalized.cancelText || "Hủy",
				tone: normalized.tone || "danger",
				resolve,
			});
		});
	}, []);

	const settle = useCallback(
		(value: boolean) => {
			if (!current) return;
			setLeaving(true);
			timer.current = window.setTimeout(() => {
				setCurrent(prev => {
					prev?.resolve(value);
					return null;
				});
				setLeaving(false);
			}, 160);
		},
		[current],
	);

	const askPrompt = useCallback((options: PromptOptions | string) => {
		const normalized: PromptOptions =
			typeof options === "string" ? { message: options } : options;
		return new Promise<string | null>(resolve => {
			window.clearTimeout(timer.current);
			setPromptLeaving(false);
			setPromptError("");
			setPromptState({
				message: normalized.message,
				title: normalized.title || "Nhập thông tin",
				defaultValue: normalized.defaultValue || "",
				placeholder: normalized.placeholder || "",
				multiline: normalized.multiline || false,
				minLength: normalized.minLength || 0,
				maxLength: normalized.maxLength || 1000,
				confirmText: normalized.confirmText || "Đồng ý",
				cancelText: normalized.cancelText || "Hủy",
				tone: normalized.tone || "primary",
				inputMode: normalized.inputMode || "text",
				resolve,
			});
		});
	}, []);

	const settlePrompt = useCallback(
		(value: string | null) => {
			if (!promptState) return;
			setPromptLeaving(true);
			timer.current = window.setTimeout(() => {
				setPromptState(prev => {
					prev?.resolve(value);
					return null;
				});
				setPromptLeaving(false);
			}, 160);
		},
		[promptState],
	);

	useEffect(() => {
		requester = ask;
		promptRequester = askPrompt;
		return () => {
			if (requester === ask) requester = null;
			if (promptRequester === askPrompt) promptRequester = null;
			window.clearTimeout(timer.current);
		};
	}, [ask, askPrompt]);

	useEffect(() => {
		if (!current || leaving) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") settle(false);
			if (e.key === "Enter") settle(true);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [current, leaving, settle]);

	useEffect(() => {
		if (!promptState || promptLeaving) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") settlePrompt(null);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [promptState, promptLeaving, settlePrompt]);

	const submitPrompt = (value: string) => {
		if (!promptState) return;
		if (value.trim().length < promptState.minLength) {
			setPromptError(`Nhập ít nhất ${promptState.minLength} ký tự`);
			return;
		}
		settlePrompt(value);
	};

	return (
		<ConfirmContext.Provider value={ask}>
			{children}
			{current &&
				createPortal(
					<div
						className={`cfm-backdrop${leaving ? " cfm-leave" : ""}`}
						onMouseDown={e => {
							if (e.target === e.currentTarget) settle(false);
						}}
					>
						<div className="cfm-card" role="alertdialog" aria-modal="true" aria-label={current.title}>
							<div className={`cfm-icon ${current.tone}`}>
								{current.tone === "danger" ? <AlertTriangle size={22} /> : <HelpCircle size={22} />}
							</div>
							<p className="cfm-title">{current.title}</p>
							<p className="cfm-message">{current.message}</p>
							<div className="cfm-actions">
								<button type="button" className="erp-btn" onClick={() => settle(false)} autoFocus={current.tone === "danger"}>
									{current.cancelText}
								</button>
								<button
									type="button"
									className={`erp-btn ${current.tone === "danger" ? "" : "erp-btn-primary"}`}
									style={current.tone === "danger" ? { background: "#d92d20", color: "#fff" } : undefined}
									onClick={() => settle(true)}
									autoFocus={current.tone !== "danger"}
								>
									{current.confirmText}
								</button>
							</div>
						</div>
					</div>,
					document.body,
				)}
			{promptState &&
				createPortal(
					<div
						className={`cfm-backdrop${promptLeaving ? " cfm-leave" : ""}`}
						onMouseDown={e => {
							if (e.target === e.currentTarget) settlePrompt(null);
						}}
					>
						<div className="cfm-card" role="dialog" aria-modal="true" aria-label={promptState.title}>
							<p className="cfm-title">{promptState.title}</p>
							<p className="cfm-message">{promptState.message}</p>
							<form
								onSubmit={e => {
									e.preventDefault();
									const data = new FormData(e.currentTarget);
									submitPrompt(String(data.get("value") || ""));
								}}
							>
								{promptState.multiline ? (
									<textarea
										name="value"
										rows={3}
										defaultValue={promptState.defaultValue}
										placeholder={promptState.placeholder}
										maxLength={promptState.maxLength}
										autoFocus
										className="cfm-input"
										onChange={() => setPromptError("")}
									/>
								) : (
									<input
										name="value"
										defaultValue={promptState.defaultValue}
										placeholder={promptState.placeholder}
										maxLength={promptState.maxLength}
										autoFocus
										inputMode={promptState.inputMode === "text" ? undefined : promptState.inputMode}
										className="cfm-input"
										onChange={() => setPromptError("")}
									/>
								)}
								{promptError && <p className="cfm-error">{promptError}</p>}
								<div className="cfm-actions">
									<button type="button" className="erp-btn" onClick={() => settlePrompt(null)}>
										{promptState.cancelText}
									</button>
									<button type="submit" className="erp-btn erp-btn-primary">
										{promptState.confirmText}
									</button>
								</div>
							</form>
						</div>
					</div>,
					document.body,
				)}
		</ConfirmContext.Provider>
	);
}
