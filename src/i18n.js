// Do bhasha: English (default) aur Hindi (Hinglish). Original text Hinglish me hai; English ke liye shabdkosh se badalta hai.
// Naye feature English me likhe gaye hain; unke Hindi shabd EN2HI me hain.
var HI2EN = [
  // --- HTML
  ["Aapka naam", "Your name"], ["Aapko ek verification mail bheji hai. Mail me link par click karo (Spam folder bhi dekho).", "We sent you a verification email. Click the link in it (check Spam too)."],
  ["Asli log, asli baatein. Sirf 18+ ke liye.", "Real people, real conversations. 18+ only."], ["Bas idea likho. AI bol likhega, dhun aapke phone me hi banegi. Bina server, bina paisa.", "Just write an idea. AI writes the lyrics and the tune is made on your phone. No server, no cost."],
  ["Bhejo", "Send"], ["Block / Report", "Block / Report"], ["Block ya report", "Block or report"], ["Bol ko awaaz me padho (phone ki awaaz, gayak nahi)", "Read lyrics aloud (phone voice, not a singer)"],
  ["Chats", "Chats"], ["Dating", "Dating"], ["Dosti", "Friendship"], ["Shaadi", "Marriage"], ["Email verify karo", "Verify your email"], ["Gaana banao", "Make song"],
  ["Jaise: barish me purani dosti ki yaad, ya Papa ke liye shukriya...", "e.g. remembering an old friendship in the rain, or thanks to Dad..."], ["Josh", "Energetic"], ["Kaam", "Work"], ["Kaato", "End"], ["Khushi", "Happy"],
  ["Kya chal raha hai?", "What's on your mind?"], ["Kya dhoond rahe ho", "What are you looking for"], ["Location sharing", "Location sharing"], ["Logout / doosra account", "Logout / other account"],
  ["Mail dobara bhejo", "Resend email"], ["Maine verify kar liya", "I have verified"], ["Mere baare me", "About me"], ["Meri banayi dhunein", "My tunes"], ["Message bhejo", "Send message"],
  ["Message likho...", "Type a message..."], ["Mood: AI chune", "Mood: let AI pick"], ["Naam", "Name"], ["Naya account", "New account"], ["ON hone par hi aap Nearby me dikhoge", "You appear in Nearby only when this is ON"],
  ["Pyaar", "Love"], ["Save karo", "Save"], ["Shaanti", "Calm"], ["Sheher", "City"], ["Swipe karte raho", "Keep swiping"], ["Udaas", "Sad"], ["Umar (18+)", "Age (18+)"], ["Uthao", "Answer"],
  ["Wapas", "Back"], ["kam se kam 6 akshar", "at least 6 characters"], ["Chalao", "Play"], ["Dabake bolo", "Hold to talk"], ["Feed pe", "To feed"], ["Doston ko bulao (invite link)", "Invite friends (link)"],
  ["Nearby (aapki marzi)", "Nearby (your choice)"], ["Live chat", "Live chat"], ["Gaana Studio", "Song Studio"], ["Gaana", "Songs"], ["Saathi AI", "Saathi AI"],
  // --- JS: toasts, notices, labels
  [" (Pulse match) se milne ja raha/rahi hoon. Jagah/samay: ", " (a Pulse match). Place/time: "], [" Kripya 1 ghante baad mujhe call karke check karna.", " Please call to check on me after 1 hour."], ["Safety check: main ", "Safety check: I am going to meet "],
  [" AI Mediator chahte hain. Haan = dono ki chat ke aakhri 12 msg AI padhega.", " wants an AI Mediator. Yes = the AI will read the last 12 messages of your chat."], ["Haan", "Yes"], ["Naa", "No"],
  [" din pehle", " days ago"], [" ghante pehle", " hours ago"], [" min pehle", " min ago"], ["abhi", "just now"], [" ke saath: ", " with: "], ["Block karo", "Block"], ["Report karo", "Report"], ["Safe meet", "Safe meet"],
  ["Pehli mulaqat: din me, public jagah, kisi apne ko batakar.", "First meeting: daytime, public place, tell someone you trust."],
  [" ki dhun", " tune"], [" log (live)", " people (live)"], [" ne bhi aapko like kiya 💜", " liked you back 💜"], [" par bheji hai. Mail me link par click karo (Spam folder bhi dekho), phir niche button dabao.", ". Click the link in the email (check Spam too), then press the button below."],
  [" sec · AI bol + browser me bani dhun", " sec · AI lyrics + tune made in your browser"], [" 🙏 Main Saathi hoon, ek AI. Din kaisa raha?", " 🙏 I'm Saathi, an AI. How was your day?"],   ["Abhi itne hi log", "That's everyone for now"], ["Jaise-jaise naye log judenge, yahan dikhenge. Doston ko Pulse bhejo!", "New people will show up here as they join. Send Pulse to your friends!"],
  ["Abhi aas-paas (50 km) koi aur opt-in user nahi. Doston ko bulao! 👋", "No other opt-in users within 50 km yet. Invite your friends! 👋"], ["Invite bhejo", "Send invite"],
  ["Abhi koi chat nahi. Discover me swipe karo. Match hote hi chat yahan khulegi.", "No chats yet. Swipe in Discover. The chat opens here as soon as you match."],
  ["Abhi koi dhun nahi. Upar idea likho aur pehla gaana banao 🎶", "No tunes yet. Write an idea above and make your first song 🎶"], ["Abhi koi post nahi. Pehli post aap likho! ✍️", "No posts yet. Be the first to post! ✍️"],
  ["Live: aapki location ON hai. Sirf opt-in log dikh rahe hain.", "Live: your location is ON. Only opt-in people are shown."], ["Band karo", "Stop"], ["Abhi aas-paas · ", "Nearby now · "],
  ["Aas-paas ke log", "People nearby"], ["Apni location share karke un logon ko dekho jinhone ", "Share your location to see people who turned sharing ON "], ["khud", "themselves"], [" bhi sharing ON ki hai.", "."],
  ["Aapki marzi:", "Your choice:"], [" Sirf aap jab chaho tab share hoga. Jinhone share nahi kiya, unki location, naam ya number kabhi nahi dikhega. Share karne par aapki location lagbhag 1 km ke daayre me ", " Shared only when you choose. People who haven't shared never appear: no location, name or number. When you share, your location is saved only roughly, within about 1 km, "],
  ["mota-mota", "approximately"], [" (rounded) save hoti hai, aur doosre opt-in logon ko sirf doori dikhti hai. Kabhi bhi band kar sakte ho.", " and other opt-in people only see the distance. You can stop anytime."], ["Location share karo", "Share location"],
  ["Dekha", "Seen"], ["Match ho gaya! Pehla message aap bhejo 👋", "It's a match! Send the first message 👋"], ["Match ho gaya! Hi bolo 👋", "It's a match! Say hi 👋"],
  ["Doosre ki haan ka intezaar...", "Waiting for their yes..."], ["Radd karo", "Cancel"], ["Mediator ON (dono ki marzi). Kabhi bhi band kar sakte ho.", "Mediator ON (both agreed). You can turn it off anytime."], ["Madad maango", "Ask for help"],
  ["AI Mediator: jab dono haan kahein tabhi ye chat padhta hai.", "AI Mediator: it reads this chat only when both of you say yes."], ["Mediator bulao", "Call Mediator"],
  ["Savdhan: paisa, OTP ya bank details kabhi mat bhejo. Shak ho to Report karo.", "Careful: never send money, OTP or bank details. Report if suspicious."],
  ["AI abhi band hai, isliye simple template se bana. (Firebase me AI Logic ON karoge to asli AI bol aayenge.)", "AI is off right now, so this was made from a simple template. (Turn on AI Logic in Firebase for real AI lyrics.)"],
  ["AI abhi band hai, to ek simple tareeka:", "AI is off right now, so here is a simple method:"], ["Ek-ek karke apni baat 'main ... mehsoos karta/karti hoon' se shuru karo.", "Take turns and start with 'I feel ...'."],
  ["Doosre ko bina beech me toke poora suno.", "Listen to the other person fully without interrupting."], ["Jahan sehmat ho wo likho, phir ek chhota hal chuno.", "Write down where you agree, then pick one small solution."],
  ["Dhamki ya zabardasti lage to Block/Report karo.", "If you feel threatened or pressured, Block/Report."], ["AI band: simple jawab", "AI off: simple reply"], ["AI bol likh raha hai...", "AI is writing lyrics..."], ["AI ne bol likhe ✦", "AI wrote the lyrics ✦"], ["AI online ✦", "AI online ✦"],
  ["Aaj phir ", "Once again "], [" ki yaad aayi", " came to mind"], ["Dil ne chupke se awaaz lagayi", "My heart called out softly"], ["Raaton ke saath chalti hai ", "Along with the nights walks "], ["Subah ne naye rang bikhraye", "The morning spread new colours"],
  ["Chal chal re dil, chal chal re", "Walk on, my heart, walk on"], ["Har pal naya safar hai", "Every moment is a new journey"], ["Tu hai to sab sundar hai", "With you, everything is beautiful"], ["Raaste mushkil sahi, par haunsla hai", "The road is hard, but I have courage"], ["Ek muskaan se roshan jahan hai", "One smile lights up the world"],
  ["Aapne kaha: \"", "You said: \""], [". Ye sunke dhyaan aaya. Is baat me sabse bhaari kya lag raha hai? 💜", ". That made me pause. What feels heaviest about this? 💜"],
  ["Main samajh raha hoon. Chalo ek chhoti si cheez: abhi 3 gehri saansein lo, phir mujhe bataao kya sabse pehle theek karna chahoge? 🌱", "I understand. One small thing: take 3 deep breaths, then tell me what you'd like to fix first. 🌱"],
  ["Bilkul, aap jaldi mein nahi ho. Is baat ka koi ek pal batao jab sab thoda halka laga tha? ✨", "Of course, there's no rush. Tell me one moment when things felt a little lighter? ✨"],
  ["Ye bahut kuch hai sambhalne ko. Isme se kaunsi cheez aapke control me hai aur kaunsi nahi? 🤝", "That's a lot to carry. Which part is in your control and which isn't? 🤝"], ["Sun raha hoon. Thoda aur khol ke bataoge? Kab se aisa lag raha hai? 🙂", "I'm listening. Can you tell me a bit more? Since when have you felt this way? 🙂"],
  ["Mujhe aapki fikr ho rahi hai, aur aap ye baat share kar paaye, ye zaroori hai. 💜 Main AI hoon aur is waqt aapko asli insaan ka saath chahiye. Abhi kisi apne ko phone karo ya unke paas chale jao, aur apne sheher ki madad-sewa se baat karo. Kya aap abhi surakshit jagah par ho?",
    "I'm worried about you, and it matters that you shared this. 💜 I'm an AI and right now you need a real person with you. Call someone close to you or go to them, and reach out to help services in your city. Are you in a safe place right now?"],
  ["Abhi verify nahi hua. Mail ka link kholo, phir dobara dabao.", "Not verified yet. Open the link in the email, then press again."], ["Account banao", "Create account"], ["App abhi set nahi hui (firebase-config.json khaali hai).", "App is not set up yet (firebase-config.json is empty)."],
  ["Bahut koshish ho gayi. Thodi der baad try karo.", "Too many attempts. Try again later."], ["Ban raha hai...", "Making..."], ["Block kar diya", "Blocked"], ["Call jud nahi paayi", "Could not connect the call"], ["Call khatam", "Call ended"], ["Call nahi uthi", "Call not answered"], ["Call · ", "Call · "],
  ["Chat se report", "Reported from chat"], ["Config nahi mili (firebase-config.json).", "Config not found (firebase-config.json)."], ["Connection nahi ban paya (network). Dobara try karo.", "Could not connect (network). Please try again."], ["Copy ho gaya. Apne bharose ke insaan ko bhejo 📋", "Copied. Send it to someone you trust 📋"],
  ["Dil ki baat karo. Main AI hoon, sunne ke liye yahin hoon 💜", "Talk about anything. I'm an AI, here to listen 💜"], ["Dono ne haan kaha. AI Mediator ON.", "Both said yes. AI Mediator ON."], ["Email sahi likho.", "Enter a valid email."], ["Email ya password galat hai.", "Wrong email or password."],
  ["Feed pe post ho gaya 🎉", "Posted to feed 🎉"], ["Hamesha online", "Always online"], ["Internet check karo.", "Check your internet."], ["Internet nahi hai. Message wapas aate hi chale jaayenge.", "You're offline. Messages will send when you're back."], ["Invite link copy ho gaya 📋", "Invite link copied 📋"],
  ["Is browser me call nahi chalti. Chrome/Android app use karo.", "Calls don't work in this browser. Use Chrome or the Android app."], ["Jawab nahi mila", "No answer"], ["Jud rahe hain...", "Connecting..."], ["Kahan aur kab milna hai? (jaise: Phoenix Mall, Lucknow, kal 5 baje)", "Where and when are you meeting? (e.g. Phoenix Mall, Lucknow, tomorrow 5 pm)"],
  ["Kuch gadbad ho gayi", "Something went wrong"], ["Location ON", "Location ON"], ["Location ki permission nahi mili. Browser/phone settings me allow karo.", "Location permission denied. Allow it in browser/phone settings."], ["Location maangi ja rahi hai...", "Requesting location..."], ["Location sharing band", "Location sharing stopped"],
  ["Logout ho gaye", "Logged out"], ["Mail bhej di gayi.", "Email sent."], ["Mediator band kar diya gaya.", "Mediator turned off."], ["Mediator ki request bheji gayi. Doosre ki haan chahiye.", "Mediator request sent. The other person must agree."], ["Mediator ki request radd.", "Mediator request declined."], ["Meri dhun", "My tune"],
  ["Mic ki permission chahiye. Browser settings me allow karo.", "Microphone permission needed. Allow it in browser settings."], ["Mic ki permission chahiye", "Microphone permission needed"], ["Naam likho", "Enter your name"], ["Password kam se kam 6 akshar ka rakho.", "Password must be at least 6 characters."],
  ["Pehle Discover me match karo, phir chat khulega 💜", "Match in Discover first, then chat opens 💜"], ["Pehle gaane ka idea likho", "Write a song idea first"], ["Pehle thodi baat to karo", "Chat a little first"], ["Post ho gaya 🎉", "Posted 🎉"], ["Profile nahi mili. Naya account banao.", "Profile not found. Create a new account."],
  ["Profile save ho gayi ✅", "Profile saved ✅"], ["Pulse member", "Pulse member"], ["Pulse pe aao: dosti, dating, gaana aur live chat. Join karo:", "Join me on Pulse: friends, dating, songs and live chat:"], ["Report bhej di. Shukriya.", "Report sent. Thank you."], ["Ring ho rahi hai...", "Ringing..."],
  ["Setup baaki hai: public/firebase-config.json me Firebase ki details bharo.", "Setup pending: fill in the Firebase details in public/firebase-config.json."], ["Soch raha hai...", "Thinking..."], ["Thodi der ruko (1 minute), phir dobara bhejo.", "Wait a minute, then resend."], ["Unmute", "Unmute"],
  ["Verification mail ", "Verification email sent to "], ["WAV download ho gaya ⬇", "WAV downloaded ⬇"], ["Wapas online 🟢", "Back online 🟢"], ["Ye app sirf 18+ ke liye hai", "This app is for 18+ only"], ["Ye email pehle se registered hai. Login karo.", "This email is already registered. Please log in."],
  ["Ye karne ki ijazat nahi hai.", "You are not allowed to do this."], ["Ye user available nahi hai", "This user is not available"], ["likh raha hai...", "typing..."], ["⏹ Roko", "⏹ Stop"], ["Roko", "Stop"], ["Naya match: ", "New match: "], ["Bol rahe ho...", "Talking..."],
  ["Aapko call aa rahi hai", "Incoming call"], ["Jawab", "Answer"], ["Walkie-talkie aa raha hai", "Incoming walkie-talkie"], ["Missed call", "Missed call"],
  ["⚠️ Safety: paisa, OTP, bank details, phone number ya link bhejna risky ho sakta hai. Pehle bharosa banao. Phir bhi bhejna hai?", "⚠️ Safety: sending money, OTP, bank details, a phone number or a link can be risky. Build trust first. Send anyway?"],
  ["Saathi ek AI companion hai, asli insaan nahi. Ye baat karne aur sunne ke liye hai, doctor ya counsellor ka vikalp nahi. Zyada pareshan ho to kisi apne se ya helpline se zaroor baat karo.", "Saathi is an AI companion, not a real person. It is for talking and listening, not a substitute for a doctor or counsellor. If you are very upset, please talk to someone close or a helpline."],
  ["Sirf wahi dikhta", "Only"], ["Mediator", "Mediator"], ["Sab kuch", "Everything"], ["Abhi", "Now"]
];

// Naye (English-first) feature ke liye Hindi
var EN2HI = [
  ["Friendship", "Dosti"], ["Dating", "Dating"], ["Marriage", "Shaadi"], ["Job seeker", "Naukri dhoondne wala"], ["Recruiter", "Recruiter (naukri dene wala)"], ["Candidates", "Umeedwar"], ["My jobs", "Meri jobs"], ["Post job", "Job daalo"], ["Publish job", "Job publish karo"], ["Jobs", "Jobs"], ["Applied", "Apply kiya"], ["Invites", "Nyote"], ["Apply", "Apply karo"], ["Withdraw", "Wapas lo"], ["Shortlist", "Shortlist karo"], ["Reject", "Mana karo"], ["Applicants", "Aavedak"], ["Invite to apply", "Apply karne bulao"], ["Accept & apply", "Maano aur apply karo"], ["Decline", "Mana karo"], ["Message", "Message"], ["Profile", "Profile"], ["Close", "Band karo"], ["Reopen", "Dobara kholo"], ["Delete", "Hatao"], ["All fields", "Sabhi kshetra"], ["Any type", "Koi bhi type"], ["City", "Shahar"], ["Job title *", "Job ka naam *"], ["Company", "Company"], ["Job description", "Job ka vivaran"], ["Salary range (optional)", "Vetan seema (zaroori nahi)"], ["Skills (comma separated)", "Hunar (comma se alag)"], ["Min. experience (years)", "Kam se kam anubhav (saal)"], ["Filters (age, religion, status, city)", "Filter (umr, dharm, sthiti, shahar)"], ["Forgot password?", "Password bhool gaye?"], ["Blocked people", "Block kiye hue log"], ["Unblock", "Unblock karo"], ["Report", "Report karo"], ["Block", "Block karo"], ["Never pay money to get a job or interview. Real employers do not charge fees. Report any job that asks for payment.", "Naukri ya interview ke liye kabhi paisa mat do. Asli employer fees nahi lete. Paisa maangne wali job ko report karo."], ["Email, phone and private details are never shown to other members.", "Email, phone aur private jaankari kisi aur member ko kabhi nahi dikhti."], ["Pause my profile", "Meri profile roko"], ["Profile paused", "Profile roki gayi"], ["Profile visible", "Profile dikh rahi hai"], ["Applied ✅", "Apply ho gaya ✅"], ["Job published ✅", "Job publish ho gayi ✅"], ["No jobs match yet. Change the filters or check back soon.", "Abhi koi job nahi mili. Filter badlo ya baad me dekho."], ["You have not applied to any job yet.", "Aapne abhi kisi job par apply nahi kiya."], ["No invitations right now.", "Abhi koi nyota nahi."], ["No applicants yet.", "Abhi koi aavedak nahi."], ["Loading...", "Load ho raha hai..."], ["Hiring", "Hiring"], ["Matches", "Rishte"], ["Please keep Pulse respectful. Abusive messages can lead to a ban.", "Pulse par izzat se baat karo. Gaali dene par ban ho sakta hai."],
  ["Bhajan Room", "Bhajan Room"], ["Create room", "Room banao"], ["Join with code", "Code se judo"], ["Room code", "Room code"], ["Invite to room", "Room me bulao"], ["Offer flower", "Phool arpit karo"], ["Next line", "Agli line"], ["Previous line", "Pichhli line"],
  ["Start drone and rhythm", "Dhun aur taal chalao"], ["Stop sound", "Awaaz band karo"], ["Leave room", "Room chhodo"], ["Close room", "Room band karo"], ["people singing", "log bhajan kar rahe hain"], ["Choose a bhajan", "Bhajan chuno"], ["Your own bhajan (one line per row)", "Apna bhajan (har line alag)"],
  ["Room name", "Room ka naam"], ["Only the host moves the lines. Everyone sees the same line live.", "Sirf host line badalta hai. Sabko wahi line live dikhti hai."], ["Photo", "Photo"], ["Send photo", "Photo bhejo"], ["Emoji", "Emoji"], ["Creator Panel", "Creator Panel"],
  ["Language", "Bhasha"], ["Today's Darshan", "Aaj ke Darshan"], ["Start Aarti room here", "Yahan Aarti room shuru karo"], ["Dham Darshan", "Dham Darshan"], ["Privacy Policy & Terms", "Privacy Policy aur Terms"], ["Delete my account", "Mera account delete karo"], ["Enable notifications", "Notification chalu karo"], ["Profile photo", "Profile photo"], ["Meet safely", "Safe meet"], ["Today", "Aaj"]
];

var lang = "en";
try { lang = localStorage.getItem("pulse_lang") || "en"; } catch (e) {}
export function getLang() { return lang; }
export function setLang(l) { try { localStorage.setItem("pulse_lang", l); } catch (e) {} location.reload(); }

var list = null;
function build() {
  var src = lang === "en" ? HI2EN : EN2HI.map(function (p) { return p; });
  list = src.slice().sort(function (a, b) { return b[0].length - a[0].length; });
}
export function tr(s) {
  if (!s || typeof s !== "string" || (lang === "hi" && !EN2HI.length)) return s;
  if (!list) build();
  var t = s.trim(); if (!t) return s;
  for (var i = 0; i < list.length; i++) if (list[i][0] === t) return s.replace(t, list[i][1]);
  var out = s;
  for (var j = 0; j < list.length; j++) { var k = list[j][0]; if (k.length >= 10 && list[j][1].indexOf(k) < 0 && out.indexOf(k) >= 0) out = out.split(k).join(list[j][1]); }
  return out;
}
var SKIP = "[data-notr],.bubble,.post-text,.ln,.sec,#stTitle,.about,textarea,input,script,style,.nm";
function skip(n) { var e = n.nodeType === 1 ? n : n.parentElement; return !e || !!(e.closest && e.closest(SKIP)); }
function doText(n) { if (skip(n)) return; var v = n.nodeValue, r = tr(v); if (r !== v) n.nodeValue = r; }
var ATTRS = ["placeholder", "title", "aria-label"];
function doEl(e) {
  if (e.nodeType !== 1) return;
  ATTRS.forEach(function (a) { var v = e.getAttribute && e.getAttribute(a); if (v) { var r = tr(v); if (r !== v) e.setAttribute(a, r); } });
  var w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT, null); var n; while ((n = w.nextNode())) doText(n);
  e.querySelectorAll && e.querySelectorAll("[placeholder],[title],[aria-label]").forEach(function (x) { ATTRS.forEach(function (a) { var v = x.getAttribute(a); if (v) { var r = tr(v); if (r !== v) x.setAttribute(a, r); } }); });
}
export function initI18n() {
  document.documentElement.lang = lang === "en" ? "en" : "hi";
  var run = function () { doEl(document.body); };
  run();
  new MutationObserver(function (ms) { ms.forEach(function (m) { if (m.type === "characterData") doText(m.target); else if (m.type === "attributes") { var e = m.target, v = e.getAttribute(m.attributeName), r = tr(v); if (v && r !== v) e.setAttribute(m.attributeName, r); } else m.addedNodes.forEach(function (n) { if (n.nodeType === 3) doText(n); else doEl(n); }); }); })
    .observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}
