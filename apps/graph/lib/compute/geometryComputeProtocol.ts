import type { ImplicitSurfaceDomain, ParametricSurfaceDomain } from "@vinculum/scene/types";

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

export type GeometryComputeKind = "implicitSurface" | "parametricSurface";

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

export type GeometryComputeRequest = ImplicitSurfaceComputeRequest | ParametricSurfaceComputeRequest;

// Uniform result shape carried back to the main thread. Both compute paths
// normalize into this (implicit reports rejectedTriangles: 0; parametric
// derives counts from buffer lengths), so the renderer applier and parity
// tests deal with exactly one geometry shape.
export interface GeometryComputeOkResult {
  status: "ok";
  positions: Float32Array;
  indices: Uint16Array | Uint32Array;
  vertexCount: number;
  triangleCount: number;
  rejectedTriangles: number;
}

export type GeometryComputeResult =
  | GeometryComputeOkResult
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
  return false;
}

function isTypedArray(value: unknown): value is Float32Array | Uint16Array | Uint32Array {
  return value instanceof Float32Array || value instanceof Uint16Array || value instanceof Uint32Array;
}

function isComputeResult(value: unknown): value is GeometryComputeResult {
  if (!isRecord(value)) {
    return false;
  }
  if (value.status === "ok") {
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
  if (value.kind !== "implicitSurface" && value.kind !== "parametricSurface") {
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
