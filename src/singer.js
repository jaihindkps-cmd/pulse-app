// "Singer": sings the lyrics with the phone's text-to-speech voices, line by line, following the song's melody.
// Each word is spoken as its own utterance whose pitch follows the lead notes of that line and whose rate is
// fitted so the line ends with the bar. It is a synthetic voice, not a human singer.
var cache = [];
function refresh() { try { cache = (window.speechSynthesis && speechSynthesis.getVoices()) || []; } catch (e) { cache = []; } return cache; }
try { if (window.speechSynthesis) { refresh(); speechSynthesis.onvoiceschanged = refresh; } } catch (e) {}

export function singerSupported() { return !!(window.speechSynthesis && window.SpeechSynthesisUtterance); }
export function voiceList(langPrefix) {
  var l = cache.length ? cache : refresh();
  var f = l.filter(function (v) { return (v.lang || "").toLowerCase().indexOf(langPrefix) === 0; });
  return f.length ? f : l.filter(function (v) { return /^(hi|en-in)/i.test(v.lang || ""); });
}
var FEMALE = /female|woman|zira|heera|swara|kalpana|aditi|priya|lekha|neerja|samantha|karen|veena|google.*(hi-in-x-(hia|hic)|हिन्दी)/i;
var MALE = /\bmale\b|\bman\b|david|ravi|hemant|prabhat|madhur|rishi|google.*hi-in-x-(hid|hie)/i;
function guess(list, kind) {
  var re = kind === "m" ? MALE : FEMALE, hit = list.filter(function (v) { return re.test(v.name || ""); });
  if (kind === "m") hit = hit.filter(function (v) { return !FEMALE.test(v.name || "") || /\bmale\b/i.test(v.name); });
  return hit[0] || null;
}
export function langOf(songLang) { return songLang === "en" ? "en-IN" : "hi-IN"; }

export function stopSinging() { try { speechSynthesis.cancel(); } catch (e) {} }

// song: result of buildSong; i: line index; o: { kind: "f"|"m", voiceName, lang }
export function singLine(song, i, o) {
  if (!singerSupported() || !song || !song.lineTimes[i]) return;
  var lt = song.lineTimes[i], t0 = lt.t, t1 = song.lineTimes[i + 1] ? song.lineTimes[i + 1].t : t0 + 2 * song.barDur;
  var slot = Math.max(1.2, (t1 - t0) * 0.92);
  var text = String(lt.text || "").replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, "").trim(); if (!text) return;
  var words = text.split(/\s+/).filter(Boolean);
  var notes = song.events.filter(function (e) { return e.type === "lead" && e.t >= t0 - 0.01 && e.t < t1; }).map(function (e) { return e.midi; });
  var mean = notes.length ? notes.reduce(function (a, b) { return a + b; }, 0) / notes.length : 0;
  var list = voiceList((o.lang || "hi-IN").slice(0, 2).toLowerCase()), v = null;
  if (o.voiceName) v = list.filter(function (x) { return x.name === o.voiceName; })[0] || null;
  if (!v) v = guess(list, o.kind);
  var base = o.kind === "m" ? 0.82 : 1.22; if (v && guess([v], o.kind)) base = o.kind === "m" ? 0.92 : 1.05;
  var per = slot / words.length;
  try { speechSynthesis.cancel(); } catch (e) {}
  words.forEach(function (w, k) {
    var u = new SpeechSynthesisUtterance(w);
    if (v) u.voice = v; u.lang = o.lang || "hi-IN";
    var midi = notes.length ? notes[Math.min(notes.length - 1, Math.floor(k * notes.length / words.length))] : mean;
    var semis = (midi - mean) * 0.6, accent = k === 0 || k === words.length - 1 ? 0.05 : 0;
    u.pitch = Math.max(0.5, Math.min(1.95, base * Math.pow(2, semis / 12) + accent));
    var est = 0.28 + 0.045 * w.length; // rough natural duration of one word at rate 1
    u.rate = Math.max(0.55, Math.min(1.7, est / per));
    u.volume = 1;
    try { speechSynthesis.speak(u); } catch (e) {}
  });
}
