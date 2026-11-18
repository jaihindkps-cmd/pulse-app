// Snapchat-style video effects: colour filters, face stickers (anchored to the face where the browser has FaceDetector,
// otherwise to a fixed spot) and falling-emoji overlays. The camera frame is drawn to a canvas and the canvas stream is
// swapped into the call, so the other person sees the effect too. With no effect picked the raw camera track is used.
export var FILTERS = [
  { id: "none", name: "Natural", css: "none" },
  { id: "glow", name: "Glow", css: "brightness(1.08) contrast(1.04) saturate(1.2) blur(.6px)" },
  { id: "warm", name: "Warm", css: "sepia(.28) saturate(1.35) brightness(1.04)" },
  { id: "cool", name: "Cool", css: "hue-rotate(-12deg) saturate(1.15) brightness(1.03)" },
  { id: "vintage", name: "Vintage", css: "sepia(.55) contrast(.92) saturate(.9)" },
  { id: "mono", name: "B&W", css: "grayscale(1) contrast(1.1)" },
  { id: "pop", name: "Pop", css: "contrast(1.25) saturate(1.7)" }
];
export var STICKERS = [
  { id: "none", e: "🚫", a: "none" },
  { id: "crown", e: "👑", a: "head", s: 0.9 }, { id: "hat", e: "🎩", a: "head", s: 1 }, { id: "party", e: "🥳", a: "head", s: 0.8 },
  { id: "ears", e: "🐰", a: "head", s: 0.9 }, { id: "shades", e: "🕶️", a: "eyes", s: 1.05 }, { id: "nerd", e: "🤓", a: "face", s: 1 },
  { id: "mask", e: "😷", a: "mouth", s: 0.7 }, { id: "clown", e: "🤡", a: "face", s: 1.05 }, { id: "alien", e: "👽", a: "face", s: 1.05 },
  { id: "hearts", e: "❤️", a: "rain" }, { id: "stars", e: "✨", a: "rain" }, { id: "party2", e: "🎉", a: "rain" }, { id: "fire", e: "🔥", a: "rain" }
];

export function effectsSupported() { return !!(document.createElement("canvas").captureStream); }

export function createEffects(srcStream) {
  var vt = srcStream.getVideoTracks()[0]; if (!vt) return null;
  var vid = document.createElement("video"); vid.muted = true; vid.playsInline = true; vid.srcObject = new MediaStream([vt]); vid.play().catch(function () {});
  var cv = document.createElement("canvas"), cx = cv.getContext("2d"), out = cv.captureStream(30), outTrack = out.getVideoTracks()[0];
  var st = { filter: "none", sticker: "none", raf: 0, face: null, fd: null, lastFd: 0, parts: [], stopped: false };
  try { if (window.FaceDetector) st.fd = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); } catch (e) {}
  function css() { for (var i = 0; i < FILTERS.length; i++) if (FILTERS[i].id === st.filter) return FILTERS[i].css; return "none"; }
  function stk() { for (var i = 0; i < STICKERS.length; i++) if (STICKERS[i].id === st.sticker) return STICKERS[i]; return STICKERS[0]; }
  function frame(t) {
    if (st.stopped) return; st.raf = requestAnimationFrame(frame);
    var w = vid.videoWidth, h = vid.videoHeight; if (!w || !h) return;
    var k = Math.min(1, 1280 / Math.max(w, h)), cw = Math.round(w * k), ch = Math.round(h * k);
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    cx.filter = css(); cx.drawImage(vid, 0, 0, cw, ch); cx.filter = "none";
    var s = stk(); if (s.a === "none") return;
    if (s.a === "rain") {
      if (st.parts.length < 22 && Math.random() < 0.35) st.parts.push({ x: Math.random() * cw, y: -30, v: 2 + Math.random() * 4, z: 24 + Math.random() * 30 });
      cx.textAlign = "center"; cx.textBaseline = "middle";
      st.parts = st.parts.filter(function (p) { p.y += p.v; cx.font = p.z + "px sans-serif"; cx.fillText(s.e, p.x, p.y); return p.y < ch + 40; });
      return;
    }
    if (st.fd && t - st.lastFd > 140) { st.lastFd = t; st.fd.detect(vid).then(function (r) { st.face = r && r[0] ? r[0].boundingBox : null; }).catch(function () { st.fd = null; }); }
    var f = st.face, fx, fy, fw, fh;
    if (f) { fx = f.x * k; fy = f.y * k; fw = f.width * k; fh = f.height * k; } else { fw = cw * 0.5; fh = fw * 1.2; fx = (cw - fw) / 2; fy = ch * 0.25; }
    var size = fw * (s.s || 1), x = fx + fw / 2, y;
    if (s.a === "head") y = fy - size * 0.1; else if (s.a === "eyes") y = fy + fh * 0.38; else if (s.a === "mouth") y = fy + fh * 0.72; else y = fy + fh * 0.5;
    cx.font = size + "px sans-serif"; cx.textAlign = "center"; cx.textBaseline = "middle"; cx.fillText(s.e, x, y);
  }
  st.raf = requestAnimationFrame(frame);
  return {
    track: outTrack, raw: vt,
    set: function (o) { if (o.filter) st.filter = o.filter; if (o.sticker) { st.sticker = o.sticker; st.parts = []; } },
    state: function () { return { filter: st.filter, sticker: st.sticker }; },
    active: function () { return st.filter !== "none" || st.sticker !== "none"; },
    stop: function () { st.stopped = true; cancelAnimationFrame(st.raf); try { outTrack.stop(); } catch (e) {} try { vid.srcObject = null; } catch (e) {} }
  };
}
