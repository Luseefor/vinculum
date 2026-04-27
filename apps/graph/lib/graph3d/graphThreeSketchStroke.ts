import { BufferAttribute, BufferGeometry, Line } from "three";

export type SketchPoint3 = { x: number; y: number; z: number };

export function appendThreeSketchPoint(
  sketchPoints: SketchPoint3[],
  sketchGeometry: BufferGeometry,
  sketchLine: Line,
  point: SketchPoint3
): SketchPoint3[] {
  const prev = sketchPoints[sketchPoints.length - 1];
  if (prev && Math.hypot(point.x - prev.x, point.y - prev.y, point.z - prev.z) < 0.04) {
    return sketchPoints;
  }
  const next = [...sketchPoints, point];
  const arr = new Float32Array(next.length * 3);
  for (let i = 0; i < next.length; i += 1) {
    const p = next[i];
    arr[i * 3] = p.x;
    arr[i * 3 + 1] = p.y;
    arr[i * 3 + 2] = p.z;
  }
  sketchGeometry.setAttribute("position", new BufferAttribute(arr, 3));
  sketchGeometry.computeBoundingSphere();
  sketchLine.visible = next.length > 1;
  return next;
}

export function clearThreeSketch(
  sketchGeometry: BufferGeometry,
  sketchLine: Line
): SketchPoint3[] {
  sketchGeometry.setDrawRange(0, 0);
  sketchLine.visible = false;
  return [];
}
