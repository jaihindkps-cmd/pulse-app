// Owner-only moderation page. Everything here is enforced by Firestore rules (isAdmin); this page is just a viewer.
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, query, orderBy, limit, getDocs, setDoc, doc, deleteDoc, serverTimestamp } from "firebase/firestore";

var root = document.getElementById("root");
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
fetch("/firebase-config.json").then(function (r) { return r.json(); }).then(function (cfg) {
  var app = initializeApp(cfg), auth = getAuth(app), db = getFirestore(app);
  onAuthStateChanged(auth, function (u) {
    if (!u) { root.innerHTML = '<button id="in">Sign in with Google</button>'; document.getElementById("in").onclick = function () { signInWithPopup(auth, new GoogleAuthProvider()).catch(function (e) { alert(e.message); }); }; return; }
    load();
  });
  function load() {
    root.innerHTML = "Loading…";
    getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc"), limit(50))).then(function (s) {
      if (s.empty) { root.innerHTML = "<p>No reports.</p>" + out(); bind(); return; }
      root.innerHTML = out() + s.docs.map(function (d) {
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
    root.querySelectorAll("[data-del]").forEach(function (b) { b.onclick = function () { deleteDoc(doc(db, "reports", b.dataset.del)).then(load).catch(function (e) { alert(e.message); }); }; });
  }
});
