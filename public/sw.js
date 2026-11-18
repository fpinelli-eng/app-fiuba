// Service worker de FIUBI: solo para las notificaciones push (no guarda páginas ni intercepta pedidos).
// Lo registra "Activar notificaciones" en Perfil. El servidor manda { title, body, url, tag }
// (buildPushPayload en src/lib/broadcast/model.ts).

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const title = typeof data.title === "string" && data.title ? data.title : "FIUBI";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/icons/icon-192.png",
      tag: typeof data.tag === "string" ? data.tag : undefined,
      data: { url: typeof data.url === "string" && data.url ? data.url : "/" },
    }),
  );
});

// Tocar la notificación abre su enlace: si FIUBI ya está abierta en esa dirección la trae al frente;
// si no, abre una ventana nueva.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let url;
  try {
    url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin);
  } catch {
    url = new URL("/", self.location.origin);
  }
  if (url.protocol !== "https:" && url.origin !== self.location.origin) url = new URL("/", self.location.origin);
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url === url.href && "focus" in w) return w.focus();
      }
      return self.clients.openWindow(url.href);
    }),
  );
});
