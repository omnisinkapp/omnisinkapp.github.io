// Omnisink Web: guarda la app (no los mensajes: esos ya están cifrados en IndexedDB) para que abra sin conexión.
const CACHE = 'omnisink-web-v1';
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
