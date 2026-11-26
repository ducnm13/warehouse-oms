self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", event => {
	event.waitUntil(self.clients.claim());
});

self.addEventListener("push", event => {
	let payload = {};
	if (event.data) {
		try {
			payload = event.data.json();
		} catch {
			payload = { body: event.data.text() };
		}
	}

	const title = payload.title || "Challenge ERP";
	const conversationId = payload.conversationId || "";
	const rawUrl = payload.url || "/?chat=1";
	const targetUrl =
		conversationId && !rawUrl.includes("conversationId=")
			? `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}conversationId=${encodeURIComponent(conversationId)}`
			: rawUrl;

	const options = {
		body: payload.body || "Bạn có tin nhắn mới.",
		icon: payload.icon || "/images/favicon_io/web-app-manifest-192x192.png",
		badge: payload.badge || "/images/favicon_io/web-app-manifest-192x192.png",
		tag: payload.tag || (conversationId ? `chat-${conversationId}` : undefined),
		data: {
			url: targetUrl,
			conversationId,
		},
	};

	event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
	event.notification.close();
	const data = event.notification.data || {};
	const targetUrl = data.url || "/?chat=1";

	event.waitUntil(
		(async () => {
			const clients = await self.clients.matchAll({
				type: "window",
				includeUncontrolled: true,
			});
			const client = clients.find(item =>
				item.url.startsWith(self.location.origin),
			);
			if (client) {
				await client.focus();
				client.postMessage({
					type: "OPEN_CHAT",
					conversationId: data.conversationId,
				});
				return;
			}
			await self.clients.openWindow(targetUrl);
		})(),
	);
});
