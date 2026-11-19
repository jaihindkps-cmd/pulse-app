// Owner-only moderation page. Everything here is enforced by Firestore rules (isAdmin); this page is just a viewer.
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, query, orderBy, limit, getDocs, getDoc, setDoc, doc, deleteDoc, serverTimestamp } from "firebase/firestore";

var root = document.getElementById("root");
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
fetch("/firebase-config.json").then(function (r) { return r.json(); }).then(function (cfg) {
  var app = initializeApp(cfg), auth = getAuth(app), db = getFirestore(app);
  onAuthStateChanged(auth, function (u) {
    if (!u) { root.innerHTML = '<button id="in">Sign in with Google</button>'; document.getElementById("in").onclick = function () { signInWithPopup(auth, new GoogleAuthProvider()).catch(function (e) { alert(e.message); }); }; return; }
    load();
  });
  var tab = "reports";
  function tabs() { return '<p><button data-tab="reports">Reports</button> <button data-tab="devices">Devices</button></p>'; }
  function loadDevices() {
    root.innerHTML = "Loading…";
    getDocs(query(collection(db, "devices"), orderBy("last", "desc"), limit(100))).then(function (s) {
      return Promise.all(s.docs.map(function (d) { var r = d.data(); return getDoc(doc(db, "users", r.uid || "x")).then(function (u) { return { id: d.id, r: r, name: u.exists() ? (u.data().name || "") : "" }; }, function () { return { id: d.id, r: r, name: "" }; }); }));
    }).then(function (rows) {
      root.innerHTML = out() + tabs() + "<p>" + rows.length + " devices</p>" + rows.map(function (x) {
        var r = x.r, t = r.last && r.last.toDate ? r.last.toDate().toLocaleString() : "";
        return '<div class="c"><b>' + esc(x.name || "(no name)") + '</b> <small>' + esc(r.app) + " v" + esc(r.ver) + " · " + esc(r.tz) + " · " + esc(r.lang) + '</small><br><small>last seen ' + esc(t) + '</small><br><small>user <code>' + esc(r.uid) + '</code></small><br><small>' + esc(r.ua) + '</small><br>' +
          ["lock", "wipe", "remove", "allow"].map(function (a) { return '<button data-cmd="' + a + '" data-dev="' + x.id + '">' + ({ lock: "Lock", wipe: "Wipe data", remove: "Remove app", allow: "Unlock" })[a] + '</button>'; }).join(" ") + '</div>';
      }).join("");
      bind();
    }).catch(function () { root.innerHTML = "<p>Not allowed. Sign in with the owner account.</p>" + out(); bind(); });
  }
  function load() {
    if (tab === "devices") return loadDevices();
    root.innerHTML = "Loading…";
    getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(50))).then(function (s) {
      if (s.empty) { root.innerHTML = out() + tabs() + "<p>No reports.</p>"; bind(); return; }
      root.innerHTML = out() + tabs() + s.docs.map(function (d) {
        var r = d.data();
        return '<div class="c"><b>' + esc(r.reason) + '</b> <small>' + esc(r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toLocaleString() : "") + '</small><br>against: <code>' + esc(r.against || r.target || "?") + '</code><pre>' + esc(r.log || "") + '</pre><button data-ban="' + esc(r.against || "") + '">Ban user</button> <button data-del="' + d.id + '">Dismiss</button></div>';
      }).join("");
      bind();
    }).catch(function () { root.innerHTML = "<p>Not allowed. Sign in with the owner account.</p>" + out(); bind(); });
  }
  function out() { return '<p><button id="so">Sign out</button></p>'; }
  function bind() {
    var so = document.getElementById("so"); if (so) so.onclick = function () { signOut(auth); };
    root.querySelectorAll("[data-ban]").forEach(function (b) { b.onclick = function () { var u = b.dataset.ban; if (!u || !confirm("Ban " + u + "?")) return; setDoc(doc(db, "bans", u), { at: serverTimestamp() }).then(function () { b.textContent = "Banned"; b.disabled = true; }).catch(function (e) { alert(e.message); }); }; });
    root.querySelectorAll("[data-tab]").forEach(function (b) { b.onclick = function () { tab = b.dataset.tab; load(); }; });
    root.querySelectorAll("[data-cmd]").forEach(function (b) { b.onclick = function () { var a = b.dataset.cmd, d = b.dataset.dev; var msg = { lock: "Lock Pulse on this device?", wipe: "Erase Pulse data on this device and sign it out?", remove: "Erase data and ask Android to uninstall Pulse (the user still taps OK)?", allow: "Unlock this device?" }[a]; if (!confirm(msg)) return; setDoc(doc(db, "deviceCmd", d), { action: a, n: Math.random().toString(36).slice(2) + Date.now().toString(36), t: serverTimestamp() }).then(function () { b.textContent = "Sent ✓"; }).catch(function (e) { alert(e.message); }); }; });
    root.querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () { deleteDoc(doc(db, "reports", b.dataset.del)).then(load).catch(function (e) { alert(e.message); }); }; });
  }
});
