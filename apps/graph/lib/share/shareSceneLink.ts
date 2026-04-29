import { deserializeScene } from "@/lib/scene/deserializeScene";
import {
  validateSceneJsonTextLength,
  validateSharePayloadLength
} from "@/lib/scene/importPayloadLimits";
import { serializeScene } from "@/lib/scene/serializeScene";
import type { SceneDocument } from "@/lib/scene/sceneSchema";

export const SCENE_SHARE_QUERY_PARAM = "scene";
export const DEFAULT_MAX_SHARE_URL_LENGTH = 6000;

export interface ShareLinkResult {
  ok: boolean;
  url?: string;
  error?: string;
}

export interface SharedSceneDecodeResult {
  ok: boolean;
  scene?: SceneDocument;
  error?: string;
}

export function buildShareSceneUrl(options: {
  scene: SceneDocument;
  baseUrl: string;
  maxUrlLength?: number;
}): ShareLinkResult {
  const payload = encodeSceneToPayload(options.scene);
  const url = new URL(options.baseUrl);
  url.searchParams.set(SCENE_SHARE_QUERY_PARAM, payload);
  const nextUrl = url.toString();
  const maxLength = options.maxUrlLength ?? DEFAULT_MAX_SHARE_URL_LENGTH;

  if (nextUrl.length > maxLength) {
    return {
      ok: false,
      error: "This scene is too large for a share link. Use JSON export instead."
    };
  }

  return {
    ok: true,
    url: nextUrl
  };
}

export function decodeSharedScenePayload(payload: string): SharedSceneDecodeResult {
  if (typeof payload !== "string" || payload.trim().length === 0) {
    return {
      ok: false,
      error: "Share link payload is missing."
    };
  }
  const payloadLengthError = validateSharePayloadLength(payload);
  if (payloadLengthError) {
    return {
      ok: false,
      error: payloadLengthError
    };
  }

  let jsonText: string;
  try {
    jsonText = decodePayloadToJson(payload);
  } catch {
    return {
      ok: false,
      error: "Share link payload is malformed. Copy the full link again or use JSON import."
    };
  }
  const jsonLengthError = validateSceneJsonTextLength(jsonText);
  if (jsonLengthError) {
    return {
      ok: false,
      error: `${jsonLengthError} Use JSON export instead.`
    };
  }

  const parsed = deserializeScene(jsonText);
  if (!parsed.valid || !parsed.normalizedScene) {
    return {
      ok: false,
      error: `${parsed.errors.join(" ")} Use JSON import if this link is outdated.`
    };
  }

  return {
    ok: true,
    scene: parsed.normalizedScene
  };
}

export function readSharedSceneFromSearch(search: string): SharedSceneDecodeResult | null {
  const params = new URLSearchParams(search);
  const payload = params.get(SCENE_SHARE_QUERY_PARAM);
  if (!payload) {
    return null;
  }
  return decodeSharedScenePayload(payload);
}

function encodeSceneToPayload(scene: SceneDocument): string {
  const jsonText = serializeScene(scene);
  const utf8Bytes = new TextEncoder().encode(jsonText);
  return base64UrlEncode(utf8Bytes);
}

function decodePayloadToJson(payload: string): string {
  const bytes = base64UrlDecode(payload);
  return new TextDecoder().decode(bytes);
}

function base64UrlEncode(bytes: Uint8Array): string {
  const base64 = bytesToBase64(bytes);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return base64ToBytes(padded);
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  let binary = "";
  bytes.forEach((value) => {
    binary += String.fromCharCode(value);
  });
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
