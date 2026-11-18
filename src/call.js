// Voice/video call (WebRTC). Signaling Firestore ke messages se hoti hai (koi server nahi).
// Media (awaaz/video) seedhi dono phone ke beech peer-to-peer jaati hai -- kabhi Pulse ke server se nahi guzarti.
// WebRTC har connection ko DTLS-SRTP se compulsory encrypt karta hai, isliye ye already end-to-end encrypted hai
// (Firestore sirf signaling -- offer/answer handshake -- carry karta hai, kabhi actual audio/video nahi).
// STUN finds the public address; TURN relays the (still encrypted) media when a direct path is blocked, which is common on
// mobile data (carrier NAT). Without TURN many calls connect but carry no voice.
var ICE = { iceServers: [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  { urls: ["turn:openrelay.metered.ca:80", "turn:openrelay.metered.ca:443", "turn:openrelay.metered.ca:443?transport=tcp", "turns:openrelay.metered.ca:443?transport=tcp"], username: "openrelayproject", credential: "openrelayproject" }
] };

export function supported() { return !!(window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

export function getMic() { return getMedia(false); }

// Ask for the best camera the phone offers (4K when it can, else 1080p/720p) -- the browser picks the closest mode and the
// network later adapts the bitrate. Falls back step by step so a phone without 4K still gets a call.
export function getMedia(withVideo, facing) {
  var audio = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 };
  if (!withVideo) return navigator.mediaDevices.getUserMedia({ audio: audio, video: false });
  // 4:3 uses the camera's whole sensor, so the picture is WIDER than a 16:9 crop at the same sharpness.
  var portrait = !(window.matchMedia && window.matchMedia("(orientation: landscape)").matches), fm = { ideal: facing || "user" };
  function size(w, h) { return portrait ? { width: { ideal: h }, height: { ideal: w } } : { width: { ideal: w }, height: { ideal: h } }; }
  var tiers = [[2880, 2160], [2560, 1920], [1920, 1440], [1440, 1080], [1024, 768], [640, 480]];
  function attempt(i) {
    var v = Object.assign({ facingMode: fm, frameRate: { ideal: 30, max: 60 } }, size(tiers[i][0], tiers[i][1]));
    return navigator.mediaDevices.getUserMedia({ audio: audio, video: v }).catch(function (e) {
      if (i + 1 < tiers.length && e && (e.name === "OverconstrainedError" || e.name === "NotReadableError" || e.name === "AbortError")) return attempt(i + 1);
      throw e;
    });
  }
  return attempt(0);
}

// Ultra-wide: some phones expose zoom below 1x. Returns true if a wider view was applied.
export function wide(track, on) {
  try { var c = track.getCapabilities && track.getCapabilities(); if (!c || !c.zoom) return false; var z = on ? c.zoom.min : Math.max(1, c.zoom.min); track.applyConstraints({ advanced: [{ zoom: z }] }).catch(function () {}); return on ? c.zoom.min < 1 : true; } catch (e) { return false; }
}

// Raise the video/audio bitrate ceiling (default WebRTC caps are very low) and keep sharpness over frame rate.
export function tune(pc) {
  try {
    pc.getSenders().forEach(function (sn) {
      if (!sn.track || !sn.getParameters) return;
      var pr = sn.getParameters(); if (!pr.encodings || !pr.encodings.length) pr.encodings = [{}];
      if (sn.track.kind === "video") { pr.encodings[0].maxBitrate = 12000000; pr.encodings[0].maxFramerate = 30; pr.degradationPreference = "maintain-resolution"; try { sn.track.contentHint = "detail"; } catch (e) {} }
      else { pr.encodings[0].maxBitrate = 96000; }
      sn.setParameters(pr).catch(function () {});
    });
  } catch (e) {}
}
export function videoSender(pc) { var r = null; try { pc.getSenders().forEach(function (sn) { if (sn.track && sn.track.kind === "video") r = sn; }); } catch (e) {} return r; }

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

// Opus tuned for clear speech: 48 kHz, ~96 kbps, forward error correction on (survives packet loss), no DTX gaps.
function vbr(sdp) {
  // Ask Chrome to start high and never fall below an HD-capable floor; the congestion controller still adapts to the network.
  var add = "x-google-min-bitrate=800;x-google-start-bitrate=4000;x-google-max-bitrate=12000", i = sdp.indexOf("m=video"); if (i < 0) return sdp;
  var head = sdp.slice(0, i), vid = sdp.slice(i), re = /a=rtpmap:(\d+) (VP8|VP9|H264|AV1)\/90000/g, m, pts = [];
  while ((m = re.exec(vid))) pts.push(m[1]);
  pts.forEach(function (pt) {
    var f = new RegExp("a=fmtp:" + pt + " ([^\\r\\n]*)");
    if (f.test(vid)) vid = vid.replace(f, function (_, x) { return "a=fmtp:" + pt + " " + x + ";" + add; });
    else vid = vid.replace(new RegExp("(a=rtpmap:" + pt + " [^\\r\\n]*)"), "$1\r\na=fmtp:" + pt + " " + add);
  });
  return head + vid;
}
function hq(sdp) {
  sdp = vbr(sdp);
  var m = /a=rtpmap:(\d+) opus\/48000/.exec(sdp); if (!m) return sdp;
  var pt = m[1], re = new RegExp("a=fmtp:" + pt + " ([^\\r\\n]*)"), add = "minptime=10;useinbandfec=1;usedtx=0;stereo=0;sprop-stereo=0;maxaveragebitrate=96000;maxplaybackrate=48000";
  if (re.test(sdp)) return sdp.replace(re, function (_, f) { var keep = f.split(";").filter(function (x) { return x && !/^(minptime|useinbandfec|usedtx|stereo|sprop-stereo|maxaveragebitrate|maxplaybackrate)=/.test(x); }); return "a=fmtp:" + pt + " " + keep.concat(add.split(";")).join(";"); });
  return sdp.replace(new RegExp("(a=rtpmap:" + pt + " opus/48000[^\\r\\n]*)"), "$1\r\na=fmtp:" + pt + " " + add);
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

function mk(stream, onTrack, onState, onData) {
  var pc = new RTCPeerConnection(ICE);
  try { pc.fx = pc.createDataChannel("fx", { negotiated: true, id: 1 }); pc.fx.onmessage = function (e) { if (onData) onData(e.data); }; } catch (e) {}
  stream.getTracks().forEach(function (t) { pc.addTrack(t, stream); });
  try {
    var caps = window.RTCRtpSender && RTCRtpSender.getCapabilities && RTCRtpSender.getCapabilities("video");
    if (caps) { var rank = { "video/VP9": 0, "video/H264": 1, "video/VP8": 2 }, cs = caps.codecs.slice().sort(function (a, b) { return (rank[a.mimeType] === undefined ? 9 : rank[a.mimeType]) - (rank[b.mimeType] === undefined ? 9 : rank[b.mimeType]); });
      pc.getTransceivers().forEach(function (t) { if (t.sender && t.sender.track && t.sender.track.kind === "video" && t.setCodecPreferences) t.setCodecPreferences(cs); }); }
  } catch (e) {}
  pc.ontrack = function (e) { onTrack(e.streams[0] || new MediaStream([e.track])); };
  pc.onconnectionstatechange = function () { onState(pc.connectionState); };
  return pc;
}

export async function makeOffer(stream, onTrack, onState, onData) {
  var pc = mk(stream, onTrack, onState, onData);
  var of = await pc.createOffer(); of.sdp = hq(of.sdp); await pc.setLocalDescription(of);
  tune(pc);
  await waitIce(pc, 5000);
  return { pc: pc, sdp: pc.localDescription.sdp };
}

export async function makeAnswer(stream, offerSdp, onTrack, onState, onData) {
  var pc = mk(stream, onTrack, onState, onData);
  await pc.setRemoteDescription({ type: "offer", sdp: offerSdp });
  var an = await pc.createAnswer(); an.sdp = hq(an.sdp); await pc.setLocalDescription(an);
  tune(pc);
  await waitIce(pc, 5000);
  return { pc: pc, sdp: pc.localDescription.sdp };
}

export function applyAnswer(pc, sdp) { return pc.setRemoteDescription({ type: "answer", sdp: sdp }).then(function () { tune(pc); }); }
