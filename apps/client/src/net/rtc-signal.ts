/**
 * The text two phones swap (by QR code) to open a WebRTC connection without a
 * server: the session description, deflated and base64url'd, behind a letter
 * for its type (o = offer, a = answer).
 */
export interface Signal {
  type: "offer" | "answer";
  sdp: string;
}

async function pipe(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function encodeSignal(signal: Signal): Promise<string> {
  const packed = await pipe(new TextEncoder().encode(signal.sdp), new CompressionStream("deflate-raw"));
  return (signal.type === "offer" ? "o" : "a") + toBase64Url(packed);
}

/** Reads a code back; throws on anything that is not one. */
export async function decodeSignal(code: string): Promise<Signal> {
  const kind = code.trim()[0];
  const type = kind === "o" ? "offer" : kind === "a" ? "answer" : null;
  if (!type) throw new Error("Código inválido");
  const sdp = new TextDecoder().decode(await pipe(fromBase64Url(code.trim().slice(1)), new DecompressionStream("deflate-raw")));
  if (!sdp.startsWith("v=0")) throw new Error("Código inválido");
  return { type, sdp };
}
