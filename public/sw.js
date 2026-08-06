self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Nuevo pedido pendiente';

  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || 'Requiere tu atención',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: data.url || '/dashboard' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const path = event.notification.data?.url || '/dashboard';
  const targetUrl = new URL(path, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = clientList[0];

      if (existing) {
        try {
          const navigated = await existing.navigate(targetUrl);
          await (navigated || existing).focus();
          return;
        } catch (err) {
          // navigate() no soportado o fallo (comun en Safari/iOS) - abrimos ventana nueva.
        }
      }

      await self.clients.openWindow(targetUrl);
    })()
  );
});
