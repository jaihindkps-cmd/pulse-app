// Voice disguise: shifts the pitch of the microphone so a voice is harder to recognise. Runs on the phone before the audio is
// sent or recorded (classic two-delay-line "jungle" pitch shifter). "natural" bypasses it completely so call quality is untouched.
export var VOICES = [
  { id: "natural", e: "🗣️", en: "Natural", hi: "असली", m: 0 },
  { id: "deep", e: "🐻", en: "Deep", hi: "भारी", m: -0.42 },
  { id: "high", e: "🐿️", en: "High", hi: "पतली", m: 0.34 }
];
export function disguiseSupported() { return !!(window.AudioContext || window.webkitAudioContext); }

function fadeBuf(ctx, active, fade) {
  var sr = ctx.sampleRate, l1 = Math.round(active * sr), l2 = Math.round((active - 2 * fade) * sr), len = l1 + l2, b = ctx.createBuffer(1, len, sr), p = b.getChannelData(0), fl = fade * sr, i2 = l1 - fl;
  for (var i = 0; i < l1; i++) p[i] = i < fl ? Math.sqrt(i / fl) : i >= i2 ? Math.sqrt(1 - (i - i2) / fl) : 1;
  for (var j = l1; j < len; j++) p[j] = 0; return b;
}
function delayBuf(ctx, active, fade, up) {
  var sr = ctx.sampleRate, l1 = Math.round(active * sr), l2 = Math.round((active - 2 * fade) * sr), len = l1 + l2, b = ctx.createBuffer(1, len, sr), p = b.getChannelData(0);
  for (var i = 0; i < l1; i++) p[i] = up ? (l1 - i) / len : i / l1;
  for (var j = l1; j < len; j++) p[j] = 0; return b;
}
function src(ctx, buf) { var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s; }

// Returns { stream, set(id), stop() }. The new stream carries the processed audio only.
export function disguise(stream, id) {
  var AC = window.AudioContext || window.webkitAudioContext; if (!AC || !stream.getAudioTracks().length) return null;
  var ctx = new AC({ latencyHint: "interactive" }); try { ctx.resume(); } catch (e) {}
  var input = ctx.createMediaStreamSource(stream), dest = ctx.createMediaStreamDestination();
  var direct = ctx.createGain(), fx = ctx.createGain(); input.connect(direct); direct.connect(dest); fx.connect(dest);
  var DT = 0.1, FT = 0.05, BT = 0.1, up = delayBuf(ctx, DT, FT, true), down = delayBuf(ctx, DT, FT, false), fade = fadeBuf(ctx, BT, FT);
  var m1 = src(ctx, down), m2 = src(ctx, down), m3 = src(ctx, up), m4 = src(ctx, up), g1 = ctx.createGain(), g2 = ctx.createGain(), g3 = ctx.createGain(), g4 = ctx.createGain();
  var mg1 = ctx.createGain(), mg2 = ctx.createGain(), d1 = ctx.createDelay(), d2 = ctx.createDelay(), f1 = src(ctx, fade), f2 = src(ctx, fade), x1 = ctx.createGain(), x2 = ctx.createGain();
  mg1.gain.value = 0; mg2.gain.value = 0; x1.gain.value = 0; x2.gain.value = 0;
  m1.connect(g1); m2.connect(g2); m3.connect(g3); m4.connect(g4); g1.connect(mg1); g2.connect(mg2); g3.connect(mg1); g4.connect(mg2); mg1.connect(d1.delayTime); mg2.connect(d2.delayTime);
  f1.connect(x1.gain); f2.connect(x2.gain); input.connect(d1); input.connect(d2); d1.connect(x1); d2.connect(x2); x1.connect(fx); x2.connect(fx);
  var t = ctx.currentTime + 0.05, t2 = t + BT - FT; m1.start(t); m2.start(t2); m3.start(t); m4.start(t2); f1.start(t); f2.start(t2);
  function set(vid) {
    var v = VOICES.filter(function (x) { return x.id === vid; })[0] || VOICES[0], mult = v.m, on = mult !== 0, now = ctx.currentTime;
    direct.gain.setTargetAtTime(on ? 0 : 1, now, 0.02); fx.gain.setTargetAtTime(on ? 1 : 0, now, 0.02);
    var upm = mult > 0 ? 1 : 0; g1.gain.value = g2.gain.value = upm ? 0 : 1; g3.gain.value = g4.gain.value = upm ? 1 : 0;
    var d = 0.5 * DT * Math.abs(mult); mg1.gain.setTargetAtTime(d, now, 0.01); mg2.gain.setTargetAtTime(d, now, 0.01);
  }
  set(id || "natural");
  return {
    stream: dest.stream, track: dest.stream.getAudioTracks()[0], ctx: ctx, set: set,
    stop: function () { try { [m1, m2, m3, m4, f1, f2].forEach(function (s) { s.stop(); }); } catch (e) {} try { ctx.close(); } catch (e) {} }
  };
}
