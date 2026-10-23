// Pulse backend: Express + WebSocket + SQLite. Run: node server.js
const express = require("express");
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "pulse.db");
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex"); // set JWT_SECRET in production
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || ""; // optional: real AI for Saathi

const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, pass TEXT NOT NULL,
  age INTEGER, city TEXT, work TEXT, about TEXT, looking TEXT DEFAULT 'Dosti',
  share_loc INTEGER DEFAULT 0, lat REAL, lng REAL, loc_at INTEGER, created INTEGER
);
CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY, uid INTEGER NOT NULL, text TEXT NOT NULL, created INTEGER);
CREATE TABLE IF NOT EXISTS likes (pid INTEGER, uid INTEGER, PRIMARY KEY (pid, uid));
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, a INTEGER NOT NULL, b INTEGER NOT NULL, text TEXT NOT NULL, created INTEGER);
CREATE TABLE IF NOT EXISTS swipes (frm INTEGER, too INTEGER, kind TEXT, PRIMARY KEY (frm, too));
CREATE TABLE IF NOT EXISTS matches (a INTEGER, b INTEGER, created INTEGER, PRIMARY KEY (a, b));
CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY, frm INTEGER, too INTEGER, reason TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS blocks (frm INTEGER, too INTEGER, PRIMARY KEY (frm, too));
CREATE TABLE IF NOT EXISTS ai_msgs (id INTEGER PRIMARY KEY, uid INTEGER, role TEXT, text TEXT, created INTEGER);
CREATE INDEX IF NOT EXISTS msg_ab ON messages(a, b);
`);

const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

const now = () => Date.now();
const clean = (s, n) => String(s == null ? "" : s).trim().slice(0, n);
const pair = (x, y) => (x < y ? [x, y] : [y, x]);

// ---- simple rate limiter (per ip+route) ----
const hits = new Map();
function limit(max, windowMs) {
  return (req, res, next) => {
    const k = req.ip + req.path, t = now(), arr = (hits.get(k) || []).filter((x) => t - x < windowMs);
    if (arr.length >= max) return res.status(429).json({ error: "Bahut zyada koshish. Thodi der baad try karo." });
    arr.push(t); hits.set(k, arr); next();
  };
}
setInterval(() => { const t = now(); for (const [k, v] of hits) if (!v.some((x) => t - x < 3600e3)) hits.delete(k); }, 600e3).unref();

// ---- auth ----
function publicUser(u, extra) {
  return Object.assign({ id: u.id, username: u.username, name: u.name, age: u.age, city: u.city, work: u.work, about: u.about, looking: u.looking }, extra || {});
}
function auth(req, res, next) {
  try {
    const t = (req.headers.authorization || "").replace("Bearer ", "");
    const p = jwt.verify(t, SECRET);
    const u = db.prepare("SELECT * FROM users WHERE id=?").get(p.id);
    if (!u) throw 0;
    req.user = u; next();
  } catch (e) { res.status(401).json({ error: "Login karo" }); }
}
const token = (u) => jwt.sign({ id: u.id }, SECRET, { expiresIn: "30d" });

app.post("/api/signup", limit(10, 3600e3), (req, res) => {
  const username = clean(req.body.username, 24).toLowerCase(), name = clean(req.body.name, 40), pw = String(req.body.password || "");
  const age = parseInt(req.body.age, 10);
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return res.status(400).json({ error: "Username 3-24 akshar: a-z, 0-9, _" });
  if (!name) return res.status(400).json({ error: "Naam likho" });
  if (pw.length < 6) return res.status(400).json({ error: "Password kam se kam 6 akshar" });
  if (!(age >= 18 && age <= 99)) return res.status(400).json({ error: "Ye app sirf 18+ ke liye hai" });
  if (db.prepare("SELECT 1 FROM users WHERE username=?").get(username)) return res.status(409).json({ error: "Ye username le liya gaya hai" });
  const r = db.prepare("INSERT INTO users (username,name,pass,age,city,work,about,looking,created) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(username, name, bcrypt.hashSync(pw, 10), age, clean(req.body.city, 40), clean(req.body.work, 60), clean(req.body.about, 300), clean(req.body.looking, 20) || "Dosti", now());
  const u = db.prepare("SELECT * FROM users WHERE id=?").get(r.lastInsertRowid);
  res.json({ token: token(u), user: publicUser(u) });
});
app.post("/api/login", limit(20, 600e3), (req, res) => {
  const u = db.prepare("SELECT * FROM users WHERE username=?").get(clean(req.body.username, 24).toLowerCase());
  if (!u || !bcrypt.compareSync(String(req.body.password || ""), u.pass)) return res.status(401).json({ error: "Username ya password galat" });
  res.json({ token: token(u), user: publicUser(u) });
});
app.get("/api/me", auth, (req, res) => res.json({ user: publicUser(req.user, { share_loc: !!req.user.share_loc }) }));
app.put("/api/me", auth, (req, res) => {
  const b = req.body;
  db.prepare("UPDATE users SET name=?, city=?, work=?, about=?, looking=? WHERE id=?")
    .run(clean(b.name, 40) || req.user.name, clean(b.city, 40), clean(b.work, 60), clean(b.about, 300), clean(b.looking, 20) || "Dosti", req.user.id);
  res.json({ ok: true });
});

// ---- feed ----
app.get("/api/posts", auth, (req, res) => {
  const rows = db.prepare(`SELECT p.id,p.text,p.created,u.id uid,u.name,u.username,
    (SELECT COUNT(*) FROM likes WHERE pid=p.id) likes,
    EXISTS(SELECT 1 FROM likes WHERE pid=p.id AND uid=?) liked
    FROM posts p JOIN users u ON u.id=p.uid
    WHERE p.uid NOT IN (SELECT too FROM blocks WHERE frm=?) AND p.uid NOT IN (SELECT frm FROM blocks WHERE too=?)
    ORDER BY p.id DESC LIMIT 50`).all(req.user.id, req.user.id, req.user.id);
  res.json({ posts: rows.map((r) => Object.assign(r, { liked: !!r.liked })) });
});
app.post("/api/posts", auth, limit(30, 600e3), (req, res) => {
  const text = clean(req.body.text, 500);
  if (!text) return res.status(400).json({ error: "Kuch likho" });
  db.prepare("INSERT INTO posts (uid,text,created) VALUES (?,?,?)").run(req.user.id, text, now());
  res.json({ ok: true });
});
app.post("/api/posts/:id/like", auth, (req, res) => {
  const id = +req.params.id;
  const has = db.prepare("SELECT 1 FROM likes WHERE pid=? AND uid=?").get(id, req.user.id);
  if (has) db.prepare("DELETE FROM likes WHERE pid=? AND uid=?").run(id, req.user.id);
  else db.prepare("INSERT OR IGNORE INTO likes VALUES (?,?)").run(id, req.user.id);
  res.json({ liked: !has, likes: db.prepare("SELECT COUNT(*) c FROM likes WHERE pid=?").get(id).c });
});

// ---- discover / match ----
app.get("/api/discover", auth, (req, res) => {
  const me = req.user.id;
  const rows = db.prepare(`SELECT id,name,username,age,city,work,about,looking FROM users
    WHERE id!=? AND id NOT IN (SELECT too FROM swipes WHERE frm=?)
    AND id NOT IN (SELECT too FROM blocks WHERE frm=?) AND id NOT IN (SELECT frm FROM blocks WHERE too=?)
    ORDER BY RANDOM() LIMIT 20`).all(me, me, me, me);
  res.json({ users: rows });
});
app.post("/api/swipe", auth, (req, res) => {
  const too = +req.body.to, kind = req.body.kind === "pass" ? "pass" : "like";
  if (!too || too === req.user.id || !db.prepare("SELECT 1 FROM users WHERE id=?").get(too)) return res.status(400).json({ error: "Galat user" });
  db.prepare("INSERT OR REPLACE INTO swipes VALUES (?,?,?)").run(req.user.id, too, kind);
  let matched = false;
  if (kind === "like" && db.prepare("SELECT 1 FROM swipes WHERE frm=? AND too=? AND kind='like'").get(too, req.user.id)) {
    const [a, b] = pair(req.user.id, too);
    db.prepare("INSERT OR IGNORE INTO matches VALUES (?,?,?)").run(a, b, now());
    matched = true;
    push(too, { type: "match", with: publicUser(req.user) });
  }
  res.json({ matched });
});

// ---- nearby (opt-in only) ----
function km(a, b, c, d) {
  const R = 6371, rad = Math.PI / 180, dLat = (c - a) * rad, dLng = (d - b) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
app.post("/api/location", auth, (req, res) => {
  if (req.body.share === false) {
    db.prepare("UPDATE users SET share_loc=0, lat=NULL, lng=NULL, loc_at=NULL WHERE id=?").run(req.user.id);
    return res.json({ ok: true, share: false });
  }
  const lat = +req.body.lat, lng = +req.body.lng;
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) return res.status(400).json({ error: "Galat location" });
  db.prepare("UPDATE users SET share_loc=1, lat=?, lng=?, loc_at=? WHERE id=?").run(lat, lng, now(), req.user.id);
  res.json({ ok: true, share: true });
});
app.get("/api/nearby", auth, (req, res) => {
  const me = req.user;
  if (!me.share_loc || me.lat == null) return res.json({ shared: false, users: [] });
  const fresh = now() - 6 * 3600e3; // location older than 6h is ignored
  const rows = db.prepare(`SELECT id,name,age,city,work,lat,lng FROM users WHERE share_loc=1 AND id!=? AND loc_at>?
    AND id NOT IN (SELECT too FROM blocks WHERE frm=?) AND id NOT IN (SELECT frm FROM blocks WHERE too=?)`).all(me.id, fresh, me.id, me.id);
  const users = rows.map((r) => ({ id: r.id, name: r.name, age: r.age, city: r.city, work: r.work, km: Math.max(0.1, Math.round(km(me.lat, me.lng, r.lat, r.lng) * 10) / 10) }))
    .filter((r) => r.km <= 50).sort((x, y) => x.km - y.km).slice(0, 50); // exact coordinates never leave the server
  res.json({ shared: true, users });
});

// ---- safety ----
app.post("/api/block", auth, (req, res) => { db.prepare("INSERT OR IGNORE INTO blocks VALUES (?,?)").run(req.user.id, +req.body.to); res.json({ ok: true }); });
app.post("/api/report", auth, (req, res) => { db.prepare("INSERT INTO reports (frm,too,reason,created) VALUES (?,?,?,?)").run(req.user.id, +req.body.to, clean(req.body.reason, 200), now()); res.json({ ok: true }); });

// ---- chats ----
function canChat(x, y) { const [a, b] = pair(x, y); return !!db.prepare("SELECT 1 FROM matches WHERE a=? AND b=?").get(a, b) || !!db.prepare("SELECT 1 FROM messages WHERE (a=? AND b=?) OR (a=? AND b=?)").get(x, y, y, x); }
function blocked(x, y) { return !!db.prepare("SELECT 1 FROM blocks WHERE (frm=? AND too=?) OR (frm=? AND too=?)").get(x, y, y, x); }
app.get("/api/chats", auth, (req, res) => {
  const me = req.user.id;
  const ids = new Set();
  db.prepare("SELECT a,b FROM matches WHERE a=? OR b=?").all(me, me).forEach((m) => ids.add(m.a === me ? m.b : m.a));
  db.prepare("SELECT DISTINCT a,b FROM messages WHERE a=? OR b=?").all(me, me).forEach((m) => ids.add(m.a === me ? m.b : m.a));
  const out = [...ids].filter((id) => !blocked(me, id)).map((id) => {
    const u = db.prepare("SELECT id,name,username FROM users WHERE id=?").get(id);
    const last = db.prepare("SELECT text,created,a FROM messages WHERE (a=? AND b=?) OR (a=? AND b=?) ORDER BY id DESC LIMIT 1").get(me, id, id, me);
    return { id: u.id, name: u.name, last: last ? last.text : "Match ho gaya! Hi bolo 👋", at: last ? last.created : 0, online: online.has(id) };
  }).sort((x, y) => y.at - x.at);
  res.json({ chats: out });
});
app.get("/api/messages/:uid", auth, (req, res) => {
  const o = +req.params.uid, me = req.user.id;
  const rows = db.prepare("SELECT id,a,text,created FROM messages WHERE (a=? AND b=?) OR (a=? AND b=?) ORDER BY id DESC LIMIT 100").all(me, o, o, me).reverse();
  res.json({ messages: rows.map((m) => ({ id: m.id, mine: m.a === me, text: m.text, at: m.created })) });
});
app.post("/api/messages/:uid", auth, limit(120, 60e3), (req, res) => {
  const o = +req.params.uid, text = clean(req.body.text, 1000);
  if (!text || !db.prepare("SELECT 1 FROM users WHERE id=?").get(o)) return res.status(400).json({ error: "Galat message" });
  if (blocked(req.user.id, o)) return res.status(403).json({ error: "Ye user available nahi hai" });
  if (!canChat(req.user.id, o)) return res.status(403).json({ error: "Pehle match karo, phir chat" });
  const r = db.prepare("INSERT INTO messages (a,b,text,created) VALUES (?,?,?,?)").run(req.user.id, o, text, now());
  const m = { id: r.lastInsertRowid, from: req.user.id, text, at: now() };
  push(o, { type: "message", message: m, from: publicUser(req.user) });
  res.json({ ok: true, message: m });
});

// ---- Saathi AI (always labelled AI) ----
const SAATHI_SYSTEM = "Tum Saathi ho, ek AI companion. Tum insaan nahi ho aur kabhi insaan hone ka dawa nahi karte. Simple Hindi/Hinglish me, garmjoshi aur samajh ke saath baat karo, chhote jawab (2-4 vaakya). Romantic ya sexual role-play mat karo; agar user akela mehsoos kare to sunne ke saath asli doston/parivaar se judne ko bhi pyaar se protsahit karo. Agar user khud ko nuksaan pahunchane ki baat kare, to shaanti se dhyaan do aur turant kisi bharose ke insaan ya local helpline se baat karne ko kaho.";
const FALLBACK = ["Sunke accha laga. Aur batao, aap kaisa mehsoos kar rahe ho? 💜", "Main samajh sakta hoon. Aap akele nahi ho is me. 🤝", "Ye to badhiya hai! Thoda aur batao 😊", "Thoda ruk ke gehri saans lo. Aap bahut kuch sambhaal rahe ho, wo himmat ki baat hai.", "Kabhi kabhi din bhaari lagte hain. Ek kadam kaafi hai. 🌱"];
async function saathiReply(uid, text) {
  if (!ANTHROPIC_KEY) return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
  const hist = db.prepare("SELECT role,text FROM ai_msgs WHERE uid=? ORDER BY id DESC LIMIT 12").all(uid).reverse().map((m) => ({ role: m.role, content: m.text }));
  hist.push({ role: "user", content: text });
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.AI_MODEL || "claude-haiku-4-5", max_tokens: 300, system: SAATHI_SYSTEM, messages: hist })
    });
    const j = await r.json();
    return (j.content && j.content[0] && j.content[0].text) || FALLBACK[0];
  } catch (e) { return FALLBACK[1]; }
}
app.get("/api/saathi", auth, (req, res) => {
  const rows = db.prepare("SELECT role,text,created FROM ai_msgs WHERE uid=? ORDER BY id DESC LIMIT 60").all(req.user.id).reverse();
  res.json({ messages: rows, live: !!ANTHROPIC_KEY });
});
app.post("/api/saathi", auth, limit(40, 600e3), async (req, res) => {
  const text = clean(req.body.text, 800);
  if (!text) return res.status(400).json({ error: "Kuch likho" });
  const reply = await saathiReply(req.user.id, text);
  const ins = db.prepare("INSERT INTO ai_msgs (uid,role,text,created) VALUES (?,?,?,?)");
  ins.run(req.user.id, "user", text, now()); ins.run(req.user.id, "assistant", reply, now());
  res.json({ reply });
});

// ---- realtime ----
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });
const sockets = new Map(); // uid -> Set<ws>
const online = new Set();
function push(uid, payload) { const s = sockets.get(uid); if (s) s.forEach((w) => w.readyState === 1 && w.send(JSON.stringify(payload))); }
wss.on("connection", (ws, req) => {
  let uid = null;
  const kill = setTimeout(() => uid || ws.close(), 5000);
  ws.on("message", (raw) => {
    try {
      const m = JSON.parse(raw);
      if (!uid && m.type === "auth") {
        uid = jwt.verify(m.token, SECRET).id;
        clearTimeout(kill);
        if (!sockets.has(uid)) sockets.set(uid, new Set());
        sockets.get(uid).add(ws); online.add(uid);
        ws.send(JSON.stringify({ type: "ready" }));
      } else if (uid && m.type === "typing" && +m.to && canChat(uid, +m.to) && !blocked(uid, +m.to)) push(+m.to, { type: "typing", from: uid });
    } catch (e) { ws.close(); }
  });
  ws.on("close", () => { if (uid && sockets.has(uid)) { sockets.get(uid).delete(ws); if (!sockets.get(uid).size) { sockets.delete(uid); online.delete(uid); } } });
});

server.listen(PORT, () => console.log("Pulse chal raha hai: http://localhost:" + PORT));
module.exports = server;
