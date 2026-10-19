/* Bong bóng chat góc phải dưới (kiểu Messenger): badge chưa đọc + panel popup
   + thông báo trình duyệt (Notification API) khi có tin mới mà tab đang ẩn. */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { apiV1 } from "../lib/apiV1";
import ChatBox from "../pages/ChatBox";
import "./chatbox.css";

interface WidgetConversation {
	id: number;
	name: string;
	unread: number;
	lastMessage: { id: number; body: string; senderId: number } | null;
}

const canNotify = () =>
	typeof window !== "undefined" &&
	"Notification" in window &&
	typeof Notification !== "undefined";

export default function ChatWidget({ visible }: { visible: boolean }) {
	const [open, setOpen] = useState(false);
	const [unread, setUnread] = useState(0);
	const openRef = useRef(open);
	openRef.current = open;
	const seenRef = useRef<Record<number, number>>({});
	const primedRef = useRef(false);

	const meId = (() => {
		try {
			return Number(JSON.parse(localStorage.getItem("user") || "{}").id) || 0;
		} catch {
			return 0;
		}
	})();

	const notifyNew = useCallback(
		(list: WidgetConversation[]) => {
			if (!canNotify() || Notification.permission !== "granted") return;
			if (!document.hidden) return;
			for (const c of list) {
				const last = c.lastMessage;
				if (!last || last.senderId === meId) continue;
				if ((seenRef.current[c.id] || 0) >= last.id) continue;
				try {
					const n = new Notification(`Tin nhắn từ ${c.name}`, {
						body: last.body.length > 120 ? `${last.body.slice(0, 120)}…` : last.body,
						tag: `chat-${c.id}`,
					});
					n.onclick = () => {
						try {
							window.focus();
						} catch {
							// bỏ qua
						}
						setOpen(true);
						n.close();
					};
				} catch {
					// trình duyệt chặn (VD: context không an toàn)
				}
			}
		},
		[meId],
	);

	const refreshUnread = useCallback(async () => {
		if (!localStorage.getItem("token")) return;
		try {
			const res = await apiV1<WidgetConversation[]>("/api/v1/chat/conversations");
			const list = res.data || [];
			setUnread(list.reduce((sum, c) => sum + (Number(c.unread) || 0), 0));
			if (primedRef.current && !openRef.current) notifyNew(list);
			for (const c of list) {
				if (c.lastMessage) seenRef.current[c.id] = Math.max(seenRef.current[c.id] || 0, c.lastMessage.id);
			}
			primedRef.current = true;
		} catch {
			// bỏ qua lỗi poll nền
		}
	}, [notifyNew]);

	useEffect(() => {
		if (!visible) return;
		void refreshUnread();
		const t = window.setInterval(() => {
			if (!open) void refreshUnread();
		}, 15000);
		return () => window.clearInterval(t);
	}, [visible, open, refreshUnread]);

	useEffect(() => {
		if (open) {
			setUnread(0);
			// Xin quyền thông báo ngay trong thao tác bấm của người dùng
			if (canNotify() && Notification.permission === "default") {
				try {
					const p = Notification.requestPermission();
					if (p && typeof (p as Promise<NotificationPermission>).catch === "function") {
						(p as Promise<NotificationPermission>).catch(() => {});
					}
				} catch {
					// bỏ qua
				}
			}
		}
	}, [open ]);

	if (!visible) return null;
	return (
		<div className="u078-widget">
			{open && (
				<div className="u078-panel" role="dialog" aria-label="Tin nhắn">
					<ChatBox embedded onClose={() => setOpen(false)} />
				</div>
			)}
			<button
				type="button"
				className="u078-bubble"
				aria-label={open ? "Đóng tin nhắn" : `Mở tin nhắn${unread ? `, ${unread} chưa đọc` : ""}`}
				aria-expanded={open}
				onClick={() => setOpen(o => !o)}
			>
				<MessageCircle />
				{!open && unread > 0 && <span className="u078-badge">{unread > 99 ? "99+" : unread}</span>}
			</button>
		</div>
	);
}
