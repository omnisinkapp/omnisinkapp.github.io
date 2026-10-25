// Omnisink Web: guarda la app (no los mensajes: esos ya están cifrados en IndexedDB) para que abra sin conexión,
// y muestra los avisos que llegan con la app cerrada (Web Push). El aviso nunca trae el texto del mensaje.
const CACHE = 'omnisink-web-v2';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './index.html']))); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((l) => Promise.all(l.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;   // Supabase y todo lo de afuera: directo
  if (r.mode === 'navigate') {
    // la página: primero la red (versión nueva), si no hay conexión, la guardada
    e.respondWith(fetch(r).then((resp) => { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copia)); return resp; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // archivos de la app (llevan su huella en el nombre): primero lo guardado
  e.respondWith(caches.match(r).then((g) => g || fetch(r).then((resp) => {
    if (resp.ok) { const copia = resp.clone(); caches.open(CACHE).then((c) => c.put(r, copia)); }
    return resp;
  })));
});

// ---------------------------------------------------------------- avisos
// iPhone/Safari exigen mostrar un aviso por CADA push (si no, cancelan la suscripción). Chrome/Edge/Firefox no:
// ahí se omite si Omnisink ya está abierto y a la vista.
const exigeAviso = () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && !/Chrome|CriOS|Edg|Firefox|FxiOS/.test(navigator.userAgent);

self.addEventListener('push', (e) => {
  e.waitUntil((async () => {
    let d = { titulo: 'Omnisink', cuerpo: '💬 Tienes un mensaje nuevo', datos: {} };
    try { d = { ...d, ...e.data.json() }; } catch { /* aviso sin datos: texto genérico */ }
    const llamada = d.datos && d.datos.tipo === 'llamada';
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (!exigeAviso() && ventanas.some((c) => c.visibilityState === 'visible' && c.focused)) return;   // ya la está viendo
    await self.registration.showNotification(d.titulo || 'Omnisink', {
      body: d.cuerpo,
      icon: './icono-192.png',
      badge: './icono-192.png',
      tag: llamada ? 'omnisink-llamada' : 'omnisink-mensajes',   // los mensajes se agrupan en un solo aviso
      renotify: true,
      requireInteraction: !!llamada,
      vibrate: llamada ? [300, 200, 300, 200, 300] : [120],
      data: d.datos || {},
    });
  })());
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const chat = e.notification.data && e.notification.data.chatId;
  const destino = new URL(chat ? `./#/chat/${encodeURIComponent(chat)}` : './', self.registration.scope).href;
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const abierta = ventanas.find((c) => c.url.startsWith(self.registration.scope));
    if (abierta) {
      await abierta.focus();
      if ('navigate' in abierta) await abierta.navigate(destino).catch(() => {});
      return;
    }
    await self.clients.openWindow(destino);
  })());
});

// el navegador renovó la suscripción por su cuenta: la app la vuelve a guardar al abrirse (revisarAvisos)
self.addEventListener('pushsubscriptionchange', () => {});
