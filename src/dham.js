// Dham Darshan: prasiddh jyotirlinga, siddhpeeth aur dham. Chitra asli photo nahi, ye app ke khud ke banaye (generated) kalakriti hain.
// Aap apni licensed photo public/dham/<id>.jpg me rakhoge to app wahi dikhayega.
export var DHAMS = [
  { id: "somnath", n: "Somnath", k: "J", p: "Gujarat", b: "First of the 12 Jyotirlingas, on the Arabian Sea shore at Prabhas Patan." },
  { id: "mallikarjuna", n: "Mallikarjuna", k: "J", p: "Srisailam, Andhra Pradesh", b: "A Jyotirlinga that is also a Shakti Peetha (Bhramaramba), on the Nallamala hills." },
  { id: "mahakaleshwar", n: "Mahakaleshwar", k: "J", p: "Ujjain, Madhya Pradesh", b: "Famous south-facing lingam, known for the early-morning Bhasma Aarti." },
  { id: "omkareshwar", n: "Omkareshwar", k: "J", p: "Madhya Pradesh", b: "On Mandhata island in the Narmada, whose shape resembles the sacred Om." },
  { id: "kedarnath", n: "Kedarnath", k: "J", p: "Uttarakhand", b: "Himalayan Jyotirlinga near the Mandakini; open in the warmer months only." },
  { id: "bhimashankar", n: "Bhimashankar", k: "J", p: "Sahyadri hills, Maharashtra", b: "Jyotirlinga amid forested Sahyadri hills, source region of the Bhima river." },
  { id: "kashi", n: "Kashi Vishwanath", k: "J", p: "Varanasi, Uttar Pradesh", b: "The Lord of the Universe, on the banks of the Ganga in the ancient city of Kashi." },
  { id: "trimbakeshwar", n: "Trimbakeshwar", k: "J", p: "Nashik, Maharashtra", b: "Jyotirlinga near the origin of the Godavari river." },
  { id: "vaidyanath", n: "Baidyanath Dham", k: "J", p: "Deoghar, Jharkhand", b: "Baba Dham, famous for the Shravani Mela when devotees bring Ganga water." },
  { id: "nageshwar", n: "Nageshwar", k: "J", p: "Near Dwarka, Gujarat", b: "Jyotirlinga associated with protection from poison and fear." },
  { id: "rameshwaram", n: "Rameshwaram", k: "J", p: "Tamil Nadu", b: "Jyotirlinga and Char Dham, linked with Shri Ram's worship of Shiva." },
  { id: "grishneshwar", n: "Grishneshwar", k: "J", p: "Near Ellora, Maharashtra", b: "The last of the 12 Jyotirlingas, close to the Ellora caves." },
  { id: "amarnath", n: "Amarnath", k: "J", p: "Jammu & Kashmir", b: "A Himalayan cave where an ice lingam forms; reached by the annual yatra." },
  { id: "vaishno", n: "Vaishno Devi", k: "S", p: "Katra, Jammu & Kashmir", b: "Mata Rani's cave shrine in the Trikuta hills, one of India's most visited." },
  { id: "kamakhya", n: "Kamakhya", k: "S", p: "Guwahati, Assam", b: "Revered Shakti Peetha on Nilachal hill above the Brahmaputra." },
  { id: "kalighat", n: "Kalighat", k: "S", p: "Kolkata, West Bengal", b: "Shakti Peetha of Goddess Kali, in the heart of Kolkata." },
  { id: "jwala", n: "Jwala Ji", k: "S", p: "Kangra, Himachal Pradesh", b: "Shakti Peetha where eternal flames are worshipped as the Goddess." },
  { id: "naina", n: "Naina Devi", k: "S", p: "Himachal Pradesh", b: "Hilltop Shakti Peetha with views of the Gobind Sagar." },
  { id: "vindhyachal", n: "Vindhyavasini", k: "S", p: "Vindhyachal, Uttar Pradesh", b: "Ancient Shakti shrine on the banks of the Ganga near Mirzapur." },
  { id: "ambaji", n: "Ambaji", k: "S", p: "Gujarat", b: "Revered Shakti Peetha near the Gujarat-Rajasthan border." },
  { id: "maihar", n: "Maihar Sharda Mata", k: "S", p: "Satna, Madhya Pradesh", b: "Hilltop temple of Sharda Mata, reached by a long stairway." },
  { id: "badrinath", n: "Badrinath", k: "C", p: "Uttarakhand", b: "Dham of Lord Vishnu on the Alaknanda, among the four sacred Char Dham." },
  { id: "dwarka", n: "Dwarkadhish", k: "C", p: "Dwarka, Gujarat", b: "Shri Krishna's kingdom by the sea, one of the Char Dham." },
  { id: "puri", n: "Jagannath Puri", k: "C", p: "Odisha", b: "Home of Lord Jagannath, famous for the Rath Yatra; one of the Char Dham." }
];
var KIND = { J: { t: "Jyotirlinga", sym: "🔱", hues: [236, 262, 210] }, S: { t: "Shakti Peetha", sym: "🪷", hues: [350, 12, 330] }, C: { t: "Char Dham", sym: "🛕", hues: [28, 40, 18] } };
export function kindName(k) { return KIND[k].t; }
export function kindSym(k) { return KIND[k].sym; }
function h(s) { var x = 2166136261; for (var i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; }
// Har dham ke liye alag rang + mandir ki aakriti (shikhara, kalash, dhwaja, suraj/chand, pahad)
export function art(d) {
  var K = KIND[d.k], x = h(d.id), hue = K.hues[x % 3], hue2 = (hue + 28 + (x >> 3) % 30) % 360, tiers = 4 + (x >> 5) % 3, flag = (x >> 7) % 2, moon = d.k === "J";
  var tw = 150, tower = "", y = 300, w = 100;
  for (var i = 0; i < tiers; i++) { var nw = w * (0.8 - i * 0.02); tower += '<path d="M' + (200 - w / 2) + ' ' + y + 'L' + (200 - nw / 2) + ' ' + (y - 26) + 'L' + (200 + nw / 2) + ' ' + (y - 26) + 'L' + (200 + w / 2) + ' ' + y + 'Z" fill="hsl(' + hue + ',55%,' + (36 + i * 4) + '%)" stroke="hsl(' + hue2 + ',90%,75%)" stroke-opacity=".8"/>'; y -= 26; w = nw; }
  var top = y;
  var sky = '<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(' + hue + ',70%,12%)"/><stop offset=".6" stop-color="hsl(' + hue + ',65%,32%)"/><stop offset="1" stop-color="hsl(' + hue2 + ',90%,62%)"/></linearGradient><radialGradient id="g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff3b0" stop-opacity=".95"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient></defs>';
  var stars = ""; for (var j = 0; j < 22; j++) { var q = h(d.id + j); stars += '<circle cx="' + (q % 400) + '" cy="' + ((q >> 9) % 170) + '" r="' + (0.6 + (q % 3) * 0.5) + '" fill="#fff" opacity="' + (0.35 + (q % 5) / 10) + '"/>'; }
  var orb = moon ? '<path d="M318 70a26 26 0 1 0 22 40 22 22 0 1 1-22-40Z" fill="#f4f1ff" opacity=".92"/>' : '<circle cx="320" cy="92" r="60" fill="url(#g)"/><circle cx="320" cy="92" r="22" fill="#fff0a8"/>';
  var mtn = '<path d="M0 300L60 210 110 262 170 190 235 270 290 205 350 268 400 220V300Z" fill="hsl(' + hue + ',50%,14%)" opacity=".85"/>';
  var base = '<rect x="120" y="300" width="160" height="14" fill="hsl(' + hue + ',50%,18%)"/><rect x="100" y="314" width="200" height="12" fill="hsl(' + hue + ',50%,13%)"/><rect x="150" y="270" width="100" height="30" fill="hsl(' + hue + ',50%,32%)"/><path d="M185 300v-20a15 15 0 0 1 30 0v20Z" fill="#ffcf6e" opacity=".9"/>';
  var kal = '<ellipse cx="200" cy="' + (top - 4) + '" rx="9" ry="6" fill="#ffd36b"/><rect x="198" y="' + (top - 26) + '" width="4" height="22" fill="#ffd36b"/>' + (flag ? '<path d="M202 ' + (top - 26) + 'l26 7-26 8Z" fill="#ff7a1a"/>' : '<circle cx="200" cy="' + (top - 30) + '" r="3.5" fill="#ffd36b"/>');
  var sym = '<text x="200" y="' + (330) + '" text-anchor="middle" font-size="22" opacity=".0">' + K.sym + '</text>';
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 340" preserveAspectRatio="xMidYMax slice">' + sky + '<rect width="400" height="340" fill="url(#s)"/>' + stars + orb + mtn + '<ellipse cx="200" cy="250" rx="150" ry="120" fill="url(#g)" opacity=".35"/><rect y="318" width="400" height="22" fill="hsl(' + hue + ',50%,9%)"/>' + base + tower + kal + sym + '</svg>';
  return "url(\"data:image/svg+xml;utf8," + encodeURIComponent(svg) + "\")";
}
// Asli photo: Wikipedia/Wikimedia Commons se (khule license), browser me live laayi jaati hai. Na mile to generated art dikhti hai.
var WIKI = {
  somnath: ["Somnath temple", "Somnath"], mallikarjuna: ["Mallikarjuna Temple, Srisailam", "Srisailam"], mahakaleshwar: ["Mahakaleshwar Jyotirlinga", "Mahakaleshwar Temple"],
  omkareshwar: ["Omkareshwar Temple", "Omkareshwar"], kedarnath: ["Kedarnath Temple", "Kedarnath"], bhimashankar: ["Bhimashankar Temple"], kashi: ["Kashi Vishwanath Temple"],
  trimbakeshwar: ["Trimbakeshwar Shiva Temple", "Trimbakeshwar"], vaidyanath: ["Baidyanath Temple, Deoghar", "Baidyanath Dham"], nageshwar: ["Nageshvara Jyotirlinga"],
  rameshwaram: ["Ramanathaswamy Temple"], grishneshwar: ["Grishneshwar Temple"], amarnath: ["Amarnath Temple", "Amarnath cave"],
  vaishno: ["Vaishno Devi Temple", "Vaishno Devi"], kamakhya: ["Kamakhya Temple"], kalighat: ["Kalighat Kali Temple"], jwala: ["Jwalamukhi Temple, Kangra", "Jwalamukhi Temple"],
  naina: ["Naina Devi Temple", "Naina Devi"], vindhyachal: ["Vindhyavasini Temple"], ambaji: ["Ambaji Temple"], maihar: ["Maihar Devi Temple", "Sharda Devi Temple"],
  badrinath: ["Badrinath Temple"], dwarka: ["Dwarkadhish Temple"], puri: ["Jagannath Temple, Puri"]
};
var PK = "pulse_dham_photos_v2";
export function photoOrArt(d) { return (d.photo ? 'url("' + d.photo + '"), ' : "") + "url(dham/" + d.id + ".jpg), " + art(d); }
// Shared helper: har id ke liye ek ya zyada candidate titles ho sakte hain; jo bhi pehla mile wahi use hota hai.
// Real (licensed-open) photo Wikimedia Commons se seedha fetch hoti hai; na mile to upar wali generated kalakriti dikhti hai.
function fetchWikiPhotos(idToTitles, cacheKey, done, apply) {
  var cache = {}; try { cache = JSON.parse(localStorage.getItem(cacheKey) || "{}"); } catch (e) {}
  var fresh = cache.t && Date.now() - cache.t < 7 * 86400000 && cache.m;
  if (fresh) { apply(cache.m); if (Object.keys(cache.m).length) done(); return; }
  var allTitles = []; Object.keys(idToTitles).forEach(function (id) { idToTitles[id].forEach(function (t) { if (allTitles.indexOf(t) < 0) allTitles.push(t); }); });
  if (!allTitles.length) return;
  fetch("https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages&piprop=thumbnail&pithumbsize=900&titles=" + encodeURIComponent(allTitles.join("|"))).then(function (r) { return r.json(); }).then(function (j) {
    var q = j.query || {}, byTitle = {}, alias = {};
    (q.normalized || []).forEach(function (x) { alias[x.from] = x.to; }); (q.redirects || []).forEach(function (x) { alias[x.from] = x.to; });
    Object.keys(q.pages || {}).forEach(function (k) { var pg = q.pages[k]; if (pg.thumbnail) byTitle[pg.title] = pg.thumbnail.source; });
    var m = {}; Object.keys(idToTitles).forEach(function (id) {
      for (var i = 0; i < idToTitles[id].length; i++) { var t = idToTitles[id][i], hops = 0; while (alias[t] && hops++ < 4) t = alias[t]; if (byTitle[t]) { m[id] = byTitle[t]; break; } }
    });
    try { localStorage.setItem(cacheKey, JSON.stringify({ t: Date.now(), m: m })); } catch (e) {} apply(m); if (Object.keys(m).length) done();
  }).catch(function () {});
}
export function loadPhotos(done) {
  var idToTitles = {}; DHAMS.forEach(function (d) { if (WIKI[d.id]) idToTitles[d.id] = WIKI[d.id]; });
  fetchWikiPhotos(idToTitles, PK, done, function (m) { DHAMS.forEach(function (d) { if (m[d.id] && /^https:\/\/upload\.wikimedia\.org\//.test(m[d.id])) d.photo = m[d.id]; }); });
}
export function daily() { return DHAMS[Math.floor(Date.now() / 86400000) % DHAMS.length]; }

// Deity artwork for Bhajan Room: classical, traditional depictions (centuries-old iconography),
// fetched live from Wikimedia Commons the same safe way as temple photos above. Falls back to the
// app's own gradient + symbol when a photo can't be fetched.
export var DEITY_WIKI = {
  Om: ["Om"], Shiv: ["Shiva", "Shiva as Nataraja"], Ram: ["Rama", "Rama (Hindu deity)"], Krishna: ["Krishna", "Krishna (deity)"],
  Hanuman: ["Hanuman"], Durga: ["Durga", "Durga Puja"], Ganesh: ["Ganesha"], Lakshmi: ["Lakshmi"],
  Saraswati: ["Saraswati"], Vishnu: ["Vishnu"], "Sai Baba": ["Sai Baba of Shirdi"], Ayyappa: ["Ayyappan", "Sabarimala"]
};
var DK = "pulse_deity_photos_v2";
export function loadDeityPhotos(DEITY, done) {
  var idToTitles = {}; DEITY.forEach(function (d) { if (DEITY_WIKI[d.n]) idToTitles[d.n] = DEITY_WIKI[d.n]; });
  fetchWikiPhotos(idToTitles, DK, done, function (m) { DEITY.forEach(function (d) { if (m[d.n] && /^https:\/\/upload\.wikimedia\.org\//.test(m[d.n])) d.photo = m[d.n]; }); });
}
