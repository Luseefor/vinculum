import { deserializeScene } from "@/lib/scene/deserializeScene";
import {
  validateSceneJsonTextLength,
  validateSharePayloadLength
} from "@/lib/scene/importPayloadLimits";
import { serializeScene } from "@/lib/scene/serializeScene";
import type { SceneDocument } from "@/lib/scene/sceneSchema";
import { encodeSceneText, decodeSceneText } from "@/lib/scene/sceneCompression";

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
  let payload: string;
  try {
    const json = serializeScene(options.scene);
    const validation = deserializeScene(json);
    if (!validation.valid) return { ok: false, error: `Cannot share this scene: ${validation.errors.join(" ")}` };
    payload = encodeSceneText(json);
  }
  catch { return { ok: false, error: "This scene is too large or invalid for a share link. Use JSON export instead." }; }
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
    jsonText = decodeSceneText(payload);
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
