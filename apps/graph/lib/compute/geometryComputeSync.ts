import { Group, type Object3D } from "three";
import type { GraphObject, ImplicitSurfaceObject, ParametricSurfaceObject, VectorFieldObject } from "@vinculum/scene/types";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import { useGraphStore } from "@/store/graphStore";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { compileImplicitSurfaceExpression } from "@/lib/math/compileImplicitSurface";
import { compileParametricSurfaceExpressions } from "@/lib/math/compileParametricSurface";
import { compileVectorFieldExpressions } from "@/lib/math/compileVectorField";
import { vectorFieldCellSize } from "@/lib/math/vectorFieldGlyphs";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import { applyObjectColorToNode, disposeObject3D } from "@/lib/graph3d/buildGraphObjectDisposal";
import { buildIndexedSurfaceMeshGroup } from "@/lib/graph3d/buildIndexedSurfaceMesh";
import {
  buildVectorFieldGroup,
  getVectorFieldNode,
  writeVectorFieldInstances
} from "@/lib/graph3d/buildGraphVectorField";
import { syncNonRenderableObjectNode } from "@/lib/graph3d/buildGraphSync";
import {
  getGraphObjectRenderSignature,
  getGraphObjectStructureSignature
} from "@/lib/graph3d/graphObject3dSignatures";
import { getParameterSignature } from "@/lib/graph3d/graphThreeEngineDom";
import type { GeometryComputeManager } from "@/lib/compute/geometryComputeManager";
import type { GeometryComputeResponse } from "@/lib/compute/geometryComputeProtocol";

export interface GeometryComputeSyncContext {
  objectsRoot: Group;
  objectNodes: Map<string, Object3D>;
  objectSignatures: Map<string, string>;
  objectStructureSignatures: Map<string, string>;
  getTheme: () => ResolvedTheme;
  manager: GeometryComputeManager;
}

export function isWorkerizedComputeKind(
  object: GraphObject
): object is ImplicitSurfaceObject | ParametricSurfaceObject | VectorFieldObject {
  return (
    object.kind === "implicitSurface" || object.kind === "parametricSurface" || object.kind === "vectorField"
  );
}

// Async-aware branch of the renderer sync for workerized surface kinds.
// Mirrors the synchronous flow exactly (non-renderable handling, S7
// visibility pre-sync, signature early-outs, color-only fast path) except
// the structural-rebuild step: instead of blocking the main thread, a cheap
// main-thread compile gate preserves invalid-removal semantics, and valid
// inputs enqueue a worker job while the previous node stays put.
//
// Accepted rebuild costs (identical to the synchronous path, hence no
// separate fast paths): theme toggles rebuild (edge colors are theme
// tokens), wireframe toggles rebuild (appearance is structure identity),
// and any parameter edit rebuilds (global param signature; no
// referenced-symbol filtering, which would risk stale meshes on a false
// "irrelevant" verdict). View/layout/visibility/color changes enqueue
// nothing (PART 32).
export function syncComputedSurfaceObject(
  object: ImplicitSurfaceObject | ParametricSurfaceObject | VectorFieldObject,
  theme: ResolvedTheme,
  parameterSignature: string,
  ctx: GeometryComputeSyncContext
): void {
  const { manager } = ctx;
  if (
    syncNonRenderableObjectNode(
      object,
      theme,
      ctx.objectsRoot,
      ctx.objectNodes,
      ctx.objectSignatures,
      ctx.objectStructureSignatures
    )
  ) {
    manager.notifyObjectsRemoved([object.id]);
    return;
  }

  const nextSignature = `${theme}:${parameterSignature}:${getGraphObjectRenderSignature(object)}`;
  const nextStructure = `${theme}:${parameterSignature}:${getGraphObjectStructureSignature(object)}`;
  const prevSignature = ctx.objectSignatures.get(object.id);
  const prevStructure = ctx.objectStructureSignatures.get(object.id);
  const prevNode = ctx.objectNodes.get(object.id);
  if (prevNode) {
    prevNode.visible = object.visible;
  }
  if (prevSignature === nextSignature) {
    return;
  }

  if (prevNode && prevStructure === nextStructure) {
    applyObjectColorToNode(prevNode, object.color);
    prevNode.visible = object.visible;
    // S20 PART 24: scale/normalize/color ride the render signature only, so
    // they land here with zero worker jobs. Glyph instances recompute from
    // the retained sample cache on the main thread (bounded: <=1728).
    if (object.kind === "vectorField") {
      const fieldGroup = getVectorFieldNode(prevNode);
      if (fieldGroup) {
        writeVectorFieldInstances(fieldGroup, object.scale, object.normalize);
        ctx.objectSignatures.set(object.id, nextSignature);
        ctx.objectStructureSignatures.set(object.id, nextStructure);
        return;
      }
      // Cache missing (unreachable for builder nodes): fall through to
      // resample rather than show stale glyphs.
    } else {
      ctx.objectSignatures.set(object.id, nextSignature);
      ctx.objectStructureSignatures.set(object.id, nextStructure);
      return;
    }
  }

  // Structural change: compile gate runs on the main thread (cheap relative
  // to sampling — same compiler the worker uses) so invalid definitions
  // remove geometry immediately, exactly like the synchronous path. Only
  // valid inputs pay for a worker round-trip.
  const params = getEditorParameterScope();
  const compileError =
    object.kind === "implicitSurface"
      ? compileImplicitSurfaceExpression(object.equation, params).error
      : object.kind === "parametricSurface"
        ? compileParametricSurfaceExpressions(object.xExpr, object.yExpr, object.zExpr, params).error
        : compileVectorFieldExpressions(
            object.dimension,
            object.pExpr,
            object.qExpr,
            object.rExpr,
            params
          ).error;
  if (compileError) {
    if (prevNode) {
      ctx.objectsRoot.remove(prevNode);
      disposeObject3D(prevNode);
      ctx.objectNodes.delete(object.id);
    }
    ctx.objectSignatures.set(object.id, nextSignature);
    ctx.objectStructureSignatures.set(object.id, nextStructure);
    manager.notifyObjectsRemoved([object.id]);
    return;
  }

  if (object.kind === "vectorField") {
    manager.requestCompute({
      objectId: object.id,
      kind: object.kind,
      payload: {
        dimension: object.dimension,
        pExpr: object.pExpr,
        qExpr: object.qExpr,
        rExpr: object.rExpr,
        domain: { ...object.domain },
        density: object.density
      },
      params,
      structure: nextStructure
    });
  } else if (object.kind === "implicitSurface") {
    manager.requestCompute({
      objectId: object.id,
      kind: object.kind,
      payload: { equation: object.equation, domain: object.domain, resolution: object.resolution },
      params,
      structure: nextStructure
    });
  } else {
    manager.requestCompute({
      objectId: object.id,
      kind: object.kind,
      payload: {
        xExpr: object.xExpr,
        yExpr: object.yExpr,
        zExpr: object.zExpr,
        domain: object.domain,
        resolution: object.resolution,
        clampCoordinate: 10_000
      },
      params,
      structure: nextStructure
    });
  }
  // Stamp the new signatures now so a later sync with identical inputs sees
  // equality and enqueues nothing (PART 32: no duplicate jobs). The previous
  // node stays until the result arrives (keep-old-mesh pending policy).
  ctx.objectSignatures.set(object.id, nextSignature);
  ctx.objectStructureSignatures.set(object.id, nextStructure);
}

// Applies an accepted worker result to the live scene: builds Three
// resources on the main thread (PART 46) and atomically swaps the node.
// Non-ok results remove the node, matching today's null-mesh semantics for
// empty/error/budget outcomes. Reads color/visibility/appearance live so a
// render-only change that landed while computing is respected.
//
// Deferred-sync backstop: the response carries the structure signature it
// was computed for. The applier recomputes the live object's structure and
// discards on mismatch, so a response that arrives before the next rAF sync
// (e.g. delete + same-id recreate with different math inside one frame) can
// never apply a wrong mesh. Generation equality remains the primary ordering
// mechanism; this check covers the pre-sync window.
export function applyGeometryComputeResult(
  response: GeometryComputeResponse,
  ctx: GeometryComputeSyncContext
): void {
  const live = useGraphStore.getState().scene.objects.find((candidate) => candidate.id === response.objectId);
  if (
    !live ||
    (live.kind !== "implicitSurface" && live.kind !== "parametricSurface" && live.kind !== "vectorField")
  ) {
    return;
  }
  const theme = ctx.getTheme();
  const liveStructure = `${theme}:${getParameterSignature()}:${getGraphObjectStructureSignature(live)}`;
  if (liveStructure !== response.structure) {
    return;
  }
  const node = ctx.objectNodes.get(live.id);
  if (response.result.status !== "ok") {
    if (node) {
      ctx.objectsRoot.remove(node);
      disposeObject3D(node);
      ctx.objectNodes.delete(live.id);
    }
    return;
  }
  // S20: vector results build the instanced glyph node (math-frame buffers
  // are mapped to world inside the builder). A mesh result for a field, or
  // a field result for a surface, is corrupt input — discard.
  if (live.kind === "vectorField") {
    if (!("vectors" in response.result)) {
      return;
    }
    const tokens = getGraphThemeTokens(theme);
    const group = buildVectorFieldGroup({
      id: live.id,
      color: live.color,
      scale: live.scale,
      normalize: live.normalize,
      samples: {
        positions: response.result.positions,
        vectors: response.result.vectors,
        magnitudes: response.result.magnitudes,
        validCount: response.result.validCount,
        maxMagnitude: response.result.maxMagnitude,
        cell: vectorFieldCellSize(live.domain, live.density, live.dimension)
      },
      roughness: tokens.sceneSurfaceRoughness,
      metalness: tokens.sceneSurfaceMetalness
    });
    if (node) {
      ctx.objectsRoot.remove(node);
      disposeObject3D(node);
      ctx.objectNodes.delete(live.id);
    }
    group.visible = live.visible;
    ctx.objectsRoot.add(group);
    ctx.objectNodes.set(live.id, group);
    return;
  }
  // S20: the surface applier only accepts mesh results. A field result for
  // a surface object is corrupt input — discard without touching the node.
  if (!("indices" in response.result)) {
    return;
  }
  const group = buildIndexedSurfaceMeshGroup({
    id: live.id,
    color: live.color,
    wireframe: live.appearance.wireframe,
    positions: response.result.positions,
    indices: response.result.indices,
    theme,
    tokens: getGraphThemeTokens(theme),
    repairZeroNormals: true
  });
  if (node) {
    ctx.objectsRoot.remove(node);
    disposeObject3D(node);
    ctx.objectNodes.delete(live.id);
  }
  if (group) {
    group.visible = live.visible;
    ctx.objectsRoot.add(group);
    ctx.objectNodes.set(live.id, group);
  }
}
