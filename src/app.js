// Pulse (Firebase version): Auth + Firestore + Hosting, sab free (Spark) plan par.
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, deleteUser, sendEmailVerification } from "firebase/auth";
import {
  initializeFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, where, orderBy, limit,
  getDocs, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, Timestamp, writeBatch, increment, getCountFromServer
} from "firebase/firestore";
import { initAI, chat as aiChat, json as aiJson, aiWorking } from "./ai.js";
import { buildSong, Player, renderWav, GENRES } from "./music.js";
import * as Call from "./call.js";
import { DHAMS, art as dhamArt, photoOrArt, loadPhotos, daily as dailyDham, kindName, kindSym } from "./dham.js";
import { tr, getLang, setLang, initI18n } from "./i18n.js";

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var CREATOR_EMAIL = "jaihindkps@gmail.com";
  var auth, db, UID = null, ME = null, signingUp = false;
  var unsubs = [], blocked = new Set(), nameCache = {};

  var grads = ["linear-gradient(135deg,#7c4dff,#ff4d8d)","linear-gradient(135deg,#18c2a8,#7c4dff)","linear-gradient(135deg,#ff8a3d,#ff4d8d)","linear-gradient(135deg,#4d8dff,#18c2a8)","linear-gradient(135deg,#ff4d8d,#ff8a3d)","linear-gradient(135deg,#9b4dff,#4d8dff)"];
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  function g(key) { return grads[Math.abs(hash(String(key))) % grads.length]; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
  function ini(n) { return esc((n || "?").trim().charAt(0).toUpperCase()); }
  function ms(v) { return v && v.toMillis ? v.toMillis() : Date.now(); }
  function ago(t) {
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return "abhi"; if (s < 3600) return Math.floor(s / 60) + " min pehle";
    if (s < 86400) return Math.floor(s / 3600) + " ghante pehle"; return Math.floor(s / 86400) + " din pehle";
  }
  function hm(t) { var d = new Date(t); return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0"); }
  function snapData(d) { return d.data({ serverTimestamps: "estimate" }); }
  function pairId(a, b) { return a < b ? a + "_" + b : b + "_" + a; }
  function clean(s, n) { return String(s == null ? "" : s).trim().slice(0, n); }

  var toastEl = $("toast"), toastT;
  function toast(m) { toastEl.textContent = m; toastEl.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("show"); }, 2400); }
  function errMsg(e) {
    var c = (e && e.code) || "";
    var map = {
      "auth/email-already-in-use": "Ye email pehle se registered hai. Login karo.",
      "auth/invalid-email": "Email sahi likho.", "auth/weak-password": "Password kam se kam 6 akshar ka rakho.",
      "auth/invalid-credential": "Email ya password galat hai.", "auth/wrong-password": "Email ya password galat hai.", "auth/user-not-found": "Email ya password galat hai.",
      "auth/too-many-requests": "Bahut koshish ho gayi. Thodi der baad try karo.", "auth/network-request-failed": "Internet check karo.",
      "permission-denied": "Ye karne ki ijazat nahi hai.", "unavailable": "Internet check karo."
    };
    return map[c] || (e && e.message) || "Kuch gadbad ho gayi";
  }

  // ---- theme ----
  function isDark() { var t = root.getAttribute("data-theme"); return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches; }
  $("themeBtn").addEventListener("click", function () { root.setAttribute("data-theme", isDark() ? "light" : "dark"); });

  // ---- auth UI ----
  var mode = "login";
  function setMode(m) {
    mode = m;
    $("segLogin").classList.toggle("on", m === "login"); $("segSignup").classList.toggle("on", m === "signup");
    $("signupOnly").hidden = m === "login"; $("authBtn").textContent = m === "login" ? "Login" : "Account banao";
    $("aPass").setAttribute("autocomplete", m === "login" ? "current-password" : "new-password");
    $("aName").required = $("aAge").required = m === "signup"; $("authErr").textContent = "";
  }
  $("segLogin").addEventListener("click", function () { setMode("login"); });
  $("segSignup").addEventListener("click", function () { setMode("signup"); });

  $("authForm").addEventListener("submit", function (e) {
    e.preventDefault(); $("authErr").textContent = "";
    if (!auth) { $("authErr").textContent = "App abhi set nahi hui (firebase-config.json khaali hai)."; return; }
    var email = $("aUser").value.trim(), pw = $("aPass").value;
    $("authBtn").disabled = true;
    var p;
    if (mode === "login") {
      p = signInWithEmailAndPassword(auth, email, pw);
    } else {
      var age = parseInt($("aAge").value, 10), name = clean($("aName").value, 40);
      if (!name) { $("authErr").textContent = "Naam likho"; $("authBtn").disabled = false; return; }
      if (!(age >= 18 && age <= 99)) { $("authErr").textContent = "Ye app sirf 18+ ke liye hai"; $("authBtn").disabled = false; return; }
      if (!$("aAdult").checked) { $("authErr").textContent = "Please confirm you are 18+ and accept the policy"; $("authBtn").disabled = false; return; }
      signingUp = true;
      p = createUserWithEmailAndPassword(auth, email, pw).then(function (cred) {
        var prof = { name: name, age: age, city: clean($("aCity").value, 40), work: "", about: "", looking: $("aLooking").value, createdAt: serverTimestamp() };
        return setDoc(doc(db, "users", cred.user.uid), prof).then(function () { UID = cred.user.uid; ME = Object.assign({}, prof, { uid: UID }); signingUp = false; lastSent = Date.now(); return sendEmailVerification(cred.user).catch(function () { lastSent = 0; }).then(function () { return afterAuth(cred.user); }); })
          .catch(function (err) { return deleteUser(cred.user).catch(function () {}).then(function () { throw err; }); });
      });
    }
    p.then(function () { $("aPass").value = ""; }).catch(function (err) { signingUp = false; $("authErr").textContent = errMsg(err); }).then(function () { $("authBtn").disabled = false; });
  });
  $("logoutBtn").addEventListener("click", function () { signOut(auth).then(function () { toast("Logout ho gaye"); }); });

  function stopAll() { leaveRoom(true); stopNearby(); endCall(false); player.stop(); unsubs.forEach(function (u) { try { u(); } catch (e) {} }); unsubs = []; }

  // ---- start / stop ----
  function start() {
    $("auth").hidden = true;
    $("meAv").textContent = $("pAv").textContent = (ME.name || "?").charAt(0).toUpperCase();
    $("pName").textContent = ME.name; $("pHandle").textContent = ME.city || "";
    $("eName").value = ME.name || ""; $("eCity").value = ME.city || ""; $("eWork").value = ME.work || ""; $("eAbout").value = ME.about || ""; $("eLooking").value = ME.looking || "Dosti";
    getDocs(query(collection(db, "blocks"), where("blocker", "==", UID))).then(function (s) { blocked = new Set(); s.forEach(function (d) { blocked.add(d.data().blocked); }); }).catch(function () {}).then(function () {
      listenFeed(); listenMatches(); refreshLocToggle(); showTab("feed"); setLive(); paintAv(); creatorPanel(); pendingRoom();
    });
  }
  function init(cfg) {
    var app = initializeApp(cfg);
    auth = getAuth(app);
    db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    initAI(app);
    onAuthStateChanged(auth, function (u) {
      if (u) {
        if (signingUp) return;
        afterAuth(u);
      } else {
        stopAll(); UID = null; ME = null; $("livePill").hidden = true; showForms(); $("auth").hidden = false; $("convo").classList.remove("open"); activeChat = null;
      }
    });
  }

  // ---- email verification (asli insaan ka saboot) ----
  function showForms() { $("verifyBox").style.display = "none"; $("authForm").style.display = ""; $("segBox").style.display = ""; $("vErr").textContent = ""; }
  function showVerify(u) {
    $("auth").hidden = false; $("authForm").style.display = "none"; $("segBox").style.display = "none"; $("verifyBox").style.display = "";
    $("vMsg").textContent = "Verification mail " + u.email + " par bheji hai. Mail me link par click karo (Spam folder bhi dekho), phir niche button dabao.";
  }
  function afterAuth(u) {
    if (!u.emailVerified) { showVerify(u); return Promise.resolve(); }
    return getDoc(doc(db, "users", u.uid)).then(function (s) {
      if (!s.exists()) { signOut(auth); showForms(); $("auth").hidden = false; $("authErr").textContent = "Profile nahi mili. Naya account banao."; return; }
      return getDoc(doc(db, "bans", u.uid)).then(function (b) { if (b.exists()) { signOut(auth); showForms(); $("auth").hidden = false; $("authErr").textContent = "This account has been suspended for breaking the rules."; return; } showForms(); UID = u.uid; ME = Object.assign({}, s.data(), { uid: UID }); start(); });
    }).catch(function (e) { showForms(); $("auth").hidden = false; $("authErr").textContent = errMsg(e); });
  }
  var lastSent = 0;
  function sendVerify(u) {
    if (Date.now() - lastSent < 60000) { $("vErr").textContent = "Thodi der ruko (1 minute), phir dobara bhejo."; return Promise.resolve(); }
    lastSent = Date.now();
    return sendEmailVerification(u).then(function () { $("vErr").textContent = "Mail bhej di gayi."; }).catch(function (e) { lastSent = 0; $("vErr").textContent = errMsg(e); });
  }
  $("vDone").addEventListener("click", function () {
    var u = auth && auth.currentUser; if (!u) return; $("vErr").textContent = "";
    u.reload().then(function () { return u.getIdToken(true); }).then(function () {
      if (u.emailVerified) afterAuth(u); else $("vErr").textContent = "Abhi verify nahi hua. Mail ka link kholo, phir dobara dabao.";
    }).catch(function (e) { $("vErr").textContent = errMsg(e); });
  });
  $("vResend").addEventListener("click", function () { if (auth && auth.currentUser) sendVerify(auth.currentUser); });
  $("vOut").addEventListener("click", function () { signOut(auth); });

  // ---- tabs ----
  var titles = { feed: "Pulse", discover: "Discover", nearby: "Nearby", studio: "Gaana Studio", chats: "Messages", profile: "Profile" };
  var screens = ["feed", "discover", "nearby", "studio", "chats", "profile"];
  function showTab(name) {
    screens.forEach(function (s) { $("screen-" + s).hidden = s !== name; });
    document.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-tab") === name); });
    $("screenTitle").textContent = titles[name];
    if (name === "discover") loadDeck(); if (name === "nearby") loadNearby(); else stopNearby(); if (name === "studio") renderLib(); if (name === "chats") $("chatDot").hidden = true;
  }
  document.querySelectorAll(".tab").forEach(function (t) { t.addEventListener("click", function () { if (UID) showTab(t.getAttribute("data-tab")); }); });

  // ---- feed (realtime) ----
  var postText = $("composerText");
  postText.addEventListener("input", function () { this.style.height = "auto"; this.style.height = this.scrollHeight + "px"; $("postBtn").disabled = !this.value.trim(); $("charCount").textContent = this.value.length + "/500"; });
  $("postBtn").addEventListener("click", function () {
    var t = clean(postText.value, 500); if (!t || !rate("post", 4, 60000)) return; this.disabled = true;
    addDoc(collection(db, "posts"), { uid: UID, name: ME.name, text: t, likedBy: [], createdAt: serverTimestamp() })
      .then(function () { postText.value = ""; postText.style.height = "auto"; $("charCount").textContent = "0/500"; toast("Post ho gaya 🎉"); })
      .catch(function (e) { toast(errMsg(e)); $("postBtn").disabled = false; });
  });
  function listenFeed() {
    unsubs.push(onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50)), function (snap) {
      var f = $("feed"); f.innerHTML = ""; var n = 0;
      snap.forEach(function (d) {
        var p = snapData(d); if (blocked.has(p.uid)) return; n++;
        var liked = (p.likedBy || []).indexOf(UID) >= 0;
        var node = el('<article class="post"><div class="post-head"><div class="av-sm" style="background:' + g(p.uid) + '">' + ini(p.name) + '</div><div class="who"><div class="name">' + esc(p.name) + '</div><div class="meta">' + ago(ms(p.createdAt)) + '</div></div></div><p class="post-text">' + esc(p.text) + '</p><div class="post-actions"><button class="act like ' + (liked ? "liked" : "") + '"><svg viewBox="0 0 24 24" fill="' + (liked ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-4.3-9.3-8.5C.9 9.4 2.4 6 5.6 6c1.9 0 3.2 1.1 4.4 2.5C11.2 7.1 12.5 6 14.4 6c3.2 0 4.7 3.4 2.9 6.5C19 16.7 12 21 12 21Z"/></svg><span class="cnt">' + (p.likedBy || []).length + '</span></button></div></article>');
        node.querySelector(".like").addEventListener("click", function () {
          updateDoc(d.ref, { likedBy: liked ? arrayRemove(UID) : arrayUnion(UID) }).catch(function (e) { toast(errMsg(e)); });
        });
        f.appendChild(node);
      });
      if (!n) f.innerHTML = '<div class="empty">Abhi koi post nahi. Pehli post aap likho! ✍️</div>';
    }, function (e) { toast(errMsg(e)); }));
  }

  // ---- discover ----
  var queue = [], dragging = false, sx = 0, cx = 0, topCard = null, topUser = null, busy = false;
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function loadDeck() {
    Promise.all([getDocs(query(collection(db, "users"), limit(100))), getDocs(query(collection(db, "swipes"), where("from", "==", UID)))]).then(function (r) {
      var done = new Set(); r[1].forEach(function (d) { done.add(d.data().to); });
      var list = []; r[0].forEach(function (d) { if (d.id !== UID && !done.has(d.id) && !blocked.has(d.id)) list.push(Object.assign({ id: d.id }, d.data())); });
      queue = shuffle(list).slice(0, 20); renderDeck();
    }).catch(function (e) { toast(errMsg(e)); });
  }
  function renderDeck() {
    var deck = $("deck"); deck.innerHTML = ""; topCard = topUser = null;
    if (!queue.length) { deck.innerHTML = '<div class="deck-empty"><div><div style="font-size:42px;margin-bottom:8px">💫</div><div style="font-weight:700;font-size:16px;color:var(--fg);margin-bottom:4px">Abhi itne hi log</div><div style="font-size:13px">Jaise-jaise naye log judenge, yahan dikhenge. Doston ko Pulse bhejo!</div></div></div>'; return; }
    queue.slice(0, 3).reverse().forEach(function (u, i, arr) {
      var top = i === arr.length - 1, depth = arr.length - 1 - i;
      var c = el('<div class="swipe-card" style="background:' + g(u.id) + ';transform:translateY(' + depth * 14 + 'px) scale(' + (1 - depth * 0.05) + ')"><div class="scrim"></div><div class="avatar-big"' + (u.photo && JPEG.test(u.photo) ? ' style="background:center/cover url(' + u.photo + ')"' : "") + '>' + (u.photo && JPEG.test(u.photo) ? "" : ini(u.name)) + '</div><span class="stamp like">Like</span><span class="stamp nope">Nope</span><div class="info"><h3>' + esc(u.name) + (u.age ? ", " + u.age : "") + '</h3><div class="sub">' + esc([u.work, u.city].filter(Boolean).join(" · ") || "Pulse member") + '</div>' + (u.about ? '<p class="about">' + esc(u.about) + '</p>' : '') + '<div class="tags"><span>' + esc(u.looking || "Dosti") + '</span></div></div></div>');
      deck.appendChild(c);
      if (top) { topCard = c; topUser = u; drag(c); }
    });
  }
  function drag(c) {
    function down(x) { dragging = true; sx = x; cx = 0; c.style.transition = "none"; }
    function move(x) { if (!dragging) return; cx = x - sx; c.style.transform = "translateX(" + cx + "px) rotate(" + cx * 0.06 + "deg)"; c.querySelector(".stamp.like").style.opacity = Math.max(0, cx / 90); c.querySelector(".stamp.nope").style.opacity = Math.max(0, -cx / 90); }
    function up() { if (!dragging) return; dragging = false; c.style.transition = "transform .3s"; if (cx > 95) swipe("like"); else if (cx < -95) swipe("pass"); else { c.style.transform = ""; c.querySelectorAll(".stamp").forEach(function (s) { s.style.opacity = 0; }); } }
    c.addEventListener("mousedown", function (e) { down(e.clientX); }); window.addEventListener("mousemove", function (e) { move(e.clientX); }); window.addEventListener("mouseup", up);
    c.addEventListener("touchstart", function (e) { down(e.touches[0].clientX); }, { passive: true }); c.addEventListener("touchmove", function (e) { move(e.touches[0].clientX); }, { passive: true }); c.addEventListener("touchend", up);
  }
  function swipe(kind) {
    if (!topUser || busy) return; busy = true;
    var u = topUser, c = topCard; c.style.transition = "transform .35s"; c.style.transform = "translateX(" + (kind === "like" ? 600 : -600) + "px) rotate(" + (kind === "like" ? 30 : -30) + "deg)";
    queue.shift();
    setDoc(doc(db, "swipes", UID + "_" + u.id), { from: UID, to: u.id, kind: kind, createdAt: serverTimestamp() }).then(function () {
      if (kind !== "like") return;
      return getDoc(doc(db, "swipes", u.id + "_" + UID)).then(function (s) {
        if (!s.exists() || s.data().kind !== "like") return;
        var mref = doc(db, "matches", pairId(UID, u.id)), ids = [UID, u.id].sort();
        return getDoc(mref).then(function (m) {
          if (m.exists()) { showMatch(u); return; } // doosre ne pehle hi match bana diya
          return setDoc(mref, { users: ids, createdAt: serverTimestamp(), lastText: "", lastAt: serverTimestamp(), lastFrom: "" }).then(function () { showMatch(u); });
        });
      });
    }).catch(function (e) { toast(errMsg(e)); });
    setTimeout(function () { busy = false; renderDeck(); }, 260);
  }
  $("btnLike").addEventListener("click", function () { swipe("like"); });
  $("btnNope").addEventListener("click", function () { swipe("pass"); });
  var matchWith = null;
  function showMatch(u) { matchWith = u; $("matchMe").textContent = ini(ME.name); $("matchAv").textContent = ini(u.name); $("matchAv").style.background = g(u.id); $("matchName").textContent = u.name + " ne bhi aapko like kiya 💜"; $("matchPop").classList.add("show"); }
  $("matchKeep").addEventListener("click", function () { $("matchPop").classList.remove("show"); });
  $("matchChat").addEventListener("click", function () { $("matchPop").classList.remove("show"); if (matchWith) { showTab("chats"); openChat({ id: matchWith.id, mid: pairId(UID, matchWith.id), name: matchWith.name }); } });

  // ---- nearby (opt-in, ~1 km grid par round ki hui location) ----
  function round2(x) { return Math.round(x * 100) / 100; }
  function distKm(a, b, c, d) { var R = 6371, r = Math.PI / 180, dLat = (c - a) * r, dLng = (d - b) * r, x = Math.sin(dLat / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); }
  function getPos(ok, fail) {
    if (!navigator.geolocation) return fail(); navigator.geolocation.getCurrentPosition(function (p) { ok(p.coords.latitude, p.coords.longitude); }, fail, { enableHighAccuracy: false, timeout: 10000 });
  }
  function publishPresence(lat, lng) {
    return setDoc(doc(db, "presence", UID), { lat: round2(lat), lng: round2(lng), name: ME.name, age: ME.age, work: ME.work || "", city: ME.city || "", updatedAt: serverTimestamp() });
  }
  function shareLocation() {
    toast("Location maangi ja rahi hai...");
    getPos(function (lat, lng) { publishPresence(lat, lng).then(function () { $("locToggle").classList.add("on"); loadNearby(); toast("Location ON"); }).catch(function (e) { toast(errMsg(e)); }); },
      function () { toast("Location ki permission nahi mili. Browser/phone settings me allow karo."); });
  }
  function stopShare() { return deleteDoc(doc(db, "presence", UID)).then(function () { $("locToggle").classList.remove("on"); toast("Location sharing band"); }).catch(function (e) { toast(errMsg(e)); }); }
  function refreshLocToggle() { getDoc(doc(db, "presence", UID)).then(function (s) { $("locToggle").classList.toggle("on", s.exists()); }).catch(function () {}); }
  var nearUnsub = null, nearTimer = null;
  function stopNearby() { if (nearUnsub) { nearUnsub(); nearUnsub = null; } clearInterval(nearTimer); nearTimer = null; }
  function invite() {
    var url = location.origin + location.pathname, text = "Pulse pe aao: dosti, dating, gaana aur live chat. Join karo:";
    if (navigator.share) navigator.share({ title: "Pulse", text: text, url: url }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text + " " + url).then(function () { toast("Invite link copy ho gaya 📋"); }).catch(function () { toast(url); });
    else toast(url);
  }
  $("inviteBtn").addEventListener("click", invite);
  function loadNearby() {
    stopNearby();
    getDoc(doc(db, "presence", UID)).then(function (mine) {
      var box = $("nearbyBox"); box.innerHTML = "";
      if (!mine.exists()) {
        box.appendChild(el('<div class="optin"><div class="halo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div><h3>Aas-paas ke log</h3><p>Apni location share karke un logon ko dekho jinhone <b>khud</b> bhi sharing ON ki hai.</p><div class="consent">🔒 <b>Aapki marzi:</b> Sirf aap jab chaho tab share hoga. Jinhone share nahi kiya, unki location, naam ya number kabhi nahi dikhega. Share karne par aapki location lagbhag 1 km ke daayre me <b>mota-mota</b> (rounded) save hoti hai, aur doosre opt-in logon ko sirf doori dikhti hai. Kabhi bhi band kar sakte ho.</div><button class="btn-grad" id="shareLoc" style="width:100%;padding:13px">Location share karo</button></div>'));
        $("shareLoc").addEventListener("click", shareLocation); return;
      }
      var me = mine.data();
      function go(m) { me = m; render(m); }
      getPos(function (lat, lng) { publishPresence(lat, lng).catch(function () {}); go({ lat: round2(lat), lng: round2(lng) }); }, function () { go(me); });
      function render(m) {
        box.innerHTML = "";
        box.appendChild(el('<div class="nearby-banner">🟢 Live: aapki location ON hai. Sirf opt-in log dikh rahe hain.<button id="stopShare">Band karo</button></div>'));
        $("stopShare").addEventListener("click", function () { stopNearby(); stopShare().then(loadNearby); });
        var list = el('<div></div>'); box.appendChild(list);
        var since = Timestamp.fromMillis(Date.now() - 6 * 3600e3);
        nearUnsub = onSnapshot(query(collection(db, "presence"), where("updatedAt", ">", since), limit(200)), function (s) {
          var rows = [];
          s.forEach(function (d) { if (d.id === UID || blocked.has(d.id)) return; var p = snapData(d); var k = distKm(m.lat, m.lng, p.lat, p.lng); if (k <= 50) rows.push({ id: d.id, p: p, km: k }); });
          rows.sort(function (a, b) { return a.km - b.km; });
          list.innerHTML = "";
          if (!rows.length) { var em = el('<div class="empty">Abhi aas-paas (50 km) koi aur opt-in user nahi. Doston ko bulao! 👋<br><button class="btn-grad" id="nearInvite" style="margin-top:12px;padding:11px 18px">📨 Invite bhejo</button></div>'); list.appendChild(em); em.querySelector("#nearInvite").addEventListener("click", invite); return; }
          list.appendChild(el('<div class="section-title">Abhi aas-paas · ' + rows.length + ' log (live)</div>'));
          rows.slice(0, 50).forEach(function (r) {
            var dist = r.km < 1 ? "1 km se kam" : "~" + Math.round(r.km) + " km";
            var row = el('<div class="nearby-row"><div class="av-sm" style="width:50px;height:50px;font-size:18px;background:' + g(r.id) + '">' + ini(r.p.name) + '</div><div class="body"><div class="nm">' + esc(r.p.name) + (r.p.age ? ", " + esc(r.p.age) : "") + '</div><div class="meta">📍 ' + dist + ' · ' + esc(r.p.work || r.p.city || "Pulse member") + '</div></div><button class="wave">💬 Chat</button></div>');
            row.querySelector(".wave").addEventListener("click", function () {
              var mt = matchDocs.filter(function (x) { return x.id === r.id; })[0];
              if (mt) { showTab("chats"); openChat({ id: r.id, mid: mt.mid, name: r.p.name }); } else toast("Pehle Discover me match karo, phir chat khulega 💜");
            });
            list.appendChild(row);
          });
        }, function (e) { toast(errMsg(e)); });
        nearTimer = setInterval(function () { if (document.hidden) return; getPos(function (lat, lng) { publishPresence(lat, lng).catch(function () {}); }, function () {}); }, 300000);
      }
    }).catch(function (e) { toast(errMsg(e)); });
  }
  $("locToggle").addEventListener("click", function () { if (this.classList.contains("on")) stopShare(); else shareLocation(); });

  // ---- profile edit ----
  $("saveProfile").addEventListener("click", function () {
    var upd = { name: clean($("eName").value, 40) || ME.name, city: clean($("eCity").value, 40), work: clean($("eWork").value, 60), about: clean($("eAbout").value, 300), looking: $("eLooking").value };
    updateDoc(doc(db, "users", UID), upd).then(function () { Object.assign(ME, upd); $("pName").textContent = ME.name; $("pHandle").textContent = ME.city || ""; toast("Profile save ho gayi ✅"); }).catch(function (e) { toast(errMsg(e)); });
  });

  // ---- chats ----
  var SAATHI = { id: "saathi", name: "Saathi AI", ai: true };
  var matchDocs = [], firstMatches = true, activeChat = null, msgUnsub = null;
  function userName(uid) {
    if (nameCache[uid]) return Promise.resolve(nameCache[uid]);
    return getDoc(doc(db, "users", uid)).then(function (s) { nameCache[uid] = s.exists() ? s.data().name : "Pulse member"; return nameCache[uid]; }).catch(function () { return "Pulse member"; });
  }
  function listenMatches() {
    firstMatches = true;
    unsubs.push(onSnapshot(query(collection(db, "matches"), where("users", "array-contains", UID)), function (snap) {
      if (!firstMatches) {
        snap.docChanges().forEach(function (ch) {
          var m = snapData(ch.doc), other = m.users.filter(function (x) { return x !== UID; })[0];
          if (blocked.has(other) || (ch.doc.metadata && ch.doc.metadata.hasPendingWrites)) return;
          if (ch.type === "modified" && m.lastFrom && m.lastFrom !== UID) maybeIncoming(ch.doc.id, m, other);
          if (ch.type === "added" && !matchWith) { userName(other).then(function (n) { toast("🎉 Naya match: " + n); }); $("chatDot").hidden = false; }
          else if (ch.type === "modified" && m.lastFrom && m.lastFrom !== UID && ms(m.lastAt) !== lastSeenAt[ch.doc.id] && !(activeChat && activeChat.mid === ch.doc.id)) { userName(other).then(function (n) { toast("💬 " + n + ": " + String(m.lastText).slice(0, 40)); pushLocal(n, String(m.lastText).slice(0, 80)); }); $("chatDot").hidden = false; }
        });
      }
      firstMatches = false;
      snap.docs.forEach(function (d) { var m = snapData(d); lastSeenAt[d.id] = ms(m.lastAt); });
      matchDocs = snap.docs.map(function (d) {
        var m = snapData(d), o = m.users.filter(function (x) { return x !== UID; })[0];
        var ty = m["typing_" + o] ? ms(m["typing_" + o]) : 0;
        if (ty && typingSeen[d.id] !== undefined && typingSeen[d.id] !== ty) typingUntil[d.id] = Date.now() + 6000;
        if (!ty) typingUntil[d.id] = 0;
        typingSeen[d.id] = ty;
        var mySeen = m["seen_" + UID] ? ms(m["seen_" + UID]) : 0, theirSeen = m["seen_" + o] ? ms(m["seen_" + o]) : 0;
        return { mid: d.id, id: o, last: m.lastText, at: ms(m.lastAt), lastFrom: m.lastFrom, theirSeen: theirSeen, unread: !!(m.lastFrom && m.lastFrom !== UID && ms(m.lastAt) > mySeen) };
      }).filter(function (c) { return !blocked.has(c.id); }).sort(function (a, b) { return b.at - a.at; });
      renderChats(); liveStatus();
    }, function (e) { toast(errMsg(e)); }));
  }
  // ---- connection pill: Live / Offline ----
  function setLive() { var on = navigator.onLine !== false, p = $("livePill"); p.hidden = !UID; p.classList.toggle("off", !on); $("liveTxt").textContent = on ? "Live" : "Offline"; }
  window.addEventListener("online", function () { setLive(); toast("Wapas online 🟢"); }); window.addEventListener("offline", function () { setLive(); toast("Internet nahi hai. Message wapas aate hi chale jaayenge."); });
  // ---- live status: "likh raha hai...", "Dekha", unread ----
  var lastSeenAt = {}, typingSeen = {}, typingUntil = {}, typingT = null, lastTypingSent = 0, typingOn = false;
  function curMatch() { if (!activeChat || activeChat.ai) return null; for (var i = 0; i < matchDocs.length; i++) if (matchDocs[i].mid === activeChat.mid) return matchDocs[i]; return null; }
  function liveStatus() {
    var c = curMatch(); if (!c) return;
    var left = (typingUntil[c.mid] || 0) - Date.now(), typing = left > 0;
    $("convoStatus").textContent = typing ? "likh raha hai..." : "";
    var body = $("convoBody"), dots = body.querySelector(".typing");
    if (typing && !dots) { body.appendChild(el('<div class="typing"><i></i><i></i><i></i></div>')); body.scrollTop = body.scrollHeight; }
    if (!typing && dots) dots.remove();
    clearTimeout(typingT); if (typing) typingT = setTimeout(liveStatus, left + 50);
    markSeenTick(c);
    if (c.unread && !document.hidden) updateDoc(doc(db, "matches", c.mid), obj("seen_" + UID, serverTimestamp())).catch(function () {});
  }
  function obj(k, v) { var o = {}; o[k] = v; return o; }
  function markSeenTick(c) {
    var old = $("convoBody").querySelector(".seen-tick"); if (old) old.remove();
    var mine = $("convoBody").querySelectorAll(".bubble.me"); if (!mine.length || !c || c.lastFrom !== UID) return;
    if (c.theirSeen && c.theirSeen >= c.at) mine[mine.length - 1].insertAdjacentHTML("afterend", '<div class="seen-tick">✓✓ Dekha</div>');
  }
  function setTyping(on) {
    var c = curMatch(); if (!c) return;
    if (on && Date.now() - lastTypingSent < 4000) return;
    if (!on && !typingOn) return;
    typingOn = on; lastTypingSent = on ? Date.now() : 0;
    updateDoc(doc(db, "matches", c.mid), obj("typing_" + UID, on ? serverTimestamp() : null)).catch(function () {});
  }
  document.addEventListener("visibilitychange", function () { if (!document.hidden) liveStatus(); });
  function renderChats() {
    var l = $("chatList"); l.innerHTML = "";
    function row(c, last, sub, ai) {
      var r = el('<div class="chat-row" tabindex="0"><div class="chat-av"><div class="av-sm" style="width:50px;height:50px;font-size:' + (ai ? 22 : 18) + 'px;background:' + g(c.id) + '">' + (ai ? "✦" : ini(c.name || "?")) + '</div></div><div class="body"><div class="top"><span class="nm">' + esc(c.name || "...") + (ai ? '<span class="ai-pill">AI</span>' : '') + '</span><span class="tm">' + esc(sub) + '</span></div><div class="prev">' + esc(last) + '</div></div></div>');
      r.addEventListener("click", function () { openChat(c); });
      l.appendChild(r); return r;
    }
    row(SAATHI, "Dil ki baat karo. Main AI hoon, sunne ke liye yahin hoon 💜", "", true);
    var shown = matchDocs.filter(function (c) { return !blocked.has(c.id); });
    shown.forEach(function (c) {
      var r = row({ id: c.id, mid: c.mid, name: nameCache[c.id] || "..." }, c.last ? ((c.lastFrom === UID ? "Aap: " : "") + c.last) : "Match ho gaya! Hi bolo 👋", c.last ? hm(c.at) : "");
      if (c.unread && !(activeChat && activeChat.mid === c.mid)) { r.querySelector(".prev").classList.add("unread"); r.appendChild(el('<span class="unread-dot">•</span>')); }
      if (!nameCache[c.id]) userName(c.id).then(function (n) { r.querySelector(".nm").textContent = n; r.querySelector(".av-sm").textContent = n.charAt(0).toUpperCase(); });
    });
    $("chatDot").hidden = !shown.some(function (c) { return c.unread && !(activeChat && activeChat.mid === c.mid); });
    if (!shown.length) l.appendChild(el('<div class="empty">Abhi koi chat nahi. Discover me swipe karo. Match hote hi chat yahan khulegi.</div>'));
  }

  function addBubble(m) {
    var sys = $("convoBody").querySelector(".sys"); if (sys) sys.remove();
    var big = !m.img && /^(\p{Extended_Pictographic}|\u200d|\ufe0f|\s){1,3}$/u.test(m.text || "");
    var b = el('<div class="bubble ' + (m.mine ? "me" : "them") + (big ? " big-emoji" : "") + '">' + (m.img && JPEG.test(m.img) ? '<img class="chat-img" src="' + m.img + '" alt="photo">' : "") + (m.img ? "" : esc(m.text)) + (m.warn ? '<span class="warn">⚠️ Savdhan: paisa, OTP ya bank details kabhi mat bhejo. Shak ho to Report karo.</span>' : '') + '<span class="t">' + hm(m.at) + '</span></div>');
    var im = b.querySelector(".chat-img"); if (im) im.addEventListener("click", function () { viewImg(m.img); });
    $("convoBody").appendChild(b); $("convoBody").scrollTop = $("convoBody").scrollHeight; return b;
  }
  function closeMsgListener() { if (msgUnsub) { msgUnsub(); msgUnsub = null; } }
  function openChat(c) {
    closeMsgListener(); if (!c.ai && nameCache[c.id]) c.name = nameCache[c.id]; activeChat = c;
    if (!c.ai && (!c.name || c.name === "...")) userName(c.id).then(function (n) { c.name = n; if (activeChat === c) { $("convoName").textContent = n; $("convoAv").textContent = ini(n); } });
    var av = $("convoAv"); av.textContent = c.ai ? "✦" : ini(c.name); av.style.background = g(c.id);
    $("convoName").innerHTML = esc(c.name) + (c.ai ? '<span class="ai-pill">AI</span>' : ""); $("convoStatus").textContent = c.ai ? "Hamesha online" : "";
    $("moreBtn").hidden = !!c.ai; $("medBar").hidden = true; $("callBtn").hidden = $("wtBtn").hidden = !!c.ai;
    var body = $("convoBody"); body.innerHTML = "";
    if (c.ai) {
      body.appendChild(el('<div class="ai-note">✦ Saathi ek AI companion hai, asli insaan nahi. Ye baat karne aur sunne ke liye hai, doctor ya counsellor ka vikalp nahi. Zyada pareshan ho to kisi apne se ya helpline se zaroor baat karo.</div>'));
      getDocs(query(collection(db, "users", UID, "saathi"), orderBy("createdAt", "asc"), limit(60))).then(function (s) {
        if (activeChat !== c) return;
        saathiHist = [];
        if (s.empty) addBubble({ mine: false, text: (getLang() === "en" ? "Hello " : "Namaste ") + ME.name + " 🙏 Main Saathi hoon, ek AI. Din kaisa raha?", at: Date.now() });
        s.forEach(function (d) { var m = snapData(d); addBubble({ mine: m.role === "user", text: m.text, at: ms(m.createdAt) }); saathiHist.push({ role: m.role === "user" ? "user" : "model", text: m.text }); });
      }).catch(function () {});
    } else {
      msgUnsub = onSnapshot(query(collection(db, "matches", c.mid, "messages"), orderBy("createdAt", "asc"), limit(200)), function (s) {
        body.innerHTML = "";
        if (s.empty) body.appendChild(el('<div class="sys">Match ho gaya! Pehla message aap bhejo 👋</div>'));
        var med = { state: "off" }, hist = [];
        s.forEach(function (d) {
          var m = snapData(d); if (m.call && m.call.k === "answer") return;
          if (m.med) {
            var k = m.med.k, sys = body.querySelector(".sys"); if (sys) sys.remove();
            if (k === "ask") med = { state: "pending", asker: m.from }; else if (k === "yes" && med.state === "pending" && m.from !== med.asker) med = { state: "on" }; else if (k === "off" || k === "no") med = { state: "off" };
            body.appendChild(el(k === "say" ? '<div class="med-note"><b>🤝 AI Mediator</b>' + esc(String(m.text).replace(/^🤝 AI Mediator:\s*/, "")) + '</div>' : '<div class="med-note"><b>🤝 Mediator</b>' + esc(m.text) + '</div>'));
            return;
          }
          hist.push({ from: m.from, text: m.text });
          addBubble({ mine: m.from === UID, text: m.text, img: m.img, at: ms(m.createdAt), warn: m.from !== UID && SCAM_MONEY.test(m.text) });
        });
        c.med = med; c.hist = hist; renderMed(); body.scrollTop = body.scrollHeight;
        liveStatus();
      }, function (e) { toast(errMsg(e)); });
    }
    $("convo").classList.add("open");
  }
  $("convoBack").addEventListener("click", function () { setTyping(false); $("convo").classList.remove("open"); closeMsgListener(); activeChat = null; renderChats(); });

  var saathiHist = [], fbIdx = 0, saathiBusy = false;
  var SAATHI_SYS = "Tum 'Saathi' ho, Pulse app ka AI companion. Tum ek AI ho, insaan nahi: kabhi insaan hone ka, asli girlfriend/boyfriend hone ka ya bhavnayein 'mehsoos' karne ka dava mat karo; agar koi puche to saaf batao ki tum AI ho. Hinglish me (Roman Hindi) chhote, garm, natural jawab do: 2-4 vakya, kabhi-kabhi ek emoji. Pehle suno aur samjho, phir ek halka sawaal ya chhota sujhaav do. Har baar alag shabdon me bolo, pichhla jawab dohrao mat. Tum doctor/therapist nahi ho; dawa, diagnosis ya kanooni salaah mat do. Gaali, hinsa, nafrat ya vayask-yaun baatein nahi. Koi phone number, address ya doosre logon ki niji jaankari mat maango ya dedo. Agar user khud ko nuksan pahunchane ki baat kare to pyaar se kaho ki kisi apne se ya helpline se turant baat kare.";
  var CRISIS = /(suicide|sucide|khudkushi|khud\s*kushi|mar\s*jana|marna\s*chahta|marna\s*chahti|jaan\s*de|jeena\s*nahi|jeene\s*ka\s*mann\s*nahi|zindagi\s*khatam|khud\s*ko\s*(khatam|nuksan|hurt|maar)|end\s*my\s*life|kill\s*myself|self[\s-]*harm)/i;
  var CRISIS_REPLY = "Mujhe aapki fikr ho rahi hai, aur aap ye baat share kar paaye, ye zaroori hai. 💜 Main AI hoon aur is waqt aapko asli insaan ka saath chahiye. Abhi kisi apne ko phone karo ya unke paas chale jao, aur apne sheher ki madad-sewa se baat karo. Kya aap abhi surakshit jagah par ho?";
  var OFFLINE = [
    function (t) { return "Aapne kaha: \"" + t.slice(0, 40) + (t.length > 40 ? "..." : "") + "\". Ye sunke dhyaan aaya. Is baat me sabse bhaari kya lag raha hai? 💜"; },
    function () { return "Main samajh raha hoon. Chalo ek chhoti si cheez: abhi 3 gehri saansein lo, phir mujhe bataao kya sabse pehle theek karna chahoge? 🌱"; },
    function () { return "Bilkul, aap jaldi mein nahi ho. Is baat ka koi ek pal batao jab sab thoda halka laga tha? ✨"; },
    function () { return "Ye bahut kuch hai sambhalne ko. Isme se kaunsi cheez aapke control me hai aur kaunsi nahi? 🤝"; },
    function () { return "Sun raha hoon. Thoda aur khol ke bataoge? Kab se aisa lag raha hai? 🙂"; }
  ];
  function offlineReply(t) { var r = OFFLINE[fbIdx++ % OFFLINE.length](t); return r; }
  function saathiTalk(c, t) {
    var col = collection(db, "users", UID, "saathi");
    addBubble({ mine: true, text: t, at: Date.now() });
    addDoc(col, { role: "user", text: t, createdAt: serverTimestamp() }).catch(function () {});
    saathiHist.push({ role: "user", text: t });
    function finish(txt) { saathiHist.push({ role: "model", text: txt }); saathiHist = saathiHist.slice(-14); addDoc(col, { role: "assistant", text: txt, createdAt: serverTimestamp() }).catch(function () {}); saathiBusy = false; }
    if (CRISIS.test(t)) { setTimeout(function () { if (activeChat === c) addBubble({ mine: false, text: CRISIS_REPLY, at: Date.now() }); finish(CRISIS_REPLY); }, 500); return; }
    if (saathiBusy) return; saathiBusy = true;
    var typing = el('<div class="typing"><i></i><i></i><i></i></div>'); $("convoBody").appendChild(typing); $("convoBody").scrollTop = 1e9;
    var bub = null;
    aiChat(SAATHI_SYS + " User ka naam: " + ME.name + ".", saathiHist.slice(-12), function (part) {
      if (activeChat !== c) return; typing.remove();
      if (!bub) bub = addBubble({ mine: false, text: part, at: Date.now() });
      else { bub.firstChild.nodeValue = part; $("convoBody").scrollTop = 1e9; }
    }).then(function (full) { typing.remove(); $("convoStatus").textContent = "AI online ✦"; if (activeChat === c && !bub) addBubble({ mine: false, text: full, at: Date.now() }); finish(full); })
      .catch(function () {
        typing.remove(); var r = offlineReply(t); $("convoStatus").textContent = "AI band: simple jawab";
        if (activeChat === c) { if (bub) bub.remove(); addBubble({ mine: false, text: r, at: Date.now() }); } finish(r);
      });
  }
  function sendMsg() {
    var inp = $("msgInput"), t = clean(inp.value, 1000); if (!t || !activeChat) return; var c = activeChat; inp.value = "";
    if (!rate("msg", 10, 10000)) { inp.value = t; return; }
    if (c.ai) { saathiTalk(c, t); return; }
    if (SCAM_MONEY.test(t) || PII.test(t)) { if (!window.confirm("⚠️ Safety: paisa, OTP, bank details, phone number ya link bhejna risky ho sakta hai. Pehle bharosa banao. Phir bhi bhejna hai?")) { inp.value = t; return; } }
    var b = writeBatch(db), mref = doc(collection(db, "matches", c.mid, "messages"));
    b.set(mref, { from: UID, text: t, createdAt: serverTimestamp() });
    var upd = { lastText: t, lastAt: serverTimestamp(), lastFrom: UID }; upd["typing_" + UID] = null; typingOn = false; lastTypingSent = 0;
    b.update(doc(db, "matches", c.mid), upd);
    b.commit().catch(function (e) { toast(e && e.code === "permission-denied" ? "Ye user available nahi hai" : errMsg(e)); });
  }
  $("sendBtn").addEventListener("click", sendMsg);
  $("msgInput").addEventListener("keydown", function (e) { if (e.key === "Enter") sendMsg(); });
  var idleT = null;
  $("msgInput").addEventListener("input", function () { if (!this.value.trim()) { setTyping(false); return; } setTyping(true); clearTimeout(idleT); idleT = setTimeout(function () { setTyping(false); }, 5000); });

  $("moreBtn").addEventListener("click", function () {
    if (!activeChat || activeChat.ai) return;
    var body = $("convoBody"); if (body.querySelector(".safety")) return;
    var u = activeChat;
    var box = el('<div class="ai-note safety">' + esc(u.name) + ' ke saath: <button class="btn-outline" id="doBlock" style="margin:8px 4px 0;padding:8px 14px">Block karo</button><button class="btn-outline" id="doReport" style="margin:8px 4px 0;padding:8px 14px">Report karo</button><button class="btn-outline" id="doMeet" style="margin:8px 4px 0;padding:8px 14px">📍 Safe meet</button><div style="font-size:12px;margin-top:8px;color:var(--muted)">Pehli mulaqat: din me, public jagah, kisi apne ko batakar.</div></div>');
    body.appendChild(box); body.scrollTop = 1e9;
    $("doBlock").addEventListener("click", function () {
      setDoc(doc(db, "blocks", UID + "_" + u.id), { blocker: UID, blocked: u.id, createdAt: serverTimestamp() }).then(function () { blocked.add(u.id); toast("Block kar diya"); $("convo").classList.remove("open"); closeMsgListener(); activeChat = null; renderChats(); }).catch(function (e) { toast(errMsg(e)); });
    });
    $("doMeet").addEventListener("click", function () { safeMeet(u); });
    $("doReport").addEventListener("click", function () {
      addDoc(collection(db, "reports"), { from: UID, to: u.id, reason: "Chat se report", createdAt: serverTimestamp() }).then(function () { toast("Report bhej di. Shukriya."); box.remove(); }).catch(function (e) { toast(errMsg(e)); });
    });
  });

  // ---- Gaana Studio ----
  var player = new Player(), curSong = null, curMeta = null, LIBKEY = "pulse_songs_v1";
  Object.keys(GENRES).forEach(function (k) { $("stGenre").appendChild(new Option(GENRES[k].name, k)); });
  var SONG_SYS = "Tum ek geetkaar ho. Sirf ORIGINAL bol likho: kisi maujooda gaane ke bol ya kisi artist ki nakal nahi. Hinglish (Roman Hindi) me likho. Sirf JSON do: {\"title\":string,\"minor\":boolean,\"bpm\":number(70-130),\"lines\":[{\"section\":\"Verse 1\"|\"Chorus\"|\"Verse 2\"|\"Bridge\",\"text\":string}]}. Theek 8 se 12 lines, har line 4-9 shabd, Chorus ki 2 line do baar aa sakti hain. Gaali, hinsa, nafrat, vayask baatein aur asli logon ke naam nahi.";
  function fallbackSong(idea, genre, mood) {
    var w = idea.split(/\s+/).filter(function (x) { return x.length > 3; }), k = (w[0] || "zindagi").replace(/[^\p{L}\p{N}]/gu, "") || "zindagi", k2 = w[1] || "khushi";
    var L = [["Verse 1", "Aaj phir " + k + " ki yaad aayi"], ["Verse 1", "Dil ne chupke se awaaz lagayi"], ["Verse 1", "Raaton ke saath chalti hai " + k2], ["Verse 1", "Subah ne naye rang bikhraye"],
      ["Chorus", "Chal chal re dil, chal chal re"], ["Chorus", "Har pal naya safar hai"], ["Chorus", "Chal chal re dil, chal chal re"], ["Chorus", "Tu hai to sab sundar hai"],
      ["Verse 2", "Raaste mushkil sahi, par haunsla hai"], ["Verse 2", "Ek muskaan se roshan jahan hai"], ["Chorus", "Chal chal re dil, chal chal re"], ["Chorus", "Har pal naya safar hai"]];
    return { title: k.charAt(0).toUpperCase() + k.slice(1) + " ki dhun", minor: mood === "udaas" || mood === "shaanti", bpm: 0, lines: L.map(function (x) { return { section: x[0], text: x[1] }; }) };
  }
  function normSong(j) {
    var lines = (j && Array.isArray(j.lines) ? j.lines : []).map(function (x) { return { section: clean(x && x.section, 20), text: clean(x && x.text, 90) }; }).filter(function (x) { return x.text; }).slice(0, 12);
    if (lines.length < 4) return null;
    return { title: clean(j.title, 60) || "Meri dhun", minor: !!j.minor, bpm: +j.bpm || 0, lines: lines };
  }
  function showSong(meta) {
    player.stop(); $("stPlay").textContent = "▶ Chalao"; $("stBar").style.width = "0";
    curMeta = meta; curSong = buildSong({ genre: meta.genre, bpm: meta.bpm, minor: meta.minor, title: meta.title, lines: meta.lines });
    $("stTitle").textContent = meta.title; $("stMeta").textContent = GENRES[meta.genre].name + " · " + curSong.bpm + " BPM · " + Math.round(curSong.duration) + " sec · AI bol + browser me bani dhun";
    var box = $("stLyrics"); box.innerHTML = ""; var last = "";
    meta.lines.forEach(function (l, i) { if (l.section !== last) { box.appendChild(el('<div class="sec">' + esc(l.section) + '</div>')); last = l.section; } box.appendChild(el('<div class="ln" data-i="' + i + '">' + esc(l.text) + '</div>')); });
    $("stResult").hidden = false;
  }
  function loadLib() { try { return JSON.parse(localStorage.getItem(LIBKEY) || "[]"); } catch (e) { return []; } }
  function saveLib(meta) { try { var l = loadLib().filter(function (x) { return x.title !== meta.title; }); l.unshift(meta); localStorage.setItem(LIBKEY, JSON.stringify(l.slice(0, 20))); } catch (e) {} renderLib(); }
  function renderLib() {
    var box = $("stLib"); box.innerHTML = ""; var l = loadLib();
    if (!l.length) { box.appendChild(el('<div class="empty">Abhi koi dhun nahi. Upar idea likho aur pehla gaana banao 🎶</div>')); return; }
    l.forEach(function (m) { var r = el('<div class="st-song"><span>🎵</span><b>' + esc(m.title) + '</b><span>' + esc(GENRES[m.genre] ? GENRES[m.genre].name : "") + '</span></div>'); r.addEventListener("click", function () { showSong(m); $("stResult").scrollIntoView({ behavior: "smooth" }); }); box.appendChild(r); });
  }
  $("stMake").addEventListener("click", function () {
    var idea = clean($("stPrompt").value, 300), genre = $("stGenre").value, mood = $("stMood").value, btn = this;
    if (!idea) { toast("Pehle gaane ka idea likho"); return; }
    btn.disabled = true; $("stNote").textContent = "AI bol likh raha hai...";
    aiJson(SONG_SYS, "Idea: " + idea + "\nGenre: " + GENRES[genre].name + (mood ? "\nMood: " + mood : "")).then(normSong).then(function (sp) { if (!sp) throw new Error("bad"); $("stNote").textContent = "AI ne bol likhe ✦"; return sp; })
      .catch(function () { $("stNote").textContent = "AI abhi band hai, isliye simple template se bana. (Firebase me AI Logic ON karoge to asli AI bol aayenge.)"; return fallbackSong(idea, genre, mood); })
      .then(function (sp) { var meta = { title: sp.title, genre: genre, bpm: sp.bpm, minor: sp.minor, lines: sp.lines }; showSong(meta); saveLib(meta); })
      .catch(function (e) { toast(errMsg(e)); }).then(function () { btn.disabled = false; });
  });
  function speak(t) { try { if ($("stVoice").checked && window.speechSynthesis) { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(t); u.lang = "hi-IN"; u.rate = 0.9; u.pitch = 1.05; speechSynthesis.speak(u); } } catch (e) {} }
  $("stPlay").addEventListener("click", function () {
    if (!curSong) return;
    if (player.playing) { player.stop(); try { speechSynthesis.cancel(); } catch (e) {} this.textContent = "▶ Chalao"; return; }
    var btn = this; btn.textContent = "⏹ Roko";
    player.play(curSong, {
      onLine: function (i) { document.querySelectorAll("#stLyrics .ln").forEach(function (n) { n.classList.toggle("on", +n.getAttribute("data-i") === i); }); if (i >= 0) speak(curMeta.lines[i].text); },
      onTick: function (s, t) { $("stBar").style.width = Math.min(100, s / t * 100) + "%"; },
      onEnd: function () { btn.textContent = "▶ Chalao"; $("stBar").style.width = "0"; }
    }).catch(function (e) { btn.textContent = "▶ Chalao"; toast(errMsg(e)); });
  });
  $("stWav").addEventListener("click", function () {
    if (!curSong) return; var btn = this; btn.disabled = true; btn.textContent = "Ban raha hai...";
    renderWav(curSong).then(function (r) { var a = document.createElement("a"); a.href = URL.createObjectURL(r.blob); a.download = (curMeta.title || "pulse-gaana").replace(/[^\w\-]+/g, "_") + ".wav"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); toast("WAV download ho gaya ⬇"); })
      .catch(function (e) { toast(errMsg(e)); }).then(function () { btn.disabled = false; btn.textContent = "⬇ WAV"; });
  });
  $("stPost").addEventListener("click", function () {
    if (!curMeta) return; var btn = this; btn.disabled = true;
    var txt = clean("🎵 " + curMeta.title + " (" + GENRES[curMeta.genre].name + ", Pulse Gaana Studio AI)\n" + curMeta.lines.slice(0, 4).map(function (l) { return l.text; }).join(" / "), 500);
    addDoc(collection(db, "posts"), { uid: UID, name: ME.name, text: txt, likedBy: [], createdAt: serverTimestamp() }).then(function () { toast("Feed pe post ho gaya 🎉"); }).catch(function (e) { toast(errMsg(e)); }).then(function () { btn.disabled = false; });
  });

  // ---- Voice call + walkie-talkie (WebRTC; signaling Firestore messages se) ----
  var CALL = null, callTick = null;
  function callShow(show) { $("callUI").hidden = !show; }
  function callSetup(name, sub, opts) {
    $("callName").textContent = name; $("callSub").textContent = sub; $("callAv").textContent = (name || "?").charAt(0).toUpperCase();
    $("callAccept").hidden = !opts.incoming; $("callMute").hidden = !!opts.incoming || opts.walkie; $("ptt").hidden = !opts.walkie || !!opts.incoming; $("callMute").classList.remove("on"); $("callMute").textContent = "Mute"; callShow(true);
  }
  function callMsg(mid, text, call, touchMatch) {
    var b = writeBatch(db), mref = doc(collection(db, "matches", mid, "messages"));
    b.set(mref, { from: UID, text: text, call: call, createdAt: serverTimestamp() });
    if (touchMatch) b.update(doc(db, "matches", mid), { lastText: text, lastAt: serverTimestamp(), lastFrom: UID });
    return b.commit();
  }
  function onRemote(stream) { var a = $("callAudio"); a.srcObject = stream; a.play().catch(function () {}); }
  function onState(st) {
    if (!CALL) return;
    if (st === "connected" && !CALL.connected) { CALL.connected = true; clearTimeout(CALL.timeout); CALL.t0 = Date.now(); if (CALL.mode === "walkie" && !CALL.muteInit) { CALL.muteInit = true; setMic(false); $("ptt").hidden = false; $("callAccept").hidden = true; }
      callTick = setInterval(function () { if (!CALL) return; var s = Math.floor((Date.now() - CALL.t0) / 1000); $("callSub").textContent = (CALL.mode === "walkie" ? "Walkie-talkie · " : "Call · ") + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }, 500); }
    if ((st === "failed" || st === "closed") && !CALL.ending) endCall(true, "Connection nahi ban paya (network). Dobara try karo.");
  }
  function setMic(on) { if (CALL && CALL.stream) CALL.stream.getAudioTracks().forEach(function (t) { t.enabled = on; }); }
  function watchCall() {
    var cur = CALL; if (!cur) return;
    cur.unsub = onSnapshot(query(collection(db, "matches", cur.mid, "messages"), orderBy("createdAt", "desc"), limit(8)), function (s) {
      s.forEach(function (d) {
        var m = d.data(); if (!m.call || m.call.id !== cur.id || m.from === UID || CALL !== cur) return;
        if (m.call.k === "answer" && cur.role === "out" && !cur.answered && cur.pc) { cur.answered = true; Call.applyAnswer(cur.pc, m.call.sdp).catch(function () { endCall(true, "Call jud nahi paayi"); }); }
        if (m.call.k === "end") endCall(false, cur.connected ? "Call khatam" : "Call nahi uthi");
      });
    });
  }
  function startCall(mode) {
    if (!activeChat || activeChat.ai || CALL) return;
    if (!Call.supported()) { toast("Is browser me call nahi chalti. Chrome/Android app use karo."); return; }
    var c = activeChat, id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    Call.getMic().then(function (stream) {
      CALL = { mid: c.mid, id: id, role: "out", mode: mode, stream: stream, name: c.name, peer: c.id };
      callSetup(c.name, "Ring ho rahi hai...", { walkie: mode === "walkie" });
      return Call.makeOffer(stream, onRemote, onState).then(function (o) {
        if (!CALL || CALL.id !== id) { o.pc.close(); return; }
        CALL.pc = o.pc; watchCall();
        CALL.timeout = setTimeout(function () { if (CALL && CALL.id === id && !CALL.connected) endCall(true, "Jawab nahi mila"); }, 45000);
        return callMsg(c.mid, mode === "walkie" ? "📻 Walkie-talkie" : "📞 Voice call", { k: "offer", id: id, mode: mode, sdp: o.sdp }, true);
      });
    }).catch(function (e) { endCall(false); toast(e && e.name === "NotAllowedError" ? "Mic ki permission chahiye. Browser settings me allow karo." : errMsg(e)); });
  }
  function endCall(notify, msg) {
    var c = CALL; if (!c) return; c.ending = true; CALL = null; clearInterval(callTick); clearTimeout(c.timeout);
    if (c.unsub) try { c.unsub(); } catch (e) {}
    if (c.stream) c.stream.getTracks().forEach(function (t) { t.stop(); }); if (c.pc) try { c.pc.close(); } catch (e) {}
    $("callAudio").srcObject = null; callShow(false);
    if (notify && c.mid) callMsg(c.mid, "📞 Call khatam", { k: "end", id: c.id }, true).catch(function () {});
    if (msg) toast(msg);
  }
  function maybeIncoming(mid, m, other) {
    if (CALL || !/^(📞 Voice|📻)/.test(m.lastText || "") || Date.now() - ms(m.lastAt) > 40000) return;
    getDocs(query(collection(db, "matches", mid, "messages"), orderBy("createdAt", "desc"), limit(6))).then(function (s) {
      if (CALL) return; var offer = null, ended = {};
      s.forEach(function (d) { var x = d.data(); if (!x.call) return; if (x.call.k === "end") ended[x.call.id] = 1; else if (x.call.k === "offer" && x.from !== UID && !offer) offer = x.call; });
      if (!offer || ended[offer.id]) return;
      userName(other).then(function (n) {
        if (CALL) return; CALL = { mid: mid, id: offer.id, role: "in", mode: offer.mode, offer: offer.sdp, name: n, peer: other };
        callSetup(n, offer.mode === "walkie" ? "📻 Walkie-talkie aa raha hai" : "📞 Aapko call aa rahi hai", { incoming: true }); try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch (e) {}
        watchCall(); CALL.timeout = setTimeout(function () { if (CALL && CALL.id === offer.id && !CALL.connected) endCall(false, "Missed call"); }, 40000);
      });
    }).catch(function () {});
  }
  $("callAccept").addEventListener("click", function () {
    var c = CALL; if (!c || c.role !== "in") return; this.hidden = true; $("callSub").textContent = "Jud rahe hain...";
    Call.getMic().then(function (stream) { c.stream = stream; return Call.makeAnswer(stream, c.offer, onRemote, onState); })
      .then(function (a) { c.pc = a.pc; $("callMute").hidden = c.mode === "walkie"; $("ptt").hidden = c.mode !== "walkie"; return callMsg(c.mid, "📞 Jawab", { k: "answer", id: c.id, sdp: a.sdp }, false); })
      .catch(function (e) { endCall(true); toast(e && e.name === "NotAllowedError" ? "Mic ki permission chahiye" : errMsg(e)); });
  });
  $("callEnd").addEventListener("click", function () { endCall(true); });
  $("callMute").addEventListener("click", function () { if (!CALL) return; var on = this.classList.toggle("on"); setMic(!on); this.textContent = on ? "Unmute" : "Mute"; });
  (function () { var p = $("ptt"); function dn(e) { e.preventDefault(); setMic(true); p.classList.add("live"); p.textContent = "🎙 Bol rahe ho..."; } function up() { setMic(false); p.classList.remove("live"); p.textContent = "🎙 Dabake bolo"; }
    p.addEventListener("pointerdown", dn); p.addEventListener("pointerup", up); p.addEventListener("pointerleave", up); p.addEventListener("pointercancel", up); })();
  $("callBtn").addEventListener("click", function () { startCall("call"); });
  $("wtBtn").addEventListener("click", function () { startCall("walkie"); });

  // ---- AI Mediator (dono ki marzi se) + safety ----
  var SCAM_MONEY = /(\botp\b|\bupi\b|paytm|gpay|phonepe|bank\s*(account|details)|account\s*number|card\s*number|\bcvv\b|paise\s*(bhej|do|chahiye)|money\s*(send|transfer)|gift\s*card|crypto|bitcoin|\bloan\b|invest(ment)?\b|udhar)/i;
  var PII = /(\b\d{10}\b|https?:\/\/|www\.)/i;
  var MED_SYS = "Tum 'Mediator' ho: ek nishpaksh AI jo do logon ki baatcheet me madad karta hai. Dono ne tumhe ye chat padhne ki ijazat di hai. Kisi ka paksh mat lo. Hinglish me, 900 akshar se kam, is tarah likho: 1) Dono ki baat, ek-ek line me (naam se). 2) Jahan dono sehmat hain. 3) Ek chhota agla kadam. 4) Ek vinamr line jo pehla vyakti doosre se keh sake. Agar chat me dhamki, gaali, zabardasti, blackmail ya paisa maangna dikhe to sulah ki jagah saaf kaho ki jisko asurakshit lage wo Block/Report kare aur kisi bharose ke insaan se turant madad le. Doctor/vakeel jaisi salaah mat do. Koi naya personal data mat maango.";
  function medMsg(mid, text, med, touch) {
    var b = writeBatch(db), mref = doc(collection(db, "matches", mid, "messages"));
    b.set(mref, { from: UID, text: String(text).slice(0, 950), med: med, createdAt: serverTimestamp() });
    if (touch) b.update(doc(db, "matches", mid), { lastText: String(text).slice(0, 80), lastAt: serverTimestamp(), lastFrom: UID });
    return b.commit().catch(function (e) { toast(errMsg(e)); });
  }
  function renderMed() {
    var c = activeChat, bar = $("medBar"); if (!c || c.ai || !c.med) { bar.hidden = true; return; }
    var st = c.med, h = "";
    if (st.state === "off") h = '<span class="tx">🤝 AI Mediator: jab dono haan kahein tabhi ye chat padhta hai.</span><button id="medAsk">Mediator bulao</button>';
    else if (st.state === "pending" && st.asker === UID) h = '<span class="tx">Doosre ki haan ka intezaar...</span><button class="o" id="medOff">Radd karo</button>';
    else if (st.state === "pending") h = '<span class="tx">' + esc(c.name) + ' AI Mediator chahte hain. Haan = dono ki chat ke aakhri 12 msg AI padhega.</span><button id="medYes">Haan</button><button class="o" id="medNo">Naa</button>';
    else h = '<span class="tx">✅ Mediator ON (dono ki marzi). Kabhi bhi band kar sakte ho.</span><button id="medHelp">Madad maango</button><button class="o" id="medOff">Band karo</button>';
    bar.innerHTML = h; bar.hidden = false;
    var q = function (id, f) { var n = $(id); if (n) n.addEventListener("click", f); };
    q("medAsk", function () { medMsg(c.mid, "Mediator ki request bheji gayi. Doosre ki haan chahiye.", { k: "ask" }, true); });
    q("medYes", function () { medMsg(c.mid, "Dono ne haan kaha. AI Mediator ON.", { k: "yes" }, true); });
    q("medNo", function () { medMsg(c.mid, "Mediator ki request radd.", { k: "no" }, false); });
    q("medOff", function () { medMsg(c.mid, "Mediator band kar diya gaya.", { k: "off" }, false); });
    q("medHelp", function () { mediate(c); });
  }
  var medBusy = false;
  function mediate(c) {
    if (medBusy || !c.hist || !c.hist.length) { toast(c.hist && c.hist.length ? "Ruko..." : "Pehle thodi baat to karo"); return; }
    medBusy = true; var btn = $("medHelp"); if (btn) { btn.disabled = true; btn.textContent = "Soch raha hai..."; }
    var names = {}; names[UID] = ME.name; names[c.id] = c.name;
    var tr = c.hist.slice(-12).map(function (m) { return (names[m.from] || "?") + ": " + m.text; }).join("\n");
    var fallback = "AI abhi band hai, to ek simple tareeka:\n1) Ek-ek karke apni baat 'main ... mehsoos karta/karti hoon' se shuru karo.\n2) Doosre ko bina beech me toke poora suno.\n3) Jahan sehmat ho wo likho, phir ek chhota hal chuno.\n4) Dhamki ya zabardasti lage to Block/Report karo.";
    aiChat(MED_SYS, [{ role: "user", text: "Chat (" + names[UID] + " aur " + names[c.id] + "):\n" + tr }]).catch(function () { return fallback; })
      .then(function (t) { return medMsg(c.mid, "🤝 AI Mediator: " + t, { k: "say" }, true); }).then(function () { medBusy = false; });
  }
  function safeMeet(u) {
    var where = window.prompt("Kahan aur kab milna hai? (jaise: Phoenix Mall, Lucknow, kal 5 baje)"); if (!where) return;
    var text = "Safety check: main " + u.name + " (Pulse match) se milne ja raha/rahi hoon. Jagah/samay: " + where.slice(0, 120) + ". Kripya 1 ghante baad mujhe call karke check karna.";
    if (navigator.share) navigator.share({ text: text }).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast("Copy ho gaya. Apne bharose ke insaan ko bhejo 📋"); }); else toast(text);
  }

  // ---- throttle (spam rokne ke liye) ----
  var rateLog = {};
  function rate(key, n, ms) { var now = Date.now(), a = (rateLog[key] || []).filter(function (t) { return now - t < ms; }); if (a.length >= n) { toast("Slow down a little 🙏"); rateLog[key] = a; return false; } a.push(now); rateLog[key] = a; return true; }

  // ---- image helper: chhota JPEG (data URL) ----
  function shrink(file, max, q) {
    return new Promise(function (res, rej) {
      var fr = new FileReader(); fr.onerror = function () { rej(new Error("Could not read photo")); };
      fr.onload = function () { var im = new Image(); im.onerror = function () { rej(new Error("Not a valid image")); }; im.onload = function () {
        var k = Math.min(1, max / Math.max(im.width, im.height)), w = Math.max(1, Math.round(im.width * k)), h = Math.max(1, Math.round(im.height * k)), c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").drawImage(im, 0, 0, w, h); res(c.toDataURL("image/jpeg", q)); }; im.src = fr.result; };
      fr.readAsDataURL(file);
    });
  }
  var JPEG = /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/;
  function viewImg(src) { if (!JPEG.test(src)) return; $("imgBig").src = src; $("imgView").hidden = false; }
  $("imgView").addEventListener("click", function () { this.hidden = true; });

  // ---- emoji bhandar ----
  var EMO = {
    "Quick": ["Good morning 🌅", "Good night 🌙", "Thank you 🙏", "Sorry 🥺", "Congratulations 🎉", "Happy birthday 🎂", "On my way 🚗", "Missing you 💜", "Call me 📞", "Take care 🤗", "Well done 👏", "Jai Shri Ram 🚩", "Har Har Mahadev 🔱", "Radhe Radhe 🌸", "Eid Mubarak 🌙", "Happy Diwali 🪔"],
    "Happy": "😀😃😄😁😆🥳🤩😎😊🙂😍🥰😘😻🤗🎉✨👏🙌😇🤠🥹😋😌",
    "Love": "❤️🧡💛💚💙💜🤍💖💗💓💞💕😍😘🥰💐🌹💍🫶🤝💑💏😻💌🫰",
    "Sad": "😢😭😞😔🥺😟😥💔😿🫂🌧️🥀🤒😪😓😩😫",
    "Angry": "😠😡🤬😤🙄😒😑😬👿💢🚫😾🤨",
    "Funny": "😂🤣😜😝🤪😏🙃😅🤭🫣🤡💀🙈🙉🙊😹🤓",
    "Wish": "🎂🎁🎈🎊🪔🎆🎇🧨🥂🍰🎄🌅🌙⭐🌟🥳🪁🎶🎤",
    "Bhakti": "🕉️🙏🪔🔱🛕🌸🌺🪷🌼🔔🐚📿🚩🏹🪈🐘🦚🌿🍃☀️🕌⛪🕍☬",
    "Hands": "👍👎👌✌️🤞🤟🤙👋🙏💪🫡🤲🫰✋🤝👊🫵👏",
    "Food": "☕🍵🫖🍕🍔🍟🍛🍜🍣🍰🍫🍎🍉🍿🥭🍨🥘🍚🥛🍪",
    "Animals": "🐶🐱🐼🦁🐯🐵🐘🦚🐦🦋🐝🐢🐬🦄🐰🐮🐴🦜",
    "Travel": "🚗🚌✈️🚆🏍️🏖️🏔️🗺️🏠🏨⛺🌆🌃🛕🚲🛺",
    "Work": "💼💻📱📞📍🕐📅✅❌⚠️🔒💡📚🎓📝📈🤝🏢"
  };
  function glyphs(str) { try { var seg = new Intl.Segmenter("en", { granularity: "grapheme" }); return Array.from(seg.segment(str), function (x) { return x.segment; }).filter(function (g) { return g.trim(); }); } catch (e) { return Array.from(str); } }
  var emoTab = "Quick";
  function renderEmo() {
    var tabs = $("emoTabs"), grid = $("emoGrid"); tabs.innerHTML = ""; grid.innerHTML = "";
    Object.keys(EMO).forEach(function (k) { var b = document.createElement("button"); b.textContent = k; b.className = k === emoTab ? "on" : ""; b.setAttribute("data-notr", ""); b.addEventListener("click", function () { emoTab = k; renderEmo(); }); tabs.appendChild(b); });
    var items = Array.isArray(EMO[emoTab]) ? EMO[emoTab] : glyphs(EMO[emoTab]);
    items.forEach(function (g) {
      var b = document.createElement("button"); b.textContent = g; if (Array.isArray(EMO[emoTab])) b.className = "q";
      b.addEventListener("click", function () { var i = $("msgInput"); if (Array.isArray(EMO[emoTab])) { i.value = g; sendMsg(); } else { i.value += g; i.focus(); } });
      grid.appendChild(b);
    });
  }
  $("emojiBtn").addEventListener("click", function () { var p = $("emojiPanel"); p.hidden = !p.hidden; if (!p.hidden) renderEmo(); });

  // ---- chat me photo ----
  $("photoBtn").addEventListener("click", function () { if (activeChat && !activeChat.ai) $("photoInput").click(); });
  $("photoInput").addEventListener("change", function () {
    var f = this.files && this.files[0]; this.value = ""; var c = activeChat; if (!f || !c || c.ai || !rate("photo", 5, 60000)) return;
    shrink(f, 720, 0.62).then(function (d) { if (d.length > 230000) return shrink(f, 520, 0.5); return d; }).then(function (d) {
      if (d.length > 300000) throw new Error("Photo is too big");
      var b = writeBatch(db), mref = doc(collection(db, "matches", c.mid, "messages"));
      b.set(mref, { from: UID, text: "📷 Photo", img: d, createdAt: serverTimestamp() });
      b.update(doc(db, "matches", c.mid), { lastText: "📷 Photo", lastAt: serverTimestamp(), lastFrom: UID });
      return b.commit();
    }).catch(function (e) { toast(errMsg(e)); });
  });

  // ---- profile photo ----
  $("photoSet").addEventListener("click", function () { $("avatarInput").click(); });
  $("avatarInput").addEventListener("change", function () {
    var f = this.files && this.files[0]; this.value = ""; if (!f) return;
    shrink(f, 200, 0.7).then(function (d) { return updateDoc(doc(db, "users", UID), { photo: d }).then(function () { ME.photo = d; paintAv(); toast("Profile photo saved ✅"); }); }).catch(function (e) { toast(errMsg(e)); });
  });
  function paintAv() { var a = $("pAv"); if (ME && ME.photo && JPEG.test(ME.photo)) { a.style.background = "center/cover url(" + ME.photo + ")"; a.textContent = ""; } }

  // ---- notifications (app background me ho tab) ----
  function pushLocal(title, body) { try { if (document.hidden && window.Notification && Notification.permission === "granted") new Notification(title, { body: body, icon: "icon-192.png" }); } catch (e) {} }
  $("notifBtn").addEventListener("click", function () { if (!window.Notification) { toast("Notifications are not supported here"); return; } Notification.requestPermission().then(function (p) { toast(p === "granted" ? "Notifications on 🔔" : "Notifications blocked"); }); });

  // ---- policy, language, delete ----
  var POLICY_EN = '<h3>Privacy Policy &amp; Terms</h3><p>Pulse is for people 18+ only.</p><h4>What we store</h4><p>Your profile (name, age, city, work, about, optional small photo), your posts, matches, chat messages and photos you send, and approximate location only if you turn Nearby ON (rounded to about 1 km; deleted when you turn it off).</p><h4>Who can see it</h4><p>Profiles are visible to verified members. Chats are visible only to the two people in them. Saathi AI and AI Mediator send the text you give them to Google Gemini to reply; the Mediator reads a chat only after both people agree. The creator panel shows only reports and totals, never private chats.</p><h4>Your control</h4><p>You can block or report anyone, turn off location any time, and delete your account from the Me tab (this removes your profile, posts and Saathi history; messages you sent in shared chats may remain for the other person).</p><h4>Rules</h4><p>No harassment, threats, scams, nudity, hate or impersonation. Never send money, OTP or bank details to anyone you met here. Accounts that break these rules can be banned. Meet in public places and tell someone you trust.</p>';
  var POLICY_HI = '<h3>Privacy Policy aur Terms</h3><p>Pulse sirf 18+ ke liye hai.</p><h4>Kya save hota hai</h4><p>Aapki profile (naam, umar, sheher, kaam, about, chhoti photo), posts, match, chat aur bheji hui photos, aur location sirf tab jab aap Nearby ON karo (lagbhag 1 km tak mota-mota, band karte hi hat jaati hai).</p><h4>Kaun dekh sakta hai</h4><p>Profile verified members dekh sakte hain. Chat sirf un do logon ko dikhti hai. Saathi AI aur AI Mediator jawab ke liye text Google Gemini ko bhejte hain; Mediator chat tabhi padhta hai jab dono haan kahein. Creator panel me sirf reports aur ginti dikhti hai, private chat kabhi nahi.</p><h4>Aapka control</h4><p>Kisi ko bhi block ya report karo, location kabhi band karo, aur Me tab se account delete karo (profile, posts, Saathi history hat jaati hai; shared chat me bheje gaye message doosre ke paas rah sakte hain).</p><h4>Niyam</h4><p>Pareshan karna, dhamki, thagi, nagnata, nafrat ya jhoothi pehchaan mana hai. Yahan mile kisi ko paisa, OTP ya bank details mat bhejo. Niyam todne par account ban ho sakta hai. Public jagah par milo aur kisi apne ko batao.</p>';
  document.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest(".plink"); if (a) { e.preventDefault(); $("policyText").innerHTML = getLang() === "en" ? POLICY_EN : POLICY_HI; $("policyUI").hidden = false; } });
  $("policyClose").addEventListener("click", function () { $("policyUI").hidden = true; });
  [$("langBtn"), $("langBtn2")].forEach(function (b) { b.textContent = getLang() === "en" ? "हि" : "EN"; b.addEventListener("click", function () { setLang(getLang() === "en" ? "hi" : "en"); }); });
  $("delAcc").addEventListener("click", function (e) {
    e.preventDefault(); if (!UID || !window.confirm("Delete your account permanently? Your profile, posts and Saathi history will be removed. This cannot be undone.")) return;
    var u = auth.currentUser, id = UID;
    getDocs(query(collection(db, "posts"), where("uid", "==", id), limit(200))).then(function (s) { return Promise.all(s.docs.map(function (d) { return deleteDoc(d.ref); })); }).catch(function () {})
      .then(function () { return getDocs(query(collection(db, "users", id, "saathi"), limit(300))).then(function (s) { return Promise.all(s.docs.map(function (d) { return deleteDoc(d.ref); })); }); }).catch(function () {})
      .then(function () { return deleteDoc(doc(db, "presence", id)).catch(function () {}); })
      .then(function () { return deleteDoc(doc(db, "users", id)); })
      .then(function () { return deleteUser(u); })
      .then(function () { toast("Account deleted"); }).catch(function (er) { toast(er && er.code === "auth/requires-recent-login" ? "Please log in again, then delete" : errMsg(er)); });
  });

  // ---- Creator panel (sirf creator email; sirf reports + ginti) ----
  function creatorPanel() {
    var u = auth.currentUser, box = $("creatorBox"); if (!u || u.email !== CREATOR_EMAIL) { box.hidden = true; return; }
    box.hidden = false; box.innerHTML = '<div class="section-title">Creator Panel</div><div class="st-note">Shows reports and totals only. Private chats and who-blocked-whom are never visible, by design.</div><div id="crStats"></div><div id="crList"></div><div class="st-row" style="margin-top:8px"><input class="bh-in" id="crUid" placeholder="User ID to ban / unban" style="margin:0"><button class="btn-outline" id="crBan" style="padding:0 12px">Ban</button><button class="btn-outline" id="crUnban" style="padding:0 12px">Unban</button></div>';
    Promise.all([getCountFromServer(collection(db, "users")), getCountFromServer(collection(db, "posts"))]).then(function (r) { $("crStats").innerHTML = '<div class="cr-row">Members: <b>' + r[0].data().count + '</b> · Posts: <b>' + r[1].data().count + '</b></div>'; }).catch(function () {});
    getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(30))).then(function (s) {
      var l = $("crList"); l.innerHTML = s.empty ? '<div class="cr-row">No reports 🎉</div>' : "";
      s.forEach(function (d) { var r = d.data(); var row = el('<div class="cr-row" data-notr>Reported <b>' + esc(r.to) + '</b>: ' + esc(r.reason || "") + ' <button class="btn-outline" style="padding:4px 10px">Fill ID</button></div>'); row.querySelector("button").addEventListener("click", function () { $("crUid").value = r.to; }); l.appendChild(row); });
    }).catch(function (e) { toast(errMsg(e)); });
    $("crBan").addEventListener("click", function () { var id = clean($("crUid").value, 60); if (id) setDoc(doc(db, "bans", id), { at: serverTimestamp(), by: UID }).then(function () { toast("Banned"); }).catch(function (e) { toast(errMsg(e)); }); });
    $("crUnban").addEventListener("click", function () { var id = clean($("crUid").value, 60); if (id) deleteDoc(doc(db, "bans", id)).then(function () { toast("Unbanned"); }).catch(function (e) { toast(errMsg(e)); }); });
  }

  // ---- Bhajan Room ----
  var BHAJANS = [
    { t: "Om Jai Jagdish Hare (Aarti)", l: ["Om Jai Jagdish Hare, Swami Jai Jagdish Hare", "Bhakt jano ke sankat, Das jano ke sankat", "Kshan me door kare, Om Jai Jagdish Hare", "Jo dhyave phal pave, dukh binse man ka", "Swami dukh binse man ka", "Sukh sampati ghar aave, kasht mite tan ka", "Om Jai Jagdish Hare", "Mat pita tum mere, sharan gahun kiski", "Swami sharan gahun kiski", "Tum bin aur na dooja, aas karun jiski", "Om Jai Jagdish Hare"] },
    { t: "Hanuman Chalisa (opening)", l: ["Shri Guru charan saroj raj, nij man mukur sudhari", "Barnau Raghubar bimal jasu, jo dayaku phal chari", "Buddhiheen tanu jaanike, sumiro Pavan Kumar", "Bal buddhi vidya dehu mohi, harahu kalesh vikar", "Jai Hanuman gyan gun sagar", "Jai Kapis tihun lok ujagar", "Ram doot atulit bal dhama", "Anjani putra Pavan sut nama", "Mahavir vikram Bajrangi", "Kumati nivar sumati ke sangi", "Sankat te Hanuman chhudave", "Man krama bachan dhyan jo lave"] },
    { t: "Hare Krishna Maha Mantra", l: ["Hare Krishna Hare Krishna", "Krishna Krishna Hare Hare", "Hare Rama Hare Rama", "Rama Rama Hare Hare"] },
    { t: "Om Namah Shivaya (Dhun)", l: ["Om Namah Shivaya", "Om Namah Shivaya", "Har Har Mahadev", "Om Namah Shivaya", "Shambhu Shankar Namah Shivaya", "Om Namah Shivaya"] },
    { t: "Shri Ram Stuti (opening)", l: ["Shri Ramchandra kripalu bhajuman, haran bhavbhay darunam", "Nav kanj lochan, kanj mukh, kar kanj, pad kanjarunam", "Siya Ram Siya Ram, Jai Jai Ram", "Jai Siya Ram"] },
    { t: "Jai Ambe Gauri (Devi Aarti)", l: ["Jai Ambe Gauri, Maiya Jai Shyama Gauri", "Tumko nishdin dhyavat, Hari Brahma Shivri", "Jai Ambe Gauri", "Mang sindoor virajat, tiko mrigmad ko", "Ujjwal se dou naina, chandravadan neeko", "Jai Ambe Gauri"] },
    { t: "Write my own...", l: null }
  ];
  var DEITY = [
    { n: "Om", s: "🕉️", g: "linear-gradient(180deg,#3b1200,#8a3200 55%,#ff9a3c)" }, { n: "Shiv", s: "🔱", g: "linear-gradient(180deg,#0b1030,#2c2a6e 55%,#7aa7ff)" },
    { n: "Ram", s: "🏹", g: "linear-gradient(180deg,#4a1500,#c24a00 55%,#ffcf5c)" }, { n: "Krishna", s: "🪈", g: "linear-gradient(180deg,#061a3a,#0b5c8a 55%,#3de0c8)" },
    { n: "Hanuman", s: "🚩", g: "linear-gradient(180deg,#4d0c00,#d9480f 55%,#ffb347)" }, { n: "Durga", s: "🦁", g: "linear-gradient(180deg,#3a0010,#b3123a 55%,#ffb347)" },
    { n: "Ganesh", s: "🐘", g: "linear-gradient(180deg,#3d2a00,#c98400 55%,#ffe27a)" }, { n: "Lakshmi", s: "🪷", g: "linear-gradient(180deg,#3a0a2e,#b83280 55%,#ffc2e0)" }
  ];
  var ROOM = null, roomSnd = null, dhamKind = "";
  function bhajanFor(d) { return BHAJANS[d.k === "S" ? 5 : d.k === "C" && d.id !== "rameshwaram" ? 2 : 3]; }
  function openDham(d) {
    $("policyText").innerHTML = '<div class="dham-sheet"><div class="hd" style="background-image:' + photoOrArt(d).replace(/"/g, "&quot;") + '"></div><h3>' + esc(d.n) + '</h3><p><b>' + esc(kindName(d.k)) + '</b> · ' + esc(d.p) + '</p><p>' + esc(d.b) + '</p><button class="btn-grad" id="dhamStart" style="width:100%;padding:13px">🪔 Start Aarti room here</button><p class="st-note">Photos load from Wikipedia / Wikimedia Commons; if unavailable, app-made art is shown. Info is brief: please check the temple trust for darshan timings.</p></div>';
    $("policyUI").hidden = false;
    $("dhamStart").addEventListener("click", function () { $("policyUI").hidden = true; makeRoom(bhajanFor(d), d); });
  }
  function renderDham() {
    var g = $("dhamGrid"); g.innerHTML = "";
    DHAMS.filter(function (d) { return !dhamKind || d.k === dhamKind; }).forEach(function (d) {
      var c = el('<div class="dham-card" data-notr style="background-image:' + photoOrArt(d).replace(/"/g, "&quot;") + '"><div class="tx"><b>' + esc(d.n) + '</b><span>' + kindSym(d.k) + " " + esc(d.p) + '</span></div></div>'); c.addEventListener("click", function () { openDham(d); }); g.appendChild(c);
    });
  }
  document.querySelectorAll("#dhamFilter button").forEach(function (b) { b.addEventListener("click", function () { dhamKind = b.getAttribute("data-k"); document.querySelectorAll("#dhamFilter button").forEach(function (x) { x.classList.toggle("on", x === b); }); renderDham(); }); });
  renderDham();
  function paintDaily() { var d = dailyDham(), c = $("dailyCard"); c.style.backgroundImage = photoOrArt(d); c.innerHTML = '<div class="tx" data-notr><div class="lb">Today\'s Darshan</div><h3>' + esc(d.n) + '</h3><div class="row"><span>' + kindSym(d.k) + " " + esc(d.p) + '</span><button>🪔 Aarti</button></div></div>'; c.onclick = function () { if (UID) openDham(d); }; }
  paintDaily(); loadPhotos(function () { renderDham(); paintDaily(); });
  BHAJANS.forEach(function (b, i) { $("bhPick").appendChild(new Option(b.t, i)); });
  $("bhPick").addEventListener("change", function () { $("bhOwn").hidden = BHAJANS[+this.value].l !== null; });
  $("segSongs").addEventListener("click", function () { $("songsPanel").hidden = false; $("bhajanPanel").hidden = true; $("segSongs").classList.add("on"); $("segBhajan").classList.remove("on"); });
  $("segBhajan").addEventListener("click", function () { $("songsPanel").hidden = true; $("bhajanPanel").hidden = false; $("segBhajan").classList.add("on"); $("segSongs").classList.remove("on"); });
  function code6() { var a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = ""; for (var i = 0; i < 6; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }
  var dhamPick = null;
  $("bhCreate").addEventListener("click", function () { makeRoom(BHAJANS[+$("bhPick").value], null); });
  function makeRoom(b, dham) {
    b = b, items = b.l || $("bhOwn").value.split("\n").map(function (x) { return clean(x, 120); }).filter(Boolean).slice(0, 60), name = dham ? dham.n + " Aarti" : clean($("bhName").value, 40) || (b.l ? b.t : "Our Bhajan");
    if (!items.length) { toast("Write at least one line"); return; } if (!rate("room", 3, 60000)) return;
    var id = code6(), btn = $("bhCreate"); btn.disabled = true;
    setDoc(doc(db, "rooms", id), { name: name, title: b.l ? b.t : name, host: UID, hostName: ME.name, items: items, line: 0, dham: dham ? dham.id : "", members: [UID], flowers: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      .then(function () { enterRoom(id); }).catch(function (e) { toast(e && e.code === "permission-denied" ? "Rooms need the latest rules (ask the creator to publish them)" : errMsg(e)); }).then(function () { btn.disabled = false; });
  }
  function joinRoom(code) {
    code = clean(code, 8).toUpperCase(); if (!code) return;
    getDoc(doc(db, "rooms", code)).then(function (s) {
      if (!s.exists()) { toast("Room not found"); return; }
      var m = s.data().members || []; if (m.indexOf(UID) >= 0) return enterRoom(code);
      if (m.length >= 12) { toast("Room is full"); return; }
      return updateDoc(doc(db, "rooms", code), { members: arrayUnion(UID), updatedAt: serverTimestamp() }).then(function () { addDoc(collection(db, "rooms", code, "msgs"), { from: UID, name: ME.name, text: "🙏 joined", createdAt: serverTimestamp() }).catch(function () {}); enterRoom(code); });
    }).catch(function (e) { toast(e && e.code === "permission-denied" ? "Cannot join this room" : errMsg(e)); });
  }
  $("bhJoin").addEventListener("click", function () { joinRoom($("bhCode").value); });
  function theme(i) { var d = DEITY[i] || DEITY[0]; $("roomBg").style.background = d.g; $("bigSym").textContent = d.s; document.querySelectorAll("#deities button").forEach(function (b, j) { b.classList.toggle("on", j === i); }); try { localStorage.setItem("pulse_deity", i); } catch (e) {} }
  function petals(n) { var box = $("petals"); for (var i = 0; i < n; i++) { var p = document.createElement("span"); p.className = "petal"; p.textContent = ["🌸", "🌼", "🌺", "🪷"][i % 4]; p.style.left = Math.random() * 100 + "%"; p.style.animationDuration = 3 + Math.random() * 3 + "s"; p.style.animationDelay = Math.random() * 0.6 + "s"; box.appendChild(p); setTimeout(function (x) { x.remove(); }, 7000, p); } }
  function paintLine(r) {
    var it = r.items || [], i = Math.max(0, Math.min(it.length - 1, r.line || 0));
    $("lyricBox").innerHTML = (it[i - 1] ? '<div class="pv">' + esc(it[i - 1]) + '</div>' : "") + '<div class="cur" key="' + i + '">' + esc(it[i] || "") + '</div>' + (it[i + 1] ? '<div class="nx">' + esc(it[i + 1]) + '</div>' : "");
  }
  function enterRoom(id) {
    leaveRoom(true); ROOM = { id: id, flowers: -1, unsubs: [], host: false, auto: null };
    $("roomUI").hidden = false; $("roomLog").innerHTML = "";
    var d = $("deities"); d.innerHTML = ""; DEITY.forEach(function (x, i) { var b = document.createElement("button"); b.textContent = x.s + " " + x.n; b.setAttribute("data-notr", ""); b.addEventListener("click", function () { theme(i); }); d.appendChild(b); });
    var sv = 0; try { sv = +localStorage.getItem("pulse_deity") || 0; } catch (e) {} theme(sv);
    ROOM.unsubs.push(onSnapshot(doc(db, "rooms", id), function (s) {
      if (!s.exists()) { toast("Room closed"); leaveRoom(); return; }
      var r = snapData(s); ROOM.data = r; ROOM.host = r.host === UID;
      $("roomName").textContent = r.name; $("roomCount").textContent = (r.members || []).length + " people singing · code " + id;
      ["rcPrev", "rcNext", "rcAuto"].forEach(function (x) { $(x).hidden = !ROOM.host; });
      paintLine(r); if (r.dham && ROOM.dham !== r.dham) { ROOM.dham = r.dham; var dd = DHAMS.filter(function (x) { return x.id === r.dham; })[0]; if (dd) { $("roomBg").style.background = "linear-gradient(rgba(0,0,0,.25),rgba(0,0,0,.6)), " + photoOrArt(dd); $("roomBg").style.backgroundSize = "cover"; $("roomBg").style.backgroundPosition = "center"; $("bigSym").textContent = kindSym(dd.k); } }
      if (ROOM.flowers >= 0 && (r.flowers || 0) > ROOM.flowers) petals(Math.min(12, (r.flowers - ROOM.flowers) * 4)); ROOM.flowers = r.flowers || 0;
    }, function (e) { toast(errMsg(e)); }));
    ROOM.unsubs.push(onSnapshot(query(collection(db, "rooms", id, "msgs"), orderBy("createdAt", "asc"), limit(40)), function (s) {
      var log = $("roomLog"); log.innerHTML = ""; s.forEach(function (d) { var m = snapData(d); log.appendChild(el('<div data-notr><b>' + esc(m.name || "") + ':</b> ' + esc(m.text) + '</div>')); }); log.scrollTop = log.scrollHeight;
    }, function () {}));
  }
  function roomLine(delta) { var r = ROOM && ROOM.data; if (!r || !ROOM.host) return; var n = Math.max(0, Math.min((r.items || []).length - 1, (r.line || 0) + delta)); if (n !== r.line) updateDoc(doc(db, "rooms", ROOM.id), { line: n, updatedAt: serverTimestamp() }).catch(function (e) { toast(errMsg(e)); }); }
  $("rcPrev").addEventListener("click", function () { roomLine(-1); }); $("rcNext").addEventListener("click", function () { roomLine(1); });
  $("rcAuto").addEventListener("click", function () {
    if (!ROOM) return; var b = this;
    if (ROOM.auto) { clearInterval(ROOM.auto); ROOM.auto = null; b.classList.remove("on"); b.textContent = "▶ Auto"; return; }
    b.classList.add("on"); b.textContent = "⏸ Auto"; ROOM.auto = setInterval(function () { if (!ROOM || !ROOM.data) return; if ((ROOM.data.line || 0) >= ROOM.data.items.length - 1) { clearInterval(ROOM.auto); ROOM.auto = null; b.classList.remove("on"); b.textContent = "▶ Auto"; return; } roomLine(1); }, 6500);
  });
  $("rcFlower").addEventListener("click", function () { if (!ROOM || !rate("flower", 12, 30000)) return; petals(6); updateDoc(doc(db, "rooms", ROOM.id), { flowers: increment(1), updatedAt: serverTimestamp() }).catch(function () {}); });
  function bell() { try { var AC = window.AudioContext || window.webkitAudioContext, c = new AC(), t = c.currentTime; [523.25, 1046.5, 1568].forEach(function (f, i) { var o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.25 / (i + 1), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4); o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + 2.5); }); setTimeout(function () { c.close(); }, 3000); } catch (e) {} }
  $("rcBell").addEventListener("click", bell);
  $("rcSound").addEventListener("click", function () {
    var b = this; if (roomSnd) { roomSnd.stop(); roomSnd = null; b.classList.remove("on"); return; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext, c = new AC(), m = c.createGain(); m.gain.value = 0.9; m.connect(c.destination);
      [130.81, 196, 261.63].forEach(function (f, i) { var o = c.createOscillator(), g = c.createGain(), l = c.createBiquadFilter(); o.type = "triangle"; o.frequency.value = f; g.gain.value = 0.07 / (i + 1); l.type = "lowpass"; l.frequency.value = 900; o.connect(l); l.connect(g); g.connect(m); o.start(); });
      var beat = 0, tm = setInterval(function () { var t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(beat % 4 === 0 ? 120 : 190, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.15); g.gain.setValueAtTime(beat % 4 === 0 ? 0.55 : 0.28, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2); o.connect(g); g.connect(m); o.start(t); o.stop(t + 0.22); beat++; }, 600);
      roomSnd = { stop: function () { clearInterval(tm); try { c.close(); } catch (e) {} } }; b.classList.add("on");
    } catch (e) { toast("Sound not supported"); }
  });
  function leaveRoom(quiet) {
    if (!ROOM) return; ROOM.unsubs.forEach(function (u) { try { u(); } catch (e) {} }); if (ROOM.auto) clearInterval(ROOM.auto); if (roomSnd) { roomSnd.stop(); roomSnd = null; $("rcSound").classList.remove("on"); }
    ROOM = null; $("roomUI").hidden = true; if (!quiet) $("rcAuto").classList.remove("on");
  }
  $("roomLeave").addEventListener("click", function () { leaveRoom(); });
  $("roomSend").addEventListener("click", sendRoomMsg); $("roomMsg").addEventListener("keydown", function (e) { if (e.key === "Enter") sendRoomMsg(); });
  function sendRoomMsg() { var i = $("roomMsg"), t = clean(i.value, 200); if (!t || !ROOM || !rate("rmsg", 8, 10000)) return; i.value = ""; addDoc(collection(db, "rooms", ROOM.id, "msgs"), { from: UID, name: ME.name, text: t, createdAt: serverTimestamp() }).catch(function (e) { toast(errMsg(e)); }); }
  $("roomShare").addEventListener("click", function () {
    if (!ROOM) return; var url = location.origin + location.pathname + "?room=" + ROOM.id, text = "Join my Bhajan Room on Pulse 🪔 Code: " + ROOM.id;
    if (navigator.share) navigator.share({ title: "Pulse Bhajan Room", text: text, url: url }).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(text + " " + url).then(function () { toast("Room link copied 📋"); }); else toast(text);
  });
  function pendingRoom() { try { var q = new URLSearchParams(location.search).get("room"); if (q) { sessionStorage.setItem("pulse_room", q); history.replaceState(null, "", location.pathname); } var c = sessionStorage.getItem("pulse_room"); if (c && UID) { sessionStorage.removeItem("pulse_room"); showTab("studio"); $("segBhajan").click(); joinRoom(c); } } catch (e) {} }

  // ---- boot ----
  initI18n(); setMode("login");
  fetch("firebase-config.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (cfg) {
    if (!cfg.apiKey || /PASTE|YOUR/i.test(cfg.apiKey)) { $("authErr").textContent = "Setup baaki hai: public/firebase-config.json me Firebase ki details bharo."; return; }
    init(cfg);
  }).catch(function () { $("authErr").textContent = "Config nahi mili (firebase-config.json)."; });
})();
