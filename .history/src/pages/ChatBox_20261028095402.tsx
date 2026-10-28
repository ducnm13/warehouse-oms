/* Lucian UX/UI Prompt #078 + #077 · MIT License (c) 2026 Seokwoooo · https://lucianlabs.dev/uxui-prompt/#078 */
// Chat nội bộ realtime (polling): hội thoại, tin nhắn, trả lời (vuốt), reaction,
// đang gõ / online. Dữ liệu thật từ /api/v1/chat.
import React, {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { MessageCirclePlus, Undo2, Users, X } from "lucide-react";
import toast from "../components/ui/toast";
import { confirm } from "../components/ui/confirm";
import { apiV1 } from "../lib/apiV1";
import { getSocket } from "../lib/socket";
import "../components/chatbox.css";

interface Participant {
	id: number;
	name: string;
	avatarUrl: string | null;
}
interface LastMessage {
	id: number;
	body: string;
	senderId: number;
	createdAt: string;
}
interface Conversation {
	id: number;
	name: string;
	isGroup: boolean;
	avatarUrl: string | null;
	participants: Participant[];
	lastMessage: LastMessage | null;
	unread: number;
}
interface Reaction {
	emoji: string;
	count: number;
	mine: boolean;
}
interface ChatMsg {
	id: number;
	conversationId: number;
	senderId: number;
	senderName: string;
	senderAvatar: string | null;
	body: string;
	replyTo: { id: number; senderName: string; body: string } | null;
	reactions: Reaction[];
	createdAt: string;
}
interface PresenceUser {
	id: number;
	name: string;
}
interface Account {
	id: number;
	username: string;
	fullName: string;
}

const EMOJIS: Array<[string, string]> = [
	["👍", "Thích"],
	["❤️", "Yêu thích"],
	["😂", "Cười"],
	["🎉", "Chúc mừng"],
	["🔥", "Tuyệt vời"],
	["👀", "Đang xem"],
	["🙏", "Cảm ơn"],
	["✅", "Xong"],
	["💡", "Ý tưởng"],
	["😮", "Ngạc nhiên"],
	["🚀", "Triển khai"],
	["👏", "Vỗ tay"],
];
const ARROW = (
	<svg viewBox="0 0 14 14" aria-hidden="true">
		<path d="M5.5 3.5L2 7l3.5 3.5M2 7h6.5a3.5 3.5 0 0 1 3.5 3.5" />
	</svg>
);

const fmtTime = (iso: string) => {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return "";
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")} ${d.getDate()}/${d.getMonth() + 1}`;
};

const initials = (name: string) =>
	name
		.trim()
		.split(/\s+/)
		.slice(-2)
		.map(w => w.charAt(0).toUpperCase())
		.join("") || "?";

export default function ChatBox({
	initialActiveId,
	embedded = false,
	onClose,
}: {
	initialActiveId?: number;
	embedded?: boolean;
	onClose?: () => void;
}) {
	const me = useMemo(() => {
		try {
			return JSON.parse(localStorage.getItem("user") || "{}");
		} catch {
			return {};
		}
	}, []);
	const meId = Number(me.id) || 0;

	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [activeId, setActiveId] = useState<number | null>(
		initialActiveId || null,
	);
	const [messages, setMessages] = useState<ChatMsg[]>([]);
	const [hasMore, setHasMore] = useState(false);
	const [loadingMore, setLoadingMore] = useState(false);
	const [composer, setComposer] = useState("");
	const [replyTo, setReplyTo] = useState<ChatMsg | null>(null);
	const [typing, setTyping] = useState<PresenceUser[]>([]);
	const [online, setOnline] = useState<PresenceUser[]>([]);
	const [reactFor, setReactFor] = useState<number | null>(null);
	const [showNewChat, setShowNewChat] = useState(false);
	const [accounts, setAccounts] = useState<Account[]>([]);
	const [picked, setPicked] = useState<number[]>([]);
	const [groupName, setGroupName] = useState("");
	const [freshIds, setFreshIds] = useState<Set<number>>(new Set());

	const logRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const lastTypingSent = useRef(0);
	const stickBottom = useRef(true);

	const active = conversations.find(c => c.id === activeId) || null;
	const activeIdRef = useRef<number | null>(activeId);
	activeIdRef.current = activeId;
	const conversationsRef = useRef<Conversation[]>(conversations);
	conversationsRef.current = conversations;

	const loadConversations = useCallback(async () => {
		try {
			const res = await apiV1<Conversation[]>("/api/v1/chat/conversations");
			setConversations(res.data || []);
		} catch {
			// im lặng khi poll nền lỗi, tránh spam toast
		}
	}, []);

	const clearFresh = useCallback((id: number) => {
		setFreshIds(prev => {
			if (!prev.has(id)) return prev;
			const next = new Set(prev);
			next.delete(id);
			return next;
		});
	}, []);

	const loadMessages = useCallback(
		async (conversationId: number, mode: "init" | "poll" | "more") => {
			const params =
				mode === "more" && messagesRef.current.length
					? `before=${messagesRef.current[0].id}&limit=50`
					: mode === "poll" && messagesRef.current.length
						? `after=${messagesRef.current[messagesRef.current.length - 1].id}&limit=50`
						: "after=0&limit=50";
			const res = await apiV1<ChatMsg[]>(
				`/api/v1/chat/conversations/${conversationId}/messages?${params}`,
			);
			const rows = res.data || [];
			if (mode === "more") {
				if (!rows.length) setHasMore(false);
				else {
					setMessages(prev => [...rows, ...prev]);
					setFreshIds(new Set());
				}
			} else if (mode === "poll") {
				if (rows.length) {
					setMessages(prev => {
						const existing = new Set(prev.map(row => row.id));
						const next = rows.filter(row => !existing.has(row.id));
						return next.length ? [...prev, ...next] : prev;
					});
					setFreshIds(new Set(rows.map(r => r.id)));
				}
			} else {
				setMessages(rows);
				setHasMore(rows.length >= 50);
				setFreshIds(new Set());
			}
			return rows;
		},
		[],
	);
	const messagesRef = useRef<ChatMsg[]>([]);
	messagesRef.current = messages;
	const loadMessagesRef = useRef(loadMessages);
	loadMessagesRef.current = loadMessages;

	const markRead = useCallback(
		async (conversationId: number, lastId: number) => {
			if (!lastId) return;
			try {
				await apiV1(`/api/v1/chat/conversations/${conversationId}/read`, {
					method: "POST",
					body: JSON.stringify({ lastMessageId: lastId }),
				});
				setConversations(prev =>
					prev.map(c => (c.id === conversationId ? { ...c, unread: 0 } : c)),
				);
			} catch {
				// bỏ qua
			}
		},
		[],
	);

	// nạp hội thoại + poll nền
	useEffect(() => {
		void loadConversations();
		const t = window.setInterval(loadConversations, 5000);
		return () => window.clearInterval(t);
	}, [loadConversations]);

	// mở hội thoại: nạp tin + đánh dấu đã đọc
	useEffect(() => {
		if (!activeId) {
			setMessages([]);
			return;
		}
		setReplyTo(null);
		setReactFor(null);
		stickBottom.current = true;
		let cancelled = false;
		(async () => {
			try {
				const rows = await loadMessagesRef.current(activeId, "init");
				if (!cancelled && rows.length)
					void markReadRef.current(activeId, rows[rows.length - 1].id);
			} catch (e) {
				if (!cancelled)
					toast.error(
						e instanceof Error ? e.message : "Không tải được tin nhắn",
					);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [activeId]);
	const markReadRef = useRef(markRead);
	markReadRef.current = markRead;

	// poll tin nhắn mới + presence của hội thoại đang mở
	useEffect(() => {
		if (!activeId) return;
		const poll = async () => {
			try {
				const rows = await loadMessagesRef.current(activeId, "poll");
				if (rows.length)
					void markReadRef.current(activeId, rows[rows.length - 1].id);
			} catch {
				// bỏ qua lỗi poll nền
			}
			try {
				const res = await apiV1<{
					typing: PresenceUser[];
					online: PresenceUser[];
				}>(`/api/v1/chat/conversations/${activeId}/presence`);
				setTyping(res.data?.typing || []);
				setOnline(res.data?.online || []);
			} catch {
				// bỏ qua
			}
		};
		const t = window.setInterval(poll, 2500);
		return () => window.clearInterval(t);
	}, [activeId]);

	useEffect(() => {
		const socket = getSocket();
		if (!socket) return;
		for (const conversation of conversations)
			socket.emit("chat:join", conversation.id);
	}, [conversations]);

	// socket.io: nhận tin nhắn, đang gõ, reaction, thu hồi theo thời gian thực
	useEffect(() => {
		const socket = getSocket();
		if (!socket) return;
		const joinAll = () => {
			for (const conversation of conversationsRef.current)
				socket.emit("chat:join", conversation.id);
		};
		if (socket.connected) joinAll();
		socket.on("connect", joinAll);

		const onMessage = (payload: { conversationId: number }) => {
			const conversationId = Number(payload?.conversationId);
			void loadConversations();
			if (!conversationId || conversationId !== activeIdRef.current) return;
			void loadMessagesRef
				.current(conversationId, "poll")
				.then(rows => {
					if (rows.length)
						void markReadRef.current(conversationId, rows[rows.length - 1].id);
				})
				.catch(() => {});
		};
		const onTyping = (payload: { conversationId: number; userId: number }) => {
			const conversationId = Number(payload?.conversationId);
			const userId = Number(payload?.userId);
			if (!userId || userId === meId || conversationId !== activeIdRef.current)
				return;
			const name =
				conversationsRef.current
					.find(conversation => conversation.id === conversationId)
					?.participants.find(participant => participant.id === userId)?.name ||
				"";
			setTyping(previous =>
				previous.some(user => user.id === userId)
					? previous
					: [...previous, { id: userId, name }],
			);
			window.setTimeout(
				() =>
					setTyping(previous => previous.filter(user => user.id !== userId)),
				8000,
			);
		};
		const onReaction = (payload: {
			conversationId: number;
			messageId: number;
			reactions: Reaction[];
		}) => {
			if (Number(payload?.conversationId) !== activeIdRef.current) return;
			const messageId = Number(payload?.messageId);
			setMessages(previous =>
				previous.map(message =>
					message.id === messageId
						? { ...message, reactions: payload.reactions || [] }
						: message,
				),
			);
		};
		const onRecall = (payload: {
			conversationId: number;
			messageId: number;
		}) => {
			if (Number(payload?.conversationId) !== activeIdRef.current) return;
			const messageId = Number(payload?.messageId);
			setMessages(previous =>
				previous.filter(message => message.id !== messageId),
			);
		};
		const onConversation = () => void loadConversations();

		socket.on("chat:message", onMessage);
		socket.on("chat:typing", onTyping);
		socket.on("chat:reaction", onReaction);
		socket.on("chat:recall", onRecall);
		socket.on("chat:conversation", onConversation);
		return () => {
			socket.off("connect", joinAll);
			socket.off("chat:message", onMessage);
			socket.off("chat:typing", onTyping);
			socket.off("chat:reaction", onReaction);
			socket.off("chat:recall", onRecall);
			socket.off("chat:conversation", onConversation);
		};
	}, [loadConversations, meId]);

	// tự cuộn xuống khi có tin mới (nếu đang ở cuối)
	useEffect(() => {
		const el = logRef.current;
		if (el && stickBottom.current) el.scrollTop = el.scrollHeight;
	}, [messages, typing]);

	const handleScrollLog = () => {
		const el = logRef.current;
		if (!el) return;
		stickBottom.current =
			el.scrollHeight - el.scrollTop - el.clientHeight < 120;
	};

	const loadMore = async () => {
		if (!activeId || loadingMore || !hasMore) return;
		setLoadingMore(true);
		try {
			await loadMessages(activeId, "more");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Không tải thêm được");
		} finally {
			setLoadingMore(false);
		}
	};

	const sendTyping = () => {
		if (!activeId) return;
		const now = Date.now();
		if (now - lastTypingSent.current < 3000) return;
		lastTypingSent.current = now;
		void apiV1(`/api/v1/chat/conversations/${activeId}/typing`, {
			method: "POST",
		}).catch(() => {});
	};

	const send = async (e?: React.FormEvent) => {
		e?.preventDefault();
		const body = composer.trim();
		if (!body || !activeId) return;
		const quote = replyTo;
		setComposer("");
		setReplyTo(null);
		try {
			const res = await apiV1<ChatMsg>(
				`/api/v1/chat/conversations/${activeId}/messages`,
				{
					method: "POST",
					body: JSON.stringify({
						body,
						replyToId: quote ? quote.id : undefined,
					}),
				},
			);
			if (res.data) {
				setMessages(prev => [...prev, res.data]);
				setFreshIds(new Set([res.data.id]));
				stickBottom.current = true;
				void markRead(activeId, res.data.id);
			}
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Không gửi được tin nhắn",
			);
			setComposer(body);
			if (quote) setReplyTo(quote);
		}
	};

	const toggleReaction = async (messageId: number, emoji: string) => {
		try {
			const res = await apiV1<{ added: boolean; reactions: Reaction[] }>(
				`/api/v1/chat/messages/${messageId}/reactions`,
				{
					method: "POST",
					body: JSON.stringify({ emoji }),
				},
			);
			if (res.data) {
				setMessages(prev =>
					prev.map(m =>
						m.id === messageId ? { ...m, reactions: res.data!.reactions } : m,
					),
				);
			}
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Không thả được reaction",
			);
		}
	};

	const recall = async (m: ChatMsg) => {
		if (!activeId || m.senderId !== meId) return;
		if (!(await confirm("Thu hồi tin nhắn này?"))) return;
		try {
			await apiV1(`/api/v1/chat/conversations/${activeId}/messages/${m.id}`, {
				method: "DELETE",
			});
			setMessages(prev => prev.filter(x => x.id !== m.id));
			toast.success("Đã thu hồi tin nhắn");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Không thu hồi được tin nhắn",
			);
		}
	};

	const [showMembers, setShowMembers] = useState(false);
	const [memberName, setMemberName] = useState("");
	const [addPick, setAddPick] = useState<number | null>(null);

	const openMembers = async () => {
		if (!active || !active.isGroup) return;
		setMemberName(active.name);
		setAddPick(null);
		setShowMembers(true);
		try {
			const res = await fetch("/api/chat/users", {
				headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
			});
			if (res.ok) {
				const rows = await res.json();
				setAccounts(
					(Array.isArray(rows) ? rows : []).filter(
						(u: Account) => Number(u.id) !== meId,
					),
				);
			}
		} catch {
			toast.error("Không tải được danh sách người dùng");
		}
	};

	const patchMembers = async (
		body: Record<string, unknown>,
		successMsg: string,
	) => {
		if (!activeId) return;
		try {
			await apiV1(`/api/v1/chat/conversations/${activeId}`, {
				method: "PATCH",
				body: JSON.stringify(body),
			});
			toast.success(successMsg);
			await loadConversations();
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Không cập nhật được nhóm",
			);
		}
	};

	const leaveGroup = async () => {
		if (!activeId) return;
		if (!(await confirm("Rời khỏi nhóm này?"))) return;
		try {
			await apiV1(`/api/v1/chat/conversations/${activeId}`, {
				method: "PATCH",
				body: JSON.stringify({ removeUserIds: [meId] }),
			});
			setShowMembers(false);
			setActiveId(null);
			await loadConversations();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Không rời được nhóm");
		}
	};

	const openNewChat = async () => {
		setPicked([]);
		setGroupName("");
		setShowNewChat(true);
		try {
			const res = await fetch("/api/chat/users", {
				headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
			});
			if (res.ok) {
				const rows = await res.json();
				setAccounts(
					(Array.isArray(rows) ? rows : []).filter(
						(u: Account) => Number(u.id) !== meId,
					),
				);
			}
		} catch {
			toast.error("Không tải được danh sách người dùng");
		}
	};

	const createChat = async () => {
		if (!picked.length) {
			toast.error("Chọn ít nhất một người để trò chuyện");
			return;
		}
		try {
			const res = await apiV1<{ id: number; reused: boolean }>(
				"/api/v1/chat/conversations",
				{
					method: "POST",
					body: JSON.stringify({ name: groupName.trim(), userIds: picked }),
				},
			);
			setShowNewChat(false);
			await loadConversations();
			if (res.data) setActiveId(res.data.id);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Không tạo được cuộc trò chuyện",
			);
		}
	};

	const headerStatus = !active
		? ""
		: typing.length
			? `${typing.map(t => t.name).join(", ")} đang nhập...`
			: online.length
				? `Đang hoạt động${online.length > 2 ? ` (${online.length})` : ""}`
				: active.isGroup
					? `${active.participants.length + 1} thành viên`
					: "Ngoại tuyến";

	return (
		<div className={embedded ? "u078-emb" : "erp-page"}>
			{embedded ? (
				<div className="u078-emb-head">
					<div>
						<b>Tin nhắn</b>
					</div>
					<div className="u078-emb-actions">
						<button
							type="button"
							className="erp-btn erp-btn-primary"
							onClick={openNewChat}
							title="Đoạn chat mới"
						>
							<MessageCirclePlus size={16} />
						</button>
						{onClose && (
							<button
								type="button"
								className="erp-icon-btn"
								onClick={onClose}
								title="Đóng"
							>
								<X size={16} />
							</button>
						)}
					</div>
				</div>
			) : (
				<div className="erp-page-header">
					<div>
						<h1>Tin nhắn</h1>
						<p>Trò chuyện nội bộ</p>
					</div>
					<button className="erp-btn erp-btn-primary" onClick={openNewChat}>
						<MessageCirclePlus size={16} /> Đoạn chat mới
					</button>
				</div>
			)}
			<div
				className={`u078 u078-page${embedded && activeId ? " thread-open" : ""}`}
			>
				{/* ── cột hội thoại ── */}
				<div className="u078-side">
					<h3>Hội thoại</h3>
					<div className="u078-clist">
						{conversations.map(c => (
							<button
								key={c.id}
								type="button"
								className={`u078-c${c.id === activeId ? " on" : ""}`}
								onClick={() => setActiveId(c.id)}
							>
								<span className="u078-av" aria-hidden="true">
									{c.avatarUrl ? (
										<img src={c.avatarUrl} alt="" />
									) : (
										initials(c.name)
									)}
								</span>
								<span className="min-w-0 flex-1">
									<b>{c.name}</b>
									<small>
										{c.lastMessage ? c.lastMessage.body : "Chưa có tin nhắn"}
									</small>
								</span>
								{c.unread > 0 && (
									<span className="u078-badge">
										{c.unread > 99 ? "99+" : c.unread}
									</span>
								)}
							</button>
						))}
						{!conversations.length && (
							<p className="u078-empty">
								Chưa có hội thoại nào.
								<br />
								Bấm “Đoạn chat mới” để bắt đầu.
							</p>
						)}
					</div>
				</div>

				{/* ── khung chat ── */}
				{!active ? (
					<div className="u078 u078-thread">
						<p className="u078-empty">Chọn một hội thoại để nhắn tin.</p>
					</div>
				) : (
					<div className="u078 u078-thread">
						<div className="u078-top">
							{embedded && (
								<button
									type="button"
									className="u078-back"
									aria-label="Về danh sách"
									onClick={() => setActiveId(null)}
								>
									<svg viewBox="0 0 16 16" aria-hidden="true">
										<path d="M10 3.5L5.5 8l4.5 4.5" />
									</svg>
								</button>
							)}
							<span className="u078-av" aria-hidden="true">
								{active.avatarUrl ? (
									<img src={active.avatarUrl} alt="" />
								) : (
									initials(active.name)
								)}
							</span>
							<span className="min-w-0 flex-1">
								<b>{active.name}</b>
								<small
									className={typing.length || online.length ? undefined : "off"}
								>
									{headerStatus}
								</small>
							</span>
							{active.isGroup && (
								<button
									type="button"
									className="u078-members"
									title="Thành viên nhóm"
									aria-label="Thành viên nhóm"
									onClick={openMembers}
								>
									<Users size={16} />
								</button>
							)}
						</div>

						<div
							ref={logRef}
							className="u078-log"
							aria-live="polite"
							onScroll={handleScrollLog}
						>
							{hasMore && (
								<button
									type="button"
									className="u078-new"
									onClick={loadMore}
									disabled={loadingMore}
								>
									{loadingMore ? "Đang tải..." : "Xem tin cũ hơn"}
								</button>
							)}
							{messages.map(m => (
								<MessageRow
									key={m.id}
									msg={m}
									mine={m.senderId === meId}
									fresh={freshIds.has(m.id)}
									onArrived={clearFresh}
									onRecall={() => recall(m)}
									onReply={() => {
										setReplyTo(m);
										setReactFor(null);
										inputRef.current?.focus({ preventScroll: true });
									}}
									onToggleReaction={emoji => toggleReaction(m.id, emoji)}
									reactOpen={reactFor === m.id}
									setReactOpen={open => setReactFor(open ? m.id : null)}
								/>
							))}
							{typing.length > 0 && (
								<div
									className="u078-ty u078-m"
									aria-label={`${typing.map(t => t.name).join(", ")} đang nhập`}
								>
									<i />
									<i />
									<i />
								</div>
							)}
							{!messages.length && (
								<p className="u078-empty">
									Chưa có tin nhắn. Chào nhau một câu nhé.
								</p>
							)}
						</div>

						<div className={`u078-reply${replyTo ? " on" : ""}`}>
							<div>
								<div className="u078-rbox">
									<span>
										<b>
											Trả lời{" "}
											{replyTo?.senderId === meId
												? "chính bạn"
												: replyTo?.senderName}
										</b>
										<em>{replyTo?.body}</em>
									</span>
									<button
										type="button"
										className="u078-rx"
										aria-label="Hủy trả lời"
										tabIndex={replyTo ? 0 : -1}
										onClick={() => setReplyTo(null)}
									>
										<svg viewBox="0 0 12 12">
											<path d="M3 3l6 6M9 3L3 9" />
										</svg>
									</button>
								</div>
							</div>
						</div>

						<form className="u078-bar" onSubmit={send}>
							<input
								ref={inputRef}
								className="u078-in"
								type="text"
								placeholder="Nhắn tin..."
								aria-label="Nhắn tin"
								autoComplete="off"
								value={composer}
								onChange={e => {
									setComposer(e.target.value);
									sendTyping();
								}}
								onKeyDown={e => {
									if (e.key === "Escape" && replyTo) {
										e.preventDefault();
										setReplyTo(null);
									}
								}}
							/>
							<button
								type="submit"
								className={`u078-send${composer.trim() ? " go" : ""}`}
								aria-label="Gửi tin nhắn"
								title="Gửi tin nhắn"
							>
								<svg className="s" viewBox="0 0 20 20" aria-hidden="true">
									<path d="M3.5 10L16.5 3.5 12 16.5 9.5 11z" />
								</svg>
							</button>
						</form>
					</div>
				)}
			</div>

			{/* ── popup tạo đoạn chat ── */}
			{showNewChat && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-lg">
						<div className="erp-modal-header">
							<div>
								<h2>Đoạn chat mới</h2>
								<p>
									Chọn người để trò chuyện 1-1, chọn nhiều người để tạo nhóm
								</p>
							</div>
							<button type="button" onClick={() => setShowNewChat(false)}>
								<X size={18} />
							</button>
						</div>
						<div className="erp-modal-body space-y-3">
							<label className="block text-[13px] font-medium text-slate-700">
								<span className="mb-1 block">
									Tên nhóm (để trống nếu chat 1-1)
								</span>
								<input
									type="text"
									value={groupName}
									onChange={e => setGroupName(e.target.value)}
									placeholder="VD: Kho – Kinh doanh"
								/>
							</label>
							<div className="u078-users u077">
								{accounts.map(u => (
									<button
										key={u.id}
										type="button"
										onClick={() =>
											setPicked(prev =>
												prev.includes(u.id)
													? prev.filter(id => id !== u.id)
													: [...prev, u.id],
											)
										}
									>
										<input
											type="checkbox"
											readOnly
											checked={picked.includes(u.id)}
											className="h-4 w-4 accent-indigo-600"
										/>
										<span>
											{u.fullName}
											<span className="ml-1 font-mono text-[11px] text-slate-400">
												@{u.username}
											</span>
										</span>
									</button>
								))}
								{!accounts.length && (
									<p className="py-4 text-center text-sm text-slate-400">
										Không tải được danh sách
									</p>
								)}
							</div>
						</div>
						<div className="erp-modal-footer">
							<button
								type="button"
								className="erp-btn"
								onClick={() => setShowNewChat(false)}
							>
								Hủy
							</button>
							<button
								type="button"
								className="erp-btn erp-btn-primary"
								onClick={createChat}
							>
								Bắt đầu chat ({picked.length})
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ── popup quản lý nhóm ── */}
			{showMembers && active?.isGroup && (
				<div className="erp-modal-backdrop">
					<div className="erp-modal max-w-lg">
						<div className="erp-modal-header">
							<div>
								<h2>Nhóm chat</h2>
								<p>{active.participants.length + 1} thành viên</p>
							</div>
							<button type="button" onClick={() => setShowMembers(false)}>
								<X size={18} />
							</button>
						</div>
						<div className="erp-modal-body space-y-4">
							<label className="block text-[13px] font-medium text-slate-700">
								<span className="mb-1 block">Tên nhóm</span>
								<div className="flex gap-2">
									<input
										type="text"
										value={memberName}
										onChange={e => setMemberName(e.target.value)}
										placeholder="Tên nhóm..."
										className="min-w-0 flex-1"
									/>
									<button
										type="button"
										className="erp-btn erp-btn-primary shrink-0"
										onClick={() => {
											if (!memberName.trim()) {
												toast.error("Nhập tên nhóm");
												return;
											}
											void patchMembers(
												{ name: memberName.trim() },
												"Đã đổi tên nhóm",
											);
										}}
									>
										Lưu
									</button>
								</div>
							</label>
							<div>
								<span className="mb-1 block text-[13px] font-medium text-slate-700">
									Thành viên
								</span>
								<div className="u078-mlist u078">
									<div className="u078-mrow">
										<span
											className="u078-av"
											style={{ width: 28, height: 28, fontSize: 12 }}
											aria-hidden="true"
										>
											{initials(me.fullName || me.username || "?")}
										</span>
										<span>
											{me.fullName || me.username} <small>· bạn</small>
										</span>
									</div>
									{active.participants.map(p => (
										<div key={p.id} className="u078-mrow">
											<span
												className="u078-av"
												style={{ width: 28, height: 28, fontSize: 12 }}
												aria-hidden="true"
											>
												{p.avatarUrl ? (
													<img src={p.avatarUrl} alt="" />
												) : (
													initials(p.name)
												)}
											</span>
											<span>{p.name}</span>
											<button
												type="button"
												className="u078-kick"
												title={`Xóa ${p.name} khỏi nhóm`}
												aria-label={`Xóa ${p.name} khỏi nhóm`}
												onClick={async () => {
													if (!(await confirm(`Xóa ${p.name} khỏi nhóm?`)))
														return;
													void patchMembers(
														{ removeUserIds: [p.id] },
														`Đã xóa ${p.name} khỏi nhóm`,
													);
												}}
											>
												<X size={13} />
											</button>
										</div>
									))}
								</div>
							</div>
							<div>
								<span className="mb-1 block text-[13px] font-medium text-slate-700">
									Thêm thành viên
								</span>
								<div className="flex gap-2">
									<select
										value={addPick ?? ""}
										onChange={e =>
											setAddPick(e.target.value ? Number(e.target.value) : null)
										}
										className="min-w-0 flex-1"
									>
										<option value="">Chọn người...</option>
										{accounts
											.filter(
												u =>
													![
														meId,
														...active.participants.map(p => p.id),
													].includes(Number(u.id)),
											)
											.map(u => (
												<option key={u.id} value={u.id}>
													{u.fullName} (@{u.username})
												</option>
											))}
									</select>
									<button
										type="button"
										className="erp-btn shrink-0"
										disabled={!addPick}
										onClick={() => {
											if (!addPick) return;
											setAddPick(null);
											void patchMembers(
												{ addUserIds: [addPick] },
												"Đã thêm thành viên",
											);
										}}
									>
										Thêm
									</button>
								</div>
							</div>
						</div>
						<div className="erp-modal-footer">
							<button
								type="button"
								className="erp-btn text-red-600"
								onClick={leaveGroup}
							>
								Rời nhóm
							</button>
							<button
								type="button"
								className="erp-btn erp-btn-primary"
								onClick={() => setShowMembers(false)}
							>
								Xong
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function MessageRow({
	msg,
	mine,
	fresh,
	onArrived,
	onReply,
	onRecall,
	onToggleReaction,
	reactOpen,
	setReactOpen,
}: {
	msg: ChatMsg;
	mine: boolean;
	fresh: boolean;
	onArrived: (id: number) => void;
	onReply: () => void;
	onRecall: () => void;
	onToggleReaction: (emoji: string) => void;
	reactOpen: boolean;
	setReactOpen: (open: boolean) => void;
}) {
	const rowRef = useRef<HTMLDivElement>(null);
	const [drag, setDrag] = useState(false);
	const gesture = useRef({ down: false, sx: 0, dx: 0 });

	const endGesture = () => {
		const g = gesture.current;
		if (!g.down) return;
		g.down = false;
		setDrag(false);
		const bub = rowRef.current?.querySelector<HTMLElement>(".u078-bub");
		const rep = rowRef.current?.querySelector<HTMLElement>(".u078-rep");
		if (bub) bub.style.setProperty("--dx", "0px");
		if (rowRef.current) rowRef.current.style.setProperty("--ro", "0");
		rep?.classList.remove("full");
		if (g.dx >= 60) onReply();
	};

	return (
		<div>
			<div
				ref={rowRef}
				className={`u078-m${mine ? " me" : ""}${drag ? " drag" : ""}${fresh ? " in" : ""}`}
				onAnimationEnd={e => {
					if ((e.target as HTMLElement).classList.contains("u078-m"))
						onArrived(msg.id);
				}}
			>
				{!mine && (
					<span className="u078-rep" aria-hidden="true">
						{ARROW}
					</span>
				)}
				<span
					className="u078-bub"
					onPointerDown={e => {
						if (mine || e.button !== 0) return;
						gesture.current = { down: true, sx: e.clientX, dx: 0 };
						try {
							(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
						} catch {
							// bỏ qua
						}
						setDrag(true);
					}}
					onPointerMove={e => {
						const g = gesture.current;
						if (!g.down) return;
						g.dx = Math.max(0, e.clientX - g.sx);
						const d = g.dx > 60 ? 60 + (g.dx - 60) * 0.3 : g.dx;
						(e.currentTarget as HTMLElement).style.setProperty(
							"--dx",
							`${d}px`,
						);
						rowRef.current?.style.setProperty(
							"--ro",
							Math.min(1, g.dx / 60).toFixed(2),
						);
						rowRef.current
							?.querySelector(".u078-rep")
							?.classList.toggle("full", g.dx >= 60);
					}}
					onPointerUp={endGesture}
					onPointerCancel={endGesture}
				>
					{msg.replyTo && (
						<span className="u078-q">
							<b>{msg.replyTo.senderName}</b>
							<span>{msg.replyTo.body}</span>
						</span>
					)}
					{msg.body}
					<span className="u078-meta">{fmtTime(msg.createdAt)}</span>
				</span>
				{!mine && (
					<button
						type="button"
						className="u078-rb"
						aria-label={`Trả lời ${msg.senderName}`}
						onClick={onReply}
					>
						{ARROW}
					</button>
				)}
				{mine &&
					Date.now() - new Date(msg.createdAt).getTime() <= 5 * 60 * 1000 && (
						<button
							type="button"
							className="u078-rb"
							title="Thu hồi (trong 5 phút)"
							aria-label="Thu hồi tin nhắn"
							onClick={onRecall}
						>
							<Undo2 size={14} />
						</button>
					)}
			</div>
			{(msg.reactions.length > 0 || !mine) && (
				<div
					className={`u077-rx${mine ? " me" : ""}`}
					role="group"
					aria-label="Cảm xúc"
				>
					{msg.reactions.map(r => (
						<button
							key={r.emoji}
							type="button"
							className="u077-chip"
							aria-pressed={r.mine}
							aria-label={`${r.emoji}, ${r.count} người${r.mine ? ", có bạn" : ""}`}
							onClick={() => onToggleReaction(r.emoji)}
						>
							<span aria-hidden="true">{r.emoji}</span>
							<b>{r.count}</b>
						</button>
					))}
					<span className="u077-popwrap">
						<button
							type="button"
							className="u077-add"
							aria-haspopup="dialog"
							aria-expanded={reactOpen}
							aria-label="Thêm cảm xúc"
							onClick={() => setReactOpen(!reactOpen)}
						>
							<svg viewBox="0 0 18 18" aria-hidden="true">
								<circle cx="9" cy="9" r="6.5" />
								<path d="M6.5 10.5a3 3 0 0 0 5 0M7 7h.01M11 7h.01" />
							</svg>
						</button>
						<ReactionPopover
							open={reactOpen}
							onClose={() => setReactOpen(false)}
							onPick={emoji => {
								onToggleReaction(emoji);
								setReactOpen(false);
							}}
						/>
					</span>
				</div>
			)}
		</div>
	);
}

function ReactionPopover({
	open,
	onClose,
	onPick,
}: {
	open: boolean;
	onClose: () => void;
	onPick: (emoji: string) => void;
}) {
	const popRef = useRef<HTMLDivElement>(null);
	const gridRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		const onDown = (e: PointerEvent) => {
			if (!popRef.current?.contains(e.target as Node)) onClose();
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("pointerdown", onDown, true);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("pointerdown", onDown, true);
			document.removeEventListener("keydown", onKey);
		};
	}, [open, onClose]);

	useEffect(() => {
		if (open) {
			const first =
				gridRef.current?.querySelector<HTMLButtonElement>(".u077-e");
			first?.focus({ preventScroll: true });
		}
	}, [open]);

	if (!open) return null;
	return (
		<div
			ref={popRef}
			className="u077-pop"
			role="dialog"
			aria-label="Chọn cảm xúc"
		>
			<small>Thường dùng</small>
			<div
				ref={gridRef}
				className="u077-grid"
				onKeyDown={e => {
					const items = Array.from(
						gridRef.current?.querySelectorAll<HTMLButtonElement>(".u077-e") ||
							[],
					);
					const i = items.indexOf(document.activeElement as HTMLButtonElement);
					const d: Record<string, number> = {
						ArrowRight: 1,
						ArrowLeft: -1,
						ArrowDown: 6,
						ArrowUp: -6,
					};
					const step = d[e.key];
					if (step !== undefined && i >= 0) {
						e.preventDefault();
						const n = (i + step + items.length) % items.length;
						items[n].focus();
					}
				}}
			>
				{EMOJIS.map(([emoji, name], i) => (
					<button
						key={emoji}
						type="button"
						className="u077-e"
						tabIndex={i === 0 ? 0 : -1}
						aria-label={name}
						onClick={() => onPick(emoji)}
					>
						{emoji}
					</button>
				))}
			</div>
		</div>
	);
}
