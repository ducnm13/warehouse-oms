self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", event => {
	event.waitUntil(self.clients.claim());
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
