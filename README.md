# Pulse (Firebase, free plan)

Social feed + Discover (swipe/match) + asli real-time chat + Nearby (sirf opt-in) + Saathi AI (hamesha "AI" label ke saath).
Poora app Firebase ke **free Spark plan** par chalta hai: Authentication (login), Firestore (data + live chat), Hosting (website link).
Koi alag server nahi, koi paisa nahi.

Kaise chalta hai: `public/` folder me bani-banayi website hai (`app.js` pehle se bana hua hai). Suraksha ke niyam `firestore.rules` me hain.

---

## Part 1: Firebase project banao (console se, phone par bhi ho jaata hai)

1. https://console.firebase.google.com kholo, Google account se login. **Create a project** (ya "Add project") dabao.
   Naam: `pulse`. Google Analytics **band** (OFF) rakho. **Create project**.
2. Left menu **Build > Authentication > Get started > Sign-in method > Email/Password > Enable > Save**.
3. **Build > Firestore Database > Create database**.
   Location: `asia-south1 (Mumbai)`. Mode: **Production mode**. **Create**.
4. **Build > Hosting > Get started**. Next/Continue dabate jao jab tak khatam na ho (bas ek baar, setup ke liye).
5. Upar **gear (Project settings) > General > Your apps > Web (`</>`)**:
   nickname `Pulse` likho, "Also set up Firebase Hosting" ka tick **mat** lagao, **Register app**.
   Jo `firebaseConfig` dikhe usme `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` copy kar lo.
6. GitHub me apne repo me `public/firebase-config.json` kholo, pencil (edit) dabao, `PASTE_...` waali jagah ye 6 values daalo, **Commit changes**.
   (Ye keys public hoti hain, inme chhupane layak kuch nahi. Asli suraksha `firestore.rules` se aati hai.)

## Part 2: Rules lagao aur website live karo

**Rules (suraksha ke niyam), console se, 2 minute:**
7. Firebase console > **Build > Firestore Database > Rules** tab.
   Repo ki `firestore.rules` file kholo, poora text copy karo, Rules box me purana sab hata kar paste karo, **Publish** dabao.

**Website live karne ka tareeka: GitHub Pages (free, koi chaabi nahi chahiye).**
8. Repo ko **Public** karo: GitHub repo **Settings > General > sabse neeche Danger Zone > Change visibility > Public**.
   (Free GitHub account me Pages ke liye ye zaroori hai. Repo me koi secret nahi hai; Firebase ki web keys public hi hoti hain, asli suraksha `firestore.rules` se aati hai.)
9. Repo **Settings > Pages > Build and deployment > Source = GitHub Actions**.
10. **Actions > "Website live karo (GitHub Pages)" > Run workflow**. 1-2 minute baad link: `https://<github-naam>.github.io/pulse-app/`
11. Firebase console > **Authentication > Settings > Authorized domains > Add domain** me `<github-naam>.github.io` jodo, warna signup par "unauthorized domain" error aayega.

Kuch badla to `public/` me commit karte hi website apne-aap dobara live ho jaati hai.

**Dusra tareeka (optional): Firebase Hosting** (GitHub Action `Firebase par deploy karo`, service account secret chahiye; rules bhi isi se lagte hain).
- Firebase console: **Project settings > Service accounts > Generate new private key**. Wo `.json` kisi ko bhejna nahi, chat me bhi nahi.
- GitHub **Settings > Secrets and variables > Actions**: Secret `FIREBASE_SERVICE_ACCOUNT` (wo JSON), Variable `FIREBASE_PROJECT_ID`.

## Part 3: Mobile app

- **Turant (bina APK):** link phone par kholo. Android Chrome: menu (⋮) > **Install app**. iPhone Safari: Share > **Add to Home Screen**.
- **APK file:** repo **Settings > Secrets and variables > Actions > Variables** me `PULSE_URL` = aapka website link (github.io ya web.app) daalo,
  phir **Actions > Pulse APK banao > Run workflow**. 5-10 minute baad run ke neeche **Artifacts** me `pulse-apk` milega (zip, andar `app-debug.apk`).
  Phone me install karte waqt "Unknown source" allow karna hoga. Location ki permission Allow karna.

---

## Free plan ki hadein (Spark, lagbhag)
Firestore: roz ~50,000 reads, ~20,000 writes, 1 GB data. Hosting: 10 GB. Login (email) free.
Chhote group (kuch sau log) ke liye kaafi hai. Console me **Usage** tab me dekhte raho. Hadd paar hone par us din ke liye app rukta hai, paisa nahi katta (card jodna padta hi nahi).

## Saathi AI kaisa hai
Abhi Saathi kuch tay kiye hue pyaar bhare jawab deta hai (hamesha "AI" likha rehta hai). Asli AI jawab ke liye server chahiye (Firebase ka paid Blaze plan, card chahiye).
Wo baad ka kadam hai.

## Privacy aur suraksha (jo bana hai)
- Sirf 18+ (rules me bhi check hai). Umar sirf user ke likhne par based hai, asli ID verification abhi nahi.
- Match ke bina koi message nahi bhej sakta (rules rokte hain). Block karne par dono taraf message band.
- Nearby: location tabhi save hoti hai jab user khud ON kare, aur ~1 km ke daayre me mota-mota (rounded). Doosron ki location wahi padh sakta hai jisne khud bhi share ki ho. Band karte hi record hat jaata hai.
- Report ke record Firestore me `reports` collection me jama hote hain (console me dekh sakte ho).

## Abhi nahi hai
Phone OTP / email verification, photo upload, ID verification badge, spam rokne ki limit, moderation page, asli AI Saathi, push notification, Play Store release.

## Developer ke liye
`src/app.js` me app ka code hai. Badalne ke baad `npm install` aur `npm run build` chalao (ye `public/app.js` banata hai), phir commit karo.
