// Pulse (Firebase version): Auth + Firestore + Hosting, sab free (Spark) plan par.
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, setPersistence, browserLocalPersistence, GoogleAuthProvider, onAuthStateChanged, signOut, deleteUser, sendEmailVerification, sendPasswordResetEmail } from "firebase/auth";
import {
  initializeFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, addDoc, query, where, orderBy, limit,
  getDocs, onSnapshot, serverTimestamp, arrayUnion, arrayRemove, Timestamp, writeBatch, increment, getCountFromServer,
  persistentLocalCache, persistentSingleTabManager
} from "firebase/firestore";
import { initAI, chat as aiChat, json as aiJson, aiWorking } from "./ai.js";
import { buildSong, Player, renderWav, GENRES } from "./music.js";
import { singLine, voiceList, langOf, singerSupported, stopSinging } from "./singer.js";
import * as Call from "./call.js";
import { serviceStart, serviceStop, routeAvailable, routeStart, routeList, routeSet, routeStop, startTone, stopTone, chime, secureScreen } from "./audioroute.js";
import { FILTERS, STICKERS, effectsSupported, createEffects } from "./effects.js";
import { DHAMS, art as dhamArt, photoOrArt, loadPhotos, daily as dailyDham, kindName, kindSym, loadDeityPhotos } from "./dham.js";
import { tr, getLang, setLang, initI18n } from "./i18n.js";
import { initSocial, stopSocial } from "./social.js";

(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var CREATOR_EMAIL = "jaihindkps@gmail.com";
  var auth, db, UID = null, ME = null, signingUp = false;
  var unsubs = [], blocked = new Set(), nameCache = {};

  var grads = ["linear-gradient(135deg,#0FA58B,#1E7BE0)","linear-gradient(135deg,#18c2a8,#7c4dff)","linear-gradient(135deg,#ff8a3d,#ff4d8d)","linear-gradient(135deg,#4d8dff,#18c2a8)","linear-gradient(135deg,#ff4d8d,#ff8a3d)","linear-gradient(135deg,#9b4dff,#4d8dff)"];
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  function g(key) { return grads[Math.abs(hash(String(key))) % grads.length]; }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }
  function ini(n) { return esc((n || "?").trim().charAt(0).toUpperCase()); }
  function ms(v) { return v && v.toMillis ? v.toMillis() : Date.now(); }
  function ago(t) {
    var s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + "m ago";
    if (s < 86400) return Math.floor(s / 3600) + "h ago"; return Math.floor(s / 86400) + "d ago";
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
      "auth/email-already-in-use": "This email is already registered. Please log in.",
      "auth/invalid-email": "Please enter a valid email.", "auth/weak-password": "Password must be at least 6 characters.",
      "auth/invalid-credential": "Email or password is wrong. If you just signed up, verify your email first. Forgot it? Use \"Forgot password?\".", "auth/operation-not-allowed": "Email login is not switched on in Firebase yet (Authentication > Sign-in method > Email/Password).", "auth/unauthorized-domain": "This website address is not allowed in Firebase (Authentication > Settings > Authorized domains).", "auth/invalid-api-key": "App key is invalid. Check firebase-config.json.", "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "App key is invalid. Check firebase-config.json.", "auth/user-disabled": "This account has been disabled.", "auth/missing-password": "Type your password.", "auth/missing-email": "Type your email.", "auth/internal-error": "Server problem. Try again in a minute.", "auth/wrong-password": "Email or password is wrong.", "auth/user-not-found": "Email or password is wrong.",
      "auth/too-many-requests": "Too many attempts. Please try again shortly.", "auth/network-request-failed": "Please check your internet connection.",
      "permission-denied": "You don't have permission to do this.", "unavailable": "Please check your internet connection."
    };
    return map[c] || ((e && e.message ? e.message : "Something went wrong") + (c ? " [" + c + "]" : ""));
  }

  // ---- theme ----
  function isDark() { var t = root.getAttribute("data-theme"); return t ? t === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches; }
  $("themeBtn").addEventListener("click", function () { root.setAttribute("data-theme", isDark() ? "light" : "dark"); });

  // ---- auth UI ----
  var mode = "login";
  var googleUser = null; // set only while a just-signed-in Google user still needs to complete their Pulse profile
  function setMode(m) {
    mode = m;
    $("segLogin").classList.toggle("on", m === "login"); $("segSignup").classList.toggle("on", m === "signup");
    $("signupOnly").hidden = m === "login"; $("authBtn").textContent = m === "login" ? "Login" : "Create account";
    $("aPass").setAttribute("autocomplete", m === "login" ? "current-password" : "new-password");
    $("aName").required = $("aAge").required = m === "signup"; $("authErr").textContent = "";
  }
  function resetAuthChrome() {
    googleUser = null; $("emailRow").style.display = ""; $("pwRow").style.display = ""; $("aUser").required = true;
    $("segBox").style.display = ""; $("googleBtn").style.display = ""; $("googleBtn").disabled = false; $("googleBtnLbl").textContent = "Continue with Google";
    document.querySelector(".auth-or").style.display = "";
    resetModeGrid();
  }
  // Har baar signup form naya khulta hai (fresh page load, ya logout ke baad), "I am here for" wapas
  // "Friendship" pe reset ho, taaki pichhli session ka mode chup-chaap carry na ho.
  function resetModeGrid() {
    signMode = "friends";
    var g = $("modeGrid"); if (!g) return;
    g.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-m") === "friends"); });
    var box = $("aMateBox"); if (box) box.hidden = true;
    var gSel = $("aGender"), sSel = $("aSeeking"); if (gSel) gSel.value = ""; if (sSel) sSel.value = "Everyone";
  }
  function showGoogleOnboarding(u) {
    googleUser = u; $("auth").hidden = false; $("authForm").style.display = ""; $("segBox").style.display = "none"; $("verifyBox").style.display = "none";
    document.querySelector(".auth-or").style.display = "none"; $("googleBtn").style.display = "none";
    $("emailRow").style.display = "none"; $("aUser").required = false; $("pwRow").style.display = "none"; $("aPass").required = false;
    $("signupOnly").hidden = false; $("aName").required = true; $("aAge").required = true;
    $("aName").value = u.displayName || ""; $("authErr").textContent = "";
    $("authBtn").textContent = "Complete profile";
  }
  // WhatsApp/Instagram/Facebook jaise in-app browsers (WebView) me Google jaanbujh kar
  // sign-in block ya restrict karta hai (security ke naam par) — isse login "hota hai par
  // tikta nahi" jaisa lagta hai. Isko detect karke seedha bata dete hain.
  function isInAppWebView() {
    var ua = navigator.userAgent || "";
    return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|WhatsApp|Snapchat|TikTok/i.test(ua) || (/; wv\)/i.test(ua) && /Android/i.test(ua));
  }
  // Mobile par signInWithPopup ka asli root-cause bug: Safari/Chrome mobile popup ko ek alag
  // storage partition me treat karte hain (ITP / third-party-context jaisa), isliye login ho to
  // jaata hai par session is hi tab/page par save nahi hota — app band karke dobara kholo to phir
  // login maangta hai, jabki Google apna khud ka session yaad rakhta hai (isliye dubara click karte
  // hi turant ho jaata hai — confusing hai lekin ye session-persistence ka failure hai, login ka nahi).
  // signInWithRedirect isse bachata hai kyunki ye ek poora page-navigation hai, popup nahi — isliye
  // mobile par hamesha redirect use karo; desktop par popup (zyada smooth UX, ye bug wahan nahi aata).
  function isMobileDevice() { return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "") || (window.matchMedia && window.matchMedia("(max-width: 820px)").matches); }
  if (isInAppWebView()) {
    var note = el('<div class="st-note" style="margin-top:6px">If Google sign-in keeps failing to stay signed in: this page looks like it is open inside another app\'s (WhatsApp/Instagram) built-in browser — tap the "⋮" menu and choose "Open in Chrome/Browser", then sign in with Google there. Sign-in stays saved reliably in Chrome/Safari.</div>');
    var gb = $("googleBtn"); if (gb && gb.parentNode) gb.parentNode.insertBefore(note, gb.nextSibling);
  }
  // Installed Android app: Google sign-in redirects out to Chrome, which has no saved login state
  // ("missing initial state" error). Hide it there; email + password login works fully in-app.
  var isNativeApp = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === "function" && window.Capacitor.isNativePlatform());
  if (isNativeApp) document.documentElement.classList.add("native-app"); // CSS hides #googleBtn + .auth-or (setMode resets inline styles, so CSS is the reliable way)
  $("googleBtn").addEventListener("click", function () {
    if (!auth) { $("authErr").textContent = "The app isn't configured yet (firebase-config.json is empty)."; return; }
    var btn = this; btn.disabled = true; $("googleBtnLbl").textContent = "Connecting...";
    setPersistence(auth, browserLocalPersistence).catch(function () {}).then(function () {
      if (isMobileDevice()) return signInWithRedirect(auth, new GoogleAuthProvider());
      return signInWithPopup(auth, new GoogleAuthProvider());
    }).catch(function (e) {
      var code = e && e.code;
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") { btn.disabled = false; $("googleBtnLbl").textContent = "Continue with Google"; return; }
      // Popup kaam na kare (blocked / unsupported in this environment) to redirect flow try karo.
      if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment" || code === "auth/web-storage-unsupported") {
        signInWithRedirect(auth, new GoogleAuthProvider()).catch(function (e2) { btn.disabled = false; $("googleBtnLbl").textContent = "Continue with Google"; $("authErr").textContent = errMsg(e2); });
        return;
      }
      btn.disabled = false; $("googleBtnLbl").textContent = "Continue with Google"; $("authErr").textContent = errMsg(e);
    });
  });
  $("pwEye").addEventListener("click", function () { var f = $("aPass"), show = f.type === "password"; f.type = show ? "text" : "password"; this.textContent = show ? "🙈" : "👁"; this.setAttribute("aria-label", show ? "Hide password" : "Show password"); f.focus(); });
  $("segLogin").addEventListener("click", function () { setMode("login"); });
  $("segSignup").addEventListener("click", function () { setMode("signup"); });

  $("authForm").addEventListener("submit", function (e) {
    e.preventDefault(); $("authErr").textContent = "";
    if (!auth) {
      // Started too early (config still loading): wait for start-up, then submit again instead of showing a setup error.
      $("authErr").textContent = "Starting up...";
      (window.__pulseBoot || Promise.resolve()).then(function () {
        if (auth) { $("authErr").textContent = ""; $("authForm").requestSubmit(); } else $("authErr").textContent = "Could not start the app. Check your internet and reload.";
      });
      return;
    }
    if (googleUser) {
      var gu = googleUser, gAge = parseInt($("aAge").value, 10), gName = clean($("aName").value, 40);
      if (!gName) { $("authErr").textContent = "Please enter your name"; return; }
      if (!(gAge >= 18 && gAge <= 99)) { $("authErr").textContent = "This app is for ages 18 and up only"; return; }
      if (!$("aAdult").checked) { $("authErr").textContent = "Please confirm you are 18+ and accept the policy"; return; }
      if (!$("aGender").value) { $("authErr").textContent = "Please select your gender (\"I am\")"; return; }
      $("authBtn").disabled = true;
      var gProf = { name: gName, age: gAge, city: clean($("aCity").value, 40), work: "", about: "", looking: ({ friends: "Friendship", dating: "Dating", marriage: "Marriage" })[signMode] || "Friendship", mode: signMode, gender: $("aGender").value, seeking: isMateMode(signMode) ? $("aSeeking").value : "", hidden: false, consentV: "2026-11", consentAt: serverTimestamp(), createdAt: serverTimestamp() };
      setDoc(doc(db, "users", gu.uid), gProf).then(function () { googleUser = null; UID = gu.uid; ME = Object.assign({}, gProf, { uid: UID }); return afterAuth(gu); })
        .catch(function (err) { $("authErr").textContent = errMsg(err); }).then(function () { $("authBtn").disabled = false; });
      return;
    }
    var email = $("aUser").value.trim(), pw = $("aPass").value;
    $("authBtn").disabled = true;
    var p;
    if (mode === "login") {
      p = signInWithEmailAndPassword(auth, email, pw);
    } else {
      var age = parseInt($("aAge").value, 10), name = clean($("aName").value, 40);
      if (!name) { $("authErr").textContent = "Please enter your name"; $("authBtn").disabled = false; return; }
      if (!(age >= 18 && age <= 99)) { $("authErr").textContent = "This app is for ages 18 and up only"; $("authBtn").disabled = false; return; }
      if (!$("aAdult").checked) { $("authErr").textContent = "Please confirm you are 18+ and accept the policy"; $("authBtn").disabled = false; return; }
      if (!$("aGender").value) { $("authErr").textContent = "Please select your gender (\"I am\")"; $("authBtn").disabled = false; return; }
      signingUp = true;
      p = createUserWithEmailAndPassword(auth, email, pw).then(function (cred) {
        var prof = { name: name, age: age, city: clean($("aCity").value, 40), work: "", about: "", looking: ({ friends: "Friendship", dating: "Dating", marriage: "Marriage" })[signMode] || "Friendship", mode: signMode, gender: $("aGender").value, seeking: isMateMode(signMode) ? $("aSeeking").value : "", hidden: false, consentV: "2026-11", consentAt: serverTimestamp(), createdAt: serverTimestamp() };
        return setDoc(doc(db, "users", cred.user.uid), prof).then(function () { UID = cred.user.uid; ME = Object.assign({}, prof, { uid: UID }); signingUp = false; lastSent = Date.now(); return sendEmailVerification(cred.user).catch(function () { lastSent = 0; }).then(function () { return afterAuth(cred.user); }); })
          .catch(function (err) { return deleteUser(cred.user).catch(function () {}).then(function () { throw err; }); });
      });
    }
    p.then(function () { $("aPass").value = ""; }).catch(function (err) { signingUp = false; $("authErr").textContent = errMsg(err); }).then(function () { $("authBtn").disabled = false; });
  });
  $("logoutBtn").addEventListener("click", function () { signOut(auth).then(function () { toast("Logged out"); }); });

  function stopAll() { stopSocial(); leaveRoom(true); stopNearby(); endCall(false); player.stop(); unsubs.forEach(function (u) { try { u(); } catch (e) {} }); unsubs = []; }

  // ---- start / stop ----
  function start() {
    $("auth").hidden = true;
    $("meAv").textContent = $("pAv").textContent = (ME.name || "?").charAt(0).toUpperCase();
    $("pName").innerHTML = esc(ME.name) + creatorBadge(ME); $("pHandle").textContent = ME.city || "";
    $("eName").value = ME.name || ""; $("eCity").value = ME.city || ""; $("eWork").value = ME.work || ""; $("eAbout").value = ME.about || "";
    getDocs(query(collection(db, "blocks"), where("blocker", "==", UID))).then(function (s) { blocked = new Set(); s.forEach(function (d) { blocked.add(d.data().blocked); }); }).catch(function () {}).then(function () {
      applyMode(); listenApps(); listenReqs(); onboard(); paintInterests(); paintStreakMeter(); listenCalls(); listenSongs(); initSocial({ db: db, uid: function () { return UID; }, me: function () { return ME; }, toast: toast, errMsg: errMsg, showTab: showTab, rate: rate, blocked: function () { return blocked; } }); listenFeed(); listenStories(); listenMatches(); refreshLocToggle(); showTab("feed"); setLive(); paintAv(); creatorPanel(); pendingRoom(); heartbeat(); ensureCreatorFlag();
    });
  }
  // One-time self-write so OTHER members' screens can show the 👑 Creator badge (creatorBadge() below).
  // Harmless no-op for every non-admin account.
  function ensureCreatorFlag() {
    if (auth.currentUser.email === CREATOR_EMAIL && !ME.creator) { ME.creator = true; updateDoc(doc(db, "users", UID), { creator: true }).catch(function () {}); }
  }
  function creatorBadge(u) { return u && u.creator ? ' <span title="Pulse Creator">👑</span>' : ""; }
  // Last-active timestamp (like every other app's "last seen") so the Creator Panel can show who is online, for moderation/abuse monitoring only. Never shown to other members.
  var hbTimer = null;
  function heartbeat() {
    function ping() { if (UID) updateDoc(doc(db, "users", UID), { lastSeen: serverTimestamp() }).catch(function () {}); }
    ping(); if (hbTimer) clearInterval(hbTimer); hbTimer = setInterval(ping, 120000);
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") ping(); });
  }
  function init(cfg) {
    var app = initializeApp(cfg);
    auth = getAuth(app);
    // Offline cache taaki app me thoda sa bhi network hichkichahat ho (mobile data switch waqt)
    // to login/profile baar-baar poochne ke bajaye aakhri-jaana-hua data se turant kaam chale.
    try {
      db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true, localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }) });
    } catch (e) { db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true }); }
    initAI(app);
    // Agar Google sign-in redirect-flow se hua tha (popup kaam nahi kiya), uska result/error yahan aata hai.
    // Session to onAuthStateChanged se hi ban jata hai — ye sirf kisi redirect-error ko silently lost hone se bachata hai.
    getRedirectResult(auth).catch(function (e) { if (e && e.code && e.code !== "auth/no-auth-event") $("authErr").textContent = errMsg(e); });
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
  function showForms() { $("verifyBox").style.display = "none"; $("authForm").style.display = ""; $("vErr").textContent = ""; resetAuthChrome(); }
  function showVerify(u) {
    $("auth").hidden = false; $("authForm").style.display = "none"; $("segBox").style.display = "none"; $("verifyBox").style.display = "";
    $("vMsg").textContent = "A verification email has been sent to " + u.email + ". Click the link in the email (check your Spam folder too), then tap the button below.";
  }
  // Network thoda sa bhi hichke (mobile data switch, weak signal) to Firestore ka getDoc()
  // fail ho sakta hai — isse user ko turant poore login screen pe nahi bhejna (wo "logout ho gaya"
  // jaisa lagta hai jabki session asli me valid hi hota hai). Aise transient errors pe chup-chaap
  // kuch baar retry karo, sirf genuine "no profile"/"banned" case me hi login screen dikhao.
  function isTransientErr(e) {
    var c = (e && e.code) || "";
    if (!navigator.onLine) return true;
    return c === "unavailable" || c === "deadline-exceeded" || c === "resource-exhausted" || c === "cancelled" || c === "internal" || c === "auth/network-request-failed";
  }
  function afterAuth(u, attempt) {
    attempt = attempt || 0;
    if (!u.emailVerified) { showVerify(u); return Promise.resolve(); }
    return getDoc(doc(db, "users", u.uid)).then(function (s) {
      if (!s.exists()) {
        var isGoogle = (u.providerData || []).some(function (p) { return p.providerId === "google.com"; });
        if (isGoogle) { showGoogleOnboarding(u); return; }
        signOut(auth); showForms(); $("auth").hidden = false; $("authErr").textContent = "No profile found. Please create a new account."; return;
      }
      return getDoc(doc(db, "bans", u.uid)).catch(function () { return { exists: function () { return false; } }; }).then(function (b) { if (b.exists()) { signOut(auth); showForms(); $("auth").hidden = false; $("authErr").textContent = "This account has been suspended for breaking the rules."; return; } showForms(); UID = u.uid; ME = Object.assign({}, s.data(), { uid: UID }); start(); });
    }).catch(function (e) {
      if (isTransientErr(e) && attempt < 5) { if (attempt === 0) toast("Reconnecting..."); setTimeout(function () { afterAuth(u, attempt + 1); }, Math.min(1000 * Math.pow(1.7, attempt), 8000)); return; }
      showForms(); $("auth").hidden = false; $("authErr").textContent = errMsg(e);
    });
  }
  var lastSent = 0;
  function sendVerify(u) {
    if (Date.now() - lastSent < 60000) { $("vErr").textContent = "Please wait a minute, then resend."; return Promise.resolve(); }
    lastSent = Date.now();
    return sendEmailVerification(u).then(function () { $("vErr").textContent = "Email sent."; }).catch(function (e) { lastSent = 0; $("vErr").textContent = errMsg(e); });
  }
  $("vDone").addEventListener("click", function () {
    var u = auth && auth.currentUser; if (!u) return; $("vErr").textContent = "";
    u.reload().then(function () { return u.getIdToken(true); }).then(function () {
      if (u.emailVerified) afterAuth(u); else $("vErr").textContent = "Not verified yet. Open the link in the email, then tap again.";
    }).catch(function (e) { $("vErr").textContent = errMsg(e); });
  });
  $("vResend").addEventListener("click", function () { if (auth && auth.currentUser) sendVerify(auth.currentUser); });
  $("vOut").addEventListener("click", function () { signOut(auth); });

  // ---- tabs ----
  var titles = { feed: "Pulse", jobs: "Jobs", discover: "Discover", nearby: "Nearby", studio: "Gaana Studio", chats: "Messages", profile: "Profile" };
  var screens = ["feed", "discover", "jobs", "nearby", "studio", "chats", "profile"];
  // keep floating buttons / scroll padding clear of the tab bar whatever the phone's font scaling is
  function fitTabbar() { var tb = document.querySelector(".tabbar"); if (tb && tb.offsetHeight) document.documentElement.style.setProperty("--tabbar-h", tb.offsetHeight + "px"); }
  window.addEventListener("resize", fitTabbar); window.addEventListener("load", fitTabbar); setTimeout(fitTabbar, 600);
  function showTab(name) {
    var key = name; if (name === "discover" && isJobMode()) name = "jobs";
    screens.forEach(function (s) { $("screen-" + s).hidden = s !== name; });
    var scNow = $("screen-" + name); if (scNow) scNow.scrollTop = 0; fitTabbar();
    document.querySelectorAll(".tab").forEach(function (t) { var k = t.getAttribute("data-tab"); t.classList.toggle("active", k === key || (k === "more" && (key === "nearby" || key === "studio"))); });
    $("moreSheet").hidden = true;
    $("screenTitle").textContent = titles[name];
    try { if (name === "discover") loadDeck(); if (name === "jobs") loadJobs(); } catch (e) { toast("Could not load this screen. Please try again."); } if (name === "nearby") loadNearby(); else stopNearby(); if (name === "studio") renderLib(); if (name === "chats") { $("chatDot").hidden = true; renderChats(); } if (name === "profile") { renderCircle(); renderJourney(); }
  }
  document.querySelectorAll(".tab").forEach(function (t) { t.addEventListener("click", function () { var k = t.getAttribute("data-tab"); if (!UID) return; if (k === "more") { $("moreSheet").hidden = !$("moreSheet").hidden; return; } showTab(k); }); });
  $("moreNearby").addEventListener("click", function () { showTab("nearby"); });
  $("moreStudio").addEventListener("click", function () { showTab("studio"); });
  document.addEventListener("pointerdown", function (e) { var m = $("moreSheet"); if (!m.hidden && !m.contains(e.target) && !$("tabMore").contains(e.target)) m.hidden = true; });

  // ---- feed (realtime) ----
  var postText = $("composerText");
  postText.addEventListener("input", function () { this.style.height = "auto"; this.style.height = this.scrollHeight + "px"; $("postBtn").disabled = !this.value.trim(); $("charCount").textContent = this.value.length + "/500"; });
  $("postBtn").addEventListener("click", function () {
    var t = clean(postText.value, 500); if (!t || !rate("post", 4, 60000)) return; this.disabled = true;
    autoFlag(t, "post"); addDoc(collection(db, "posts"), { uid: UID, name: ME.name, text: t, likedBy: [], createdAt: serverTimestamp() })
      .then(function () { postText.value = ""; postText.style.height = "auto"; $("charCount").textContent = "0/500"; toast("Post ho gaya 🎉"); bump("cPosts"); })
      .catch(function (e) { toast(errMsg(e)); $("postBtn").disabled = false; });
  });
  var DAILY = ["What is one thing you are grateful for today?", "What is a small win you had this week?", "Which skill do you wish you had learned earlier?", "What is your go-to comfort food?", "Who made you smile recently, and how?", "What is a place you want to visit this year?", "What advice would you give your younger self?", "What is a song that always lifts your mood?", "What is something kind you did for someone lately?", "What is the best meal you ever had?"];
  var INTERESTS = ["Music", "Movies", "Travel", "Cricket", "Food", "Books", "Fitness", "Gaming", "Photography", "Art", "Tech", "Dance", "Cooking", "Yoga", "Nature", "Poetry"], pickedInt = [];
  function pickedInterests() { return pickedInt.slice(0, 6); }
  function paintInterests() {
    var box = $("eInterests"); if (!box) return; pickedInt = String((ME && ME.interests) || "").split(",").filter(Boolean); box.innerHTML = "";
    INTERESTS.forEach(function (n) {
      var b = el('<button type="button" class="int-chip"></button>'); b.textContent = n; b.classList.toggle("on", pickedInt.indexOf(n) >= 0);
      b.addEventListener("click", function () { var i = pickedInt.indexOf(n); if (i >= 0) pickedInt.splice(i, 1); else if (pickedInt.length < 6) pickedInt.push(n); else { toast("Pick up to 6 interests"); return; } b.classList.toggle("on", pickedInt.indexOf(n) >= 0); });
      box.appendChild(b);
    });
  }
  function paintStreakMeter() {
    var days = 1; try { var k = "pulse_streak", s = JSON.parse(localStorage.getItem(k) || "{}"), today = Math.floor(Date.now() / 86400000);
      if (s.d === today) days = s.n || 1; else { days = s.d === today - 1 ? (s.n || 0) + 1 : 1; localStorage.setItem(k, JSON.stringify({ d: today, n: days })); } } catch (e) {}
    var st = $("pStreak"); if (st) st.textContent = days > 1 ? days + "-day streak" : "Day 1";
    var got = [ME.photo, ME.about, ME.city, ME.work, ME.interests].filter(Boolean).length, pct = 40 + got * 12, m = $("pMeter");
    if (m) { m.hidden = pct >= 100; m.innerHTML = '<div class="pm-t">Profile ' + pct + '% complete. Add a photo, about, city, work and interests.</div><div class="pm-b"><i style="width:' + pct + '%"></i></div>'; }
  }
  function dailyQuestion() {
    var q = DAILY[Math.floor(Date.now() / 86400000) % DAILY.length], host = $("dailyQ"); if (!host) return;
    host.innerHTML = '<div class="dq-l">Question of the day</div><div class="dq-q"></div><button type="button" class="btn-grad dq-b">Write your answer</button>';
    host.querySelector(".dq-q").textContent = q;
    host.querySelector(".dq-b").onclick = function () { postText.value = q + " "; postText.dispatchEvent(new Event("input")); postText.focus(); };
  }
  function onboard() {
    var done = false; try { done = localStorage.getItem("pulse_onb1") === "1"; } catch (e) {}
    if (done || $("onb")) return;
    var steps = [["Meet real people", "Friends, dating, marriage and jobs in one place, for 18+ only."], ["Talk your way", "Chat, voice and video calls, plus Saathi, an AI companion that listens."], ["Stay safe", "Block, report and a hidden Safety Circle shield keep you in control."]], i = 0;
    var o = el('<div class="onb" id="onb"><div class="onb-card"><div class="onb-dots"></div><h2 class="onb-h"></h2><p class="onb-p"></p><button type="button" class="btn-grad onb-next"></button><button type="button" class="onb-skip">Skip</button></div></div>');
    function paint() {
      o.querySelector(".onb-h").textContent = steps[i][0]; o.querySelector(".onb-p").textContent = steps[i][1];
      o.querySelector(".onb-next").textContent = i === steps.length - 1 ? "Get started" : "Next";
      o.querySelector(".onb-dots").innerHTML = steps.map(function (_, k) { return '<i class="' + (k === i ? "on" : "") + '"></i>'; }).join("");
    }
    function close() { try { localStorage.setItem("pulse_onb1", "1"); } catch (e) {} o.remove(); }
    o.querySelector(".onb-next").onclick = function () { if (i < steps.length - 1) { i++; paint(); } else close(); };
    o.querySelector(".onb-skip").onclick = close;
    document.body.appendChild(o); paint();
  }
  function listenFeed() {
    dailyQuestion();
    unsubs.push(onSnapshot(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50)), function (snap) {
      var f = $("feed"); f.innerHTML = ""; var n = 0;
      snap.forEach(function (d) {
        var p = snapData(d); if (blocked.has(p.uid)) return; n++;
        var liked = (p.likedBy || []).indexOf(UID) >= 0;
        var node = el('<article class="post"><div class="post-head" data-uid="' + esc(p.uid) + '" style="cursor:pointer"><div class="av-sm" style="background:' + g(p.uid) + '">' + ini(p.name) + '</div><div class="who"><div class="name">' + esc(p.name) + creatorBadge(p) + '</div><div class="meta">' + ago(ms(p.createdAt)) + '</div></div></div><p class="post-text">' + esc(p.text) + '</p><div class="post-actions"><button class="act like ' + (liked ? "liked" : "") + '"><svg viewBox="0 0 24 24" fill="' + (liked ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-4.3-9.3-8.5C.9 9.4 2.4 6 5.6 6c1.9 0 3.2 1.1 4.4 2.5C11.2 7.1 12.5 6 14.4 6c3.2 0 4.7 3.4 2.9 6.5C19 16.7 12 21 12 21Z"/></svg><span class="cnt">' + (p.likedBy || []).length + '</span></button></div></article>');
        paintPhoto(node.querySelector(".av-sm"), p.uid);
        node.querySelector(".like").addEventListener("click", function () {
          updateDoc(d.ref, { likedBy: liked ? arrayRemove(UID) : arrayUnion(UID) }).catch(function (e) { toast(errMsg(e)); });
        });
        f.appendChild(node);
      });
      if (!n) f.innerHTML = '<div class="empty">Abhi koi post nahi. Pehli post aap likho! ✍️</div>';
    }, function (e) { toast(errMsg(e)); }));
  }

  // ---- status / stories (24-ghante wali, sirf apne jaise mode wale logon ko dikhti hai) ----
  var storyGroups = [], myStory = null, storyPhotoData = "";
  function seenStories() { try { return JSON.parse(localStorage.getItem("pulse_seenStories") || "{}"); } catch (e) { return {}; } }
  function markSeen(id) { var s = seenStories(); s[id] = Date.now(); var keys = Object.keys(s); if (keys.length > 300) keys.slice(0, keys.length - 300).forEach(function (k) { delete s[k]; }); try { localStorage.setItem("pulse_seenStories", JSON.stringify(s)); } catch (e) {} }
  function listenStories() {
    var cutoff = Timestamp.fromMillis(Date.now() - 24 * 3600000);
    unsubs.push(onSnapshot(query(collection(db, "stories"), where("mode", "==", MODE), where("createdAt", ">=", cutoff), orderBy("createdAt", "desc"), limit(100)), function (snap) {
      var byUser = {}, mine = null;
      snap.forEach(function (d) {
        var s = Object.assign({ id: d.id }, snapData(d)); if (blocked.has(s.uid)) return;
        if (s.uid === UID) { if (!mine) mine = s; return; }
        if (!byUser[s.uid]) byUser[s.uid] = s;
      });
      myStory = mine; storyGroups = Object.keys(byUser).map(function (k) { return byUser[k]; }).sort(function (a, b) { return ms(b.createdAt) - ms(a.createdAt); });
      paintStories();
    }, function () {}));
  }
  function paintStories() {
    var bar = $("storiesBar"); if (!bar) return; bar.innerHTML = "";
    var seen = seenStories();
    var mine = el('<div class="story" id="stMine"><div class="ring ' + (myStory ? "" : "add") + '">' + (myStory ? ('<div class="av">' + (myStory.photo ? '' : ini(ME.name)) + '</div>') : '<span class="add-plus">+</span>') + '</div><span>' + (myStory ? "You" : "Add status") + '</span></div>');
    if (myStory && myStory.photo) mine.querySelector(".av").style.background = "center/cover url(" + myStory.photo + ")"; else if (myStory) mine.querySelector(".av").style.background = g(UID);
    mine.addEventListener("click", function () { if (myStory) openStoryView(myStory, true); else openStoryComposer(); });
    bar.appendChild(mine);
    storyGroups.forEach(function (s) {
      var node = el('<div class="story"><div class="ring ' + (seen[s.id] ? "seen" : "") + '"><div class="av" style="background:' + (s.photo ? ("center/cover url(" + s.photo + ")") : g(s.uid)) + '">' + (s.photo ? "" : ini(s.name)) + '</div></div><span>' + esc(s.name) + '</span></div>');
      node.addEventListener("click", function () { markSeen(s.id); node.querySelector(".ring").classList.add("seen"); openStoryView(s, false); });
      bar.appendChild(node);
    });
  }
  function openStoryComposer() {
    $("storyModeHint").textContent = MODE_LABEL[MODE] || "aapke"; $("storyText").value = ""; storyPhotoData = ""; $("storyPhotoPreview").style.display = "none"; $("storyComposerUI").hidden = false;
  }
  $("storyComposerClose").addEventListener("click", function () { $("storyComposerUI").hidden = true; });
  $("storyAddPhoto").addEventListener("click", function () { $("storyPhotoInput").click(); });
  $("storyPhotoInput").addEventListener("change", function () {
    var f = this.files && this.files[0]; this.value = ""; if (!f) return;
    shrink(f, 640, 0.6).then(function (d) { storyPhotoData = d; $("storyPhotoImg").src = d; $("storyPhotoPreview").style.display = ""; }).catch(function (e) { toast(errMsg(e)); });
  });
  $("storyPhotoRemove").addEventListener("click", function () { storyPhotoData = ""; $("storyPhotoPreview").style.display = "none"; });
  $("storyPostBtn").addEventListener("click", function () {
    var t = clean($("storyText").value, 150);
    if (!t && !storyPhotoData) { toast("Write something or add a photo"); return; }
    if (!rate("story", 6, 300000)) return;
    this.disabled = true; var btn = this;
    if (t) autoFlag(t, "status");
    addDoc(collection(db, "stories"), { uid: UID, name: ME.name, mode: MODE, text: t, photo: storyPhotoData, createdAt: serverTimestamp() })
      .then(function () { $("storyComposerUI").hidden = true; toast("Status posted ✅"); bump("cStatus"); })
      .catch(function (e) { toast(errMsg(e)); }).then(function () { btn.disabled = false; });
  });
  function openStoryView(s, isMine) {
    $("svAv").style.background = g(s.uid); $("svAv").textContent = ini(s.name); $("svName").textContent = isMine ? "Your status" : esc(s.name);
    $("svTime").textContent = ago(ms(s.createdAt)); $("svDelete").hidden = !isMine;
    if (s.photo) { $("svPhoto").src = s.photo; $("svPhoto").hidden = false; } else { $("svPhoto").hidden = true; $("svPhoto").src = ""; }
    $("svText").textContent = s.text || "";
    $("storyViewUI").hidden = false; $("storyViewUI").dataset.sid = s.id;
  }
  $("svClose").addEventListener("click", function () { $("storyViewUI").hidden = true; });
  $("svDelete").addEventListener("click", function () {
    var id = $("storyViewUI").dataset.sid; if (!id || !window.confirm("Delete this status?")) return;
    deleteDoc(doc(db, "stories", id)).then(function () { $("storyViewUI").hidden = true; toast("Deleted"); }).catch(function (e) { toast(errMsg(e)); });
  });

  // ---- discover ----
  var queue = [], dragging = false, sx = 0, cx = 0, topCard = null, topUser = null, busy = false;
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function loadDeck() {
    Promise.all([getDocs(query(collection(db, "users"), where("mode", "==", MODE), limit(60))), getDocs(query(collection(db, "swipes"), where("from", "==", UID))), getDocs(query(collection(db, "swipes"), where("to", "==", UID))).catch(function () { return []; })]).then(function (r) {
      var done = new Set(); r[1].forEach(function (d) { done.add(d.data().to); });
      var likers = new Set(); r[2].forEach(function (d) { var x = d.data(); if (x.kind === "like") likers.add(x.from); });
      var list = []; r[0].forEach(function (d) { var u = Object.assign({ id: d.id }, d.data()); if (d.id !== UID && !done.has(d.id) && !blocked.has(d.id) && deckOk(u)) { u.likedMe = likers.has(d.id); list.push(u); } });
      list = shuffle(list); var first = list.filter(function (u) { return u.likedMe; }), rest = list.filter(function (u) { return !u.likedMe; });
      queue = first.concat(rest).slice(0, 20); renderDeck();
      var lb = $("likedBanner"); if (lb) { lb.hidden = !first.length; lb.textContent = first.length + (first.length === 1 ? " person likes you. They are first in your deck." : " people like you. They are first in your deck."); }
    }).catch(function (e) { toast(errMsg(e)); });
  }
  function renderDeck() {
    var deck = $("deck"); deck.innerHTML = ""; topCard = topUser = null;
    if (!queue.length) { deck.innerHTML = '<div class="deck-empty"><div><div style="font-size:42px;margin-bottom:8px">💫</div><div style="font-weight:700;font-size:16px;color:var(--fg);margin-bottom:4px">You have seen everyone for now</div><div style="font-size:13px;margin-bottom:14px">New people show up here as they join. Invite a friend to get things moving.</div><button class="btn-grad" id="deckInvite" type="button">Invite friends</button></div></div>'; var di = $("deckInvite"); if (di) di.addEventListener("click", invite); return; }
    queue.slice(0, 3).reverse().forEach(function (u, i, arr) {
      var top = i === arr.length - 1, depth = arr.length - 1 - i;
      var c = el('<div class="swipe-card" style="background:' + g(u.id) + ';transform:translateY(' + depth * 14 + 'px) scale(' + (1 - depth * 0.05) + ')"><div class="scrim"></div><div class="avatar-big"' + (u.photo && JPEG.test(u.photo) ? ' style="background:center/cover url(' + u.photo + ')"' : "") + '>' + (u.photo && JPEG.test(u.photo) ? "" : ini(u.name)) + '</div><span class="stamp like">Like</span><span class="stamp nope">Nope</span><div class="info"><h3>' + esc(u.name) + (u.age ? ", " + u.age : "") + vBadge(u) + creatorBadge(u) + '</h3><div class="sub">' + esc([u.work, u.city].filter(Boolean).join(" · ") || "Pulse member") + '</div>' + (u.about ? '<p class="about">' + esc(u.about) + '</p>' : '') + '<div class="tags">' + (u.likedMe ? '<span class="lk-me">Likes you</span>' : "") + '<span>' + esc(MODE_LABEL[modeOf(u)]) + '</span>' + String(u.interests || "").split(",").filter(Boolean).slice(0, 4).map(function (x) { return "<span>" + esc(x) + "</span>"; }).join("") + '</div>' + factsFor(u) + '</div></div>');
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
      bump("cSwipes");
      if (kind !== "like") return;
      return getDoc(doc(db, "swipes", u.id + "_" + UID)).then(function (s) {
        if (!s.exists() || s.data().kind !== "like") return;
        var mref = doc(db, "matches", pairId(UID, u.id)), ids = [UID, u.id].sort();
        return getDoc(mref).then(function (m) {
          if (m.exists()) { showMatch(u); return; } // doosre ne pehle hi match bana diya
          return setDoc(mref, { users: ids, createdAt: serverTimestamp(), lastText: "", lastAt: serverTimestamp(), lastFrom: "" }).then(function () { showMatch(u); bump("cMatches"); });
        });
      });
    }).catch(function (e) { toast(errMsg(e)); });
    setTimeout(function () { busy = false; renderDeck(); }, 260);
  }
  $("btnLike").addEventListener("click", function () { swipe("like"); });
  $("btnNope").addEventListener("click", function () { swipe("pass"); });
  var matchWith = null;
  function showMatch(u) { matchWith = u; $("matchMe").textContent = ini(ME.name); $("matchAv").textContent = ini(u.name); $("matchAv").style.background = g(u.id); $("matchName").textContent = u.name + " liked you back too 💜"; $("matchPop").classList.add("show"); }
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
    toast("Requesting location...");
    getPos(function (lat, lng) { publishPresence(lat, lng).then(function () { $("locToggle").classList.add("on"); loadNearby(); toast("Location ON"); }).catch(function (e) { toast(errMsg(e)); }); },
      function () { toast("Location permission was not granted. Allow it in your browser/phone settings."); });
  }
  function stopShare() { return deleteDoc(doc(db, "presence", UID)).then(function () { $("locToggle").classList.remove("on"); toast("Location sharing turned off"); }).catch(function (e) { toast(errMsg(e)); }); }
  function refreshLocToggle() { getDoc(doc(db, "presence", UID)).then(function (s) { $("locToggle").classList.toggle("on", s.exists()); }).catch(function () {}); }
  var nearUnsub = null, nearTimer = null;
  function stopNearby() { if (nearUnsub) { nearUnsub(); nearUnsub = null; } clearInterval(nearTimer); nearTimer = null; }
  function invite() {
    var url = location.origin + location.pathname, text = "I'm using Pulse 🚀 — Friends, Dating/Marriage, Jobs, AI companion Saathi, Music Studio and Bhajan Rooms, all in one free app. Give it a try, you'll love it:";
    if (navigator.share) navigator.share({ title: "Pulse", text: text, url: url }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(text + " " + url).then(function () { toast("Invite link copied 📋"); }).catch(function () { toast(url); });
    else toast(url);
  }
  $("inviteBtn").addEventListener("click", invite);
  function loadNearby() {
    stopNearby();
    Promise.all([getDoc(doc(db, "presence", UID)), getDoc(doc(db, "premium", UID)).catch(function () { return { exists: function () { return false; } }; })]).then(function (r) {
      var mine = r[0], myPremium = r[1].exists();
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
        var CAP = myPremium ? Infinity : 50;
        nearUnsub = onSnapshot(query(collection(db, "presence"), where("updatedAt", ">", since), limit(200)), function (s) {
          var rows = [], farCount = 0;
          s.forEach(function (d) { if (d.id === UID || blocked.has(d.id)) return; var p = snapData(d); var k = distKm(m.lat, m.lng, p.lat, p.lng); if (k <= CAP) rows.push({ id: d.id, p: p, km: k }); else farCount++; });
          rows.sort(function (a, b) { return a.km - b.km; });
          list.innerHTML = "";
          if (!rows.length) {
            var em = el('<div class="empty">No other opted-in users nearby (50 km) yet. Invite your friends! 👋<br><button class="btn-grad" id="nearInvite" style="margin-top:12px;padding:11px 18px">📨 Send invite</button></div>'); list.appendChild(em); em.querySelector("#nearInvite").addEventListener("click", invite);
            if (farCount) list.appendChild(el('<div class="cr-row" style="margin-top:10px;color:var(--faint)">⭐ ' + farCount + ' people are opted in beyond 50 km too — Premium members have no distance limit and see everyone opted in. Premium is activated by the Pulse team after payment is confirmed.</div>'));
            return;
          }
          list.appendChild(el('<div class="section-title">' + (myPremium ? "Nearby · " + rows.length + " people (live) ⭐ Premium: further too" : "Nearby right now · " + rows.length + " people (live)") + '</div>'));
          if (!myPremium && farCount) list.appendChild(el('<div class="cr-row" style="color:var(--faint);font-size:12px;margin-bottom:4px">+' + farCount + ' people are opted in beyond 50 km too. ⭐ Get Premium to see them too — the Pulse team activates it once payment is confirmed.</div>'));
          rows.slice(0, 50).forEach(function (r) {
            var dist = r.km < 1 ? "less than 1 km" : "~" + Math.round(r.km) + " km";
            var row = el('<div class="nearby-row" data-uid="' + esc(r.id) + '"><div class="av-sm" style="width:50px;height:50px;font-size:18px;background:' + g(r.id) + '">' + ini(r.p.name) + '</div><div class="body"><div class="nm">' + esc(r.p.name) + (r.p.age ? ", " + esc(r.p.age) : "") + '</div><div class="meta">📍 ' + dist + ' · ' + esc(r.p.work || r.p.city || "Pulse member") + '</div></div><button class="wave">💬 Chat</button></div>');
            row.querySelector(".wave").addEventListener("click", function () {
              var mt = matchDocs.filter(function (x) { return x.id === r.id; })[0];
              if (mt) { showTab("chats"); openChat({ id: r.id, mid: mt.mid, name: r.p.name }); } else toast("Match in Discover first, then chat will open 💜");
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
    var m = $("eMode").value, upd = { name: clean($("eName").value, 40) || ME.name, city: clean($("eCity").value, 40), work: clean($("eWork").value, 60), about: clean($("eAbout").value, 300), interests: pickedInterests().join(","), mode: m, looking: ({ friends: "Friendship", dating: "Dating", marriage: "Marriage" })[m] || "Friendship" };
    Object.keys(PROF_FIELDS).forEach(function (id) { var k = PROF_FIELDS[id], v = $(id).value; upd[k] = NUMF[k] ? (v === "" ? null : +v) : clean(v, k === "cabout" ? 300 : 200); });
    if (!isMateMode(m)) { upd.seeking = ME.seeking || ""; }
    if (!upd.gender) { toast("Please select your gender (\"I am\")"); return; }
    if (upd.ageMin && upd.ageMax && upd.ageMin > upd.ageMax) { toast("Partner age range is wrong"); return; }
    updateDoc(doc(db, "users", UID), upd).then(function () { Object.assign(ME, upd); applyMode(); listenApps(); $("pName").innerHTML = esc(ME.name) + creatorBadge(ME); $("pHandle").textContent = ME.city || ""; toast("Profile saved ✅"); }).catch(function (e) { toast(errMsg(e)); });
  });

  // ---- chats ----
  var SAATHI = { id: "saathi", name: "Saathi AI", ai: true };
  var matchDocs = [], firstMatches = true, activeChat = null, msgUnsub = null;
  function userName(uid) {
    if (nameCache[uid]) return Promise.resolve(nameCache[uid]);
    return getDoc(doc(db, "users", uid)).then(function (s) { nameCache[uid] = s.exists() ? s.data().name : "Pulse member"; return nameCache[uid]; }).catch(function () { return "Pulse member"; });
  }
  var photoReq = {};
  function paintPhoto(node, uid) {
    if (!node || !uid || uid === "saathi") return;
    function go(p) { if (p && JPEG.test(p)) { node.style.background = "center/cover url(" + p + ")"; node.textContent = ""; } }
    if (uid === UID) { go(ME && ME.photo); return; }
    if (!photoReq[uid]) photoReq[uid] = getDoc(doc(db, "users", uid)).then(function (s) { return s.exists() ? s.data().photo || "" : ""; }).catch(function () { return ""; });
    photoReq[uid].then(go);
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
  window.addEventListener("online", function () { setLive(); toast("Back online 🟢"); }); window.addEventListener("offline", function () { setLive(); toast("No internet. Messages will send once it's back."); });
  // ---- live status: "typing...", "seen", unread ----
  var lastSeenAt = {}, typingSeen = {}, typingUntil = {}, typingT = null, lastTypingSent = 0, typingOn = false;
  function curMatch() { if (!activeChat || activeChat.ai) return null; for (var i = 0; i < matchDocs.length; i++) if (matchDocs[i].mid === activeChat.mid) return matchDocs[i]; return null; }
  function liveStatus() {
    var c = curMatch(); if (!c) return;
    var left = (typingUntil[c.mid] || 0) - Date.now(), typing = left > 0;
    $("convoStatus").textContent = typing ? "typing..." : "";
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
  function renderJobChats() {
    var l = $("chatList"); l.innerHTML = "";
    var who = MODE === "recruiter" ? "r" : "s";
    var rows = APPS.filter(function (a) { return a.status !== "declined" && a.status !== "withdrawn"; });
    if (!rows.length) { l.appendChild(el('<div class="empty">' + (MODE === "recruiter" ? "No applicants yet. Candidates you invite or who apply will show up here to message." : "No conversations yet. Apply to a job or accept an invite — the recruiter's chat opens here.") + '</div>')); return; }
    rows.forEach(function (a) {
      var title = who === "r" ? a.sname : a.jtitle, sub = who === "r" ? "Applied for " + a.jtitle : a.company;
      var r = el('<div class="chat-row" tabindex="0" data-notr><div class="chat-av"><div class="av-sm" style="width:50px;height:50px;font-size:18px;background:' + g(a.id) + '">' + ini(title || "?") + '</div></div><div class="body"><div class="top"><span class="nm">' + esc(title || "...") + '</span><span class="tm">' + stChip(a.status) + '</span></div><div class="prev">' + esc(sub || "") + '</div></div></div>');
      r.addEventListener("click", function () { openThread(a, who); });
      l.appendChild(r);
    });
  }
  function renderChats() {
    if (isJobMode()) return renderJobChats();
    var l = $("chatList"); l.innerHTML = "";
    function row(c, last, sub, ai) {
      var r = el('<div class="chat-row" tabindex="0"><div class="chat-av"><div class="av-sm" style="width:50px;height:50px;font-size:' + (ai ? 22 : 18) + 'px;background:' + g(c.id) + '">' + (ai ? "✦" : ini(c.name || "?")) + '</div></div><div class="body"><div class="top"><span class="nm">' + esc(c.name || "...") + (ai ? '<span class="ai-pill">AI</span>' : '') + '</span><span class="tm">' + esc(sub) + '</span></div><div class="prev">' + esc(last) + '</div></div></div>');
      r.addEventListener("click", function () { openChat(c); });
      l.appendChild(r); return r;
    }
    row(SAATHI, "Talk about what's on your heart. I'm an AI, here to listen 💜", "", true);
    var shown = matchDocs.filter(function (c) { return !blocked.has(c.id); });
    shown.forEach(function (c) {
      var r = row({ id: c.id, mid: c.mid, name: nameCache[c.id] || "..." }, c.last ? ((c.lastFrom === UID ? "You: " : "") + c.last) : "You matched! Say hi 👋", c.last ? hm(c.at) : "");
      if (c.unread && !(activeChat && activeChat.mid === c.mid)) { r.querySelector(".prev").classList.add("unread"); r.appendChild(el('<span class="unread-dot">•</span>')); }
      paintPhoto(r.querySelector(".av-sm"), c.id);
      if (!nameCache[c.id]) userName(c.id).then(function (n) { r.querySelector(".nm").textContent = n; var av2 = r.querySelector(".av-sm"); if (av2.style.background.indexOf("url(") < 0) av2.textContent = n.charAt(0).toUpperCase(); });
    });
    $("chatDot").hidden = !shown.some(function (c) { return c.unread && !(activeChat && activeChat.mid === c.mid); });
    if (!shown.length) l.appendChild(el('<div class="empty">No chats yet. Swipe in Discover — once you match, the chat opens here.</div>'));
  }

  var REACT_EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "🙏"];
  function reactionCounts(r) { var c = {}; Object.keys(r || {}).forEach(function (uid) { var e = r[uid]; c[e] = (c[e] || 0) + 1; }); return c; }
  function renderReactions(r) {
    var counts = reactionCounts(r), keys = Object.keys(counts); if (!keys.length) return "";
    return '<div class="msg-reactions">' + keys.map(function (e) { return '<span class="rchip' + (r[UID] === e ? " mine" : "") + '">' + e + ' ' + counts[e] + '</span>'; }).join("") + '</div>';
  }
  function addBubble(m) {
    var sys = $("convoBody").querySelector(".sys"); if (sys) sys.remove();
    var big = !m.img && /^(\p{Extended_Pictographic}|\u200d|\ufe0f|\s){1,3}$/u.test(m.text || "");
    var replyHtml = m.replyTo ? '<div class="reply-quote"><b>' + (m.replyTo.from === UID ? "You" : esc(m.replyTo.fromName || "")) + '</b>' + esc(m.replyTo.text || "") + '</div>' : "";
    var b = el('<div class="bubble ' + (m.mine ? "me" : "them") + (big ? " big-emoji" : "") + '">' + replyHtml + (m.img && JPEG.test(m.img) ? '<img class="chat-img" src="' + m.img + '" alt="photo">' : "") + (m.aud && AUDIO_OK.test(m.aud) ? '<audio controls preload="none" src="' + m.aud + '"></audio>' : (m.img ? "" : esc(m.text))) + (m.warn ? '<span class="warn">⚠️ Caution: never share money, OTPs or bank details. If something feels off, use Report.</span>' : '') + '<span class="t">' + hm(m.at) + '</span>' + renderReactions(m.reactions) + '</div>');
    var im = b.querySelector(".chat-img"); if (im) im.addEventListener("click", function (e) { e.stopPropagation(); viewImg(m.img); });
    if (m.id) b.addEventListener("click", function (e) { if (e.target.closest(".chat-img")) return; openMsgActions(b, m); });
    $("convoBody").appendChild(b); $("convoBody").scrollTop = $("convoBody").scrollHeight; return b;
  }
  function fmtDur(sec) { var mm = Math.floor(sec / 60), ss = sec % 60; return mm + ":" + (ss < 10 ? "0" : "") + ss; }
  function paintCallLog(c) {
    var icon = c.mode === "video" ? "🎥" : c.mode === "walkie" ? "📻" : "📞";
    var label = c.mode === "video" ? "Video call" : c.mode === "walkie" ? "Walkie-talkie" : "Voice call";
    var state = "", dur = "", miss = false;
    if (c.ans && c.end) dur = fmtDur(Math.max(0, Math.round((c.end - c.ans) / 1000)));
    else if (c.ans) state = "";
    else if (c.end || Date.now() - c.t0 > 60000) { state = c.out ? "No answer" : "Missed"; miss = !c.out; }
    else state = "Calling...";
    c.row.className = "call-log" + (miss ? " miss" : "");
    c.row.innerHTML = '<span class="cl-ic">' + icon + '</span><span>' + label + '</span>' + (state ? '<span class="cl-st">' + state + '</span>' : "") + (dur ? '<span class="cl-dur">' + dur + '</span>' : "") + '<span class="cl-dir">' + (c.out ? "↗" : "↙") + '</span>';
  }
  // ---- message reactions + reply-to: tap a bubble -> small popover (quick emoji react, or reply) ----
  var msgActionsEl = null, replyDraft = null;
  function closeMsgActions() { if (msgActionsEl) { msgActionsEl.remove(); msgActionsEl = null; } }
  function openMsgActions(bubbleEl, m) {
    var already = msgActionsEl && msgActionsEl.dataset.forId === String(m.id);
    closeMsgActions(); if (already || !activeChat || activeChat.ai) return;
    var bar = el('<div class="react-bar ' + (m.mine ? "me" : "them") + '" data-for-id="' + m.id + '">' +
      REACT_EMOJIS.map(function (e) { return '<button class="re-emo" type="button">' + e + '</button>'; }).join("") +
      '<button class="re-reply" type="button">↩ Reply</button></div>');
    var ems = bar.querySelectorAll(".re-emo");
    REACT_EMOJIS.forEach(function (e, i) { ems[i].addEventListener("click", function (ev) { ev.stopPropagation(); toggleReaction(m.id, e); closeMsgActions(); }); });
    bar.querySelector(".re-reply").addEventListener("click", function (ev) { ev.stopPropagation(); startReply(m); closeMsgActions(); });
    bubbleEl.insertAdjacentElement("afterend", bar); msgActionsEl = bar; $("convoBody").scrollTop = $("convoBody").scrollHeight;
  }
  document.addEventListener("click", function (e) { if (msgActionsEl && !e.target.closest(".react-bar") && !e.target.closest(".bubble")) closeMsgActions(); });
  function toggleReaction(msgId, emoji) {
    var c = activeChat; if (!c || c.ai) return;
    var ref = doc(db, "matches", c.mid, "messages", msgId);
    getDoc(ref).then(function (s) {
      if (!s.exists()) return;
      var r = Object.assign({}, s.data().reactions || {});
      if (r[UID] === emoji) delete r[UID]; else r[UID] = emoji;
      return updateDoc(ref, { reactions: r });
    }).catch(function (e) { toast(errMsg(e)); });
  }
  function startReply(m) {
    replyDraft = { id: m.id, from: m.from, fromName: m.mine ? ME.name : (activeChat && activeChat.name), text: clean(m.text, 120) };
    $("rpName").textContent = m.mine ? "You" : (replyDraft.fromName || ""); $("rpText").textContent = replyDraft.text; $("replyPreview").hidden = false;
    $("msgInput").focus();
  }
  function cancelReply() { replyDraft = null; $("replyPreview").hidden = true; }
  $("rpClose") && $("rpClose").addEventListener("click", cancelReply);
  function closeMsgListener() { if (msgUnsub) { msgUnsub(); msgUnsub = null; } }
  var ICE = ["What's the best thing that happened to you this week?", "Chai or coffee? Defend your answer.", "What song is stuck in your head right now?", "Which city would you move to tomorrow, and why?", "What's a small thing that makes your day better?", "Describe your weekend in three words.", "What are you learning at the moment?", "Which old movie can you watch again and again?"];
  function icebreakers() {
    var pick = ICE.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 3);
    var box = el('<div class="ice"><div class="ice-t">Not sure what to say? Tap one</div></div>');
    pick.forEach(function (q) { var b = el('<button type="button" class="ice-chip"></button>'); b.textContent = q; b.addEventListener("click", function () { var i = $("msgInput"); i.value = q; i.focus(); }); box.appendChild(b); });
    return box;
  }
  function openChat(c) {
    closeMsgListener(); if ($("chatMenu")) $("chatMenu").hidden = true; cancelReply(); closeMsgActions(); if (!c.ai && nameCache[c.id]) c.name = nameCache[c.id]; activeChat = c;
    if (!c.ai && (!c.name || c.name === "...")) userName(c.id).then(function (n) { c.name = n; if (activeChat === c) { $("convoName").textContent = n; $("convoAv").textContent = ini(n); } });
    var av = $("convoAv"); av.textContent = c.ai ? "✦" : ini(c.name); av.style.background = g(c.id); if (!c.ai) paintPhoto(av, c.id);
    $("convoName").innerHTML = esc(c.name) + creatorBadge(c) + (c.ai ? '<span class="ai-pill">AI</span>' : ""); $("convoStatus").textContent = c.ai ? "Always online" : "";
    $("moreBtn").hidden = !!c.ai; $("medBar").hidden = true; $("callBtn").hidden = $("videoCallBtn").hidden = $("wtBtn").hidden = $("duetBtn").hidden = $("tlBtn").hidden = !!c.ai;
    $("vnBtn").hidden = !!c.ai; $("micBtn").hidden = !c.ai || !SR_OK; $("saathiVoiceBtn").hidden = !c.ai; if (c.ai) refreshVoiceBtn();
    var body = $("convoBody"); body.innerHTML = "";
    if (c.ai) {
      body.appendChild(el('<div class="ai-note">✦ Saathi is an AI companion, not a real person. It\'s here to talk and listen — not a substitute for a doctor or counsellor. If you\'re struggling, please talk to someone close to you or a helpline. You can also ask it general questions, or tap 🎙️ to speak.</div>'));
      getDocs(query(collection(db, "users", UID, "saathi"), orderBy("createdAt", "asc"), limit(60))).then(function (s) {
        if (activeChat !== c) return;
        saathiHist = [];
        if (s.empty) addBubble({ mine: false, text: "Hello " + ME.name + " 🙏 I'm Saathi, an AI. How was your day? You can also ask me anything, or use the mic 🎙️ to talk.", at: Date.now() });
        s.forEach(function (d) { var m = snapData(d); addBubble({ mine: m.role === "user", text: m.text, at: ms(m.createdAt) }); saathiHist.push({ role: m.role === "user" ? "user" : "model", text: m.text }); });
      }).catch(function () {});
    } else {
      msgUnsub = onSnapshot(query(collection(db, "matches", c.mid, "messages"), orderBy("createdAt", "asc"), limit(200)), function (s) {
        body.innerHTML = "";
        if (s.empty) { body.appendChild(el('<div class="sys">You matched! Send the first message 👋</div>')); body.appendChild(icebreakers()); }
        var med = { state: "off" }, hist = [], calls = {};
        s.forEach(function (d) {
          var m = snapData(d);
          if (m.call) { // call signalling (offer/answer/end) -> ONE compact call-log row per call, never separate bubbles
            var cid = m.call.id, cc = calls[cid];
            if (m.call.k === "offer") { var crow = el('<div class="call-log"></div>'); body.appendChild(crow); calls[cid] = { row: crow, mode: m.call.mode || "call", out: m.from === UID, t0: ms(m.createdAt), ans: 0, end: 0 }; }
            else if (cc && m.call.k === "answer") cc.ans = ms(m.createdAt);
            else if (cc && m.call.k === "end") cc.end = ms(m.createdAt);
            return;
          }
          if (m.med) {
            var k = m.med.k, sys = body.querySelector(".sys"); if (sys) sys.remove();
            if (k === "ask") med = { state: "pending", asker: m.from }; else if (k === "yes" && med.state === "pending" && m.from !== med.asker) med = { state: "on" }; else if (k === "off" || k === "no") med = { state: "off" };
            body.appendChild(el(k === "say" ? '<div class="med-note"><b>🤝 AI Mediator</b>' + esc(String(m.text).replace(/^🤝 AI Mediator:\s*/, "")) + '</div>' : '<div class="med-note"><b>🤝 Mediator</b>' + esc(m.text) + '</div>'));
            return;
          }
          hist.push({ from: m.from, text: m.text });
          addBubble({ id: d.id, from: m.from, mine: m.from === UID, text: m.text, img: m.img, aud: m.aud, at: ms(m.createdAt), warn: m.from !== UID && SCAM_MONEY.test(m.text), reactions: m.reactions, replyTo: m.replyTo });
        });
        Object.keys(calls).forEach(function (k) { paintCallLog(calls[k]); });
        c.med = med; c.hist = hist; renderMed(); body.scrollTop = body.scrollHeight;
        liveStatus();
      }, function (e) { toast(errMsg(e)); });
    }
    $("convo").classList.add("open");
  }
  $("convoBack").addEventListener("click", function () { setTyping(false); cancelReply(); closeMsgActions(); $("convo").classList.remove("open"); closeMsgListener(); activeChat = null; renderChats(); });

  var saathiHist = [], fbIdx = 0, saathiBusy = false, saathiVoiceOn = false, recog = null, SR_OK = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  var SAATHI_SYS = "You are 'Saathi', the Pulse app's AI companion. You are an AI, not a person: never claim to be human, to be a real girlfriend/boyfriend, or to 'feel' emotions; if asked, say plainly that you are an AI. You have two jobs, and you tell which one fits each message: (1) when the user is sharing feelings, venting or chatting, listen and understand first, then ask a gentle question or offer a small suggestion, in short warm natural language, 2-4 sentences, occasionally one emoji; (2) when the user asks a factual, general-knowledge, how-to, or 'Google-type' question, answer it directly, accurately and clearly like a genuinely knowledgeable assistant — don't deflect a plain question back with only emotional listening. If you are not confident of a fact, say so plainly instead of guessing. Use different words each time, don't repeat your previous reply. You are not a doctor/therapist/lawyer; don't give medication, diagnosis or legal advice, and say so if asked. No abuse, violence, hate or adult/sexual content. Never ask for or share phone numbers, addresses or other people's private information. If the user talks about harming themselves, gently tell them to talk to someone close to them or a helpline right away.";
  function paintVoiceBtn() { var b = $("saathiVoiceBtn"); if (!b) return; var ico = b.querySelector(".cmi-ico"), lbl = b.querySelector("span:last-child"); if (ico) ico.textContent = saathiVoiceOn ? "🔊" : "🔈"; if (lbl) lbl.textContent = saathiVoiceOn ? "Saathi ki awaaz: ON" : "Saathi ki awaaz: OFF"; b.classList.toggle("voice-on", saathiVoiceOn); }
  function refreshVoiceBtn() { saathiVoiceOn = !!(ME && ME.saathiVoice); paintVoiceBtn(); }
  $("saathiVoiceBtn") && $("saathiVoiceBtn").addEventListener("click", function () {
    saathiVoiceOn = !saathiVoiceOn; if (ME) ME.saathiVoice = saathiVoiceOn;
    paintVoiceBtn();
    if (!saathiVoiceOn && window.speechSynthesis) speechSynthesis.cancel();
    updateDoc(doc(db, "users", UID), { saathiVoice: saathiVoiceOn }).catch(function () {});
  });
  // ---- chat header: dropdown menu (walkie/duet/timeline/voice/safety) so the header row stays clean ----
  $("chatMoreBtn").addEventListener("click", function (e) { e.stopPropagation(); $("chatMenu").hidden = !$("chatMenu").hidden; });
  $("chatMenu").addEventListener("click", function (e) { if (e.target.closest(".chat-menu-item")) $("chatMenu").hidden = true; });
  document.addEventListener("click", function (e) { if (!$("chatMenu").hidden && !e.target.closest(".chat-menu") && !e.target.closest("#chatMoreBtn")) $("chatMenu").hidden = true; });
  function speak(text) {
    if (!saathiVoiceOn || !window.speechSynthesis) return;
    try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, "")); u.rate = 1; speechSynthesis.speak(u); } catch (e) {}
  }
  if (SR_OK) {
    var SRClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    recog = new SRClass(); recog.continuous = false; recog.interimResults = false;
    recog.onresult = function (e) { var t = e.results[0][0].transcript; if (t) { $("msgInput").value = t; sendMsg(); } };
    recog.onerror = function () { $("micBtn").classList.remove("listening"); };
    recog.onend = function () { $("micBtn").classList.remove("listening"); };
  }
  $("micBtn") && $("micBtn").addEventListener("click", function () {
    if (!recog) return;
    if ($("micBtn").classList.contains("listening")) { recog.stop(); return; }
    try { recog.lang = (navigator.language || "en-IN"); recog.start(); $("micBtn").classList.add("listening"); } catch (e) {}
  });
  var saathiMemTurns = 0;
  function updateSaathiMemory() {
    if (saathiHist.length < 10) return;
    aiJson("Summarize durable facts worth remembering long-term about this user from the conversation below, for a companion AI to recall in future sessions (their name, situation, ongoing concerns, preferences). 2-4 short bullet lines max, no feelings-of-the-moment, just durable facts. Reply as JSON: {\"memory\": \"...\"}",
      saathiHist.slice(-20).map(function (m) { return (m.role === "user" ? "User: " : "Saathi: ") + m.text; }).join("\n")
    ).then(function (r) { if (r && r.memory) updateDoc(doc(db, "users", UID), { saathiMemory: String(r.memory).slice(0, 600) }).catch(function () {}); }).catch(function () {});
  }
  var CRISIS = /(suicide|sucide|khudkushi|khud\s*kushi|mar\s*jana|marna\s*chahta|marna\s*chahti|jaan\s*de|jeena\s*nahi|jeene\s*ka\s*mann\s*nahi|zindagi\s*khatam|khud\s*ko\s*(khatam|nuksan|hurt|maar)|end\s*my\s*life|kill\s*myself|self[\s-]*harm)/i;
  var CRISIS_REPLY = "I'm concerned about you, and it matters that you were able to share this. 💜 I'm an AI, and right now you need the support of a real person. Please call someone close to you or go to them right now, and reach out to a helpline in your city. Are you in a safe place right now?";
  var OFFLINE = [
    function (t) { return "You said: \"" + t.slice(0, 40) + (t.length > 40 ? "..." : "") + "\". That caught my attention. What feels heaviest about this? 💜"; },
    function () { return "I hear you. Let's try something small: take 3 deep breaths right now, then tell me what you'd want to fix first. 🌱"; },
    function () { return "That's okay, there's no rush. Can you tell me about one moment when things felt a little lighter? ✨"; },
    function () { return "That's a lot to carry. Which part of it is within your control, and which isn't? 🤝"; },
    function () { return "I'm listening. Could you open up a bit more? Since when has this been feeling this way? 🙂"; }
  ];
  function offlineReply(t) { var r = OFFLINE[fbIdx++ % OFFLINE.length](t); return r; }
  function saathiTalk(c, t) {
    var col = collection(db, "users", UID, "saathi");
    addBubble({ mine: true, text: t, at: Date.now() });
    addDoc(col, { role: "user", text: t, createdAt: serverTimestamp() }).catch(function () {});
    saathiHist.push({ role: "user", text: t }); bump("cAi");
    function finish(txt) { saathiHist.push({ role: "model", text: txt }); saathiHist = saathiHist.slice(-14); addDoc(col, { role: "assistant", text: txt, createdAt: serverTimestamp() }).catch(function () {}); saathiBusy = false; speak(txt); if (++saathiMemTurns % 6 === 0) updateSaathiMemory(); }
    if (CRISIS.test(t)) { setTimeout(function () { if (activeChat === c) addBubble({ mine: false, text: CRISIS_REPLY, at: Date.now() }); finish(CRISIS_REPLY); }, 500); return; }
    if (saathiBusy) return; saathiBusy = true;
    var typing = el('<div class="typing"><i></i><i></i><i></i></div>'); $("convoBody").appendChild(typing); $("convoBody").scrollTop = 1e9;
    var bub = null;
    var sys = SAATHI_SYS + " User's name: " + ME.name + "." + (ME.saathiMemory ? " What you remember about this user from before: " + ME.saathiMemory : "") + journeyFacts();
    aiChat(sys, saathiHist.slice(-12), function (part) {
      if (activeChat !== c) return; typing.remove();
      if (!bub) bub = addBubble({ mine: false, text: part, at: Date.now() });
      else { bub.firstChild.nodeValue = part; $("convoBody").scrollTop = 1e9; }
    }).then(function (full) { typing.remove(); $("convoStatus").textContent = "AI online ✦"; if (activeChat === c && !bub) addBubble({ mine: false, text: full, at: Date.now() }); finish(full); })
      .catch(function () {
        typing.remove(); var r = offlineReply(t); $("convoStatus").textContent = "AI offline: simple reply";
        if (activeChat === c) { if (bub) bub.remove(); addBubble({ mine: false, text: r, at: Date.now() }); } finish(r);
      });
  }
  function sendMsg() {
    var inp = $("msgInput"), t = clean(inp.value, 1000); if (!t || !activeChat) return; var c = activeChat; inp.value = "";
    if (!rate("msg", 10, 10000)) { inp.value = t; return; }
    if (c.ai) { saathiTalk(c, t); return; }
    autoFlag(t, "chat");
    if (SCAM_MONEY.test(t) || PII.test(t)) { if (!window.confirm("⚠️ Safety: paisa, OTP, bank details, phone number ya link bhejna risky ho sakta hai. Pehle bharosa banao. Phir bhi bhejna hai?")) { inp.value = t; return; } }
    var b = writeBatch(db), mref = doc(collection(db, "matches", c.mid, "messages"));
    var msgData = { from: UID, text: t, createdAt: serverTimestamp() };
    if (replyDraft) { msgData.replyTo = { id: replyDraft.id, from: replyDraft.from, fromName: replyDraft.fromName || "", text: replyDraft.text }; }
    cancelReply();
    b.set(mref, msgData);
    var upd = { lastText: t, lastAt: serverTimestamp(), lastFrom: UID }; upd["typing_" + UID] = null; typingOn = false; lastTypingSent = 0;
    b.update(doc(db, "matches", c.mid), upd);
    b.commit().then(function () { bump("cMsgs"); }).catch(function (e) { toast(e && e.code === "permission-denied" ? "This user is not available" : errMsg(e)); });
  }
  $("sendBtn").addEventListener("click", sendMsg);
  $("msgInput").addEventListener("keydown", function (e) { if (e.key === "Enter") sendMsg(); });
  var idleT = null;
  $("msgInput").addEventListener("input", function () { if (!this.value.trim()) { setTyping(false); return; } setTyping(true); clearTimeout(idleT); idleT = setTimeout(function () { setTyping(false); }, 5000); });

  $("moreBtn").addEventListener("click", function () {
    if (!activeChat || activeChat.ai) return;
    var body = $("convoBody"); if (body.querySelector(".safety")) return;
    var u = activeChat;
    var inCircle = (ME.circleMembers || []).indexOf(u.id) >= 0;
    var box = el('<div class="ai-note safety">' + esc(u.name) + ' ke saath: <button class="btn-outline" id="doBlock" style="margin:8px 4px 0;padding:8px 14px">Block karo</button><button class="btn-outline" id="doReport" style="margin:8px 4px 0;padding:8px 14px">Report karo</button><button class="btn-outline" id="doMeet" style="margin:8px 4px 0;padding:8px 14px">📍 Safe meet</button><button class="btn-outline" id="doFeedback" style="margin:8px 4px 0;padding:8px 14px">📝 Date feedback</button><button class="btn-outline" id="doCircle" style="margin:8px 4px 0;padding:8px 14px">' + (inCircle ? "✅ Safety Circle me hai" : "🛡 Safety Circle me jodo") + '</button><div style="font-size:12px;margin-top:8px;color:var(--muted)">Pehli mulaqat: din me, public jagah, kisi apne ko batakar.</div></div>');
    body.appendChild(box); body.scrollTop = 1e9;
    $("doBlock").addEventListener("click", function () {
      setDoc(doc(db, "blocks", UID + "_" + u.id), { blocker: UID, blocked: u.id, createdAt: serverTimestamp() }).then(function () { blocked.add(u.id); toast("Blocked"); $("convo").classList.remove("open"); closeMsgListener(); activeChat = null; renderChats(); }).catch(function (e) { toast(errMsg(e)); });
    });
    $("doMeet").addEventListener("click", function () { safeMeet(u); });
    $("doReport").addEventListener("click", function () {
      addDoc(collection(db, "reports"), { from: UID, to: u.id, reason: "Chat se report", createdAt: serverTimestamp() }).then(function () { toast("Report bhej di. Shukriya."); box.remove(); }).catch(function (e) { toast(errMsg(e)); });
    });
    $("doFeedback").addEventListener("click", function () { openFeedback(u); });
    $("doCircle").addEventListener("click", function () {
      if (inCircle) return;
      updateDoc(doc(db, "users", UID), { circleMembers: arrayUnion(u.id) }).then(function () { ME.circleMembers = (ME.circleMembers || []).concat([u.id]); toast("Safety Circle me jod diya 🛡"); this.textContent = "✅ Safety Circle me hai"; }.bind(this)).catch(function (e) { toast(errMsg(e)); });
    });
  });

  // ---- Gaana Studio ----
  var player = new Player(), curSong = null, curMeta = null, LIBKEY = "pulse_songs_v1";
  Object.keys(GENRES).forEach(function (k) { $("stGenre").appendChild(new Option(GENRES[k].name, k)); });
  function songSys(lang, singer) {
    var L = lang === "en" ? "natural, singable English" : lang === "hinglish" ? "Hinglish (Hindi in Roman letters)" : "simple, poetic Hindi written in Devanagari script (no Roman letters)";
    return "You are an award-winning songwriter who writes radio-hit lyrics. Write ONE completely ORIGINAL song: never copy or imitate any existing song, lyric, or artist, and never name real people. Language: " + L + ". The song is sung by a " + (singer === "m" ? "male" : "female") + " singer, so write in that first-person voice. " +
      "Craft: a memorable title that appears in the hook; a strong emotional arc; concrete imagery (senses, places, small details) instead of cliches; consistent rhyme (AABB or ABAB) and a steady rhythm of 5 to 8 syllables per line so it can be sung; the chorus must be catchy, repeatable, and emotionally clearest. " +
      "Structure exactly 16 lines: Verse 1 (4 lines), Chorus (4), Verse 2 (4), Chorus (repeat the same 4 lines), no other sections. " +
      "Output only JSON: {\"title\":string,\"minor\":boolean (true for sad or tender songs),\"bpm\":number between 70 and 120,\"lines\":[{\"section\":\"Verse 1\"|\"Chorus\"|\"Verse 2\",\"text\":string}]}. No profanity, violence, hate, or adult content.";
  }
  function fallbackSong(idea, genre, mood) {
    var w = idea.split(/\s+/).filter(function (x) { return x.length > 3; }), k = (w[0] || "zindagi").replace(/[^\p{L}\p{N}]/gu, "") || "zindagi", k2 = w[1] || "khushi";
    var L = [["Verse 1", "Aaj phir " + k + " ki yaad aayi"], ["Verse 1", "Dil ne chupke se awaaz lagayi"], ["Verse 1", "Raaton ke saath chalti hai " + k2], ["Verse 1", "Subah ne naye rang bikhraye"],
      ["Chorus", "Chal chal re dil, chal chal re"], ["Chorus", "Har pal naya safar hai"], ["Chorus", "Chal chal re dil, chal chal re"], ["Chorus", "Tu hai to sab sundar hai"],
      ["Verse 2", "Raaste mushkil sahi, par haunsla hai"], ["Verse 2", "Ek muskaan se roshan jahan hai"], ["Chorus", "Chal chal re dil, chal chal re"], ["Chorus", "Har pal naya safar hai"]];
    return { title: k.charAt(0).toUpperCase() + k.slice(1) + " ki dhun", minor: mood === "udaas" || mood === "shaanti", bpm: 0, lines: L.map(function (x) { return { section: x[0], text: x[1] }; }) };
  }
  function normSong(j) {
    var lines = (j && Array.isArray(j.lines) ? j.lines : []).map(function (x) { return { section: clean(x && x.section, 20), text: clean(x && x.text, 90) }; }).filter(function (x) { return x.text; }).slice(0, 16);
    if (lines.length < 4) return null;
    return { title: clean(j.title, 60) || "Meri dhun", minor: !!j.minor, bpm: +j.bpm || 0, lines: lines };
  }
  function showSong(meta) {
    player.stop(); $("stPlay").textContent = "▶ Play"; $("stBar").style.width = "0"; stRecReset();
    curMeta = meta; curSong = buildSong({ genre: meta.genre, bpm: meta.bpm, minor: meta.minor, title: meta.title, lines: meta.lines });
    $("stTitle").textContent = meta.title; $("stMeta").textContent = GENRES[meta.genre].name + " · " + curSong.bpm + " BPM · " + Math.round(curSong.duration) + " sec · AI lyrics + tune made in your browser";
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
    if (!idea) { toast("Type a song idea first"); return; }
    btn.disabled = true; $("stNote").textContent = "AI is writing the lyrics...";
    aiJson(songSys($("stLang").value, $("stSinger").value), "Idea: " + idea + "\nGenre: " + GENRES[genre].name + (mood ? "\nMood: " + mood : "")).then(normSong).then(function (sp) { if (!sp) throw new Error("bad"); $("stNote").textContent = "AI wrote the lyrics ✦"; return sp; })
      .catch(function () { $("stNote").textContent = "AI is off right now, so this was made from a simple template. (Turn on AI Logic in Firebase for real AI-written lyrics.)"; return fallbackSong(idea, genre, mood); })
      .then(function (sp) { var meta = { title: sp.title, genre: genre, bpm: sp.bpm, minor: sp.minor, lines: sp.lines }; showSong(meta); saveLib(meta); })
      .catch(function (e) { toast(errMsg(e)); }).then(function () { btn.disabled = false; });
  });
  function studioSing(i) { if ($("stVoice").checked && curSong) singLine(curSong, i, { kind: $("stSinger").value, voiceName: $("stVoicePick").value, lang: langOf($("stLang").value === "en" ? "en" : "hi") }); }
  function fillVoicePick() { var sel = $("stVoicePick"), cur = sel.value; sel.innerHTML = '<option value="">Auto voice</option>'; voiceList($("stLang").value === "en" ? "en" : "hi").forEach(function (v) { sel.appendChild(new Option(v.name + " (" + v.lang + ")", v.name)); }); sel.value = cur; }
  $("stLang").addEventListener("change", fillVoicePick); setTimeout(fillVoicePick, 600); setTimeout(fillVoicePick, 2500);
  $("stTest").addEventListener("click", function () { var s = buildSong({ genre: "pop", bpm: 90, minor: false, title: "t", lines: [{ section: "Verse 1", text: $("stLang").value === "en" ? "Hello, this is my singing voice" : "नमस्ते, ये मेरी गाने की आवाज़ है" }] }); if (!singerSupported()) { toast("This phone has no voice engine. Install Google Text-to-speech from the Play Store."); return; } singLine(s, 0, { kind: $("stSinger").value, voiceName: $("stVoicePick").value, lang: langOf($("stLang").value === "en" ? "en" : "hi") }); });
  $("stPlay").addEventListener("click", function () {
    if (!curSong) return;
    if (player.playing) { player.stop(); try { speechSynthesis.cancel(); } catch (e) {} this.textContent = "▶ Play"; return; }
    var btn = this; btn.textContent = "⏹ Stop";
    bump("cSongs");
    player.play(curSong, {
      onLine: function (i) { document.querySelectorAll("#stLyrics .ln").forEach(function (n) { n.classList.toggle("on", +n.getAttribute("data-i") === i); }); if (i >= 0) studioSing(i); },
      onTick: function (s, t) { $("stBar").style.width = Math.min(100, s / t * 100) + "%"; },
      onEnd: function () { btn.textContent = "▶ Play"; $("stBar").style.width = "0"; }
    }).catch(function (e) { btn.textContent = "▶ Play"; toast(errMsg(e)); });
  });
  $("stWav").addEventListener("click", function () {
    if (!curSong) return; var btn = this; btn.disabled = true; btn.textContent = "Creating...";
    renderWav(curSong).then(function (r) { var a = document.createElement("a"); a.href = URL.createObjectURL(r.blob); a.download = (curMeta.title || "pulse-gaana").replace(/[^\w\-]+/g, "_") + ".wav"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000); toast("WAV downloaded ⬇"); })
      .catch(function (e) { toast(errMsg(e)); }).then(function () { btn.disabled = false; btn.textContent = "⬇ WAV"; });
  });
  $("stPost").addEventListener("click", function () {
    if (!curMeta) return; var btn = this; btn.disabled = true;
    var txt = clean("🎵 " + curMeta.title + " (" + GENRES[curMeta.genre].name + ", Pulse Gaana Studio AI)\n" + curMeta.lines.slice(0, 4).map(function (l) { return l.text; }).join(" / "), 500);
    addDoc(collection(db, "posts"), { uid: UID, name: ME.name, text: txt, likedBy: [], createdAt: serverTimestamp() }).then(function () { toast("Posted to feed 🎉"); bump("cPosts"); }).catch(function (e) { toast(errMsg(e)); }).then(function () { btn.disabled = false; });
  });

  // ---- Duet Song: two matched users each write a line, AI blends both into one shared track ----
  var duetUnsub = null, duetPlayer = new Player(), duetSong = null, duetGenerating = false;
  var DUET_SYS = "Tum ek geetkaar ho. Do logon ne ek duet gaane ke liye apni-apni ek-ek line/idea di hai. In dono ideas ko jodo aur ek pyara, sanjha ORIGINAL Hinglish (Roman Hindi) duet gaana likho — dono ke bhav ko barabar jagah do. Kisi maujooda gaane ki nakal nahi. Sirf JSON do: {\"title\":string,\"minor\":boolean,\"bpm\":number(70-130),\"lines\":[{\"section\":\"Verse 1\"|\"Chorus\"|\"Verse 2\"|\"Bridge\",\"text\":string}]}. Theek 8 se 12 lines. Gaali, hinsa, nafrat, vayask baatein aur asli logon ke naam nahi.";
  function duetRef(mid) { return doc(db, "matches", mid, "duet", "main"); }
  function closeDuet() { $("duetUI").hidden = true; if (duetUnsub) { duetUnsub(); duetUnsub = null; } duetPlayer.stop(); }
  $("duetClose").addEventListener("click", closeDuet);
  $("duetBtn").addEventListener("click", function () {
    var c = activeChat; if (!c || c.ai) return;
    var mid = c.mid, other = c.id;
    $("duetUI").hidden = false;
    if (duetUnsub) duetUnsub();
    duetUnsub = onSnapshot(duetRef(mid), function (s) { renderDuet(s.exists() ? s.data() : null, mid, other); }, function (e) { toast(errMsg(e)); });
  });
  function renderDuet(d, mid, other) {
    var box = $("duetText"); if (!box) return;
    var myKey = "idea_" + UID, otherKey = "idea_" + other;
    if (d && d.song) {
      box.innerHTML = '<h3>🎤 ' + esc(d.song.title) + '</h3><p class="st-note">Ek duet — dono ki lines, AI ne jod ke gaana bana diya 🎶</p><div id="duetLyrics"></div><button class="btn-grad" id="duetPlay" style="width:100%;margin-top:10px">▶ Play</button>';
      duetSong = buildSong({ genre: "pop", bpm: d.song.bpm, minor: d.song.minor, title: d.song.title, lines: d.song.lines });
      var lb = $("duetLyrics"), last = "";
      d.song.lines.forEach(function (l, i) { if (l.section !== last) { lb.appendChild(el('<div class="sec">' + esc(l.section) + '</div>')); last = l.section; } lb.appendChild(el('<div class="ln" data-i="' + i + '">' + esc(l.text) + '</div>')); });
      $("duetPlay").addEventListener("click", function () {
        var btn = this;
        if (duetPlayer.playing) { duetPlayer.stop(); btn.textContent = "▶ Play"; return; }
        btn.textContent = "⏹ Stop";
        duetPlayer.play(duetSong, { onLine: function (i) { lb.querySelectorAll(".ln").forEach(function (n) { n.classList.toggle("on", +n.getAttribute("data-i") === i); }); }, onTick: function () {}, onEnd: function () { btn.textContent = "▶ Play"; } }).catch(function (e) { toast(errMsg(e)); });
      });
      return;
    }
    if (d && d.status === "generating") { box.innerHTML = '<h3>🎤 Duet Song</h3><p class="st-note">Dono ki lines aa gayi — AI inhe jod kar gaana bana raha hai... 🎶</p>'; return; }
    if (d && d[myKey]) {
      box.innerHTML = '<h3>🎤 Duet Song</h3><p class="st-note">Tumhari line bhej di gayi hai ✅ Doosre ke likhne ka intezaar hai...</p><p style="font-style:italic">"' + esc(d[myKey]) + '"</p>';
      if (d[otherKey] && !duetGenerating) {
        duetGenerating = true;
        updateDoc(duetRef(mid), { status: "generating" }).then(function () {
          return aiJson(DUET_SYS, "Line 1: " + d[myKey] + "\nLine 2: " + d[otherKey]);
        }).then(normSong).then(function (sp) { if (!sp) throw new Error("bad"); return updateDoc(duetRef(mid), { song: sp, status: "ready" }); })
          .catch(function () { return updateDoc(duetRef(mid), { song: fallbackSong(d[myKey] + " " + d[otherKey], "pop", ""), status: "ready" }).catch(function () {}); })
          .then(function () { duetGenerating = false; bump("cDuets"); }).catch(function () { duetGenerating = false; });
      }
      return;
    }
    box.innerHTML = '<h3>🎤 Duet Song</h3><p class="st-note">Apni ek line/idea likho — jab dono likh denge, AI dono ko jod kar ek sanjha gaana bana dega 🎶</p><div class="edit-form" style="padding:0"><label>Tumhari line/idea<textarea id="duetMine" maxlength="150" rows="2" placeholder="e.g. Pehli baar jab tumse baat hui thi..."></textarea></label><button class="btn-grad" id="duetSend" style="width:100%;margin-top:6px">Bhej do</button></div>';
    $("duetMine") && $("duetMine").focus();
    $("duetSend").addEventListener("click", function () {
      var t = clean($("duetMine").value, 150); if (!t) { toast("Pehle kuch likho"); return; }
      var uids = [UID, other].sort(), ref = duetRef(mid);
      updateDoc(ref, obj(myKey, t)).catch(function () { return setDoc(ref, Object.assign({ uids: uids, status: "collecting" }, obj(myKey, t))); }).then(function () { toast("Bhej diya 🎤"); }).catch(function (e) { toast(errMsg(e)); });
    });
  }

  // ---- Anonymous Feedback Loop: both sides privately rate the date, each gets only an AI-polished,
  // non-attributable summary of what the other said -- and only once BOTH have submitted. ----
  var fbUnsub = null;
  var FB_SYS = "Tum ek rishta/date-feedback coach ho. Niche kisi ne apne recent date/mulaqaat ke baare me doosre insaan ke liye PRIVATE, raw feedback likha hai. Ise ek chhota (2-4 lines), vinamr aur nirmaanaatmak (constructive) paigaam me phir se likho, jo doosre insaan ko bheja jaayega. Lehja/shabd badal do taaki asli likhne wale ki pehchaan na ho — sirf madadgaar insight rakho. Agar feedback accha/positive hai to use garmjoshi se rakho. Agar kuch negative hai, to use politely aur bina ilzaam lagaye 'is baar kya behtar ho sakta tha' ki tarah likho. Gaali, dhamki, personal attack ya kisi teesre insaan/jagah ka naam kabhi mat likho — agar raw feedback me ho to use chhod do. Sirf JSON do: {\"summary\": string}.";
  function fbRef(mid) { return doc(db, "matches", mid, "feedback", "main"); }
  $("fbClose").addEventListener("click", function () { $("fbUI").hidden = true; if (fbUnsub) { fbUnsub(); fbUnsub = null; } });
  function openFeedback(u) {
    var mid = u.mid, other = u.id;
    $("fbUI").hidden = false;
    if (fbUnsub) fbUnsub();
    fbUnsub = onSnapshot(fbRef(mid), function (s) { renderFeedback(s.exists() ? s.data() : null, mid, other); }, function (e) { toast(errMsg(e)); });
  }
  function renderFeedback(d, mid, other) {
    var box = $("fbText"); if (!box) return;
    var doneKey = "done_" + UID, otherDoneKey = "done_" + other, sumKey = "sum_for_" + UID;
    var mine = d && d[doneKey];
    if (mine && d[otherDoneKey]) {
      box.innerHTML = '<h3>📝 Date Feedback</h3><p class="st-note">Dono ne feedback de diya — ye tumhare liye, anonymous aur nirmaanaatmak roop me:</p><div class="ai-note">' + esc(d[sumKey] || "Feedback acha raha, koi khaas baat nahi.") + '</div>';
      return;
    }
    if (mine) { box.innerHTML = '<h3>📝 Date Feedback</h3><p class="st-note">Tumhara feedback mil gaya ✅ Jab doosra insaan bhi apna de dega, dono ko ek-doosre ka anonymous, nirmaanaatmak summary milega.</p>'; return; }
    box.innerHTML = '<h3>📝 Date Feedback</h3><p class="st-note">Is mulaqaat/date ke baare me doosre insaan ke liye private feedback likho. Isse AI ek vinamr, anonymous paigaam me badal dega — asli shabd kabhi nahi dikhaye jaate. Dono ke dene ke baad hi jawab dikhega.</p><div class="edit-form" style="padding:0"><label>Tumhara private feedback<textarea id="fbMine" maxlength="400" rows="4" placeholder="e.g. Baat karne me maza aaya, lekin time pe nahi aaye..."></textarea></label><button class="btn-grad" id="fbSend" style="width:100%;margin-top:6px">Bhej do (private)</button></div>';
    $("fbSend").addEventListener("click", function () {
      var t = clean($("fbMine").value, 400); if (!t) { toast("Pehle kuch likho"); return; }
      var btn = this; btn.disabled = true; btn.textContent = "Bhej rahe hain...";
      aiJson(FB_SYS, t).then(function (r) { return (r && r.summary) ? String(r.summary).slice(0, 400) : "Feedback mila, lekin saaf tarah nahi likha gaya tha."; })
        .catch(function () { return "Feedback mila. (AI abhi polish nahi kar paaya, lekin feedback record ho gaya hai.)"; })
        .then(function (polished) {
          var ref = fbRef(mid), upd = obj(doneKey, true); upd["sum_for_" + other] = polished;
          return updateDoc(ref, upd).catch(function () { return setDoc(ref, Object.assign({ uids: [UID, other].sort() }, upd)); });
        }).then(function () { toast("Shukriya 🙏 Private rehta hai jab tak dono na de dein."); bump("cFeedback"); })
        .catch(function (e) { toast(errMsg(e)); btn.disabled = false; btn.textContent = "Bhej do (private)"; });
    });
  }

  // ---- Shared Memory Timeline: auto-curated from data that already exists -- no extra writes. ----
  $("tlClose").addEventListener("click", function () { $("tlUI").hidden = true; });
  $("tlBtn").addEventListener("click", function () {
    var c = activeChat; if (!c || c.ai) return;
    $("tlUI").hidden = false; $("tlText").innerHTML = '<h3>🕰️ Hamari Yaadein</h3><p class="st-note">Load ho rahi hai...</p>';
    var mid = c.mid, other = c.id;
    Promise.all([
      getDoc(doc(db, "matches", mid)).catch(function () { return null; }),
      getDocs(query(collection(db, "matches", mid, "messages"), orderBy("createdAt", "asc"), limit(300))).catch(function () { return { forEach: function () {} }; }),
      getDoc(duetRef(mid)).catch(function () { return null; }),
      getDoc(fbRef(mid)).catch(function () { return null; })
    ]).then(function (r) {
      var mdoc = r[0], msgs = r[1], duetDoc = r[2], fbDoc = r[3];
      var items = [];
      if (mdoc && mdoc.exists && mdoc.exists()) { var md = mdoc.data(); if (md.createdAt) items.push({ at: ms(md.createdAt), icon: "💞", title: "Match hua", sub: hm(ms(md.createdAt)) }); }
      var firstMsg = null, firstCall = null, total = 0;
      msgs.forEach(function (d) {
        var m = snapData(d); if (m.med) return; total++;
        if (!firstMsg && m.text && !m.call) firstMsg = m;
        if (!firstCall && m.call && m.call.k === "offer") firstCall = m;
      });
      if (firstMsg) items.push({ at: ms(firstMsg.createdAt), icon: "💬", title: "Pehla message", sub: '"' + String(firstMsg.text).slice(0, 60) + '"' });
      if (firstCall) items.push({ at: ms(firstCall.createdAt), icon: "📞", title: "Pehli call", sub: hm(ms(firstCall.createdAt)) });
      if (duetDoc && duetDoc.exists && duetDoc.exists() && duetDoc.data().song) { var dd = duetDoc.data(); items.push({ at: Date.now(), icon: "🎤", title: "Duet Song bana: " + dd.song.title, sub: "Dono ne milkar likha" }); }
      if (fbDoc && fbDoc.exists && fbDoc.exists()) { var fd = fbDoc.data(); if (fd["done_" + UID] && fd["done_" + other]) items.push({ at: Date.now() + 1, icon: "📝", title: "Date feedback exchange hua", sub: "Dono taraf se" }); }
      if (total > 1) items.push({ at: Date.now() + 2, icon: "✨", title: total + " messages ab tak", sub: "Aur badhte rahenge" });
      items.sort(function (a, b) { return a.at - b.at; });
      var box = $("tlText"); box.innerHTML = '<h3>🕰️ Hamari Yaadein</h3>';
      if (!items.length) { box.appendChild(el('<p class="st-note">Abhi koi yaad nahi — baat karna, call karna ya duet banana shuru karo 💜</p>')); return; }
      items.forEach(function (it) { box.appendChild(el('<div class="tl-item"><b>' + it.icon + ' ' + esc(it.title) + '</b><span>' + esc(it.sub) + '</span></div>')); });
    }).catch(function (e) { $("tlText").innerHTML = '<h3>🕰️ Hamari Yaadein</h3><p class="st-note">Abhi load nahi ho payi: ' + esc(errMsg(e)) + '</p>'; });
  });

  // ---- Support Circles: anonymous, topic-based small group chats. No real name shown -- a stable
  // per-room alias instead -- and messages get a light safety check before they post. ----
  var ALIAS_ADJ = ["Shaant", "Ujala", "Nirbhay", "Komal", "Dheer", "Roshan", "Saral", "Amol"], ALIAS_N = ["Panchi", "Sitara", "Lahar", "Kiran", "Saathi", "Rahi", "Deep"];
  function aliasFor(roomId, uid) { var h = Math.abs(hash(roomId + ":" + uid)); return ALIAS_ADJ[h % ALIAS_ADJ.length] + " " + ALIAS_N[Math.floor(h / 7) % ALIAS_N.length] + " #" + (h % 97); }
  var SUPPORT_TOPICS = [
    { id: "breakup", name: "💔 Breakup / Rishta khatam hona" },
    { id: "jobloss", name: "💼 Job loss / Career stress" },
    { id: "loneliness", name: "🌙 Loneliness" },
    { id: "family", name: "🏠 Family pressure" },
    { id: "general", name: "🤝 General support" }
  ];
  var curSupport = null, supportUnsubs = [];
  function closeSupportRooms() { supportUnsubs.forEach(function (u) { u(); }); supportUnsubs = []; }
  $("supportOpenBtn").addEventListener("click", function () {
    $("supportPickUI").hidden = false;
    var box = $("supportTopics"); box.innerHTML = "";
    SUPPORT_TOPICS.forEach(function (t) {
      var r = el('<div class="circle-row" style="cursor:pointer"><span>' + esc(t.name) + '</span><span class="st unknown">Join →</span></div>');
      r.addEventListener("click", function () { $("supportPickUI").hidden = true; openSupportRoom(t); });
      box.appendChild(r);
    });
  });
  $("supportPickClose").addEventListener("click", function () { $("supportPickUI").hidden = true; });
  function supportRef(id) { return doc(db, "supportRooms", id); }
  function openSupportRoom(t) {
    curSupport = t.id; $("supportName").textContent = t.name; $("supportStatus").textContent = "Anonymous group · be kind 💜";
    $("support").classList.add("open"); $("supportBody").innerHTML = '<div class="ai-note">💜 Yahan sab anonymous hain — tumhari pehchaan kisi ko nahi dikhegi. Yeh ek AI/community moderated space hai; agar koi khud ko nuksan pahunchane ki baat kare to kripya turant ek helpline ya apne kisi apne se madad lein.</div>';
    closeSupportRooms();
    var ref = supportRef(t.id);
    updateDoc(ref, { members: arrayUnion(UID) }).catch(function () { return setDoc(ref, { topic: t.id, members: [UID], createdAt: serverTimestamp() }); });
    supportUnsubs.push(onSnapshot(query(collection(db, "supportRooms", t.id, "msgs"), orderBy("createdAt", "asc"), limit(100)), function (s) {
      var body = $("supportBody"); if (curSupport !== t.id) return;
      body.querySelectorAll(".sc-msg").forEach(function (n) { n.remove(); });
      s.forEach(function (d) {
        var m = snapData(d), mine = m.from === UID;
        body.appendChild(el('<div class="bubble sc-msg ' + (mine ? "me" : "them") + '" style="max-width:85%"><b style="display:block;font-size:11px;opacity:.7">' + esc(mine ? "Tum" : m.alias || "Koi") + '</b>' + esc(m.text) + '</div>'));
      });
      body.scrollTop = 1e9;
    }, function (e) { toast(errMsg(e)); }));
  }
  $("supportBack").addEventListener("click", function () { $("support").classList.remove("open"); closeSupportRooms(); curSupport = null; });
  function sendSupportMsg() {
    var inp = $("supportInput"), t = clean(inp.value, 300); if (!t || !curSupport) return;
    if (CRISIS.test(t)) { inp.value = ""; $("supportBody").appendChild(el('<div class="ai-note">' + esc(CRISIS_REPLY) + '</div>')); $("supportBody").scrollTop = 1e9; return; }
    if (ABUSE.test(t)) { toast("Yeh group sab ke liye safe rehna chahiye — kripya respectfully likho."); return; }
    if (!rate("scmsg", 8, 10000)) return;
    inp.value = "";
    addDoc(collection(db, "supportRooms", curSupport, "msgs"), { from: UID, alias: aliasFor(curSupport, UID), text: t, createdAt: serverTimestamp() }).then(function () { bump("cSupport"); }).catch(function (e) { toast(errMsg(e)); });
  }
  $("supportSend").addEventListener("click", sendSupportMsg);
  $("supportInput").addEventListener("keydown", function (e) { if (e.key === "Enter") sendSupportMsg(); });

  // ---- Voice/video call + walkie-talkie (WebRTC; signaling Firestore messages se) ----
  // Media seedhi dono phone ke beech jaati hai (peer-to-peer) -- WebRTC spec ke mutabik har call
  // DTLS-SRTP se compulsory encrypt hoti hai, isliye ye already end-to-end encrypted hai. Firestore
  // sirf signaling (offer/answer handshake) carry karta hai, kabhi actual awaaz/video nahi.
  var CALL = null, callTick = null, wmTimer = null, discoTimer = null;
  function callShow(show) { $("callUI").hidden = !show; }
  function callSetup(name, sub, opts) {
    $("callName").textContent = name; $("callSub").textContent = sub; $("callAv").textContent = (name || "?").charAt(0).toUpperCase();
    $("callAccept").hidden = !opts.incoming; $("callMute").hidden = !!opts.incoming || opts.walkie; $("ptt").hidden = !opts.walkie || !!opts.incoming;
    $("callMute").classList.remove("on"); lbl("callMute", "Mute");
    $("callRoute").hidden = !!opts.incoming || !routeAvailable(); setRouteBtn(opts.video ? "speaker" : "earpiece", opts.video ? "Speaker" : "Phone"); $("routeSheet").hidden = true;
    $("callCam").hidden = !opts.video || !!opts.incoming; $("callCam").classList.remove("on"); lbl("callCam", "Camera");
    $("callFlip").hidden = $("callFx").hidden = !opts.video || !!opts.incoming; $("callFx").classList.remove("fxon"); $("fxTray").hidden = true;
    $("callHd").hidden = !opts.video;
    $("callUI").classList.toggle("video-on", !!opts.video); $("callUI").classList.remove("idle", "remote-contain");
    $("callLocalVideo").hidden = !opts.video; $("callRemoteVideo").hidden = !opts.video;
    $("callWatermark").textContent = (ME.name || "Pulse") + " · " + UID.slice(0, 6);
    secureScreen(true); $("callUI").classList.remove("self-off"); $("selfShow").hidden = true; $("zoomChip").hidden = true; $("callRemoteVideo").style.transform = ""; $("callLocalVideo").style.transform = ""; Z0();
    idleKick();
    callShow(true);
  }
  function Z0() { try { Z.s = 1; Z.x = 0; Z.y = 0; pipX = 0; pipY = 0; } catch (e) {} }
  function lbl(id, t) { var b = $(id).querySelector(".lb"); if (b) b.textContent = t; }
  function setRouteBtn(kind, t) { $("callRoute").setAttribute("data-k", kind === "earpiece" ? "earpiece" : "speaker"); lbl("callRoute", t); }
  // Controls fade out after a few quiet seconds in a video call; a tap brings them back.
  var idleT = null;
  function idleKick() { var u = $("callUI"); u.classList.remove("idle"); clearTimeout(idleT); if (!u.classList.contains("video-on")) return; idleT = setTimeout(function () { if (CALL && CALL.connected && $("fxTray").hidden && $("routeSheet").hidden) u.classList.add("idle"); }, 3000); }
  $("callUI").addEventListener("pointerdown", idleKick);
  function callMsg(mid, text, call, touchMatch) {
    var b = writeBatch(db), mref = doc(collection(db, "matches", mid, "messages"));
    b.set(mref, { from: UID, text: text, call: call, createdAt: serverTimestamp() });
    if (touchMatch) b.update(doc(db, "matches", mid), { lastText: text, lastAt: serverTimestamp(), lastFrom: UID });
    return b.commit();
  }
  function onRemote(stream) {
    var hasVideo = stream.getVideoTracks().length > 0;
    if (hasVideo) {
      var v = $("callRemoteVideo");
      // Like WhatsApp: the other person fills the whole screen, only my small picture floats on top.
      var fit = function () {};
      v.onplaying = function () { $("callUI").classList.add("remote-live"); fit(); }; v.onresize = fit; v.srcObject = stream; v.play().catch(function () {});
    }
    var a = $("callAudio"); a.srcObject = hasVideo ? null : stream; if (!hasVideo) a.play().catch(function () {});
  }
  function startWatermark() {
    stopWatermark();
    $("callWatermark").textContent = (ME.name || "Pulse") + " · " + UID.slice(0, 6);
  }
  function stopWatermark() { clearInterval(wmTimer); wmTimer = null; }
  function onState(st) {
    if (!CALL) return;
    if (st === "connected") {
      clearTimeout(discoTimer); discoTimer = null;
      if (!CALL.connected) { CALL.connected = true; clearTimeout(CALL.timeout); CALL.t0 = Date.now(); stopTone(); chime(true); refreshRouteLabel();
        if (CALL.mode === "walkie" && !CALL.muteInit) { CALL.muteInit = true; setMic(false); $("ptt").hidden = false; $("callAccept").hidden = true; }
        Call.requestWakeLock(); Call.setMediaSession(CALL.mode === "video" ? "Pulse Video Call" : CALL.mode === "walkie" ? "Pulse Walkie-talkie" : "Pulse Call");
        if (CALL.mode === "video") { startWatermark(); if (CALL.pc) CALL.stopAdapt = Call.adapt(CALL.pc); }
        callTick = setInterval(function () { if (!CALL) return; var s = Math.floor((Date.now() - CALL.t0) / 1000); $("callSub").textContent = (CALL.mode === "walkie" ? "Walkie-talkie · " : CALL.mode === "video" ? "Video call · " : "Call · ") + Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }, 500);
      } else { $("callSub").textContent = (CALL.mode === "walkie" ? "Walkie-talkie" : CALL.mode === "video" ? "Video call" : "Call"); }
    } else if (st === "disconnected") {
      // Network hichki -- turant call mat kaato, kuch second recover hone do (jaise WhatsApp/Meet karte hain)
      if (CALL.connected && !discoTimer) {
        $("callSub").textContent = "Reconnecting...";
        try { if (CALL.pc && CALL.pc.restartIce) CALL.pc.restartIce(); } catch (e) {}
        discoTimer = setTimeout(function () { if (CALL && !CALL.ending) endCall(true, "Connection lost (network)."); }, 15000);
      }
    } else if ((st === "failed" || st === "closed") && !CALL.ending) {
      endCall(true, "Could not connect (network issue). Please try again.");
    }
  }
  function setMic(on) { if (CALL && CALL.stream) CALL.stream.getAudioTracks().forEach(function (t) { t.enabled = on; }); }
  function setCam(on) { if (CALL && CALL.stream) CALL.stream.getVideoTracks().forEach(function (t) { t.enabled = on; }); }
  function watchCall() {
    var cur = CALL; if (!cur) return;
    cur.unsub = onSnapshot(query(collection(db, "matches", cur.mid, "messages"), orderBy("createdAt", "desc"), limit(8)), function (s) {
      s.forEach(function (d) {
        var m = d.data(); if (!m.call || m.call.id !== cur.id || m.from === UID || CALL !== cur) return;
        if (m.call.k === "answer" && cur.role === "out" && !cur.answered && cur.pc) { cur.answered = true; Call.applyAnswer(cur.pc, m.call.sdp).catch(function () { endCall(true, "Call could not connect"); }); }
        if (m.call.k === "end") endCall(false, cur.connected ? "Call ended" : "Call not answered");
      });
    });
  }
  function permMsg(isVideo) {
    var app = document.documentElement.classList.contains("native-app"), what = isVideo ? "Camera and microphone" : "Microphone";
    return app ? what + " access is off. Open Settings > Apps > Pulse > Permissions and allow it." : what + " access is blocked. Allow it in your browser's site settings.";
  }
  var CALL_LABEL = { call: "📞 Voice call", walkie: "📻 Walkie-talkie", video: "🎥 Video call" };
  function startCall(mode) {
    if (!activeChat || activeChat.ai || CALL) return;
    if (!Call.supported()) { toast("Calls don't work in this browser. Please use Chrome or the Android app."); return; }
    var c = activeChat, id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6), isVideo = mode === "video";
    Call.getMedia(isVideo).then(function (stream) {
      CALL = { mid: c.mid, id: id, role: "out", mode: mode, stream: stream, name: c.name, peer: c.id };
      callSetup(c.name, "Ringing...", { walkie: mode === "walkie", video: isVideo });
      routeStart(isVideo).then(refreshRouteLabel); startTone("out"); serviceStart(isVideo, "Pulse call with " + c.name);
      if (isVideo) { var lv = $("callLocalVideo"); lv.srcObject = stream; lv.play().catch(function () {}); }
      CALL.facing = "user"; if (isVideo) Call.wide(stream.getVideoTracks()[0], true);
      return Call.makeOffer(stream, onRemote, onState, onFxData).then(function (o) {
        if (!CALL || CALL.id !== id) { o.pc.close(); return; }
        CALL.pc = o.pc; watchCall();
        CALL.timeout = setTimeout(function () { if (CALL && CALL.id === id && !CALL.connected) endCall(true, "No answer"); }, 45000);
        return callMsg(c.mid, CALL_LABEL[mode] || CALL_LABEL.call, { k: "offer", id: id, mode: mode, sdp: o.sdp }, true).then(function (r) { bump("cCalls"); markCall(c.mid, id, mode, c.id, "ringing"); return r; });
      });
    }).catch(function (e) { endCall(false); toast(e && e.name === "NotAllowedError" ? permMsg(isVideo) : errMsg(e)); });
  }
  function endCall(notify, msg) {
    var c = CALL; if (!c) return; c.ending = true; CALL = null; clearInterval(callTick); clearTimeout(c.timeout); clearTimeout(discoTimer); discoTimer = null; stopWatermark();
    if (c.stopAdapt) { try { c.stopAdapt(); } catch (e) {} }
    if (c.fx) { try { c.fx.stop(); } catch (e) {} } $("fxTray").hidden = true; clearTimeout(idleT); $("callUI").classList.remove("idle"); $("callFxLayer").innerHTML = "";
    secureScreen(false);
    Call.releaseWakeLock(); Call.clearMediaSession(); stopTone(); routeStop(); serviceStop(); $("routeSheet").hidden = true; if (c.connected) chime(false);
    if (c.unsub) try { c.unsub(); } catch (e) {}
    if (c.stream) c.stream.getTracks().forEach(function (t) { t.stop(); }); if (c.pc) try { c.pc.close(); } catch (e) {}
    $("callUI").classList.remove("remote-live"); $("callAudio").srcObject = null; $("callRemoteVideo").srcObject = null; $("callLocalVideo").srcObject = null;
    $("callUI").classList.remove("video-on"); callShow(false);
    if (notify && c.mid) { callMsg(c.mid, "📞 Call ended", { k: "end", id: c.id }, true).catch(function () {}); markCall(c.mid, c.id, c.mode, c.peer, "ended"); }
    if (msg) toast(msg);
  }
  // Ring marker: calls/<matchId> is written when a call starts and again when it ends, so the other phone rings even if
  // the match list did not change in a way we noticed (previously calls were only detected through lastText).
  function markCall(mid, id, mode, other, state) {
    return setDoc(doc(db, "calls", mid), { from: UID, to: other, id: id, mode: mode, state: state, createdAt: serverTimestamp() }).catch(function () {});
  }
  function listenCalls() {
    unsubs.push(onSnapshot(query(collection(db, "calls"), where("to", "==", UID)), function (snap) {
      snap.docChanges().forEach(function (ch) {
        if (ch.type === "removed") return;
        var d = snapData(ch.doc);
        if (d.state === "ringing" && !CALL) {
          var age = d.createdAt ? Date.now() - ms(d.createdAt) : 0;
          if (age < 60000) maybeIncoming(ch.doc.id, null, d.from, d.id);
        } else if (d.state === "ended" && CALL && CALL.id === d.id && !CALL.ending) {
          endCall(false, CALL.connected ? "Call ended" : CALL.role === "in" ? "Missed call" : "Call declined");
        }
      });
    }, function () {}));
  }
  function maybeIncoming(mid, m, other, wantId) {
    if (CALL) return;
    if (!wantId && (!/^(📞 Voice|📻|🎥)/.test(m.lastText || "") || Date.now() - ms(m.lastAt) > 40000)) return;
    getDocs(query(collection(db, "matches", mid, "messages"), orderBy("createdAt", "desc"), limit(10))).then(function (s) {
      if (CALL) return; var offer = null, ended = {};
      s.forEach(function (d) { var x = d.data(); if (!x.call) return; if (x.call.k === "end") ended[x.call.id] = 1; else if (x.call.k === "offer" && x.from !== UID && !offer && (!wantId || x.call.id === wantId)) offer = x.call; });
      if (!offer || ended[offer.id]) return;
      userName(other).then(function (n) {
        if (CALL) return; CALL = { mid: mid, id: offer.id, role: "in", mode: offer.mode, offer: offer.sdp, name: n, peer: other };
        var sub = offer.mode === "walkie" ? "📻 Walkie-talkie incoming" : offer.mode === "video" ? "🎥 Incoming video call" : "📞 Incoming call";
        callSetup(n, sub, { incoming: true, video: offer.mode === "video" }); startTone("in");
        watchCall(); CALL.timeout = setTimeout(function () { if (CALL && CALL.id === offer.id && !CALL.connected) endCall(false, "Missed call"); }, 40000);
      });
    }).catch(function () {});
  }
  $("callAccept").addEventListener("click", function () {
    var c = CALL; if (!c || c.role !== "in") return; this.hidden = true; stopTone(); $("callSub").textContent = "Connecting..."; var isVideo = c.mode === "video";
    routeStart(isVideo).then(refreshRouteLabel); serviceStart(isVideo, "Pulse call with " + c.name); $("callRoute").hidden = !routeAvailable();
    Call.getMedia(isVideo).then(function (stream) {
      c.stream = stream;
      if (isVideo) { var lv = $("callLocalVideo"); lv.srcObject = stream; lv.hidden = false; lv.play().catch(function () {}); $("callRemoteVideo").hidden = false; $("callUI").classList.add("video-on"); }
      c.facing = "user"; if (isVideo) Call.wide(stream.getVideoTracks()[0], true);
      return Call.makeAnswer(stream, c.offer, onRemote, onState, onFxData);
    })
      .then(function (a) { c.pc = a.pc; $("callMute").hidden = c.mode === "walkie"; $("ptt").hidden = c.mode !== "walkie"; $("callCam").hidden = !isVideo; $("callFlip").hidden = $("callFx").hidden = !isVideo; return callMsg(c.mid, "📞 Jawab", { k: "answer", id: c.id, sdp: a.sdp }, false); })
      .catch(function (e) { endCall(true); toast(e && e.name === "NotAllowedError" ? permMsg(isVideo) : errMsg(e)); });
  });
  var ROUTE_ICON = { earpiece: "Phone", speaker: "Speaker", bluetooth: "Bluetooth", wired: "Headset" };
  function refreshRouteLabel() { routeList().then(function (r) { var cur = r.current || "earpiece", d = (r.devices || []).filter(function (x) { return x.kind === cur; })[0]; setRouteBtn(cur, cur === "bluetooth" && d && d.name ? d.name : (ROUTE_ICON[cur] || "Phone")); }); }
  $("callRoute").addEventListener("click", function () {
    var sh = $("routeSheet"); if (!sh.hidden) { sh.hidden = true; return; }
    routeList().then(function (r) {
      sh.innerHTML = ""; var cur = r.current || "earpiece";
      (r.devices || []).forEach(function (d) {
        var label = d.kind === "earpiece" ? "Phone" : d.kind === "speaker" ? "Speaker" : d.kind === "wired" ? "Wired headset" : "Bluetooth" + (d.name ? ": " + d.name : "");
        var b = el('<button type="button"></button>'); b.textContent = (d.kind === "earpiece" ? "📱 " : d.kind === "speaker" ? "🔊 " : d.kind === "wired" ? "🎧 " : "🎧 ") + label; if (d.kind === cur) b.classList.add("on");
        b.addEventListener("click", function () { routeSet(d).then(function () { sh.hidden = true; setRouteBtn(d.kind, d.kind === "bluetooth" && d.name ? d.name : (ROUTE_ICON[d.kind] || "Phone")); }); });
        sh.appendChild(b);
      });
      sh.hidden = false;
    });
  });
  $("callEnd").addEventListener("click", function () { endCall(true); });
  $("callMute").addEventListener("click", function () { if (!CALL) return; var on = this.classList.toggle("on"); setMic(!on); lbl("callMute", on ? "Unmute" : "Mute"); });
  $("callCam").addEventListener("click", function () { if (!CALL) return; var off = this.classList.toggle("on"); setCam(!off); lbl("callCam", off ? "Camera on" : "Camera"); });

  // ---- Effects (filters, face stickers, floating reactions), camera flip ----
  var pipX = 0, pipY = 0;
  function pipT() { var lv = $("callLocalVideo"); lv.style.transform = "translate(" + pipX + "px," + pipY + "px)" + (lv.classList.contains("rear") ? "" : " scaleX(-1)"); }
  function previewStream(c) { var lv = $("callLocalVideo"), s = c.fx && c.fx.active() ? new MediaStream([c.fx.track]) : c.stream; lv.srcObject = s; lv.classList.toggle("rear", c.facing === "environment"); pipT(); lv.play().catch(function () {}); }
  // My own picture: drag it anywhere, or push it off the right edge to hide it (tap the small tab to bring it back).
  (function () {
    var p = $("callLocalVideo"), sx = 0, sy = 0, ox = 0, oy = 0, drag = false;
    p.addEventListener("pointerdown", function (e) { e.stopPropagation(); drag = true; sx = e.clientX; sy = e.clientY; ox = pipX; oy = pipY; try { p.setPointerCapture(e.pointerId); } catch (x) {} });
    p.addEventListener("pointermove", function (e) { if (!drag) return; pipX = ox + e.clientX - sx; pipY = oy + e.clientY - sy; pipT(); });
    function up() {
      if (!drag) return; drag = false; var r = p.getBoundingClientRect();
      if (r.left + r.width / 2 > innerWidth * 0.82) { $("callUI").classList.add("self-off"); $("selfShow").hidden = false; }
      else { pipX = Math.max(-(innerWidth - r.width - 24), Math.min(pipX, 12)); pipT(); }
    }
    p.addEventListener("pointerup", up); p.addEventListener("pointercancel", up);
    $("selfShow").addEventListener("click", function () { $("callUI").classList.remove("self-off"); this.hidden = true; pipX = 0; pipY = 0; pipT(); });
  })();
  // Zoom the other person: pinch with two fingers, drag to move around, double-tap for 2x. Tap the chip to reset.
  var Z = { s: 1, x: 0, y: 0 };
  function zApply() {
    var v = $("callRemoteVideo"), w = innerWidth, h = innerHeight;
    Z.s = Math.max(1, Math.min(5, Z.s)); var mx = (Z.s - 1) * w / 2, my = (Z.s - 1) * h / 2;
    Z.x = Math.max(-mx, Math.min(mx, Z.x)); Z.y = Math.max(-my, Math.min(my, Z.y));
    v.style.transform = Z.s === 1 ? "" : "translate(" + Z.x + "px," + Z.y + "px) scale(" + Z.s + ")";
    var chip = $("zoomChip"); chip.hidden = Z.s === 1; chip.textContent = Z.s.toFixed(1) + "× · reset";
  }
  function zReset() { Z.s = 1; Z.x = 0; Z.y = 0; zApply(); }
  $("zoomChip").addEventListener("click", zReset);
  (function () {
    var w = $("callVideoWrap"), ptrs = {}, d0 = 0, s0 = 1, lastTap = 0;
    function dist() { var k = Object.keys(ptrs); if (k.length < 2) return 0; var a = ptrs[k[0]], b = ptrs[k[1]]; return Math.hypot(a.x - b.x, a.y - b.y); }
    w.addEventListener("pointerdown", function (e) { ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; try { w.setPointerCapture(e.pointerId); } catch (x) {} d0 = dist(); s0 = Z.s;
      if (Object.keys(ptrs).length === 1) { var t = Date.now(); if (t - lastTap < 300) { Z.s > 1 ? zReset() : (Z.s = 2, zApply()); } lastTap = t; } });
    w.addEventListener("pointermove", function (e) {
      var p = ptrs[e.pointerId]; if (!p) return; var n = Object.keys(ptrs).length;
      if (n >= 2) { ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; var d = dist(); if (d0 > 10) { Z.s = s0 * d / d0; zApply(); } }
      else if (Z.s > 1) { Z.x += e.clientX - p.x; Z.y += e.clientY - p.y; ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; zApply(); }
    });
    function end(e) { delete ptrs[e.pointerId]; d0 = dist(); s0 = Z.s; }
    w.addEventListener("pointerup", end); w.addEventListener("pointercancel", end);
  })();
  function applyFx(o) {
    var c = CALL; if (!c || !c.stream || !effectsSupported()) { toast("Effects are not supported on this device."); return; }
    if (!c.fx) c.fx = createEffects(c.stream); if (!c.fx) return;
    c.fx.set(o);
    var sn = c.pc && Call.videoSender(c.pc), want = c.fx.active() ? c.fx.track : c.fx.raw;
    if (sn && sn.track !== want) sn.replaceTrack(want).catch(function () {});
    previewStream(c); paintFxTray();
  }
  function paintFxTray() {
    var c = CALL, st = c && c.fx ? c.fx.state() : { filter: "none", sticker: "none" };
    var f = $("fxFilters"), s = $("fxStickers"), r = $("fxReact");
    if (!f.children.length) {
      var wb = el('<button type="button" class="on">↔ Wide</button>');
      wb.addEventListener("click", function () { var cc = CALL; if (!cc || !cc.stream) return; cc.wideOn = cc.wideOn === false; var ok = Call.wide(cc.stream.getVideoTracks()[0], cc.wideOn); if (!ok && cc.wideOn) toast("This camera has no wider view."); wb.classList.toggle("on", cc.wideOn); });
      f.appendChild(wb);
      FILTERS.forEach(function (x) { var b = el('<button type="button" data-f="' + x.id + '"></button>'); b.textContent = x.name; b.addEventListener("click", function () { applyFx({ filter: x.id }); }); f.appendChild(b); });
      STICKERS.forEach(function (x) { var b = el('<button type="button" data-s="' + x.id + '"></button>'); b.textContent = x.e; b.addEventListener("click", function () { applyFx({ sticker: x.id }); }); s.appendChild(b); });
      ["❤️", "😂", "👍", "🔥", "😮", "👏", "🎉"].forEach(function (e) { var b = el('<button type="button"></button>'); b.textContent = e; b.addEventListener("click", function () { sendReaction(e); }); r.appendChild(b); });
    }
    Array.prototype.forEach.call(f.children, function (b) { b.classList.toggle("on", b.getAttribute("data-f") === st.filter); });
    Array.prototype.forEach.call(s.children, function (b) { b.classList.toggle("on", b.getAttribute("data-s") === st.sticker); });
  }
  function floatEmoji(e) {
    var n = el('<span class="fx-flt"></span>'); n.textContent = e; n.style.left = (8 + Math.random() * 78) + "%"; $("callFxLayer").appendChild(n); setTimeout(function () { n.remove(); }, 2700);
  }
  function sendReaction(e) { floatEmoji(e); try { if (CALL && CALL.pc && CALL.pc.fx && CALL.pc.fx.readyState === "open") CALL.pc.fx.send(JSON.stringify({ r: e })); } catch (x) {} }
  function onFxData(d) { try { var m = JSON.parse(d); if (m && typeof m.r === "string" && m.r.length <= 8) floatEmoji(m.r); } catch (e) {} }
  $("callFx").addEventListener("click", function () { var t = $("fxTray"); t.hidden = !t.hidden; this.classList.toggle("fxon", !t.hidden); if (!t.hidden) paintFxTray(); idleKick(); });
  $("callFlip").addEventListener("click", function () {
    var c = CALL; if (!c || !c.stream || c.flipping) return; c.flipping = true;
    var next = c.facing === "environment" ? "user" : "environment", btn = this;
    Call.getMedia(true, next).then(function (ns) {
      var nv = ns.getVideoTracks()[0], old = c.stream.getVideoTracks()[0], wasOff = old && !old.enabled;
      ns.getAudioTracks().forEach(function (t) { t.stop(); });
      if (wasOff) nv.enabled = false;
      var fxState = c.fx ? c.fx.state() : null; if (c.fx) { c.fx.stop(); c.fx = null; }
      c.stream.removeTrack(old); c.stream.addTrack(nv); if (old) old.stop(); c.facing = next;
      var sn = c.pc && Call.videoSender(c.pc); if (sn) sn.replaceTrack(nv).catch(function () {});
      Call.wide(nv, true); Call.tune(c.pc);
      if (fxState && (fxState.filter !== "none" || fxState.sticker !== "none")) applyFx(fxState); else previewStream(c);
    }).catch(function () { toast("Could not switch the camera."); }).then(function () { c.flipping = false; });
  });
  document.addEventListener("visibilitychange", function () { Call.reacquireWakeLockIfNeeded(); });
  (function () { var p = $("ptt"); function dn(e) { e.preventDefault(); setMic(true); p.classList.add("live"); p.textContent = "🎙 Speaking..."; } function up() { setMic(false); p.classList.remove("live"); p.textContent = "🎙 Hold to talk"; }
    p.addEventListener("pointerdown", dn); p.addEventListener("pointerup", up); p.addEventListener("pointerleave", up); p.addEventListener("pointercancel", up); })();
  $("callBtn").addEventListener("click", function () { startCall("call"); });
  $("videoCallBtn").addEventListener("click", function () { startCall("video"); });
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
    q("medAsk", function () { medMsg(c.mid, "Mediator request sent. Waiting for the other person to agree.", { k: "ask" }, true); });
    q("medYes", function () { medMsg(c.mid, "Dono ne haan kaha. AI Mediator ON.", { k: "yes" }, true); });
    q("medNo", function () { medMsg(c.mid, "Mediator ki request radd.", { k: "no" }, false); });
    q("medOff", function () { medMsg(c.mid, "Mediator turned off.", { k: "off" }, false); });
    q("medHelp", function () { mediate(c); });
  }
  var medBusy = false;
  function mediate(c) {
    if (medBusy || !c.hist || !c.hist.length) { toast(c.hist && c.hist.length ? "Please wait..." : "Chat a bit first"); return; }
    medBusy = true; var btn = $("medHelp"); if (btn) { btn.disabled = true; btn.textContent = "Thinking..."; }
    var names = {}; names[UID] = ME.name; names[c.id] = c.name;
    var tr = c.hist.slice(-12).map(function (m) { return (names[m.from] || "?") + ": " + m.text; }).join("\n");
    var fallback = "AI abhi band hai, to ek simple tareeka:\n1) Ek-ek karke apni baat 'main ... mehsoos karta/karti hoon' se shuru karo.\n2) Doosre ko bina beech me toke poora suno.\n3) Jahan sehmat ho wo likho, phir ek chhota hal chuno.\n4) Dhamki ya zabardasti lage to Block/Report karo.";
    aiChat(MED_SYS, [{ role: "user", text: "Chat (" + names[UID] + " aur " + names[c.id] + "):\n" + tr }]).catch(function () { return fallback; })
      .then(function (t) { return medMsg(c.mid, "🤝 AI Mediator: " + t, { k: "say" }, true); }).then(function () { medBusy = false; });
  }
  function safeMeet(u) {
    var where = window.prompt("Where and when are you meeting? (e.g. Phoenix Mall, Lucknow, tomorrow 5pm)"); if (!where) return;
    var text = "Safety check: I'm meeting " + u.name + " (Pulse match). Place/time: " + where.slice(0, 120) + ". Please call to check on me in an hour.";
    if (navigator.share) navigator.share({ text: text }).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { toast("Copied. Send it to someone you trust 📋"); }); else toast(text);
  }

  // ---- activity counters (admin monitoring only -- counts, never message content) ----
  // Flat top-level fields (not dotted paths) so counts update the same way in every
  // Firestore client. See ACTIVITY_FIELDS below for what each one means.
  function bump(field, n) {
    if (!UID) return;
    var upd = {}; upd[field] = increment(n || 1);
    if (ME) ME[field] = (ME[field] || 0) + (n || 1); // local echo so same-session reads (Journey Score) stay live
    updateDoc(doc(db, "users", UID), upd).catch(function () {});
  }
  var ACTIVITY_FIELDS = [
    { k: "cPosts", lbl: "Posts" }, { k: "cMsgs", lbl: "Msgs" }, { k: "cSwipes", lbl: "Swipes" },
    { k: "cMatches", lbl: "Matches" }, { k: "cApps", lbl: "Applications" }, { k: "cJobs", lbl: "Jobs posted" },
    { k: "cCalls", lbl: "Calls" }, { k: "cSongs", lbl: "Songs played" }, { k: "cRooms", lbl: "Aarti rooms" },
    { k: "cAi", lbl: "AI chats" }, { k: "cStatus", lbl: "Status posts" },
    { k: "cDuets", lbl: "Duet Songs" }, { k: "cFeedback", lbl: "Date feedback given" }, { k: "cSupport", lbl: "Support Circle msgs" }
  ];
  // ---- Trust & Journey Score: a compounding badge from how a person actually uses Pulse across
  // every feature -- the thing a copycat app can't fake without copying their whole history too. ----
  function journeyScore(u) {
    return (u.cMsgs || 0) * 1 + (u.cMatches || 0) * 5 + (u.cSongs || 0) * 2 + (u.cCalls || 0) * 4 + (u.cAi || 0) * 1
      + (u.cDuets || 0) * 10 + (u.cFeedback || 0) * 12 + (u.cSupport || 0) * 3 + (u.cRooms || 0) * 2
      + ((u.circleMembers || []).length) * 8;
  }
  function journeyTier(score) {
    if (score >= 400) return { name: "Soulful ✨", next: null };
    if (score >= 150) return { name: "Trusted 💎", next: 400 };
    if (score >= 50) return { name: "Connector 🌱", next: 150 };
    return { name: "New Journey 🌼", next: 50 };
  }
  function journeyFacts() {
    if (!ME) return "";
    var bits = [];
    if (ME.cDuets) bits.push(ME.cDuets + " Duet Song(s) made with matches");
    if (ME.cCalls) bits.push(ME.cCalls + " voice/video call(s)");
    if ((ME.circleMembers || []).length) bits.push("part of a Safety Circle with " + ME.circleMembers.length + " trusted friend(s)");
    if (ME.cSupport) bits.push("active in Pulse's anonymous Support Circles");
    if (!bits.length) return "";
    return " Lightly, only if it fits naturally, you may recall this about the user's journey on Pulse: " + bits.join(", ") + ".";
  }
  function renderJourney() {
    var box = $("journeyBox"); if (!box || !ME) return;
    var score = journeyScore(ME), tier = journeyTier(score);
    box.innerHTML = '<div class="section-title">Trust &amp; Journey</div><div class="ai-note" style="display:flex;align-items:center;gap:12px"><div style="font-size:26px">' + tier.name.split(" ").pop() + '</div><div><b>' + esc(tier.name.split(" ").slice(0, -1).join(" ")) + '</b><div class="st-note" style="margin:2px 0 0">Score ' + score + (tier.next ? " · " + (tier.next - score) + " points to the next level" : " · top level 🎉") + '</div></div></div>';
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

  // ---- voice recorder (used by chat voice notes and by "Sing it" in the song studio) ----
  function recStart() {
    if (!navigator.mediaDevices || !window.MediaRecorder) return Promise.reject(new Error("Recording is not supported on this device"));
    return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true } }).then(function (st) {
      var mt = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].filter(function (t) { return MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t); })[0] || "";
      var ch = [], r = new MediaRecorder(st, mt ? { mimeType: mt, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 }), t0 = Date.now();
      r.ondataavailable = function (e) { if (e.data && e.data.size) ch.push(e.data); };
      r.start(500);
      function free() { st.getTracks().forEach(function (t) { t.stop(); }); }
      return {
        stop: function () { return new Promise(function (res, rej) { r.onstop = function () { free(); var fr = new FileReader(); fr.onload = function () { res({ data: String(fr.result), ms: Date.now() - t0 }); }; fr.onerror = rej; fr.readAsDataURL(new Blob(ch, { type: r.mimeType || mt || "audio/webm" })); }; try { r.stop(); } catch (e) { free(); rej(e); } }); },
        cancel: function () { try { r.onstop = null; r.stop(); } catch (e) {} free(); }
      };
    });
  }
  var AUDIO_OK = /^data:audio\/[a-z0-9.+-]+(;codecs=[a-z0-9.,]+)?;base64,/i;
  var vn = null, vnTimer = null;
  function vnReset() { clearInterval(vnTimer); vnTimer = null; vn = null; $("vnBtn").classList.remove("rec"); $("vnBtn").textContent = "🎤"; }
  $("vnBtn").addEventListener("click", function () {
    var c = activeChat; if (!c || c.ai) { toast("Voice notes work in chats with people"); return; }
    if (vn) {
      var h = vn; vnReset();
      h.stop().then(function (r) {
        if (r.ms < 700) return;
        if (r.data.length > 260000) throw new Error("Voice note is too long");
        if (!rate("vn", 6, 60000)) return;
        var b = writeBatch(db), mref = doc(collection(db, "matches", c.mid, "messages"));
        b.set(mref, { from: UID, text: "🎤 Voice note", aud: r.data, dur: Math.round(r.ms / 1000), createdAt: serverTimestamp() });
        b.update(doc(db, "matches", c.mid), { lastText: "🎤 Voice note", lastAt: serverTimestamp(), lastFrom: UID });
        return b.commit();
      }).catch(function (e) { toast(errMsg(e)); });
      return;
    }
    recStart().then(function (h) {
      vn = h; var t0 = Date.now(), btn = $("vnBtn"); btn.classList.add("rec");
      var tick = function () { var s = Math.floor((Date.now() - t0) / 1000); btn.textContent = "⏹ " + fmtDur(s); if (s >= 40 && vn === h) btn.click(); };
      tick(); vnTimer = setInterval(tick, 500);
    }).catch(function (e) { toast(/denied|NotAllowed|Permission/i.test(String(e && (e.name || e.message))) ? "Microphone access is off. Open Settings > Apps > Pulse > Permissions and allow it." : errMsg(e)); });
  });

  // ---- Songs: community feed with likes, plus "Sing it" (record your own voice over the backing track) ----
  var songDocs = [], songTab = "hot", feedPlayer = new Player(), feedPlaying = null, feedAudio = null, stVoiceRec = null, stTake = null;
  $("stToggle").addEventListener("click", function () { var s = $("stCreate"); s.hidden = !s.hidden; this.textContent = s.hidden ? "+ Create" : "Close"; });
  document.querySelectorAll("#songTabs button").forEach(function (b) { b.addEventListener("click", function () { songTab = b.getAttribute("data-k"); document.querySelectorAll("#songTabs button").forEach(function (x) { x.classList.toggle("on", x === b); }); renderSongs(); }); });
  function stopFeedPlay() { try { feedPlayer.stop(); } catch (e) {} try { speechSynthesis.cancel(); } catch (e) {} if (feedAudio) { try { feedAudio.pause(); } catch (e) {} feedAudio = null; } feedPlaying = null; document.querySelectorAll(".sg-play").forEach(function (x) { x.textContent = "▶"; }); document.querySelectorAll(".sg-bar i").forEach(function (x) { x.style.width = "0"; }); }
  function playPublished(sd, card) {
    if (feedPlaying === sd.id) { stopFeedPlay(); return; }
    stopFeedPlay(); feedPlaying = sd.id;
    var btn = card.querySelector(".sg-play"), bar = card.querySelector(".sg-bar i"); btn.textContent = "⏹";
    var song = buildSong({ genre: sd.genre, bpm: sd.bpm, minor: sd.minor, title: sd.title, lines: sd.lines });
    var hasVoice = sd.aud && AUDIO_OK.test(sd.aud);
    if (hasVoice) { feedAudio = new Audio(sd.aud); feedAudio.play().catch(function () {}); }
    feedPlayer.play(song, {
      onLine: function (i) { if (!hasVoice && i >= 0 && sd.lines[i]) singLine(song, i, { kind: sd.singer || "f", lang: sd.lang === "en" ? "en-IN" : "hi-IN" }); },
      onTick: function (s, t) { bar.style.width = Math.min(100, s / t * 100) + "%"; },
      onEnd: function () { if (feedPlaying === sd.id) stopFeedPlay(); }
    }).catch(function (e) { stopFeedPlay(); toast(errMsg(e)); });
  }
  function renderSongs() {
    var box = $("songFeed"); if (!box) return; stopFeedPlay(); box.innerHTML = "";
    var l = songDocs.filter(function (s) { return !blocked.has(s.uid) && (songTab !== "mine" || s.uid === UID); });
    if (songTab === "hot") l = l.slice().sort(function (a, b) { return (b.likedBy || []).length - (a.likedBy || []).length || b.t - a.t; });
    if (!l.length) { box.appendChild(el('<div class="empty">' + (songTab === "mine" ? "You have not published a song yet. Tap Create to make your first one." : "No songs yet. Be the first to publish one.") + '</div>')); return; }
    l.forEach(function (sd) {
      var liked = (sd.likedBy || []).indexOf(UID) >= 0, genre = GENRES[sd.genre] ? GENRES[sd.genre].name : "";
      var card = el('<div class="sg-card"><div class="sg-head"><button class="sg-play" type="button">▶</button><div style="flex:1;min-width:0"><div class="sg-t"></div><div class="sg-by"></div></div>' + (sd.aud ? '<span class="sg-voice">Voice</span>' : "") + '</div><div class="sg-ly"></div><div class="sg-bar"><i></i></div><div class="sg-act"><button class="sg-like' + (liked ? " liked" : "") + '" type="button">' + (liked ? "♥" : "♡") + ' ' + (sd.likedBy || []).length + '</button>' + '<button class="sg-share" type="button">Share</button>' + (sd.uid === UID ? '<button class="sg-del" type="button">Delete</button>' : "") + '</div></div>'); card.setAttribute("data-id", sd.id);
      card.querySelector(".sg-share").addEventListener("click", function () { if (window.__pulseSocial) window.__pulseSocial.shareSong(sd); });
      card.querySelector(".sg-t").textContent = sd.title; card.querySelector(".sg-by").textContent = "by " + sd.name + " · " + genre + " · " + ago(sd.t);
      card.querySelector(".sg-ly").textContent = sd.lines.slice(0, 2).map(function (x) { return x.text; }).join("\n");
      card.querySelector(".sg-play").addEventListener("click", function () { bump("cSongs"); playPublished(sd, card); });
      card.querySelector(".sg-like").addEventListener("click", function () { updateDoc(doc(db, "songs", sd.id), { likedBy: liked ? arrayRemove(UID) : arrayUnion(UID) }).catch(function (e) { toast(errMsg(e)); }); });
      var dl = card.querySelector(".sg-del"); if (dl) dl.addEventListener("click", function () { if (confirm("Delete this song?")) deleteDoc(doc(db, "songs", sd.id)).catch(function (e) { toast(errMsg(e)); }); });
      box.appendChild(card);
    });
  }
  function listenSongs() {
    unsubs.push(onSnapshot(query(collection(db, "songs"), orderBy("createdAt", "desc"), limit(60)), function (snap) {
      songDocs = []; snap.forEach(function (d) { var x = snapData(d); if (!x.lines || !x.title) return; songDocs.push({ id: d.id, uid: x.uid, name: x.name || "Member", title: x.title, genre: x.genre, bpm: x.bpm, minor: !!x.minor, lines: x.lines, aud: x.aud, singer: x.singer, lang: x.lang, likedBy: x.likedBy || [], t: ms(x.createdAt) || Date.now() }); });
      if (!feedPlaying) renderSongs();
    }, function () {}));
  }
  function stRecReset() { if (stVoiceRec) { stVoiceRec.cancel(); stVoiceRec = null; } stTake = null; $("stRec").classList.remove("rec"); $("stRec").textContent = "Sing it"; $("stRecAudio").hidden = true; $("stRecAudio").removeAttribute("src"); }
  $("stRec").addEventListener("click", function () {
    if (!curSong) return; var btn = this;
    if (stVoiceRec) { var h = stVoiceRec; stVoiceRec = null; player.stop(); try { speechSynthesis.cancel(); } catch (e) {} $("stPlay").textContent = "▶ Play"; btn.classList.remove("rec"); btn.textContent = "Sing it";
      h.stop().then(function (r) { if (r.data.length > 500000) { toast("Recording is too long. Try a shorter song."); return; } stTake = r.data; var a = $("stRecAudio"); a.src = r.data; a.hidden = false; $("stRecNote").textContent = "Your voice is attached. Listen, or tap Sing it to record again."; }).catch(function (e) { toast(errMsg(e)); }); return; }
    stRecReset(); player.stop();
    recStart().then(function (h) {
      stVoiceRec = h; btn.classList.add("rec"); btn.textContent = "Stop"; $("stPlay").textContent = "⏹ Stop";
      player.play(curSong, {
        onLine: function (i) { document.querySelectorAll("#stLyrics .ln").forEach(function (n) { n.classList.toggle("on", +n.getAttribute("data-i") === i); }); },
        onTick: function (s, t) { $("stBar").style.width = Math.min(100, s / t * 100) + "%"; },
        onEnd: function () { if (stVoiceRec === h) btn.click(); $("stBar").style.width = "0"; }
      }).catch(function (e) { toast(errMsg(e)); });
    }).catch(function (e) { toast(/denied|NotAllowed|Permission/i.test(String(e && (e.name || e.message))) ? "Microphone access is off. Open Settings > Apps > Pulse > Permissions and allow it." : errMsg(e)); });
  });
  $("stPublish").addEventListener("click", function () {
    if (!curMeta || !rate("song", 4, 60000)) return; var btn = this; btn.disabled = true;
    var d = { uid: UID, name: ME.name, title: clean(curMeta.title, 60), genre: curMeta.genre, bpm: curSong ? curSong.bpm : 0, minor: !!curMeta.minor, singer: $("stSinger").value, lang: $("stLang").value === "en" ? "en" : "hi", lines: curMeta.lines.slice(0, 16).map(function (x) { return { section: clean(x.section, 20), text: clean(x.text, 90) }; }), likedBy: [], createdAt: serverTimestamp() };
    if (stTake && stTake.length <= 500000) d.aud = stTake;
    if (window.__pulseChallenge) d.challenge = window.__pulseChallenge;
    addDoc(collection(db, "songs"), d).then(function () { window.__pulseChallenge = null; if (window.__pulseSocial) window.__pulseSocial.refreshChallenge(); toast("Song published 🎉"); bump("cSongs"); $("stCreate").hidden = true; $("stToggle").textContent = "+ Create"; songTab = "new"; document.querySelectorAll("#songTabs button").forEach(function (x) { x.classList.toggle("on", x.getAttribute("data-k") === "new"); }); })
      .catch(function (e) { toast(errMsg(e)); }).then(function () { btn.disabled = false; });
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
  var POLICY_EN = '<h3>Terms of Use &amp; Privacy Policy</h3><p><i>Version 2026-11 (Beta). Please read carefully before using Pulse.</i></p><h4>1. Eligibility and acceptance</h4><p>Pulse is available only to persons aged 18 or above who are legally competent to enter into a contract. By creating an account or using the service you accept these Terms and this Policy. If you do not agree, do not use the service.</p><h4>2. Beta service</h4><p>Pulse is a beta (testing) service. Features may change, be interrupted or be withdrawn without notice, and data may be reset. The service is provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind, to the fullest extent permitted by law.</p><h4>3. Information we process</h4><p>Account data (email address, display name, age, city, occupation, profile text, optional photo and role-specific details such as job or matrimonial attributes); content you create (posts, messages, images, CVs you choose to upload); records of consent; and, only if you enable Nearby, approximate location rounded to about 1 km. Your email address and phone number are not displayed to other members. A phone number, if you add one, is released only to a member you approve, subject to the Premium conditions in clause 6.</p><h4>4. Purposes and sharing</h4><p>We process data to operate the service, match and connect members, prevent abuse and comply with law. Profiles are visible to verified members according to the mode you choose. A CV is shared only with the recruiter of a job you apply to. AI features (Saathi, AI Mediator, Gaana Studio) transmit the text you submit to Google Gemini to generate replies; the Mediator reads a conversation only after both participants agree. Infrastructure is provided by Google Firebase. We do not sell personal data. Voice and video calls connect directly between the two members&#39; devices (peer-to-peer) and are encrypted end-to-end using the WebRTC standard (DTLS-SRTP); call audio and video never pass through or are stored on Pulse&#39;s servers, and Pulse has no feature to record a call without the visible on-screen notice and consent of both participants. No app, including Pulse, can prevent another participant from recording or photographing their own screen during a call; do not share anything in a call you would not want recorded.</p><h4>5. Conduct and enforcement</h4><p>You must not harass, threaten, defraud, impersonate, post unlawful, obscene, hateful or infringing content, solicit money, OTPs or banking details, or misuse another member data. We may remove content, restrict features or suspend accounts, including automatically flagged accounts after review. Members may block and report any account.</p><h4>6. Contact details and Premium</h4><p>Requesting another member contact number requires Premium status and the explicit approval of that member, who may revoke access at any time. Premium is activated manually by the Pulse team once payment is confirmed. Any attempt to obtain contact details by other means is prohibited.</p><h4>7. Recruitment and matrimonial notices</h4><p>Pulse does not verify employers, candidates, or matrimonial claims and is not a party to any employment, engagement or marriage arrangement. Never pay a fee to obtain a job or interview. Verify identity, credentials and family details independently and meet only in public places.</p><h4>8. Your rights</h4><p>You may edit your profile, pause visibility, turn off location, withdraw applications, revoke contact approvals and delete your account from the Me tab, which removes your profile, posts, CV and AI history. Messages sent in shared conversations may remain visible to the other participant. Requests and complaints may be made through the in-app Report function.</p><h4>9. Limitation of liability and governing law</h4><p>To the extent permitted by law, Pulse and its owner are not liable for member conduct, meetings between members, or indirect or consequential loss. These Terms are governed by the laws of India and subject to the courts of competent jurisdiction in India.</p>';
  var POLICY_HI = '<p><b>नोट:</b> यह कानूनी दस्तावेज़ अंग्रेज़ी में है और वही मान्य है। (This legal text in English is the binding version.)</p>' + POLICY_EN;
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
    box.hidden = false; box.innerHTML = '<div class="section-title">Creator Panel</div><div class="st-note">Shows reports and totals only. Private chats and who-blocked-whom are never visible, by design.</div><div id="crNew" class="cr-row" style="display:none;background:var(--grad);color:#fff;border-radius:10px;padding:8px 10px;margin-bottom:6px"></div><div id="crStats"></div><div id="crGrowth"></div><div id="crOverview"></div><div id="crList"></div><div class="st-row" style="margin-top:8px"><input class="bh-in" id="crUid" placeholder="User ID to ban / unban" style="margin:0"><button class="btn-outline" id="crBan" style="padding:0 12px">Ban</button><button class="btn-outline" id="crUnban" style="padding:0 12px">Unban</button></div>';
    // Owner ko (Facebook/Insta owner jaisa) pata chalna chahiye kitne log join kar rahe hain aur
    // kaunse mode me — ye sab sirf "count" queries hain (Firestore free quota me cheap), har document
    // padhna nahi padta.
    (function () {
      var now = new Date(), todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      var weekStart = new Date(now.getTime() - 7 * 86400000);
      var todayCut = Timestamp.fromDate(todayStart), weekCut = Timestamp.fromDate(weekStart);
      var MODES = [["friends", "Friendship"], ["dating", "Dating"], ["marriage", "Marriage"], ["jobseeker", "Job seekers"], ["recruiter", "Recruiters"]];
      var lastVisit = +localStorage.getItem("crLastVisit") || 0;
      Promise.all([
        getCountFromServer(collection(db, "users")),
        getCountFromServer(collection(db, "posts")),
        getCountFromServer(query(collection(db, "users"), where("createdAt", ">=", todayCut))),
        getCountFromServer(query(collection(db, "users"), where("createdAt", ">=", weekCut))),
        getCountFromServer(collection(db, "reports")),
        lastVisit ? getCountFromServer(query(collection(db, "users"), where("createdAt", ">=", Timestamp.fromMillis(lastVisit)))) : Promise.resolve(null),
        lastVisit ? getCountFromServer(query(collection(db, "reports"), where("createdAt", ">=", Timestamp.fromMillis(lastVisit)))) : Promise.resolve(null)
      ].concat(MODES.map(function (m) { return getCountFromServer(query(collection(db, "users"), where("mode", "==", m[0]))); }))).then(function (r) {
        $("crStats").innerHTML = '<div class="cr-row">Members: <b>' + r[0].data().count + '</b> · Naye aaj: <b>' + r[2].data().count + '</b> · Naye is hafte: <b>' + r[3].data().count + '</b> · Posts: <b>' + r[1].data().count + '</b> · Total reports: <b>' + r[4].data().count + '</b></div>';
        var modeLine = MODES.map(function (m, i) { return m[1] + ": <b>" + r[7 + i].data().count + "</b>"; }).join(" · ");
        $("crGrowth").innerHTML = '<div class="cr-row" style="color:var(--faint);font-size:12px">Mode breakdown — ' + modeLine + '</div>';
        if (lastVisit && r[5] && r[6]) {
          var nn = r[5].data().count, nr = r[6].data().count;
          if (nn || nr) { var box2 = $("crNew"); box2.style.display = ""; box2.textContent = "Pichli baar check kiya tha " + ago(lastVisit) + " pehle — tab se " + nn + " naye members aur " + nr + " naye reports aaye hain."; }
        }
        localStorage.setItem("crLastVisit", String(Date.now()));
      }).catch(function () {});
    })();
    getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(30))).then(function (s) {
      var l = $("crList"); l.innerHTML = s.empty ? '<div class="cr-row">No reports 🎉</div>' : "";
      s.forEach(function (d) { var r = d.data(); var row = el('<div class="cr-row" data-notr>Reported <b>' + esc(r.to) + '</b>: ' + esc(r.reason || "") + ' <button class="btn-outline" style="padding:4px 10px">Fill ID</button> <button class="btn-grad cb" style="padding:4px 10px">Ban</button> <button class="btn-outline cd" style="padding:4px 10px">Dismiss</button></div>'); row.querySelector("button").addEventListener("click", function () { $("crUid").value = r.to; });
        row.querySelector(".cb").addEventListener("click", function () { if (window.confirm("Ban this member? You are approving this action.")) setDoc(doc(db, "bans", r.to), { at: serverTimestamp(), by: UID, why: String(r.reason || "").slice(0, 100) }).then(function () { deleteDoc(doc(db, "reports", d.id)); row.remove(); toast("Banned"); }).catch(function (e) { toast(errMsg(e)); }); });
        row.querySelector(".cd").addEventListener("click", function () { deleteDoc(doc(db, "reports", d.id)).then(function () { row.remove(); }).catch(function (e) { toast(errMsg(e)); }); }); l.appendChild(row); });
    }).catch(function (e) { toast(errMsg(e)); });
    $("crBan").addEventListener("click", function () { var id = clean($("crUid").value, 60); if (id) setDoc(doc(db, "bans", id), { at: serverTimestamp(), by: UID }).then(function () { toast("Banned"); }).catch(function (e) { toast(errMsg(e)); }); });
    box.appendChild(el('<div class="st-row" style="margin-top:8px"><button class="btn-grad" id="crPrem" style="padding:6px 12px">Grant Premium</button><button class="btn-outline" id="crUnprem" style="padding:6px 12px;margin-left:6px">Remove Premium</button></div>'));
    $("crPrem").addEventListener("click", function () { var id = clean($("crUid").value, 60); if (id) setDoc(doc(db, "premium", id), { at: serverTimestamp(), by: UID }).then(function () { toast("Premium granted"); }).catch(function (e) { toast(errMsg(e)); }); });
    $("crUnprem").addEventListener("click", function () { var id = clean($("crUid").value, 60); if (id) deleteDoc(doc(db, "premium", id)).then(function () { toast("Premium removed"); }).catch(function (e) { toast(errMsg(e)); }); });
    $("crUnban").addEventListener("click", function () { var id = clean($("crUid").value, 60); if (id) deleteDoc(doc(db, "bans", id)).then(function () { toast("Unbanned"); }).catch(function (e) { toast(errMsg(e)); }); });
    box.appendChild(el('<div><div class="section-title" style="margin-top:14px">Identity verification requests</div><div id="crVerify" class="st-note">Loading…</div></div>'));
    getDocs(query(collection(db, "verifications"), orderBy("createdAt", "desc"), limit(20))).then(function (s) {
      var l = $("crVerify"); l.innerHTML = s.empty ? "No pending requests." : "";
      s.forEach(function (d) { var r = d.data(), row = el('<div class="cr-row" data-notr style="align-items:center;gap:10px"><div style="width:46px;height:46px;border-radius:10px;background:center/cover url(' + r.photo + ');flex:none"></div><b>' + esc(r.name || d.id) + '</b><button class="btn-grad" style="padding:4px 10px;margin-left:auto">Approve</button><button class="btn-outline" style="padding:4px 10px">Reject</button></div>');
        row.querySelectorAll("button")[0].addEventListener("click", function () { updateDoc(doc(db, "users", d.id), { verified: true, verifyPending: false }).then(function () { return deleteDoc(doc(db, "verifications", d.id)); }).then(function () { row.remove(); toast("Approved"); }).catch(function (e) { toast(errMsg(e)); }); });
        row.querySelectorAll("button")[1].addEventListener("click", function () { updateDoc(doc(db, "users", d.id), { verified: false, verifyPending: false }).then(function () { return deleteDoc(doc(db, "verifications", d.id)); }).then(function () { row.remove(); toast("Rejected"); }).catch(function (e) { toast(errMsg(e)); }); });
        l.appendChild(row); });
    }).catch(function (e) { $("crVerify").textContent = errMsg(e); });
    // Members: who joined, their mode, last-active time, Premium/Ban status — for monitoring + direct action. Admin-only (see firestore.rules).
    box.appendChild(el('<div><div class="section-title" style="margin-top:14px">Members (join date · last active · Premium/Ban)</div><input class="bh-in" id="crMemQ" placeholder="Search by name" style="margin-bottom:8px"><div id="crMembers" class="st-note">Loading…</div></div>'));
    var allMembers = [], premiumSet = {}, bannedSet = {};
    function memberRow(u) {
      var now = Date.now(), last = ms(u.lastSeen), online = last && (now - last) < 180000;
      var joined = u.createdAt ? ago(ms(u.createdAt)) : "—";
      var active = last ? (online ? "online now 🟢" : "offline since " + ago(last)) : "never active";
      var isPrem = !!premiumSet[u.id], isBanned = !!bannedSet[u.id];
      var acts = ACTIVITY_FIELDS.filter(function (f) { return +u[f.k] > 0; }).map(function (f) { return u[f.k] + " " + f.lbl; });
      var actLine = acts.length ? acts.join(" · ") : "No activity yet";
      var row = el('<div class="cr-row" data-notr style="flex-wrap:wrap;gap:4px 10px;align-items:center"><b>' + esc(u.name || "(no name)") + '</b>' + chip(u.mode || "friends") + (u.hidden ? chip("paused") : "") + (u.verified ? ' <span title="Identity verified">✔️</span>' : "") + (isPrem ? chip("⭐ Premium") : "") + (isBanned ? chip("🚫 Banned") : "") + '<span style="color:var(--faint);font-size:12px">joined ' + esc(joined) + ' · ' + esc(active) + '</span><div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap"><button class="btn-outline cm-prem" style="padding:2px 10px">' + (isPrem ? "Remove Premium" : "Grant Premium") + '</button><button class="btn-outline cm-ban" style="padding:2px 10px">' + (isBanned ? "Unban" : "Ban") + '</button></div><div style="width:100%;color:var(--faint);font-size:12px">' + esc(actLine) + '</div></div>');
      row.querySelector(".cm-prem").addEventListener("click", function () {
        var ref = doc(db, "premium", u.id);
        (isPrem ? deleteDoc(ref) : setDoc(ref, { at: serverTimestamp(), by: UID })).then(function () { if (isPrem) delete premiumSet[u.id]; else premiumSet[u.id] = true; toast(isPrem ? "Premium removed" : "Premium granted"); paintMembers(); }).catch(function (e) { toast(errMsg(e)); });
      });
      row.querySelector(".cm-ban").addEventListener("click", function () {
        if (!isBanned && !window.confirm("Ban " + (u.name || "this member") + "?")) return;
        var ref = doc(db, "bans", u.id);
        (isBanned ? deleteDoc(ref) : setDoc(ref, { at: serverTimestamp(), by: UID })).then(function () { if (isBanned) delete bannedSet[u.id]; else bannedSet[u.id] = true; toast(isBanned ? "Unbanned" : "Banned"); paintMembers(); }).catch(function (e) { toast(errMsg(e)); });
      });
      return row;
    }
    function paintMembers() {
      var q = ($("crMemQ").value || "").toLowerCase();
      var rows = allMembers.filter(function (u) { return !q || (u.name || "").toLowerCase().indexOf(q) >= 0; });
      var l = $("crMembers"); l.innerHTML = "";
      if (!rows.length) { l.appendChild(el('<div class="cr-row">No members match.</div>')); return; }
      rows.forEach(function (u) { l.appendChild(memberRow(u)); });
    }
    Promise.all([
      getDocs(query(collection(db, "users"), orderBy("createdAt", "desc"), limit(100))),
      getDocs(collection(db, "premium")).catch(function () { return { docs: [] }; }),
      getDocs(collection(db, "bans")).catch(function () { return { docs: [] }; })
    ]).then(function (r) {
      allMembers = r[0].docs.map(function (d) { return Object.assign({ id: d.id }, snapData(d)); });
      r[1].docs.forEach(function (d) { premiumSet[d.id] = true; });
      r[2].docs.forEach(function (d) { bannedSet[d.id] = true; });
      paintMembers();
      var sums = {}; ACTIVITY_FIELDS.forEach(function (f) { sums[f.k] = 0; });
      var verifiedN = 0, now = Date.now(), onlineN = 0;
      allMembers.forEach(function (u) {
        ACTIVITY_FIELDS.forEach(function (f) { sums[f.k] += +u[f.k] || 0; });
        if (u.verified) verifiedN++;
        var last = ms(u.lastSeen); if (last && now - last < 180000) onlineN++;
      });
      var line1 = "Members (last " + allMembers.length + "): Online now: <b>" + onlineN + "</b> · Premium: <b>" + Object.keys(premiumSet).length + "</b> · Verified: <b>" + verifiedN + "</b> · Banned: <b>" + Object.keys(bannedSet).length + "</b>";
      var line2 = ACTIVITY_FIELDS.map(function (f) { return f.lbl + ": <b>" + sums[f.k] + "</b>"; }).join(" · ");
      $("crOverview").innerHTML = '<div class="cr-row">' + line1 + '</div><div class="cr-row" style="margin-top:4px;color:var(--faint);font-size:12px">' + line2 + '</div>';
    }).catch(function (e) { $("crMembers").textContent = errMsg(e); });
    $("crMemQ").addEventListener("input", paintMembers);
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
    { n: "Ganesh", s: "🐘", g: "linear-gradient(180deg,#3d2a00,#c98400 55%,#ffe27a)" }, { n: "Lakshmi", s: "🪷", g: "linear-gradient(180deg,#3a0a2e,#b83280 55%,#ffc2e0)" },
    { n: "Saraswati", s: "🎻", g: "linear-gradient(180deg,#071c2e,#1a5276 55%,#cfeaff)" }, { n: "Vishnu", s: "🪔", g: "linear-gradient(180deg,#081a3a,#1a4fa0 55%,#9fc8ff)" },
    { n: "Sai Baba", s: "🕊️", g: "linear-gradient(180deg,#241400,#7a4a12 55%,#ffd98a)" }, { n: "Ayyappa", s: "🏹", g: "linear-gradient(180deg,#120e00,#5b4300 55%,#ffd34d)" }
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
    var items = b.l || $("bhOwn").value.split("\n").map(function (x) { return clean(x, 120); }).filter(Boolean).slice(0, 60), name = dham ? dham.n + " Aarti" : clean($("bhName").value, 40) || (b.l ? b.t : "Our Bhajan");
    if (!items.length) { toast("Write at least one line"); return; } if (!rate("room", 3, 60000)) return;
    var id = code6(), btn = $("bhCreate"); btn.disabled = true;
    setDoc(doc(db, "rooms", id), { name: name, title: b.l ? b.t : name, host: UID, hostName: ME.name, items: items, line: 0, dham: dham ? dham.id : "", members: [UID], flowers: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      .then(function () { enterRoom(id); bump("cRooms"); }).catch(function (e) { toast(e && e.code === "permission-denied" ? "Rooms need the latest rules (ask the creator to publish them)" : errMsg(e)); }).then(function () { btn.disabled = false; });
  }
  function joinRoom(code) {
    code = clean(code, 8).toUpperCase(); if (!code) return;
    getDoc(doc(db, "rooms", code)).then(function (s) {
      if (!s.exists()) { toast("Room not found"); return; }
      var m = s.data().members || []; if (m.indexOf(UID) >= 0) return enterRoom(code);
      if (m.length >= 12) { toast("Room is full"); return; }
      return updateDoc(doc(db, "rooms", code), { members: arrayUnion(UID), updatedAt: serverTimestamp() }).then(function () { addDoc(collection(db, "rooms", code, "msgs"), { from: UID, name: ME.name, text: "🙏 joined", createdAt: serverTimestamp() }).catch(function () {}); enterRoom(code); bump("cRooms"); });
    }).catch(function (e) { toast(e && e.code === "permission-denied" ? "Cannot join this room" : errMsg(e)); });
  }
  $("bhJoin").addEventListener("click", function () { joinRoom($("bhCode").value); });
  function theme(i) { var d = DEITY[i] || DEITY[0]; $("roomBg").style.background = d.photo ? ("linear-gradient(rgba(0,0,0,.3),rgba(0,0,0,.65)), url(\"" + d.photo + "\") center/cover") : d.g; $("bigSym").textContent = d.photo ? "" : d.s; document.querySelectorAll("#deities button").forEach(function (b, j) { b.classList.toggle("on", j === i); }); try { localStorage.setItem("pulse_deity", i); } catch (e) {} }
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
    loadDeityPhotos(DEITY, function () { theme(sv); });
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

  // ================= Modes: friends / dating / marriage / jobseeker / recruiter =================
  var MODE = "friends", FIELDS = ["IT / Software", "Civil / Construction", "Mechanical", "Electrical", "Sales & Marketing", "Finance / Accounts", "HR", "Teaching", "Healthcare", "Design / Creative", "Operations / Logistics", "Customer Support", "Government / PSU", "Other"];
  var MODE_LABEL = { friends: "Friendship", dating: "Dating", marriage: "Marriage", jobseeker: "Job seeker", recruiter: "Recruiter" };
  function modeOf(u) { return (u && u.mode) || ({ Dosti: "friends", Dating: "dating", Shaadi: "marriage" })[u && u.looking] || "friends"; }
  function isJobMode(m) { m = m || MODE; return m === "jobseeker" || m === "recruiter"; }
  function isMateMode(m) { m = m || MODE; return m === "dating" || m === "marriage"; }
  FIELDS.forEach(function (f) { $("eField").appendChild(new Option(f, f)); });
  var signMode = "friends";
  document.querySelectorAll("#modeGrid button").forEach(function (b) { b.addEventListener("click", function () { signMode = b.getAttribute("data-m"); document.querySelectorAll("#modeGrid button").forEach(function (x) { x.classList.toggle("on", x === b); }); $("aMateBox").hidden = !isMateMode(signMode); }); });
  // "I am" chunte hi "Show me" khud opposite gender pe chala jaata hai (jab tak user ne use khud na badla ho) --
  // taaki "Everyone" default rehne se gender filter bekaar na ho jaaye.
  function wireGenderDefault(genderId, seekingId) {
    var seekTouched = false;
    $(seekingId).addEventListener("change", function () { seekTouched = true; });
    $(genderId).addEventListener("change", function () {
      if (seekTouched) return;
      var v = $(genderId).value;
      $(seekingId).value = v === "Woman" ? "Men" : v === "Man" ? "Women" : "Everyone";
    });
  }
  wireGenderDefault("aGender", "aSeeking"); wireGenderDefault("eGender", "eSeeking");
  var PROF_FIELDS = { eReligion: "religion", eTongue: "tongue", eCommunity: "community", eMarital: "marital", eHeight: "height", eEdu: "edu", eDiet: "diet", eManaged: "managed", eAgeMin: "ageMin", eAgeMax: "ageMax", eField: "field", eRole: "role", eSkills: "skills", eExp: "exp", eJobType: "jobType", ePrefCity: "prefCity", eNotice: "notice", eResume: "resume", eCompany: "company", eDesig: "desig", eCAbout: "cabout", eCSite: "csite", eGender: "gender", eSeeking: "seeking" };
  var NUMF = { height: 1, ageMin: 1, ageMax: 1, exp: 1 };
  function fillProfileForm() {
    $("eMode").value = MODE; Object.keys(PROF_FIELDS).forEach(function (id) { var v = ME[PROF_FIELDS[id]]; if (v != null && v !== "") $(id).value = v; });
    $("hideToggle").classList.toggle("on", !!ME.hidden); cvPaint(); phoneLoad(); vfPaint(); sectionsFor($("eMode").value); $("eTrusted").value = ME.trustedContact || ""; renderCircle(); renderJourney();
  }
  function sectionsFor(m) { $("secMate").hidden = !isMateMode(m); $("secMarriage").hidden = m !== "marriage"; $("secSeeker").hidden = m !== "jobseeker"; $("secRecruiter").hidden = m !== "recruiter"; $("eWork").parentNode.firstChild.nodeValue = m === "recruiter" ? "Role at work" : "Occupation"; }
  $("eMode").addEventListener("change", function () { sectionsFor(this.value); });
  $("hideToggle").addEventListener("click", function () { var on = !this.classList.contains("on"); this.classList.toggle("on", on); updateDoc(doc(db, "users", UID), { hidden: on }).then(function () { ME.hidden = on; toast(on ? "Profile paused" : "Profile visible"); }).catch(function (e) { toast(errMsg(e)); }); });
  function applyMode() {
    MODE = modeOf(ME);
    var lab = { friends: "Discover", dating: "Discover", marriage: "Matches", jobseeker: "Jobs", recruiter: "Hiring" }[MODE];
    var tb = document.querySelector('.tab[data-tab="discover"]'); tb.lastChild.nodeValue = lab;
    $("moreNearby").style.display = (MODE === "friends" || MODE === "dating") ? "" : "none";
    $("mFilterBox").hidden = MODE !== "marriage"; titles.discover = lab; titles.jobs = lab;
    fillProfileForm(); paintStrength();
  }
  function seekOk(a, b) { var sk = a.seeking || "Everyone"; if (sk === "Everyone") return true; return (sk === "Women" && b.gender === "Woman") || (sk === "Men" && b.gender === "Man"); }
  var MF = {}; try { MF = JSON.parse(localStorage.getItem("pulse_mf") || "{}"); } catch (e) {}
  $("mFilterBtn").addEventListener("click", function () { $("mFilter").hidden = !$("mFilter").hidden; });
  ["fAgeMin", "fAgeMax", "fReligion", "fCity", "fMarital"].forEach(function (id) { if (MF[id]) $(id).value = MF[id]; });
  $("fApply").addEventListener("click", function () { ["fAgeMin", "fAgeMax", "fReligion", "fCity", "fMarital"].forEach(function (id) { MF[id] = $(id).value; }); try { localStorage.setItem("pulse_mf", JSON.stringify(MF)); } catch (e) {} $("mFilter").hidden = true; loadDeck(); });
  function deckOk(u) {
    if (u.hidden || modeOf(u) !== MODE) return false;
    if (isMateMode()) { if (!seekOk(ME, u) || !seekOk(u, ME)) return false; }
    if (MODE === "marriage") {
      var a = +u.age || 0, lo = +MF.fAgeMin || +ME.ageMin || 0, hi = +MF.fAgeMax || +ME.ageMax || 99;
      if (a && (a < lo || a > hi)) return false;
      if (MF.fReligion && String(u.religion || "").toLowerCase().indexOf(MF.fReligion.toLowerCase()) < 0) return false;
      if (MF.fCity && String(u.city || "").toLowerCase().indexOf(MF.fCity.toLowerCase()) < 0) return false;
      if (MF.fMarital && u.marital !== MF.fMarital) return false;
    }
    return true;
  }
  function factsFor(u) {
    if (modeOf(u) !== "marriage") return "";
    return '<div class="facts">' + [u.religion, u.tongue, u.marital, u.height ? u.height + " cm" : "", u.edu, u.diet].filter(Boolean).map(function (x) { return "<span>" + esc(x) + "</span>"; }).join("") + "</div>";
  }

  // ================= Jobs =================
  var APPS = [], appsUnsub = null, jobsTab = null, firstApps = true;
  function listenApps() {
    if (appsUnsub) { appsUnsub(); appsUnsub = null; } if (!isJobMode()) return; firstApps = true;
    var key = MODE === "recruiter" ? "rid" : "seeker";
    appsUnsub = onSnapshot(query(collection(db, "applications"), where(key, "==", UID)), function (s) {
      if (!firstApps) s.docChanges().forEach(function (ch) { var a = ch.doc.data(); if (ch.doc.metadata && ch.doc.metadata.hasPendingWrites) return;
        if (MODE === "recruiter" && ch.type === "added" && a.status === "applied") { toast("📥 New applicant: " + a.sname + " for " + a.jtitle); pushLocal("New applicant", a.sname + " · " + a.jtitle); }
        if (MODE === "jobseeker" && ch.type === "modified") { toast("📣 " + a.jtitle + ": " + a.status); pushLocal("Application update", a.jtitle + ": " + a.status); }
        if (MODE === "jobseeker" && ch.type === "added" && a.status === "invited") toast("📨 Invited to apply: " + a.jtitle); });
      firstApps = false; APPS = s.docs.map(function (d) { return Object.assign({ id: d.id }, snapData(d)); });
      $("chatDot").hidden = true; if (!$("screen-jobs").hidden) renderJobs();
    }, function (e) { toast(errMsg(e)); });
    unsubs.push(function () { if (appsUnsub) { appsUnsub(); appsUnsub = null; } });
  }
  function loadJobs() { if (!jobsTab) jobsTab = MODE === "recruiter" ? "cands" : "jobs"; renderJobs(); }
  function chip(t, c) { return '<span class="chip ' + (c || "") + '">' + esc(t) + "</span>"; }
  function stChip(st) { return chip(st, { applied: "acc", invited: "warn", shortlisted: "ok", hired: "ok", rejected: "no", declined: "no", withdrawn: "" }[st] || ""); }
  function renderJobs() {
    var box = $("jobsBox"), tabs = MODE === "recruiter" ? [["cands", "Candidates"], ["myjobs", "My jobs"], ["post", "Post job"]] : [["jobs", "Jobs"], ["saved", "Saved"], ["applied", "Applied"], ["invites", "Invites"]];
    box.innerHTML = '<div class="seg jobs-seg">' + tabs.map(function (t) { return '<button data-t="' + t[0] + '"' + (jobsTab === t[0] ? ' class="on"' : "") + ">" + t[1] + (t[0] === "invites" && APPS.filter(function (a) { return a.status === "invited"; }).length ? " •" : "") + "</button>"; }).join("") + '</div><div id="jbody"></div>';
    box.querySelectorAll(".jobs-seg button").forEach(function (b) { b.addEventListener("click", function () { jobsTab = b.getAttribute("data-t"); renderJobs(); }); });
    var f = { jobs: viewJobs, saved: viewSaved, applied: viewApplied, invites: viewInvites, cands: viewCands, myjobs: viewMyJobs, post: viewPost }[jobsTab]; f($("jbody"));
  }
  var SCAM = '<div class="scam-note">🛡️ Never pay money to get a job or interview. Real employers do not charge fees. Report any job that asks for payment.</div>';
  var SAVEKEY = "pulse_saved_jobs";
  function savedIds() { try { return JSON.parse(localStorage.getItem(SAVEKEY) || "[]"); } catch (e) { return []; } }
  function isSaved(id) { return savedIds().indexOf(id) >= 0; }
  function toggleSave(id) { var s = savedIds(), i = s.indexOf(id); if (i >= 0) s.splice(i, 1); else s.push(id); try { localStorage.setItem(SAVEKEY, JSON.stringify(s)); } catch (e) {} }
  function viewSaved(box) {
    var ids = savedIds(); box.innerHTML = '<div class="empty">Loading…</div>';
    if (!ids.length) { box.innerHTML = '<div class="empty">No saved jobs yet. Tap ☆ Save on any job to keep it here.</div>'; return; }
    getDocs(query(collection(db, "jobs"), orderBy("createdAt", "desc"), limit(50))).then(function (s) {
      var rows = s.docs.map(function (d) { return Object.assign({ id: d.id }, snapData(d)); }).filter(function (j) { return ids.indexOf(j.id) >= 0; });
      box.innerHTML = rows.length ? "" : '<div class="empty">Saved jobs are no longer available.</div>';
      rows.forEach(function (j) {
        var app = APPS.filter(function (a) { return a.jid === j.id; })[0];
        var c = el('<div class="jcard" data-notr><h4>' + esc(j.title) + '</h4><div class="jm">' + esc(j.company || j.rname) + " · " + esc(j.city || "") + '</div><div>' + chip(j.field || "Other", "acc") + '</div><div class="jrow">' + (app ? stChip(app.status) : (j.status === "closed" ? chip("Closed", "no") : '<button class="btn-grad">Apply</button>')) + '<button class="btn-outline save-b" style="margin-left:6px">Remove</button></div></div>');
        var b = c.querySelector(".btn-grad"); if (b) b.addEventListener("click", function () { applyJob(j, b); });
        c.querySelector(".save-b").addEventListener("click", function () { toggleSave(j.id); viewSaved(box); });
        box.appendChild(c);
      });
    }).catch(function (e) { toast(errMsg(e)); });
  }
  function viewJobs(box) {
    box.innerHTML = SCAM + '<div class="jfilters"><select id="jfField"><option value="">All fields</option>' + FIELDS.map(function (x) { return '<option' + (x === (ME.field || "") ? " selected" : "") + ">" + esc(x) + "</option>"; }).join("") + '</select><input id="jfCity" placeholder="City" value="' + esc(ME.prefCity || "") + '"><select id="jfType"><option value="">Any type</option><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option><option>Remote</option></select><input id="jfQ" placeholder="Search title / skill"></div><div id="jlist"><div class="empty">Loading...</div></div>';
    var jobsCache = null;
    function paint() {
      var fF = $("jfField").value, fC = $("jfCity").value.toLowerCase(), fT = $("jfType").value, q = $("jfQ").value.toLowerCase(), l = $("jlist"); l.innerHTML = "";
      var rows = (jobsCache || []).filter(function (j) { return j.status !== "closed" && !blocked.has(j.rid) && (!fF || j.field === fF) && (!fC || String(j.city || "").toLowerCase().indexOf(fC) >= 0 || /remote/i.test(j.type)) && (!fT || j.type === fT) && (!q || (j.title + " " + j.company + " " + (j.skills || "")).toLowerCase().indexOf(q) >= 0); });
      if (!rows.length) { l.innerHTML = '<div class="empty">No jobs match yet. Change the filters or check back soon.</div>'; return; }
      rows.forEach(function (j) {
        var app = APPS.filter(function (a) { return a.jid === j.id; })[0];
        var c = el('<div class="jcard" data-notr><h4>' + esc(j.title) + '</h4><div class="jm">' + esc(j.company || j.rname) + " · " + esc(j.city || "") + " · " + esc(j.type || "") + '</div><div>' + chip(j.field || "Other", "acc") + (j.exp ? chip(j.exp + "+ yrs") : chip("Fresher ok")) + (j.salary ? chip(j.salary) : "") + '</div><div class="jd">' + esc(String(j.desc || "").slice(0, 220)) + '</div><div class="jrow">' + (app ? stChip(app.status) : '<button class="btn-grad">Apply</button>') + '<button class="btn-outline save-b" style="margin-left:6px">' + (isSaved(j.id) ? "★ Saved" : "☆ Save") + '</button></div></div>');
        var b = c.querySelector(".btn-grad"); if (b) b.addEventListener("click", function () { applyJob(j, b); });
        c.querySelector(".save-b").addEventListener("click", function (e) { toggleSave(j.id); e.target.textContent = isSaved(j.id) ? "★ Saved" : "☆ Save"; });
        l.appendChild(c);
      });
    }
    getDocs(query(collection(db, "jobs"), orderBy("createdAt", "desc"), limit(50))).then(function (s) { jobsCache = s.docs.map(function (d) { return Object.assign({ id: d.id }, snapData(d)); }); paint(); }).catch(function (e) { toast(errMsg(e)); });
    ["jfField", "jfCity", "jfType", "jfQ"].forEach(function (id) { $(id).addEventListener("input", paint); });
  }
  function applyJob(j, btn) {
    if (!rate("apply", 8, 60000)) return; 
    btn.disabled = true;
    setDoc(doc(db, "applications", j.id + "_" + UID), { jid: j.id, rid: j.rid, seeker: UID, sname: ME.name, jtitle: j.title, company: j.company || j.rname || "", status: "applied", createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      .then(function () { return sendCv(j.id + "_" + UID); }).then(function () { toast(ME.cvName ? "Applied ✅ Your CV was sent" : "Applied ✅ Tip: upload a CV in the Me tab"); bump("cApps"); }).catch(function (e) { btn.disabled = false; toast(e && e.code === "permission-denied" ? "Already applied or not allowed" : errMsg(e)); });
  }
  function appCard(a, who) {
    var c = el('<div class="jcard" data-notr><h4>' + esc(who === "r" ? a.sname : a.jtitle) + '</h4><div class="jm">' + esc(who === "r" ? "Applied for " + a.jtitle : a.company) + '</div><div>' + stChip(a.status) + '</div><div class="jrow" style="margin-top:8px"></div></div>'), row = c.querySelector(".jrow");
    function btn(t, cls, f) { var b = document.createElement("button"); b.className = cls; b.textContent = t; b.addEventListener("click", f); row.appendChild(b); }
    if (who === "r") btn("📄 View CV", "btn-outline", function () { downloadCv(a.id); });
    if (a.status !== "rejected") btn("💬 Message", "btn-outline", function () { openThread(a, who); });
    return { c: c, btn: btn };
  }
  function setStatus(a, st) { return updateDoc(doc(db, "applications", a.id), { status: st, updatedAt: serverTimestamp() }).catch(function (e) { toast(errMsg(e)); }); }
  function viewApplied(box) {
    var rows = APPS.filter(function (a) { return a.status !== "invited" && a.status !== "declined"; }); box.innerHTML = rows.length ? "" : '<div class="empty">You have not applied to any job yet.</div>';
    rows.forEach(function (a) { var x = appCard(a, "s"); if (["applied", "shortlisted"].indexOf(a.status) >= 0) x.btn("Withdraw", "btn-outline", function () { setStatus(a, "withdrawn"); }); box.appendChild(x.c); });
  }
  function viewInvites(box) {
    var rows = APPS.filter(function (a) { return a.status === "invited"; }); box.innerHTML = rows.length ? "" : '<div class="empty">No invitations right now.</div>';
    rows.forEach(function (a) { var x = appCard(a, "s"); x.btn("Accept & apply", "btn-grad", function () { setStatus(a, "applied"); }); x.btn("Decline", "btn-outline", function () { setStatus(a, "declined"); }); box.appendChild(x.c); });
  }
  var MYJOBS = [];
  function viewMyJobs(box) {
    box.innerHTML = '<div class="empty">Loading...</div>';
    getDocs(query(collection(db, "jobs"), where("rid", "==", UID))).then(function (s) {
      MYJOBS = s.docs.map(function (d) { return Object.assign({ id: d.id }, snapData(d)); }).sort(function (a, b) { return ms(b.createdAt) - ms(a.createdAt); });
      box.innerHTML = MYJOBS.length ? "" : '<div class="empty">No jobs yet. Use "Post job".</div>';
      MYJOBS.forEach(function (j) {
        var mine = APPS.filter(function (a) { return a.jid === j.id; }), c = el('<div class="jcard" data-notr><h4>' + esc(j.title) + '</h4><div class="jm">' + esc(j.city || "") + " · " + esc(j.type || "") + '</div><div>' + chip(j.status === "closed" ? "Closed" : "Open", j.status === "closed" ? "no" : "ok") + chip(mine.length + " applicants", "acc") + '</div><div class="jrow" style="margin-top:8px"><button class="btn-outline" data-a="view">Applicants</button><button class="btn-outline" data-a="tog">' + (j.status === "closed" ? "Reopen" : "Close") + '</button><button class="btn-outline" data-a="del">Delete</button></div><div class="apps"></div></div>');
        c.querySelector('[data-a="tog"]').addEventListener("click", function () { updateDoc(doc(db, "jobs", j.id), { status: j.status === "closed" ? "open" : "closed", rid: UID, title: j.title }).then(function () { viewMyJobs(box); }).catch(function (e) { toast(errMsg(e)); }); });
        c.querySelector('[data-a="del"]').addEventListener("click", function () { if (window.confirm("Delete this job?")) deleteDoc(doc(db, "jobs", j.id)).then(function () { viewMyJobs(box); }).catch(function (e) { toast(errMsg(e)); }); });
        c.querySelector('[data-a="view"]').addEventListener("click", function () { var hold = c.querySelector(".apps"); hold.innerHTML = ""; if (!mine.length) hold.innerHTML = '<div class="empty" style="padding:10px">No applicants yet.</div>';
          mine.forEach(function (a) { var x = appCard(a, "r"); x.btn("Profile", "btn-outline", function () { showCandidate(a.seeker); }); if (["applied", "invited"].indexOf(a.status) >= 0 || a.status === "shortlisted") { x.btn("Shortlist", "btn-grad", function () { setStatus(a, "shortlisted"); }); x.btn("Reject", "btn-outline", function () { setStatus(a, "rejected"); }); } if (a.status === "shortlisted") x.btn("Hired ✓", "btn-outline", function () { setStatus(a, "hired"); }); hold.appendChild(x.c); }); });
        box.appendChild(c);
      });
    }).catch(function (e) { toast(errMsg(e)); });
  }
  function candCard(u) {
    return el('<div class="jcard" data-notr><h4>' + esc(u.name) + (u.age ? ", " + esc(u.age) : "") + vBadge(u) + '</h4><div class="jm">' + esc(u.role || u.work || "Job seeker") + " · " + esc(u.city || "") + '</div><div>' + chip(u.field || "Other", "acc") + (u.exp != null && u.exp !== "" ? chip(u.exp + " yrs") : chip("Fresher")) + (u.jobType ? chip(u.jobType) : "") + (u.cvName ? chip("CV on file", "ok") : "") + (u.notice ? chip("Notice: " + u.notice) : "") + '</div><div class="jd">' + esc(u.skills || "") + (u.about ? " — " + esc(String(u.about).slice(0, 160)) : "") + '</div><div class="jrow"></div></div>');
  }
  function showCandidate(uid) { getDoc(doc(db, "users", uid)).then(function (s) { if (!s.exists()) return; var u = s.data(); $("policyText").innerHTML = '<h3>' + esc(u.name) + '</h3><p>' + esc([u.role || u.work, u.city, u.field].filter(Boolean).join(" · ")) + '</p><p><b>Experience:</b> ' + esc(u.exp != null ? u.exp + " years" : "Fresher") + '<br><b>Skills:</b> ' + esc(u.skills || "-") + '<br><b>Job type:</b> ' + esc(u.jobType || "-") + '<br><b>Preferred city:</b> ' + esc(u.prefCity || "-") + '<br><b>Notice:</b> ' + esc(u.notice || "-") + '</p><p>' + esc(u.about || "") + '</p>' + (/^https?:\/\//i.test(u.resume || "") ? '<p><a href="' + esc(u.resume) + '" target="_blank" rel="noopener noreferrer">Resume link</a></p>' : ""); $("policyUI").hidden = false; }).catch(function (e) { toast(errMsg(e)); }); }
  function viewCands(box) {
    box.innerHTML = '<div class="jfilters"><select id="cfField"><option value="">All fields</option>' + FIELDS.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("") + '</select><input id="cfCity" placeholder="City"><input id="cfExp" type="number" placeholder="Min. years"><input id="cfQ" placeholder="Skill / role"></div><div id="clist"><div class="empty">Loading...</div></div>';
    var cache = null;
    function paint() {
      var f = $("cfField").value, c = $("cfCity").value.toLowerCase(), e = +$("cfExp").value || 0, q = $("cfQ").value.toLowerCase(), l = $("clist"); l.innerHTML = "";
      var rows = (cache || []).filter(function (u) { return !u.hidden && !blocked.has(u.id) && (!f || u.field === f) && (!c || (String(u.city || "") + " " + (u.prefCity || "")).toLowerCase().indexOf(c) >= 0) && (+u.exp || 0) >= e && (!q || ((u.skills || "") + " " + (u.role || "") + " " + (u.work || "")).toLowerCase().indexOf(q) >= 0); });
      if (!rows.length) { l.innerHTML = '<div class="empty">No candidates match yet. Share Pulse with job seekers!</div>'; return; }
      rows.forEach(function (u) { var cd = candCard(u), row = cd.querySelector(".jrow"), b = document.createElement("button"); b.className = "btn-grad"; b.textContent = "Invite to apply"; b.addEventListener("click", function () { inviteTo(u, b); }); row.appendChild(b); l.appendChild(cd); });
    }
    getDocs(query(collection(db, "users"), where("mode", "==", "jobseeker"), limit(60))).then(function (s) { cache = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).filter(function (u) { return u.id !== UID; }); paint(); }).catch(function (e) { toast(errMsg(e)); });
    ["cfField", "cfCity", "cfExp", "cfQ"].forEach(function (id) { $(id).addEventListener("input", paint); });
  }
  function inviteTo(u, btn) {
    getDocs(query(collection(db, "jobs"), where("rid", "==", UID))).then(function (s) {
      var open = s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).filter(function (j) { return j.status !== "closed"; });
      if (!open.length) { toast("Post a job first, then invite candidates"); return; }
      var j = open[0]; if (open.length > 1) { var n = window.prompt("Invite to which job? Type number:\n" + open.map(function (x, i) { return (i + 1) + ". " + x.title; }).join("\n"), "1"); j = open[(+n || 1) - 1]; if (!j) return; }
      if (!rate("invite", 10, 60000)) return;
      return setDoc(doc(db, "applications", j.id + "_" + u.id), { jid: j.id, rid: UID, seeker: u.id, sname: u.name, jtitle: j.title, company: j.company || ME.company || ME.name, status: "invited", createdAt: serverTimestamp(), updatedAt: serverTimestamp() }).then(function () { btn.disabled = true; btn.textContent = "Invited ✓"; });
    }).catch(function (e) { toast(e && e.code === "permission-denied" ? "Already in your list" : errMsg(e)); });
  }
  function viewPost(box) {
    box.innerHTML = SCAM + '<div class="jform"><input id="pjTitle" maxlength="80" placeholder="Job title *"><input id="pjCompany" maxlength="60" placeholder="Company" value="' + esc(ME.company || "") + '"><select id="pjField">' + FIELDS.map(function (x) { return "<option>" + esc(x) + "</option>"; }).join("") + '</select><input id="pjCity" maxlength="40" placeholder="City / Remote"><select id="pjType"><option>Full-time</option><option>Part-time</option><option>Contract</option><option>Internship</option><option>Remote</option></select><input id="pjExp" type="number" min="0" max="40" placeholder="Min. experience (years)"><input id="pjSalary" maxlength="40" placeholder="Salary range (optional)"><input id="pjSkills" maxlength="120" placeholder="Skills (comma separated)"><textarea id="pjDesc" rows="5" maxlength="1500" placeholder="Job description"></textarea><button class="btn-grad" id="pjGo" style="padding:13px">Publish job</button></div>';
    $("pjGo").addEventListener("click", function () {
      var t = clean($("pjTitle").value, 80); if (!t) { toast("Add a job title"); return; } if (!rate("pjob", 3, 60000)) return; var b = this; b.disabled = true;
      addDoc(collection(db, "jobs"), { rid: UID, rname: ME.name, company: clean($("pjCompany").value, 60), title: t, field: $("pjField").value, city: clean($("pjCity").value, 40), type: $("pjType").value, exp: +$("pjExp").value || 0, salary: clean($("pjSalary").value, 40), skills: clean($("pjSkills").value, 120), desc: clean($("pjDesc").value, 1500), status: "open", createdAt: serverTimestamp() })
        .then(function () { toast("Job published ✅"); jobsTab = "myjobs"; renderJobs(); bump("cJobs"); }).catch(function (e) { b.disabled = false; toast(errMsg(e)); });
    });
  }
  // application thread
  var TH = null;
  function openThread(a, who) {
    closeThread(); TH = { id: a.id, unsub: null }; $("thTitle").textContent = who === "r" ? a.sname : a.jtitle; $("thSub").textContent = who === "r" ? "Applied for " + a.jtitle : a.company; $("thread").hidden = false; $("thLog").innerHTML = "";
    TH.unsub = onSnapshot(query(collection(db, "applications", a.id, "msgs"), orderBy("createdAt", "asc"), limit(100)), function (s) { var l = $("thLog"); l.innerHTML = ""; s.forEach(function (d) { var m = snapData(d); l.appendChild(el('<div class="bubble ' + (m.from === UID ? "me" : "them") + '">' + esc(m.text) + '<span class="t">' + hm(ms(m.createdAt)) + '</span></div>')); }); l.scrollTop = l.scrollHeight; }, function (e) { toast(errMsg(e)); });
  }
  function closeThread() { if (TH && TH.unsub) TH.unsub(); TH = null; $("thread").hidden = true; }
  $("thClose").addEventListener("click", closeThread);
  function sendThread() { var i = $("thMsg"), t = clean(i.value, 500); if (!t || !TH || !rate("thmsg", 8, 10000)) return; i.value = ""; addDoc(collection(db, "applications", TH.id, "msgs"), { from: UID, text: t, createdAt: serverTimestamp() }).then(function () { bump("cMsgs"); }).catch(function (e) { toast(e && e.code === "permission-denied" ? "Messaging is closed for this application" : errMsg(e)); }); }
  $("thSend").addEventListener("click", sendThread); $("thMsg").addEventListener("keydown", function (e) { if (e.key === "Enter") sendThread(); });

  // ================= Safety extras =================
  $("forgotLink").addEventListener("click", function (e) { e.preventDefault(); var em = $("aUser").value.trim(); if (!em) { $("authErr").textContent = "Type your email first, then tap Forgot password."; return; } sendPasswordResetEmail(auth, em).then(function () { $("authErr").textContent = "If this email is registered, a reset link was sent."; }).catch(function (er) { $("authErr").textContent = errMsg(er); }); });
  $("blockedBtn").addEventListener("click", function () {
    var ids = Array.from(blocked); if (!ids.length) { toast("You have not blocked anyone"); return; }
    Promise.all(ids.map(function (id) { return userName(id).then(function (n) { return [id, n]; }); })).then(function (rows) {
      $("policyText").innerHTML = '<h3>Blocked people</h3>' + rows.map(function (r) { return '<div class="cr-row" data-notr>' + esc(r[1]) + ' <button class="btn-outline unb" data-id="' + esc(r[0]) + '" style="padding:4px 12px">Unblock</button></div>'; }).join(""); $("policyUI").hidden = false;
      $("policyText").querySelectorAll(".unb").forEach(function (b) { b.addEventListener("click", function () { var id = b.getAttribute("data-id"); deleteDoc(doc(db, "blocks", UID + "_" + id)).then(function () { blocked.delete(id); b.parentNode.remove(); toast("Unblocked"); }).catch(function (e) { toast(errMsg(e)); }); }); });
    });
  });


  // ================= Public profile + auto abuse flag =================
  var ABUSE = /(\bmc\b|\bbc\b|madarchod|behenchod|bhosd|randi|harami|kutta|kutiya|chutiya|\bfuck|bitch|bastard|slut|whore|\bkill you\b|maar dunga|rape|jaan se maar|suicide kar)/i;
  function autoFlag(text, where) {
    if (!ABUSE.test(text) || !rate("autoflag", 3, 600000)) return false;
    addDoc(collection(db, "reports"), { from: UID, to: UID, reason: ("AUTO: abusive words in " + where).slice(0, 190), auto: true, createdAt: serverTimestamp() }).catch(function () {});
    toast("Please keep Pulse respectful. Abusive messages can lead to a ban."); return true;
  }
  function biodataRow(label, val) { return val ? '<div class="bio-row"><span class="bio-k">' + esc(label) + '</span><span class="bio-v" data-notr>' + esc(val) + "</span></div>" : ""; }
  function marriageBiodata(u) {
    return '<div class="bio-card"><div class="bio-h">Matrimony Biodata</div>'
      + biodataRow("Age", u.age ? u.age + " yrs" : "") + biodataRow("Height", u.height ? u.height + " cm" : "")
      + biodataRow("Religion", u.religion) + biodataRow("Mother tongue", u.tongue) + biodataRow("Community", u.community)
      + biodataRow("Marital status", u.marital) + biodataRow("Education", u.edu) + biodataRow("Diet", u.diet)
      + biodataRow("City", u.city) + biodataRow("Occupation", u.work)
      + biodataRow("Looking for", [u.ageMin && u.ageMax ? u.ageMin + "–" + u.ageMax + " yrs" : "", u.seeking && u.seeking !== "Everyone" ? u.seeking : ""].filter(Boolean).join(", "))
      + "</div>";
  }
  function openProfile(uid, nm) {
    if (!uid || uid === UID && false) return;
    getDoc(doc(db, "users", uid)).then(function (s) {
      if (!s.exists()) { toast("Profile not found"); return; } var u = s.data(), m = modeOf(u);
      var rows = [u.age ? u.age + " yrs" : "", u.city, u.work, MODE_LABEL[m]].filter(Boolean).join(" · ");
      var extra = m === "marriage" ? marriageBiodata(u) : (m === "jobseeker" ? '<div class="facts">' + [u.field, u.role, u.exp != null && u.exp !== "" ? u.exp + " yrs exp" : "", u.skills].filter(Boolean).map(function (x) { return "<span>" + esc(x) + "</span>"; }).join("") + "</div>" : (m === "recruiter" ? '<div class="facts">' + [u.company, u.desig].filter(Boolean).map(function (x) { return "<span>" + esc(x) + "</span>"; }).join("") + "</div>" : ""));
      var mine = uid === UID;
      $("policyText").innerHTML = '<div class="pf-top"><div class="av-lg" style="background:' + g(uid) + '">' + esc(ini(u.name)) + '</div><h3 data-notr>' + esc(u.name) + vBadge(u) + '</h3><div class="jm" data-notr>' + esc(rows) + '</div></div>' + extra + '<p data-notr>' + esc(u.about || "") + '</p><div class="pf-priv">🔒 Email, phone and private details are never shown to other members.</div>' + (mine ? "" : '<div id="pfContactOut" class="st-note" data-notr></div><div class="jrow"><button class="btn-grad" id="pfContact">Request contact number</button><button class="btn-outline" id="pfReport">Report</button><button class="btn-outline" id="pfBlock">Block</button></div>');
      $("policyUI").hidden = false;
      if (!mine) {
        $("pfContact").addEventListener("click", function () { requestContact(uid, $("pfContactOut")); });
        $("pfReport").addEventListener("click", function () { var r = window.prompt("Why are you reporting? (short)", "Abuse / fake / spam"); if (r === null) return; addDoc(collection(db, "reports"), { from: UID, to: uid, reason: clean(r, 180) || "Profile report", createdAt: serverTimestamp() }).then(function () { toast("Report sent. Thank you."); $("policyUI").hidden = true; }).catch(function (e) { toast(errMsg(e)); }); });
        $("pfBlock").addEventListener("click", function () { if (!window.confirm("Block this person?")) return; setDoc(doc(db, "blocks", UID + "_" + uid), { blocker: UID, blocked: uid, createdAt: serverTimestamp() }).then(function () { blocked.add(uid); toast("Blocked"); $("policyUI").hidden = true; }).catch(function (e) { toast(errMsg(e)); }); });
      }
    }).catch(function (e) { toast(errMsg(e)); });
  }
  $("convoName").style.cursor = $("convoAv").style.cursor = "pointer";
  [$("convoName"), $("convoAv")].forEach(function (n) { n.addEventListener("click", function () { if (activeChat && !activeChat.ai) openProfile(activeChat.id); }); });
  document.addEventListener("click", function (e) { var t = e.target.closest && e.target.closest("[data-uid]"); if (t && UID) openProfile(t.getAttribute("data-uid")); });


  // ================= Profile strength + invite =================
  function profStrength() {
    var m = MODE, keys = ["name", "age", "city", "about", "photo"].concat(m === "marriage" ? ["religion", "marital", "edu", "height", "diet"] : m === "jobseeker" ? ["field", "skills", "exp", "role", "prefCity"] : m === "recruiter" ? ["company", "desig", "cabout"] : ["work"]);
    var n = keys.filter(function (k) { return ME[k] != null && ME[k] !== ""; }).length; return Math.round(n * 100 / keys.length);
  }
  function paintStrength() {
    var anchor = $("pHandle"); if (!anchor) return; var b = $("pStrength");
    if (!b) { b = el('<div id="pStrength" class="pf-priv" style="margin:10px 0"></div>'); anchor.parentNode.insertBefore(b, anchor.nextSibling); }
    var v = profStrength(); b.innerHTML = '<b>Profile strength: ' + v + '%</b><div style="height:6px;border-radius:6px;background:rgba(255,255,255,.12);margin:6px 0"><div style="height:6px;border-radius:6px;width:' + v + '%;background:linear-gradient(90deg,#ff5fa2,#ffb86c)"></div></div>' + (v < 100 ? '<span>Complete your profile in the Edit section to get more matches' + (isJobMode() ? " and responses" : "") + ".</span>" : "<span>Great — your profile is complete ✅</span>") + '';
  }

  // ================= CV upload, contact permission, premium gate =================
  var CVMAX = 600 * 1024, CVOK = /\.(pdf|doc|docx)$/i;
  function fileB64(f) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(",")[1] || ""); }; r.onerror = rej; r.readAsDataURL(f); }); }
  function cvPaint() { $("cvStatus").textContent = ME && ME.cvName ? "Uploaded: " + ME.cvName : "No CV uploaded."; $("cvRemove").hidden = !(ME && ME.cvName); }
  $("cvFile").addEventListener("change", function () {
    var f = this.files && this.files[0]; this.value = ""; if (!f) return;
    if (!CVOK.test(f.name)) { toast("Please choose a PDF or Word file"); return; }
    if (f.size > CVMAX) { toast("File is too large. Maximum 600 KB"); return; }
    if (!rate("cv", 5, 60000)) return;
    fileB64(f).then(function (b64) { return setDoc(doc(db, "resumes", UID), { name: clean(f.name, 100), type: f.type || "application/octet-stream", size: f.size, data: b64, updatedAt: serverTimestamp() }); })
      .then(function () { return updateDoc(doc(db, "users", UID), { cvName: clean(f.name, 100) }); })
      .then(function () { ME.cvName = clean(f.name, 100); cvPaint(); toast("CV uploaded ✅"); }).catch(function (e) { toast(errMsg(e)); });
  });
  $("cvRemove").addEventListener("click", function () { if (!window.confirm("Remove your CV?")) return; deleteDoc(doc(db, "resumes", UID)).then(function () { return updateDoc(doc(db, "users", UID), { cvName: "" }); }).then(function () { ME.cvName = ""; cvPaint(); toast("CV removed"); }).catch(function (e) { toast(errMsg(e)); }); });
  function sendCv(aid) { return getDoc(doc(db, "resumes", UID)).then(function (d) { if (d.exists()) return setDoc(doc(db, "applications", aid, "cv", "main"), d.data()); }).catch(function () {}); }
  function downloadCv(aid) {
    getDoc(doc(db, "applications", aid, "cv", "main")).then(function (d) {
      if (!d.exists()) { toast("No CV attached to this application"); return; } var c = d.data(), bin = atob(c.data), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([arr], { type: c.type })); a.download = c.name || "cv"; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }).catch(function (e) { toast(errMsg(e)); });
  }
  // contact number
  var PHONE_RE = /^\+?\d{10,15}$/;
  function phoneLoad() { getDoc(doc(db, "contacts", UID)).then(function (d) { $("ePhone").value = d.exists() ? d.data().phone : ""; }).catch(function () {}); }
  $("phoneSave").addEventListener("click", function () {
    var v = $("ePhone").value.replace(/[\s-]/g, ""); if (!v) { deleteDoc(doc(db, "contacts", UID)).then(function () { toast("Number removed"); }).catch(function (e) { toast(errMsg(e)); }); return; }
    if (!PHONE_RE.test(v)) { toast("Enter a valid phone number"); return; }
    setDoc(doc(db, "contacts", UID), { phone: v, updatedAt: serverTimestamp() }).then(function () { toast("Number saved. It is shared only with members you approve."); }).catch(function (e) { toast(errMsg(e)); });
  });

  // ---- Silent Panic Signal: hold the shield 2s to silently send trusted contact a location alert ----
  $("trustedSave").addEventListener("click", function () {
    var v = $("eTrusted").value.replace(/[\s-]/g, "");
    if (!v) { updateDoc(doc(db, "users", UID), { trustedContact: "" }).then(function () { ME.trustedContact = ""; toast("Trusted contact removed"); }).catch(function (e) { toast(errMsg(e)); }); return; }
    if (!PHONE_RE.test(v)) { toast("Enter a valid phone number"); return; }
    updateDoc(doc(db, "users", UID), { trustedContact: v }).then(function () { ME.trustedContact = v; toast("Trusted contact saved 🛡"); }).catch(function (e) { toast(errMsg(e)); });
  });
  // ---- Safety Circle: trusted friends see a quick safe/check-in status from each other, never location ----
  function setCircleStatus(s) {
    updateDoc(doc(db, "users", UID), { safetyStatus: s, safetyStatusAt: serverTimestamp() }).then(function () { ME.safetyStatus = s; ME.safetyStatusAt = { toMillis: function () { return Date.now(); } }; toast(s === "safe" ? "Status: Safe ✅" : "Status: Check-in chahiye 🔶"); renderCircle(); }).catch(function (e) { toast(errMsg(e)); });
  }
  $("circleSafe") && $("circleSafe").addEventListener("click", function () { setCircleStatus("safe"); });
  $("circleCheckin") && $("circleCheckin").addEventListener("click", function () { setCircleStatus("checkin"); });
  function renderCircle() {
    var box = $("circleList"); if (!box || !ME) return;
    $("circleSafe").classList.toggle("on", ME.safetyStatus === "safe"); $("circleCheckin").classList.toggle("on", ME.safetyStatus === "checkin");
    var mine = ME.circleMembers || [];
    if (!mine.length) { box.innerHTML = '<div class="st-note">Abhi koi Safety Circle member nahi. Kisi match ke chat me Block/Report menu se "Safety Circle me jodo" dabao.</div>'; return; }
    box.innerHTML = '<div class="st-note">Load ho raha hai...</div>';
    Promise.all(mine.map(function (uid) { return getDoc(doc(db, "users", uid)).catch(function () { return null; }); })).then(function (docs) {
      var rows = [];
      docs.forEach(function (d, i) {
        if (!d || !d.exists || !d.exists()) return; var u = d.data();
        if (!(u.circleMembers || []).includes(UID)) return; // mutual tabhi dikhega
        var st = u.safetyStatus === "safe" ? "safe" : u.safetyStatus === "checkin" ? "checkin" : "unknown";
        rows.push('<div class="circle-row"><span>' + esc(u.name || "...") + '</span><span class="st ' + st + '">' + (st === "safe" ? "✅ Safe" : st === "checkin" ? "🔶 Check-in" : "— ") + '</span></div>');
      });
      box.innerHTML = rows.length ? rows.join("") : '<div class="st-note">Abhi koi mutual Safety Circle member nahi — unhe bhi tumhe jodna hoga.</div>';
    }).catch(function () { box.innerHTML = '<div class="st-note">Load nahi ho paya.</div>'; });
  }
  (function () {
    var fab = $("sosFab"), cancelBar = $("sosCancel"), countEl = $("sosCount"), armTimer = null, holdTimer = null, counting = 0, countTimer = null;
    function clearArm() { clearTimeout(holdTimer); fab.classList.remove("arming"); }
    function startHold(e) { if (e.cancelable) e.preventDefault(); holdTimer = setTimeout(arm, 2000); fab.classList.add("arming"); }
    function cancelHold() { clearArm(); }
    function arm() {
      fab.classList.remove("arming");
      if (!ME.trustedContact) { toast("Set a trusted contact in Settings first 🛡"); return; }
      counting = 3; countEl.textContent = counting; cancelBar.classList.add("show");
      countTimer = setInterval(function () {
        counting--; if (counting <= 0) { clearInterval(countTimer); cancelBar.classList.remove("show"); sendSos(); return; }
        countEl.textContent = counting;
      }, 1000);
    }
    $("sosCancelBtn").addEventListener("click", function () { clearInterval(countTimer); cancelBar.classList.remove("show"); toast("Safety alert cancelled"); });
    fab.addEventListener("pointerdown", startHold); fab.addEventListener("pointerup", cancelHold); fab.addEventListener("pointerleave", cancelHold); fab.addEventListener("pointercancel", cancelHold);
    fab.addEventListener("contextmenu", function (e) { e.preventDefault(); });
  })();
  function sendSos(note) {
    var sendAt = Date.now();
    function go(lat, lng) {
      var mapsLink = lat != null ? ("https://maps.google.com/?q=" + lat + "," + lng) : "location unavailable";
      var msg = "🚨 Safety alert from " + ME.name + " via Pulse" + (note ? " — " + note : "") + ". Last known location: " + mapsLink + ". Time: " + new Date(sendAt).toLocaleString() + ". Please check on me.";
      addDoc(collection(db, "sos"), { uid: UID, name: ME.name, lat: lat || null, lng: lng || null, trustedContact: ME.trustedContact || "", at: serverTimestamp() }).catch(function () {});
      var wa = "https://wa.me/" + (ME.trustedContact || "").replace(/^\+/, "") + "?text=" + encodeURIComponent(msg);
      var win = window.open(wa, "_blank");
      if (!win) { if (navigator.clipboard) navigator.clipboard.writeText(msg).then(function () { toast("Safety message copied — send it manually if the link didn't open"); }); }
    }
    getPos(function (lat, lng) { go(lat, lng); }, function () { go(null, null); });
  }
  var reqUnsub = null, firstReq = true;
  function listenReqs() {
    if (reqUnsub) { reqUnsub(); reqUnsub = null; } firstReq = true;
    reqUnsub = onSnapshot(query(collection(db, "contactReqs"), where("owner", "==", UID)), function (s) {
      var box = $("reqBox"); box.innerHTML = s.empty ? "None." : "";
      if (!firstReq) s.docChanges().forEach(function (ch) { if (ch.type === "added" && !ch.doc.metadata.hasPendingWrites) toast("📞 " + (ch.doc.data().name || "A member") + " requested your contact number"); }); firstReq = false;
      s.forEach(function (d) { var r = d.data(), row = el('<div class="cr-row" data-notr><b>' + esc(r.name || "Member") + '</b> · ' + esc(r.status) + ' <span class="rq"></span></div>'), hold = row.querySelector(".rq");
        function b(t, st, cls) { var x = document.createElement("button"); x.className = cls; x.style.cssText = "padding:4px 10px;margin-left:6px"; x.textContent = t; x.addEventListener("click", function () { updateDoc(doc(db, "contactReqs", d.id), { status: st, updatedAt: serverTimestamp() }).catch(function (e) { toast(errMsg(e)); }); }); hold.appendChild(x); }
        if (r.status !== "approved") b("Approve", "approved", "btn-grad"); if (r.status !== "denied") b(r.status === "approved" ? "Revoke" : "Deny", "denied", "btn-outline"); box.appendChild(row); });
    }, function () {});
    unsubs.push(function () { if (reqUnsub) { reqUnsub(); reqUnsub = null; } });
  }
  function requestContact(uid, out) {
    var id = uid + "_" + UID;
    getDoc(doc(db, "contactReqs", id)).then(function (d) {
      if (d.exists()) {
        var st = d.data().status;
        if (st === "approved") return getDoc(doc(db, "contacts", uid)).then(function (c) { out.textContent = c.exists() ? "Contact number: " + c.data().phone : "This member has not added a number."; });
        out.textContent = st === "pending" ? "Request sent. Waiting for the member to respond." : "The member has declined this request."; return;
      }
      return getDoc(doc(db, "premium", UID)).then(function (p) {
        if (!p.exists()) { out.textContent = "Contact requests are a Premium feature. Premium is activated by the Pulse team after payment is confirmed."; return; }
        if (!rate("creq", 5, 60000)) return;
        return setDoc(doc(db, "contactReqs", id), { owner: uid, requester: UID, name: ME.name, status: "pending", createdAt: serverTimestamp(), updatedAt: serverTimestamp() }).then(function () { out.textContent = "Request sent. The member must approve before the number is released."; });
      });
    }).catch(function (e) { out.textContent = errMsg(e); });
  }
  window.addEventListener("error", function (e) { if (e && e.message && !/ResizeObserver|Script error/.test(e.message)) toast("Something went wrong: " + String(e.message).slice(0, 80)); });
  window.addEventListener("unhandledrejection", function (e) { var r = e && e.reason; if (r && r.code === "permission-denied") return; toast("Something went wrong: " + String((r && r.message) || r || "").slice(0, 80)); });

  // ================= Identity verification (opt-in selfie, reviewed by the Pulse safety team) =================
  function vfPaint() {
    var d = $("vfDesc"), b = $("vfBtn");
    if (ME && ME.verified) { d.textContent = "Verified — your badge is shown to other members. The photo itself is never shown to anyone."; b.textContent = "Re-verify"; }
    else if (ME && ME.verifyPending) { d.textContent = "Submitted — waiting for our safety team to review. This can take a little time."; b.textContent = "Resubmit"; }
    else { d.textContent = "Take a quick selfie so our safety team can confirm you are a real person. Shown to members only as a verified badge — the photo itself is never shown to other members."; b.textContent = "Verify"; }
  }
  $("vfBtn").addEventListener("click", function () { $("vfInput").click(); });
  $("vfInput").addEventListener("change", function () {
    var f = this.files && this.files[0]; this.value = ""; if (!f) return;
    if (!rate("verify", 3, 60000)) return;
    shrink(f, 480, 0.75).then(function (data) {
      if (!window.confirm("Submit this selfie for identity verification? Only our safety team reviews it to confirm you are a real person — it is never shown to other members or used for anything else. Continue?")) return;
      return setDoc(doc(db, "verifications", UID), { photo: data, name: ME.name, status: "pending", createdAt: serverTimestamp() })
        .then(function () { return updateDoc(doc(db, "users", UID), { verifyPending: true, verified: false }); })
        .then(function () { ME.verifyPending = true; ME.verified = false; vfPaint(); toast("Submitted for review"); });
    }).catch(function (e) { toast(errMsg(e)); });
  });
  function vBadge(u) { return u && u.verified ? ' <span title="Identity verified" style="color:#2dbd6e">✔️</span>' : ""; }

  // ---- boot ----
  initI18n(); setMode("login");
  // Pick up new versions by itself: if a newer build is published, reload (never during a call).
  (function () {
    var me = (document.querySelector('script[src*="app.js"]') || {}).src || "", mv = /v=([a-z0-9]+)/.exec(me); if (!mv) return;
    function chk() { if (CALL) return; fetch("index.html", { cache: "no-store" }).then(function (r) { return r.text(); }).then(function (t) { var m = /app\.js\?v=([a-z0-9]+)/.exec(t); if (m && m[1] !== mv[1] && !CALL) location.reload(); }).catch(function () {}); }
    setInterval(chk, 90000); document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") chk(); });
  })();
  // The Firebase web config is public by design (it only names the project; Firestore rules protect the data), so a copy
  // is built in. It is used if the file cannot be fetched (slow/blocked network, stale cache) so login never breaks.
  var BUILTIN_CFG = { apiKey: "AIzaSyB2mlyUACsp38Gal7TsUFbet42y3EEh0EE", authDomain: "pulse-704e7.firebaseapp.com", projectId: "pulse-704e7", storageBucket: "pulse-704e7.firebasestorage.app", messagingSenderId: "985338252699", appId: "1:985338252699:web:b001a501828594d81a653e" };
  window.__pulseBoot = Promise.race([fetch("firebase-config.json", { cache: "no-store" }).then(function (r) { return r.json(); }), new Promise(function (res) { setTimeout(function () { res(null); }, 3000); })]).catch(function () { return null; }).then(function (cfg) {
    if (!cfg || !cfg.apiKey || /PASTE|YOUR/i.test(cfg.apiKey)) cfg = BUILTIN_CFG;
    try { init(cfg); } catch (e) { $("authErr").textContent = "Could not start the app: " + (e && e.message ? e.message : e); }
  });
})();
