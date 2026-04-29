import { describe, expect, it } from "vitest";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import {
  createSceneDocument,
  CURRENT_SCENE_SCHEMA_VERSION,
  SCENE_DOCUMENT_VERSION
} from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";

describe("scene schema versioning and migration", () => {
  it("serializes current scenes with schemaVersion metadata", () => {
    const scene = createSceneDocument({
      metadata: {
        name: "Schema Scene",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      },
      objects: [createSurfaceGraph({ id: "surface-a", equation: "x + y" })]
    });

    const serialized = serializeScene(scene);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;

    expect(parsed.schemaVersion).toBe(CURRENT_SCENE_SCHEMA_VERSION);
    expect(parsed.version).toBe(SCENE_DOCUMENT_VERSION);
  });

  it("deserializes current schema version scene documents", () => {
    const scene = createSceneDocument({
      metadata: {
        name: "Current Scene",
        createdAt: "2026-01-02T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z"
      },
      objects: [createSurfaceGraph({ id: "surface-b", equation: "x * y" })]
    });

    const result = deserializeScene(serializeScene(scene));

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.normalizedScene?.schemaVersion).toBe(CURRENT_SCENE_SCHEMA_VERSION);
    expect(result.normalizedScene?.metadata.name).toBe("Current Scene");
    expect(result.normalizedScene?.objects).toHaveLength(1);
  });

  it("migrates missing schemaVersion legacy documents", () => {
    const legacyScene = {
      version: SCENE_DOCUMENT_VERSION,
      metadata: {
        name: "Legacy Scene",
        createdAt: "2026-01-03T00:00:00.000Z",
        updatedAt: "2026-01-03T00:00:00.000Z"
      },
      objects: [
        {
          id: "surface-c",
          kind: "surface",
          equation: "x + y",
          visible: true,
          color: "#3b82f6",
          domain: {
            xMin: -5,
            xMax: 5,
            yMin: -5,
            yMax: 5
          },
          resolution: 32,
          appearance: {
            wireframe: false
          }
        }
      ]
    };

    const result = deserializeScene(JSON.stringify(legacyScene));

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.normalizedScene?.schemaVersion).toBe(CURRENT_SCENE_SCHEMA_VERSION);
    expect(result.normalizedScene?.metadata.name).toBe("Legacy Scene");
    expect(result.normalizedScene?.objects[0]?.kind).toBe("surface");
  });

  it("rejects unsupported future schema versions safely", () => {
    const futureScene = {
      schemaVersion: CURRENT_SCENE_SCHEMA_VERSION + 1,
      version: SCENE_DOCUMENT_VERSION,
      metadata: {
        name: "Future Scene",
        createdAt: "2026-01-04T00:00:00.000Z",
        updatedAt: "2026-01-04T00:00:00.000Z"
      },
      objects: []
    };

    const result = deserializeScene(JSON.stringify(futureScene));

    expect(result.valid).toBe(false);
    expect(result.normalizedScene).toBeUndefined();
    expect(result.errors[0]).toContain("Unsupported scene schema version");
  });

  it("rejects malformed scene documents", () => {
    const malformedScene = {
      schemaVersion: CURRENT_SCENE_SCHEMA_VERSION,
      version: SCENE_DOCUMENT_VERSION,
      metadata: {
        name: "Malformed Scene",
        createdAt: "2026-01-05T00:00:00.000Z",
        updatedAt: "2026-01-05T00:00:00.000Z"
      },
      objects: {}
    };

    const result = deserializeScene(JSON.stringify(malformedScene));

    expect(result.valid).toBe(false);
    expect(result.normalizedScene).toBeUndefined();
    expect(result.errors).toContain("objects must be an array.");
  });
});
