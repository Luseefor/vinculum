import { buildGridSeries } from "@/components/viewport/Grid2D";
import { getAxisPairSpec } from "@/components/graph/graph2d/graph2dCanvasAxis";
import { buildRenderableGraphsFromScene } from "@/components/graph/graph2d/buildRenderableGraphsFromScene";
import {
  GRID_EDGE_OVERSCAN_LINES,
  GRID_TARGET_SPACING_PX,
  MAX_GRID_LINE_COUNT,
  MIN_GRID_SPACING_UNITS
} from "@/components/graph/graph2d/graph2dCanvasConstants";
import { graph2dMathToScreen } from "@/components/graph/graph2d/graph2dCanvasTransforms";
import type { Axis2DPair, Viewport2DFrame } from "@/types/graphUi";
import type { GraphObject } from "@vinculum/scene/types";
import type { SceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { reportWarning } from "@/lib/monitoring/errorReporting";

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

  const blob = await canvasToPngBlob(input.canvas);
  if (!blob) {
    reportWarning("3D PNG export failed during WebGL capture.", {
      featureArea: "export",
      operation: "export-3d-png-capture-failed"
    });
    return {
      ok: false,
      error: "3D PNG export failed during WebGL capture. Try again after the frame finishes rendering."
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

  const axisSpec = getAxisPairSpec(input.axisPair);
  const renderables = buildRenderableGraphsFromScene(input.objects, axisSpec);
  const dc = {
    width,
    height,
    centerX: input.viewport.centerX,
    centerY: input.viewport.centerY,
    scale: input.viewport.scale
  };

  const warnings: string[] = [];
  const graphLines: string[] = [];

  for (const graph of renderables) {
    if (graph.polylineHV && graph.polylineHV.length >= 4) {
      const points: string[] = [];
      for (let i = 0; i < graph.polylineHV.length; i += 2) {
        const screen = graph2dMathToScreen(graph.polylineHV[i], graph.polylineHV[i + 1], dc);
        points.push(`${screen.x.toFixed(2)},${screen.y.toFixed(2)}`);
      }
      if (points.length >= 2) {
        graphLines.push(
          `<polyline fill="none" stroke="${escapeXml(graph.color)}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="${points.join(" ")}" />`
        );
      }
      continue;
    }

    if (typeof graph.verticalLineValue === "number") {
      const screen = graph2dMathToScreen(graph.verticalLineValue, 0, dc);
      graphLines.push(
        `<line x1="${screen.x.toFixed(2)}" y1="0" x2="${screen.x.toFixed(2)}" y2="${height}" stroke="${escapeXml(graph.color)}" stroke-width="2.2" />`
      );
      continue;
    }

    if (typeof graph.horizontalLineValue === "number") {
      const screen = graph2dMathToScreen(0, graph.horizontalLineValue, dc);
      graphLines.push(
        `<line x1="0" y1="${screen.y.toFixed(2)}" x2="${width}" y2="${screen.y.toFixed(2)}" stroke="${escapeXml(graph.color)}" stroke-width="2.2" />`
      );
      continue;
    }

    if (graph.evaluate) {
      const samples = Math.max(220, Math.floor(width * 1.2));
      const step = width / samples;
      let path = "";
      let hasPoint = false;
      for (let i = 0; i <= samples; i += 1) {
        const x = i * step;
        const h = (x - width / 2) / dc.scale + dc.centerX;
        const v = graph.evaluate(h);
        if (v === null || !Number.isFinite(v)) {
          continue;
        }
        const screen = graph2dMathToScreen(h, v, dc);
        path += hasPoint ? ` L ${screen.x.toFixed(2)} ${screen.y.toFixed(2)}` : `M ${screen.x.toFixed(2)} ${screen.y.toFixed(2)}`;
        hasPoint = true;
      }
      if (hasPoint) {
        graphLines.push(
          `<path d="${path}" fill="none" stroke="${escapeXml(graph.color)}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />`
        );
      }
      continue;
    }

    warnings.push(`Object ${graph.id} uses features not yet represented in SVG.`);
  }

  const gridMarkup = buildSvgGridMarkup(dc);
  const origin = graph2dMathToScreen(0, 0, dc);
  const axisMarkup: string[] = [];
  if (origin.y >= 0 && origin.y <= height) {
    axisMarkup.push(`<line x1="0" y1="${origin.y.toFixed(2)}" x2="${width}" y2="${origin.y.toFixed(2)}" stroke="#7e8798" stroke-width="1.8" />`);
  }
  if (origin.x >= 0 && origin.x <= width) {
    axisMarkup.push(`<line x1="${origin.x.toFixed(2)}" y1="0" x2="${origin.x.toFixed(2)}" y2="${height}" stroke="#7e8798" stroke-width="1.8" />`);
  }

  const svg = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Vinculum 2D graph export">`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="#0f172a" />`,
    ...gridMarkup,
    ...axisMarkup,
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

function buildSvgGridMarkup(dc: { width: number; height: number; centerX: number; centerY: number; scale: number }): string[] {
  const minX = dc.centerX - dc.width / (2 * dc.scale);
  const maxX = dc.centerX + dc.width / (2 * dc.scale);
  const minY = dc.centerY - dc.height / (2 * dc.scale);
  const maxY = dc.centerY + dc.height / (2 * dc.scale);
  const safeRawSpacing = Math.max(MIN_GRID_SPACING_UNITS, GRID_TARGET_SPACING_PX / dc.scale);
  const magnitude = Math.pow(10, Math.floor(Math.log10(safeRawSpacing)));
  const normalized = safeRawSpacing / magnitude;
  const majorSpacing = normalized < 2 ? magnitude : normalized < 5 ? magnitude * 2 : magnitude * 5;
  const minorSpacing = Math.max(MIN_GRID_SPACING_UNITS, majorSpacing / 5);
  const minorOverscan = minorSpacing * GRID_EDGE_OVERSCAN_LINES;
  const majorOverscan = majorSpacing * GRID_EDGE_OVERSCAN_LINES;

  const markup: string[] = [];
  const minorX = buildGridSeries(minX - minorOverscan, maxX + minorOverscan, minorSpacing, MAX_GRID_LINE_COUNT);
  if (minorX) {
    for (let i = 0; i < minorX.count; i += 1) {
      const value = minorX.start + minorX.step * i;
      const screen = graph2dMathToScreen(value, 0, dc);
      markup.push(`<line x1="${screen.x.toFixed(2)}" y1="0" x2="${screen.x.toFixed(2)}" y2="${dc.height}" stroke="#334155" stroke-width="1" opacity="0.38" />`);
    }
  }

  const minorY = buildGridSeries(minY - minorOverscan, maxY + minorOverscan, minorSpacing, MAX_GRID_LINE_COUNT);
  if (minorY) {
    for (let i = 0; i < minorY.count; i += 1) {
      const value = minorY.start + minorY.step * i;
      const screen = graph2dMathToScreen(0, value, dc);
      markup.push(`<line x1="0" y1="${screen.y.toFixed(2)}" x2="${dc.width}" y2="${screen.y.toFixed(2)}" stroke="#334155" stroke-width="1" opacity="0.38" />`);
    }
  }

  const majorX = buildGridSeries(minX - majorOverscan, maxX + majorOverscan, majorSpacing, MAX_GRID_LINE_COUNT);
  if (majorX) {
    for (let i = 0; i < majorX.count; i += 1) {
      const value = majorX.start + majorX.step * i;
      const screen = graph2dMathToScreen(value, 0, dc);
      markup.push(`<line x1="${screen.x.toFixed(2)}" y1="0" x2="${screen.x.toFixed(2)}" y2="${dc.height}" stroke="#475569" stroke-width="1" opacity="0.72" />`);
    }
  }

  const majorY = buildGridSeries(minY - majorOverscan, maxY + majorOverscan, majorSpacing, MAX_GRID_LINE_COUNT);
  if (majorY) {
    for (let i = 0; i < majorY.count; i += 1) {
      const value = majorY.start + majorY.step * i;
      const screen = graph2dMathToScreen(0, value, dc);
      markup.push(`<line x1="0" y1="${screen.y.toFixed(2)}" x2="${dc.width}" y2="${screen.y.toFixed(2)}" stroke="#475569" stroke-width="1" opacity="0.72" />`);
    }
  }
  return markup;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
