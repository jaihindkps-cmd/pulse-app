# Pulse — मालिक की गाइड (Owner guide)

## रोज़ के काम
| काम | कहाँ |
|---|---|
| रिपोर्ट देखना, बैन करना | `/admin.html` → Reports (owner अकाउंट से Google sign-in) |
| किसी डिवाइस पर Pulse लॉक / डेटा मिटाना / app हटाने का अनुरोध | `/admin.html` → Devices |
| कुल यूज़र, रिपोर्ट गिनती | Pulse app → Me → Creator Panel |
| नया वर्ज़न डालना | `git push`, फिर GitHub → Actions → चलाओ (वेब + APK + rules साथ में deploy होते हैं) |

## क्या कर सकते हो और क्या नहीं
- **Lock:** उस फ़ोन पर Pulse बंद हो जाता है, sign-out हो जाता है।
- **Wipe:** फ़ोन का local डेटा मिटता है। Cloud डेटा (प्रोफ़ाइल, पोस्ट) Firebase में रहता है। यूज़र खुद "Delete account" से उसे मिटा सकता है, और "Download my data" से कॉपी ले सकता है।
- **Remove app:** wipe + Android का "Uninstall?" डायलॉग। यूज़र को OK दबाना ही पड़ेगा। यह कोई भी ऐप चुपचाप नहीं कर सकता।
- आदेश तब लगते हैं जब उस फ़ोन पर app खुला हो और इंटरनेट हो।
- बैन: Firebase console → Firestore → `bans` → document ID = यूज़र का uid। या admin पेज के "Ban user" से।

## सुरक्षा
- असली सुरक्षा Firestore rules (`firestore.rules`) में है। Client का कोड कोई भी पढ़ सकता है, उसे छुपाया नहीं जा सकता।
- Rules का टेस्ट: `tests/rules` (emulator)। GitHub पर `Rules tests` workflow rules बदलने पर अपने-आप चलता है।
- कोई API key, पासवर्ड या मालिक का ईमेल कभी किसी बाहरी जगह मत भेजो।

## अभी की सीमाएँ (Spark plan)
- App बंद होने पर notification नहीं (Cloud Functions/FCM server चाहिए)।
- Free TURN अस्थिर है। कॉल न जुड़े तो paid TURN लगाओ।
- Auto-ban, server-side moderation, और यूज़र का raw uid छुपाना: Cloud Functions चाहिए।
- APK में Google login: Firebase में SHA-1 जोड़ना होगा।
- Privacy/Terms text वकील से जँचवाओ (DPDP Act, 18+ नियम, रिमोट wipe की सहमति)।

## असली फ़ोन पर जाँचने की सूची (हर release से पहले)
1. दो फ़ोन: Private Talk → टेक्स्ट → voice note → voice call → masked video।
2. Mask: पलक झपकना, सिर घुमाना, लाइट कम करना — चेहरा कभी कच्चा न दिखे।
3. Minimize: कॉल छोटी करके चैट/दूसरे टैब में जाना।
4. Screenshot-block: talk के दौरान screenshot काला आए।
5. Admin पेज: Google login, Lock, Unlock।
6. Install बैनर (Chrome), ऑफ़लाइन खोलना।
