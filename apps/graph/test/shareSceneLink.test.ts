import { describe, expect, it } from "vitest";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import {
  buildShareSceneUrl,
  decodeSharedScenePayload,
  readSharedSceneFromSearch
} from "@/lib/share/shareSceneLink";
import { MAX_SHARE_PAYLOAD_LENGTH } from "@/lib/scene/importPayloadLimits";
import {
  createSceneDocument,
  CURRENT_SCENE_SCHEMA_VERSION
} from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { LocalProjectRepository } from "@/lib/projects/localProjectRepository";

describe("share scene links", () => {
  it("round trips a scene through canonical serialize/deserialize", () => {
    const scene = createSceneDocument({
      objects: [createSurfaceGraph({ equation: "x^2 + y^2 - 4" })],
      measurements: [
        {
          id: "pin-rt",
          kind: "pin",
          point: { x: 1, y: 2, z: 3 },
          label: "P"
        }
      ]
    });

    const built = buildShareSceneUrl({
      scene,
      baseUrl: "https://example.com/"
    });
    expect(built.ok).toBe(true);
    expect(built.url).toContain("scene=");

    const parsedUrl = new URL(built.url!);
    const decoded = decodeSharedScenePayload(parsedUrl.searchParams.get("scene") ?? "");

    expect(decoded.ok).toBe(true);
    expect(decoded.scene?.objects).toHaveLength(scene.objects.length);
    const firstObject = decoded.scene?.objects[0];
    if (!firstObject || firstObject.kind !== "surface") {
      throw new Error("Expected decoded surface object.");
    }
    expect(firstObject.equation).toBe("x^2 + y^2 - 4");
    expect(decoded.scene?.schemaVersion).toBe(CURRENT_SCENE_SCHEMA_VERSION);
    expect(decoded.scene?.measurements).toHaveLength(1);
  });

  it("preserves unicode and special characters safely", () => {
    const unicodeScene = createSceneDocument({
      metadata: {
        name: "f(θ) — café Δ",
        createdAt: "2026-04-28T00:00:00.000Z",
        updatedAt: "2026-04-28T00:00:00.000Z"
      },
      objects: [createSurfaceGraph({ equation: "sin(x) + cos(y) + π" })]
    });
    const built = buildShareSceneUrl({
      scene: unicodeScene,
      baseUrl: "https://example.com/"
    });
    const parsedUrl = new URL(built.url!);
    const decoded = decodeSharedScenePayload(parsedUrl.searchParams.get("scene") ?? "");

    expect(decoded.ok).toBe(true);
    expect(decoded.scene?.metadata.name).toBe("f(θ) — café Δ");
    const firstObject = decoded.scene?.objects[0];
    if (!firstObject || firstObject.kind !== "surface") {
      throw new Error("Expected a surface object.");
    }
    expect(firstObject.equation).toBe("sin(x) + cos(y) + π");
  });

  it("rejects malformed payloads safely", () => {
    const decoded = decodeSharedScenePayload("%%%");
    expect(decoded.ok).toBe(false);
    expect(decoded.error).toMatch(/invalid json|malformed/i);
  });

  it("rejects future schema versions via canonical validation", () => {
    const scene = createSceneDocument({
      objects: [createSurfaceGraph({ equation: "x + y" })]
    });
    const raw = JSON.parse(serializeScene(scene)) as Record<string, unknown>;
    raw.schemaVersion = CURRENT_SCENE_SCHEMA_VERSION + 10;
    const futureBuilt = buildShareSceneUrl({
      scene: scene,
      baseUrl: "https://example.com/"
    });
    const futureUrl = new URL(futureBuilt.url!);
    const payload = futureUrl.searchParams.get("scene");
    const encodedFuture = Buffer.from(JSON.stringify(raw), "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
    const decoded = decodeSharedScenePayload(encodedFuture ?? payload ?? "");

    expect(decoded.ok).toBe(false);
    expect(decoded.error).toMatch(/Unsupported scene schema version/i);
  });

  it("guards oversized URLs with JSON export fallback guidance", () => {
    const largeScene = createSceneDocument({
      objects: [createSurfaceGraph({ equation: "x".repeat(8000) })]
    });
    const built = buildShareSceneUrl({
      scene: largeScene,
      baseUrl: "https://example.com/",
      maxUrlLength: 200
    });

    expect(built.ok).toBe(false);
    expect(built.error).toMatch(/Use JSON export instead/i);
  });

  it("rejects oversized decoded share payloads safely", () => {
    const decoded = decodeSharedScenePayload("a".repeat(MAX_SHARE_PAYLOAD_LENGTH + 1));
    expect(decoded.ok).toBe(false);
    expect(decoded.error).toMatch(/too large/i);
  });

  it("shared scenes stay unnamed and can still be saved as named projects", () => {
    window.localStorage.clear();
    const repository = new LocalProjectRepository();
    const scene = createSceneDocument({
      objects: [createSurfaceGraph({ equation: "x^2" })]
    });
    const built = buildShareSceneUrl({
      scene,
      baseUrl: "https://example.com/"
    });
    const loaded = readSharedSceneFromSearch(new URL(built.url!).search);

    expect(loaded?.ok).toBe(true);
    expect(loaded && "scene" in loaded ? loaded.scene?.metadata.name : null).toBe(scene.metadata.name);

    const saved = repository.saveProject({
      name: "From shared link",
      scene: loaded && loaded.ok && loaded.scene ? loaded.scene : scene
    });

    expect(saved.name).toBe("From shared link");
    expect(saved.sceneSchemaVersion).toBe(CURRENT_SCENE_SCHEMA_VERSION);
  });
});
