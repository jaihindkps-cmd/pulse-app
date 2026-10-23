// Pulse (Firebase version): Auth + Firestore + Hosting, sab free (Spark) plan par.
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, deleteUser } from "firebase/auth";
import {
  initializeFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, where, orderBy, limit,
  getDocs, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, Timestamp, writeBatch
} from "firebase/firestore";

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
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
      signingUp = true;
      p = createUserWithEmailAndPassword(auth, email, pw).then(function (cred) {
        var prof = { name: name, age: age, city: clean($("aCity").value, 40), work: "", about: "", looking: $("aLooking").value, createdAt: serverTimestamp() };
        return setDoc(doc(db, "users", cred.user.uid), prof).then(function () { UID = cred.user.uid; ME = Object.assign({}, prof, { uid: UID }); signingUp = false; start(); })
          .catch(function (err) { return deleteUser(cred.user).catch(function () {}).then(function () { throw err; }); });
      });
    }
    p.then(function () { $("aPass").value = ""; }).catch(function (err) { signingUp = false; $("authErr").textContent = errMsg(err); }).then(function () { $("authBtn").disabled = false; });
  });
  $("logoutBtn").addEventListener("click", function () { signOut(auth).then(function () { toast("Logout ho gaye"); }); });

  function stopAll() { unsubs.forEach(function (u) { try { u(); } catch (e) {} }); unsubs = []; }

  // ---- start / stop ----
  function start() {
    $("auth").hidden = true;
    $("meAv").textContent = $("pAv").textContent = (ME.name || "?").charAt(0).toUpperCase();
    $("pName").textContent = ME.name; $("pHandle").textContent = ME.city || "";
    $("eName").value = ME.name || ""; $("eCity").value = ME.city || ""; $("eWork").value = ME.work || ""; $("eAbout").value = ME.about || ""; $("eLooking").value = ME.looking || "Dosti";
    getDocs(query(collection(db, "blocks"), where("blocker", "==", UID))).then(function (s) { blocked = new Set(); s.forEach(function (d) { blocked.add(d.data().blocked); }); }).catch(function () {}).then(function () {
      listenFeed(); listenMatches(); refreshLocToggle(); showTab("feed");
    });
  }
  function init(cfg) {
    var app = initializeApp(cfg);
    auth = getAuth(app);
    db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
    onAuthStateChanged(auth, function (u) {
      if (u) {
        if (signingUp) return;
        getDoc(doc(db, "users", u.uid)).then(function (s) {
          if (!s.exists()) { signOut(auth); $("auth").hidden = false; $("authErr").textContent = "Profile nahi mili. Naya account banao."; return; }
          UID = u.uid; ME = Object.assign({}, s.data(), { uid: UID }); start();
        }).catch(function (e) { $("auth").hidden = false; $("authErr").textContent = errMsg(e); });
      } else {
        stopAll(); UID = null; ME = null; $("auth").hidden = false; $("convo").classList.remove("open"); activeChat = null;
      }
    });
  }

  // ---- tabs ----
  var titles = { feed: "Pulse", discover: "Discover", nearby: "Nearby", chats: "Messages", profile: "Profile" };
  var screens = ["feed", "discover", "nearby", "chats", "profile"];
  function showTab(name) {
    screens.forEach(function (s) { $("screen-" + s).hidden = s !== name; });
    document.querySelectorAll(".tab").forEach(function (t) { t.classList.toggle("active", t.getAttribute("data-tab") === name); });
    $("screenTitle").textContent = titles[name];
    if (name === "discover") loadDeck(); if (name === "nearby") loadNearby(); if (name === "chats") $("chatDot").hidden = true;
  }
  document.querySelectorAll(".tab").forEach(function (t) { t.addEventListener("click", function () { if (UID) showTab(t.getAttribute("data-tab")); }); });

  // ---- feed (realtime) ----
  var postText = $("composerText");
  postText.addEventListener("input", function () { this.style.height = "auto"; this.style.height = this.scrollHeight + "px"; $("postBtn").disabled = !this.value.trim(); $("charCount").textContent = this.value.length + "/500"; });
  $("postBtn").addEventListener("click", function () {
    var t = clean(postText.value, 500); if (!t) return; this.disabled = true;
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
      var c = el('<div class="swipe-card" style="background:' + g(u.id) + ';transform:translateY(' + depth * 14 + 'px) scale(' + (1 - depth * 0.05) + ')"><div class="scrim"></div><div class="avatar-big">' + ini(u.name) + '</div><span class="stamp like">Like</span><span class="stamp nope">Nope</span><div class="info"><h3>' + esc(u.name) + (u.age ? ", " + u.age : "") + '</h3><div class="sub">' + esc([u.work, u.city].filter(Boolean).join(" · ") || "Pulse member") + '</div>' + (u.about ? '<p class="about">' + esc(u.about) + '</p>' : '') + '<div class="tags"><span>' + esc(u.looking || "Dosti") + '</span></div></div></div>');
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
  function loadNearby() {
    getDoc(doc(db, "presence", UID)).then(function (mine) {
      var box = $("nearbyBox"); box.innerHTML = "";
      if (!mine.exists()) {
        box.appendChild(el('<div class="optin"><div class="halo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div><h3>Aas-paas ke log</h3><p>Apni location share karke un logon ko dekho jinhone <b>khud</b> bhi sharing ON ki hai.</p><div class="consent">🔒 <b>Aapki marzi:</b> Sirf aap jab chaho tab share hoga. Jinhone share nahi kiya, unki location, naam ya number kabhi nahi dikhega. Share karne par aapki location lagbhag 1 km ke daayre me <b>mota-mota</b> (rounded) save hoti hai, aur doosre opt-in logon ko sirf doori dikhti hai. Kabhi bhi band kar sakte ho.</div><button class="btn-grad" id="shareLoc" style="width:100%;padding:13px">Location share karo</button></div>'));
        $("shareLoc").addEventListener("click", shareLocation); return;
      }
      var me = mine.data();
      getPos(function (lat, lng) { publishPresence(lat, lng).catch(function () {}); me = { lat: round2(lat), lng: round2(lng) }; render(me); }, function () { render(me); });
      function render(m) {
        box.innerHTML = "";
        box.appendChild(el('<div class="nearby-banner">Aapki location ON hai. Sirf opt-in log dikh rahe hain.<button id="stopShare">Band karo</button></div>'));
        $("stopShare").addEventListener("click", function () { stopShare().then(loadNearby); });
        var since = Timestamp.fromMillis(Date.now() - 6 * 3600e3);
        getDocs(query(collection(db, "presence"), where("updatedAt", ">", since), limit(200))).then(function (s) {
          var rows = [];
          s.forEach(function (d) { if (d.id === UID || blocked.has(d.id)) return; var p = d.data(); var k = distKm(m.lat, m.lng, p.lat, p.lng); if (k <= 50) rows.push({ id: d.id, p: p, km: k }); });
          rows.sort(function (a, b) { return a.km - b.km; });
          if (!rows.length) { box.appendChild(el('<div class="empty">Abhi aas-paas (50 km) koi aur opt-in user nahi. Doston ko bulao! 👋</div>')); return; }
          box.appendChild(el('<div class="section-title">Abhi aas-paas</div>'));
          rows.slice(0, 50).forEach(function (r) {
            var dist = r.km < 1 ? "1 km se kam" : "~" + Math.round(r.km) + " km";
            var row = el('<div class="nearby-row"><div class="av-sm" style="width:50px;height:50px;font-size:18px;background:' + g(r.id) + '">' + ini(r.p.name) + '</div><div class="body"><div class="nm">' + esc(r.p.name) + (r.p.age ? ", " + esc(r.p.age) : "") + '</div><div class="meta">📍 ' + dist + ' · ' + esc(r.p.work || r.p.city || "Pulse member") + '</div></div><button class="wave">💬 Chat</button></div>');
            row.querySelector(".wave").addEventListener("click", function () { toast("Pehle Discover me match karo, phir chat khulega 💜"); });
            box.appendChild(row);
          });
        }).catch(function (e) { toast(errMsg(e)); });
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
          if (ch.type === "added" && !matchWith) { userName(other).then(function (n) { toast("🎉 Naya match: " + n); }); $("chatDot").hidden = false; }
          else if (ch.type === "modified" && m.lastFrom && m.lastFrom !== UID && !(activeChat && activeChat.mid === ch.doc.id)) { userName(other).then(function (n) { toast("💬 " + n + ": " + String(m.lastText).slice(0, 40)); }); $("chatDot").hidden = false; }
        });
      }
      firstMatches = false;
      matchDocs = snap.docs.map(function (d) { var m = snapData(d); return { mid: d.id, id: m.users.filter(function (x) { return x !== UID; })[0], last: m.lastText, at: ms(m.lastAt) }; }).filter(function (c) { return !blocked.has(c.id); }).sort(function (a, b) { return b.at - a.at; });
      renderChats();
    }, function (e) { toast(errMsg(e)); }));
  }
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
      var r = row({ id: c.id, mid: c.mid, name: nameCache[c.id] || "..." }, c.last || "Match ho gaya! Hi bolo 👋", c.last ? hm(c.at) : "");
      if (!nameCache[c.id]) userName(c.id).then(function (n) { r.querySelector(".nm").textContent = n; r.querySelector(".av-sm").textContent = n.charAt(0).toUpperCase(); });
    });
    if (!shown.length) l.appendChild(el('<div class="empty">Abhi koi chat nahi. Discover me swipe karo. Match hote hi chat yahan khulegi.</div>'));
  }

  function addBubble(m) {
    var sys = $("convoBody").querySelector(".sys"); if (sys) sys.remove();
    $("convoBody").appendChild(el('<div class="bubble ' + (m.mine ? "me" : "them") + '">' + esc(m.text) + '<span class="t">' + hm(m.at) + '</span></div>'));
    $("convoBody").scrollTop = $("convoBody").scrollHeight;
  }
  function closeMsgListener() { if (msgUnsub) { msgUnsub(); msgUnsub = null; } }
  function openChat(c) {
    closeMsgListener(); activeChat = c;
    var av = $("convoAv"); av.textContent = c.ai ? "✦" : ini(c.name); av.style.background = g(c.id);
    $("convoName").innerHTML = esc(c.name) + (c.ai ? '<span class="ai-pill">AI</span>' : ""); $("convoStatus").textContent = c.ai ? "Hamesha online" : "";
    $("moreBtn").hidden = !!c.ai;
    var body = $("convoBody"); body.innerHTML = "";
    if (c.ai) {
      body.appendChild(el('<div class="ai-note">✦ Saathi ek AI companion hai, asli insaan nahi. Ye baat karne aur sunne ke liye hai, doctor ya counsellor ka vikalp nahi. Zyada pareshan ho to kisi apne se ya helpline se zaroor baat karo.</div>'));
      getDocs(query(collection(db, "users", UID, "saathi"), orderBy("createdAt", "asc"), limit(60))).then(function (s) {
        if (activeChat !== c) return;
        if (s.empty) addBubble({ mine: false, text: "Namaste " + ME.name + " 🙏 Main Saathi hoon, ek AI. Din kaisa raha?", at: Date.now() });
        s.forEach(function (d) { var m = snapData(d); addBubble({ mine: m.role === "user", text: m.text, at: ms(m.createdAt) }); });
      }).catch(function () {});
    } else {
      msgUnsub = onSnapshot(query(collection(db, "matches", c.mid, "messages"), orderBy("createdAt", "asc"), limit(200)), function (s) {
        body.innerHTML = "";
        if (s.empty) body.appendChild(el('<div class="sys">Match ho gaya! Pehla message aap bhejo 👋</div>'));
        s.forEach(function (d) { var m = snapData(d); addBubble({ mine: m.from === UID, text: m.text, at: ms(m.createdAt) }); });
      }, function (e) { toast(errMsg(e)); });
    }
    $("convo").classList.add("open");
  }
  $("convoBack").addEventListener("click", function () { $("convo").classList.remove("open"); closeMsgListener(); activeChat = null; });

  var FALLBACK = ["Sunke accha laga. Aur batao, aap kaisa mehsoos kar rahe ho? 💜", "Main samajh sakta hoon. Aap akele nahi ho is me. 🤝", "Ye to badhiya hai! Thoda aur batao 😊", "Thoda ruk ke gehri saans lo. Aap bahut kuch sambhaal rahe ho, wo himmat ki baat hai.", "Kabhi kabhi din bhaari lagte hain. Ek kadam kaafi hai. 🌱"];
  function sendMsg() {
    var inp = $("msgInput"), t = clean(inp.value, 1000); if (!t || !activeChat) return; var c = activeChat; inp.value = "";
    if (c.ai) {
      addBubble({ mine: true, text: t, at: Date.now() });
      var col = collection(db, "users", UID, "saathi");
      addDoc(col, { role: "user", text: t, createdAt: serverTimestamp() }).catch(function () {});
      var typing = el('<div class="typing"><i></i><i></i><i></i></div>'); $("convoBody").appendChild(typing); $("convoBody").scrollTop = 1e9;
      setTimeout(function () {
        typing.remove(); var r = FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
        if (activeChat === c) addBubble({ mine: false, text: r, at: Date.now() });
        addDoc(col, { role: "assistant", text: r, createdAt: serverTimestamp() }).catch(function () {});
      }, 900 + Math.random() * 600);
      return;
    }
    var b = writeBatch(db), mref = doc(collection(db, "matches", c.mid, "messages"));
    b.set(mref, { from: UID, text: t, createdAt: serverTimestamp() });
    b.update(doc(db, "matches", c.mid), { lastText: t, lastAt: serverTimestamp(), lastFrom: UID });
    b.commit().catch(function (e) { toast(e && e.code === "permission-denied" ? "Ye user available nahi hai" : errMsg(e)); });
  }
  $("sendBtn").addEventListener("click", sendMsg);
  $("msgInput").addEventListener("keydown", function (e) { if (e.key === "Enter") sendMsg(); });

  $("moreBtn").addEventListener("click", function () {
    if (!activeChat || activeChat.ai) return;
    var body = $("convoBody"); if (body.querySelector(".safety")) return;
    var u = activeChat;
    var box = el('<div class="ai-note safety">' + esc(u.name) + ' ke saath: <button class="btn-outline" id="doBlock" style="margin:8px 4px 0;padding:8px 14px">Block karo</button><button class="btn-outline" id="doReport" style="margin:8px 4px 0;padding:8px 14px">Report karo</button></div>');
    body.appendChild(box); body.scrollTop = 1e9;
    $("doBlock").addEventListener("click", function () {
      setDoc(doc(db, "blocks", UID + "_" + u.id), { blocker: UID, blocked: u.id, createdAt: serverTimestamp() }).then(function () { blocked.add(u.id); toast("Block kar diya"); $("convo").classList.remove("open"); closeMsgListener(); activeChat = null; renderChats(); }).catch(function (e) { toast(errMsg(e)); });
    });
    $("doReport").addEventListener("click", function () {
      addDoc(collection(db, "reports"), { from: UID, to: u.id, reason: "Chat se report", createdAt: serverTimestamp() }).then(function () { toast("Report bhej di. Shukriya."); box.remove(); }).catch(function (e) { toast(errMsg(e)); });
    });
  });

  // ---- boot ----
  setMode("login");
  fetch("firebase-config.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (cfg) {
    if (!cfg.apiKey || /PASTE|YOUR/i.test(cfg.apiKey)) { $("authErr").textContent = "Setup baaki hai: public/firebase-config.json me Firebase ki details bharo."; return; }
    init(cfg);
  }).catch(function () { $("authErr").textContent = "Config nahi mili (firebase-config.json)."; });
})();
