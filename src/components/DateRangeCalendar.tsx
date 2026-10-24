/* Lucian UX/UI Prompt #030 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#030 */
// Date range calendar ported to React. Pills + sliding month grid + hover range
// band + summary + Apply. Modes: "range" (Từ/Đến ngày) and "single" (1 ngày).
// Adapted: Monday-first VN week, no past-date lock (reports need history),
// initial selection comes from props (no demo picks). Popup uses a fixed
// portal like SearchableSelect so it never gets clipped inside tables/drawers.
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./date-range-calendar.css";

export interface DateRangeValue {
	from: string;
	to: string;
}

interface DateRangeCalendarProps {
	from: string;
	to: string;
	onChange: (from: string, to: string) => void;
	align?: "left" | "right";
	defaultOpen?: boolean;
	mode?: "range" | "single";
	disabled?: boolean;
	placeholder?: string;
	min?: string;
	max?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m0: number, d: number) => y * 10000 + m0 * 100 + d;
const dateOf = (k: number) => new Date(Math.floor(k / 10000), Math.floor(k / 100) % 100, k % 100);
const fmtKey = (k: number) => {
	const d = dateOf(k);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fmtShort = (k: number) => {
	const d = dateOf(k);
	return `${d.getDate()}/${d.getMonth() + 1}`;
};
const fmtFull = (k: number) => {
	const d = dateOf(k);
	return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};
const fmtLong = (k: number | null) => {
	if (k === null) return "Chọn ngày";
	const d = dateOf(k);
	const wd = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.getDay()];
	return `${wd}, ${d.getDate()}/${d.getMonth() + 1}`;
};
const parseKey = (s: string): number | null => {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
	if (!m) return null;
	const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	return Number.isNaN(d.getTime()) ? null : keyOf(d.getFullYear(), d.getMonth(), d.getDate());
};
const monthTitle = (y: number, m0: number) => `Tháng ${m0 + 1} · ${y}`;

export function formatRangeShort(from: string, to: string) {
	const a = parseKey(from);
	const b = parseKey(to);
	if (a === null || b === null) return "Chọn khoảng ngày";
	return `${fmtShort(a)} – ${fmtShort(b)}`;
}

const inBrowserReducedMotion = () =>
	typeof window !== "undefined" &&
	typeof window.matchMedia === "function" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Slide {
	fromY: number;
	fromM: number;
	dir: number;
	settled: boolean;
}

interface PopPosition {
	top?: number;
	bottom?: number;
	left: number;
}

export default function DateRangeCalendar({
	from,
	to,
	onChange,
	align = "left",
	defaultOpen = false,
	mode = "range",
	disabled = false,
	placeholder,
	min,
	max,
}: DateRangeCalendarProps) {
	const minKey = useMemo(() => (min ? parseKey(min) : null), [min ]);
	const maxKey = useMemo(() => (max ? parseKey(max) : null), [max ]);
	const inRange = (k: number) =>
		(minKey === null || k >= minKey) && (maxKey === null || k <= maxKey);
	const single = mode === "single";
	const [open, setOpen] = useState(defaultOpen);
	const [popPos, setPopPos] = useState<PopPosition | null>(null);
	const [view, setView] = useState(() => {
		const k = parseKey(from);
		const d = k !== null ? dateOf(k) : new Date();
		return { y: d.getFullYear(), m: d.getMonth() };
	});
	const [start, setStart] = useState<number | null>(() => parseKey(from));
	const [end, setEnd] = useState<number | null>(() => parseKey(to));
	const [hover, setHover] = useState<number | null>(null);
	const [focusKey, setFocusKey] = useState<number | null>(null);
	const [slide, setSlide] = useState<Slide | null>(null);
	const [applied, setApplied] = useState(false);
	const wrapRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const popRef = useRef<HTMLDivElement>(null);
	const timers = useRef<number[]>([]);
	const rm = useMemo(inBrowserReducedMotion, []);

	useEffect(() => () => {
		timers.current.forEach(t => window.clearTimeout(t));
	}, []);

	// Re-seed the draft selection from props every time the popup opens
	useEffect(() => {
		if (!open) return;
		const s = parseKey(from);
		setStart(s);
		setEnd(single ? s : parseKey(to));
		setHover(null);
		setApplied(false);
		setSlide(null);
		const d = s !== null ? dateOf(s) : new Date();
		setView({ y: d.getFullYear(), m: d.getMonth() });
	}, [open, from, to, single]);

	const updatePopPosition = () => {
		const trigger = triggerRef.current;
		if (!trigger) return;
		const rect = trigger.getBoundingClientRect();
		const popHeight = Math.min(popRef.current?.offsetHeight || 460, window.innerHeight - 16);
		const spaceBelow = window.innerHeight - rect.bottom;
		const placeAbove = spaceBelow < popHeight + 12 && rect.top > popHeight + 12;
		const width = Math.min(popRef.current?.offsetWidth || 300, window.innerWidth - 16);
		const left = align === "right"
			? Math.max(8, rect.right - width)
			: Math.min(rect.left, Math.max(8, window.innerWidth - width - 8));
		setPopPos(placeAbove
			? { bottom: window.innerHeight - rect.top + 8, left }
			: {
					top: Math.min(
						rect.bottom + 8,
						Math.max(8, window.innerHeight - popHeight - 8),
					),
					left,
				});
	};

	useLayoutEffect(() => {
		if (open) updatePopPosition();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open ]);

	// Re-measure once the portal is mounted so the popup stays inside the viewport.
	useLayoutEffect(() => {
		if (!open || !popRef.current) return;
		updatePopPosition();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, popPos?.top, popPos?.bottom, popPos?.left]);

	// Close on outside click / Escape / page scroll (popup chrome)
	useEffect(() => {
		if (!open) return;
		const onDown = (e: PointerEvent) => {
			if (wrapRef.current?.contains(e.target as Node)) return;
			if (popRef.current?.contains(e.target as Node)) return;
			setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				setOpen(false);
				triggerRef.current?.focus();
			}
		};
		const rafRef = { id: 0 };
		const onScroll = () => {
			// Popup bám theo nút khi cuộn trang (không tự tắt)
			if (rafRef.id) return;
			rafRef.id = window.requestAnimationFrame(() => {
				rafRef.id = 0;
				if (popRef.current) updatePopPosition();
			});
		};
		document.addEventListener("pointerdown", onDown);
		document.addEventListener("keydown", onKey);
		window.addEventListener("scroll", onScroll, true);
		window.addEventListener("resize", onScroll);
		return () => {
			document.removeEventListener("pointerdown", onDown);
			document.removeEventListener("keydown", onKey);
			window.removeEventListener("scroll", onScroll, true);
			window.removeEventListener("resize", onScroll);
			if (rafRef.id) window.cancelAnimationFrame(rafRef.id);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open ]);

	const later = (fn: () => void, ms: number) => {
		const t = window.setTimeout(fn, ms);
		timers.current.push(t);
	};

	const nav = (dir: number) => {
		if (slide) return;
		const d = new Date(view.y, view.m + dir, 1);
		const toView = { y: d.getFullYear(), m: d.getMonth() };
		if (rm) {
			setView(toView);
			return;
		}
		setSlide({ fromY: view.y, fromM: view.m, dir, settled: false });
		setView(toView);
		requestAnimationFrame(() =>
			requestAnimationFrame(() =>
				setSlide(s => (s ? { ...s, settled: true } : s)),
			),
		);
		later(() => setSlide(null), 460);
	};

	const pick = (k: number) => {
		if (!inRange(k)) return;
		if (single) {
			setStart(k);
			setEnd(k);
			setFocusKey(k);
			return;
		}
		if (start === null || end !== null) {
			setStart(k);
			setEnd(null);
		} else if (k === start) {
			setEnd(null);
		} else {
			setEnd(Math.max(k, start));
			setStart(Math.min(k, start));
		}
		setHover(null);
		setFocusKey(k);
	};

	const buildCells = (y: number, m: number) => {
		const first = (new Date(y, m, 1).getDay() + 6) % 7; // Monday-first
		const n = new Date(y, m + 1, 0).getDate();
		const out: Array<{ key: number | null; day: number }> = [];
		for (let i = 0; i < 42; i++) {
			const d = i - first + 1;
			out.push(d >= 1 && d <= n ? { key: keyOf(y, m, d), day: d } : { key: null, day: 0 });
		}
		return out;
	};
	const cells = useMemo(() => buildCells(view.y, view.m), [view]);

	const paint = (cellKey: number | null) => {
		let lo = start;
		let hi = end !== null ? end : start !== null && hover !== null ? hover : null;
		if (lo !== null && hi !== null && hi < lo) {
			const t = lo;
			lo = hi;
			hi = t;
		}
		const sMark = hi === null ? start : lo;
		return {
			s: cellKey !== null && cellKey === sMark,
			e: cellKey !== null && hi !== null && cellKey === hi,
			in: cellKey !== null && hi !== null && lo !== null && cellKey >= lo && cellKey <= hi,
			selected: cellKey !== null && (cellKey === start || cellKey === end),
		};
	};

	const enabledKeys = useMemo(() => cells.filter(c => c.key !== null).map(c => c.key as number), [cells]);
	const tabKey = focusKey !== null && enabledKeys.includes(focusKey)
		? focusKey
		: start !== null && enabledKeys.includes(start)
			? start
			: enabledKeys[0] ?? null;

	const moveFocus = (e: React.KeyboardEvent, k: number) => {
		const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
		const delta = step[e.key];
		if (!delta) return;
		e.preventDefault();
		const d = dateOf(k);
		d.setDate(d.getDate() + delta);
		const nk = keyOf(d.getFullYear(), d.getMonth(), d.getDate());
		if (!inRange(nk)) return;
		setFocusKey(nk);
		if (!single && start !== null && end === null) setHover(nk);
		if (d.getMonth() !== view.m || d.getFullYear() !== view.y) {
			const dir = nk > k ? 1 : -1;
			if (rm) {
				setView({ y: d.getFullYear(), m: d.getMonth() });
			} else {
				nav(dir);
			}
		}
		const focusDay = (attempts: number) => {
			const el = popRef.current?.querySelector<HTMLButtonElement>(`[data-k="${nk}"]`);
			if (el) el.focus();
			else if (attempts > 0) later(() => focusDay(attempts - 1), 120);
		};
		focusDay(5);
	};

	const canApply = single ? start !== null : start !== null && end !== null;

	const apply = () => {
		if (!canApply || start === null) return;
		const lo = !single && end !== null ? Math.min(start, end) : start;
		const hi = !single && end !== null ? Math.max(start, end) : start;
		onChange(fmtKey(lo), fmtKey(hi));
		setApplied(true);
		later(() => {
			setOpen(false);
			triggerRef.current?.focus();
		}, 350);
	};

	const nights = start !== null && end !== null ? Math.round((dateOf(end).getTime() - dateOf(start).getTime()) / 86400000) : 0;
	const todayKey = (() => {
		const t = new Date();
		return keyOf(t.getFullYear(), t.getMonth(), t.getDate());
	})();

	const renderGrid = (y: number, m: number, style?: React.CSSProperties) => {
		const list = buildCells(y, m);
		return (
			<div key={`${y}-${m}`} className="u030-grid" role="grid" style={style}>
				{list.map((c, i) => {
					if (c.key === null) return <div key={i} className="u030-cell" role="gridcell" />;
					const p = paint(c.key);
					const cls = ["u030-cell", p.s ? "s" : "", p.e ? "e" : "", p.in ? "in" : ""].filter(Boolean).join(" ");
					const dk = dateOf(c.key);
					return (
						<div key={i} className={cls} role="gridcell">
							<button
								type="button"
								className={`u030-d${c.key === todayKey ? " today" : ""}`}
								data-k={c.key}
								tabIndex={c.key === tabKey ? 0 : -1}
								aria-label={`${["CN", "T2", "T3", "T4", "T5", "T6", "T7"][dk.getDay()]}, ${dk.getDate()}/${dk.getMonth() + 1}/${dk.getFullYear()}`}
								aria-selected={p.selected}
								onClick={() => pick(c.key as number)}
								onKeyDown={e => moveFocus(e, c.key as number)}
							>
								{c.day}
							</button>
						</div>
					);
				})}
			</div>
		);
	};

	const gridEnter = (dir: number): React.CSSProperties => ({ transform: `translateX(${dir * 100}%)`, opacity: 0 });
	const gridLeave = (dir: number): React.CSSProperties => ({ transform: `translateX(${-dir * 100}%)`, opacity: 0 });
	const gridSettled: React.CSSProperties = { transform: "none", opacity: 1 };

	const triggerLabel = (() => {
		if (single) {
			const k = parseKey(from);
			return k !== null ? fmtFull(k) : placeholder || "Chọn ngày";
		}
		return formatRangeShort(from, to);
	})();

	return (
		<div className="u030-wrap" ref={wrapRef}>
			<button
				ref={triggerRef}
				type="button"
				className="u030-trigger"
				disabled={disabled}
				onClick={() => {
					if (!disabled) setOpen(o => !o);
				}}
				aria-haspopup="dialog"
				aria-expanded={open}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v9h-11zM2.5 6.5h11M5.5 2v3M10.5 2v3" /></svg>
				<span>{triggerLabel}</span>
			</button>
			{open && !disabled && popPos && createPortal(
				<div ref={popRef} className="u030 u030-pop" role="dialog" aria-label={single ? "Chọn ngày" : "Chọn khoảng ngày"} style={{ top: popPos.top, bottom: popPos.bottom, left: popPos.left }}>
					<div className={`u030-pills${single ? " single" : ""}`}>
						<div className={`u030-pill${!start || end ? " on" : ""}`}>
							<small>{single ? "Ngày" : "Từ ngày"}</small>
							<b className={start ? undefined : "ph"}>{fmtLong(start)}</b>
						</div>
						{!single && (
							<div className={`u030-pill${start && !end ? " on" : ""}`}>
								<small>Đến ngày</small>
								<b className={end ? undefined : "ph"}>{fmtLong(end)}</b>
							</div>
						)}
					</div>
					<div className="u030-top">
						<div className="u030-m" aria-live="polite">
							{slide ? (
								<>
									<span style={gridLeave(slide.dir)}>{monthTitle(slide.fromY, slide.fromM)}</span>
									<span style={slide.settled ? gridSettled : gridEnter(slide.dir)}>{monthTitle(view.y, view.m)}</span>
								</>
							) : (
								<span>{monthTitle(view.y, view.m)}</span>
							)}
						</div>
						<div className="u030-nav">
							<button type="button" onClick={() => nav(-1)} aria-label="Tháng trước">
								<svg viewBox="0 0 16 16"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg>
							</button>
							<button type="button" onClick={() => nav(1)} aria-label="Tháng sau">
								<svg viewBox="0 0 16 16"><path d="M6 3.5L10.5 8 6 12.5" /></svg>
							</button>
						</div>
					</div>
					<div className="u030-wk" aria-hidden="true">
						<span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span>
					</div>
					<div
						className="u030-view"
						onPointerOver={e => {
							if (single) return;
							const b = (e.target as HTMLElement).closest?.(".u030-d") as HTMLElement | null;
							if (b?.dataset.k && start !== null && end === null) setHover(Number(b.dataset.k));
						}}
						onPointerLeave={() => setHover(null)}
					>
						{slide ? (
							<>
								{renderGrid(slide.fromY, slide.fromM, gridLeave(slide.dir))}
								{renderGrid(view.y, view.m, slide.settled ? gridSettled : gridEnter(slide.dir))}
							</>
						) : (
							renderGrid(view.y, view.m)
						)}
					</div>
					<div className="u030-foot">
						<span className="u030-sum" aria-live="polite">
							{single ? (
								start !== null ? fmtLong(start) : "Chọn ngày"
							) : start !== null && end !== null ? (
								<>
									<b>{nights} ngày</b> · {fmtShort(start)} – {fmtShort(end)}
								</>
							) : start !== null ? (
								"Chọn đến ngày"
							) : (
								"Chọn khoảng ngày"
							)}
						</span>
						<button type="button" className="u030-ok" aria-disabled={!canApply} onClick={apply}>
							{applied ? "Đã chọn" : "Áp dụng"}
						</button>
					</div>
				</div>,
				document.body,
			)}
		</div>
	);
}

// ─── Single date field: trigger + popup, same look & motion ──────────────
interface DateInputProps {
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	align?: "left" | "right";
	min?: string;
	max?: string;
}

export function DateInput({ value, onChange, placeholder, disabled, align, min, max }: DateInputProps) {
	return (
		<DateRangeCalendar
			mode="single"
			from={value}
			to={value}
			onChange={f => onChange(f)}
			disabled={disabled}
			placeholder={placeholder}
			align={align}
			min={min}
			max={max}
		/>
	);
}
