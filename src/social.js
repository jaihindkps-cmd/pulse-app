// Growth features: invite links + share cards, daily song challenge ("Aaj ka star"), group chat and live voice rooms.
// Everything runs on the free Firebase plan (Firestore + WebRTC between phones). app.js calls initSocial() after login.
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, where, orderBy, limit, getDocs, onSnapshot, serverTimestamp, arrayUnion, arrayRemove } from "firebase/firestore";
import * as Call from "./call.js";
import { serviceStart, serviceStop, routeStart, routeStop } from "./audioroute.js";
import { getLang } from "./i18n.js";

var WEB = "https://pulse-704e7.web.app/";
var ID_OK = /^[A-Za-z0-9]{8,40}$/;

// Links look like  https://pulse-704e7.web.app/?ref=<uid>  (friend invite)  and  ?g=<groupId>  (group invite).
// They are remembered here because the visitor has to sign up first.
(function () {
  try {
    var q = new URLSearchParams(location.search), ch = false, r = q.get("ref"), g = q.get("g");
    if (r && ID_OK.test(r)) { localStorage.setItem("pulse_ref", r); ch = true; }
    if (g && ID_OK.test(g)) { localStorage.setItem("pulse_join", g); ch = true; }
    if (ch && history.replaceState) history.replaceState(null, "", location.pathname);
  } catch (e) {}
})();

var C = null, ui = null, unsubs = [], V = null, G = null;
function $(id) { return document.getElementById(id); }
function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
function hi() { return getLang() !== "en"; }
function T(en, h) { return hi() ? h : en; }

var CSS = '\
#socialUI{position:fixed;inset:0;z-index:95;background:var(--bg);color:var(--fg);display:flex;flex-direction:column;font-family:var(--font-body)}\
#socialUI[hidden]{display:none}\
.so-head{display:flex;align-items:center;gap:10px;padding:calc(var(--sa-top,0px) + 10px) 12px 10px;border-bottom:1px solid var(--line);background:var(--surface)}\
.so-head h2{margin:0;font-size:18px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--font-display)}\
.so-head button{border:none;background:none;color:var(--fg);font-size:22px;padding:6px 10px;cursor:pointer}\
.so-body{flex:1;overflow-y:auto;padding:14px 14px calc(var(--sa-bottom,0px) + 18px)}\
.so-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px;margin-bottom:14px}\
.so-card h3{margin:0 0 6px;font-size:16px}.so-card p{margin:0 0 10px;color:var(--muted);font-size:14px;line-height:1.45}\
.so-btn{border:none;border-radius:14px;padding:12px 16px;font:700 14px var(--font-body);cursor:pointer;background:var(--grad);color:#fff}\
.so-btn.alt{background:var(--surface-2);color:var(--fg)}.so-btn.wa{background:#12B886}\
.so-btn[disabled]{opacity:.5}\
.so-row{display:flex;gap:8px;flex-wrap:wrap}.so-row>*{flex:1 1 140px}\
.so-link{display:flex;gap:8px;margin-bottom:10px}.so-link input{flex:1;min-width:0;border:1px solid var(--line);background:var(--surface-2);color:var(--fg);border-radius:12px;padding:11px;font-size:13px}\
.so-bar{height:10px;border-radius:99px;background:var(--surface-2);overflow:hidden;margin:8px 0}.so-bar i{display:block;height:100%;background:var(--grad);border-radius:99px}\
.so-tier{display:flex;gap:8px;margin-top:8px}.so-tier span{flex:1;text-align:center;font-size:12px;padding:8px 4px;border-radius:12px;background:var(--surface-2);color:var(--muted);font-weight:700}.so-tier span.on{background:var(--grad);color:#fff}\
.so-seg{display:flex;gap:6px;margin-bottom:12px}.so-seg button{flex:1;border:none;border-radius:99px;padding:9px;font:700 13px var(--font-body);background:var(--surface-2);color:var(--fg)}.so-seg button.on{background:var(--grad);color:#fff}\
.so-g{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--line);border-radius:16px;background:var(--surface);margin-bottom:10px;cursor:pointer}\
.so-g .em{width:46px;height:46px;border-radius:14px;background:var(--surface-2);display:flex;align-items:center;justify-content:center;font-size:24px;flex:none}\
.so-g .tx{flex:1;min-width:0}.so-g b{display:block;font-size:15px}.so-g small{display:block;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.so-in{width:100%;box-sizing:border-box;border:1px solid var(--line);background:var(--surface-2);color:var(--fg);border-radius:12px;padding:11px;font:14px var(--font-body);margin-bottom:8px}\
.so-emo{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}.so-emo button{font-size:22px;border:2px solid transparent;background:var(--surface-2);border-radius:12px;padding:4px 8px}.so-emo button.on{border-color:var(--accent)}\
.so-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:6px}\
.so-m{max-width:80%;padding:8px 12px;border-radius:16px;background:var(--surface);border:1px solid var(--line);font-size:14px;line-height:1.4;word-break:break-word;align-self:flex-start}\
.so-m.me{align-self:flex-end;background:var(--grad);color:#fff;border-color:transparent}.so-m small{display:block;font-weight:700;opacity:.7;font-size:11px;margin-bottom:2px}\
.so-comp{display:flex;gap:8px;padding:8px 10px calc(var(--sa-bottom,0px) + 8px);border-top:1px solid var(--line);background:var(--surface)}\
.so-comp input{flex:1;min-width:0;border:1px solid var(--line);background:var(--surface-2);color:var(--fg);border-radius:99px;padding:11px 16px;font:14px var(--font-body)}\
.so-voice{margin:10px 12px 0;padding:12px;border-radius:18px;background:var(--surface);border:1px solid var(--line)}\
.so-voice .vt{display:flex;align-items:center;gap:8px;font-weight:700;font-size:14px;margin-bottom:8px}.so-voice .vt .dot{width:9px;height:9px;border-radius:50%;background:#12B886;animation:soPulse 1.6s infinite}\
@keyframes soPulse{50%{opacity:.35}}\
.so-parts{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}.so-p{display:flex;flex-direction:column;align-items:center;gap:4px;width:58px;font-size:11px}\
.so-p i{width:46px;height:46px;border-radius:50%;background:var(--grad);color:#fff;display:flex;align-items:center;justify-content:center;font:700 18px var(--font-body);font-style:normal;border:3px solid transparent;transition:border-color .12s,box-shadow .12s}\
.so-p.speak i{border-color:#12B886;box-shadow:0 0 0 4px rgba(18,184,134,.3)}.so-p span{max-width:58px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
.so-ch{margin:0 0 12px;padding:14px;border-radius:18px;background:var(--grad);color:#fff}\
.so-ch .k{font-size:12px;font-weight:700;opacity:.85}.so-ch .tp{font:700 17px var(--font-display);margin:4px 0 10px;line-height:1.3}\
.so-ch button{border:none;border-radius:12px;padding:9px 14px;font:700 13px var(--font-body);background:rgba(255,255,255,.95);color:#111;margin-right:8px;cursor:pointer}\
.so-ch .star{margin-top:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,.3);font-size:13px;line-height:1.4}\
.so-img{max-width:100%;border-radius:14px;display:block;margin:0 auto 10px}\
.so-empty{text-align:center;color:var(--muted);padding:26px 10px;font-size:14px}\
';

function css() { if ($("socialCss")) return; var s = document.createElement("style"); s.id = "socialCss"; s.textContent = CSS; document.head.appendChild(s); }
function shell() {
  css(); if (ui) return ui;
  ui = el('<div id="socialUI" hidden><div class="so-head"><button type="button" id="soBack" aria-label="Back">‹</button><h2 id="soTitle"></h2><span id="soAct"></span></div><div id="soView" style="flex:1;min-height:0;display:flex;flex-direction:column"></div></div>');
  document.body.appendChild(ui);
  $("soBack").addEventListener("click", function () { if (G && G.gid) closeGroup(); else closeUI(); });
  return ui;
}
function openUI(title) { shell(); $("soTitle").textContent = title; $("soAct").innerHTML = ""; ui.hidden = false; }
function closeUI() { if (ui) ui.hidden = true; }
function view() { return $("soView"); }
function body(html) { var v = view(); v.innerHTML = '<div class="so-body">' + html + '</div>'; return v.firstChild; }
function uid() { return C.uid(); }
function me() { return C.me(); }

// ---------------------------------------------------------------- share cards (canvas image)
function wrap(cx, text, x, y, maxW, lh, maxLines) {
  var words = String(text).split(/\s+/), line = "", n = 0;
  for (var i = 0; i < words.length; i++) {
    var t = line ? line + " " + words[i] : words[i];
    if (cx.measureText(t).width > maxW && line) { cx.fillText(line, x, y); y += lh; line = words[i]; if (++n >= maxLines) return y; } else line = t;
  }
  if (line) { cx.fillText(line, x, y); y += lh; } return y;
}
function drawCard(o) {
  var W = 1080, H = 1350, cv = document.createElement("canvas"); cv.width = W; cv.height = H; var cx = cv.getContext("2d");
  var g = cx.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#0FA58B"); g.addColorStop(1, "#1E7BE0"); cx.fillStyle = g; cx.fillRect(0, 0, W, H);
  cx.fillStyle = "rgba(255,255,255,.08)"; cx.beginPath(); cx.arc(W - 80, 160, 330, 0, 7); cx.fill(); cx.beginPath(); cx.arc(120, H - 220, 260, 0, 7); cx.fill();
  cx.strokeStyle = "rgba(255,255,255,.9)"; cx.lineWidth = 10; cx.lineCap = "round"; cx.lineJoin = "round"; cx.beginPath();
  cx.moveTo(80, 330); cx.lineTo(380, 330); cx.lineTo(450, 230); cx.lineTo(540, 430); cx.lineTo(610, 330); cx.lineTo(1000, 330); cx.stroke();
  var f = '"Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif';
  cx.fillStyle = "#fff"; cx.textBaseline = "alphabetic"; cx.font = "800 150px " + f; cx.fillText("Pulse", 80, 190);
  cx.font = "700 62px " + f; var y = wrap(cx, o.title, 80, 590, W - 160, 78, 4);
  cx.font = "500 40px " + f; cx.fillStyle = "rgba(255,255,255,.92)"; y = wrap(cx, o.sub || "", 80, y + 18, W - 160, 54, 3);
  if (o.lines && o.lines.length) { cx.font = "italic 600 42px " + f; cx.fillStyle = "#fff"; o.lines.slice(0, 2).forEach(function (l) { y = wrap(cx, "“" + l + "”", 80, y + 34, W - 160, 56, 2); }); }
  cx.fillStyle = "rgba(255,255,255,.16)"; var bx = 70, by = H - 270, bw = W - 140, bh = 190, r = 34;
  cx.beginPath(); cx.moveTo(bx + r, by); cx.arcTo(bx + bw, by, bx + bw, by + bh, r); cx.arcTo(bx + bw, by + bh, bx, by + bh, r); cx.arcTo(bx, by + bh, bx, by, r); cx.arcTo(bx, by, bx + bw, by, r); cx.fill();
  cx.fillStyle = "#fff"; cx.font = "700 40px " + f; cx.fillText(o.cta || "Join me on Pulse", 110, by + 80);
  cx.font = "600 36px " + f; cx.fillStyle = "rgba(255,255,255,.95)"; cx.fillText(o.link.replace(/^https?:\/\//, ""), 110, by + 140);
  return new Promise(function (res) { cv.toBlob(function (b) { res(b); }, "image/png"); });
}
function shareImage(blob, text) {
  var file = null; try { file = new File([blob], "pulse.png", { type: "image/png" }); } catch (e) {}
  if (file && navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) return navigator.share({ files: [file], text: text }).catch(function () {});
  var url = URL.createObjectURL(blob);
  openUI(T("Share card", "शेयर कार्ड"));
  body('<img class="so-img" src="' + url + '" alt="Share card"><p class="so-empty" style="padding:6px">' + T("Press and hold the image to save or share it.", "इमेज को दबाकर रखें, फिर सेव या शेयर करें।") + '</p><div class="so-row"><a class="so-btn" style="text-align:center;text-decoration:none" href="' + url + '" download="pulse.png">' + T("Download", "डाउनलोड") + '</a></div>');
  return Promise.resolve();
}
function waOpen(text) { var u = "https://wa.me/?text=" + encodeURIComponent(text); try { window.open(u, "_blank"); } catch (e) { location.href = u; } }

// ---------------------------------------------------------------- invite friends
function inviteText(link) { return T("I am on Pulse: friends, dating, jobs, music and an AI companion, all free. Join me: ", "मैं Pulse पर हूँ: दोस्त, डेटिंग, जॉब, म्यूज़िक और AI साथी, सब फ्री। मुझसे जुड़ो: ") + link; }
var TIERS = [[3, "Connector", "कनेक्टर"], [10, "Star Inviter", "स्टार इनवाइटर"], [25, "Pulse Legend", "पल्स लीजेंड"]];
function openInvite() {
  openUI(T("Invite friends", "दोस्तों को बुलाओ"));
  var link = WEB + "?ref=" + uid();
  var b = body('<div class="so-card"><h3>' + T("Bring your friends to Pulse", "अपने दोस्तों को Pulse पर लाओ") + '</h3><p>' + T("Share your link. When friends join with it, you earn badges.", "अपना लिंक शेयर करो। दोस्त इससे जुड़ें तो तुम्हें बैज मिलते हैं।") + '</p>\
    <div class="so-link"><input id="inLink" readonly value="' + link + '"><button class="so-btn alt" id="inCopy" type="button">' + T("Copy", "कॉपी") + '</button></div>\
    <div class="so-row"><button class="so-btn wa" id="inWa" type="button">WhatsApp</button><button class="so-btn" id="inShare" type="button">' + T("Share", "शेयर") + '</button><button class="so-btn alt" id="inCard" type="button">' + T("Share card", "शेयर कार्ड") + '</button></div></div>\
    <div class="so-card"><h3 id="inCount">' + T("Friends joined: ", "जुड़े दोस्त: ") + '…</h3><div class="so-bar"><i id="inBar" style="width:0"></i></div><div class="so-tier" id="inTier"></div></div>');
  $("inCopy").addEventListener("click", function () { try { navigator.clipboard.writeText(link); C.toast(T("Link copied", "लिंक कॉपी हुआ")); } catch (e) { $("inLink").select(); document.execCommand && document.execCommand("copy"); C.toast(T("Link copied", "लिंक कॉपी हुआ")); } });
  $("inWa").addEventListener("click", function () { waOpen(inviteText(link)); });
  $("inShare").addEventListener("click", function () { if (navigator.share) navigator.share({ text: inviteText(link) }).catch(function () {}); else waOpen(inviteText(link)); });
  $("inCard").addEventListener("click", function () {
    var nm = (me() && me().name) || "A friend";
    drawCard({ title: T(nm + " invited you to Pulse", nm + " ने तुम्हें Pulse पर बुलाया है"), sub: T("Friends. Dating. Jobs. Music. Your AI companion Saathi. All free.", "दोस्त। डेटिंग। जॉब। म्यूज़िक। तुम्हारा AI साथी। सब फ्री।"), cta: T("Join me on Pulse", "मेरे साथ Pulse पर आओ"), link: link }).then(function (bl) { shareImage(bl, inviteText(link)); });
  });
  countInvites().then(function (n) {
    if (!$("inCount")) return;
    $("inCount").textContent = T("Friends joined: ", "जुड़े दोस्त: ") + n;
    var next = TIERS.filter(function (t) { return n < t[0]; })[0], top = next ? next[0] : TIERS[TIERS.length - 1][0];
    $("inBar").style.width = Math.min(100, n / top * 100) + "%";
    $("inTier").innerHTML = TIERS.map(function (t) { return '<span class="' + (n >= t[0] ? "on" : "") + '">' + (n >= t[0] ? "✓ " : "") + T(t[1], t[2]) + '<br>' + t[0] + '</span>'; }).join("");
  });
}
function countInvites() {
  return getDocs(query(collection(C.db, "users"), where("refBy", "==", uid()), limit(100))).then(function (s) { return s.size; }).catch(function () { return 0; });
}
// If this person came from an invite link, remember who invited them (only for brand-new accounts).
function applyReferral() {
  try {
    var r = localStorage.getItem("pulse_ref"); if (!r) return;
    var m = me(); if (!m || m.refBy || r === uid()) { localStorage.removeItem("pulse_ref"); return; }
    var created = m.createdAt && m.createdAt.toMillis ? m.createdAt.toMillis() : Date.now();
    if (Date.now() - created > 3 * 864e5) { localStorage.removeItem("pulse_ref"); return; }
    updateDoc(doc(C.db, "users", uid()), { refBy: r }).then(function () { m.refBy = r; localStorage.removeItem("pulse_ref"); }).catch(function () {});
  } catch (e) {}
}

// ---------------------------------------------------------------- daily song challenge
var TOPICS = [
  ["A rainy day and a cup of chai", "बारिश का दिन और एक कप चाय"], ["Missing home", "घर की याद"], ["First love", "पहला प्यार"], ["Friends who feel like family", "वो दोस्त जो परिवार जैसे हैं"],
  ["A thank-you to Mom", "माँ के लिए शुक्रिया"], ["Late night city lights", "रात की जगमगाती सड़कें"], ["A train journey", "ट्रेन का सफ़र"], ["Never giving up", "हार न मानना"],
  ["College days", "कॉलेज के दिन"], ["A letter to my future self", "भविष्य के मेरे नाम चिट्ठी"], ["Monsoon romance", "बारिश वाला इश्क़"], ["Festival of lights", "रोशनी का त्योहार"],
  ["Dancing alone in my room", "अपने कमरे में अकेले नाचना"], ["Dad's silent love", "पापा का ख़ामोश प्यार"], ["A road trip with friends", "दोस्तों के साथ रोड ट्रिप"], ["Sunrise by the river", "नदी किनारे सुबह"],
  ["Heartbreak and healing", "टूटा दिल और मरहम"], ["My hometown", "मेरा शहर"], ["Chai and conversations", "चाय और बातें"], ["Dreams bigger than the sky", "आसमान से बड़े सपने"],
  ["A song for my best friend", "मेरे सबसे अच्छे दोस्त के लिए गाना"], ["Rooftop evenings", "छत की शामें"], ["Waiting for a call", "एक फ़ोन कॉल का इंतज़ार"], ["Bollywood nights", "बॉलीवुड वाली रातें"],
  ["Gratitude", "शुक्रगुज़ार दिल"], ["Wedding season", "शादी का मौसम"], ["Rain on the window", "खिड़की पर बारिश"], ["Small joys", "छोटी-छोटी ख़ुशियाँ"],
  ["A new beginning", "नई शुरुआत"], ["Long distance love", "दूर रहकर भी पास"], ["Grandma's stories", "नानी-दादी की कहानियाँ"], ["Fearless", "बेख़ौफ़"]
];
function dayKey(off) { return new Date(Date.now() + 19800000 - (off || 0) * 864e5).toISOString().slice(0, 10); }
function topicFor(key) { var n = Math.floor(Date.parse(key + "T00:00:00Z") / 864e5); return TOPICS[((n % TOPICS.length) + TOPICS.length) % TOPICS.length]; }
var chData = { today: null, yday: null };
function topSong(key) {
  return getDocs(query(collection(C.db, "songs"), where("challenge", "==", key), limit(60))).then(function (s) {
    var best = null; s.forEach(function (d) { var x = d.data(); if (!x.title) return; var n = (x.likedBy || []).length; if (!best || n > best.n) best = { id: d.id, title: x.title, name: x.name || "Member", n: n, count: 0 }; });
    return { best: best, count: s.size };
  }).catch(function () { return { best: null, count: 0 }; });
}
function paintChallenge() {
  var host = document.querySelector("#songsPanel"); if (!host) return;
  var box = $("chBanner");
  if (!box) { box = el('<div class="so-ch" id="chBanner"></div>'); css(); host.insertBefore(box, host.firstChild); }
  var k = dayKey(0), tp = topicFor(k)[hi() ? 1 : 0], y = chData.yday && chData.yday.best, t = chData.today;
  var star = y ? '⭐ ' + T("Yesterday’s star: ", "कल का स्टार: ") + '<b></b> · ' + '♥ ' + y.n : T("Be today’s star: the most-liked song wins ⭐ tomorrow.", "आज के स्टार बनो: सबसे ज़्यादा लाइक वाला गाना कल ⭐ बनेगा।");
  box.innerHTML = '<div class="k">' + T("TODAY’S CHALLENGE", "आज की चुनौती") + (t && t.count ? ' · ' + t.count + ' ' + T("songs", "गाने") : "") + '</div><div class="tp"></div><button type="button" id="chGo">' + T("Make my song", "मेरा गाना बनाओ") + '</button>' + (y ? '<button type="button" id="chHear">' + T("Listen to the star", "स्टार को सुनो") + '</button>' : "") + '<div class="star">' + star + '</div>';
  box.querySelector(".tp").textContent = tp;
  if (y) { var b = box.querySelector(".star b"); b.textContent = y.title + " (" + y.name + ")"; }
  $("chGo").addEventListener("click", function () {
    C.showTab("studio"); var sg = $("segSongs"); if (sg) sg.click();
    var cr = $("stCreate"); if (cr && cr.hidden && $("stToggle")) $("stToggle").click();
    var p = $("stPrompt"); if (p) { p.value = tp; try { p.focus(); } catch (e) {} }
    window.__pulseChallenge = dayKey(0); C.toast(T("Topic added. Tap Create song.", "टॉपिक डल गया। ‘Create song’ दबाओ।"));
  });
  var hb = $("chHear"); if (hb) hb.addEventListener("click", function () {
    var pb = document.querySelector('.sg-card[data-id="' + y.id + '"] .sg-play'); if (pb) { pb.scrollIntoView({ block: "center" }); pb.click(); } else C.toast(T("Open the Trending tab to find it.", "Trending टैब में ढूँढो।"));
  });
}
function refreshChallenge() {
  paintChallenge();
  Promise.all([topSong(dayKey(0)), topSong(dayKey(1))]).then(function (r) { chData.today = r[0]; chData.yday = r[1]; paintChallenge(); });
}

// ---------------------------------------------------------------- groups
var EMOJIS = ["💬", "🎵", "🎮", "💼", "📚", "🍜", "✈️", "💪", "🎬", "🪔"];
function gdoc(gid) { return doc(C.db, "groups", gid); }
function openGroups() {
  openUI(T("Groups & voice rooms", "ग्रुप और वॉइस रूम"));
  var tab = "mine", mine = [], pub = [], busy = false;
  var b = body('<div class="so-seg"><button class="on" data-k="mine">' + T("My groups", "मेरे ग्रुप") + '</button><button data-k="pub">' + T("Discover", "खोजो") + '</button><button data-k="new">+ ' + T("Create", "बनाओ") + '</button></div><div id="grBody"></div>');
  function row(g, joined) {
    var d = el('<div class="so-g"><div class="em"></div><div class="tx"><b></b><small></small></div><span>' + (g.live ? "" : "") + '</span></div>');
    d.querySelector(".em").textContent = g.emoji || "💬"; d.querySelector("b").textContent = g.name;
    d.querySelector("small").textContent = (g.members || []).length + " " + T("members", "सदस्य") + (g.lastText ? " · " + g.lastText : g.desc ? " · " + g.desc : "");
    d.addEventListener("click", function () { openGroup(g.id); }); return d;
  }
  function paint() {
    var host = $("grBody"); if (!host) return; host.innerHTML = "";
    if (tab === "new") { createForm(host); return; }
    var l = tab === "mine" ? mine : pub.filter(function (g) { return (g.members || []).indexOf(uid()) < 0; });
    if (!l.length) { host.innerHTML = '<div class="so-empty">' + (tab === "mine" ? T("You are not in any group yet. Join one from Discover or create your own.", "तुम अभी किसी ग्रुप में नहीं हो। Discover से जुड़ो या अपना बनाओ।") : T("No public groups yet. Create the first one.", "अभी कोई पब्लिक ग्रुप नहीं। पहला तुम बनाओ।")) + '</div>'; return; }
    l.forEach(function (g) { host.appendChild(row(g)); });
  }
  b.querySelectorAll(".so-seg button").forEach(function (x) { x.addEventListener("click", function () { tab = x.getAttribute("data-k"); b.querySelectorAll(".so-seg button").forEach(function (y) { y.classList.toggle("on", y === x); }); paint(); }); });
  function load() {
    getDocs(query(collection(C.db, "groups"), where("members", "array-contains", uid()), limit(50))).then(function (s) { mine = s.docs.map(gmap).sort(function (a, b) { return b.lastAt - a.lastAt; }); paint(); }).catch(function () { paint(); });
    getDocs(query(collection(C.db, "groups"), where("public", "==", true), limit(40))).then(function (s) { pub = s.docs.map(gmap).sort(function (a, b) { return (b.members || []).length - (a.members || []).length; }); paint(); }).catch(function () {});
  }
  load(); paint();
}
function gmap(d) { var x = d.data({ serverTimestamps: "estimate" }); x.id = d.id; x.lastAt = x.lastAt && x.lastAt.toMillis ? x.lastAt.toMillis() : (x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0); return x; }
function createForm(host) {
  var emo = EMOJIS[0];
  var f = el('<div class="so-card"><h3>' + T("New group", "नया ग्रुप") + '</h3><input class="so-in" id="gcName" maxlength="40" placeholder="' + T("Group name", "ग्रुप का नाम") + '"><input class="so-in" id="gcDesc" maxlength="120" placeholder="' + T("What is it about? (optional)", "किस बारे में है? (वैकल्पिक)") + '"><div class="so-emo" id="gcEmo"></div><label style="display:flex;gap:8px;align-items:center;margin:4px 0 12px;font-size:14px"><input type="checkbox" id="gcPub" checked> ' + T("Public: anyone can find and join", "पब्लिक: कोई भी ढूँढकर जुड़ सकता है") + '</label><button class="so-btn" id="gcMake" type="button" style="width:100%">' + T("Create group", "ग्रुप बनाओ") + '</button></div>');
  host.appendChild(f);
  EMOJIS.forEach(function (e, i) { var b = el('<button type="button" class="' + (i === 0 ? "on" : "") + '">' + e + '</button>'); b.addEventListener("click", function () { emo = e; f.querySelectorAll(".so-emo button").forEach(function (x) { x.classList.toggle("on", x === b); }); }); f.querySelector("#gcEmo").appendChild(b); });
  f.querySelector("#gcMake").addEventListener("click", function () {
    var name = f.querySelector("#gcName").value.trim().slice(0, 40); if (!name) { C.toast(T("Give the group a name", "ग्रुप का नाम लिखो")); return; }
    if (!C.rate("grp", 3, 60000)) return; var btn = this; btn.disabled = true;
    addDoc(collection(C.db, "groups"), { name: name, desc: f.querySelector("#gcDesc").value.trim().slice(0, 120), emoji: emo, host: uid(), members: [uid()], public: f.querySelector("#gcPub").checked, createdAt: serverTimestamp(), lastAt: serverTimestamp(), lastText: "" })
      .then(function (r) { openGroup(r.id); }).catch(function (e) { C.toast(C.errMsg(e)); btn.disabled = false; });
  });
}

function closeGroup() { voiceLeave(); if (G) { G.unsubs.forEach(function (u) { try { u(); } catch (e) {} }); G = null; } openGroups(); }
function openGroup(gid) {
  if (G) G.unsubs.forEach(function (u) { try { u(); } catch (e) {} });
  G = { gid: gid, unsubs: [], g: null };
  openUI("…"); var v = view(); v.innerHTML = '<div class="so-empty">…</div>';
  var first = true;
  G.unsubs.push(onSnapshot(gdoc(gid), function (s) {
    if (!s.exists()) { C.toast(T("This group no longer exists.", "यह ग्रुप अब नहीं है।")); G = null; openGroups(); return; }
    var g = gmap(s); G.g = g; var isMember = (g.members || []).indexOf(uid()) >= 0;
    $("soTitle").textContent = (g.emoji || "💬") + " " + g.name;
    if (first || G.member !== isMember) { first = false; G.member = isMember; isMember ? drawGroup() : drawJoin(); }
    paintGroupHead();
  }, function () { C.toast(T("Cannot open this group.", "यह ग्रुप नहीं खुल पा रहा।")); }));
}
function drawJoin() {
  var g = G.g, v = view();
  v.innerHTML = '<div class="so-body"><div class="so-card" style="text-align:center"><div style="font-size:46px">' + (g.emoji || "💬") + '</div><h3 style="margin-top:8px"></h3><p></p><button class="so-btn" id="gjJoin" type="button">' + T("Join group", "ग्रुप जॉइन करो") + '</button></div></div>';
  v.querySelector("h3").textContent = g.name; v.querySelector("p").textContent = (g.desc ? g.desc + " · " : "") + (g.members || []).length + " " + T("members", "सदस्य");
  $("gjJoin").addEventListener("click", function () { var b = this; b.disabled = true; if ((g.members || []).length >= 60) { C.toast(T("Group is full", "ग्रुप भरा है")); return; } updateDoc(gdoc(g.id), { members: arrayUnion(uid()) }).catch(function (e) { C.toast(C.errMsg(e)); b.disabled = false; }); });
}
function paintGroupHead() {
  var g = G.g, a = $("soAct"); if (!g || !a) return;
  a.innerHTML = '<button type="button" id="gInv" aria-label="Invite">🔗</button><button type="button" id="gLeave" aria-label="Leave">⎋</button>';
  $("gInv").addEventListener("click", function () {
    var link = WEB + "?g=" + g.id, txt = T("Join my group “" + g.name + "” on Pulse: ", "Pulse पर मेरे ग्रुप “" + g.name + "” में जुड़ो: ") + link;
    if (navigator.share) navigator.share({ text: txt }).catch(function () {}); else waOpen(txt);
  });
  $("gLeave").addEventListener("click", function () {
    if (!confirm(T("Leave this group?", "ग्रुप छोड़ना है?"))) return; voiceLeave();
    updateDoc(gdoc(g.id), { members: arrayRemove(uid()) }).then(function () { if (G) { G.unsubs.forEach(function (u) { try { u(); } catch (e) {} }); G = null; } openGroups(); }).catch(function (e) { C.toast(C.errMsg(e)); });
  });
  paintVoice();
}
function drawGroup() {
  var g = G.g, v = view();
  v.innerHTML = '<div id="gVoice"></div><div class="so-msgs" id="gMsgs"></div><div class="so-comp"><input id="gIn" maxlength="500" placeholder="' + T("Message", "मैसेज") + '"><button class="so-btn" id="gSend" type="button">➤</button></div>';
  var box = $("gMsgs"), shown = {};
  G.unsubs.push(onSnapshot(query(collection(C.db, "groups", g.id, "msgs"), orderBy("createdAt", "desc"), limit(80)), function (s) {
    var arr = s.docs.map(function (d) { var x = d.data({ serverTimestamps: "estimate" }); x.id = d.id; return x; }).reverse();
    var atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 80; box.innerHTML = "";
    arr.forEach(function (m) {
      if (C.blocked().has(m.from)) return; var mine = m.from === uid();
      var d = el('<div class="so-m' + (mine ? " me" : "") + '">' + (mine ? "" : "<small></small>") + '<span></span></div>'); if (!mine) d.querySelector("small").textContent = m.name || "Member"; d.querySelector("span").textContent = m.text; box.appendChild(d);
    });
    if (!arr.length) box.innerHTML = '<div class="so-empty">' + T("No messages yet. Say hello 👋", "अभी कोई मैसेज नहीं। नमस्ते बोलो 👋") + '</div>';
    if (atEnd || !G.seen) box.scrollTop = box.scrollHeight; G.seen = true;
  }, function () {}));
  function send() {
    var inp = $("gIn"), t = inp.value.trim().slice(0, 500); if (!t || !C.rate("gmsg", 8, 10000)) return; inp.value = "";
    addDoc(collection(C.db, "groups", g.id, "msgs"), { from: uid(), name: ((me() && me().name) || "Member").slice(0, 40), text: t, createdAt: serverTimestamp() })
      .then(function () { return updateDoc(gdoc(g.id), { lastText: t.slice(0, 60), lastAt: serverTimestamp(), lastFrom: uid() }); }).catch(function (e) { C.toast(C.errMsg(e)); inp.value = t; });
  }
  $("gSend").addEventListener("click", send); $("gIn").addEventListener("keydown", function (e) { if (e.key === "Enter") send(); });
  // who is in the voice room right now
  G.live = {};
  G.unsubs.push(onSnapshot(query(collection(C.db, "groups", g.id, "live"), limit(20)), function (s) { G.live = {}; s.docs.forEach(function (d) { var x = d.data({ serverTimestamps: "estimate" }); G.live[d.id] = { name: x.name || "Member", since: x.since || 0, t: x.t && x.t.toMillis ? x.t.toMillis() : Date.now() }; }); paintVoice(); if (V) voiceSync(); }, function () {}));
  G.livePoll = setInterval(function () { paintVoice(); }, 6000); G.unsubs.push(function () { clearInterval(G.livePoll); });
}
function fresh(p) { return Date.now() - p.t < 45000; }

// ---------------------------------------------------------------- live voice room (each phone talks directly to the others)
function paintVoice() {
  var host = $("gVoice"); if (!host || !G) return;
  var ids = Object.keys(G.live || {}).filter(function (k) { return fresh(G.live[k]) || (V && k === uid()); }), inRoom = !!V;
  if (!ids.length && !inRoom) { host.innerHTML = '<div class="so-voice"><div class="vt">🎙 ' + T("Voice room", "वॉइस रूम") + '</div><button class="so-btn" id="vJoin" type="button" style="width:100%">' + T("Start a voice room", "वॉइस रूम शुरू करो") + '</button></div>'; $("vJoin").addEventListener("click", voiceJoin); return; }
  host.innerHTML = '<div class="so-voice"><div class="vt"><span class="dot"></span>' + T("Live voice room", "लाइव वॉइस रूम") + ' · ' + ids.length + '</div><div class="so-parts" id="vParts"></div><div class="so-row" id="vBtns"></div></div>';
  var pt = $("vParts");
  ids.forEach(function (k) { var p = G.live[k], d = el('<div class="so-p" data-u="' + k + '"><i></i><span></span></div>'); d.querySelector("i").textContent = (p.name || "?").charAt(0).toUpperCase(); d.querySelector("span").textContent = k === uid() ? T("You", "तुम") : p.name; pt.appendChild(d); });
  var bt = $("vBtns");
  if (!inRoom) { var j = el('<button class="so-btn" type="button">' + T("Join voice", "वॉइस में आओ") + '</button>'); j.addEventListener("click", voiceJoin); bt.appendChild(j); }
  else {
    var m = el('<button class="so-btn alt" type="button">' + (V.muted ? T("Unmute", "अनम्यूट") : T("Mute", "म्यूट")) + '</button>'); m.addEventListener("click", function () { V.muted = !V.muted; V.stream.getAudioTracks().forEach(function (t) { t.enabled = !V.muted; }); paintVoice(); });
    var l = el('<button class="so-btn" style="background:#F0405E" type="button">' + T("Leave voice", "वॉइस छोड़ो") + '</button>'); l.addEventListener("click", voiceLeave);
    bt.appendChild(m); bt.appendChild(l);
  }
}
function voiceJoin() {
  if (V || !G || !G.g) return;
  var live = Object.keys(G.live || {}).filter(function (k) { return k !== uid() && fresh(G.live[k]); });
  if (live.length >= 6) { C.toast(T("Voice room is full (6 people).", "वॉइस रूम भरा है (6 लोग)।")); return; }
  if (!Call.supported()) { C.toast(T("Voice is not supported on this device.", "इस डिवाइस पर वॉइस नहीं चलेगा।")); return; }
  var gid = G.gid;
  Call.getMic().then(function (stream) {
    if (!G || G.gid !== gid) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
    V = { gid: gid, stream: stream, peers: {}, muted: false, since: Date.now(), joined: Date.now(), unsubs: [] };
    try { var rr = routeStart(true); if (rr && rr.catch) rr.catch(function () {}); } catch (e) {} serviceStart(false, "Pulse voice room");
    var me0 = { name: ((me() && me().name) || "Member").slice(0, 40), since: V.since, t: serverTimestamp() };
    setDoc(doc(C.db, "groups", gid, "live", uid()), me0).catch(function (e) { C.toast(C.errMsg(e)); voiceLeave(); });
    V.hb = setInterval(function () { updateDoc(doc(C.db, "groups", gid, "live", uid()), { t: serverTimestamp() }).catch(function () {}); }, 8000);
    V.tick = setInterval(voiceSync, 4000);
    V.unsubs.push(onSnapshot(query(collection(C.db, "groups", gid, "sig"), where("to", "==", uid())), function (s) {
      s.docChanges().forEach(function (ch) { if (ch.type !== "added") return; var x = ch.doc.data({ serverTimestamps: "estimate" }); var t = x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : Date.now(); deleteDoc(ch.doc.ref).catch(function () {}); if (Date.now() - t > 60000 || !V) return; voiceSignal(x); });
    }, function () {}));
    V.speakTimer = setInterval(voiceSpeak, 220);
    paintVoice(); setTimeout(voiceSync, 600);
  }).catch(function (e) { C.toast(/denied|NotAllowed|Permission/i.test(String(e && (e.name || e.message))) ? T("Microphone access is off. Allow it in Settings.", "माइक की अनुमति बंद है। सेटिंग्स में चालू करो।") : C.errMsg(e)); });
}
function peerClose(k) { var p = V && V.peers[k]; if (!p) return; try { p.pc && p.pc.close(); } catch (e) {} try { p.audio && (p.audio.srcObject = null); } catch (e) {} try { p.ctx && p.ctx.close(); } catch (e) {} delete V.peers[k]; }
function voiceSync() {
  if (!V || !G) return; var live = G.live || {}, mine = live[uid()] ? live[uid()].since : V.since;
  Object.keys(V.peers).forEach(function (k) { var p = V.peers[k], st = p.pc && p.pc.connectionState; if (!live[k] || !fresh(live[k]) || st === "closed" || st === "failed" || (p.pending && Date.now() - p.t0 > 20000)) peerClose(k); });
  Object.keys(live).forEach(function (k) {
    if (k === uid() || !fresh(live[k]) || V.peers[k]) return;
    var theirs = live[k].since, iOffer = mine > theirs || (mine === theirs && uid() > k); if (!iOffer) return;
    var peer = V.peers[k] = { t0: Date.now(), pending: true, pc: null };
    Call.makeOffer(V.stream, function (st) { peerTrack(k, st); }, function (s) { if (s === "connected") peer.pending = false; }).then(function (o) {
      if (!V || V.peers[k] !== peer) { try { o.pc.close(); } catch (e) {} return; } peer.pc = o.pc;
      addDoc(collection(C.db, "groups", V.gid, "sig"), { from: uid(), to: k, kind: "offer", sdp: o.sdp, createdAt: serverTimestamp() }).catch(function () { peerClose(k); });
    }).catch(function () { peerClose(k); });
  });
}
function voiceSignal(x) {
  if (!V || !x || !x.from) return;
  if (x.kind === "offer") {
    peerClose(x.from); var peer = V.peers[x.from] = { t0: Date.now(), pending: true, pc: null };
    Call.makeAnswer(V.stream, x.sdp, function (st) { peerTrack(x.from, st); }, function (s) { if (s === "connected") peer.pending = false; }).then(function (a) {
      if (!V || V.peers[x.from] !== peer) { try { a.pc.close(); } catch (e) {} return; } peer.pc = a.pc;
      addDoc(collection(C.db, "groups", V.gid, "sig"), { from: uid(), to: x.from, kind: "answer", sdp: a.sdp, createdAt: serverTimestamp() }).catch(function () {});
    }).catch(function () { peerClose(x.from); });
  } else if (x.kind === "answer") {
    var p = V.peers[x.from]; if (p && p.pc && p.pc.signalingState === "have-local-offer") Call.applyAnswer(p.pc, x.sdp).catch(function () { peerClose(x.from); });
  }
}
function peerTrack(k, stream) {
  var p = V && V.peers[k]; if (!p) return; p.stream = stream;
  var a = p.audio || (p.audio = new Audio()); a.autoplay = true; a.srcObject = stream; a.play().catch(function () {});
  try { var AC = window.AudioContext || window.webkitAudioContext; p.ctx = new AC(); var an = p.ctx.createAnalyser(); an.fftSize = 256; p.ctx.createMediaStreamSource(stream).connect(an); p.an = an; p.buf = new Uint8Array(an.frequencyBinCount); } catch (e) {}
}
function level(an, buf) { if (!an) return 0; an.getByteTimeDomainData(buf); var m = 0; for (var i = 0; i < buf.length; i++) m = Math.max(m, Math.abs(buf[i] - 128)); return m; }
function voiceSpeak() {
  if (!V) return;
  if (!V.myAn) { try { var AC = window.AudioContext || window.webkitAudioContext; V.myCtx = new AC(); V.myAn = V.myCtx.createAnalyser(); V.myAn.fftSize = 256; V.myCtx.createMediaStreamSource(V.stream).connect(V.myAn); V.myBuf = new Uint8Array(V.myAn.frequencyBinCount); } catch (e) { V.myAn = null; return; } }
  function mark(k, on) { var n = document.querySelector('.so-p[data-u="' + k + '"]'); if (n) n.classList.toggle("speak", on); }
  mark(uid(), !V.muted && level(V.myAn, V.myBuf) > 14);
  Object.keys(V.peers).forEach(function (k) { var p = V.peers[k]; mark(k, level(p.an, p.buf) > 12); });
}
function voiceLeave() {
  if (!V) return; var v = V; V = null;
  clearInterval(v.hb); clearInterval(v.tick); clearInterval(v.speakTimer); v.unsubs.forEach(function (u) { try { u(); } catch (e) {} });
  Object.keys(v.peers).forEach(function (k) { var p = v.peers[k]; try { p.pc && p.pc.close(); } catch (e) {} try { p.audio && (p.audio.srcObject = null); } catch (e) {} try { p.ctx && p.ctx.close(); } catch (e) {} });
  try { v.myCtx && v.myCtx.close(); } catch (e) {}
  v.stream.getTracks().forEach(function (t) { t.stop(); });
  deleteDoc(doc(C.db, "groups", v.gid, "live", uid())).catch(function () {});
  try { var r2 = routeStop(); if (r2 && r2.catch) r2.catch(function () {}); } catch (e) {} serviceStop();
  if (G) paintVoice();
}

// ---------------------------------------------------------------- start / stop / menu
function joinFromLink() {
  try { var g = localStorage.getItem("pulse_join"); if (!g) return; localStorage.removeItem("pulse_join"); if (!ID_OK.test(g)) return; C.showTab("chats"); openGroup(g); } catch (e) {}
}
function addMenu() {
  var sheet = $("moreSheet"); if (!sheet || $("moreGroups")) return;
  var ico = function (d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d + '</svg>'; };
  [["moreGroups", T("Groups & voice", "ग्रुप और वॉइस"), ico('<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5.5M18 20a5 5 0 0 0-3-4.6"/>'), openGroups],
   ["moreInvite", T("Invite friends", "दोस्तों को बुलाओ"), ico('<circle cx="10" cy="8" r="3.5"/><path d="M3 20a7 7 0 0 1 14 0M19 8v6M16 11h6"/>'), openInvite]].forEach(function (x) {
    var b = el('<button type="button" id="' + x[0] + '">' + x[2] + '<span>' + x[1] + '</span></button>'); b.addEventListener("click", function () { sheet.hidden = true; x[3](); }); sheet.appendChild(b);
  });
}

export function initSocial(ctx) {
  stopSocial(); C = ctx; css(); shell(); addMenu();
  applyReferral(); refreshChallenge();
  C.chTimer = setInterval(refreshChallenge, 180000);
  setTimeout(joinFromLink, 900);
  window.__pulseSocial = { refreshChallenge: refreshChallenge, shareSong: shareSong, openInvite: openInvite, openGroups: openGroups, voiceState: function () { return V ? Object.keys(V.peers).map(function (k) { return V.peers[k].pc ? V.peers[k].pc.connectionState : "none"; }) : null; } };
}
export function stopSocial() {
  if (V) voiceLeave();
  if (G) { G.unsubs.forEach(function (u) { try { u(); } catch (e) {} }); G = null; }
  if (C && C.chTimer) clearInterval(C.chTimer);
  if (ui) ui.hidden = true; C = null;
}
// Share a published song as a picture card (called from the song list).
function shareSong(sd) {
  var link = WEB + "?ref=" + uid();
  return drawCard({ title: sd.title, sub: T("A song by " + sd.name + " on Pulse", sd.name + " का गाना, Pulse पर"), lines: (sd.lines || []).map(function (x) { return x.text; }), cta: T("Listen and make your own", "सुनो और अपना बनाओ"), link: link })
    .then(function (bl) { return shareImage(bl, T("Listen to “" + sd.title + "” on Pulse: ", "Pulse पर “" + sd.title + "” सुनो: ") + link); });
}
