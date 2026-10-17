import { describe, expect, it } from "vitest";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";

describe("scene measurement persistence", () => {
  it("serializes and deserializes distance, angle, and pin measurements", () => {
    const scene = createSceneDocument({
      measurements: [
        {
          id: "dist-1",
          kind: "distance",
          points: [
            { x: 0, y: 0, z: 0 },
            { x: 2, y: 0, z: 0 }
          ]
        },
        {
          id: "angle-1",
          kind: "angle",
          points: [
            { x: 1, y: 0, z: 0 },
            { x: 0, y: 0, z: 0 },
            { x: 0, y: 1, z: 0 }
          ]
        },
        {
          id: "pin-1",
          kind: "pin",
          point: { x: 1, y: 2, z: 3 },
          label: "A"
        }
      ]
    });

    const parsed = deserializeScene(serializeScene(scene));
    expect(parsed.valid).toBe(true);
    expect(parsed.normalizedScene?.measurements).toHaveLength(3);
    expect(parsed.normalizedScene?.measurements[0]?.kind).toBe("distance");
    expect(parsed.normalizedScene?.measurements[1]?.kind).toBe("angle");
    expect(parsed.normalizedScene?.measurements[2]?.kind).toBe("pin");
  });

  it("loads legacy scenes that have no measurements array", () => {
    const legacy = {
      schemaVersion: 1,
      version: "1.0",
      metadata: {
        name: "Legacy",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z"
      },
      objects: []
    };

    const parsed = deserializeScene(JSON.stringify(legacy));
    expect(parsed.valid).toBe(true);
    expect(parsed.normalizedScene?.measurements).toEqual([]);
  });
});
