import type { Wire } from "./local-host";
import { decodeSignal, encodeSignal } from "./rtc-signal";
import { routeOf } from "./rtc-route";

/** No STUN/TURN: offline play is phones on the same Wi-Fi (or one's hotspot), reached directly. */
const CONFIG: RTCConfiguration = { iceServers: [] };
/** Longest wait for the network addresses to be gathered. */
const GATHER_MS = 3000;

/** Resolves once every local network address is in the description (no server to trickle them through). */
function gathered(pc: RTCPeerConnection): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, GATHER_MS);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") done();
    });
  });
}

async function localCode(pc: RTCPeerConnection): Promise<string> {
  await gathered(pc);
  const d = pc.localDescription!;
  return encodeSignal({ type: d.type as "offer" | "answer", sdp: d.sdp });
}

/** A data channel as a Wire, ready once it opens. */
function channelWire(pc: RTCPeerConnection, channel: RTCDataChannel): Promise<Wire> {
  return new Promise((resolve, reject) => {
    let closed = false;
    let onClose = () => {};
    const close = () => {
      if (closed) return;
      closed = true;
      onClose();
    };
    channel.addEventListener("close", close);
    pc.addEventListener("connectionstatechange", () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        close();
        reject(new Error("Não deu pra conectar"));
      }
    });
    const wire: Wire = {
      send: (data) => {
        if (channel.readyState === "open") channel.send(data);
      },
      onMessage: (cb) => void (channel.onmessage = (e) => cb(String(e.data))),
      onClose: (cb) => void (onClose = cb),
      close: () => {
        channel.close();
        pc.close();
        close();
      },
      route: () => pc.getStats().then(routeOf, () => null),
    };
    if (channel.readyState === "open") resolve(wire);
    else channel.addEventListener("open", () => resolve(wire), { once: true });
  });
}

/** The host's side of pairing one friend: show `code`, then take the friend's answer code. */
export async function hostPairing(): Promise<{ code: string; accept(answer: string): Promise<Wire>; cancel(): void }> {
  const pc = new RTCPeerConnection(CONFIG);
  const channel = pc.createDataChannel("bombtop", { ordered: true });
  await pc.setLocalDescription(await pc.createOffer());
  return {
    code: await localCode(pc),
    accept: async (answer) => {
      const signal = await decodeSignal(answer);
      if (signal.type !== "answer") throw new Error("Esse é o código do anfitrião: escaneie o do amigo.");
      await pc.setRemoteDescription(signal);
      return channelWire(pc, channel);
    },
    cancel: () => pc.close(),
  };
}

/** A friend's side: read the host's code, show `code` back, and the wire opens once the host scans it. */
export async function guestPairing(offer: string): Promise<{ code: string; wire: Promise<Wire>; cancel(): void }> {
  const signal = await decodeSignal(offer);
  if (signal.type !== "offer") throw new Error("Esse é o código de um amigo: escaneie o do anfitrião.");
  const pc = new RTCPeerConnection(CONFIG);
  const channel = new Promise<RTCDataChannel>((resolve) => pc.addEventListener("datachannel", (e) => resolve(e.channel)));
  await pc.setRemoteDescription(signal);
  await pc.setLocalDescription(await pc.createAnswer());
  return {
    code: await localCode(pc),
    wire: channel.then((c) => channelWire(pc, c)),
    cancel: () => pc.close(),
  };
}

/**
 * Paired through the server (net/lan.ts) the phones are online, so a STUN server also gives each its public
 * address: phones the Wi-Fi keeps from seeing each other directly may still meet through the router.
 */
const ONLINE_CONFIG: RTCConfiguration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

/** A friend's side, paired through the server: their offer (to knock with), and the wire once the host answers. */
export async function offerToHost(): Promise<{ offer: string; connect(answer: string): Promise<Wire>; cancel(): void }> {
  const pc = new RTCPeerConnection(ONLINE_CONFIG);
  const channel = pc.createDataChannel("bombtop", { ordered: true });
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  return {
    offer: pc.localDescription!.sdp,
    connect: async (answer) => {
      await pc.setRemoteDescription({ type: "answer", sdp: answer });
      return channelWire(pc, channel);
    },
    cancel: () => pc.close(),
  };
}

/** The host's side of a knock: the answer to send back, and the friend's wire once it opens. */
export async function answerFriend(offer: string): Promise<{ answer: string; wire: Promise<Wire> }> {
  const pc = new RTCPeerConnection(ONLINE_CONFIG);
  const channel = new Promise<RTCDataChannel>((resolve) => pc.addEventListener("datachannel", (e) => resolve(e.channel)));
  await pc.setRemoteDescription({ type: "offer", sdp: offer });
  await pc.setLocalDescription(await pc.createAnswer());
  await gathered(pc);
  // A friend who never connects (gave up, other network) is let go.
  const timeout = setTimeout(() => pc.connectionState !== "connected" && pc.close(), 30_000);
  const wire = channel.then((c) => channelWire(pc, c)).finally(() => clearTimeout(timeout));
  return { answer: pc.localDescription!.sdp, wire };
}
