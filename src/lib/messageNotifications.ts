const SW_URL = "/sw.js";
const ICON = "/images/favicon_io/android-chrome-192x192.png";
const BADGE = "/images/favicon_io/favicon-32x32.png";

type PermissionState = NotificationPermission | "unsupported";

let audioContext: AudioContext | null = null;

const getAudioContext = () => {
	if (typeof window === "undefined") return null;
	const Ctor =
		window.AudioContext ||
		(window as typeof window & { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;
	if (!Ctor) return null;
	if (!audioContext) audioContext = new Ctor();
	return audioContext;
};

export const notificationPermission = (): PermissionState => {
	if (typeof window === "undefined" || !("Notification" in window)) {
		return "unsupported";
	}
	return Notification.permission;
};

export const notificationsSupported = () => notificationPermission() !== "unsupported";

export const registerNotificationWorker = async () => {
	if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
		return null;
	}
	try {
		return await navigator.serviceWorker.register(SW_URL);
	} catch {
		return null;
	}
};

export const unlockNotificationSound = () => {
	const ctx = getAudioContext();
	if (!ctx) return;
	if (ctx.state === "suspended") void ctx.resume().catch(() => {});
};

export const playNotificationSound = () => {
	const ctx = getAudioContext();
	if (!ctx) return;

	const play = () => {
		if (ctx.state !== "running") return;
		const now = ctx.currentTime;
		const tones: Array<[number, number, number]> = [
			[880, 0, 0.12],
			[1174.66, 0.11, 0.2],
		];
		for (const [frequency, offset, duration] of tones) {
			const oscillator = ctx.createOscillator();
			const gain = ctx.createGain();
			const start = now + offset;
			oscillator.type = "sine";
			oscillator.frequency.setValueAtTime(frequency, start);
			gain.gain.setValueAtTime(0.0001, start);
			gain.gain.exponentialRampToValueAtTime(0.16, start + 0.012);
			gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
			oscillator.connect(gain);
			gain.connect(ctx.destination);
			oscillator.start(start);
			oscillator.stop(start + duration + 0.03);
		}
	};

	if (ctx.state === "suspended") {
		void ctx.resume().then(play).catch(() => {});
		return;
	}
	play();
};

export const requestNotificationPermission = async (): Promise<PermissionState> => {
	if (!notificationsSupported()) return "unsupported";
	unlockNotificationSound();
	try {
		return await Notification.requestPermission();
	} catch {
		return Notification.permission;
	}
};

const getWorkerRegistration = async () => {
	if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
		return null;
	}
	try {
		return (
			(await navigator.serviceWorker.getRegistration()) ||
			(await navigator.serviceWorker.ready)
		);
	} catch {
		return null;
	}
};

export const showMessageNotification = async (
	title: string,
	body: string,
	data: { conversationId?: number } = {},
) => {
	if (notificationPermission() !== "granted") return;
	const options: NotificationOptions = {
		body: body.length > 120 ? `${body.slice(0, 120)}…` : body,
		icon: ICON,
		badge: BADGE,
		tag: data.conversationId ? `chat-${data.conversationId}` : "chat",
		data: { ...data, url: "/?chat=1" },
	};

	const registration = await getWorkerRegistration();
	if (registration) {
		try {
			// Mobile Chrome/Safari không cho tạo Notification trực tiếp.
			await registration.showNotification(title, options);
			return;
		} catch {
			// thử fallback bên dưới
		}
	}

	try {
		new Notification(title, options);
	} catch {
		// trình duyệt chặn (context không an toàn / chưa cài app)
	}
};
