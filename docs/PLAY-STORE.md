# Pulse — Google Play Store गाइड

कोड और build तैयार है। नीचे वे कदम हैं जो सिर्फ़ तुम (अकाउंट मालिक) कर सकते हो, क्रम से।

## 1. Play Console अकाउंट (एक बार)
- play.google.com/console → developer अकाउंट बनाओ (एक बार का शुल्क US$25, पहचान सत्यापन ज़रूरी)।
- नए personal अकाउंट पर **production में जाने से पहले closed testing में कम से कम 12 testers को 14 दिन चलाना** पड़ सकता है (Google का नियम)। अभी का नियम Console में देख लो।

## 2. Upload key को GitHub में डालो (2 मिनट)
Keystore फ़ाइल `pulse-upload.jks` तुम्हें अलग से दी गई है (बैकअप संभालकर रखो, इसे GitHub में commit मत करना)।
GitHub repo → Settings → Secrets and variables → Actions → New repository secret, चार secrets:

| नाम | मान |
|---|---|
| `ANDROID_KEYSTORE_B64` | `pulse-upload.jks.b64` फ़ाइल का पूरा text |
| `ANDROID_KEYSTORE_PASSWORD` | दी गई password |
| `ANDROID_KEY_ALIAS` | `pulse-upload` |
| `ANDROID_KEY_PASSWORD` | वही password |

फिर GitHub → Actions → **Play Store build (signed AAB)** → Run workflow (version name भरो, जैसे `1.0.0`)।
बाद में Artifacts से `.aab` डाउनलोड करो। हर run पर versionCode अपने-आप बढ़ता है।

> Play App Signing चालू रखो (डिफ़ॉल्ट)। तब यह upload key खो जाए तो Google से reset हो सकती है।

## 3. Console में ऐप बनाओ
- App name: **Pulse**, Default language: English (India), App/Game: App, Free।
- Package name पहले से `com.pulse.app` है (बदलना नहीं)।
- **Privacy policy URL:** `https://pulse-704e7.web.app/privacy.html`
- **Account deletion URL** (Data safety → Account deletion): `https://pulse-704e7.web.app/delete-account.html`
- Developer contact email: एक अलग support ईमेल बनाओ (अपना निजी ईमेल मत दो; यह Play पेज पर सार्वजनिक दिखेगा)।

## 4. Store listing (copy-paste)
**Short description (80):** Friends, dating, jobs, music, calls and anonymous support talks in one app.

**Full description (English):**
Pulse brings the people and things you care about into one free app.
• Friends, dating and marriage modes with verified members
• Jobs and recruiters, with CV sharing only to the employer you apply to
• Voice and video calls, music rooms and Gaana Studio
• Saathi, a friendly AI companion
• Support Circles: anonymous topic rooms (breakup, job loss, loneliness, family) with text and voice notes
• Private Talk: opt-in anonymous one-to-one chat, voice notes and calls. Video uses a face mask applied on your own phone, and you can disguise your voice
• Your control: block, report, download your data, delete your account in the app
Pulse is for adults 18+. Peer support is not medical advice; in a crisis call Tele-MANAS 14416 or 112.

**Hindi (हिंदी):** Pulse में दोस्ती, डेटिंग, रिश्ते, नौकरी, म्यूज़िक, कॉल और गुमनाम सपोर्ट बातचीत, सब एक जगह। Private Talk में आप गुमनाम रहकर किसी एक से चैट, वॉइस नोट और कॉल कर सकते हैं; वीडियो में चेहरे पर मास्क आपके फ़ोन पर ही लगता है। सिर्फ़ 18+। संकट में Tele-MANAS 14416।

**Graphics (इसी repo में `store/play/`):** icon 512×512, feature graphic 1024×500, फ़ोन screenshots (1080×2160)। ये असली ऐप की स्क्रीन हैं (टेस्ट खातों से)। चाहो तो असली फ़ोन से नए लेकर बदल दो।

## 5. App content फ़ॉर्म (जवाब)
- **Target audience:** 18 और उससे ऊपर। बच्चों के लिए नहीं।
- **Content rating (IARC):** social/communication app, user-generated content, ऑनलाइन बातचीत, dating। ईमानदारी से "हाँ" चुनो। रेटिंग ऊँची आएगी, यह सामान्य है।
- **Ads:** नहीं।
- **User-generated content नीति:** ऐप में report और block है, अकाउंट बैन का तरीका है (admin पेज), और 18+ की रोक है। Console में यही बताओ।
- **Dating app नीति:** केवल 18+ को, सुरक्षा सुझाव ऐप में हैं (public जगह मिलो, पैसा मत दो)।
- **Government/finance/health:** नहीं। (Private Talk peer support है, इलाज का दावा नहीं करता।)

## 6. Data safety फ़ॉर्म (जवाब)
सभी डेटा **encrypted in transit** है। यूज़र **delete request** कर सकता है (ऊपर URL)। डेटा **बेचा नहीं जाता**।

| डेटा | इकट्ठा? | साझा? | क्यों |
|---|---|---|---|
| Email, name, user ID | हाँ | नहीं | अकाउंट, सुरक्षा |
| Age, gender, city, photos, profile text | हाँ (वैकल्पिक/मोड के अनुसार) | दूसरे सदस्यों को (प्रोफ़ाइल) | ऐप का काम |
| Approximate location (~1 km) | हाँ, वैकल्पिक | दूसरे सदस्यों को (Nearby) | Nearby |
| Messages, voice notes | हाँ | केवल बातचीत के सदस्य | ऐप का काम |
| Photos/videos, audio (कॉल, वॉइस नोट) | कॉल peer-to-peer, रिकॉर्ड नहीं | — | कॉल |
| Device or other IDs (device ID) | हाँ | नहीं | सुरक्षा, दुरुपयोग रोकना |
| App activity / diagnostics | बहुत कम (last seen) | नहीं | सुरक्षा |
| AI chat text (Saathi, Mediator) | हाँ | Google Gemini को भेजा जाता है (service provider) | AI जवाब |

## 7. रिलीज़ से पहले की जाँच
`docs/OWNER-GUIDE.md` की "असली फ़ोन पर जाँचने की सूची" पूरी करो। Closed testing में कम से कम दो असली फ़ोन से video call परखो।

## 8. जोखिम जो Play review में उठ सकते हैं (पहले से जान लो)
- `REQUEST_DELETE_PACKAGES` अनुमति (मालिक का "Remove app" आदेश): यह सिर्फ़ Android का अपना uninstall डायलॉग खोलती है और सहमति पहली बार खुलने पर ली जाती है। अगर Google आपत्ति करे तो यह अनुमति और `uninstallSelf` हटा दो; बाकी (lock/wipe) चलते रहेंगे।
- Location, camera, microphone की अनुमति: Console में उपयोग बताना होगा (ऊपर की तालिका)।
- Privacy policy में एक public support संपर्क जोड़ना अच्छा रहेगा: `public/privacy.html` में अपना support ईमेल लिख दो (निजी ईमेल नहीं)।
- कानूनी text वकील से जँचवाओ (DPDP Act, 18+, रिमोट wipe)।
