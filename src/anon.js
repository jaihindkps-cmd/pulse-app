// Support Circles, level 2: voice messages in the circle, and private anonymous 1-to-1 talks (text, voice notes, voice call and
// a masked video call). Nobody sees a name or photo -- only the random alias the circle already uses. Free plan: Firestore
// carries requests/chat/signalling, and the call itself is WebRTC straight between the two phones.
import { doc, updateDoc, setDoc, deleteDoc, collection, addDoc, query, where, orderBy, limit, getDocs, onSnapshot, serverTimestamp } from "firebase/firestore";
import * as Call from "./call.js";
import { createMask, maskSupported, MASKS } from "./mask.js";
import { serviceStart, serviceStop, routeStart, routeStop } from "./audioroute.js";
import { getLang } from "./i18n.js";
import { secureScreen } from "./audioroute.js";
import { disguise, disguiseSupported, VOICES } from "./disguise.js";

var C = null, R = null, S = null, INC = null, OUT = null, G = { unsubs: [] }, REC = null, RES = null, P = { open: false, others: {}, tick: null, cool: {} };
var RELAY = true; try { RELAY = localStorage.getItem("pulse_relay") !== "0"; } catch (e) {}
var VFX = "natural"; try { VFX = localStorage.getItem("pulse_vfx") || "natural"; } catch (e) {}
function vfx() { return VOICES.filter(function (v) { return v.id === VFX; })[0] || VOICES[0]; }
function vfxNext() { var i = VOICES.indexOf(vfx()); VFX = VOICES[(i + 1) % VOICES.length].id; try { localStorage.setItem("pulse_vfx", VFX); } catch (e) {} return vfx(); }
function $(id) { return document.getElementById(id); }
function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
function T(en, h) { return getLang() !== "en" ? h : en; }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
function uid() { return C && C.uid(); }
function ms(x) { return x && x.toMillis ? x.toMillis() : Date.now(); }
function fmt(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
function dd(d) { return d.data({ serverTimestamps: "estimate" }); }

var CSS = '\
#anonUI,#anonSess{position:fixed;inset:0;z-index:96;background:var(--bg);color:var(--fg);display:flex;flex-direction:column;font-family:var(--font-body)}\
#anonSess{z-index:97}#anonUI[hidden],#anonSess[hidden]{display:none}\
.an-head{display:flex;align-items:center;gap:10px;padding:calc(var(--sa-top,0px) + 10px) 12px 10px;border-bottom:1px solid var(--line);background:var(--surface)}\
.an-head h2{margin:0;font-size:17px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-display)}\
.an-head small{display:block;font:600 11px var(--font-body);color:#12B886}\
.an-head button{border:none;background:none;color:var(--fg);font-size:21px;padding:6px 9px;cursor:pointer;position:relative}\
.an-head .cb{display:flex;flex-direction:column;align-items:center;gap:1px;padding:4px 10px}.an-head .cb span{font-size:20px;line-height:1}.an-head .cb small{font:700 10px var(--font-body);color:var(--muted)}\
.an-body{flex:1;overflow-y:auto;padding:14px}\
.an-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:15px;margin-bottom:12px}\
.an-card h3{margin:0 0 6px;font-size:16px}.an-card p{margin:0 0 10px;color:var(--muted);font-size:13.5px;line-height:1.45}\
.an-btn{border:none;border-radius:14px;padding:11px 16px;font:700 14px var(--font-body);cursor:pointer;background:var(--grad);color:#fff}.an-btn.alt{background:var(--surface-2);color:var(--fg)}.an-btn.red{background:#e5484d}.an-btn[disabled]{opacity:.5}\
.an-row{display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid var(--line);border-radius:16px;background:var(--surface);margin-bottom:8px}\
.an-row .av{width:40px;height:40px;border-radius:50%;background:var(--grad);color:#fff;display:flex;align-items:center;justify-content:center;font-size:19px;flex:none}.an-row b{flex:1;min-width:0;font-size:14.5px}\
.an-sw{display:flex;align-items:center;gap:10px;padding:12px;border-radius:16px;background:var(--surface-2);margin-bottom:12px;font-weight:700;font-size:14px;cursor:pointer}\
.an-sw i{margin-left:auto;width:44px;height:26px;border-radius:99px;background:#9aa0aa;position:relative;transition:background .15s}.an-sw i:after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:left .15s}.an-sw.on i{background:#12B886}.an-sw.on i:after{left:21px}\
.an-empty{text-align:center;color:var(--muted);padding:20px 8px;font-size:14px}\
.an-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:6px}\
.an-m{max-width:80%;padding:8px 12px;border-radius:16px;background:var(--surface);border:1px solid var(--line);font-size:14px;line-height:1.4;word-break:break-word;align-self:flex-start}.an-m.me{align-self:flex-end;background:var(--grad);color:#fff;border-color:transparent}\
.an-note{align-self:center;max-width:92%;text-align:center;font-size:12.5px;color:var(--muted);background:var(--surface-2);border-radius:14px;padding:8px 12px}\
.an-comp{display:flex;gap:8px;align-items:center;padding:8px 10px calc(var(--sa-bottom,0px) + 8px);border-top:1px solid var(--line);background:var(--surface)}\
.an-comp input{flex:1;min-width:0;border:1px solid var(--line);background:var(--surface-2);color:var(--fg);border-radius:99px;padding:11px 16px;font:14px var(--font-body)}\
.an-ic{border:none;width:42px;height:42px;border-radius:50%;background:var(--surface-2);color:var(--fg);font-size:19px;cursor:pointer;flex:none}.an-ic.go{background:var(--grad);color:#fff}\
.an-pl{display:flex;align-items:center;gap:8px;min-width:170px}.an-pl button{border:none;width:32px;height:32px;border-radius:50%;background:rgba(0,0,0,.18);color:inherit;font-size:13px;cursor:pointer;flex:none}\
.an-pl i{flex:1;height:5px;border-radius:9px;background:rgba(127,127,127,.35);overflow:hidden}.an-pl i b{display:block;height:100%;width:0;background:currentColor;opacity:.85}.an-pl span{font-size:11px;opacity:.8;min-width:30px;text-align:right}\
#anRec{position:fixed;left:10px;right:10px;bottom:calc(var(--sa-bottom,0px) + 12px);z-index:120;display:flex;align-items:center;gap:10px;background:var(--surface);border:1px solid var(--line);border-radius:99px;padding:8px 10px 8px 16px;box-shadow:0 8px 30px rgba(0,0,0,.25)}\
#anRec[hidden]{display:none}#anRec .dot{width:11px;height:11px;border-radius:50%;background:#e5484d;animation:anBlink 1s infinite}@keyframes anBlink{50%{opacity:.25}}#anRec b{flex:1;font-size:14px}\
#anInc{position:fixed;left:12px;right:12px;top:calc(var(--sa-top,0px) + 12px);z-index:130;background:var(--surface);border:1px solid var(--line);border-radius:20px;padding:14px;box-shadow:0 10px 36px rgba(0,0,0,.3)}\
#anInc[hidden]{display:none}#anInc p{margin:0 0 10px;font-size:14.5px;line-height:1.4}#anInc .an-r{display:flex;gap:8px}#anInc .an-r>*{flex:1}\
#anCall{position:absolute;inset:0;z-index:5;background:#0b0a14;color:#fff;display:flex;flex-direction:column}#anCall[hidden]{display:none}\
#anRemote{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#0b0a14}\
#anOrb{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(circle at 50% 38%,#3a2a6b,#0b0a14 70%)}\
#anOrb .o{width:120px;height:120px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:52px;animation:anOrb 2.2s ease-in-out infinite}@keyframes anOrb{50%{transform:scale(1.07);box-shadow:0 0 0 18px rgba(255,255,255,.08)}}\
#anCall .top{position:relative;z-index:3;padding:calc(var(--sa-top,0px) + 16px) 16px 8px;text-align:center;text-shadow:0 1px 8px rgba(0,0,0,.6)}#anCall .top b{display:block;font-size:18px}#anCall .top span{font-size:13px;opacity:.85}\
#anSelf{position:absolute;right:12px;top:calc(var(--sa-top,0px) + 84px);width:96px;height:128px;border-radius:16px;object-fit:cover;z-index:4;border:2px solid rgba(255,255,255,.7);background:#000;transform:scaleX(-1)}\
#anCall .hint{position:relative;z-index:3;margin:6px auto 0;max-width:86%;font-size:12.5px;text-align:center;background:rgba(0,0,0,.5);padding:6px 12px;border-radius:12px}\
#anTray{position:relative;z-index:3;margin-top:auto;display:flex;gap:8px;overflow-x:auto;padding:6px 12px}#anTray button{flex:none;border:2px solid transparent;border-radius:14px;background:rgba(255,255,255,.14);color:#fff;font:700 12px var(--font-body);padding:8px 10px;cursor:pointer}#anTray button.on{border-color:#fff;background:rgba(255,255,255,.28)}\
#anCtl{position:relative;z-index:3;display:flex;justify-content:center;gap:16px;padding:10px 12px calc(var(--sa-bottom,0px) + 22px)}\
#anCtl button{width:56px;height:56px;border-radius:50%;border:none;background:rgba(255,255,255,.2);color:#fff;font-size:22px;cursor:pointer}#anCtl button.on{background:#fff;color:#111}#anCtl button.end{background:#e5484d}\
#anOut,#anRes{position:fixed;left:12px;right:12px;bottom:calc(var(--sa-bottom,0px) + 78px);z-index:125;display:flex;align-items:center;gap:10px;background:var(--surface);color:var(--fg);border:1px solid var(--line);border-radius:18px;padding:10px 12px;box-shadow:0 8px 28px rgba(0,0,0,.25);font-size:13.5px}#anOut[hidden],#anRes[hidden]{display:none}#anOut span,#anRes span{flex:1;min-width:0}\
.an-tag{display:inline-block;font:600 11px var(--font-body);background:var(--surface-2);color:var(--muted);border-radius:99px;padding:2px 8px;margin-left:6px}\
.an-pick{width:100%;text-align:left;margin:0 0 12px}\
#anTerms{position:fixed;inset:0;z-index:140;background:rgba(8,6,20,.7);display:flex;align-items:flex-end;justify-content:center}#anTerms[hidden]{display:none}\
.an-tb{background:var(--surface);color:var(--fg);width:100%;max-width:520px;max-height:92vh;overflow-y:auto;border-radius:24px 24px 0 0;padding:20px 18px calc(var(--sa-bottom,0px) + 18px)}.an-tb h2{margin:0 0 12px;font:700 19px var(--font-display)}\
.an-tb ul{list-style:none;margin:0 0 14px;padding:0}.an-tb li{display:flex;gap:10px;margin-bottom:11px;font-size:13.5px;line-height:1.45}.an-tb li span{font-size:20px;flex:none}.an-r2{display:flex;gap:10px}.an-r2>*{flex:1}\
#anAsk{position:absolute;inset:0;z-index:8;background:rgba(8,6,20,.92);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center}#anAsk[hidden]{display:none}\
';

// Self-healing listener: if a live query drops (network blip, token refresh), it re-subscribes with a growing delay instead of staying dead.
function watch(q, next, fail) {
  var stop = false, un = null, tries = 0, t = null;
  function go() { if (stop) return; un = onSnapshot(q, function (s) { tries = 0; next(s); }, function (e) { try { un && un(); } catch (x) {} un = null; if (stop) return; tries++; if (tries > 5) { if (fail) fail(e); return; } t = setTimeout(go, Math.min(30000, 1200 * tries * tries)); }); }
  go(); return function () { stop = true; clearTimeout(t); try { un && un(); } catch (e) {} };
}
// One-time privacy notice + rules. Nothing private starts until the person has read and agreed to it.
function consent(go) {
  if (!adult()) { C.toast(T("Private Talk is for 18+ only.", "प्राइवेट बातचीत सिर्फ़ 18+ के लिए है।")); return; }
  var ok = false; try { ok = localStorage.getItem("pulse_anon_ok") === "1"; } catch (e) {} if (ok) { go(); return; }
  var m = $("anTerms"); if (!m) { m = el('<div id="anTerms" class="an-terms"></div>'); document.body.appendChild(m); }
  var li = function (i, t) { return '<li><span>' + i + '</span><div>' + esc(t) + '</div></li>'; };
  m.innerHTML = '<div class="an-tb"><h2>🔒 ' + esc(T("Your privacy in Private Talk", "प्राइवेट बातचीत में तुम्हारी प्राइवेसी")) + '</h2><ul>' +
    li("🕶️", T("Anonymous: the other person sees only a random alias — never your name, photo, profile, phone number or email.", "गुमनाम: दूसरे को सिर्फ़ एक रैंडम alias दिखता है — तुम्हारा नाम, फ़ोटो, प्रोफ़ाइल, फ़ोन नंबर या ईमेल कभी नहीं।")) +
    li("🎭", T("Video: a mask covers your eyes and nose on your phone BEFORE anything is sent. If your face can’t be found, the picture is hidden. You can also disguise your voice.", "वीडियो: कुछ भी भेजने से पहले तुम्हारे फ़ोन पर ही आँखों और नाक पर मास्क लगता है। चेहरा न मिले तो तस्वीर छुप जाती है। आवाज़ भी बदल सकते हो।")) +
    li("🛰️", T("Hidden network address: calls go through a relay, so the other person cannot see your IP address (you can switch this off in the ⋯ menu).", "छुपा नेटवर्क पता: कॉल रिले से जाती है, इसलिए दूसरे को तुम्हारा IP एड्रेस नहीं दिखता (⋯ मेनू में बंद कर सकते हो)।")) +
    li("🧹", T("Not recorded: Pulse does not record calls. Calls are encrypted between the two phones. Chat and voice notes are erased when the talk ends.", "रिकॉर्ड नहीं: Pulse कॉल रिकॉर्ड नहीं करता। कॉल दोनों फ़ोन के बीच एन्क्रिप्टेड रहती है। बातचीत खत्म होते ही चैट और वॉइस नोट मिट जाते हैं।")) +
    li("🛡️", T("Safety: Pulse keeps only a technical ID, used to stop abuse and review reports. No harassment, hate, sexual or illegal content. 18+ only. Reported accounts can be banned.", "सुरक्षा: Pulse सिर्फ़ एक तकनीकी ID रखता है, जो दुरुपयोग रोकने और रिपोर्ट देखने के लिए है। उत्पीड़न, नफ़रत, यौन या गैरकानूनी सामग्री मना है। सिर्फ़ 18+। रिपोर्ट होने पर अकाउंट बैन हो सकता है।")) +
    li("⚠️", T("No system is perfect: you can still be recognised if you say your name, show your surroundings, or the other person knows your voice. Never share real details. Don’t screen-record or share what others say.", "कोई भी सिस्टम 100% परफ़ेक्ट नहीं: अपना नाम बताने, आसपास दिखाने या आवाज़ पहचाने जाने पर पहचान हो सकती है। असली जानकारी मत दो। स्क्रीन-रिकॉर्ड या दूसरों की बात शेयर मत करो।")) +
    li("💜", T("This is peer support, not medical or legal advice. In a crisis call Tele-MANAS 14416 or emergency 112.", "यह आपसी सहारा है, मेडिकल या कानूनी सलाह नहीं। संकट में Tele-MANAS 14416 या आपातकाल 112 पर कॉल करो।")) +
    '</ul><div class="an-r2"><button type="button" class="an-btn alt" id="anTermsNo">' + esc(T("Not now", "अभी नहीं")) + '</button><button type="button" class="an-btn" id="anTermsOk">' + esc(T("I understand and agree", "मैं समझता/समझती हूँ और सहमत हूँ")) + '</button></div></div>';
  m.hidden = false; $("anTermsNo").onclick = function () { m.hidden = true; };
  $("anTermsOk").onclick = function () { try { localStorage.setItem("pulse_anon_ok", "1"); } catch (e) {} m.hidden = true; go(); };
}
// People you block never appear in your list and their requests are ignored. Kept only on this phone.
function blocked() { try { return JSON.parse(localStorage.getItem("pulse_blocked") || "[]"); } catch (e) { return []; } }
function isBlocked(u) { return blocked().indexOf(u) >= 0; }
function block(u) { if (!u) return; var b = blocked(); if (b.indexOf(u) < 0) { b.push(u); try { localStorage.setItem("pulse_blocked", JSON.stringify(b.slice(-200))); } catch (e) {} } }
function adult() { var a = parseInt(C && C.age && C.age(), 10); return !a || a >= 18; }
function css() { if ($("anonCss")) return; var s = document.createElement("style"); s.id = "anonCss"; s.textContent = CSS; document.head.appendChild(s); }
function shell() {
  if ($("anonUI")) return;
  document.body.appendChild(el('<div id="anonUI" hidden><div class="an-head"><button type="button" id="anPClose" aria-label="Back">←</button><h2>🔒 ' + esc(T("Private talk", "प्राइवेट बातचीत")) + '</h2></div><div class="an-body" id="anPBody"></div></div>'));
  document.body.appendChild(el('<div id="anonSess" hidden>' +
    '<div class="an-head"><button type="button" id="anSBack" aria-label="Back">←</button><h2><span id="anSName"></span><small>🔒 ' + esc(T("Private & anonymous", "प्राइवेट और गुमनाम")) + '</small></h2>' +
    '<button type="button" id="anSVoice" class="cb" aria-label="Voice call"><span>📞</span><small>' + esc(T("Voice", "वॉइस")) + '</small></button><button type="button" id="anSVideo" class="cb" aria-label="Video call"><span>📹</span><small>' + esc(T("Video", "वीडियो")) + '</small></button><button type="button" id="anSMenu" aria-label="More">⋯</button></div>' +
    '<div class="an-msgs" id="anSMsgs"></div>' +
    '<div class="an-comp"><button type="button" class="an-ic" id="anSMic" aria-label="Voice message">🎤</button><input id="anSInput" maxlength="500" autocomplete="off" placeholder="' + esc(T("Write anonymously…", "गुमनाम होकर लिखो…")) + '"><button type="button" class="an-ic go" id="anSSend" aria-label="Send">➤</button></div>' +
    '<div id="anCall" hidden><video id="anRemote" autoplay playsinline></video><div id="anOrb"><div class="o">💜</div><div id="anOrbT" style="font-size:15px;opacity:.9"></div><button type="button" class="an-btn" id="anOrbVid">📹 ' + esc(T("Switch to video (masked)", "वीडियो पर जाओ (मास्क के साथ)")) + '</button></div>' +
    '<div class="top"><b id="anCName"></b><span id="anCSub"></span><small style="display:block;opacity:.8;font-size:11px;margin-top:2px">🔒 ' + esc(T("Anonymous — nobody can find out who you are. Your privacy matters to us.", "गुमनाम — कोई नहीं जान सकता कि तुम कौन हो। तुम्हारी प्राइवेसी हमारे लिए ज़रूरी है।")) + '</small></div><video id="anSelf" autoplay playsinline muted hidden></video><div class="hint" id="anHint" hidden></div>' +
    '<div id="anTray" hidden></div><div id="anCtl"><button type="button" id="anMute" aria-label="Mute">🎙️</button><button type="button" id="anVoiceBtn" aria-label="Voice disguise">🗣️</button><button type="button" id="anMaskBtn" aria-label="Mask">🎭</button><button type="button" id="anVidBtn" aria-label="Video">📹</button><button type="button" class="end" id="anEnd" aria-label="End call">✕</button></div></div>' +
    '<div id="anAsk" hidden><div style="font-size:54px">📞</div><div id="anAskT" style="font-size:17px;font-weight:700"></div><div id="anAskS" style="font-size:13px;opacity:.8;max-width:280px"></div><div style="display:flex;gap:12px"><button type="button" class="an-btn red" id="anAskNo">' + esc(T("Decline", "मना करो")) + '</button><button type="button" class="an-btn" id="anAskYes">' + esc(T("Accept", "स्वीकारो")) + '</button></div></div>' +
    '</div>'));
  document.body.appendChild(el('<div id="anRec" hidden><span class="dot"></span><b id="anRecT">0:00</b><button type="button" class="an-btn alt" id="anRecV"></button><button type="button" class="an-btn alt" id="anRecX">' + esc(T("Cancel", "रद्द")) + '</button><button type="button" class="an-btn" id="anRecOk">' + esc(T("Send", "भेजो")) + '</button></div>'));
  document.body.appendChild(el('<div id="anInc" hidden></div>'));
  document.body.appendChild(el('<div id="anOut" hidden><span id="anOutT"></span><button type="button" class="an-btn alt" id="anOutX">' + esc(T("Cancel", "रद्द")) + '</button></div>'));
  document.body.appendChild(el('<div id="anRes" hidden></div>'));
  $("anOutX").addEventListener("click", cancelReq); $("anVoiceBtn").addEventListener("click", voiceCycle);
  $("anPClose").addEventListener("click", function () { $("anonUI").hidden = true; });
  $("anSBack").addEventListener("click", sessionMinimize);
  $("anSMenu").addEventListener("click", sessionMenu);
  $("anSSend").addEventListener("click", sessionSend); $("anSInput").addEventListener("keydown", function (e) { if (e.key === "Enter") sessionSend(); });
  $("anSMic").addEventListener("click", function () { recStart(function (url, dur) { return sessionSendAudio(url, dur); }); });
  $("anSVoice").addEventListener("click", function () { callStart(false); }); $("anSVideo").addEventListener("click", function () { callStart(true); });
  $("anEnd").addEventListener("click", function () { endCall(true); });
  $("anMute").addEventListener("click", toggleMute); $("anMaskBtn").addEventListener("click", function () { var t = $("anTray"); t.hidden = !t.hidden; });
  $("anVidBtn").addEventListener("click", function () { callStart(true); }); $("anOrbVid").addEventListener("click", function () { callStart(true); });
}

// ---------------------------------------------------------------- voice messages (shared)
export function playerEl(src, dur) {
  if (typeof src !== "string" || src.indexOf("data:audio/") !== 0) return document.createTextNode("🎤");
  var w = el('<div class="an-pl"><button type="button">▶</button><i><b></b></i><span>' + fmt(dur || 0) + '</span></div>'), a = null, btn = w.querySelector("button"), bar = w.querySelector("b"), tm = w.querySelector("span");
  btn.addEventListener("click", function () {
    if (!a) { a = new Audio(src); a.onended = function () { btn.textContent = "▶"; bar.style.width = "0"; }; a.ontimeupdate = function () { var d = a.duration || dur || 1; bar.style.width = Math.min(100, a.currentTime / d * 100) + "%"; tm.textContent = fmt(a.currentTime); }; }
    if (a.paused) { document.querySelectorAll("audio").forEach(function (x) { try { x.pause(); } catch (e) {} }); a.play().then(function () { btn.textContent = "❚❚"; }).catch(function () { C && C.toast(T("Could not play this voice note.", "यह वॉइस नोट नहीं चल पाया।")); }); } else { a.pause(); btn.textContent = "▶"; }
  });
  return w;
}
function recStart(send) {
  if (REC) return;
  if (!window.MediaRecorder || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { C.toast(T("Voice notes are not supported on this device.", "इस डिवाइस पर वॉइस नोट नहीं चलेगा।")); return; }
  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } }).then(function (stream) {
    var mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].filter(function (m) { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } })[0], mr, fx = null;
    try { fx = disguiseSupported() ? disguise(stream, VFX) : null; } catch (e) { fx = null; }
    try { mr = new MediaRecorder(fx ? fx.stream : stream, mime ? { mimeType: mime, audioBitsPerSecond: 22000 } : { audioBitsPerSecond: 22000 }); } catch (e) { stream.getTracks().forEach(function (t) { t.stop(); }); if (fx) fx.stop(); C.toast(T("Recording failed to start.", "रिकॉर्डिंग शुरू नहीं हो पाई।")); return; }
    var chunks = [], t0 = Date.now(), r = REC = { mr: mr, stream: stream, cancel: false, tick: null, fx: fx };
    mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = function () {
      clearInterval(r.tick); stream.getTracks().forEach(function (t) { t.stop(); }); if (fx) fx.stop(); $("anRec").hidden = true; if (REC === r) REC = null;
      var dur = (Date.now() - t0) / 1000; if (r.cancel) return;
      if (dur < 0.7) { C.toast(T("Too short — hold on a little longer.", "बहुत छोटा — थोड़ा और बोलो।")); return; }
      var blob = new Blob(chunks, { type: mr.mimeType || mime || "audio/webm" }), fr = new FileReader();
      fr.onload = function () { var url = String(fr.result); if (url.length > 280000) { C.toast(T("Voice note is too long. Keep it under 40 seconds.", "वॉइस नोट बहुत लंबा है। 40 सेकंड से कम रखो।")); return; } Promise.resolve(send(url, Math.round(dur))).catch(function (e) { C.toast(C.errMsg(e)); }); };
      fr.readAsDataURL(blob);
    };
    mr.start(500); $("anRec").hidden = false; $("anRecT").textContent = "0:00"; paintRecV(); $("anRecV").style.display = fx ? "" : "none";
    $("anRecV").onclick = function () { var v = vfxNext(); if (r.fx) r.fx.set(VFX); paintRecV(); paintVoiceBtn(); C.toast(T("Voice: ", "आवाज़: ") + T(v.en, v.hi)); };
    r.tick = setInterval(function () { var s = (Date.now() - t0) / 1000; $("anRecT").textContent = fmt(s); if (s >= 40) { try { mr.stop(); } catch (e) {} } }, 250);
    $("anRecX").onclick = function () { r.cancel = true; try { mr.stop(); } catch (e) {} };
    $("anRecOk").onclick = function () { try { mr.stop(); } catch (e) {} };
  }).catch(function (e) { C.toast(/denied|NotAllowed|Permission/i.test(String(e && (e.name || e.message))) ? T("Microphone access is off. Allow it in Settings.", "माइक की अनुमति बंद है। सेटिंग्स में चालू करो।") : C.errMsg(e)); });
}

function paintRecV() { var b = $("anRecV"), v = vfx(); if (b) b.textContent = v.e + " " + T(v.en, v.hi); }
function paintVoiceBtn() { var b = $("anVoiceBtn"), v = vfx(); if (b) { b.textContent = v.e; b.classList.toggle("on", v.id !== "natural"); } }
function voiceCycle() { var v = vfxNext(), s = S; [s && s.cur, s && s.nxt].forEach(function (a) { if (a && a.fx) a.fx.set(VFX); }); paintVoiceBtn(); C.toast(T("Voice: ", "आवाज़: ") + T(v.en, v.hi)); }
function notify() { try { if (navigator.vibrate) navigator.vibrate([180, 90, 180]); } catch (e) {} try { var AC = window.AudioContext || window.webkitAudioContext, c = new AC(), o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = 880; g.gain.value = 0.08; o.connect(g); g.connect(c.destination); o.start(); o.frequency.setValueAtTime(660, c.currentTime + 0.14); o.stop(c.currentTime + 0.3); setTimeout(function () { try { c.close(); } catch (e) {} }, 500); } catch (e) {} }

// ---------------------------------------------------------------- circle (room) hooks
function openFresh(x) { var t = x && x.t ? ms(x.t) : 0; return Date.now() - t < 90000; }
export function anonRoomOpen(room, alias, name) {
  if (!C) return; anonRoomClose(); R = { room: room, alias: alias, name: name };
  var head = $("support") && $("support").querySelector(".convo-head"), comp = $("support") && $("support").querySelector(".convo-input");
  if (head && !$("anLock")) { var b = el('<button type="button" id="anLock" class="icon-btn" aria-label="Private talk" style="position:relative;font-size:20px">🔒<small id="anLockN" style="position:absolute;top:-2px;right:-2px;background:#12B886;color:#fff;border-radius:99px;font:700 10px var(--font-body);padding:1px 5px" hidden></small></button>'); head.appendChild(b); b.addEventListener("click", openPanel); }
  if (comp && !$("anMic")) { var m = el('<button type="button" id="anMic" class="icon-btn" aria-label="Voice message" style="font-size:20px">🎤</button>'), sd = $("supportSend"); comp.insertBefore(m, sd); m.addEventListener("click", function () { var rr = R; if (!rr) return; if (!C.rate("scvoice", 4, 60000)) return; recStart(function (url, dur) { return addDoc(collection(C.db, "supportRooms", rr.room, "msgs"), { from: uid(), alias: rr.alias, text: "🎤 " + T("Voice message", "वॉइस संदेश"), audio: url, dur: dur, createdAt: serverTimestamp() }); }); }); }
  paintCount(); if (P.open) setOpen(true, true);
}
export function anonRoomClose() {
  if (!R) return; R = null;
  if ($("anonUI")) $("anonUI").hidden = true; var l = $("anLock"), m = $("anMic"); if (l) l.remove(); if (m) m.remove();
}
function openOthers() { return Object.keys(P.others).filter(function (k) { return k !== uid() && !isBlocked(k) && openFresh(P.others[k]); }); }
function paintCount() {
  var n = openOthers().length, txt = n ? T("🔒 Private talk · " + n + " open", "🔒 प्राइवेट बातचीत · " + n + " उपलब्ध") : T("🔒 Private talk", "🔒 प्राइवेट बातचीत");
  var b = $("anLockN"); if (b) { b.textContent = n; b.hidden = !n; } var p = $("anPickBtn"); if (p) p.textContent = txt;
}
function myAlias() { return C.alias("private"); }
function setOpen(on, quiet) {
  if (!C) return; P.open = on; var ref = doc(C.db, "supportOpen", uid()); clearInterval(P.tick); P.tick = null;
  if (on) { setDoc(ref, { alias: myAlias(), topic: R ? String(R.name || "").slice(0, 40) : "", t: serverTimestamp() }).catch(function (e) { P.open = false; C.toast(C.errMsg(e)); paintPanel(); }); P.tick = setInterval(function () { if (P.open && C) setDoc(ref, { alias: myAlias(), topic: R ? String(R.name || "").slice(0, 40) : "", t: serverTimestamp() }).catch(function () {}); paintCount(); }, 30000); }
  else deleteDoc(ref).catch(function (e) { C.toast(C.errMsg(e)); });
  if (!quiet) paintPanel();
}
function openPanel() { if (!C) return; consent(function () { $("anonUI").hidden = false; paintPanel(); }); }
function paintPanel() {
  var b = $("anPBody"); if (!b || !C || $("anonUI").hidden) return; var keys = openOthers();
  var h = '<div class="an-card"><h3>' + esc(T("Talk to one person, privately", "किसी एक से प्राइवेट बात करो")) + '</h3><p>' + esc(T("Both of you stay anonymous — only random aliases show. Chat, send voice notes, call, and switch to video with a mask over your face (you can also disguise your voice). Share no real name, number or location. End or report any time.", "दोनों गुमनाम रहते हो — सिर्फ़ रैंडम alias दिखता है। चैट, वॉइस नोट, कॉल और चेहरे पर मास्क के साथ वीडियो कर सकते हो (आवाज़ भी बदल सकते हो)। असली नाम, नंबर या लोकेशन मत बताओ। कभी भी खत्म या रिपोर्ट करो।")) + '</p>' +
    '<div class="an-sw' + (P.open ? ' on' : '') + '" id="anSw"><span>🔓 ' + esc(T("I’m open for a private talk", "मैं प्राइवेट बात के लिए तैयार हूँ")) + '</span><i></i></div>' +
    '<p style="margin:0;font-size:12.5px">' + esc(P.open ? T("You are visible as ", "तुम इस नाम से दिखते हो: ") + myAlias() + T(" while the app is open.", " (जब तक ऐप खुला है)।") : T("Turn this on so others can ask to talk to you. Your alias is ", "इसे चालू करो ताकि दूसरे तुमसे बात माँग सकें। तुम्हारा alias: ") + myAlias()) + '</p></div>';
  if (OUT) h += '<div class="an-card"><div class="an-row" style="margin:0"><div class="av">⏳</div><b>' + esc(T("Waiting for ", "इंतज़ार: ")) + esc(OUT.alias) + '…</b><button type="button" class="an-btn alt" id="anCancelReq">' + esc(T("Cancel", "रद्द")) + '</button></div></div>';
  h += '<div class="an-card"><h3>' + esc(T("Open right now", "अभी उपलब्ध")) + '</h3>';
  if (!keys.length) h += '<div class="an-empty">' + esc(T("No one is open at the moment. When someone turns it on — in any circle — they appear here instantly.", "अभी कोई उपलब्ध नहीं। जैसे ही कोई (किसी भी सर्कल में) चालू करेगा, यहाँ तुरंत दिखेगा।")) + '</div>';
  keys.forEach(function (k) { var o = P.others[k]; h += '<div class="an-row"><div class="av">💜</div><b>' + esc(o.alias || "Someone") + (o.topic ? '<span class="an-tag">' + esc(o.topic) + '</span>' : '') + '</b><button type="button" class="an-btn" data-ask="' + esc(k) + '"' + (OUT || S ? ' disabled' : '') + '>' + esc(T("Ask to talk", "बात का अनुरोध")) + '</button></div>'; });
  b.innerHTML = h + '</div>';
  $("anSw").addEventListener("click", function () { setOpen(!P.open); });
  var cr = $("anCancelReq"); if (cr) cr.addEventListener("click", cancelReq);
  b.querySelectorAll("[data-ask]").forEach(function (x) { x.addEventListener("click", function () { ask(x.getAttribute("data-ask")); }); });
}

// ---------------------------------------------------------------- requests
function paintOut() { var b = $("anOut"); if (!b) return; if (!OUT) { b.hidden = true; return; } $("anOutT").textContent = T("⏳ Waiting for ", "⏳ इंतज़ार: ") + OUT.alias + "…"; b.hidden = !!S; }
function ask(toUid) {
  if (!C || OUT || S) return; var o = P.others[toUid]; if (!o) return; if (P.cool[toUid] && Date.now() - P.cool[toUid] < 300000) { C.toast(T("They were not available a moment ago. Try again in a few minutes.", "वे अभी उपलब्ध नहीं थे। कुछ मिनट बाद फिर कोशिश करो।")); return; }
  if (!C.rate("anreq", 4, 60000)) return;
  addDoc(collection(C.db, "supportReq"), { from: uid(), to: toUid, fromAlias: myAlias(), toAlias: String(o.alias || "").slice(0, 30), room: R ? R.room : "", status: "pending", createdAt: serverTimestamp() }).then(function (r) {
    OUT = { id: r.id, to: toUid, alias: String(o.alias || ""), at: Date.now() }; paintPanel(); paintOut();
    OUT.timer = setTimeout(function () { if (OUT && OUT.id === r.id) { C.toast(T("No reply yet — try again later.", "अभी जवाब नहीं आया — बाद में कोशिश करो।")); cancelReq(); } }, 120000);
  }).catch(function (e) { C.toast(C.errMsg(e)); });
}
function cancelReq() { if (!OUT) return; var o = OUT; OUT = null; clearTimeout(o.timer); updateDoc(doc(C.db, "supportReq", o.id), { status: "cancelled", updatedAt: serverTimestamp() }).catch(function () {}); paintOut(); paintPanel(); }
function showIncoming(id, x) {
  if (INC || S) { updateDoc(doc(C.db, "supportReq", id), { status: "declined", updatedAt: serverTimestamp() }).catch(function () {}); return; }
  INC = { id: id, x: x }; var b = $("anInc");
  b.innerHTML = '<p>🔒 <b>' + esc(x.fromAlias || "Someone") + '</b> ' + esc(T("would like to talk privately and anonymously. Both of you stay hidden.", "प्राइवेट और गुमनाम बात करना चाहते हैं। दोनों छुपे रहोगे।")) + '</p><div class="an-r"><button type="button" class="an-btn alt" id="anIncNo">' + esc(T("Not now", "अभी नहीं")) + '</button><button type="button" class="an-btn" id="anIncYes">' + esc(T("Accept", "स्वीकारो")) + '</button></div>';
  b.hidden = false; notify(); INC.timer = setTimeout(hideIncoming, 115000);
  $("anIncNo").onclick = function () { var i = INC; hideIncoming(); if (i) updateDoc(doc(C.db, "supportReq", i.id), { status: "declined", updatedAt: serverTimestamp() }).catch(function () {}); };
  $("anIncYes").onclick = function () { var i = INC; hideIncoming(); if (!i) return; consent(function () { updateDoc(doc(C.db, "supportReq", i.id), { status: "accepted", updatedAt: serverTimestamp() }).then(function () { openSession(i.id, i.x.from, i.x.fromAlias, i.x.toAlias); }).catch(function (e) { C.toast(C.errMsg(e)); }); }); };
}
function hideIncoming() { if (INC) clearTimeout(INC.timer); INC = null; var b = $("anInc"); if (b) { b.hidden = true; b.innerHTML = ""; } }
function purgeReq(id) { ["msgs", "sig"].forEach(function (sub) { getDocs(query(collection(C.db, "supportReq", id, sub), limit(100))).then(function (q) { q.docs.forEach(function (d) { deleteDoc(d.ref).catch(function () {}); }); }).catch(function () {}); }); }
function showResume(id, other, oAlias, myA) {
  if (RES || S || OUT || INC) return; RES = { id: id }; var b = $("anRes");
  b.innerHTML = '<span>🔒 ' + esc(T("Private talk with ", "प्राइवेट बातचीत: ")) + '<b>' + esc(oAlias) + '</b></span><button type="button" class="an-btn alt" id="anResEnd">' + esc(T("End", "खत्म")) + '</button><button type="button" class="an-btn" id="anResGo">' + esc(T("Resume", "फिर शुरू")) + '</button>'; b.hidden = false;
  $("anResGo").onclick = function () { hideResume(); openSession(id, other, oAlias, myA); };
  $("anResEnd").onclick = function () { hideResume(); updateDoc(doc(C.db, "supportReq", id), { status: "ended", endedBy: uid(), updatedAt: serverTimestamp() }).catch(function () {}); purgeReq(id); };
}
function hideResume() { RES = null; var b = $("anRes"); if (b) { b.hidden = true; b.innerHTML = ""; } }
function reqChange(ch, inbound) {
  var x = dd(ch.doc), id = ch.doc.id, age = Date.now() - ms(x.createdAt), fresh = Date.now() - ms(x.updatedAt || x.createdAt) < 3 * 3600000;
  if (x.status === "pending" && inbound && ch.type === "added" && age < 120000) { if (isBlocked(x.from)) updateDoc(ch.doc.ref, { status: "declined", updatedAt: serverTimestamp() }).catch(function () {}); else showIncoming(id, x); }
  else if (x.status === "pending" && !inbound && ch.type === "added" && age > 180000) deleteDoc(ch.doc.ref).catch(function () {});
  else if (x.status === "cancelled" && inbound) { if (INC && INC.id === id) hideIncoming(); deleteDoc(ch.doc.ref).catch(function () {}); }
  else if (x.status === "accepted" && !inbound && OUT && OUT.id === id) { var o = OUT; OUT = null; clearTimeout(o.timer); paintOut(); openSession(id, x.to, x.toAlias, x.fromAlias); }
  else if (x.status === "accepted" && ch.type === "added" && !(S && S.rid === id) && fresh) { if (inbound) showResume(id, x.from, x.fromAlias, x.toAlias); else showResume(id, x.to, x.toAlias, x.fromAlias); }
  else if (x.status === "declined" && !inbound) { if (OUT && OUT.id === id) { clearTimeout(OUT.timer); OUT = null; paintOut(); } P.cool[x.to] = Date.now(); C.toast(T("They are not available right now.", "वे अभी उपलब्ध नहीं हैं।")); paintPanel(); deleteDoc(ch.doc.ref).catch(function () {}); }
  else if (x.status === "ended" && x.endedBy !== uid()) { if (S && S.rid === id) sessionEnd(false, T("The other person ended the talk.", "दूसरे ने बातचीत खत्म कर दी।")); if (RES && RES.id === id) hideResume(); purgeReq(id); deleteDoc(ch.doc.ref).catch(function () {}); }
}

// ---------------------------------------------------------------- private session
function openSession(rid, other, otherAlias, myAlias) {
  if (S) return; if (!$("anonUI").hidden) $("anonUI").hidden = true; hideResume(); $("anOut").hidden = true;
  secureScreen(true);
  S = { rid: rid, other: other, oAlias: otherAlias || "Someone", alias: myAlias || "Me", unsubs: [], cur: null, nxt: null, offer: null, mutedL: false };
  $("anSName").textContent = S.oAlias; $("anSMsgs").innerHTML = ""; $("anonSess").hidden = false; $("anSInput").value = "";
  paintMaskTray();
  S.unsubs.push(watch(query(collection(C.db, "supportReq", rid, "msgs"), orderBy("createdAt", "asc"), limit(80)), function (s) {
    var box = $("anSMsgs"); if (!box || !S || S.rid !== rid) return; box.innerHTML = '<div class="an-note">' + esc(T("Say hi. Only aliases are visible here. When the talk ends, this chat is erased. If you feel unsafe or in crisis, call Tele-MANAS 14416 (free, India).", "नमस्ते कहो। यहाँ सिर्फ़ alias दिखते हैं। बातचीत खत्म होते ही चैट मिट जाती है। खुद को असुरक्षित या संकट में महसूस करो तो Tele-MANAS 14416 (मुफ़्त, भारत) पर कॉल करो।")) + '</div>';
    S.log = s.docs.map(function (d) { var m = dd(d); return (m.from === uid() ? "me: " : "them: ") + (m.audio ? "[voice note]" : String(m.text || "").slice(0, 160)); }).slice(-12);
    s.docs.forEach(function (d) { var m = dd(d), mine = m.from === uid(), b = el('<div class="an-m ' + (mine ? "me" : "") + '"></div>'); if (m.audio) b.appendChild(playerEl(m.audio, m.dur)); else b.textContent = m.text || ""; box.appendChild(b); });
    box.scrollTop = 1e9;
  }, function (e) { C.toast(C.errMsg(e)); }));
  S.unsubs.push(watch(query(collection(C.db, "supportReq", rid, "sig"), where("to", "==", uid())), function (s) {
    s.docChanges().forEach(function (ch) { if (ch.type !== "added") return; var x = dd(ch.doc); deleteDoc(ch.doc.ref).catch(function () {}); if (Date.now() - ms(x.createdAt) > 60000 || !S) return; sigIn(x); });
  }, function () {}));
}
function sessionMinimize() { /* the talk stays alive; reopen from the notice */ if (!S) return; if (S.cur || S.nxt) { C.toast(T("Call is on. End it to leave.", "कॉल चालू है। बाहर जाने से पहले उसे खत्म करो।")); return; } $("anonSess").hidden = true; var n = $("anInc"); n.innerHTML = '<p>🔒 ' + esc(T("Private talk with ", "प्राइवेट बातचीत: ")) + '<b>' + esc(S.oAlias) + '</b></p><div class="an-r"><button type="button" class="an-btn alt" id="anBkEnd">' + esc(T("End", "खत्म")) + '</button><button type="button" class="an-btn" id="anBkOpen">' + esc(T("Open", "खोलो")) + '</button></div>'; n.hidden = false; $("anBkOpen").onclick = function () { n.hidden = true; $("anonSess").hidden = false; }; $("anBkEnd").onclick = function () { n.hidden = true; sessionEnd(true); }; }
function sessionSend() {
  var inp = $("anSInput"), t = (inp.value || "").replace(/\s+/g, " ").trim().slice(0, 500); if (!t || !S) return;
  var m = C.moderate(t); if (m && m.crisis) { inp.value = ""; $("anSMsgs").appendChild(el('<div class="an-note">' + esc(m.crisis) + '</div>')); $("anSMsgs").scrollTop = 1e9; return; }
  if (m && m.abuse) { C.toast(T("Please keep it respectful.", "कृपया सम्मान से लिखो।")); return; }
  if (!C.rate("anmsg", 10, 10000)) return; inp.value = "";
  addDoc(collection(C.db, "supportReq", S.rid, "msgs"), { from: uid(), text: t, createdAt: serverTimestamp() }).catch(function (e) { C.toast(C.errMsg(e)); });
}
function sessionSendAudio(url, dur) { if (!S) return; if (!C.rate("anvoice", 4, 60000)) return; return addDoc(collection(C.db, "supportReq", S.rid, "msgs"), { from: uid(), text: "🎤", audio: url, dur: dur, createdAt: serverTimestamp() }); }
function sessionMenu() {
  if (!S) return; var n = $("anInc"); n.innerHTML = '<p>' + esc(T("Private talk options", "प्राइवेट बातचीत के विकल्प")) + '</p><div class="an-r"><button type="button" class="an-btn alt" id="anMenuIp">' + esc((RELAY ? "🛰️ " : "⚠️ ") + T("Hide my IP: ", "IP छुपाओ: ") + (RELAY ? T("On", "चालू") : T("Off", "बंद"))) + '</button><button type="button" class="an-btn alt" id="anMenuBlk">' + esc(T("Block & end", "ब्लॉक करो और खत्म")) + '</button><button type="button" class="an-btn alt" id="anMenuX">' + esc(T("Close", "बंद")) + '</button><button type="button" class="an-btn red" id="anMenuRep">' + esc(T("Report & end", "रिपोर्ट करो और खत्म")) + '</button><button type="button" class="an-btn" id="anMenuEnd">' + esc(T("End talk", "बातचीत खत्म")) + '</button></div>'; n.hidden = false;
  $("anMenuBlk").onclick = function () { n.hidden = true; var s = S; if (!s) return; block(s.other); C.toast(T("Blocked. You will not see each other again.", "ब्लॉक हो गया। आप दोनों दोबारा नहीं दिखोगे।")); sessionEnd(true); }; $("anMenuX").onclick = function () { n.hidden = true; }; $("anMenuIp").onclick = function () { RELAY = !RELAY; try { localStorage.setItem("pulse_relay", RELAY ? "1" : "0"); } catch (e) {} n.hidden = true; C.toast(RELAY ? T("Your IP address is hidden from the other person (next call).", "दूसरे से तुम्हारा IP छुपा रहेगा (अगली कॉल से)।") : T("Calls are now direct — the other person’s phone can see your IP. Use only if calls won’t connect.", "अब कॉल सीधी होगी — दूसरे के फ़ोन को तुम्हारा IP दिख सकता है। सिर्फ़ तब इस्तेमाल करो जब कॉल न जुड़े।")); }; $("anMenuEnd").onclick = function () { n.hidden = true; sessionEnd(true); };
  $("anMenuRep").onclick = function () { n.hidden = true; var s = S; if (!s) return; addDoc(collection(C.db, "reports"), { from: uid(), against: s.other, reason: "support-private", rid: s.rid, log: (s.log || []).join("\n").slice(0, 3500), createdAt: serverTimestamp() }).catch(function () {}); block(s.other); C.toast(T("Reported and blocked. Thank you for keeping this safe.", "रिपोर्ट और ब्लॉक हो गया। सुरक्षित रखने के लिए शुक्रिया।")); sessionEnd(true); };
}
function sessionEnd(notify, note) {
  if (!S) return; var s = S; S = null; secureScreen(false); closeCallUi(s); s.unsubs.forEach(function (u) { try { u(); } catch (e) {} });
  $("anonSess").hidden = true; $("anInc").hidden = true;
  if (notify) {
    updateDoc(doc(C.db, "supportReq", s.rid), { status: "ended", endedBy: uid(), updatedAt: serverTimestamp() }).catch(function () {});
    purgeReq(s.rid);
  }
  if (note) C.toast(note);
}

// ---------------------------------------------------------------- calls (voice, then masked video)
function sigOut(kind, extra) { if (!S) return Promise.resolve(); return addDoc(collection(C.db, "supportReq", S.rid, "sig"), Object.assign({ from: uid(), to: S.other, kind: kind, createdAt: serverTimestamp() }, extra || {})); }
function media(video) {
  return Call.getMedia(video).then(function (raw) {
    var fx = null; try { fx = disguiseSupported() ? disguise(raw, VFX) : null; } catch (e) { fx = null; }
    var base = fx ? new MediaStream(raw.getVideoTracks().concat([fx.track])) : raw;
    if (!video) return { raw: raw, fx: fx, stream: base, mask: null };
    var fail = function () { if (fx) fx.stop(); raw.getTracks().forEach(function (t) { t.stop(); }); throw new Error(T("The privacy mask could not start on this phone, so only voice calls are available.", "इस फ़ोन पर प्राइवेसी मास्क शुरू नहीं हो पाया, इसलिए सिर्फ़ वॉइस कॉल हो सकती है।")); };
    var mk = createMask(base, { style: S && S.style || "venetian" }); if (!mk) return fail();
    return Promise.race([mk.ready, new Promise(function (_, rj) { setTimeout(function () { rj(new Error("timeout")); }, 25000); })]).then(function () { return { raw: raw, fx: fx, stream: mk.stream, mask: mk }; }, function () { mk.stop(); return fail(); });
  });
}
function attempt(video, role, m) { return { video: video, role: role, raw: m.raw, fx: m.fx, stream: m.stream, mask: m.mask, pc: null, remote: null, t0: Date.now(), stopAdapt: null, timer: null }; }
function closeAttempt(a) {
  if (!a) return; clearTimeout(a.timer); clearInterval(a.tick); try { a.stopAdapt && a.stopAdapt(); } catch (e) {} try { a.pc && a.pc.close(); } catch (e) {}
  try { a.fx && a.fx.stop(); } catch (e) {} try { a.mask && a.mask.stop(); } catch (e) {} [a.raw, a.stream].forEach(function (s) { try { s && s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} });
}
function callStart(video) {
  if (!S) return; if (S.nxt || S.offer) { C.toast(T("A call is already being set up.", "कॉल पहले से जुड़ रही है।")); return; }
  if (!Call.supported()) { C.toast(T("Calls are not supported on this device.", "इस डिवाइस पर कॉल नहीं चलेगी।")); return; }
  if (video && !maskSupported()) { C.toast(T("This phone can’t mask video, so only voice calls are available.", "यह फ़ोन वीडियो पर मास्क नहीं लगा सकता, इसलिए सिर्फ़ वॉइस कॉल हो सकती है।")); return; }
  var s = S, tag = {}; s.nxt = tag; showCallUi(video ? T("Calling with video…", "वीडियो कॉल हो रही है…") : T("Calling…", "कॉल हो रही है…"), !!video);
  media(video).then(function (m) {
    if (S !== s || s.nxt !== tag) { closeAttempt(m); return null; }
    var a = attempt(video, "caller", m); s.nxt = a; wirePreview(a);
    return Call.makeOffer(a.stream, function (st) { attachRemote(a, st); }, function (st) { attState(a, st); }, null, RELAY).then(function (o) {
      if (S !== s || s.nxt !== a) { try { o.pc.close(); } catch (e) {} closeAttempt(a); return; } a.pc = o.pc;
      return sigOut("offer", { video: !!video, sdp: o.sdp }).then(function () { a.timer = setTimeout(function () { if (S === s && s.nxt === a) { C.toast(T("No answer.", "जवाब नहीं आया।")); dropNext(); } }, 45000); });
    });
  }).catch(function (e) { if (S === s && s.nxt === tag) s.nxt = null; if (S === s) { if (!s.cur) hideCallUi(); else restoreUi(); } C.toast(/denied|NotAllowed|Permission/i.test(String(e && (e.name || e.message))) ? T("Camera/microphone access is off. Allow it in Settings.", "कैमरा/माइक की अनुमति बंद है। सेटिंग्स में चालू करो।") : (e && e.message) || C.errMsg(e)); });
}
function dropNext() { if (!S) return; var a = S.nxt; S.nxt = null; if (a && a.raw) closeAttempt(a); if (!S.cur) hideCallUi(); else restoreUi(); }
function restoreUi() { if (S && S.cur) { showCallUi("", S.cur.video); wirePreview(S.cur); paintMute(); } }
function sigIn(x) {
  if (!S || !x) return;
  if (x.kind === "offer") {
    if (S.offer) return; S.offer = x; var vid = !!x.video, upg = !!S.cur;
    $("anAskT").textContent = vid ? (upg ? T("Switch to video?", "वीडियो पर आएँ?") : T("Incoming video call", "वीडियो कॉल आ रही है")) : T("Incoming voice call", "वॉइस कॉल आ रही है");
    $("anAskS").textContent = S.oAlias + (vid ? " · " + T("Your face stays covered by a mask.", "तुम्हारा चेहरा मास्क से ढका रहेगा।") : "");
    $("anAsk").hidden = false; S.offerTimer = setTimeout(function () { if (S && S.offer === x) declineOffer(); }, 45000);
    $("anAskNo").onclick = declineOffer; $("anAskYes").onclick = function () { acceptOffer(x); };
  } else if (x.kind === "answer") {
    var a = S.nxt; if (a && a.pc && a.pc.signalingState === "have-local-offer") Call.applyAnswer(a.pc, x.sdp).catch(function () { dropNext(); });
  } else if (x.kind === "decline") { C.toast(T("Declined.", "मना कर दिया।")); dropNext(); }
  else if (x.kind === "end") { if (S.offer) { clearTimeout(S.offerTimer); S.offer = null; $("anAsk").hidden = true; } endCall(false, T("Call ended.", "कॉल खत्म हुई।")); }
}
function declineOffer() { if (!S) return; clearTimeout(S.offerTimer); S.offer = null; $("anAsk").hidden = true; sigOut("decline").catch(function () {}); if (!S.cur && !S.nxt) hideCallUi(); }
function acceptOffer(x) {
  if (!S || S.offer !== x) return; clearTimeout(S.offerTimer); S.offer = null; $("anAsk").hidden = true; var s = S, tag = {}; s.nxt = tag; showCallUi(T("Connecting…", "जुड़ रहा है…"), !!x.video);
  media(!!x.video).then(function (m) {
    if (S !== s || s.nxt !== tag) { closeAttempt(m); return null; }
    var a = attempt(!!x.video, "callee", m); s.nxt = a; wirePreview(a);
    return Call.makeAnswer(a.stream, x.sdp, function (st) { attachRemote(a, st); }, function (st) { attState(a, st); }, null, RELAY).then(function (r) {
      if (S !== s || s.nxt !== a) { try { r.pc.close(); } catch (e) {} closeAttempt(a); return; } a.pc = r.pc; return sigOut("answer", { sdp: r.sdp });
    });
  }).catch(function (e) { if (S === s && s.nxt === tag) s.nxt = null; sigOut("decline").catch(function () {}); if (S === s) { if (!s.cur) hideCallUi(); else restoreUi(); } C.toast(/denied|NotAllowed|Permission/i.test(String(e && (e.name || e.message))) ? T("Camera/microphone access is off. Allow it in Settings.", "कैमरा/माइक की अनुमति बंद है। सेटिंग्स में चालू करो।") : (e && e.message) || C.errMsg(e)); });
}
function wirePreview(a) { if (a.video && a.mask) { var v = $("anSelf"); v.srcObject = new MediaStream([a.mask.track]); v.hidden = false; v.play().catch(function () {}); } }
function attachRemote(a, st) { a.remote = st; if (S && (S.nxt === a || S.cur === a)) { var v = $("anRemote"); v.srcObject = st; v.play().catch(function () {}); } }
function attState(a, st) {
  if (!S) return;
  if (st === "connected") { promote(a); }
  else if (st === "failed" || st === "closed") { if (S.cur === a) endCall(false, T("Connection lost.", "कनेक्शन टूट गया।")); else if (S.nxt === a) { C.toast(T("Could not connect. Try again.", "जुड़ नहीं पाया। फिर कोशिश करो।")); dropNext(); } }
  else if (st === "disconnected") { setTimeout(function () { if (S && S.cur === a && a.pc && a.pc.connectionState === "disconnected") endCall(false, T("Connection lost.", "कनेक्शन टूट गया।")); }, 9000); }
}
function promote(a) {
  if (!S || S.cur === a) return; var old = S.cur; S.cur = a; if (S.nxt === a) S.nxt = null; clearTimeout(a.timer);
  if (old) closeAttempt(old);
  else { try { var rr = routeStart(a.video); if (rr && rr.catch) rr.catch(function () {}); } catch (e) {} serviceStart(a.video, "Pulse private talk"); }
  a.t0 = Date.now(); if (a.video) { try { a.stopAdapt = Call.adapt(a.pc); } catch (e) {} }
  if (a.remote) attachRemote(a, a.remote); showCallUi("", a.video); paintMute(); wirePreview(a);
  a.tick = setInterval(function () { $("anCSub").textContent = fmt((Date.now() - a.t0) / 1000); hintTick(a); }, 500);
}
function showCallUi(sub, video) {
  $("anCall").hidden = false; $("anCName").textContent = S ? S.oAlias : ""; $("anCSub").textContent = sub || "0:00";
  $("anRemote").style.display = video ? "block" : "none"; $("anOrb").style.display = video ? "none" : "flex"; $("anOrbT").textContent = T("Voice call · both anonymous", "वॉइस कॉल · दोनों गुमनाम");
  paintVoiceBtn(); $("anMaskBtn").style.display = video ? "" : "none"; $("anVidBtn").style.display = video ? "none" : ""; $("anSelf").hidden = !video; if (!video) $("anTray").hidden = true;
  paintMaskTray();
}
function hideCallUi() { $("anCall").hidden = true; $("anTray").hidden = true; var v = $("anSelf"); v.srcObject = null; v.hidden = true; $("anRemote").srcObject = null; $("anHint").hidden = true; }
function closeCallUi(s) {
  if (s) { clearTimeout(s.offerTimer); closeAttempt(s.cur); closeAttempt(s.nxt); s.cur = s.nxt = null; s.offer = null; }
  hideCallUi(); $("anAsk").hidden = true; try { var r2 = routeStop(); if (r2 && r2.catch) r2.catch(function () {}); } catch (e) {} serviceStop();
}
function endCall(send, note) {
  if (!S) return; var s = S; if (send) sigOut("end").catch(function () {}); closeAttempt(s.cur); closeAttempt(s.nxt); s.cur = s.nxt = null; s.offer = null; clearTimeout(s.offerTimer);
  hideCallUi(); $("anAsk").hidden = true; try { var r2 = routeStop(); if (r2 && r2.catch) r2.catch(function () {}); } catch (e) {} serviceStop(); if (note) C.toast(note);
}
function toggleMute() { var a = S && S.cur; if (!a) return; S.mutedL = !S.mutedL; a.stream.getAudioTracks().forEach(function (t) { t.enabled = !S.mutedL; }); paintMute(); }
function paintMute() { var b = $("anMute"); if (!b || !S) return; b.classList.toggle("on", !!S.mutedL); b.textContent = S.mutedL ? "🔇" : "🎙️"; }
function paintMaskTray() {
  var t = $("anTray"); if (!t) return; var cur = (S && S.cur && S.cur.mask) ? S.cur.mask.style() : (S && S.style) || "venetian";
  t.innerHTML = MASKS.map(function (m) { return '<button type="button" data-m="' + m.id + '" class="' + (m.id === cur ? "on" : "") + '">' + m.e + " " + esc(T(m.en, m.hi)) + "</button>"; }).join("");
  t.querySelectorAll("button").forEach(function (b) { b.addEventListener("click", function () {
    var id = b.getAttribute("data-m");
    if (id === "off" && !(S && S.faceAsk && Date.now() - S.faceAsk < 4000)) { S.faceAsk = Date.now(); C.toast(T("Tap again to show your real face.", "असली चेहरा दिखाने के लिए फिर से टैप करो।")); return; }
    S.style = id; [S.cur, S.nxt].forEach(function (a) { if (a && a.mask) a.mask.setStyle(id); }); paintMaskTray();
  }); });
}
function hintTick(a) {
  var h = $("anHint"); if (!a.mask) { h.hidden = true; return; } var i = a.mask.info(), msg = "";
  if (i === "lost") msg = T("Face not found — the picture stays hidden until your face is back in view.", "चेहरा नहीं मिला — चेहरा वापस आने तक तस्वीर छुपी रहेगी।");
  else if (i === "load" || i === "search") msg = T("Starting privacy mask…", "प्राइवेसी मास्क शुरू हो रहा है…");
  else if (i === "off") msg = T("Your real face is visible right now.", "अभी तुम्हारा असली चेहरा दिख रहा है।");
  h.textContent = msg; h.hidden = !msg;
}

// ---------------------------------------------------------------- lifecycle
function pickBtn() {
  var box = $("supportPickUI") && $("supportPickUI").querySelector(".policy-box"), tp = $("supportTopics"); if (!box || !tp || $("anPickBtn")) return;
  var b = el('<button type="button" id="anPickBtn" class="btn-outline an-pick" style="padding:12px;font-weight:700"></button>'); box.insertBefore(b, tp);
  b.addEventListener("click", function () { $("supportPickUI").hidden = true; openPanel(); }); paintCount();
}
function pageHide() { if (C && P.open) { try { deleteDoc(doc(C.db, "supportOpen", uid())).catch(function () {}); } catch (e) {} } }
export function initAnon(ctx) {
  stopAnon(); C = ctx; css(); shell(); pickBtn(); paintVoiceBtn(); var first = { a: true, b: true };
  G.unsubs.push(watch(query(collection(C.db, "supportOpen"), limit(80)), function (s) {
    var o = {}; s.docs.forEach(function (d) { var x = dd(d); if (d.id !== uid() && openFresh(x)) o[d.id] = x; }); P.others = o; paintCount(); paintPanel();
  }, function () {}));
  G.unsubs.push(watch(query(collection(C.db, "supportReq"), where("to", "==", uid()), limit(20)), function (s) { s.docChanges().forEach(function (ch) { if (ch.type !== "removed") reqChange(ch, true); }); }, function () {}));
  G.unsubs.push(watch(query(collection(C.db, "supportReq"), where("from", "==", uid()), limit(20)), function (s) { s.docChanges().forEach(function (ch) { if (ch.type !== "removed") reqChange(ch, false); }); }, function () {}));
  G.fresh = setInterval(paintCount, 20000); window.addEventListener("pagehide", pageHide);
  window.__pulseAnon = { playerEl: playerEl, openPanel: openPanel, state: function () { return S ? { rid: S.rid, cur: S.cur ? { video: S.cur.video, st: S.cur.pc && S.cur.pc.connectionState, mask: S.cur.mask ? S.cur.mask.info() : null, style: S.cur.mask ? S.cur.mask.style() : null, fx: S.cur.fx ? VFX : null } : null } : null; }, open: function () { return P.open; } };
}
export function stopAnon() {
  if (S) sessionEnd(true); anonRoomClose(); cancelReqQuiet(); hideIncoming(); hideResume(); if (C && P.open) { try { deleteDoc(doc(C.db, "supportOpen", uid())).catch(function () {}); } catch (e) {} }
  P.open = false; P.others = {}; clearInterval(P.tick); clearInterval(G.fresh); window.removeEventListener("pagehide", pageHide);
  G.unsubs.forEach(function (u) { try { u(); } catch (e) {} }); G.unsubs = [];
  if (REC) { REC.cancel = true; try { REC.mr.stop(); } catch (e) {} }
  ["anonUI", "anonSess", "anRec", "anInc", "anOut", "anRes"].forEach(function (i) { var n = $(i); if (n) n.hidden = true; }); C = null;
}
function cancelReqQuiet() { if (OUT) { clearTimeout(OUT.timer); try { updateDoc(doc(C.db, "supportReq", OUT.id), { status: "cancelled", updatedAt: serverTimestamp() }).catch(function () {}); } catch (e) {} OUT = null; } }
