import { describe, expect, it } from "vitest";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import {
  MAX_SCENE_CONSTRAINT_COUNT,
  MAX_SCENE_GROUP_COUNT,
  MAX_SCENE_JSON_LENGTH,
  MAX_SCENE_MEASUREMENT_COUNT,
  MAX_SCENE_OBJECT_COUNT
} from "@/lib/scene/importPayloadLimits";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";

describe("import payload security", () => {
  it("rejects oversized JSON import payloads", () => {
    const oversized = " ".repeat(MAX_SCENE_JSON_LENGTH + 1);
    const result = deserializeScene(oversized);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/too large/i);
  });

  it("rejects too many objects", () => {
    const objects = Array.from({ length: MAX_SCENE_OBJECT_COUNT + 1 }, (_, index) =>
      createSurfaceGraph({ id: `obj-${index}`, equation: "x+y" })
    );
    const scene = createSceneDocument({ objects });
    const result = deserializeScene(serializeScene(scene));
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/objects cannot exceed/i);
  });

  it("rejects too many measurements", () => {
    const measurements = Array.from({ length: MAX_SCENE_MEASUREMENT_COUNT + 1 }, (_, index) => ({
      id: `m-${index}`,
      kind: "pin" as const,
      point: { x: index, y: index, z: index }
    }));
    const scene = createSceneDocument({ measurements });
    const result = deserializeScene(serializeScene(scene));
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/measurements cannot exceed/i);
  });

  it("rejects malformed top-level payload shapes safely", () => {
    const result = deserializeScene(JSON.stringify(["not-a-scene-object"]));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toMatch(/json object/i);
  });

  it("rejects too many groups when groups field is present", () => {
    const payload = {
      schemaVersion: 1,
      version: "1.0",
      metadata: {
        name: "With groups",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      },
      objects: [],
      groups: Array.from({ length: MAX_SCENE_GROUP_COUNT + 1 }, (_, index) => ({ id: `g-${index}` }))
    };
    const result = deserializeScene(JSON.stringify(payload));
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/groups cannot exceed/i);
  });

  it("rejects too many constraints when constraints field is present", () => {
    const payload = {
      schemaVersion: 1,
      version: "1.0",
      metadata: {
        name: "With constraints",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      },
      objects: [],
      constraints: Array.from({ length: MAX_SCENE_CONSTRAINT_COUNT + 1 }, (_, index) => ({ id: `c-${index}` }))
    };
    const result = deserializeScene(JSON.stringify(payload));
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/constraints cannot exceed/i);
  });

  it("returns actionable stack-trace-free errors", () => {
    const result = deserializeScene("{bad-json");
    expect(result.valid).toBe(false);
    const text = result.errors.join(" ");
    expect(text).not.toMatch(/at\s+\w+\s*\(/i);
    expect(text).not.toMatch(/stack/i);
  });
});
