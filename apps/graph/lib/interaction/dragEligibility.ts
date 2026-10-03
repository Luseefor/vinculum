// S33 direct-manipulation eligibility (UI-only, pure).
//
// A handle is eligible only when every coordinate field it must rewrite in
// the ACTIVE pane holds a plain numeric literal (PART 14/55/56). Pane axes:
//
//   xy → x, y (z preserved) · xz → x, z (y preserved) · yz → y, z (x preserved)
//
// Per-handle required fields (canonical field names):
//   Point body ......... pane axes of x/y/zExpr
//   Segment Start/End .. pane axes of a/bx,ay,by,az,bzExpr
//   Vector Origin ...... pane axes of ox/oy/ozExpr (components untouched)
//   Vector Tip ......... pane axes of vx/vy/vzExpr (origin untouched)
//   Line point ......... pane axes of px/py/pzExpr (direction untouched)
//   Ray origin ......... pane axes of ox/oy/ozExpr (direction untouched)
//
// Line/Ray direction handles are DEFERRED (magnitude semantics unresolved).
// Perspective has no positional dragging (underdetermined). Expression- or
// parameter-backed fields lock their handle; the Inspector stays the edit
// path ("Edit expression in Object panel." — never an error).

import type { GraphObject } from "@vinculum/scene/types";
import { isDirectManipulationNumericLiteral } from "./directManipulationLiterals";

export type OrthoPaneView = "xy" | "xz" | "yz";

export type InteractionHandleKind =
  | "point"
  | "origin"
  | "tip"
  | "start"
  | "end";

export interface EligibleHandle {
  handle: InteractionHandleKind;
}

/** Math axes edited in an orthographic pane (hidden axis preserved). */
export function paneEditedAxes(pane: OrthoPaneView): ["x" | "y" | "z", "x" | "y" | "z"] {
  if (pane === "xz") {
    return ["x", "z"];
  }
  if (pane === "yz") {
    return ["y", "z"];
  }
  return ["x", "y"];
}

function fieldFor(object: GraphObject, axis: "x" | "y" | "z", role: "position" | "origin" | "tip" | "start" | "end" | "point"): string | null {
  const suffix = axis === "x" ? "xExpr" : axis === "y" ? "yExpr" : "zExpr";
  if (object.kind === "point") {
    return role === "position" ? suffix : null;
  }
  if (object.kind === "segment") {
    const prefix = role === "start" ? "a" : role === "end" ? "b" : null;
    return prefix ? `${prefix}${suffix}` : null;
  }
  if (object.kind === "vector") {
    if (role === "origin") {
      return `o${suffix}`;
    }
    if (role === "tip") {
      return `v${suffix}`;
    }
    return null;
  }
  if (object.kind === "line") {
    if (role === "point") {
      return `p${suffix}`;
    }
    return null;
  }
  if (object.kind === "ray") {
    if (role === "origin") {
      return `o${suffix}`;
    }
    return null;
  }
  return null;
}

function readField(object: GraphObject, field: string): string | null {
  const value = (object as unknown as Record<string, unknown>)[field];
  return typeof value === "string" ? value : null;
}

/**
 * Eligible drag handles for a selected object in an orthographic pane.
 * Empty when the object kind is unsupported or a required field is
 * expression-backed (locked — Inspector remains the edit path).
 */
export function eligibleDragHandles(
  object: GraphObject,
  pane: OrthoPaneView
): EligibleHandle[] {
  const [axisA, axisB] = paneEditedAxes(pane);
  const requiresLiteral = (fields: Array<string | null>): boolean =>
    fields.every((field) => field !== null && isDirectManipulationNumericLiteral(readField(object, field)));

  if (object.kind === "point") {
    const fields = [fieldFor(object, axisA, "position"), fieldFor(object, axisB, "position")];
    return requiresLiteral(fields) ? [{ handle: "point" }] : [];
  }
  if (object.kind === "segment") {
    const handles: EligibleHandle[] = [];
    if (
      requiresLiteral([fieldFor(object, axisA, "start"), fieldFor(object, axisB, "start")])
    ) {
      handles.push({ handle: "start" });
    }
    if (
      requiresLiteral([fieldFor(object, axisA, "end"), fieldFor(object, axisB, "end")])
    ) {
      handles.push({ handle: "end" });
    }
    return handles;
  }
  if (object.kind === "vector") {
    const handles: EligibleHandle[] = [];
    if (
      requiresLiteral([fieldFor(object, axisA, "origin"), fieldFor(object, axisB, "origin")])
    ) {
      handles.push({ handle: "origin" });
    }
    if (requiresLiteral([fieldFor(object, axisA, "tip"), fieldFor(object, axisB, "tip")])) {
      handles.push({ handle: "tip" });
    }
    return handles;
  }
  if (object.kind === "line") {
    const fields = [fieldFor(object, axisA, "point"), fieldFor(object, axisB, "point")];
    return requiresLiteral(fields) ? [{ handle: "point" }] : [];
  }
  if (object.kind === "ray") {
    const fields = [fieldFor(object, axisA, "origin"), fieldFor(object, axisB, "origin")];
    return requiresLiteral(fields) ? [{ handle: "origin" }] : [];
  }
  return [];
}

/** Concise lock explanation for tooltips/status (never an error). */
export const DRAG_LOCK_HINT = "Edit expression in Object panel.";
