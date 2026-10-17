import { describe, expect, it } from "vitest";
import { createVectorFieldGraph } from "@/lib/graph/createVectorFieldGraph";
import { export2dSvg } from "@/lib/export/sceneExport";
import {
  computeScenePressureFromObjects,
  evaluateHeavySceneWarnings
} from "@/lib/performance/performanceMetrics";
import { createSceneDocument } from "@/lib/scene/sceneSchema";

function exportInput(objects: ReturnType<typeof createSceneDocument>["objects"]) {
  return export2dSvg({
    sceneName: "vector",
    objects,
    axisPair: "xy",
    viewport: { centerX: 0, centerY: 0, scale: 80 },
    viewportFrame: { width: 800, height: 600 }
  });
}

describe("vector field export and pressure (S20 Slice 7)", () => {
  it("warns explicitly for 3D fields instead of silently omitting", () => {
    const scene = createSceneDocument({
      objects: [createVectorFieldGraph({ dimension: "3d" })]
    });
    const result = exportInput(scene.objects);
    expect(result.ok).toBe(true);
    expect(result.file?.warnings?.join(" ")).toMatch(/no geometry in the selected 2D plane/);
  });

  it("exports 2D field arrows through the canvas painter", async () => {
    const scene = createSceneDocument({
      objects: [createVectorFieldGraph({ dimension: "2d" })]
    });
    const result = exportInput(scene.objects);
    expect(result.ok).toBe(true);
    expect(result.file?.warnings).toEqual([]);
    const svg = new DOMParser().parseFromString(await result.file!.blob.text(), "image/svg+xml");
    const arrows = [...svg.querySelectorAll(`path[stroke="${scene.objects[0].color}"]`)];
    expect(arrows.reduce((count, path) => count + (path.getAttribute("d")?.match(/L /g)?.length ?? 0), 0)).toBeGreaterThan(100);
  });

  it("estimates glyph-count pressure instead of point cost", () => {
    const light = computeScenePressureFromObjects([
      createVectorFieldGraph({ dimension: "3d", density: 4 })
    ]);
    expect(light.vectorGlyphMax).toBe(64);
    expect(light.vectorGlyphPressure).toBeCloseTo(64 / 1728, 12);

    const heavy = computeScenePressureFromObjects([
      createVectorFieldGraph({ dimension: "3d", density: 12 })
    ]);
    expect(heavy.vectorGlyphMax).toBe(1728);
    expect(heavy.vectorGlyphPressure).toBe(1);

    const planar = computeScenePressureFromObjects([
      createVectorFieldGraph({ dimension: "2d", density: 32 })
    ]);
    expect(planar.vectorGlyphMax).toBe(1024);

    // Hidden fields cost nothing.
    const hidden = computeScenePressureFromObjects([
      { ...createVectorFieldGraph({ dimension: "3d", density: 12 }), visible: false }
    ]);
    expect(hidden.vectorGlyphMax).toBe(0);
    expect(hidden.vectorGlyphPressure).toBe(0);
  });

  it("escalates dense fields to heavy-scene warnings", () => {
    const pressure = computeScenePressureFromObjects([
      createVectorFieldGraph({ dimension: "3d", density: 12 })
    ]);
    const result = evaluateHeavySceneWarnings({
      scenePressure: pressure,
      lastFrameTimeMs: 10,
      averageFrameTimeMs: 10
    });
    expect(result.level).toBe("critical");
    expect(result.items.join(" ")).toMatch(/vector field glyph/i);
  });
});
