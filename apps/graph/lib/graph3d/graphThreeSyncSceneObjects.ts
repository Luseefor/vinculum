import type { GraphObject } from "@vinculum/scene/types";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import { Group, type DirectionalLight, type WebGLRenderer, type Object3D } from "three";
import {
  applyObjectColorToNode,
  buildGraphObject,
  disposeObject3D,
  getGraphObjectRenderSignature,
  getGraphObjectStructureSignature,
  sceneHasVisibleSurface,
  syncGeometrySelectionEmphasis,
  syncNonRenderableObjectNode
} from "@/lib/graph3d/buildGraphObjects";
import { useGraphStore } from "@/store/graphStore";
import { getParameterSignature } from "./graphThreeEngineDom";
import {
  isWorkerizedComputeKind,
  syncComputedSurfaceObject,
  type GeometryComputeSyncContext
} from "@/lib/compute/geometryComputeSync";
import type { GeometryComputeManager } from "@/lib/compute/geometryComputeManager";

export function syncThreeSceneObjects(
  theme: ResolvedTheme,
  allObjects: GraphObject[],
  objectsRoot: Group,
  objectNodes: Map<string, Object3D>,
  objectSignatures: Map<string, string>,
  objectStructureSignatures: Map<string, string>,
  keyLight: DirectionalLight,
  renderer: WebGLRenderer,
  computeManager?: GeometryComputeManager,
  getComputeTheme?: () => ResolvedTheme
): void {
  const parameterSignature = getParameterSignature();
  const hasSurfaces = sceneHasVisibleSurface(allObjects);
  keyLight.castShadow = hasSurfaces;
  renderer.shadowMap.enabled = hasSurfaces;
  const nextIds = new Set<string>();
  const computeContext: GeometryComputeSyncContext | null =
    computeManager && getComputeTheme
      ? {
          objectsRoot,
          objectNodes,
          objectSignatures,
          objectStructureSignatures,
          getTheme: getComputeTheme,
          manager: computeManager
        }
      : null;

  for (const object of allObjects) {
    nextIds.add(object.id);
    if (computeContext && isWorkerizedComputeKind(object)) {
      syncComputedSurfaceObject(object, theme, parameterSignature, computeContext);
      continue;
    }
    if (
      syncNonRenderableObjectNode(
        object,
        theme,
        objectsRoot,
        objectNodes,
        objectSignatures,
        objectStructureSignatures
      )
    ) {
      continue;
    }

    const nextSignature = `${theme}:${parameterSignature}:${getGraphObjectRenderSignature(object)}`;
    const nextStructure = `${theme}:${parameterSignature}:${getGraphObjectStructureSignature(object)}`;
    const prevSignature = objectSignatures.get(object.id);
    const prevStructure = objectStructureSignatures.get(object.id);
    // S7 (F6): visibility is presentation state, not geometry identity, so it is
    // excluded from both signatures. Synchronize it on the cached node before
    // any signature-based early-out, otherwise a visibility-only change would
    // reuse the node but leave a stale `.visible`.
    const prevNode = objectNodes.get(object.id);
    if (prevNode) {
      prevNode.visible = object.visible;
    }
    if (prevSignature === nextSignature) {
      continue;
    }

    if (prevNode && prevStructure === nextStructure) {
      applyObjectColorToNode(prevNode, object.color);
      prevNode.visible = object.visible;
      objectSignatures.set(object.id, nextSignature);
      objectStructureSignatures.set(object.id, nextStructure);
      continue;
    }

    if (prevNode) {
      objectsRoot.remove(prevNode);
      disposeObject3D(prevNode);
      objectNodes.delete(object.id);
    }

    const nextNode = buildGraphObject(object, theme);
    if (nextNode) {
      nextNode.visible = object.visible;
      objectsRoot.add(nextNode);
      objectNodes.set(object.id, nextNode);
    }
    objectSignatures.set(object.id, nextSignature);
    objectStructureSignatures.set(object.id, nextStructure);
  }

  const prunedIds: string[] = [];
  for (const [id, node] of objectNodes.entries()) {
    if (nextIds.has(id)) {
      continue;
    }
    objectsRoot.remove(node);
    disposeObject3D(node);
    objectNodes.delete(id);
    objectSignatures.delete(id);
    objectStructureSignatures.delete(id);
    prunedIds.push(id);
  }

  // S31 selection emphasis (Part 1): material-only brightening for the
  // selected geometric object. Runs on every sync so rebuilt nodes pick it
  // up; selection-only changes arrive via objectsDirty (no signature, no
  // rebuild, no worker jobs).
  const kindsById = new Map<string, GraphObject["kind"]>();
  for (const object of allObjects) {
    kindsById.set(object.id, object.kind);
  }
  syncGeometrySelectionEmphasis(
    objectNodes,
    kindsById,
    useGraphStore.getState().ui.selectedObjectId
  );

  if (computeContext) {
    // Drop compute ownership for deleted objects so late results for them
    // are discarded and no pending-state entry leaks (PART 20). Tracked ids
    // cover pending-but-never-built objects that have no scene node yet.
    const removed = new Set(prunedIds);
    for (const trackedId of computeContext.manager.getTrackedObjectIds()) {
      if (!nextIds.has(trackedId)) {
        removed.add(trackedId);
      }
    }
    if (removed.size > 0) {
      computeContext.manager.notifyObjectsRemoved([...removed]);
    }
  }
}
