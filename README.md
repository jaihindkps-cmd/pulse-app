# Pulse: asli backend (Phase 1)

Isme hai: signup/login, post + like, Discover swipe + match, **asli real-time chat** (WebSocket),
Nearby (sirf opt-in, exact location kisi ko nahi dikhti), block/report, aur Saathi AI (hamesha "AI" label ke saath).
Database: SQLite (`pulse.db` file apne-aap ban jaati hai).

## Apne computer par chalao (5 minute)
1. Node.js (version 20 ya naya) install karo: https://nodejs.org
2. Is folder me terminal kholo aur likho:
   ```
   npm install
   node server.js
   ```
3. Browser me kholo: http://localhost:3000
4. Do alag browser (ya ek normal aur ek incognito) me do account banao, Discover me ek-doosre ko like karo. Match hote hi chat khul jayegi, aur message turant dikhega.
5. Doosre phone se chalane ke liye dono phone ek hi WiFi par ho, aur phone me kholo: `http://<aapke-computer-ka-IP>:3000`

## Internet par live karo (taaki koi bhi join kar sake)
Sabse aasan: **Render.com**
1. Is folder ko GitHub par daalo (private repo theek hai).
2. Render par "New > Blueprint" chuno, apna repo jodo. `render.yaml` sab set kar dega.
3. Deploy hone par aapko `https://pulse-xxxx.onrender.com` jaisa link milega. Wahi sabko bhejo. Log khud signup karke join ho jayenge.

Dhyan: SQLite ko storage (disk) chahiye, isliye Render ka paid "starter" plan lagega (lagbhag $7/month).
Free plan par data restart me ud jaata hai. Users badhne par Postgres (Supabase) par jaana behtar hoga.

## Saathi ko asli AI banana (optional)
`ANTHROPIC_API_KEY` environment variable set karo (console.anthropic.com se key). Bina key ke Saathi thode fixed jawab deta hai.
AI ke kharche par kabu rakhne ke liye `server.js` me daily limit pehle se hai (40 message / 10 minute).

## Zaroori suraksha baatein
- Production me `JWT_SECRET` zaroor set karo (render.yaml ye khud bana deta hai), warna restart par sab logout ho jayenge.
- Sirf 18+ allowed hai (signup me check). Umar sirf user ke likhne par based hai, asli ID verification abhi nahi hai.
- Location: user ke ON karne par hi save hoti hai, doosron ko sirf km dikhte hain, 6 ghante purani location ignore hoti hai.

## Abhi ye nahi hai (agle phase)
- Phone OTP / email verification (abhi sirf username + password)
- Photo upload, ID/photo verification badge
- Moderation dashboard (reports `reports` table me jama hote hain)
- Push notification, Play Store / App Store app
- Payment / subscription

---

# Mobile app (Android APK + phone par install)

Pehle server internet par live hona chahiye (upar "Internet par live karo" wala hissa). Phir:

## Tareeka A: turant, bina APK ke (PWA)
App phone par install ho jata hai, home screen par Pulse ka icon aata hai, aur poori screen me app jaisa khulta hai.
- **Android (Chrome):** apna Pulse link kholo > upar ke teen dot (⋮) > "Install app" ya "Add to Home screen".
- **iPhone (Safari):** link kholo > Share button > "Add to Home Screen".

## Tareeka B: asli APK file (GitHub apne-aap bana dega, free)
Aapko Android Studio ya kuch bhi install nahi karna.
1. https://github.com par free account banao. "New repository" banao (Private rakho).
2. Is `pulse-app` folder ki saari files us repo me upload karo (`.github` folder samet).
   Dhyan: `.github` hidden folder hai, usko bhi upload karna zaroori hai.
3. Repo me: **Settings > Secrets and variables > Actions > Variables > New repository variable**
   - Name: `PULSE_URL`
   - Value: aapka live link, jaise `https://pulse-xxxx.onrender.com` (https zaroori hai)
4. Upar **Actions** tab > "Pulse APK banao" > **Run workflow** dabao.
5. 5-10 minute baad run khulega, neeche **Artifacts** me `pulse-apk` hoga. Download karo (zip), andar `app-debug.apk` milegi.
6. APK phone me bhejo (WhatsApp/Drive/USB), kholo, aur "Unknown source se install" allow karo.

Zaroori baatein:
- Ye app server se chalta hai, isliye internet chahiye. Server me badlav karoge to app me naya APK banane ki zaroorat nahi, apne-aap naya dikhega.
- Location ke liye phone permission maangega (Allow karo).
- Ye "debug" APK hai: aapke aur doston ke testing ke liye bilkul theek. Play Store par daalne ke liye release signing aur Google Play Developer account (ek baar $25) chahiye, wo agla kadam hai.
- Server ka link badla to `PULSE_URL` badlo aur workflow phir chalao.
