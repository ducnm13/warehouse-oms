/* Bong bóng chat góc phải dưới (kiểu Messenger): badge chưa đọc + panel popup
   + âm thanh và thông báo trình duyệt khi có tin nhắn mới. */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellOff, MessageCircle, X } from "lucide-react";
import { apiV1 } from "../lib/apiV1";
import ChatBox from "../pages/ChatBox";
import { getSocket } from "../lib/socket";
import {
	notificationPermission,
	notificationsSupported,
	playNotificationSound,
	requestNotificationPermission,
	showMessageNotification,
	unlockNotificationSound,
} from "../lib/messageNotifications";
import "./chatbox.css";

interface WidgetConversation {
	id: number;
	name: string;
	unread: number;
	lastMessage: { id: number; body: string; senderId: number } | null;
}

const OPEN_CHAT_KEY = "chat.notify-prompt-dismissed";

export default function ChatWidget({ visible }: { visible: boolean }) {
	const [open, setOpen] = useState(false);
	const [unread, setUnread] = useState(0);
	const [permission, setPermission] = useState(notificationPermission());
	const [promptDismissed, setPromptDismissed] = useState(() => {
		try {
			return sessionStorage.getItem(OPEN_CHAT_KEY) === "1";
		} catch {
			return false;
		}
	});
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
			let hasNew = false;
			for (const c of list) {
				const last = c.lastMessage;
				if (!last || last.senderId === meId) continue;
				if ((seenRef.current[c.id] || 0) >= last.id) continue;
				hasNew = true;
				if (document.hidden) {
					void showMessageNotification(
						`Tin nhắn từ ${c.name}`,
						last.body,
						{ conversationId: c.id },
					);
				}
			}
			if (hasNew) playNotificationSound();
		},
		[meId],
	);

	const refreshUnread = useCallback(async () => {
		if (!localStorage.getItem("token")) return;
		try {
			const res = await apiV1<WidgetConversation[]>("/api/v1/chat/conversations");
			const list = res.data || [];
			setUnread(list.reduce((sum, c) => sum + (Number(c.unread) || 0), 0));
			const viewingChatPage = window.location.pathname === "/chat";
			const shouldNotify =
				document.hidden || (!openRef.current && !viewingChatPage);
			if (primedRef.current && shouldNotify) notifyNew(list);
			for (const c of list) {
				if (c.lastMessage) {
					seenRef.current[c.id] = Math.max(
						seenRef.current[c.id] || 0,
						c.lastMessage.id,
					);
				}
			}
			primedRef.current = true;
		} catch {
			// bỏ qua lỗi poll nền
		}
	}, [notifyNew]);

	const askPermission = async () => {
		unlockNotificationSound();
		const result = await requestNotificationPermission();
		setPermission(result);
		if (result === "granted") {
			playNotificationSound();
			void refreshUnread();
		}
	};

	const dismissPrompt = () => {
		setPromptDismissed(true);
		try {
			sessionStorage.setItem(OPEN_CHAT_KEY, "1");
		} catch {
			// bỏ qua
		}
	};

	useEffect(() => {
		if (!visible) return;
		setPermission(notificationPermission());
		void refreshUnread();
		const t = window.setInterval(() => {
			void refreshUnread();
		}, 5000);
		return () => window.clearInterval(t);
	}, [visible, open, refreshUnread]);

	useEffect(() => {
		if (!visible) return;
		const socket = getSocket();
		if (!socket) return;
		const refresh = () => void refreshUnread();
		socket.on("chat:message", refresh);
		socket.on("chat:conversation", refresh);
		return () => {
			socket.off("chat:message", refresh);
			socket.off("chat:conversation", refresh);
		};
	}, [visible, refreshUnread]);

	useEffect(() => {
		if (!visible) return;
		const unlock = () => unlockNotificationSound();
		window.addEventListener("pointerdown", unlock, { once: true });
		window.addEventListener("keydown", unlock, { once: true });
		return () => {
			window.removeEventListener("pointerdown", unlock);
			window.removeEventListener("keydown", unlock);
		};
	}, [visible]);

	useEffect(() => {
		const syncPermission = () => setPermission(notificationPermission());
		document.addEventListener("visibilitychange", syncPermission);
		window.addEventListener("focus", syncPermission);
		return () => {
			document.removeEventListener("visibilitychange", syncPermission);
			window.removeEventListener("focus", syncPermission);
		};
	}, []);

	useEffect(() => {
		if (!visible) return;
		try {
			const url = new URL(window.location.href);
			if (url.searchParams.get("chat") === "1") {
				setOpen(true);
				url.searchParams.delete("chat");
				window.history.replaceState({}, "", url.toString());
			}
		} catch {
			// bỏ qua
		}
		if (!("serviceWorker" in navigator)) return;
		const onWorkerMessage = (event: MessageEvent) => {
			if (event.data?.type === "OPEN_CHAT") setOpen(true);
		};
		navigator.serviceWorker.addEventListener("message", onWorkerMessage);
		return () => {
			navigator.serviceWorker.removeEventListener("message", onWorkerMessage);
		};
	}, [visible]);

	if (!visible) return null;

	const supported = notificationsSupported();
	const showPrompt =
		supported && permission !== "granted" && !promptDismissed;

	return (
		<div className="u078-widget">
			{showPrompt && (
				<div className="u078-notify">
					{permission === "denied" ? <BellOff /> : <Bell />}
					<div className="u078-notify-text">
						<b>
							{permission === "denied"
								? "Thông báo đang bị chặn"
								: "Bật thông báo tin nhắn"}
						</b>
						<small>
							{permission === "denied"
								? "Mở cài đặt trình duyệt để cho phép thông báo cho trang này."
								: "Nhận âm thanh và thông báo khi có tin nhắn mới."}
						</small>
					</div>
					{permission === "default" && (
						<button
							type="button"
							className="u078-notify-action"
							onClick={askPermission}
						>
							Bật
						</button>
					)}
					<button
						type="button"
						className="u078-notify-close"
						aria-label="Đóng nhắc bật thông báo"
						onClick={dismissPrompt}
					>
						<X />
					</button>
				</div>
			)}
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
				onClick={() => {
					unlockNotificationSound();
					setOpen(o => !o);
				}}
			>
				<MessageCircle />
				{!open && unread > 0 && (
					<span className="u078-badge">{unread > 99 ? "99+" : unread}</span>
				)}
			</button>
		</div>
	);
}
