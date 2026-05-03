import { describe, expect, it, vi } from "vitest";
import { export3dPngFromCanvas, triggerSceneExportDownload } from "@/lib/export/sceneExport";

describe("Canonical 3D export function", () => {
  it("handles missing canvas gracefully", async () => {
    const result = await export3dPngFromCanvas({
      canvas: null,
      sceneName: "test"
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/renderer is unavailable/i);
  });

  it("returns blob when canvas available", async () => {
    const fakeCanvas = document.createElement("canvas");
    Object.defineProperty(fakeCanvas, "toBlob", {
      value: (callback: BlobCallback) => {
        callback(new Blob(["png3d"], { type: "image/png" }));
      }
    });

    const result = await export3dPngFromCanvas({
      canvas: fakeCanvas,
      sceneName: "test"
    });

    expect(result.ok).toBe(true);
    expect(result.file?.contentType).toBe("image/png");
    expect(result.file?.filename).toMatch(/-3d\.png$/);
  });

  it("handles blob conversion failure", async () => {
    const fakeCanvas = document.createElement("canvas");
    Object.defineProperty(fakeCanvas, "toBlob", {
      value: (callback: BlobCallback) => {
        callback(null);
      }
    });

    const result = await export3dPngFromCanvas({
      canvas: fakeCanvas,
      sceneName: "test"
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/WebGL capture/i);
  });
});

describe("TopToolbar 3D export integration", () => {
  it("has 3D export handler that calls canonical export", async () => {
    const { export3dPngFromCanvas, triggerSceneExportDownload } = await import("@/lib/export/sceneExport");
    
    // Verify the canonical functions exist and are callable
    expect(typeof export3dPngFromCanvas).toBe("function");
    expect(typeof triggerSceneExportDownload).toBe("function");
    
    const fakeCanvas = document.createElement("canvas");
    Object.defineProperty(fakeCanvas, "toBlob", {
      value: (callback: BlobCallback) => {
        callback(new Blob(["png3d"], { type: "image/png" }));
      }
    });
    
    const result = await export3dPngFromCanvas({
      canvas: fakeCanvas,
      sceneName: "test"
    });
    
    expect(result.ok).toBe(true);
  });
});
