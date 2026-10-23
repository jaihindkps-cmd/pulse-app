// Minimal service worker: app "install" hone layak banata hai. API/WebSocket ko kabhi cache nahi karta.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.mode === "navigate" && u.origin === location.origin) {
    e.respondWith(fetch(e.request).catch(() => new Response('<meta charset="utf-8"><meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;text-align:center;padding:48px 20px">Internet nahi hai. Connection check karke dobara try karo.</body>', { headers: { "content-type": "text/html; charset=utf-8" } })));
  }
});
