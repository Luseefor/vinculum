import { graph2dPaintPalette } from "@/components/graph/graph2d/graph2dPaintPalette";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import { drawRenderableGraph2d } from "@/components/graph/graph2d/graph2dCanvasDrawRenderableGraph";
import { createSvgCanvasContext, escapeSvgAttribute as escapeXml } from "./svgCanvasContext";
import { drawGraph2dGrid } from "@/components/graph/graph2d/graph2dCanvasDrawGrid";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import { graph2dMathToScreen } from "@/components/graph/graph2d/graph2dCanvasTransforms";
import type { Axis2DPair, Viewport2DFrame } from "@/types/graphUi";
import type { GraphObject } from "@vinculum/scene/types";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import type { SceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { reportWarning } from "@/lib/monitoring/errorReporting";
import { getGraphCanvasCapture } from "@/lib/graph3d/graphCanvasCapture";

export type SceneExportKind = "json" | "png2d" | "png3d" | "svg2d";

export interface SceneExportFile {
  kind: SceneExportKind;
  blob: Blob;
  filename: string;
  contentType: string;
  warnings?: string[];
}

export interface SceneExportResult {
  ok: boolean;
  file?: SceneExportFile;
  error?: string;
}

export function exportSceneJson(scene: SceneDocument): SceneExportResult {
  try {
    const json = serializeScene(scene);
    const validation = deserializeScene(json);
    if (!validation.valid) return { ok: false, error: `JSON export failed: ${validation.errors.join(" ")}` };
    return {
      ok: true,
      file: {
        kind: "json",
        blob: new Blob([json], { type: "application/json" }),
        filename: `${toBaseFileName(scene.metadata.name)}.json`,
        contentType: "application/json"
      }
    };
  } catch {
    reportWarning("JSON export failed.", {
      featureArea: "export",
      operation: "export-json"
    });
    return {
      ok: false,
      error: "JSON export failed. Try again or copy the scene JSON from Export."
    };
  }
}

export async function export2dPngFromCanvas(input: {
  canvas: HTMLCanvasElement | null;
  sceneName: string;
}): Promise<SceneExportResult> {
  if (!input.canvas) {
    reportWarning("2D PNG export unavailable because canvas is missing.", {
      featureArea: "export",
      operation: "export-2d-png-no-canvas"
    });
    return {
      ok: false,
      error: "2D PNG export is unavailable because the canvas is not ready."
    };
  }

  const blob = await canvasToPngBlob(input.canvas);
  if (!blob) {
    reportWarning("2D PNG export failed during canvas capture.", {
      featureArea: "export",
      operation: "export-2d-png-capture-failed"
    });
    return {
      ok: false,
      error: "2D PNG export failed. Try again after the 2D view finishes rendering."
    };
  }

  return {
    ok: true,
    file: {
      kind: "png2d",
      blob,
      filename: `${toBaseFileName(input.sceneName)}-2d.png`,
      contentType: "image/png"
    }
  };
}

export async function export3dPngFromCanvas(input: {
  canvas: HTMLCanvasElement | null;
  sceneName: string;
}): Promise<SceneExportResult> {
  if (!input.canvas) {
    reportWarning("3D PNG export unavailable because renderer canvas is missing.", {
      featureArea: "export",
      operation: "export-3d-png-no-canvas"
    });
    return {
      ok: false,
      error: "3D renderer is unavailable. Open the 3D viewport and try again."
    };
  }

  let blob: Blob | null = null;
  try {
    const capture = getGraphCanvasCapture(input.canvas);
    blob = capture ? await capture() : await canvasToPngBlob(input.canvas);
  } catch {
    // Device loss or failed rendering follows the existing export error path.
  }
  if (!blob) {
    reportWarning("3D PNG export failed during GPU capture.", {
      featureArea: "export",
      operation: "export-3d-png-capture-failed"
    });
    return {
      ok: false,
      error: "3D PNG export failed during GPU capture. Try again after the frame finishes rendering."
    };
  }

  return {
    ok: true,
    file: {
      kind: "png3d",
      blob,
      filename: `${toBaseFileName(input.sceneName)}-3d.png`,
      contentType: "image/png"
    }
  };
}

export function export2dSvg(input: {
  sceneName: string;
  objects: GraphObject[];
  axisPair: Axis2DPair;
  viewport: { centerX: number; centerY: number; scale: number };
  viewportFrame: Viewport2DFrame;
  theme?: ResolvedTheme;
}): SceneExportResult {
  const width = Math.max(1, Math.floor(input.viewportFrame.width));
  const height = Math.max(1, Math.floor(input.viewportFrame.height));
  if (width <= 1 || height <= 1) {
    reportWarning("2D SVG export unavailable because viewport size is not ready.", {
      featureArea: "export",
      operation: "export-2d-svg-invalid-frame"
    });
    return {
      ok: false,
      error: "2D SVG export is unavailable because viewport dimensions are not ready."
    };
  }

  const palette = graph2dPaintPalette(input.theme ?? "dark");
  const axisSpec = getAxisPairSpec(input.axisPair);
  const renderables = buildRenderableGraphsFromScene(input.objects, axisSpec, getEditorParameterScope());
  const dc = {
    width,
    height,
    centerX: input.viewport.centerX,
    centerY: input.viewport.centerY,
    scale: input.viewport.scale
  };

  const warnings: string[] = [];
  const recording = createSvgCanvasContext();
  const graphLines = recording.elements;
  const renderedIds = new Set(renderables.map(graph => graph.id));
  for (const object of input.objects) {
    if (object.visible && !renderedIds.has(object.id)) {
      warnings.push(`Object ${object.id} has no geometry in the selected 2D plane.`);
    }
  }
  const grid = createSvgCanvasContext("grid");
  drawGraph2dGrid({ ...dc, ctx: grid.context }, graph2dMathToScreen, palette);
  for (const graph of renderables) {
    drawRenderableGraph2d(graph, { ...dc, ctx: recording.context }, graph2dMathToScreen);
  }

  const svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Vinculum 2D graph export">`,
    ...(input.objects.some(object => object.visible && object.kind === "implicitSurface") ? [`<desc>Implicit surface cross-sections: ${input.axisPair === "xy" ? "z" : input.axisPair === "xz" ? "y" : "x"} = 0.</desc>`] : []),
    `<rect x="0" y="0" width="${width}" height="${height}" fill="${escapeXml(palette.background)}" />`,
    `<defs>${grid.definitions.join("")}${recording.definitions.join("")}</defs>`,
    ...grid.elements,
    ...graphLines,
    `</svg>`
  ].join("");

  return {
    ok: true,
    file: {
      kind: "svg2d",
      blob: new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      filename: `${toBaseFileName(input.sceneName)}-2d.svg`,
      contentType: "image/svg+xml",
      warnings
    }
  };
}

export function triggerSceneExportDownload(file: SceneExportFile): SceneExportResult {
  try {
    const url = URL.createObjectURL(file.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.filename;
    anchor.rel = "noopener";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return { ok: true, file };
  } catch {
    reportWarning("Scene export download failed.", {
      featureArea: "export",
      operation: "export-download"
    });
    return {
      ok: false,
      error: "Download failed. Try again or check browser download permissions."
    };
  }
}

function toBaseFileName(name: string): string {
  const trimmed = name.trim().toLowerCase();
  const slug = trimmed.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const stamp = new Date().toISOString().slice(0, 10);
  return `${slug || "scene"}-${stamp}`;
}

async function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  if (typeof canvas.toBlob === "function") {
    return await new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }
  try {
    const dataUrl = canvas.toDataURL("image/png");
    return dataUrlToBlob(dataUrl);
  } catch {
    return null;
  }
}

function dataUrlToBlob(dataUrl: string): Blob | null {
  const parts = dataUrl.split(",");
  if (parts.length !== 2) {
    return null;
  }
  const mime = /data:([^;]+);base64/.exec(parts[0])?.[1] ?? "image/png";
  const binary = atob(parts[1]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
