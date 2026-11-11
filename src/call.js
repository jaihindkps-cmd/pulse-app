// Voice call (WebRTC). Signaling Firestore ke messages se hoti hai (koi server nahi). Awaaz seedhi dono phone ke beech jaati hai.
var ICE = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

export function supported() { return !!(window.RTCPeerConnection && navigator.mediaDevices && navigator.mediaDevices.getUserMedia); }

export function getMic() {
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
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
