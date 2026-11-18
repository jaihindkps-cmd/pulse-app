// Call audio: ringtone / ringback tones (WebAudio) and phone / speaker / Bluetooth routing (native AudioRoute plugin).
var P = null;
function plug() {
  if (P === null) {
    try { P = (window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform() && Capacitor.registerPlugin) ? Capacitor.registerPlugin("AudioRoute") : false; } catch (e) { P = false; }
  }
  return P;
}
export function routeAvailable() { return !!plug(); }
export function routeStart(speaker) { var p = plug(); return p ? p.start({ speaker: !!speaker }).catch(function () { return {}; }) : Promise.resolve({}); }
export function routeList() { var p = plug(); return p ? p.list().then(function (r) { return r || { devices: [] }; }).catch(function () { return { devices: [] }; }) : Promise.resolve({ devices: [] }); }
export function routeSet(d) { var p = plug(); return p ? p.set({ id: d.id, kind: d.kind }).catch(function () { return {}; }) : Promise.resolve({}); }
export function routeStop() { var p = plug(); return p ? p.stop().catch(function () {}) : Promise.resolve(); }

// Foreground service: keeps mic/camera and the connection alive when the app is minimized during a call.
export function serviceStart(video, title) { var p = plug(); return p ? p.startService({ video: !!video, title: title || "Pulse call" }).catch(function () {}) : Promise.resolve(); }
export function secureScreen(on) { var p = plug(); return p ? p.secure({ on: !!on }).catch(function () {}) : Promise.resolve(); }
export function serviceStop() { var p = plug(); return p ? p.stopService().catch(function () {}) : Promise.resolve(); }

// ---- tones ----
var ctx = null, toneTimer = null, vibTimer = null, master = null;
function ac() {
  if (!ctx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; ctx = new C(); }
  if (ctx.state === "suspended") ctx.resume().catch(function () {});
  return ctx;
}
function beep(freq, start, dur, vol, type) {
  var c = ac(); if (!c) return;
  var o = c.createOscillator(), g = c.createGain(); o.type = type || "sine"; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g); g.connect(c.destination); o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
}
export function stopTone() {
  clearInterval(toneTimer); toneTimer = null; clearInterval(vibTimer); vibTimer = null;
  try { navigator.vibrate && navigator.vibrate(0); } catch (e) {}
}
// kind "in": ringtone for an incoming call (melody + vibration). kind "out": ringback the caller hears while the other phone rings.
export function startTone(kind) {
  stopTone();
  if (kind === "in") {
    var play = function () { [659, 784, 880, 784].forEach(function (f, i) { beep(f, i * 0.2, 0.18, 0.35, "triangle"); }); [659, 784, 880, 784].forEach(function (f, i) { beep(f, 1.1 + i * 0.2, 0.18, 0.35, "triangle"); }); };
    play(); toneTimer = setInterval(play, 3000);
    var vib = function () { try { navigator.vibrate && navigator.vibrate([400, 200, 400, 1500]); } catch (e) {} };
    vib(); vibTimer = setInterval(vib, 2500);
  } else {
    var rb = function () { beep(425, 0, 1.0, 0.18, "sine"); beep(450, 0, 1.0, 0.12, "sine"); };
    rb(); toneTimer = setInterval(rb, 3000);
  }
}
export function chime(up) { beep(up ? 660 : 440, 0, 0.12, 0.2); beep(up ? 880 : 330, 0.14, 0.16, 0.2); }

try { document.addEventListener("pointerdown", function () { ac(); }, { once: true, passive: true }); } catch (e) {}
