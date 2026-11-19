// App shell extras: first-launch agreement, "Install app" banner, minimise-while-in-a-call, and the device registry that lets the
// owner see which devices use Pulse and lock / wipe / remove Pulse on one device. Everything works on the free plan: the device
// checks its own command document (deviceCmd/<id>) while it is open and online. A web page or app can never be deleted silently
// from afar -- "remove" opens Android's own uninstall dialog, and "wipe" erases Pulse's data on that device and signs it out.
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection, query, where, limit, serverTimestamp, onSnapshot, updateDoc } from "firebase/firestore";
import { getAuth, signOut } from "firebase/auth";
import { getLang } from "./i18n.js";
import { uninstallSelf } from "./audioroute.js";

function T(en, h) { return getLang() !== "en" ? h : en; }
function $(id) { return document.getElementById(id); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
var native = false; try { native = !!(window.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform()); } catch (e) {}
var VER = "1"; try { var m = document.querySelector('script[src*="app.js"]'); VER = (m && (m.getAttribute("src").split("v=")[1] || "1")) || "1"; } catch (e) {}

function deviceId() {
  var d = ls("pulse_device");
  if (!d || !/^[A-Za-z0-9]{16,40}$/.test(d)) {
    var a = new Uint8Array(18); (window.crypto || window.msCrypto).getRandomValues(a);
    d = Array.prototype.map.call(a, function (x) { return "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]; }).join(""); ls("pulse_device", d);
  }
  return d;
}

var STYLE = '#pxGate,#pxLock{position:fixed;inset:0;z-index:100000;background:#0E1626;color:#fff;display:flex;align-items:center;justify-content:center;padding:20px;font-family:system-ui,sans-serif}' +
  '#pxGate[hidden],#pxLock[hidden]{display:none}.px-box{max-width:440px;width:100%;max-height:96vh;overflow:auto}.px-box h2{margin:0 0 10px;font-size:21px}.px-box p,.px-box li{font-size:14px;line-height:1.5;opacity:.92}' +
  '.px-box ul{padding-left:18px;margin:8px 0 14px}.px-btn{display:block;width:100%;padding:14px;border:0;border-radius:14px;background:#7c5cff;color:#fff;font-size:16px;font-weight:700;margin-top:10px}.px-btn.alt{background:rgba(255,255,255,.12)}' +
  '#pxInstall{position:fixed;left:10px;right:10px;bottom:calc(76px + env(safe-area-inset-bottom,0px));z-index:9000;background:#1b2740;color:#fff;border-radius:16px;padding:12px 14px;display:flex;gap:10px;align-items:center;box-shadow:0 8px 28px rgba(0,0,0,.4);font:14px system-ui}' +
  '#pxInstall[hidden]{display:none}#pxInstall span{flex:1}#pxInstall button{border:0;border-radius:10px;padding:9px 13px;font-weight:700}#pxInstall .go{background:#7c5cff;color:#fff}#pxInstall .no{background:transparent;color:#fff;opacity:.7}' +
  /* minimise: the call keeps running as a small window while the rest of the app stays usable */
  '.callui.mini{inset:auto;top:calc(env(safe-area-inset-top,0px) + 10px);right:10px;left:auto;width:158px;border-radius:18px;background:#14102a;backdrop-filter:none;box-shadow:0 8px 28px rgba(0,0,0,.5);z-index:95;overflow:hidden}' +
  '.callui.mini .callbox{position:relative!important;inset:auto!important;padding:8px 10px;height:auto!important;max-width:none;display:block!important;text-align:left}' +
  '.callui.mini .callbox>*:not(.call-top):not(.call-actions):not(#callAudio):not(.call-video-wrap){display:none!important}' +
  '.callui.mini .call-top{position:static!important;padding:0!important}.callui.mini .call-top h3{font-size:14px;margin:0}.callui.mini .call-sub{font-size:12px;margin:0;min-height:0}.callui.mini .ct-badge{display:none}' +
  '.callui.mini .call-video-wrap{position:relative!important;inset:auto!important;width:100%;height:96px;margin-top:6px;border-radius:10px;overflow:hidden}.callui.mini #callLocalVideo,.callui.mini .call-watermark,.callui.mini .call-fxlayer{display:none!important}' +
  '.callui.mini:not(.video-on) .call-video-wrap{display:none!important}' +
  '.callui.mini .call-actions{position:static!important;display:flex!important;gap:8px;margin-top:8px;padding:0!important;justify-content:flex-start}.callui.mini .cbtn{width:38px!important;height:38px!important;min-width:0}' +
  '.callui.mini .call-actions{background:none!important}.callui.mini .cbtn>:not(.ic){display:none!important}' +
  '.callui.mini .cbtn:not(#callMute):not(#callEnd){display:none!important}' +
  '#pxMin{position:absolute;top:calc(env(safe-area-inset-top,0px) + 12px);left:12px;z-index:5;border:0;border-radius:50%;width:38px;height:38px;background:rgba(255,255,255,.16);color:#fff;font-size:20px}.callui.mini #pxMin{display:none}' +
  /* private-talk call */
  '#anCall.mini{inset:auto 0 auto 0;height:44px;overflow:hidden;background:#2b1f5c!important;flex-direction:row;align-items:center;cursor:pointer}#anCall.mini>*:not(.top){display:none!important}#anCall.mini .top{padding:6px 14px!important;text-align:left;flex:1;display:flex;gap:10px;align-items:baseline}#anCall.mini .top small{display:none!important}' +
  '#pxAnMin{position:absolute;top:calc(var(--sa-top,0px) + 14px);left:12px;z-index:6;border:0;border-radius:50%;width:36px;height:36px;background:rgba(255,255,255,.16);color:#fff;font-size:19px}#anCall.mini #pxAnMin{display:none}';

function style() { if ($("pxStyle")) return; var s = document.createElement("style"); s.id = "pxStyle"; s.textContent = STYLE; document.head.appendChild(s); }

// ---- first-launch agreement: nothing starts until the person says OK ----
function gate() {
  if (ls("pulse_terms_ok") === "2") return;
  var g = document.createElement("div"); g.id = "pxGate";
  function paint(declined) {
    g.innerHTML = '<div class="px-box"><h2>' + esc(T("Before you start", "शुरू करने से पहले")) + '</h2>' +
      '<p>' + esc(T("To keep Pulse safe, this device is registered with a random device ID.", "Pulse को सुरक्षित रखने के लिए यह डिवाइस एक रैंडम डिवाइस ID से दर्ज होता है।")) + '</p><ul>' +
      '<li>' + esc(T("What we record: device ID, your account ID, app version, language, time zone, device type and when it was last used. No contacts, no messages, no precise location.", "हम क्या दर्ज करते हैं: डिवाइस ID, तुम्हारा अकाउंट ID, ऐप वर्ज़न, भाषा, टाइम ज़ोन, डिवाइस का प्रकार और आख़िरी बार कब चला। कॉन्टैक्ट, संदेश या सटीक लोकेशन नहीं।")) + '</li>' +
      '<li>' + esc(T("Why: abuse and fraud prevention, security, and support.", "क्यों: दुरुपयोग और धोखाधड़ी रोकना, सुरक्षा और सहायता।")) + '</li>' +
      '<li>' + esc(T("Control: if there is abuse, the Pulse owner can lock Pulse on this device, erase Pulse’s data from it, or ask Android to remove the app (you will still see Android’s confirm button). This works while the app is online.", "नियंत्रण: दुरुपयोग होने पर Pulse के मालिक इस डिवाइस पर Pulse लॉक कर सकते हैं, इससे Pulse का डेटा मिटा सकते हैं, या Android से ऐप हटाने को कह सकते हैं (Android का पुष्टि बटन तुम्हें दिखेगा)। यह ऐप के ऑनलाइन रहने पर चलता है।")) + '</li>' +
      '<li>' + esc(T("You must be 18 or older. By continuing you agree to the Terms and Privacy Policy and to the points above.", "तुम्हारी उम्र 18+ होनी चाहिए। आगे बढ़कर तुम शर्तों, प्राइवेसी नीति और ऊपर की बातों से सहमत होते हो।")) + '</li></ul>' +
      (declined ? '<p style="color:#ffb4b4">' + esc(T("Pulse can’t run without this agreement.", "इस सहमति के बिना Pulse नहीं चल सकता।")) + '</p>' : "") +
      '<button type="button" class="px-btn" id="pxOk">' + esc(T("OK, I agree and I am 18+", "ठीक है, मैं सहमत हूँ और मैं 18+ हूँ")) + '</button><button type="button" class="px-btn alt" id="pxNo">' + esc(T("No", "नहीं")) + '</button></div>';
    $("pxOk").onclick = function () { ls("pulse_terms_ok", "2"); g.remove(); register(); };
    $("pxNo").onclick = function () { paint(true); };
  }
  document.body.appendChild(g); paint(false);
}

// ---- Install app banner (web only; the Android app is already installed) ----
var deferred = null;
function installBanner() {
  if (native) return;
  var standalone = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone;
  if (standalone) return;
  var until = parseInt(ls("pulse_inst_later") || "0", 10); if (until > Date.now()) return;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  function show(textEn, textHi, canInstall) {
    if ($("pxInstall")) return;
    var b = document.createElement("div"); b.id = "pxInstall";
    b.innerHTML = '<span>📲 ' + esc(T(textEn, textHi)) + '</span>' + (canInstall ? '<button type="button" class="go" id="pxInstGo">' + esc(T("Install", "इंस्टॉल")) + '</button>' : '') + '<button type="button" class="no" id="pxInstNo">' + esc(T("Later", "बाद में")) + '</button>';
    document.body.appendChild(b);
    $("pxInstNo").onclick = function () { ls("pulse_inst_later", String(Date.now() + 7 * 864e5)); b.remove(); };
    if (canInstall) $("pxInstGo").onclick = function () { var d = deferred; deferred = null; b.remove(); if (d) { d.prompt(); d.userChoice.then(function () {}, function () {}); } };
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; setTimeout(function () { if (document.getElementById("pxGate")) { var t = setInterval(function () { if (!document.getElementById("pxGate")) { clearInterval(t); show("Install Pulse on your phone — opens like an app.", "Pulse अपने फ़ोन में इंस्टॉल करो — ऐप की तरह खुलेगा।", true); } }, 700); } else show("Install Pulse on your phone — opens like an app.", "Pulse अपने फ़ोन में इंस्टॉल करो — ऐप की तरह खुलेगा।", true); }, 2500); });
  window.addEventListener("appinstalled", function () { var b = $("pxInstall"); if (b) b.remove(); });
  if (ios) setTimeout(function () { if (!document.getElementById("pxGate")) show("To install: tap Share, then “Add to Home Screen”.", "इंस्टॉल करने के लिए: Share दबाओ, फिर “Add to Home Screen”।", false); }, 6000);
}

// ---- minimise a call ----
function miniButtons() {
  var cu = $("callUI");
  if (cu && !$("pxMin")) {
    var b = document.createElement("button"); b.id = "pxMin"; b.type = "button"; b.textContent = "⌄"; b.setAttribute("aria-label", "Minimise call");
    cu.querySelector(".callbox").appendChild(b);
    b.onclick = function (e) { e.stopPropagation(); var acc = $("callAccept"); if (acc && !acc.hidden) return; cu.classList.add("mini"); };
    cu.addEventListener("click", function (e) { if (cu.classList.contains("mini") && !e.target.closest(".call-actions")) cu.classList.remove("mini"); });
    new MutationObserver(function () { if (cu.hidden) cu.classList.remove("mini"); else { var acc = $("callAccept"); if (acc && !acc.hidden) cu.classList.remove("mini"); } }).observe(cu, { attributes: true, subtree: true, attributeFilter: ["hidden"] });
  }
  var ac = $("anCall");
  if (ac && !$("pxAnMin")) {
    var c = document.createElement("button"); c.id = "pxAnMin"; c.type = "button"; c.textContent = "⌄"; c.setAttribute("aria-label", "Minimise call");
    ac.appendChild(c);
    c.onclick = function (e) { e.stopPropagation(); var h = document.querySelector("#anonSess .an-head"); ac.style.top = h ? Math.round(h.getBoundingClientRect().bottom - ac.parentNode.getBoundingClientRect().top) + "px" : "58px"; ac.classList.add("mini"); };
    ac.addEventListener("click", function (e) { if (ac.classList.contains("mini") && !e.target.closest("button")) { ac.classList.remove("mini"); ac.style.top = ""; } });
    new MutationObserver(function () { if (ac.hidden) ac.classList.remove("mini"); }).observe(ac, { attributes: true, attributeFilter: ["hidden"] });
  }
}

// ---- device registry + owner commands ----
var DB = null, UIDF = null, cmdUn = null, regTimer = null;
function register() {
  if (!DB || ls("pulse_terms_ok") !== "2") return;
  var uid = UIDF && UIDF(); if (!uid) return;
  var id = deviceId();
  var rec = { uid: uid, app: native ? "android" : "web", ver: String(VER).slice(0, 30), lang: String(getLang()).slice(0, 10), tz: "", ua: String(navigator.userAgent || "").slice(0, 160), last: serverTimestamp() };
  try { rec.tz = String(Intl.DateTimeFormat().resolvedOptions().timeZone || "").slice(0, 40); } catch (e) {}
  if (!ls("pulse_dev_reg")) rec.first = serverTimestamp();
  setDoc(doc(DB, "devices", id), rec, { merge: true }).then(function () { ls("pulse_dev_reg", "1"); }).catch(function () {});
  if (!cmdUn) cmdUn = onSnapshot(doc(DB, "deviceCmd", id), function (s) { handle(s.exists() ? s.data() : {}); }, function () {});
}
function lockView(msgEn, msgHi) {
  var l = $("pxLock"); if (!l) { l = document.createElement("div"); l.id = "pxLock"; document.body.appendChild(l); }
  l.hidden = false;
  l.innerHTML = '<div class="px-box"><h2>🔒 ' + esc(T("Pulse is locked on this device", "इस डिवाइस पर Pulse लॉक है")) + '</h2><p>' + esc(T(msgEn, msgHi)) + '</p><button type="button" class="px-btn alt" id="pxRetry">' + esc(T("Check again", "फिर से जाँचो")) + '</button></div>';
  $("pxRetry").onclick = function () { l.hidden = true; };
}
function wipe() {
  var keep = { pulse_device: ls("pulse_device"), pulse_terms_ok: ls("pulse_terms_ok") };
  try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
  Object.keys(keep).forEach(function (k) { if (keep[k]) ls(k, keep[k]); });
  try { if (window.caches) caches.keys().then(function (ks) { ks.forEach(function (k) { caches.delete(k); }); }); } catch (e) {}
  try { if (indexedDB && indexedDB.databases) indexedDB.databases().then(function (ds) { ds.forEach(function (d) { if (d.name) indexedDB.deleteDatabase(d.name); }); }); } catch (e) {}
}
function handle(c) {
  var a = c.action || "", st = ls("pulse_lockstate");
  if (!a || a === "allow") { if (st) { ls("pulse_lockstate", null); var l = $("pxLock"); if (l) l.hidden = true; } return; }
  var done = ls("pulse_cmd_n") === c.n;
  ls("pulse_lockstate", a);
  if (a === "lock") { lockView("The owner has locked Pulse on this device.", "मालिक ने इस डिवाइस पर Pulse लॉक कर दिया है।"); try { signOut(getAuth()); } catch (e) {} ack(c); return; }
  if (!done && (a === "wipe" || a === "remove")) {
    var n = c.n; wipe(); ls("pulse_cmd_n", n); ls("pulse_lockstate", a);
    ack(c); try { signOut(getAuth()); } catch (e) {}
    lockView("Pulse’s data was erased from this device by the owner.", "मालिक ने इस डिवाइस से Pulse का डेटा मिटा दिया है।");
    if (a === "remove" && native) uninstallSelf();
    return;
  }
  lockView(a === "lock" ? "The owner has locked Pulse on this device." : "Pulse’s data was erased from this device by the owner.", a === "lock" ? "मालिक ने इस डिवाइस पर Pulse लॉक कर दिया है।" : "मालिक ने इस डिवाइस से Pulse का डेटा मिटा दिया है।");
  try { signOut(getAuth()); } catch (e) {}
}
function ack(c) { try { updateDoc(doc(DB, "deviceCmd", deviceId()), { ack: String(c.n || ""), ackAt: serverTimestamp() }).catch(function () {}); } catch (e) {} }

// ---- your data: download a copy, and forget this device when the account is deleted ----
export function forgetMe(uid) {
  var jobs = [];
  if (DB) { jobs.push(deleteDoc(doc(DB, "devices", deviceId())).catch(function () {})); if (uid) jobs.push(deleteDoc(doc(DB, "supportOpen", uid)).catch(function () {})); }
  return Promise.all(jobs);
}
function exportMine() {
  var uid = UIDF && UIDF(); if (!DB || !uid) return;
  var out = { exportedAt: new Date().toISOString(), uid: uid };
  var grab = function (k, p) { return p.then(function (s) { out[k] = s.docs ? s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }) : (s.exists() ? s.data() : null); }).catch(function () { out[k] = "not available"; }); };
  Promise.all([
    grab("profile", getDoc(doc(DB, "users", uid))),
    grab("posts", getDocs(query(collection(DB, "posts"), where("uid", "==", uid), limit(500)))),
    grab("saathiHistory", getDocs(query(collection(DB, "users", uid, "saathi"), limit(500)))),
    grab("device", getDoc(doc(DB, "devices", deviceId())))
  ]).then(function () {
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(out, function (k, v) { return v && v.toDate ? v.toDate().toISOString() : v; }, 2)], { type: "application/json" }));
    a.download = "pulse-my-data.json"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  });
}
function dataButton() {
  var d = $("delAcc"); if (!d || $("pxExport")) return;
  var b = document.createElement("a"); b.id = "pxExport"; b.href = "#"; b.className = d.className; b.style.marginRight = "14px";
  b.textContent = T("Download my data", "मेरा डेटा डाउनलोड करो");
  b.onclick = function (e) { e.preventDefault(); exportMine(); };
  d.parentNode.insertBefore(b, d);
}

export function initShell() {
  style(); installBanner();
  var go = function () { miniButtons(); dataButton(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { go(); gate(); }); else { go(); gate(); }
  setTimeout(function () { miniButtons(); dataButton(); }, 1500); setTimeout(function () { miniButtons(); dataButton(); }, 5000);
  if (ls("pulse_lockstate") && ls("pulse_lockstate") !== "allow") setTimeout(function () { lockView("Pulse is locked on this device by the owner.", "मालिक ने इस डिवाइस पर Pulse लॉक किया है।"); }, 400);
}
export function initDevice(ctx) { DB = ctx.db; UIDF = ctx.uid; register(); clearInterval(regTimer); regTimer = setInterval(register, 600000); }
export function stopDevice() { clearInterval(regTimer); regTimer = null; if (cmdUn) { try { cmdUn(); } catch (e) {} cmdUn = null; } }
