import type { SceneMeasurement, SceneMeasurementPoint } from "@/lib/scene/sceneSchema";

export function createMeasurementId(prefix: "dist" | "angle" | "pin"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function computeDistance(a: SceneMeasurementPoint, b: SceneMeasurementPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function computeAngleDegrees(
  a: SceneMeasurementPoint,
  vertex: SceneMeasurementPoint,
  c: SceneMeasurementPoint
): number {
  const ux = a.x - vertex.x;
  const uy = a.y - vertex.y;
  const uz = a.z - vertex.z;
  const vx = c.x - vertex.x;
  const vy = c.y - vertex.y;
  const vz = c.z - vertex.z;
  const uMag = Math.hypot(ux, uy, uz);
  const vMag = Math.hypot(vx, vy, vz);
  if (uMag === 0 || vMag === 0) {
    return NaN;
  }
  const dot = ux * vx + uy * vy + uz * vz;
  const cosine = Math.min(1, Math.max(-1, dot / (uMag * vMag)));
  return (Math.acos(cosine) * 180) / Math.PI;
}

export function formatMeasurementValue(measurement: SceneMeasurement): string {
  if (measurement.kind === "pin") {
    const label = measurement.label?.trim();
    const point = measurement.point;
    const coords = `(${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)})`;
    return label ? `${label} ${coords}` : coords;
  }

  if (measurement.kind === "distance") {
    return `${computeDistance(measurement.points[0], measurement.points[1]).toFixed(4)} u`;
  }

  const degrees = computeAngleDegrees(
    measurement.points[0],
    measurement.points[1],
    measurement.points[2]
  );
  return Number.isFinite(degrees) ? `${degrees.toFixed(2)} deg` : "Invalid angle";
}
