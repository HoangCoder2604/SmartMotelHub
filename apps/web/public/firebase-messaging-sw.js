/* SmartMotel Hub Phase 9 - lightweight Web Push service worker */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload?.notification?.title || payload?.data?.title || "SmartMotel Hub";
  const body = payload?.notification?.body || payload?.data?.body || "Bạn có thông báo mới.";
  const rawHref = payload?.data?.href || "/notifications";
  const href = typeof rawHref === "string" && rawHref.startsWith("/") ? rawHref : "/notifications";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      data: { href },
      tag: payload?.data?.notificationId || undefined,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const rawHref = event.notification?.data?.href || "/notifications";
  const href = typeof rawHref === "string" && rawHref.startsWith("/") ? rawHref : "/notifications";
  const targetUrl = new URL(href, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          return client.focus().then(() => {
            if ("navigate" in client) return client.navigate(targetUrl);
            return undefined;
          });
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      return undefined;
    }),
  );
});
