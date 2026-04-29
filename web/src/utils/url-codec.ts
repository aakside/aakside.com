export type JsonLike = null | boolean | number | string | JsonLike[] | { [key: string]: JsonLike };

/** Encode a JSON value into a compact, URL-friendly string. */
export async function encodeJsonForUrl<T = JsonLike>(value: T): Promise<string> {
  const json = JSON.stringify(value);
  return await encodeCompressed(json);
}

/** Decode a string produced by encodeJsonForUrl back into the original JSON value. */
export async function decodeJsonFromUrl<T = JsonLike>(encoded: string): Promise<T> {
  if (!encoded) {
    throw new Error("Encoded value is empty.");
  }

  const version = encoded.slice(0, 2);
  const payload = encoded.slice(2);

  switch (version) {
    case "00": {
      const json = await decodeCompressed(payload);
      return JSON.parse(json) as T;
    }

    default:
      throw new Error(`Unknown codec version: ${version}`);
  }
}

async function encodeCompressed(json: string): Promise<string> {
  const bytes = new TextEncoder().encode(json);
  const compressed = await compressBytes(bytes, "deflate-raw");
  const b64url = bytesToBase64Url(compressed);
  return "00" + b64url;
}

async function decodeCompressed(payload: string): Promise<string> {
  const compressed = base64UrlToBytes(payload);
  const decompressed = await decompressBytes(compressed, "deflate-raw");
  return utf8Decode(decompressed);
}

function utf8Decode(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

async function compressBytes(input: Uint8Array, format: "deflate-raw"): Promise<Uint8Array> {
  const cs = new CompressionStream(format);
  const stream = new Blob([input as BlobPart]).stream().pipeThrough(cs);
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

async function decompressBytes(input: Uint8Array, format: "deflate-raw"): Promise<Uint8Array> {
  const ds = new DecompressionStream(format);
  const stream = new Blob([input as BlobPart]).stream().pipeThrough(ds);
  const ab = await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
}

/** Base64url encode bytes without padding. */
function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(base64url: string): Uint8Array {
  const base64 = base64url
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(base64url.length / 4) * 4, "=");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}
