import { describe, expect, it } from "vitest";
import {
  computeAngleDegrees,
  computeDistance,
  formatMeasurementValue
} from "@/lib/measurements/measurementMath";
import type { SceneMeasurement } from "@/lib/scene/sceneSchema";

describe("measurement math", () => {
  it("calculates 3D distance", () => {
    const distance = computeDistance({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 12 });
    expect(distance).toBe(13);
  });

  it("calculates angle in degrees from three points", () => {
    const angle = computeAngleDegrees(
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 1, z: 0 }
    );
    expect(angle).toBeCloseTo(90, 6);
  });

  it("formats measurement values for overlays", () => {
    const distanceMeasurement: SceneMeasurement = {
      id: "d-1",
      kind: "distance",
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 }
      ]
    };
    const angleMeasurement: SceneMeasurement = {
      id: "a-1",
      kind: "angle",
      points: [
        { x: 1, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 }
      ]
    };
    const pinMeasurement: SceneMeasurement = {
      id: "p-1",
      kind: "pin",
      point: { x: 1, y: 2, z: 3 },
      label: "P1"
    };

    expect(formatMeasurementValue(distanceMeasurement)).toContain("1.0000");
    expect(formatMeasurementValue(angleMeasurement)).toContain("90.00");
    expect(formatMeasurementValue(pinMeasurement)).toContain("P1");
  });
});
