import { afterEach, describe, expect, it, vi } from "vitest";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import {
  export2dPngFromCanvas,
  export2dSvg,
  export3dPngFromCanvas,
  exportSceneJson,
  triggerSceneExportDownload
} from "@/lib/export/sceneExport";

describe("scene export service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exports JSON through canonical serialization with schemaVersion", async () => {
    const scene = createSceneDocument({
      objects: [createSurfaceGraph({ equation: "x^2 + y^2" })]
    });

    const result = exportSceneJson(scene);
    expect(result.ok).toBe(true);
    expect(result.file?.contentType).toBe("application/json");
    expect(result.file?.filename).toMatch(/\.json$/);

    const jsonText = await result.file!.blob.text();
    expect(jsonText).toContain('"schemaVersion": 1');
    expect(jsonText).toBe(serializeScene(scene));
  });

  it("fails PNG export safely when canvas is missing", async () => {
    const result = await export2dPngFromCanvas({
      canvas: null,
      sceneName: "scene"
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/canvas is not ready/i);
  });

  it("exports PNG blob when canvas is available", async () => {
    const fakeCanvas = document.createElement("canvas");
    Object.defineProperty(fakeCanvas, "toBlob", {
      value: (callback: BlobCallback) => {
        callback(new Blob(["png"], { type: "image/png" }));
      }
    });

    const result = await export2dPngFromCanvas({
      canvas: fakeCanvas,
      sceneName: "scene"
    });

    expect(result.ok).toBe(true);
    expect(result.file?.contentType).toBe("image/png");
    expect(result.file?.filename).toMatch(/-2d\.png$/);
  });

  it("fails 3D PNG export safely when renderer canvas is missing", async () => {
    const result = await export3dPngFromCanvas({
      canvas: null,
      sceneName: "scene"
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/renderer is unavailable/i);
  });

  it("exports 3D PNG blob when canvas capture is available", async () => {
    const fakeCanvas = document.createElement("canvas");
    Object.defineProperty(fakeCanvas, "toBlob", {
      value: (callback: BlobCallback) => {
        callback(new Blob(["png3d"], { type: "image/png" }));
      }
    });

    const result = await export3dPngFromCanvas({
      canvas: fakeCanvas,
      sceneName: "scene"
    });

    expect(result.ok).toBe(true);
    expect(result.file?.contentType).toBe("image/png");
    expect(result.file?.filename).toMatch(/-3d\.png$/);
  });

  it("returns safe error when 3D canvas blob conversion fails", async () => {
    const fakeCanvas = document.createElement("canvas");
    Object.defineProperty(fakeCanvas, "toBlob", {
      value: (callback: BlobCallback) => {
        callback(null);
      }
    });

    const result = await export3dPngFromCanvas({
      canvas: fakeCanvas,
      sceneName: "scene"
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/WebGL capture/i);
  });

  it("exports simple 2D SVG with viewport dimensions", async () => {
    const scene = createSceneDocument({
      objects: [createSurfaceGraph({ equation: "x + 1" })]
    });

    const result = export2dSvg({
      sceneName: scene.metadata.name,
      objects: scene.objects,
      axisPair: "xy",
      viewport: { centerX: 0, centerY: 0, scale: 80 },
      viewportFrame: { width: 800, height: 600 }
    });

    expect(result.ok).toBe(true);
    expect(result.file?.contentType).toBe("image/svg+xml");
    const svg = await result.file!.blob.text();
    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="0 0 800 600"');
  });

  it("returns safe errors when download creation fails", () => {
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      throw new Error("blocked");
    });
    const file = exportSceneJson(createSceneDocument()).file!;

    const result = triggerSceneExportDownload(file);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Download failed/i);
  });

  it("export operations do not mutate scene document", async () => {
    const scene = createSceneDocument({
      objects: [createSurfaceGraph({ equation: "x^2" })]
    });
    const before = serializeScene(scene);

    exportSceneJson(scene);
    export2dSvg({
      sceneName: scene.metadata.name,
      objects: scene.objects,
      axisPair: "xy",
      viewport: { centerX: 0, centerY: 0, scale: 80 },
      viewportFrame: { width: 640, height: 480 }
    });

    const fakeCanvas = document.createElement("canvas");
    Object.defineProperty(fakeCanvas, "toBlob", {
      value: (callback: BlobCallback) => {
        callback(new Blob(["png"], { type: "image/png" }));
      }
    });
    await export2dPngFromCanvas({
      canvas: fakeCanvas,
      sceneName: scene.metadata.name
    });
    await export3dPngFromCanvas({
      canvas: fakeCanvas,
      sceneName: scene.metadata.name
    });

    expect(serializeScene(scene)).toBe(before);
  });
});
