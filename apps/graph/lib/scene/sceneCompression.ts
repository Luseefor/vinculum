import { deflateSync, Inflate } from "fflate";
import { MAX_SCENE_JSON_LENGTH, MAX_SHARE_PAYLOAD_LENGTH } from "./importPayloadLimits";

const PREFIX = "z1.";
const MAX_BYTES = MAX_SCENE_JSON_LENGTH * 4;

export function encodeSceneText(text: string): string {
  const bytes = new TextEncoder().encode(text);
  if (text.length > MAX_SCENE_JSON_LENGTH || bytes.length > MAX_BYTES) throw new Error("Scene payload is too large. Use a smaller scene.");
  const raw = base64(bytes);
  const compressed = `${PREFIX}${bytes.length}.${base64(deflateSync(bytes, { level: 6 }))}`;
  return compressed.length < raw.length ? compressed : raw;
}

/** Legacy base64 remains readable; streaming expansion is stopped before its allocation cap. */
export function decodeSceneText(payload: string): string {
  if (payload.length > MAX_SHARE_PAYLOAD_LENGTH) throw new Error("Scene payload is too large.");
  if (!payload.startsWith(PREFIX)) return new TextDecoder("utf-8", { fatal: true }).decode(unbase64(payload));
  const separator = payload.indexOf(".", PREFIX.length);
  const sizeText = payload.slice(PREFIX.length, separator);
  const size = Number(sizeText);
  if (separator < 0 || !/^\d+$/.test(sizeText) || !Number.isSafeInteger(size) || size < 1 || size > MAX_BYTES) throw new Error("Invalid compressed scene size.");
  const input = unbase64(payload.slice(separator + 1));
  const output = new Uint8Array(size);
  let written = 0;
  const inflater = new Inflate(chunk => {
    if (written + chunk.length > size) throw new Error("Compressed scene exceeds its declared size.");
    output.set(chunk, written); written += chunk.length;
  });
  for (let offset = 0; offset < input.length; offset += 1024) inflater.push(input.subarray(offset, offset + 1024), offset + 1024 >= input.length);
  if (!input.length || written !== size) throw new Error("Compressed scene is incomplete.");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(output);
  if (text.length > MAX_SCENE_JSON_LENGTH) throw new Error("Scene payload is too large.");
  return text;
}

export function packStoredScene(text: string): string {
  const packed = encodeSceneText(text);
  return packed.startsWith(PREFIX) && packed.length < text.length ? packed : text;
}

export function unpackStoredScene(text: string): string {
  return text.startsWith(PREFIX) ? decodeSceneText(text) : text;
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function unbase64(value: string): Uint8Array {
  if (!/^[\w-]+$/.test(value) || value.length % 4 === 1) throw new Error("Malformed scene encoding.");
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
