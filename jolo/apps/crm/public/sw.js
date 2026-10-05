/* Aviso de mensagem nova do CRM Jolô (Web Push), como o WhatsApp.
   So mostra o aviso e abre a conversa: nao guarda nada no aparelho. */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = {};
  }
  const titulo = d.titulo || 'CRM Jolô';
  e.waitUntil(
    self.registration.showNotification(titulo, {
      body: d.corpo || 'Nova mensagem',
      icon: '/icones/icone-192.png',
      badge: '/icones/icone-192.png',
      tag: d.marca || 'crm-jolo',
      renotify: true,
      data: { endereco: d.endereco || '/inbox' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const destino = new URL(e.notification.data?.endereco || '/inbox', self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((abertas) => {
      for (const janela of abertas) {
        if (new URL(janela.url).origin === self.location.origin && 'navigate' in janela) {
          return janela.focus().then(() => janela.navigate(destino));
        }
      }
      return self.clients.openWindow(destino);
    }),
  );
});
