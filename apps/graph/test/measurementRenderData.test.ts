import { describe, expect, it } from "vitest";
import { buildMeasurement2dRenderData } from "@/components/graph/graph2d/graph2dCanvasPaintFrame";
import type { SceneMeasurement } from "@/lib/scene/sceneSchema";

describe("buildMeasurement2dRenderData", () => {
  it("counts distance/angle/pin measurements for 2D render path", () => {
    const measurements: SceneMeasurement[] = [
      {
        id: "m_pin",
        kind: "pin",
        point: { x: 0, y: 0, z: 0 }
      },
      {
        id: "m_dist",
        kind: "distance",
        points: [
          { x: 0, y: 0, z: 0 },
          { x: 1, y: 2, z: 3 }
        ]
      },
      {
        id: "m_angle",
        kind: "angle",
        points: [
          { x: 1, y: 0, z: 0 },
          { x: 0, y: 0, z: 0 },
          { x: 0, y: 1, z: 0 }
        ]
      }
    ];

    expect(buildMeasurement2dRenderData(measurements)).toEqual({
      distanceCount: 1,
      angleCount: 1,
      pinCount: 1
    });
  });
});
