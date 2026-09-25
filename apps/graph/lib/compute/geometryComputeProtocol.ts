import type {
  ImplicitSurfaceDomain,
  ParametricSurfaceDomain,
  VectorFieldDimension,
  VectorFieldDomain2D,
  VectorFieldDomain3D
} from "@vinculum/scene/types";
import {
  MAX_VECTOR_FIELD_2D_DENSITY,
  MAX_VECTOR_FIELD_3D_DENSITY,
  MIN_VECTOR_FIELD_DENSITY
} from "@vinculum/scene/defaults";

// Typed geometry-compute protocol for the S19 worker architecture (main
// thread <-> geometry worker). Both directions are runtime-validated by the
// guards below, which catch programming errors and malformed messages — not
// adversaries. The worker is same-origin first-party code running the same
// pure functions the main thread uses (verified by worker/sync parity
// tests); the guards exist so a corrupt message fails closed instead of
// producing garbage geometry. Only structured-clone-safe data crosses the
// boundary (plain objects + TypedArrays); evaluators, Three.js objects,
// stores, and DOM handles never cross.
//
// Identity model (stale-result suppression without a scene epoch):
// - requestId: unique per enqueued request (manager counter).
// - objectId: the scene object the result belongs to.
// - generation: per-object monotonically increasing counter, bumped on every
//   structural change. A response applies only when its generation still
//   matches the manager's latest for that objectId; anything older is stale
//   by definition, regardless of completion order. Deletion drops the
//   generation entry, so late results for deleted objects are rejected too.
// - structure: the full structure signature the request was computed for,
//   echoed back uninterpreted. The applier recomputes the live object's
//   structure and discards on mismatch, closing the deferred-sync window
//   where a response can arrive before the next rAF sync runs (store updates
//   are synchronous; sync itself runs a frame later).

export type GeometryComputeKind =
  | "implicitSurface"
  | "parametricSurface"
  | "vectorField"
  | "scalarField"
  | "streamlines";

// S23: planar scalar-field job (2D object-domain grids and 3D planar
// slices share one engine). The payload carries mathematics only —
// presentation (heat on/off, theme, colors) never enters it, so recolor
// and visibility toggles recompute zero jobs. Gradient density 0 skips
// the gradient grid; contour count 0 skips contour extraction.
export type ScalarSlicePlane = "xy" | "xz" | "yz";

export interface ScalarGridDomainPayload {
  uMin: number;
  uMax: number;
  vMin: number;
  vMax: number;
}

export interface ScalarFieldComputePayload {
  source:
    | { kind: "surface"; equation: string; orientation: "x" | "y" | "z" }
    | { kind: "implicit"; equation: string };
  target:
    | { kind: "domain2D"; domain: ScalarGridDomainPayload }
    | { kind: "slice"; plane: ScalarSlicePlane; planeValue: number; domain: ScalarGridDomainPayload };
  resolution: number;
  contourCount: number;
  gradientDensity: number;
}

export interface ImplicitSurfaceComputePayload {
  equation: string;
  domain: ImplicitSurfaceDomain;
  resolution: number;
}

export interface ParametricSurfaceComputePayload {
  xExpr: string;
  yExpr: string;
  zExpr: string;
  domain: ParametricSurfaceDomain;
  resolution: number;
  clampCoordinate: number;
}

// S20: sampled vector-field job. Dimension selects the grid (density^2 /
// density^3); rExpr must be empty for 2D. Sampling config only — render-only
// glyph sizing (scale/normalize) never enters the payload.
export interface VectorFieldComputePayload {
  dimension: VectorFieldDimension;
  pExpr: string;
  qExpr: string;
  rExpr: string;
  domain: VectorFieldDomain2D | VectorFieldDomain3D;
  density: number;
}

export interface GeometryComputeRequestBase {
  requestId: number;
  objectId: string;
  generation: number;
  params: Record<string, number>;
  structure: string;
}

export interface ImplicitSurfaceComputeRequest extends GeometryComputeRequestBase {
  kind: "implicitSurface";
  payload: ImplicitSurfaceComputePayload;
}

export interface ParametricSurfaceComputeRequest extends GeometryComputeRequestBase {
  kind: "parametricSurface";
  payload: ParametricSurfaceComputePayload;
}

export interface VectorFieldComputeRequest extends GeometryComputeRequestBase {
  kind: "vectorField";
  payload: VectorFieldComputePayload;
}

export interface ScalarFieldComputeRequest extends GeometryComputeRequestBase {
  kind: "scalarField";
  payload: ScalarFieldComputePayload;
}

// S24: streamline-tracing job. Mathematics only — render-only glyph
// sizing (scale/normalize), color, theme, and camera never enter the
// payload. Seed density/length/quality are numerics: they change the
// computed curves and belong in the job signature.
export interface StreamlineComputePayload {
  dimension: VectorFieldDimension;
  pExpr: string;
  qExpr: string;
  rExpr: string;
  domain: VectorFieldDomain2D | VectorFieldDomain3D;
  seedDensity: number;
  length: "short" | "medium" | "long";
  quality: "low" | "medium" | "high";
}

export interface StreamlineComputeRequest extends GeometryComputeRequestBase {
  kind: "streamlines";
  payload: StreamlineComputePayload;
}

export type GeometryComputeRequest =
  | ImplicitSurfaceComputeRequest
  | ParametricSurfaceComputeRequest
  | VectorFieldComputeRequest
  | ScalarFieldComputeRequest
  | StreamlineComputeRequest;

// Uniform mesh result shape carried back to the main thread. Both surface
// compute paths normalize into this (implicit reports rejectedTriangles: 0;
// parametric derives counts from buffer lengths), so the surface applier
// and parity tests deal with exactly one geometry shape. Vector fields use
// the sample shape below instead (no indices exist for glyph samples).
export interface GeometryComputeOkResult {
  status: "ok";
  positions: Float32Array;
  indices: Uint16Array | Uint32Array;
  vertexCount: number;
  triangleCount: number;
  rejectedTriangles: number;
}

// S20: sampled-field result. Buffers are compacted to valid samples only
// (zero vectors included, invalid dropped), so the renderer iterates them
// directly: instance i reads positions/vectors[i*3..] and magnitudes[i].
export interface VectorFieldComputeOkResult {
  status: "ok";
  positions: Float32Array;
  vectors: Float32Array;
  magnitudes: Float32Array;
  validCount: number;
  totalSamples: number;
  maxMagnitude: number;
}

// S23: scalar-field result. Buffers are renderer-neutral mathematics:
// raw values + validity (recolored per theme with zero recompute),
// contour segments in grid-math coordinates (theme-ink strokes), and
// gradient samples shaped like the S20 field result for glyph reuse.
// Contour over-budget degrades inside the payload (contourStatus) rather
// than failing the whole job: heat and gradients stay valid.
export interface ScalarFieldComputeOkResult {
  status: "ok";
  values: Float32Array;
  valid: Uint8Array;
  width: number;
  height: number;
  /** Sampling domain in grid (u, v) coordinates (mesh/contour placement). */
  domain: ScalarGridDomainPayload;
  min: number;
  max: number;
  validCount: number;
  totalSamples: number;
  levels: Float32Array;
  contourSegments: Float32Array;
  contourSegmentCount: number;
  contourStatus: "ok" | "empty" | "degenerate" | "budget-exceeded";
  gradientPositions: Float32Array;
  gradientVectors: Float32Array;
  gradientMagnitudes: Float32Array;
  gradientValidCount: number;
  gradientMaxMagnitude: number;
  gradientStatus: "ok" | "skipped" | "unavailable" | "empty";
}

// S24: packed-streamline result. points are flat coordinates (2D: xy
// pairs, 3D: xyz triples); offsets has length streamlineCount + 1 with
// offsets[count] === totalPoints; closed flags loop detection per curve.
export interface StreamlineComputeOkResult {
  status: "ok";
  dimension: VectorFieldDimension;
  points: Float32Array;
  offsets: Uint32Array;
  closed: Uint8Array;
  streamlineCount: number;
  totalPoints: number;
  evaluationCount: number;
}

export type GeometryComputeResult =
  | GeometryComputeOkResult
  | VectorFieldComputeOkResult
  | ScalarFieldComputeOkResult
  | StreamlineComputeOkResult
  | { status: "empty" }
  | { status: "budget-exceeded" }
  | { status: "error"; error: string };

export interface GeometryComputeResponse {
  requestId: number;
  objectId: string;
  generation: number;
  kind: GeometryComputeKind;
  structure: string;
  result: GeometryComputeResult;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumberRecord(value: unknown): value is Record<string, number> {
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "number" && Number.isFinite(entry));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isImplicitSurfaceDomain(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isFiniteNumber(value.xMin) &&
    isFiniteNumber(value.xMax) &&
    isFiniteNumber(value.yMin) &&
    isFiniteNumber(value.yMax) &&
    isFiniteNumber(value.zMin) &&
    isFiniteNumber(value.zMax)
  );
}

function isParametricSurfaceDomain(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isFiniteNumber(value.uMin) &&
    isFiniteNumber(value.uMax) &&
    isFiniteNumber(value.vMin) &&
    isFiniteNumber(value.vMax)
  );
}

function isImplicitSurfacePayload(value: unknown): value is ImplicitSurfaceComputePayload {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.equation === "string" &&
    isImplicitSurfaceDomain(value.domain) &&
    isFiniteNumber(value.resolution)
  );
}

function isParametricSurfacePayload(value: unknown): value is ParametricSurfaceComputePayload {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.xExpr === "string" &&
    typeof value.yExpr === "string" &&
    typeof value.zExpr === "string" &&
    isParametricSurfaceDomain(value.domain) &&
    isFiniteNumber(value.resolution) &&
    isFiniteNumber(value.clampCoordinate)
  );
}

function isVectorFieldDomain(value: unknown, dimension: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  const planar =
    isFiniteNumber(value.xMin) &&
    isFiniteNumber(value.xMax) &&
    isFiniteNumber(value.yMin) &&
    isFiniteNumber(value.yMax);
  if (dimension === "2d") {
    return planar;
  }
  return planar && isFiniteNumber(value.zMin) && isFiniteNumber(value.zMax);
}

function isVectorFieldPayload(value: unknown): value is VectorFieldComputePayload {
  if (!isRecord(value)) {
    return false;
  }
  if (value.dimension !== "2d" && value.dimension !== "3d") {
    return false;
  }
  if (
    typeof value.pExpr !== "string" ||
    typeof value.qExpr !== "string" ||
    typeof value.rExpr !== "string"
  ) {
    return false;
  }
  // S20-R4: R belongs to 3D (a 2D payload carrying R would silently ignore
  // mathematics in the sampler's dimension branch), and density enforces
  // the same per-dimension caps as import validation.
  if (value.dimension === "2d" && value.rExpr.trim() !== "") {
    return false;
  }
  if (!isFiniteNumber(value.density)) {
    return false;
  }
  const density = Math.floor(value.density);
  const maxDensity = value.dimension === "2d" ? MAX_VECTOR_FIELD_2D_DENSITY : MAX_VECTOR_FIELD_3D_DENSITY;
  if (density < MIN_VECTOR_FIELD_DENSITY || density > maxDensity) {
    return false;
  }
  return isVectorFieldDomain(value.domain, value.dimension);
}

function isScalarGridDomain(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isFiniteNumber(value.uMin) &&
    isFiniteNumber(value.uMax) &&
    isFiniteNumber(value.vMin) &&
    isFiniteNumber(value.vMax)
  );
}

function isScalarFieldPayload(value: unknown): value is ScalarFieldComputePayload {
  if (!isRecord(value)) {
    return false;
  }
  const source = value.source;
  if (!isRecord(source)) {
    return false;
  }
  if (source.kind === "surface") {
    if (
      typeof source.equation !== "string" ||
      (source.orientation !== "x" && source.orientation !== "y" && source.orientation !== "z")
    ) {
      return false;
    }
  } else if (source.kind === "implicit") {
    if (typeof source.equation !== "string") {
      return false;
    }
  } else {
    return false;
  }
  const target = value.target;
  if (!isRecord(target)) {
    return false;
  }
  if (target.kind === "domain2D") {
    if (!isScalarGridDomain(target.domain)) {
      return false;
    }
  } else if (target.kind === "slice") {
    if (target.plane !== "xy" && target.plane !== "xz" && target.plane !== "yz") {
      return false;
    }
    if (!isFiniteNumber(target.planeValue) || !isScalarGridDomain(target.domain)) {
      return false;
    }
  } else {
    return false;
  }
  return (
    isFiniteNumber(value.resolution) &&
    isFiniteNumber(value.contourCount) &&
    isFiniteNumber(value.gradientDensity)
  );
}

export function isGeometryComputeRequest(value: unknown): value is GeometryComputeRequest {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.requestId !== "number" || !Number.isInteger(value.requestId) || value.requestId < 0) {
    return false;
  }
  if (typeof value.objectId !== "string" || value.objectId.length === 0) {
    return false;
  }
  if (typeof value.generation !== "number" || !Number.isInteger(value.generation) || value.generation < 0) {
    return false;
  }
  if (!isFiniteNumberRecord(value.params)) {
    return false;
  }
  if (typeof value.structure !== "string" || value.structure.length === 0) {
    return false;
  }
  if (value.kind === "implicitSurface") {
    return isImplicitSurfacePayload(value.payload);
  }
  if (value.kind === "parametricSurface") {
    return isParametricSurfacePayload(value.payload);
  }
  if (value.kind === "vectorField") {
    return isVectorFieldPayload(value.payload);
  }
  if (value.kind === "scalarField") {
    return isScalarFieldPayload(value.payload);
  }
  if (value.kind === "streamlines") {
    return isStreamlinePayload(value.payload);
  }
  return false;
}

function isTypedArray(value: unknown): value is Float32Array | Uint16Array | Uint32Array {
  return value instanceof Float32Array || value instanceof Uint16Array || value instanceof Uint32Array;
}

const SCALAR_CONTOUR_STATUSES = new Set(["ok", "empty", "degenerate", "budget-exceeded"]);
const SCALAR_GRADIENT_STATUSES = new Set(["ok", "skipped", "unavailable", "empty"]);

function isStreamlinePayload(value: unknown): value is StreamlineComputePayload {
  if (!isRecord(value)) {
    return false;
  }
  if (value.dimension !== "2d" && value.dimension !== "3d") {
    return false;
  }
  if (
    typeof value.pExpr !== "string" ||
    typeof value.qExpr !== "string" ||
    typeof value.rExpr !== "string"
  ) {
    return false;
  }
  // S20-R4 mirrored: R belongs to 3D; a 2D payload carrying R would
  // silently ignore mathematics in the integrator's dimension branch.
  if (value.dimension === "2d" && (value.rExpr as string).trim() !== "") {
    return false;
  }
  if (!isFiniteNumber(value.seedDensity)) {
    return false;
  }
  if (value.length !== "short" && value.length !== "medium" && value.length !== "long") {
    return false;
  }
  if (value.quality !== "low" && value.quality !== "medium" && value.quality !== "high") {
    return false;
  }
  return isVectorFieldDomain(value.domain, value.dimension);
}

function isScalarFieldResult(value: Record<string, unknown>): boolean {
  // Scalar shape carries values+valid instead of the mesh indices or the
  // field vectors+magnitudes triple; the applier trusts counts only after
  // these hold (full OOB scans stay with the parity-tested producer).
  if (!(value.values instanceof Float32Array) || !(value.valid instanceof Uint8Array)) {
    return false;
  }
  if (
    typeof value.width !== "number" ||
    !Number.isInteger(value.width) ||
    value.width < 2 ||
    typeof value.height !== "number" ||
    !Number.isInteger(value.height) ||
    value.height < 2
  ) {
    return false;
  }
  if (
    value.values.length !== value.width * value.height ||
    value.valid.length !== value.width * value.height ||
    !isScalarGridDomain(value.domain)
  ) {
    return false;
  }
  if (
    typeof value.min !== "number" ||
    !Number.isFinite(value.min) ||
    typeof value.max !== "number" ||
    !Number.isFinite(value.max) ||
    typeof value.validCount !== "number" ||
    !Number.isInteger(value.validCount) ||
    value.validCount < 1 ||
    typeof value.totalSamples !== "number" ||
    !Number.isInteger(value.totalSamples) ||
    value.validCount > value.totalSamples ||
    value.totalSamples !== value.width * value.height
  ) {
    return false;
  }
  if (
    !(value.levels instanceof Float32Array) ||
    !(value.contourSegments instanceof Float32Array) ||
    (value.contourSegments.length !== 0 &&
      (value.contourSegments.length % 4 !== 0 ||
        typeof value.contourSegmentCount !== "number" ||
        value.contourSegments.length !== (value.contourSegmentCount as number) * 4)) ||
    typeof value.contourSegmentCount !== "number" ||
    !Number.isInteger(value.contourSegmentCount) ||
    value.contourSegmentCount < 0 ||
    typeof value.contourStatus !== "string" ||
    !SCALAR_CONTOUR_STATUSES.has(value.contourStatus)
  ) {
    return false;
  }
  if (
    !(value.gradientPositions instanceof Float32Array) ||
    !(value.gradientVectors instanceof Float32Array) ||
    !(value.gradientMagnitudes instanceof Float32Array) ||
    typeof value.gradientValidCount !== "number" ||
    !Number.isInteger(value.gradientValidCount) ||
    value.gradientValidCount < 0 ||
    value.gradientMagnitudes.length !== value.gradientValidCount ||
    value.gradientPositions.length !== value.gradientValidCount * 3 ||
    value.gradientVectors.length !== value.gradientValidCount * 3 ||
    typeof value.gradientMaxMagnitude !== "number" ||
    !Number.isFinite(value.gradientMaxMagnitude) ||
    typeof value.gradientStatus !== "string" ||
    !SCALAR_GRADIENT_STATUSES.has(value.gradientStatus)
  ) {
    return false;
  }
  return true;
}

function isStreamlineResult(value: Record<string, unknown>): boolean {
  // Packed polylines: offsets has exactly streamlineCount + 1 entries
  // ending at totalPoints; closed flags match the curve count; points
  // stride matches the declared dimension. The applier trusts counts only
  // after these hold (full OOB scans stay with the parity-tested producer).
  if (value.dimension !== "2d" && value.dimension !== "3d") {
    return false;
  }
  if (
    !(value.points instanceof Float32Array) ||
    !(value.offsets instanceof Uint32Array) ||
    !(value.closed instanceof Uint8Array)
  ) {
    return false;
  }
  const stride = value.dimension === "2d" ? 2 : 3;
  if (
    typeof value.streamlineCount !== "number" ||
    !Number.isInteger(value.streamlineCount) ||
    value.streamlineCount < 1 ||
    typeof value.totalPoints !== "number" ||
    !Number.isInteger(value.totalPoints) ||
    value.totalPoints < 2 ||
    typeof value.evaluationCount !== "number" ||
    !Number.isInteger(value.evaluationCount) ||
    value.evaluationCount < 1
  ) {
    return false;
  }
  if (
    value.offsets.length !== (value.streamlineCount as number) + 1 ||
    value.closed.length !== (value.streamlineCount as number) ||
    value.offsets[0] !== 0 ||
    value.offsets[value.streamlineCount as number] !== (value.totalPoints as number) ||
    value.points.length !== (value.totalPoints as number) * stride
  ) {
    return false;
  }
  for (let i = 1; i <= (value.streamlineCount as number); i += 1) {
    if ((value.offsets[i] as number) <= (value.offsets[i - 1] as number)) {
      return false;
    }
  }
  for (const flag of value.closed as Uint8Array) {
    if (flag !== 0 && flag !== 1) {
      return false;
    }
  }
  for (const coordinate of value.points as Float32Array) {
    if (!Number.isFinite(coordinate)) {
      return false;
    }
  }
  return true;
}

function isComputeResult(value: unknown): value is GeometryComputeResult {
  if (!isRecord(value)) {
    return false;
  }
  if (value.status === "ok") {
    if ("offsets" in value || "streamlineCount" in value) {
      return isStreamlineResult(value);
    }
    if ("values" in value || "valid" in value) {
      return isScalarFieldResult(value);
    }
    // Field results carry vectors+magnitudes instead of indices; mesh
    // results carry indices instead. The applier trusts counts only after
    // these hold (full OOB scans stay with the parity-tested producer).
    if ("vectors" in value || "magnitudes" in value) {
      return (
        value.positions instanceof Float32Array &&
        value.vectors instanceof Float32Array &&
        value.magnitudes instanceof Float32Array &&
        value.positions.length > 0 &&
        value.positions.length % 3 === 0 &&
        value.vectors.length === value.positions.length &&
        value.magnitudes.length === value.positions.length / 3 &&
        // S20-R5: the applier and builder dereference these counts, so a
        // corrupt message must fail here rather than wedge instancing.
        typeof value.validCount === "number" &&
        Number.isInteger(value.validCount) &&
        value.validCount === value.magnitudes.length &&
        typeof value.totalSamples === "number" &&
        Number.isInteger(value.totalSamples) &&
        value.totalSamples >= value.validCount &&
        typeof value.maxMagnitude === "number" &&
        Number.isFinite(value.maxMagnitude)
      );
    }
    // Non-empty buffers with whole-triangle positions; the applier trusts
    // counts only after these hold (full OOB scans stay with the producer,
    // which is parity-tested against the sync path).
    return (
      isTypedArray(value.positions) &&
      isTypedArray(value.indices) &&
      value.positions.length > 0 &&
      value.indices.length > 0 &&
      value.positions.length % 3 === 0
    );
  }
  if (value.status === "empty" || value.status === "budget-exceeded") {
    return true;
  }
  if (value.status === "error") {
    return typeof value.error === "string";
  }
  return false;
}

export function isGeometryComputeResponse(value: unknown): value is GeometryComputeResponse {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.requestId !== "number" || !Number.isInteger(value.requestId) || value.requestId < 0) {
    return false;
  }
  if (typeof value.objectId !== "string" || value.objectId.length === 0) {
    return false;
  }
  if (typeof value.generation !== "number" || !Number.isInteger(value.generation) || value.generation < 0) {
    return false;
  }
  if (
    value.kind !== "implicitSurface" &&
    value.kind !== "parametricSurface" &&
    value.kind !== "vectorField" &&
    value.kind !== "scalarField" &&
    value.kind !== "streamlines"
  ) {
    return false;
  }
  if (typeof value.structure !== "string" || value.structure.length === 0) {
    return false;
  }
  if (!isRecord(value.result)) {
    return false;
  }
  return isComputeResult(value.result);
}
