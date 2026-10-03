import { Color, type BufferGeometry } from "three";
import { Line2NodeMaterial } from "three/webgpu";
import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";

/** Screen-space strokes work on both the WebGPU renderer and its WebGL fallback.
 * Segment pairs preserve discontinuities; the addon refreshes viewport size per pane. */
export function createWideStroke(positions: Float32Array | number[], color: string, width = 3): LineSegments2 {
  const geometry = new LineSegmentsGeometry();
  geometry.setPositions(positions);
  geometry.userData.strokePositions = new Float32Array(positions);
  const material = new Line2NodeMaterial({ color: new Color(color), linewidth: width, worldUnits: false, toneMapped: false });
  const stroke = new LineSegments2(geometry, material);
  stroke.userData.wideStroke = true;
  // Keep raycasting for the existing "hit any visible object" selection guard.
  // Surface/probe pickers explicitly exclude strokes, since these are meshes.
  return stroke;
}

/** Reuse the existing instance buffer when camera clipping changes endpoints. */
export function updateWideStrokePositions(geometry: BufferGeometry, positions: Float32Array): void {
  const attribute = geometry.getAttribute("instanceStart");
  if (attribute && "data" in attribute) {
    const data = (attribute as import("three").InterleavedBufferAttribute).data;
    data.array.set(positions);
    data.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }
}
