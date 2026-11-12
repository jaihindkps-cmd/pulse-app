// Cache-busting: after every build, stamp app.js with a content hash so browsers and
// CDNs (Firebase Hosting, GitHub Pages) can never serve a stale bundle after a deploy --
// the URL itself changes whenever app.js changes, so there is nothing to invalidate.
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const appJsPath = path.join(__dirname, "..", "public", "app.js");
const indexPath = path.join(__dirname, "..", "public", "index.html");

const appJs = fs.readFileSync(appJsPath);
const hash = crypto.createHash("sha256").update(appJs).digest("hex").slice(0, 10);

let html = fs.readFileSync(indexPath, "utf8");
const stamped = html.replace(/src="app\.js(?:\?v=[a-f0-9]+)?"/, 'src="app.js?v=' + hash + '"');
if (stamped === html) {
  console.error("stamp-version: did not find app.js script tag to stamp -- check public/index.html");
  process.exit(1);
}
fs.writeFileSync(indexPath, stamped);
console.log("Stamped app.js?v=" + hash + " into index.html");
