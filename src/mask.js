// Anonymous face masks for private support calls. Each camera frame is copied to a private canvas, faces are found IN THAT
// SAME FRAME, and only then is the finished picture (rest of the frame untouched, mask over the eyes/nose of each face) drawn
// to the output canvas that is sent to the other person. So the mask can never lag behind a moving face, a raw frame is never
// sent, and it fails closed: if a face cannot be found for a moment the picture is hidden instead of risking a leak.
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

var DET = null;
// Face finder: the phone's own FaceDetector when it works, otherwise a small model bundled with the app (works offline).
function loadDetector() {
  if (DET) return DET;
  DET = (async function () {
    try {
      if (window.FaceDetector) {
        var fd = new window.FaceDetector({ fastMode: false, maxDetectedFaces: 4 }), tc = document.createElement("canvas"); tc.width = tc.height = 64; await fd.detect(tc);
        return { kind: "native", detect: async function (src) { var r = await fd.detect(src); return r.map(function (f) { var b = f.boundingBox; return { x: b.x, y: b.y, w: b.width, h: b.height }; }); } };
      }
    } catch (e) {}
    var base = new URL("vendor/", document.baseURI).href, mod = await import(base + "face-api.esm.js"), fa = mod.nets ? mod : (mod.default || mod);
    try { await fa.tf.setBackend("webgl"); await fa.tf.ready(); } catch (e) { try { await fa.tf.setBackend("cpu"); await fa.tf.ready(); } catch (e2) {} }
    await fa.nets.tinyFaceDetector.loadFromUri(base + "models");
    var size = 320, avg = 0;
    var det = async function (src) {
      var t = performance.now(), r = await fa.detectAllFaces(src, new fa.TinyFaceDetectorOptions({ inputSize: size, scoreThreshold: 0.3 })), d = performance.now() - t;
      avg = avg ? avg * 0.8 + d * 0.2 : d; if (avg > 70 && size > 128) { size -= 32; avg = 0; }
      return r.map(function (f) { return { x: f.box.x, y: f.box.y, w: f.box.width, h: f.box.height }; });
    };
    var wc = document.createElement("canvas"); wc.width = wc.height = 64; await det(wc);
    return { kind: "model", detect: det };
  })();
  DET.catch(function () { DET = null; });
  return DET;
}

export function createMask(raw, opts) {
  var vt = raw.getVideoTracks()[0]; if (!vt || !maskSupported()) return null;
  var vid = document.createElement("video"); vid.muted = true; vid.playsInline = true; vid.srcObject = new MediaStream([vt]); vid.play().catch(function () {});
  var cv = document.createElement("canvas"), cx = cv.getContext("2d"), out = cv.captureStream(30), track = out.getVideoTracks()[0];
  var wk = document.createElement("canvas"), wx = wk.getContext("2d"), dc = document.createElement("canvas"), dx = dc.getContext("2d"), sm = document.createElement("canvas"), sx = sm.getContext("2d");
  var st = { style: (opts && opts.style) || "venetian", boxes: [], seen: 0, det: null, kind: "", info: "load", stopped: false, raf: 0, timer: 0, busy: false, ms: 0 };
  var ready = loadDetector().then(function (d) { st.det = d; st.kind = d.kind; st.info = "search"; });
  cv.width = 320; cv.height = 240; cx.fillStyle = "#0b0a14"; cx.fillRect(0, 0, 320, 240); // until the first masked frame, send a dark card (never the camera)

  function hide(w, h) { // heavy blur + veil over the whole picture, built only from scaling (no canvas filter, so it works everywhere)
    var pw = 14, ph = Math.max(6, Math.round(14 * h / w)); sm.width = pw; sm.height = ph; sx.imageSmoothingEnabled = true; sx.drawImage(wk, 0, 0, pw, ph);
    cx.save(); cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = "high"; cx.drawImage(sm, 0, 0, pw, ph, 0, 0, w, h); cx.fillStyle = "rgba(10,8,24,.55)"; cx.fillRect(0, 0, w, h); cx.restore();
  }
  function mosaic(X, T, W, H) {
    var x = Math.max(0, Math.round(X - W * 0.56)), y = Math.max(0, Math.round(T - H * 0.08)), w = Math.min(cv.width - x, Math.round(W * 1.12)), h = Math.min(cv.height - y, Math.round(H * 1.16));
    if (w < 8 || h < 8) return; var pw = Math.max(4, Math.round(w / 22)), ph = Math.max(4, Math.round(h / 22)); sm.width = pw; sm.height = ph; sx.imageSmoothingEnabled = true; sx.drawImage(wk, x, y, w, h, 0, 0, pw, ph);
    cx.save(); ell(cx, X, T + H * 0.5, W * 0.56, H * 0.62); cx.clip(); cx.imageSmoothingEnabled = false; cx.drawImage(sm, 0, 0, pw, ph, x, y, w, h); cx.restore();
  }
  function near(b) { var best = null, bd = 1e9; st.boxes.forEach(function (o) { var d = Math.hypot(o.x + o.w / 2 - b.x - b.w / 2, o.y + o.h / 2 - b.y - b.h / 2); if (d < bd) { bd = d; best = o; } }); return best ? { o: best, d: bd } : null; }
  function step() {
    if (st.stopped || st.busy) return Promise.resolve();
    var w = vid.videoWidth, h = vid.videoHeight; if (!w || !h || vid.readyState < 2) return Promise.resolve();
    if (!st.det) { return Promise.resolve(); }
    st.busy = true; st.t1 = performance.now();
    var k = Math.min(1, 1280 / Math.max(w, h)), cw = Math.round(w * k), ch = Math.round(h * k);
    if (wk.width !== cw || wk.height !== ch) { wk.width = cw; wk.height = ch; }
    wx.drawImage(vid, 0, 0, cw, ch); // private snapshot of THIS frame -- the output canvas is not touched until the mask is ready
    var s = st.style;
    if (s === "off" || s === "shadow") {
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
      if (s === "off") cx.drawImage(wk, 0, 0, cw, ch); else hide(cw, ch);
      st.busy = false; return Promise.resolve();
    }
    var ds = Math.min(1, 480 / Math.max(cw, ch)), dw = Math.round(cw * ds), dh = Math.round(ch * ds); if (dc.width !== dw || dc.height !== dh) { dc.width = dw; dc.height = dh; }
    dx.drawImage(wk, 0, 0, dw, dh);
    return st.det.detect(dc).then(function (r) { return r.map(function (b) { return { x: b.x / ds, y: b.y / ds, w: b.w / ds, h: b.h / ds }; }); }, function () { return null; }).then(function (faces) {
      if (st.stopped) { st.busy = false; return; }
      var now = performance.now(), list = null, grow = 1; st.n = (st.n || 0) + 1; st.ms = st.ms ? st.ms * 0.9 + (now - st.t1) * 0.1 : (now - st.t1); 
      if (faces && faces.length) { // widen each box by how far the face moved since the last frame, so fast head turns stay covered
        list = faces.map(function (b) { var n = near(b), f = 1; if (n) f = 1 + Math.min(0.5, n.d / Math.max(1, b.w) * 1.2); return { x: b.x, y: b.y, w: b.w, h: b.h, f: f }; });
        st.boxes = list.map(function (b) { return { x: b.x, y: b.y, w: b.w, h: b.h }; }); st.seen = now; st.info = "track";
      } else if (st.boxes.length && now - st.seen < 700) { grow = 1 + (now - st.seen) / 700 * 0.35; list = st.boxes.map(function (b) { return { x: b.x, y: b.y, w: b.w, h: b.h, f: grow }; }); st.info = "hold"; }
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
      try {
        if (!list) { st.info = "lost"; hide(cw, ch); }
        else {
          cx.drawImage(wk, 0, 0, cw, ch); // everything outside the masks stays exactly as the camera sees it
          list.forEach(function (b) {
            var f = b.f || 1, X = b.x + b.w / 2, cy = b.y + b.h / 2, W = b.w * 1.38 * f, H = b.h * 0.8 * f, T = cy - b.h * 0.64 * f;
            if (s === "mosaic") mosaic(X, T, W, H); else drawMask(cx, s, X, T, W, H);
          });
        }
      } catch (e) { try { cx.fillStyle = "#000"; cx.fillRect(0, 0, cv.width, cv.height); } catch (e2) {} }
      st.busy = false;
    }, function () { st.busy = false; });
  }
  function loop() {
    if (st.stopped) return;
    step().then(next, next);
    function next() { if (st.stopped) return; if (document.hidden) st.timer = setTimeout(loop, 60); else st.raf = requestAnimationFrame(loop); }
  }
  ready.then(function () { loop(); }, function () {});
  var stream = new MediaStream([track].concat(raw.getAudioTracks()));
  return {
    stream: stream, track: track, canvas: cv, ready: ready,
    setStyle: function (id) { st.style = id; if (id !== "off" && id !== "shadow" && st.info === "off") st.info = "search"; },
    style: function () { return st.style; },
    info: function () { return st.style === "off" ? "off" : st.style === "shadow" ? "shadow" : st.info; },
    faces: function () { return st.boxes.length; }, stats: function () { return { n: st.n || 0, ms: Math.round(st.ms || 0) }; }, kind: function () { return st.kind; },
    stop: function () { st.stopped = true; cancelAnimationFrame(st.raf); clearTimeout(st.timer); try { track.stop(); } catch (e) {} try { vid.srcObject = null; } catch (e) {} }
  };
}
