// Anonymous face masks for private support calls. The camera frame is drawn to a canvas, the face is covered there, and only
// the canvas stream is sent to the other person -- so the real face never leaves the phone. It fails closed: if a face
// detector exists and loses the face, the whole picture is blurred instead of showing it.
export var MASKS = [
  { id: "venetian", e: "🎭", en: "Venetian", hi: "वेनेशियन" },
  { id: "noir", e: "🖤", en: "Noir", hi: "नोयर" },
  { id: "hero", e: "🦸", en: "Hero", hi: "हीरो" },
  { id: "cat", e: "🐱", en: "Cat", hi: "बिल्ली" },
  { id: "kitsune", e: "🦊", en: "Kitsune", hi: "किट्सुने" },
  { id: "robot", e: "🤖", en: "Robot", hi: "रोबोट" },
  { id: "neon", e: "💠", en: "Neon", hi: "नियॉन" },
  { id: "mosaic", e: "🔳", en: "Mosaic", hi: "मोज़ेक" },
  { id: "shadow", e: "🌑", en: "Shadow", hi: "शैडो" },
  { id: "off", e: "🙂", en: "My face", hi: "मेरा चेहरा" }
];

export function maskSupported() { return !!(document.createElement("canvas").captureStream); }

function ell(cx, x, y, rx, ry) { cx.beginPath(); cx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
function almond(cx, x, y, w, h, tilt) {
  cx.beginPath(); cx.moveTo(x - w, y + tilt);
  cx.quadraticCurveTo(x, y - h * 1.5, x + w, y - tilt); cx.quadraticCurveTo(x, y + h * 1.3, x - w, y + tilt); cx.closePath();
}
// The mask covers ear to ear, brow to the tip of the nose. The lips and chin stay visible. (x = centre, T = top, W wide, H tall)
function band(cx, x, T, W, H, wing) {
  var l = x - W / 2, r = x + W / 2, w = wing || 0;
  cx.beginPath(); cx.moveTo(l - w, T + H * 0.3);
  cx.bezierCurveTo(l + W * 0.02, T - H * 0.05, x - W * 0.3, T - H * 0.06, x - W * 0.1, T + H * 0.06);
  cx.quadraticCurveTo(x, T + H * 0.12, x + W * 0.1, T + H * 0.06);
  cx.bezierCurveTo(x + W * 0.3, T - H * 0.06, r - W * 0.02, T - H * 0.05, r + w, T + H * 0.3);
  cx.bezierCurveTo(r + W * 0.01, T + H * 0.62, x + W * 0.36, T + H * 0.7, x + W * 0.13, T + H * 0.76);
  cx.quadraticCurveTo(x + W * 0.08, T + H * 1.02, x, T + H); cx.quadraticCurveTo(x - W * 0.08, T + H * 1.02, x - W * 0.13, T + H * 0.76);
  cx.bezierCurveTo(x - W * 0.36, T + H * 0.7, l - W * 0.01, T + H * 0.62, l - w, T + H * 0.3); cx.closePath();
}
function eyes(cx, x, T, W, H, fill, edge, glow) {
  var ex = W * 0.2, ey = T + H * 0.36, ew = W * 0.14, eh = H * 0.1;
  [-1, 1].forEach(function (s) { almond(cx, x + s * ex, ey, ew, eh, s * eh * 0.5); cx.fillStyle = fill; if (glow) { cx.shadowColor = glow; cx.shadowBlur = H * 0.25; } cx.fill(); cx.shadowBlur = 0; if (edge) { cx.strokeStyle = edge; cx.lineWidth = Math.max(1.5, W * 0.01); cx.stroke(); } });
}
function drawMask(cx, style, x, T, W, H) {
  var lw = Math.max(2, W * 0.016); cx.save(); cx.lineJoin = "round"; cx.lineCap = "round";
  if (style === "venetian") {
    var g = cx.createLinearGradient(x - W / 2, T, x + W / 2, T + H); g.addColorStop(0, "#ffffff"); g.addColorStop(1, "#e6dccb");
    band(cx, x, T, W, H, W * 0.05); cx.fillStyle = g; cx.fill(); cx.strokeStyle = "#c9a24b"; cx.lineWidth = lw * 1.4; cx.stroke();
    eyes(cx, x, T, W, H, "#16161c", "#c9a24b");
    cx.strokeStyle = "#c9a24b"; cx.lineWidth = lw * 0.8; cx.beginPath(); cx.moveTo(x - W * 0.46, T + H * 0.52); cx.quadraticCurveTo(x - W * 0.3, T + H * 0.7, x - W * 0.16, T + H * 0.6); cx.moveTo(x + W * 0.46, T + H * 0.52); cx.quadraticCurveTo(x + W * 0.3, T + H * 0.7, x + W * 0.16, T + H * 0.6); cx.stroke();
    cx.fillStyle = "#b3364a"; cx.beginPath(); cx.moveTo(x, T + H * 0.1); cx.lineTo(x + W * 0.04, T + H * 0.22); cx.lineTo(x, T + H * 0.34); cx.lineTo(x - W * 0.04, T + H * 0.22); cx.closePath(); cx.fill();
    [["#1fa59a", -1], ["#d6409f", -1], ["#1fa59a", 1]].forEach(function (f, i) { cx.save(); cx.translate(x + f[1] * (W * 0.5 + i * 0.01 * W), T + H * (0.1 + i * 0.13)); cx.rotate(f[1] * (0.9 + i * 0.25)); ell(cx, 0, 0, W * 0.2, W * 0.045); cx.fillStyle = f[0]; cx.fill(); cx.restore(); });
  } else if (style === "noir") {
    var g2 = cx.createLinearGradient(x, T, x, T + H); g2.addColorStop(0, "#2c2c36"); g2.addColorStop(1, "#08080c");
    band(cx, x, T, W, H, W * 0.04); cx.fillStyle = g2; cx.fill(); cx.strokeStyle = "#d4af5a"; cx.lineWidth = lw * 1.3; cx.stroke();
    eyes(cx, x, T, W, H, "#f4efe0", "#d4af5a");
    cx.fillStyle = "rgba(212,175,90,.9)"; for (var i = 0; i < 9; i++) { cx.beginPath(); cx.arc(x - W * 0.42 + i * W * 0.105, T + H * (0.12 + (i % 2) * 0.05), Math.max(1.5, W * 0.01), 0, 7); cx.fill(); }
    cx.strokeStyle = "rgba(212,175,90,.8)"; cx.lineWidth = lw * 0.8; cx.beginPath(); cx.moveTo(x, T + H * 0.46); cx.lineTo(x, T + H * 0.92); cx.stroke();
  } else if (style === "hero") {
    var g3 = cx.createLinearGradient(x - W / 2, T, x + W / 2, T); g3.addColorStop(0, "#d92b3a"); g3.addColorStop(1, "#ff5a3c");
    band(cx, x, T, W, H, W * 0.1); cx.fillStyle = g3; cx.fill(); cx.strokeStyle = "#1c3f9e"; cx.lineWidth = lw * 1.6; cx.stroke();
    var ex = W * 0.2, ey = T + H * 0.36; [-1, 1].forEach(function (s) { cx.beginPath(); cx.moveTo(x + s * (ex - W * 0.15), ey + H * 0.08); cx.lineTo(x + s * (ex + W * 0.16), ey - H * 0.12); cx.lineTo(x + s * (ex + W * 0.14), ey + H * 0.06); cx.closePath(); cx.fillStyle = "#fff"; cx.fill(); cx.strokeStyle = "#1c3f9e"; cx.lineWidth = lw; cx.stroke(); });
  } else if (style === "cat") {
    var g4 = cx.createLinearGradient(x, T, x, T + H); g4.addColorStop(0, "#3a3340"); g4.addColorStop(1, "#1a1620");
    [-1, 1].forEach(function (s) { cx.beginPath(); cx.moveTo(x + s * W * 0.46, T + H * 0.12); cx.lineTo(x + s * W * 0.38, T - H * 0.55); cx.lineTo(x + s * W * 0.14, T + H * 0.02); cx.closePath(); cx.fillStyle = g4; cx.fill(); cx.strokeStyle = "#ff8fb3"; cx.lineWidth = lw; cx.stroke(); });
    band(cx, x, T, W, H, W * 0.04); cx.fillStyle = g4; cx.fill(); cx.strokeStyle = "#ff8fb3"; cx.lineWidth = lw; cx.stroke();
    eyes(cx, x, T, W, H, "#ffc94a", "#1a1620"); cx.fillStyle = "#1a1620"; [-1, 1].forEach(function (s) { cx.beginPath(); cx.ellipse(x + s * W * 0.2, T + H * 0.36, W * 0.012, H * 0.09, 0, 0, 7); cx.fill(); });
    cx.fillStyle = "#ff8fb3"; cx.beginPath(); cx.moveTo(x - W * 0.05, T + H * 0.86); cx.lineTo(x + W * 0.05, T + H * 0.86); cx.lineTo(x, T + H * 0.96); cx.closePath(); cx.fill();
    cx.strokeStyle = "#f5e9f0"; cx.lineWidth = lw * 0.7; [-1, 1].forEach(function (s) { [0.58, 0.68].forEach(function (yy, j) { cx.beginPath(); cx.moveTo(x + s * W * 0.2, T + H * yy); cx.lineTo(x + s * W * 0.52, T + H * (yy - 0.06 + j * 0.12)); cx.stroke(); }); });
  } else if (style === "kitsune") {
    var g5 = cx.createLinearGradient(x, T, x, T + H); g5.addColorStop(0, "#ffffff"); g5.addColorStop(1, "#efe7df");
    band(cx, x, T, W, H, W * 0.05); cx.fillStyle = g5; cx.fill(); cx.strokeStyle = "#d33a2c"; cx.lineWidth = lw * 1.3; cx.stroke();
    cx.strokeStyle = "#d33a2c"; cx.fillStyle = "#d33a2c"; cx.lineWidth = lw * 1.2;
    [-1, 1].forEach(function (s) { almond(cx, x + s * W * 0.2, T + H * 0.36, W * 0.14, H * 0.09, s * H * 0.05); cx.fillStyle = "#16161c"; cx.fill(); cx.stroke(); cx.beginPath(); cx.moveTo(x + s * W * 0.33, T + H * 0.38); cx.quadraticCurveTo(x + s * W * 0.44, T + H * 0.5, x + s * W * 0.42, T + H * 0.68); cx.stroke(); cx.beginPath(); cx.moveTo(x + s * W * 0.1, T + H * 0.12); cx.quadraticCurveTo(x + s * W * 0.2, T + H * 0.02, x + s * W * 0.34, T + H * 0.1); cx.stroke(); });
    cx.fillStyle = "#d33a2c"; cx.beginPath(); cx.moveTo(x - W * 0.06, T + H * 0.84); cx.lineTo(x + W * 0.06, T + H * 0.84); cx.lineTo(x, T + H * 0.98); cx.closePath(); cx.fill();
  } else if (style === "robot") {
    var g6 = cx.createLinearGradient(x, T, x, T + H); g6.addColorStop(0, "#c8ced8"); g6.addColorStop(1, "#6d7686");
    band(cx, x, T, W, H, W * 0.04); cx.fillStyle = g6; cx.fill(); cx.strokeStyle = "#39404d"; cx.lineWidth = lw * 1.4; cx.stroke();
    cx.fillStyle = "#0a1a24"; cx.fillRect(x - W * 0.4, T + H * 0.26, W * 0.8, H * 0.22); cx.shadowColor = "#19e3ff"; cx.shadowBlur = H * 0.3; cx.fillStyle = "#19e3ff"; cx.fillRect(x - W * 0.34, T + H * 0.34, W * 0.68, H * 0.06); cx.shadowBlur = 0;
    cx.fillStyle = "#39404d"; [[-0.43, 0.12], [0.43, 0.12], [-0.4, 0.6], [0.4, 0.6]].forEach(function (p) { cx.beginPath(); cx.arc(x + p[0] * W, T + H * p[1], Math.max(2, W * 0.015), 0, 7); cx.fill(); });
    cx.strokeStyle = "#39404d"; cx.lineWidth = lw * 0.7; for (var j = 0; j < 4; j++) { cx.beginPath(); cx.moveTo(x - W * 0.07, T + H * (0.66 + j * 0.07)); cx.lineTo(x + W * 0.07, T + H * (0.66 + j * 0.07)); cx.stroke(); }
  } else if (style === "neon") {
    band(cx, x, T, W, H, W * 0.04); cx.fillStyle = "rgba(8,6,22,.95)"; cx.fill();
    cx.shadowBlur = Math.max(8, W * 0.07); cx.lineWidth = lw * 1.5; cx.shadowColor = "#19e3ff"; cx.strokeStyle = "#19e3ff"; band(cx, x, T, W, H, W * 0.04); cx.stroke();
    cx.shadowColor = "#ff3df0"; cx.strokeStyle = "#ff3df0"; [-1, 1].forEach(function (s) { almond(cx, x + s * W * 0.2, T + H * 0.36, W * 0.14, H * 0.1, s * H * 0.05); cx.stroke(); });
    cx.beginPath(); cx.moveTo(x, T + H * 0.46); cx.lineTo(x, T + H * 0.9); cx.stroke();
  }
  cx.restore();
}

export function createMask(raw, opts) {
  var vt = raw.getVideoTracks()[0]; if (!vt || !maskSupported()) return null;
  var vid = document.createElement("video"); vid.muted = true; vid.playsInline = true; vid.srcObject = new MediaStream([vt]); vid.play().catch(function () {});
  var cv = document.createElement("canvas"), cx = cv.getContext("2d"), out = cv.captureStream(30), track = out.getVideoTracks()[0];
  var sm = document.createElement("canvas"), sx = sm.getContext("2d");
  var st = { style: (opts && opts.style) || "venetian", box: null, seen: 0, t0: performance.now(), fd: null, lastFd: 0, busy: false, info: "guide", stopped: false, raf: 0, k: 1 };
  try { if (window.FaceDetector) { st.fd = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 }); st.info = "search"; } } catch (e) { st.fd = null; }

  function cover(w, h, msg) { // fail closed: heavy blur + dark veil over the whole frame
    cx.save(); cx.filter = "blur(" + Math.round(Math.max(w, h) / 22) + "px) brightness(.45)"; cx.drawImage(vid, 0, 0, w, h); cx.restore();
    cx.fillStyle = "rgba(10,8,24,.35)"; cx.fillRect(0, 0, w, h);
    if (msg) { cx.fillStyle = "rgba(255,255,255,.9)"; cx.font = Math.round(w * 0.06) + "px sans-serif"; cx.textAlign = "center"; cx.fillText(msg, w / 2, h / 2); }
  }
  function pixel(x, y, w, h, rx, ry, ex, ey) {
    var pw = Math.max(5, Math.round(w / 24)), ph = Math.max(5, Math.round(h / 24)); sm.width = pw; sm.height = ph;
    sx.imageSmoothingEnabled = true; sx.drawImage(cv, x, y, w, h, 0, 0, pw, ph);
    cx.save(); ell(cx, ex, ey, rx, ry); cx.clip(); cx.imageSmoothingEnabled = false; cx.drawImage(sm, 0, 0, pw, ph, x, y, w, h); cx.restore();
  }
  function detect(t) {
    if (!st.fd || st.busy || t - st.lastFd < 110) return; st.lastFd = t; st.busy = true;
    st.fd.detect(vid).then(function (r) {
      st.busy = false; var f = r && r[0] && r[0].boundingBox;
      if (f) { var n = { x: (f.x + f.width / 2) * st.k, y: (f.y + f.height / 2) * st.k, w: f.width * st.k, h: f.height * st.k }; st.box = st.box ? { x: st.box.x + (n.x - st.box.x) * 0.55, y: st.box.y + (n.y - st.box.y) * 0.55, w: st.box.w + (n.w - st.box.w) * 0.4, h: st.box.h + (n.h - st.box.h) * 0.4 } : n; st.seen = t; }
    }).catch(function () { st.busy = false; st.fd = null; st.info = "guide"; });
  }
  function frame(t) {
    if (st.stopped) return; st.raf = requestAnimationFrame(frame);
    var w = vid.videoWidth, h = vid.videoHeight; if (!w || !h) return;
    try {
      var k = Math.min(1, 1280 / Math.max(w, h)), cw = Math.round(w * k), ch = Math.round(h * k); st.k = k;
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; st.box = null; }
      var s = st.style;
      if (s === "off") { cx.drawImage(vid, 0, 0, cw, ch); return; }
      if (s === "shadow") { cover(cw, ch, ""); return; }
      cx.drawImage(vid, 0, 0, cw, ch);
      var b;
      if (st.fd) {
        detect(t);
        if (st.box && t - st.seen < 900) { b = st.box; st.info = "track"; }
        else if (t - Math.max(st.seen, st.t0) > 1300) { st.info = "lost"; cover(cw, ch, ""); return; }
        else { b = st.box; }
        if (!b) { cover(cw, ch, ""); return; }
      } else { var m = Math.min(cw, ch); b = { x: cw / 2, y: ch * 0.42, w: m * 0.36, h: m * 0.46 }; st.info = "guide"; }
      var W = b.w * 1.34, H = b.h * 0.74, T = b.y - b.h * 0.6, X = b.x;
      var px = Math.max(0, Math.round(X - W * 0.56)), py = Math.max(0, Math.round(T - H * 0.1)), pw = Math.min(cw - px, Math.round(W * 1.12)), ph = Math.min(ch - py, Math.round(H * 1.25));
      if (pw < 8 || ph < 8) { cover(cw, ch, ""); return; }
      pixel(px, py, pw, ph, W * 0.57, H * 0.66, X, T + H * 0.5);
      if (s !== "mosaic") drawMask(cx, s, X, T, W, H);
    } catch (e) { try { cx.fillStyle = "#000"; cx.fillRect(0, 0, cv.width, cv.height); } catch (e2) {} }
  }
  st.raf = requestAnimationFrame(frame);
  var stream = new MediaStream([track].concat(raw.getAudioTracks()));
  return {
    stream: stream, track: track, canvas: cv,
    setStyle: function (id) { st.style = id; st.box = null; },
    style: function () { return st.style; },
    info: function () { return st.style === "off" ? "off" : st.style === "shadow" ? "shadow" : st.info; },
    stop: function () { st.stopped = true; cancelAnimationFrame(st.raf); try { track.stop(); } catch (e) {} try { vid.srcObject = null; } catch (e) {} }
  };
}
