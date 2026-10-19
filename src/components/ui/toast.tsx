/* Lucian UX/UI Prompt #070 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#070 */
// Stacking toast notifications ported to React. Drop-in replacement for the
// previous react-hot-toast renderer: same `toast` call signatures, real app
// messages, no demo content.
import React, {
	useEffect,
	useLayoutEffect,
	useReducer,
	useRef,
	useState,
	useSyncExternalStore,
} from "react";
import "./stacking-toasts.css";

export type ToastKind = "success" | "error" | "loading" | "info";

export interface ToastOptions {
	id?: string;
	duration?: number;
	icon?: React.ReactNode;
}

interface ToastItem {
	id: string;
	kind: ToastKind;
	title: string;
	detail: string;
	iconText?: string;
	duration: number;
	rev: number;
}

const DURATIONS: Record<ToastKind, number> = {
	success: 4200,
	error: 5200,
	loading: Number.POSITIVE_INFINITY,
	info: 4200,
};
const LEAVE_MS = 450;
const SWIPE_PX = 90;

// ─── tiny external store ──────────────────────────────────────────────
let seq = 0;
let items: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
	listeners.forEach(fn => fn());
}

function subscribe(fn: () => void) {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
}

function getSnapshot() {
	return items;
}

const FALLBACK_TITLES: Record<ToastKind, string> = {
	success: "Thành công",
	error: "Đã xảy ra lỗi",
	loading: "Đang xử lý",
	info: "Thông báo",
};

function parseMessage(
	message: string,
	kind: ToastKind = "info",
): { title: string; detail: string } {
	const [first, ...rest] = String(message || "")
		.split("\n")
		.map(part => part.trim())
		.filter(Boolean);
	if (!first) return { title: FALLBACK_TITLES[kind], detail: "" };
	if (!rest.length)
		return {
			title: first.length <= 64 ? first : FALLBACK_TITLES[kind],
			detail: first.length <= 64 ? "" : first,
		};
	return { title: first, detail: rest.join("\n") };
}

function upsert(kind: ToastKind, message: string, opts?: ToastOptions): string {
	const parsed = parseMessage(message, kind);
	const iconText =
		typeof opts?.icon === "string" ? (opts.icon as string) : undefined;
	const duration = opts?.duration ?? DURATIONS[kind];
	if (opts?.id) {
		const found = items.find(t => t.id === opts.id);
		if (found) {
			items = items.map(t =>
				t.id === opts.id
					? {
							...t,
							kind,
							title: parsed.title,
							detail: parsed.detail,
							iconText: iconText ?? t.iconText,
							duration,
							rev: t.rev + 1,
						}
					: t,
			);
			emit();
			return opts.id;
		}
	}
	const id = opts?.id ?? `t${++seq}`;
	items = [
		{
			id,
			kind,
			title: parsed.title,
			detail: parsed.detail,
			iconText,
			duration,
			rev: 0,
		},
		...items,
	];
	emit();
	return id;
}

function removeToast(id: string) {
	if (!items.some(t => t.id === id)) return;
	items = items.filter(t => t.id !== id);
	emit();
}

// ─── public facade (same call shapes the app already uses) ───────────
function base(message: string, opts?: ToastOptions) {
	return upsert("info", message, opts);
}

export const toast = Object.assign(base, {
	success: (message: string, opts?: ToastOptions) =>
		upsert("success", message, opts),
	error: (message: string, opts?: ToastOptions) =>
		upsert("error", message, opts),
	loading: (message: string, opts?: ToastOptions) =>
		upsert("loading", message, opts),
	dismiss: (id?: string) => {
		if (id) removeToast(id);
		else {
			items = [];
			emit();
		}
	},
	promise: async <T,>(
		p: Promise<T>,
		msgs: { loading: string; success: string | ((v: T) => string); error: string | ((e: unknown) => string) },
		opts?: ToastOptions,
	): Promise<T> => {
		const id = upsert("loading", msgs.loading, opts);
		try {
			const v = await p;
			upsert(
				"success",
				typeof msgs.success === "function" ? msgs.success(v) : msgs.success,
				{ ...opts, id },
			);
			return v;
		} catch (e) {
			upsert(
				"error",
				typeof msgs.error === "function" ? msgs.error(e) : msgs.error,
				{ ...opts, id },
			);
			throw e;
		}
	},
});

export default toast;

export function notifySuccess(message: string, detail = "") {
	const parsed = detail ? { title: message, detail } : parseMessage(message);
	return upsert(
		"success",
		`${parsed.title}${parsed.detail ? `\n${parsed.detail}` : ""}`,
	);
}

export function notifyError(message: string, detail = "") {
	const parsed = detail ? { title: message, detail } : parseMessage(message);
	return upsert(
		"error",
		`${parsed.title}${parsed.detail ? `\n${parsed.detail}` : ""}`,
	);
}

export const notify = { success: notifySuccess, error: notifyError };

// ─── renderer ─────────────────────────────────────────────────────────
const KIND_COLOR: Record<ToastKind, string> = {
	success: "var(--ux-mint)",
	error: "var(--ux-danger)",
	loading: "var(--ux-warn)",
	info: "var(--ux-accent)",
};

const ICONS: Record<Exclude<ToastKind, "loading">, React.ReactNode> = {
	success: (
		<svg viewBox="0 0 18 18" aria-hidden="true">
			<path d="M4 9.4l3.2 3.2L14 5.6" />
		</svg>
	),
	error: (
		<svg viewBox="0 0 18 18" aria-hidden="true">
			<path d="M9 5v5M9 13h.01" />
		</svg>
	),
	info: (
		<svg viewBox="0 0 18 18" aria-hidden="true">
			<path d="M3.5 4.5h11v7h-6l-3 2.5v-2.5h-2z" />
		</svg>
	),
};

export function AppToaster() {
	const list = useSyncExternalStore(subscribe, getSnapshot);
	const [, force] = useReducer(x => x + 1, 0);
	const [open, setOpen] = useState(false);
	const [leaving, setLeaving] = useState<Record<string, number | undefined>>(
		{},
	);
	const [announcement, setAnnouncement] = useState("");
	const zoneRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef(new Map<string, HTMLDivElement>());
	const barRefs = useRef(new Map<string, HTMLSpanElement>());
	const seenRef = useRef(new Set<string>());
	const remainingRef = useRef(new Map<string, number>());
	const revRef = useRef(new Map<string, number>());
	const openRef = useRef(open);
	openRef.current = open;
	const leavingRef = useRef(leaving);
	leavingRef.current = leaving;
	const listRef = useRef(list);
	listRef.current = list;
	const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

	useEffect(
		() => () => {
			timers.current.forEach(clearTimeout);
		},
		[],
	);

	const startLeave = (id: string, dir?: number) => {
		if (leavingRef.current[id] !== undefined) return;
		setLeaving(prev => ({ ...prev, [id]: dir ?? 0 }));
		const timer = setTimeout(() => {
			timers.current.delete(id);
			removeToast(id);
			setLeaving(prev => {
				if (prev[id] === undefined) return prev;
				const next = { ...prev };
				delete next[id];
				return next;
			});
			remainingRef.current.delete(id);
			revRef.current.delete(id);
			seenRef.current.delete(id);
		}, LEAVE_MS);
		timers.current.set(id, timer);
	};

	// live-region announcements for new / updated toasts
	const announcedRef = useRef("");
	useEffect(() => {
		const latest = list[0];
		if (latest) {
			const key = `${latest.id}:${latest.rev}`;
			if (announcedRef.current !== key) {
				announcedRef.current = key;
				setAnnouncement(latest.title);
			}
		}
	}, [list]);

	// stack layout (same math as the original): fan out when open,
	// otherwise tuck older toasts behind, shrinking.
	useLayoutEffect(() => {
		let acc = 0;
		list.forEach((t, i) => {
			const el = itemRefs.current.get(t.id);
			if (!el) return;
			el.classList.toggle("back", !open && i > 0);
			if (open) {
				el.style.setProperty("--y", `${-acc}px`);
				el.style.setProperty("--s", "1");
				el.style.setProperty("--o", "1");
				acc += el.offsetHeight + 8;
			} else {
				el.style.setProperty("--y", `${-(i * 14)}px`);
				el.style.setProperty("--s", (1 - i * 0.06).toFixed(2));
				el.style.setProperty("--o", i > 2 ? "0" : "1");
			}
			el.style.zIndex = String(50 - i);
			if ("inert" in el) (el as HTMLElement & { inert: boolean }).inert = !open && i > 0;
		});
		// enter transition: vars are set above, then drop .enter next frame
		const fresh = list
			.map(t => t.id)
			.filter(id => !seenRef.current.has(id));
		if (fresh.length) {
			void zoneRef.current?.offsetWidth;
			requestAnimationFrame(() => {
				fresh.forEach(id => seenRef.current.add(id));
				force();
			});
		}
	});

	// auto-dismiss countdown: the front-most finite toast ticks (an infinite
	// loading toast in front must not freeze the queue behind it).
	// Paused while the stack is fanned open.
	useEffect(() => {
		let raf = 0;
		let last = performance.now();
		const loop = (now: number) => {
			const dt = now - last;
			last = now;
			const current = listRef.current;
			if (!openRef.current && current.length) {
				const front = current.find(
					t =>
						leavingRef.current[t.id] === undefined &&
						Number.isFinite(t.duration),
				);
				if (front) {
					if (!remainingRef.current.has(front.id)) {
						remainingRef.current.set(front.id, front.duration);
					}
					if (revRef.current.get(front.id) !== front.rev) {
						revRef.current.set(front.id, front.rev);
						remainingRef.current.set(front.id, front.duration);
					}
					const left = (remainingRef.current.get(front.id) ?? 0) - dt;
					remainingRef.current.set(front.id, left);
					barRefs.current
						.get(front.id)
						?.style.setProperty(
							"--left",
							Math.max(0, left / front.duration).toFixed(3),
						);
					if (left <= 0) startLeave(front.id);
				}
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const setBarRef = (id: string) => (el: HTMLSpanElement | null) => {
		if (el) barRefs.current.set(id, el);
		else barRefs.current.delete(id);
	};
	const setItemRef = (id: string) => (el: HTMLDivElement | null) => {
		if (el) itemRefs.current.set(id, el);
		else itemRefs.current.delete(id);
	};

	return (
		<div className="u070 u070-fixed">
			<div
				ref={zoneRef}
				className="u070-zone"
				role="region"
				aria-label="Thông báo"
				tabIndex={-1}
				style={
					list.length === 0
						? { pointerEvents: "none" }
						: !open
							? {
									pointerEvents: "auto",
									height: Math.min(300, 120 + (list.length - 1) * 14),
								}
							: undefined
				}
				onPointerEnter={e => {
					if (e.pointerType === "mouse") setOpen(true);
				}}
				onPointerLeave={() => {
					if (
						!zoneRef.current?.contains(document.activeElement)
					)
						setOpen(false);
				}}
				onFocus={() => setOpen(true)}
				onBlur={e => {
					if (!zoneRef.current?.contains(e.relatedTarget as Node))
						setOpen(false);
				}}
				onClick={e => {
					if (
						!(e.target as HTMLElement).closest("button") &&
						list.length > 1
					)
						setOpen(o => !o);
				}}
			>
				<div className="u070-live" aria-live="polite">
					{announcement}
				</div>
				{list.map((t, i) => {
					const isEnter = !seenRef.current.has(t.id);
					const leaveDir = leaving[t.id];
					return (
						<ToastCard
							key={t.id}
							item={t}
							index={i}
							enter={isEnter}
							leaveDir={leaveDir}
							setItemRef={setItemRef(t.id)}
							setBarRef={setBarRef(t.id)}
							onClose={() => startLeave(t.id)}
							onSwipe={dir => startLeave(t.id, dir)}
						/>
					);
				})}
			</div>
		</div>
	);
}

function ToastCard({
	item,
	enter,
	leaveDir,
	setItemRef,
	setBarRef,
	onClose,
	onSwipe,
}: {
	item: ToastItem;
	index: number;
	enter: boolean;
	leaveDir: number | undefined;
	setItemRef: (el: HTMLDivElement | null) => void;
	setBarRef: (el: HTMLSpanElement | null) => void;
	onClose: () => void;
	onSwipe: (dir: number) => void;
}) {
	const drag = useRef<{ down: boolean; sx: number; dx: number }>({
		down: false,
		sx: 0,
		dx: 0,
	});
	const elRef = useRef<HTMLDivElement>(null);

	const cls = [
		"u070-t",
		enter ? "enter" : "",
		leaveDir !== undefined ? "leave" : "",
		leaveDir !== undefined && leaveDir !== 0 ? "side" : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div
			ref={node => {
				elRef.current = node;
				setItemRef(node);
			}}
			className={cls}
			style={
				{
					"--c": KIND_COLOR[item.kind],
					"--left": 1,
					...(leaveDir ? { "--dir": leaveDir } : null),
				} as React.CSSProperties
			}
			role={item.kind === "error" ? "alert" : "status"}
			onPointerDown={e => {
				if ((e.target as HTMLElement).closest("button")) return;
				drag.current = { down: true, sx: e.clientX, dx: 0 };
				try {
					elRef.current?.setPointerCapture(e.pointerId);
				} catch {
					/* noop */
				}
				elRef.current?.classList.add("drag");
			}}
			onPointerMove={e => {
				const d = drag.current;
				if (!d.down || !elRef.current) return;
				d.dx = e.clientX - d.sx;
				elRef.current.style.setProperty("--dx", `${d.dx}px`);
				elRef.current.style.setProperty(
					"--o",
					String(Math.max(0.2, 1 - Math.abs(d.dx) / 260)),
				);
			}}
			onPointerUp={() => {
				const d = drag.current;
				if (!d.down) return;
				d.down = false;
				elRef.current?.classList.remove("drag");
				if (Math.abs(d.dx) > SWIPE_PX) onSwipe(d.dx > 0 ? 1 : -1);
				else {
					elRef.current?.style.setProperty("--dx", "0px");
					elRef.current?.style.removeProperty("--o");
				}
			}}
			onPointerCancel={() => {
				drag.current.down = false;
				elRef.current?.classList.remove("drag");
				elRef.current?.style.setProperty("--dx", "0px");
				elRef.current?.style.removeProperty("--o");
			}}
		>
			<span className="u070-ic" aria-hidden="true">
				{item.kind === "loading" ? (
					<i />
				) : item.iconText ? (
					<span aria-hidden="true">{item.iconText}</span>
				) : (
					ICONS[item.kind]
				)}
			</span>
			<span className="u070-tx">
				<b>{item.title}</b>
				{item.detail ? <small>{item.detail}</small> : null}
			</span>
			<button
				type="button"
				className="u070-x"
				aria-label="Đóng thông báo"
				onClick={onClose}
			>
				<svg viewBox="0 0 14 14" aria-hidden="true">
					<path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
				</svg>
			</button>
			<span className="u070-bar" aria-hidden="true" ref={setBarRef} />
		</div>
	);
}
