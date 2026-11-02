// What did you do - Service Worker
// 通知の表示（サーバーからの Web Push を含む）とクリック時の画面復帰を担当する。
// オフライン用のキャッシュはしない。

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// サーバーからの通知（予定時間に達した作業）を表示する。
// アプリ内の通知と同じ tag なので、両方届いても1つにまとまる。
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "What did you do", {
      body: data.body || "",
      tag: data.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url || "/" },
    }),
  );
});

// 通知をタップしたら、開いている画面があればそれを前面に出し、なければホームを開く
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(event.notification.data?.url || "/");
    })(),
  );
});
