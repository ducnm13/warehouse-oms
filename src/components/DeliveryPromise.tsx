/* Lucian UX/UI Prompt #265 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#265 */
// Cam kết giao hàng cho đơn online: đếm ngược chốt gửi trong ngày, tiến độ
// theo trạng thái đơn thật, tuyến tự nhận từ địa chỉ giao (nội tỉnh / liên
// tỉnh / tuyến đảo-xa). Không khóa ngày quá khứ (báo cáo cần lịch sử ở đây
// không áp dụng — component này chỉ hiển thị tương lai từ hôm nay).
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./delivery-promise.css";

interface DeliveryPromiseProps {
	address: string;
	status: string;
}

const CUTOFF_HOUR = 16;
const WINDOW_SEC = 6 * 3600;

const HOME_RE = /đồng tháp/i;
// eslint-disable-next-line no-misleading-character-class
const REMOTE_RE = /đảo|phú quốc|côn đảo|lý sơn|cát bà|hoàng sa|trường sa|điện biên|lai châu|sơn la|hà giang|cao bằng|lạng sơn|yên bái|lào cai|kon tum|gia lai|đắk|phú yên|khánh hòa|ninh thuận|bình thuận|cà mau|hậu giang|sóc trăng|bạc liêu|trà vinh|vĩnh long/i;

const ZONES = [
	{ label: "Nội tỉnh", short: "Ngày mai", etaDays: 1, transit: false },
	{ label: "Liên tỉnh", short: "2 ngày", etaDays: 2, transit: false },
	{ label: "Tuyến đảo/xa", short: "3 ngày", etaDays: 3, transit: true },
];

const BASE_STEPS = ["Đặt hàng", "Gửi hàng", "Giao hàng"];

const WD = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const pad = (n: number) => (n < 10 ? "0" : "") + n;

function detectZone(address: string) {
	const a = address || "";
	if (REMOTE_RE.test(a)) return 2;
	return 0;
}

function nextCutoff(now: Date) {
	const cutoff = new Date(now);
	cutoff.setHours(CUTOFF_HOUR, 0, 0, 0);
	if (now >= cutoff) cutoff.setDate(cutoff.getDate() + 1);
	return cutoff;
}

function etaDate(days: number) {
	const d = new Date();
	d.setDate(d.getDate() + days);
	return d;
}

function etaLabel(days: number) {
	const d = etaDate(days);
	const wd = WD[d.getDay()];
	if (days <= 1) return `Giao ${wd} (ngày mai)`;
	return `Giao ${wd} ${d.getDate()}/${d.getMonth() + 1}`;
}

const inBrowserReducedMotion = () =>
	typeof window !== "undefined" &&
	typeof window.matchMedia === "function" &&
	window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const TRUCK = (
	<svg viewBox="0 0 14 14" aria-hidden="true">
		<path d="M1.5 3.5h7v6h-7zM8.5 5.5h2.6l1.9 2v2h-4.5z" fill="currentColor" />
	</svg>
);
const BOX_ICON = (
	<svg viewBox="0 0 18 18" aria-hidden="true">
		<path d="M3 5.5l6-3 6 3v7l-6 3-6-3zM3 5.5l6 3 6-3M9 8.5v6.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
	</svg>
);

export default function DeliveryPromise({ address, status }: DeliveryPromiseProps) {
	const autoZone = useMemo(() => {
		if (HOME_RE.test(address || "")) return 0;
		return detectZone(address);
	}, [address ]);
	const [override, setOverride] = useState<number | null>(null);
	const [open, setOpen] = useState(false);
	const [now, setNow] = useState(() => new Date());
	const rm = useMemo(inBrowserReducedMotion, []);

	const zone = override ?? autoZone;
	const meta = ZONES[zone];
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onDown = (e: PointerEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("pointerdown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open ]);
	const steps = meta.transit ? ["Đặt hàng", "Gửi hàng", "Trung chuyển", "Giao hàng"] : BASE_STEPS;
	const n = steps.length;

	useEffect(() => {
		const t = window.setInterval(() => setNow(new Date()), 1000);
		return () => window.clearInterval(t);
	}, []);

	const cutoff = nextCutoff(now);
	const leftSec = Math.max(0, Math.round((cutoff.getTime() - now.getTime()) / 1000));
	const h = Math.floor(leftSec / 3600);
	const m = Math.floor((leftSec % 3600) / 60);
	const s = leftSec % 60;

	const doneCount =
		status === "Delivered" ? n : status === "Shipping" || status === "Shipped" ? n - 1 : status === "Packing" ? 2 : status === "Cancelled" ? 0 : 1;
	const at = Math.min(100, Math.max(0, ((doneCount - 0.5) / (n - 1)) * 100));

	const delivered = status === "Delivered";
	const cancelled = status === "Cancelled";
	const headline = delivered ? "Đã giao thành công" : cancelled ? "Đơn đã hủy" : etaLabel(meta.etaDays);
	const headAnimKey = `${zone}-${delivered}-${cancelled}`;

	const pick = (i: number) => {
		setOverride(i);
		setOpen(false);
	};

	return (
		<div ref={rootRef} className={`u265${open ? " is-open" : ""}${zone === 2 ? " is-late" : ""}`}>
			<div className="u265-cd">
				<div className="u265-rw">
					Giao tới
					<button
						type="button"
						className="u265-rg"
						aria-haspopup="listbox"
						aria-expanded={open}
						aria-label="Đổi tuyến giao hàng"
						onClick={() => setOpen(o => !o)}
					>
						<span>{override !== null ? meta.label : `${meta.label} · tự nhận`}</span>
						<svg viewBox="0 0 10 10" aria-hidden="true">
							<path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
						</svg>
					</button>
				</div>
				<div className="u265-hd" aria-live="polite">
					<Headline animKey={headAnimKey} late={zone === 2 && !delivered && !cancelled} text={headline} rm={rm} />
				</div>
				<div className="u265-sb">
					<span className={zone === 2 ? "is-off" : undefined}>
						<b>
							{h} h {pad(m)} min {pad(s)} s
						</b>{" "}
					 còn để gửi hôm nay
					</span>
					<span className={zone === 2 ? undefined : "is-off"}>Tuyến xa/đảo: cộng thêm ngày trung chuyển</span>
				</div>
				<div className="u265-bar" aria-hidden="true">
					<i style={{ transform: `scaleX(${(leftSec / WINDOW_SEC).toFixed(4)})` }} />
				</div>
			</div>
			<div className="u265-dd" role="listbox" aria-label="Tuyến giao hàng">
				{ZONES.map((z, i) => (
					<button
						key={z.label}
						type="button"
						className="u265-op"
						role="option"
						aria-selected={(override ?? autoZone) === i}
						onClick={() => pick(i)}
					>
						<span>
							{z.label}
							{i === autoZone ? " · tự nhận" : ""}
						</span>
						<small className={i === 2 ? "l" : undefined}>{z.short}</small>
					</button>
				))}
			</div>
			<div className="u265-tl" aria-hidden="true">
				<div className="u265-ln">
					<i style={{ width: `${at}%` }} />
				</div>
				{steps.map((label, j) => {
					const transit = meta.transit && j === 2;
					return (
						<div
							key={label}
							className={`u265-nd${j < doneCount ? " is-done" : ""}${transit ? " is-x" : ""}`}
							style={{ left: `${(j / (n - 1)) * 100}%` }}
						>
							<span>{label}</span>
						</div>
					);
				})}
				<svg className="u265-tr" viewBox="0 0 26 20" style={{ left: `${at}%` }}>
					<path d="M2 4h13v10H2zM15 7h5l4 4v3h-9z" fill="currentColor" />
					<circle cx="7" cy="15.5" r="2.6" fill="var(--ux-surface)" stroke="currentColor" stroke-width="1.8" />
					<circle cx="19" cy="15.5" r="2.6" fill="var(--ux-surface)" stroke="currentColor" stroke-width="1.8" />
				</svg>
			</div>
		</div>
	);
}

function Headline({ animKey, late, text, rm }: { animKey: string; late: boolean; text: string; rm: boolean }) {
	const [items, setItems] = useState<Array<{ id: number; text: string; late: boolean; phase: "" | "in" | "out" }>>([]);
	const seq = useRef(0);
	const keyRef = useRef("");

	useEffect(() => {
		if (keyRef.current === animKey) return;
		keyRef.current = animKey;
		if (rm) {
			seq.current += 1;
			setItems([{ id: seq.current, text, late, phase: "" }]);
			return;
		}
		seq.current += 1;
		const id = seq.current;
		setItems(prev => [...prev.map(p => ({ ...p, phase: "out" as const })), { id, text, late, phase: "in" as const }]);
		requestAnimationFrame(() =>
			requestAnimationFrame(() => {
				setItems(prev => prev.map(p => (p.id === id ? { ...p, phase: "" as const } : p)));
			}),
		);
		const t = window.setTimeout(() => {
			setItems(prev => {
				const keep = prev.filter(p => p.id === id);
				return keep.length ? [{ ...keep[0], phase: "" as const }] : prev;
			});
		}, 460);
		return () => window.clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [animKey ]);

	return (
		<>
			{items.map(item => (
				<b
					key={item.id}
					className={`${item.late ? "is-l" : ""}${item.phase === "in" ? " is-in" : ""}${item.phase === "out" ? " is-out" : ""}`}
				>
					<i>{BOX_ICON}</i>
					<span>{item.text}</span>
				</b>
			))}
		</>
	);
}
