// Support Circles, level 2: voice messages in the circle, and private anonymous 1-to-1 talks (text, voice notes, voice call and
// a masked video call). Nobody sees a name or photo -- only the random alias the circle already uses. Free plan: Firestore
// carries requests/chat/signalling, and the call itself is WebRTC straight between the two phones.
import { doc, updateDoc, setDoc, deleteDoc, collection, addDoc, query, where, orderBy, limit, getDocs, onSnapshot, serverTimestamp } from "firebase/firestore";
import * as Call from "./call.js";
import { createMask, maskSupported, MASKS } from "./mask.js";
import { serviceStart, serviceStop, routeStart, routeStop } from "./audioroute.js";
import { getLang } from "./i18n.js";

var C = null, R = null, S = null, INC = null, OUT = null, G = { unsubs: [] }, REC = null;
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
#anAsk{position:absolute;inset:0;z-index:8;background:rgba(8,6,20,.92);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;text-align:center}#anAsk[hidden]{display:none}\
';

function css() { if ($("anonCss")) return; var s = document.createElement("style"); s.id = "anonCss"; s.textContent = CSS; document.head.appendChild(s); }
function shell() {
  if ($("anonUI")) return;
  document.body.appendChild(el('<div id="anonUI" hidden><div class="an-head"><button type="button" id="anPClose" aria-label="Back">←</button><h2>🔒 ' + esc(T("Private talk", "प्राइवेट बातचीत")) + '</h2></div><div class="an-body" id="anPBody"></div></div>'));
  document.body.appendChild(el('<div id="anonSess" hidden>' +
    '<div class="an-head"><button type="button" id="anSBack" aria-label="Back">←</button><h2><span id="anSName"></span><small>🔒 ' + esc(T("Private & anonymous", "प्राइवेट और गुमनाम")) + '</small></h2>' +
    '<button type="button" id="anSVoice" aria-label="Voice call">📞</button><button type="button" id="anSVideo" aria-label="Video call">🎭</button><button type="button" id="anSMenu" aria-label="End">⋯</button></div>' +
    '<div class="an-msgs" id="anSMsgs"></div>' +
    '<div class="an-comp"><button type="button" class="an-ic" id="anSMic" aria-label="Voice message">🎤</button><input id="anSInput" maxlength="500" autocomplete="off" placeholder="' + esc(T("Write anonymously…", "गुमनाम होकर लिखो…")) + '"><button type="button" class="an-ic go" id="anSSend" aria-label="Send">➤</button></div>' +
    '<div id="anCall" hidden><video id="anRemote" autoplay playsinline></video><div id="anOrb"><div class="o">💜</div><div id="anOrbT" style="font-size:15px;opacity:.9"></div></div>' +
    '<div class="top"><b id="anCName"></b><span id="anCSub"></span></div><video id="anSelf" autoplay playsinline muted hidden></video><div class="hint" id="anHint" hidden></div>' +
    '<div id="anTray" hidden></div><div id="anCtl"><button type="button" id="anMute" aria-label="Mute">🎙️</button><button type="button" id="anMaskBtn" aria-label="Mask">🎭</button><button type="button" id="anVidBtn" aria-label="Video">📹</button><button type="button" class="end" id="anEnd" aria-label="End call">✕</button></div></div>' +
    '<div id="anAsk" hidden><div style="font-size:54px">📞</div><div id="anAskT" style="font-size:17px;font-weight:700"></div><div id="anAskS" style="font-size:13px;opacity:.8;max-width:280px"></div><div style="display:flex;gap:12px"><button type="button" class="an-btn red" id="anAskNo">' + esc(T("Decline", "मना करो")) + '</button><button type="button" class="an-btn" id="anAskYes">' + esc(T("Accept", "स्वीकारो")) + '</button></div></div>' +
    '</div>'));
  document.body.appendChild(el('<div id="anRec" hidden><span class="dot"></span><b id="anRecT">0:00</b><button type="button" class="an-btn alt" id="anRecX">' + esc(T("Cancel", "रद्द")) + '</button><button type="button" class="an-btn" id="anRecOk">' + esc(T("Send", "भेजो")) + '</button></div>'));
  document.body.appendChild(el('<div id="anInc" hidden></div>'));
  $("anPClose").addEventListener("click", function () { $("anonUI").hidden = true; });
  $("anSBack").addEventListener("click", sessionMinimize);
  $("anSMenu").addEventListener("click", sessionMenu);
  $("anSSend").addEventListener("click", sessionSend); $("anSInput").addEventListener("keydown", function (e) { if (e.key === "Enter") sessionSend(); });
  $("anSMic").addEventListener("click", function () { recStart(function (url, dur) { return sessionSendAudio(url, dur); }); });
  $("anSVoice").addEventListener("click", function () { callStart(false); }); $("anSVideo").addEventListener("click", function () { callStart(true); });
  $("anEnd").addEventListener("click", function () { endCall(true); });
  $("anMute").addEventListener("click", toggleMute); $("anMaskBtn").addEventListener("click", function () { var t = $("anTray"); t.hidden = !t.hidden; });
  $("anVidBtn").addEventListener("click", function () { callStart(true); });
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
    var mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].filter(function (m) { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } })[0], mr;
    try { mr = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 22000 } : { audioBitsPerSecond: 22000 }); } catch (e) { stream.getTracks().forEach(function (t) { t.stop(); }); C.toast(T("Recording failed to start.", "रिकॉर्डिंग शुरू नहीं हो पाई।")); return; }
    var chunks = [], t0 = Date.now(), r = REC = { mr: mr, stream: stream, cancel: false, tick: null };
    mr.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
    mr.onstop = function () {
      clearInterval(r.tick); stream.getTracks().forEach(function (t) { t.stop(); }); $("anRec").hidden = true; if (REC === r) REC = null;
      var dur = (Date.now() - t0) / 1000; if (r.cancel) return;
      if (dur < 0.7) { C.toast(T("Too short — hold on a little longer.", "बहुत छोटा — थोड़ा और बोलो।")); return; }
      var blob = new Blob(chunks, { type: mr.mimeType || mime || "audio/webm" }), fr = new FileReader();
      fr.onload = function () { var url = String(fr.result); if (url.length > 280000) { C.toast(T("Voice note is too long. Keep it under 40 seconds.", "वॉइस नोट बहुत लंबा है। 40 सेकंड से कम रखो।")); return; } Promise.resolve(send(url, Math.round(dur))).catch(function (e) { C.toast(C.errMsg(e)); }); };
      fr.readAsDataURL(blob);
    };
    mr.start(500); $("anRec").hidden = false; $("anRecT").textContent = "0:00";
    r.tick = setInterval(function () { var s = (Date.now() - t0) / 1000; $("anRecT").textContent = fmt(s); if (s >= 40) { try { mr.stop(); } catch (e) {} } }, 250);
    $("anRecX").onclick = function () { r.cancel = true; try { mr.stop(); } catch (e) {} };
    $("anRecOk").onclick = function () { try { mr.stop(); } catch (e) {} };
  }).catch(function (e) { C.toast(/denied|NotAllowed|Permission/i.test(String(e && (e.name || e.message))) ? T("Microphone access is off. Allow it in Settings.", "माइक की अनुमति बंद है। सेटिंग्स में चालू करो।") : C.errMsg(e)); });
}

// ---------------------------------------------------------------- circle (room) hooks
function openFresh(x) { var t = x && x.t ? ms(x.t) : 0; return Date.now() - t < 90000; }
export function anonRoomOpen(room, alias, name) {
  if (!C) return; anonRoomClose(); R = { room: room, alias: alias, name: name, open: false, others: {}, unsubs: [] };
  var head = $("support") && $("support").querySelector(".convo-head"), comp = $("support") && $("support").querySelector(".convo-input");
  if (head && !$("anLock")) { var b = el('<button type="button" id="anLock" class="icon-btn" aria-label="Private talk" style="position:relative;font-size:20px">🔒<small id="anLockN" style="position:absolute;top:-2px;right:-2px;background:#12B886;color:#fff;border-radius:99px;font:700 10px var(--font-body);padding:1px 5px" hidden></small></button>'); head.appendChild(b); b.addEventListener("click", openPanel); }
  if (comp && !$("anMic")) { var m = el('<button type="button" id="anMic" class="icon-btn" aria-label="Voice message" style="font-size:20px">🎤</button>'), sd = $("supportSend"); comp.insertBefore(m, sd); m.addEventListener("click", function () { var rr = R; if (!rr) return; if (!C.rate("scvoice", 4, 60000)) return; recStart(function (url, dur) { return addDoc(collection(C.db, "supportRooms", rr.room, "msgs"), { from: uid(), alias: rr.alias, text: "🎤 " + T("Voice message", "वॉइस संदेश"), audio: url, dur: dur, createdAt: serverTimestamp() }); }); }); }
  R.unsubs.push(onSnapshot(query(collection(C.db, "supportRooms", room, "open"), limit(60)), function (s) {
    var o = {}; s.docs.forEach(function (d) { var x = dd(d); if (d.id !== uid() && openFresh(x)) o[d.id] = x; }); R.others = o; paintCount(); if (!$("anonUI").hidden) paintPanel();
  }, function () {}));
  R.tick = setInterval(function () { if (R && R.open) setDoc(doc(C.db, "supportRooms", R.room, "open", uid()), { alias: R.alias, t: serverTimestamp() }).catch(function () {}); if (R) { paintCount(); } }, 30000);
}
export function anonRoomClose() {
  if (!R) return; var r = R; R = null; clearInterval(r.tick); r.unsubs.forEach(function (u) { try { u(); } catch (e) {} });
  if (r.open && C) deleteDoc(doc(C.db, "supportRooms", r.room, "open", uid())).catch(function () {});
  if ($("anonUI")) $("anonUI").hidden = true; var l = $("anLock"), m = $("anMic"); if (l) l.remove(); if (m) m.remove();
}
function paintCount() { var n = R ? Object.keys(R.others).filter(function (k) { return openFresh(R.others[k]); }).length : 0, b = $("anLockN"); if (b) { b.textContent = n; b.hidden = !n; } }
function setOpen(on) {
  if (!R) return; R.open = on; var ref = doc(C.db, "supportRooms", R.room, "open", uid());
  (on ? setDoc(ref, { alias: R.alias, t: serverTimestamp() }) : deleteDoc(ref)).catch(function (e) { C.toast(C.errMsg(e)); }); paintPanel();
}
function openPanel() { if (!R) return; $("anonUI").hidden = false; paintPanel(); }
function paintPanel() {
  var b = $("anPBody"); if (!b || !R) return; var keys = Object.keys(R.others).filter(function (k) { return openFresh(R.others[k]); });
  var h = '<div class="an-card"><h3>' + esc(T("Talk to one person, privately", "किसी एक से प्राइवेट बात करो")) + '</h3><p>' + esc(T("Both of you stay anonymous — only your random aliases show. You can chat, send voice notes, call, and even switch to video with a mask over your face. Share no real name, number or location. End or report any time.", "दोनों गुमनाम रहते हो — सिर्फ़ रैंडम alias दिखता है। चैट, वॉइस नोट, कॉल और चेहरे पर मास्क के साथ वीडियो भी कर सकते हो। असली नाम, नंबर या लोकेशन मत बताओ। कभी भी खत्म या रिपोर्ट करो।")) + '</p>' +
    '<div class="an-sw' + (R.open ? ' on' : '') + '" id="anSw"><span>🔓 ' + esc(T("I’m open for a private talk", "मैं प्राइवेट बात के लिए तैयार हूँ")) + '</span><i></i></div>';
  if (OUT) h += '<div class="an-row"><div class="av">⏳</div><b>' + esc(T("Waiting for ", "इंतज़ार: ")) + esc(OUT.alias) + '…</b><button type="button" class="an-btn alt" id="anCancelReq">' + esc(T("Cancel", "रद्द")) + '</button></div>';
  h += '</div><div class="an-card"><h3>' + esc(T("Open right now", "अभी उपलब्ध")) + '</h3>';
  if (!keys.length) h += '<div class="an-empty">' + esc(T("No one is open at the moment. Turn yours on so others can reach you.", "अभी कोई उपलब्ध नहीं। अपना चालू करो ताकि दूसरे तुम तक पहुँच सकें।")) + '</div>';
  keys.forEach(function (k) { h += '<div class="an-row"><div class="av">💜</div><b>' + esc(R.others[k].alias || "Someone") + '</b><button type="button" class="an-btn" data-ask="' + esc(k) + '">' + esc(T("Ask to talk", "बात का अनुरोध")) + '</button></div>'; });
  b.innerHTML = h + '</div>';
  $("anSw").addEventListener("click", function () { setOpen(!R.open); });
  var cr = $("anCancelReq"); if (cr) cr.addEventListener("click", cancelReq);
  b.querySelectorAll("[data-ask]").forEach(function (x) { x.addEventListener("click", function () { ask(x.getAttribute("data-ask")); }); });
}

// ---------------------------------------------------------------- requests
function ask(toUid) {
  if (!R || OUT || S) return; var o = R.others[toUid]; if (!o) return; if (!C.rate("anreq", 4, 60000)) return;
  addDoc(collection(C.db, "supportReq"), { from: uid(), to: toUid, fromAlias: R.alias, toAlias: String(o.alias || "").slice(0, 30), room: R.room, status: "pending", createdAt: serverTimestamp() }).then(function (r) {
    OUT = { id: r.id, alias: String(o.alias || ""), room: R.room, at: Date.now() }; paintPanel();
    OUT.timer = setTimeout(function () { if (OUT && OUT.id === r.id) { C.toast(T("No reply yet — try again later.", "अभी जवाब नहीं आया — बाद में कोशिश करो।")); cancelReq(); } }, 120000);
  }).catch(function (e) { C.toast(C.errMsg(e)); });
}
function cancelReq() { if (!OUT) return; var o = OUT; OUT = null; clearTimeout(o.timer); updateDoc(doc(C.db, "supportReq", o.id), { status: "cancelled", updatedAt: serverTimestamp() }).catch(function () {}); paintPanel(); }
function showIncoming(id, x) {
  if (INC || S) { updateDoc(doc(C.db, "supportReq", id), { status: "declined", updatedAt: serverTimestamp() }).catch(function () {}); return; }
  INC = { id: id, x: x }; var b = $("anInc");
  b.innerHTML = '<p>🔒 <b>' + esc(x.fromAlias || "Someone") + '</b> ' + esc(T("would like to talk privately and anonymously. Both of you stay hidden.", "प्राइवेट और गुमनाम बात करना चाहते हैं। दोनों छुपे रहोगे।")) + '</p><div class="an-r"><button type="button" class="an-btn alt" id="anIncNo">' + esc(T("Not now", "अभी नहीं")) + '</button><button type="button" class="an-btn" id="anIncYes">' + esc(T("Accept", "स्वीकारो")) + '</button></div>';
  b.hidden = false; INC.timer = setTimeout(hideIncoming, 115000);
  $("anIncNo").onclick = function () { var i = INC; hideIncoming(); if (i) updateDoc(doc(C.db, "supportReq", i.id), { status: "declined", updatedAt: serverTimestamp() }).catch(function () {}); };
  $("anIncYes").onclick = function () { var i = INC; hideIncoming(); if (!i) return; updateDoc(doc(C.db, "supportReq", i.id), { status: "accepted", updatedAt: serverTimestamp() }).then(function () { openSession(i.id, i.x.from, i.x.fromAlias, i.x.toAlias); }).catch(function (e) { C.toast(C.errMsg(e)); }); };
}
function hideIncoming() { if (INC) clearTimeout(INC.timer); INC = null; var b = $("anInc"); if (b) { b.hidden = true; b.innerHTML = ""; } }
function reqChange(ch, inbound) {
  var x = dd(ch.doc), id = ch.doc.id, age = Date.now() - ms(x.createdAt);
  if (x.status === "pending" && inbound && ch.type === "added" && age < 120000) showIncoming(id, x);
  else if (x.status === "cancelled" && inbound) { if (INC && INC.id === id) hideIncoming(); deleteDoc(ch.doc.ref).catch(function () {}); }
  else if (x.status === "accepted" && !inbound && OUT && OUT.id === id) { var o = OUT; OUT = null; clearTimeout(o.timer); openSession(id, x.to, x.toAlias, x.fromAlias); }
  else if (x.status === "declined" && !inbound) { if (OUT && OUT.id === id) { clearTimeout(OUT.timer); OUT = null; C.toast(T("They are not available right now.", "वे अभी उपलब्ध नहीं हैं।")); if (R && !$("anonUI").hidden) paintPanel(); } deleteDoc(ch.doc.ref).catch(function () {}); }
  else if (x.status === "ended" && x.endedBy !== uid()) { if (S && S.rid === id) sessionEnd(false, T("The other person ended the talk.", "दूसरे ने बातचीत खत्म कर दी।")); deleteDoc(ch.doc.ref).catch(function () {}); }
}

// ---------------------------------------------------------------- private session
function openSession(rid, other, otherAlias, myAlias) {
  if (S) return; if (!$("anonUI").hidden) $("anonUI").hidden = true;
  S = { rid: rid, other: other, oAlias: otherAlias || "Someone", alias: myAlias || "Me", unsubs: [], cur: null, nxt: null, offer: null, mutedL: false };
  $("anSName").textContent = S.oAlias; $("anSMsgs").innerHTML = ""; $("anonSess").hidden = false; $("anSInput").value = "";
  paintMaskTray();
  S.unsubs.push(onSnapshot(query(collection(C.db, "supportReq", rid, "msgs"), orderBy("createdAt", "asc"), limit(80)), function (s) {
    var box = $("anSMsgs"); if (!box || !S || S.rid !== rid) return; box.innerHTML = '<div class="an-note">' + esc(T("Say hi. Only aliases are visible here. When the talk ends, this chat is erased.", "नमस्ते कहो। यहाँ सिर्फ़ alias दिखते हैं। बातचीत खत्म होते ही चैट मिट जाती है।")) + '</div>';
    s.docs.forEach(function (d) { var m = dd(d), mine = m.from === uid(), b = el('<div class="an-m ' + (mine ? "me" : "") + '"></div>'); if (m.audio) b.appendChild(playerEl(m.audio, m.dur)); else b.textContent = m.text || ""; box.appendChild(b); });
    box.scrollTop = 1e9;
  }, function (e) { C.toast(C.errMsg(e)); }));
  S.unsubs.push(onSnapshot(query(collection(C.db, "supportReq", rid, "sig"), where("to", "==", uid())), function (s) {
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
  if (!S) return; var n = $("anInc"); n.innerHTML = '<p>' + esc(T("Private talk options", "प्राइवेट बातचीत के विकल्प")) + '</p><div class="an-r"><button type="button" class="an-btn alt" id="anMenuX">' + esc(T("Close", "बंद")) + '</button><button type="button" class="an-btn red" id="anMenuRep">' + esc(T("Report & end", "रिपोर्ट करो और खत्म")) + '</button><button type="button" class="an-btn" id="anMenuEnd">' + esc(T("End talk", "बातचीत खत्म")) + '</button></div>'; n.hidden = false;
  $("anMenuX").onclick = function () { n.hidden = true; }; $("anMenuEnd").onclick = function () { n.hidden = true; sessionEnd(true); };
  $("anMenuRep").onclick = function () { n.hidden = true; var s = S; if (!s) return; addDoc(collection(C.db, "reports"), { from: uid(), against: s.other, reason: "support-private", rid: s.rid, createdAt: serverTimestamp() }).catch(function () {}); C.toast(T("Reported. Thank you for keeping this safe.", "रिपोर्ट हो गई। सुरक्षित रखने के लिए शुक्रिया।")); sessionEnd(true); };
}
function sessionEnd(notify, note) {
  if (!S) return; var s = S; S = null; closeCallUi(s); s.unsubs.forEach(function (u) { try { u(); } catch (e) {} });
  $("anonSess").hidden = true; $("anInc").hidden = true;
  if (notify) {
    updateDoc(doc(C.db, "supportReq", s.rid), { status: "ended", endedBy: uid(), updatedAt: serverTimestamp() }).catch(function () {});
    ["msgs", "sig"].forEach(function (sub) { getDocs(query(collection(C.db, "supportReq", s.rid, sub), limit(100))).then(function (q) { q.docs.forEach(function (d) { deleteDoc(d.ref).catch(function () {}); }); }).catch(function () {}); });
  }
  if (note) C.toast(note);
}

// ---------------------------------------------------------------- calls (voice, then masked video)
function sigOut(kind, extra) { if (!S) return Promise.resolve(); return addDoc(collection(C.db, "supportReq", S.rid, "sig"), Object.assign({ from: uid(), to: S.other, kind: kind, createdAt: serverTimestamp() }, extra || {})); }
function media(video) {
  return Call.getMedia(video).then(function (raw) {
    if (!video) return { raw: raw, stream: raw, mask: null };
    var mk = createMask(raw, { style: S && S.style || "venetian" });
    if (!mk) { raw.getTracks().forEach(function (t) { t.stop(); }); throw new Error(T("This phone can’t mask video, so only voice calls are available.", "यह फ़ोन वीडियो पर मास्क नहीं लगा सकता, इसलिए सिर्फ़ वॉइस कॉल हो सकती है।")); }
    return { raw: raw, stream: mk.stream, mask: mk };
  });
}
function attempt(video, role, m) { return { video: video, role: role, raw: m.raw, stream: m.stream, mask: m.mask, pc: null, remote: null, t0: Date.now(), stopAdapt: null, timer: null }; }
function closeAttempt(a) {
  if (!a) return; clearTimeout(a.timer); clearInterval(a.tick); try { a.stopAdapt && a.stopAdapt(); } catch (e) {} try { a.pc && a.pc.close(); } catch (e) {}
  try { a.mask && a.mask.stop(); } catch (e) {} [a.raw, a.stream].forEach(function (s) { try { s && s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} });
}
function callStart(video) {
  if (!S) return; if (S.nxt || S.offer) { C.toast(T("A call is already being set up.", "कॉल पहले से जुड़ रही है।")); return; }
  if (!Call.supported()) { C.toast(T("Calls are not supported on this device.", "इस डिवाइस पर कॉल नहीं चलेगी।")); return; }
  if (video && !maskSupported()) { C.toast(T("This phone can’t mask video, so only voice calls are available.", "यह फ़ोन वीडियो पर मास्क नहीं लगा सकता, इसलिए सिर्फ़ वॉइस कॉल हो सकती है।")); return; }
  var s = S, tag = {}; s.nxt = tag; showCallUi(video ? T("Calling with video…", "वीडियो कॉल हो रही है…") : T("Calling…", "कॉल हो रही है…"), !!video);
  media(video).then(function (m) {
    if (S !== s || s.nxt !== tag) { closeAttempt({ raw: m.raw, stream: m.stream, mask: m.mask }); return null; }
    var a = attempt(video, "caller", m); s.nxt = a; wirePreview(a);
    return Call.makeOffer(a.stream, function (st) { attachRemote(a, st); }, function (st) { attState(a, st); }).then(function (o) {
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
    if (S !== s || s.nxt !== tag) { closeAttempt({ raw: m.raw, stream: m.stream, mask: m.mask }); return null; }
    var a = attempt(!!x.video, "callee", m); s.nxt = a; wirePreview(a);
    return Call.makeAnswer(a.stream, x.sdp, function (st) { attachRemote(a, st); }, function (st) { attState(a, st); }).then(function (r) {
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
  if (old) { try { old.pc && old.pc.close(); } catch (e) {} old.mask && old.mask.stop(); [old.raw, old.stream].forEach(function (s) { try { s && s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }); clearInterval(old.tick); try { old.stopAdapt && old.stopAdapt(); } catch (e) {} }
  else { try { var rr = routeStart(a.video); if (rr && rr.catch) rr.catch(function () {}); } catch (e) {} serviceStart(a.video, "Pulse private talk"); }
  a.t0 = Date.now(); if (a.video) { try { a.stopAdapt = Call.adapt(a.pc); } catch (e) {} }
  if (a.remote) attachRemote(a, a.remote); showCallUi("", a.video); paintMute(); wirePreview(a);
  a.tick = setInterval(function () { $("anCSub").textContent = fmt((Date.now() - a.t0) / 1000); hintTick(a); }, 500);
}
function showCallUi(sub, video) {
  $("anCall").hidden = false; $("anCName").textContent = S ? S.oAlias : ""; $("anCSub").textContent = sub || "0:00";
  $("anRemote").style.display = video ? "block" : "none"; $("anOrb").style.display = video ? "none" : "flex"; $("anOrbT").textContent = T("Voice call · both anonymous", "वॉइस कॉल · दोनों गुमनाम");
  $("anMaskBtn").style.display = video ? "" : "none"; $("anVidBtn").style.display = video ? "none" : ""; $("anSelf").hidden = !video; if (!video) $("anTray").hidden = true;
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
function toggleMute() { var a = S && S.cur; if (!a) return; S.mutedL = !S.mutedL; (a.raw || a.stream).getAudioTracks().forEach(function (t) { t.enabled = !S.mutedL; }); paintMute(); }
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
  if (i === "guide") msg = T("Face tracking isn’t available on this phone — keep your face inside the middle of the picture.", "इस फ़ोन पर फेस ट्रैकिंग नहीं है — चेहरा तस्वीर के बीच में रखो।");
  else if (i === "lost") msg = T("Face not found — picture is hidden until you’re back in view.", "चेहरा नहीं मिला — वापस आने तक तस्वीर छुपी है।");
  else if (i === "off") msg = T("Your real face is visible right now.", "अभी तुम्हारा असली चेहरा दिख रहा है।");
  h.textContent = msg; h.hidden = !msg;
}

// ---------------------------------------------------------------- lifecycle
export function initAnon(ctx) {
  stopAnon(); C = ctx; css(); shell();
  G.unsubs.push(onSnapshot(query(collection(C.db, "supportReq"), where("to", "==", uid()), limit(20)), function (s) { s.docChanges().forEach(function (ch) { if (ch.type !== "removed") reqChange(ch, true); }); }, function () {}));
  G.unsubs.push(onSnapshot(query(collection(C.db, "supportReq"), where("from", "==", uid()), limit(20)), function (s) { s.docChanges().forEach(function (ch) { if (ch.type !== "removed") reqChange(ch, false); }); }, function () {}));
  window.__pulseAnon = { playerEl: playerEl, state: function () { return S ? { rid: S.rid, cur: S.cur ? { video: S.cur.video, st: S.cur.pc && S.cur.pc.connectionState, mask: S.cur.mask ? S.cur.mask.info() : null, style: S.cur.mask ? S.cur.mask.style() : null } : null } : null; } };
}
export function stopAnon() {
  if (S) sessionEnd(true); anonRoomClose(); cancelReqQuiet(); hideIncoming(); G.unsubs.forEach(function (u) { try { u(); } catch (e) {} }); G.unsubs = [];
  if (REC) { REC.cancel = true; try { REC.mr.stop(); } catch (e) {} }
  ["anonUI", "anonSess", "anRec", "anInc"].forEach(function (i) { var n = $(i); if (n) n.hidden = true; }); C = null;
}
function cancelReqQuiet() { if (OUT) { clearTimeout(OUT.timer); try { updateDoc(doc(C.db, "supportReq", OUT.id), { status: "cancelled", updatedAt: serverTimestamp() }).catch(function () {}); } catch (e) {} OUT = null; } }
