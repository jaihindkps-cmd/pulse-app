// Gaana engine: AI ke likhe bol + browser me bani dhun (Web Audio). Koi server, koi paisa nahi.
// Ye asli gayak ki awaaz nahi banata: dhun (instrumental) khud banti hai, bol "awaaz" toggle se padhe jaate hain.
var SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };

export var GENRES = {
  bollywood: { name: "Bollywood", bpm: [92, 104], minor: false, prog: [0, 4, 5, 3], lead: "triangle", drums: "pop" },
  lofi: { name: "Lo-fi chill", bpm: [72, 82], minor: true, prog: [0, 5, 2, 6], lead: "sine", drums: "lofi" },
  pop: { name: "Pop", bpm: [102, 118], minor: false, prog: [0, 5, 3, 4], lead: "triangle", drums: "pop" },
  rock: { name: "Rock", bpm: [112, 128], minor: true, prog: [0, 5, 3, 4], lead: "sawtooth", drums: "rock" },
  sufi: { name: "Sufi", bpm: [84, 96], minor: true, prog: [0, 6, 0, 6], lead: "sine", drums: "dholak", vibrato: true },
  bhajan: { name: "Bhajan", bpm: [88, 100], minor: false, prog: [0, 3, 4, 0], lead: "triangle", drums: "dholak", vibrato: true },
  rap: { name: "Rap / Hip-hop", bpm: [86, 96], minor: true, prog: [0, 0, 5, 6], lead: "square", drums: "trap" }
};

var DRUMS = {
  //            0123456789abcdef
  pop:    { k: "x...x...x..x....", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
  lofi:   { k: "x......x..x.....", s: "....x.......x...", h: "..x...x...x...x." },
  rock:   { k: "x.......x.x.....", s: "....x.......x...", h: "x.x.x.x.x.x.x.x." },
  dholak: { k: "x.....x...x.....", s: "....t.......t...", h: "..x...x...x...x." },
  trap:   { k: "x.........x.....", s: "........x.......", h: "xxxxxxxxxxxxxxxx" }
};

function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; var t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
// scale index (0..6 = pehla octave, 7.. = upar) ko midi note me badlo
function degMidi(scale, root, idx) { var o = Math.floor(idx / 7), i = ((idx % 7) + 7) % 7; return root + SCALES[scale][i] + 12 * o; }

// spec: { genre, bpm, minor, title, lines:[{text, section}] }
export function buildSong(spec) {
  var G = GENRES[spec.genre] || GENRES.bollywood;
  var seed = hash(spec.title || "gaana"), R = rng(seed);
  var bpm = Math.round(spec.bpm >= 60 && spec.bpm <= 140 ? spec.bpm : G.bpm[0] + R() * (G.bpm[1] - G.bpm[0]));
  var scale = (typeof spec.minor === "boolean" ? spec.minor : G.minor) ? "minor" : "major";
  var root = 55 + (seed % 8); // G3..D4
  var barDur = 240 / bpm, step = barDur / 16;
  var lines = (spec.lines || []).slice(0, 16);
  var bars = 2 + lines.length * 2 + 2;
  var prog = G.prog, ev = [];
  function chordAt(b) { return prog[((b % 4) + 4) % 4]; }
  var d = DRUMS[G.drums];

  for (var b = 0; b < bars; b++) {
    var t0 = b * barDur, cd = chordAt(b), outro = b >= bars - 2, intro = b < 2;
    // pad
    ev.push({ t: t0, type: "pad", notes: [degMidi(scale, root - 12, cd), degMidi(scale, root - 12, cd + 2), degMidi(scale, root - 12, cd + 4)], dur: barDur * (outro && b === bars - 1 ? 1.6 : 1.02), vel: 0.1 });
    // bass
    if (!outro) {
      var bs = G.drums === "trap" ? [0, 6, 10] : G.drums === "lofi" ? [0, 7, 10] : [0, 8, 14];
      bs.forEach(function (s, i) { if (i < 2 || R() > 0.5) ev.push({ t: t0 + s * step, type: "bass", midi: degMidi(scale, root - 24, cd), dur: step * (i === 0 ? 6 : 4), vel: 0.34 }); });
    }
    // drums
    if (!outro || b === bars - 2) for (var s = 0; s < 16; s++) {
      var tt = t0 + s * step + (G.drums === "lofi" && s % 2 === 1 ? step * 0.25 : 0);
      if (d.k[s] === "x" && !intro) ev.push({ t: tt, type: "kick", vel: 0.85 });
      if (d.s[s] === "x" && !intro) ev.push({ t: tt, type: "snare", vel: 0.5 });
      if (d.s[s] === "t" && !intro) ev.push({ t: tt, type: "tom", vel: 0.55 });
      if (d.h[s] === "x") ev.push({ t: tt, type: "hat", vel: (s % 4 === 2 ? 0.2 : 0.12) * (G.drums === "lofi" ? 0.8 : 1) });
    }
  }

  // lead: har bol ki line = 2 bar. Chorus/mukhda ki dhun alag (B), baaki (A).
  var lineTimes = [];
  lines.forEach(function (ln, i) {
    var b0 = 2 + i * 2, key = /chorus|mukhda|hook|refrain/i.test(ln.section || "") ? "B" : "A";
    var LR = rng(hash(key + ":" + (seed % 977) + ":" + (b0 % 4)));
    var prev = 7 + (key === "B" ? 4 : 2), steps = [];
    for (var s = 0; s < 32; s += 2) {
      var strong = s % 16 === 0, p = strong ? 1 : (s % 4 === 0 ? 0.72 : 0.5);
      if (LR() < p) steps.push(s);
    }
    steps.forEach(function (s, k) {
      var bar = b0 + Math.floor(s / 16), cd = chordAt(bar), idx;
      if (s % 16 === 0 || k === steps.length - 1) { // chord ke sur par tikna
        var tones = [cd, cd + 2, cd + 4].map(function (x) { var cand = x + 7; while (cand < prev - 3) cand += 7; while (cand > prev + 4) cand -= 7; return cand; });
        idx = tones[Math.floor(LR() * 3)];
      } else {
        var mv = [-2, -1, -1, 0, 1, 1, 2][Math.floor(LR() * 7)]; idx = prev + mv;
      }
      idx = Math.max(7, Math.min(14, idx)); prev = idx;
      var next = steps[k + 1] === undefined ? 32 : steps[k + 1], len = Math.min(next - s, k === steps.length - 1 ? 14 : 4);
      ev.push({ t: (b0 * 16 + s) * step, type: "lead", midi: degMidi(scale, root, idx), dur: Math.max(1, len - 0.3) * step, vel: strong_vel(s) });
    });
    lineTimes.push({ t: b0 * barDur, text: ln.text, section: ln.section || "" });
  });
  function strong_vel(s) { return s % 16 === 0 ? 0.3 : 0.24; }
  ev.sort(function (a, b) { return a.t - b.t; });
  return { bpm: bpm, scale: scale, genre: spec.genre, root: root, barDur: barDur, bars: bars, duration: bars * barDur, events: ev, lineTimes: lineTimes, vibrato: !!G.vibrato, leadWave: G.lead, title: spec.title || "" };
}

function noiseBuf(ctx) { var n = Math.floor(ctx.sampleRate * 0.5), b = ctx.createBuffer(1, n, ctx.sampleRate), x = b.getChannelData(0); for (var i = 0; i < n; i++) x[i] = Math.random() * 2 - 1; return b; }

// Poora gaana ek saath schedule (ctx live ho ya offline). t0 = shuruaat ka waqt.
export function schedule(ctx, out, song, t0) {
  var master = ctx.createGain(); master.gain.value = 0.85;
  var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; master.connect(comp); comp.connect(out);
  var delay = ctx.createDelay(1); delay.delayTime.value = song.barDur / 8; var fb = ctx.createGain(); fb.gain.value = 0.28; var wet = ctx.createGain(); wet.gain.value = 0.22;
  delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
  var noise = noiseBuf(ctx);
  function env(g, t, a, peak, hold, rel) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.setValueAtTime(peak, t + Math.max(a, hold)); g.gain.exponentialRampToValueAtTime(0.0001, t + hold + rel); }
  song.events.forEach(function (e) {
    var t = t0 + e.t;
    if (e.type === "pad") {
      var lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 1300; lp.connect(master);
      e.notes.forEach(function (m) {
        [-4, 4].forEach(function (c) {
          var o = ctx.createOscillator(), g = ctx.createGain(); o.type = "triangle"; o.frequency.value = mtof(m); o.detune.value = c;
          env(g, t, 0.22, e.vel / 3, e.dur, 0.5); o.connect(g); g.connect(lp); o.start(t); o.stop(t + e.dur + 0.6);
        });
      });
    } else if (e.type === "bass") {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = "sine"; o.frequency.value = mtof(e.midi);
      env(g, t, 0.01, e.vel, e.dur * 0.8, 0.12); o.connect(g); g.connect(master); o.start(t); o.stop(t + e.dur + 0.2);
    } else if (e.type === "lead") {
      var o2 = ctx.createOscillator(), g2 = ctx.createGain(), f2 = ctx.createBiquadFilter(); o2.type = song.leadWave; o2.frequency.value = mtof(e.midi);
      f2.type = "lowpass"; f2.frequency.value = song.leadWave === "sawtooth" || song.leadWave === "square" ? 2600 : 4200;
      if (song.vibrato) { var l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 5.5; lg.gain.value = 9; l.connect(lg); lg.connect(o2.detune); l.start(t); l.stop(t + e.dur + 0.2); }
      env(g2, t, 0.015, e.vel, e.dur * 0.85, 0.1); o2.connect(f2); f2.connect(g2); g2.connect(master); g2.connect(delay); o2.start(t); o2.stop(t + e.dur + 0.2);
    } else if (e.type === "kick") {
      var k = ctx.createOscillator(), kg = ctx.createGain(); k.frequency.setValueAtTime(150, t); k.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      kg.gain.setValueAtTime(e.vel, t); kg.gain.exponentialRampToValueAtTime(0.001, t + 0.22); k.connect(kg); kg.connect(master); k.start(t); k.stop(t + 0.25);
    } else if (e.type === "tom") {
      var tm = ctx.createOscillator(), tg = ctx.createGain(); tm.frequency.setValueAtTime(210, t); tm.frequency.exponentialRampToValueAtTime(110, t + 0.14);
      tg.gain.setValueAtTime(e.vel, t); tg.gain.exponentialRampToValueAtTime(0.001, t + 0.2); tm.connect(tg); tg.connect(master); tm.start(t); tm.stop(t + 0.22);
    } else if (e.type === "snare" || e.type === "hat") {
      var n = ctx.createBufferSource(), nf = ctx.createBiquadFilter(), ng = ctx.createGain(); n.buffer = noise;
      if (e.type === "snare") { nf.type = "bandpass"; nf.frequency.value = 1800; ng.gain.setValueAtTime(e.vel * 0.7, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.16); }
      else { nf.type = "highpass"; nf.frequency.value = 7000; ng.gain.setValueAtTime(e.vel * 0.6, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05); }
      n.connect(nf); nf.connect(ng); ng.connect(master); n.start(t); n.stop(t + 0.2);
    }
  });
  return master;
}

export class Player {
  constructor() { this.ctx = null; this.raf = 0; this.song = null; }
  get playing() { return !!this.ctx; }
  // hooks: onLine(i), onTick(sec, total), onEnd()
  async play(song, hooks) {
    this.stop(); hooks = hooks || {};
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) throw new Error("Is browser me audio nahi chalta");
    var ctx = this.ctx = new AC(); try { await ctx.resume(); } catch (e) {}
    var t0 = ctx.currentTime + 0.2, self = this, last = -1; this.song = song;
    schedule(ctx, ctx.destination, song, t0);
    (function tick() {
      if (self.ctx !== ctx) return;
      var s = ctx.currentTime - t0, li = -1;
      for (var i = 0; i < song.lineTimes.length; i++) if (s >= song.lineTimes[i].t - 0.05) li = i;
      if (li !== last) { last = li; hooks.onLine && hooks.onLine(li); }
      hooks.onTick && hooks.onTick(Math.max(0, s), song.duration);
      if (s >= song.duration) { self.stop(); hooks.onEnd && hooks.onEnd(); return; }
      self.raf = requestAnimationFrame(tick);
    })();
  }
  stop() { cancelAnimationFrame(this.raf); if (this.ctx) { try { this.ctx.close(); } catch (e) {} this.ctx = null; } }
}

// WAV file (mono) banao, download ke liye
export async function renderWav(song) {
  var OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext, sr = 32000, len = Math.ceil((song.duration + 1.5) * sr);
  var ctx = new OAC(1, len, sr); schedule(ctx, ctx.destination, song, 0.05);
  var buf = await ctx.startRendering(), x = buf.getChannelData(0), peak = 0, i;
  for (i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  var gain = peak > 0.001 ? Math.min(0.95 / peak, 3) : 1, out = new DataView(new ArrayBuffer(44 + x.length * 2));
  function w(o, s) { for (var j = 0; j < s.length; j++) out.setUint8(o + j, s.charCodeAt(j)); }
  w(0, "RIFF"); out.setUint32(4, 36 + x.length * 2, true); w(8, "WAVEfmt "); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * 2, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true); w(36, "data"); out.setUint32(40, x.length * 2, true);
  for (i = 0; i < x.length; i++) out.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i] * gain)) * 32767, true);
  return { blob: new Blob([out.buffer], { type: "audio/wav" }), peak: peak, seconds: buf.duration };
}
