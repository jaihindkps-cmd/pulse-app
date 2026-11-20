// Minimal service worker: app "install" hone layak banata hai. API/WebSocket ko kabhi cache nahi karta.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
// Network first (always the newest version when online), and the last good copy of the app's own files when offline.
const CACHE = "pulse-shell-v1";
const OFFLINE = '<meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font:16px system-ui;background:#0E1626;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:24px">You are offline. Open Pulse again when you have internet.</body>';
self.addEventListener("fetch", (e) => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || u.origin !== location.origin) return;
  if (/^\/(__|admin)/.test(u.pathname)) return;
  e.respondWith(
    fetch(r).then((res) => {
      if (res && res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(r).then((hit) => hit || (r.mode === "navigate" ? caches.match("./").then((h) => h || new Response(OFFLINE, { headers: { "content-type": "text/html; charset=utf-8" } })) : Response.error())))
  );
});
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE && k.startsWith("pulse-shell")).map((k) => caches.delete(k))))));
