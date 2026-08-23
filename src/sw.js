import { precacheAndRoute } from "workbox-precaching";

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { title: "Central de Cuidados", body: event.data?.text() || "Você tem um lembrete." }; }

  const title = data.title || "Central de Cuidados";
  const options = {
    body: data.body || "Você tem um lembrete.",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: data.url || "/" },
    actions: data.actions || []
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.navigate(url);
        return;
      }
      return clients.openWindow(url);
    })
  );
});
