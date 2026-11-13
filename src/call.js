// Voice/video call (WebRTC). Signaling Firestore ke messages se hoti hai (koi server nahi).
// Media (awaaz/video) seedhi dono phone ke beech peer-to-peer jaati hai -- kabhi Pulse ke server se nahi guzarti.
// WebRTC har connection ko DTLS-SRTP se compulsory encrypt karta hai, isliye ye already end-to-end encrypted hai
// (Firestore sirf signaling -- offer/answer handshake -- carry karta hai, kabhi actual audio/video nahi).
var ICE = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

export function supported() { return !!(window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

export function getMic() { return getMedia(false); }

export function getMedia(withVideo) {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: withVideo ? { facingMode: "user", width: { ideal: 480 }, height: { ideal: 640 } } : false
  });
}

// ---- Screen Wake Lock: screen ko auto-sleep se roke taaki call ke beech awaaz/video band na ho.
// Note: phone ka power button manually daba kar lock karne par browser/OS khud call ko suspend kar sakta
// hai -- is limit ko koi web page JS se poora nahi hata sakta, sirf native app (foreground service) se hota hai.
var wakeLock = null;
export function requestWakeLock() {
  try {
    if (!("wakeLock" in navigator)) return Promise.resolve(null);
    return navigator.wakeLock.request("screen").then(function (wl) { wakeLock = wl; return wl; }).catch(function () { return null; });
  } catch (e) { return Promise.resolve(null); }
}
export function releaseWakeLock() { try { if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; } } catch (e) {} }
export function reacquireWakeLockIfNeeded() {
  if (wakeLock && document.visibilityState === "visible") { try { requestWakeLock(); } catch (e) {} }
}

// ---- Media Session: Android/Chrome ko batata hai ye ek active media session hai, background me chalu rakhne me madad karta hai.
export function setMediaSession(title) {
  try {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: title || "Pulse Call", artist: "Pulse" });
    navigator.mediaSession.playbackState = "playing";
  } catch (e) {}
}
export function clearMediaSession() {
  try { if ("mediaSession" in navigator) { navigator.mediaSession.playbackState = "none"; navigator.mediaSession.metadata = null; } } catch (e) {}
}

function waitIce(pc, ms) {
  return new Promise(function (res) {
    if (pc.iceGatheringState === "complete") return res();
    var t = setTimeout(done, ms);
    function chk() { if (pc.iceGatheringState === "complete") done(); }
    function done() { clearTimeout(t); pc.removeEventListener("icegatheringstatechange", chk); res(); }
    pc.addEventListener("icegatheringstatechange", chk);
  });
}

function mk(stream, onTrack, onState) {
  var pc = new RTCPeerConnection(ICE);
  stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });
  pc.ontrack = function (e) { onTrack(e.streams[0] || new MediaStream([e.track])); };
  pc.onconnectionstatechange = function () { onState(pc.connectionState); };
  return pc;
}

export async function makeOffer(stream, onTrack, onState) {
  var pc = mk(stream, onTrack, onState);
  await pc.setLocalDescription(await pc.createOffer());
  await waitIce(pc, 3500);
  return { pc: pc, sdp: pc.localDescription.sdp };
}

export async function makeAnswer(stream, offerSdp, onTrack, onState) {
  var pc = mk(stream, onTrack, onState);
  await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });
  await pc.setLocalDescription(await pc.createAnswer());
  await waitIce(pc, 3500);
  return { pc: pc, sdp: pc.localDescription.sdp };
}

export function applyAnswer(pc, sdp) { return pc.setRemoteDescription({ type: "answer", sdp: sdp }); }
