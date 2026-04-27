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
  syncNonRenderableObjectNode
} from "@/lib/graph3d/buildGraphObjects";
import { getParameterSignature } from "./graphThreeEngineDom";

export function syncThreeSceneObjects(
  theme: ResolvedTheme,
  allObjects: GraphObject[],
  objectsRoot: Group,
  objectNodes: Map<string, Object3D>,
  objectSignatures: Map<string, string>,
  objectStructureSignatures: Map<string, string>,
  keyLight: DirectionalLight,
  renderer: WebGLRenderer
): void {
  const parameterSignature = getParameterSignature();
  const hasSurfaces = sceneHasVisibleSurface(allObjects);
  keyLight.castShadow = hasSurfaces;
  renderer.shadowMap.enabled = hasSurfaces;
  const nextIds = new Set<string>();

  for (const object of allObjects) {
    nextIds.add(object.id);
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
    if (prevSignature === nextSignature) {
      continue;
    }

    const prevNode = objectNodes.get(object.id);
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

  for (const [id, node] of objectNodes.entries()) {
    if (nextIds.has(id)) {
      continue;
    }
    objectsRoot.remove(node);
    disposeObject3D(node);
    objectNodes.delete(id);
    objectSignatures.delete(id);
    objectStructureSignatures.delete(id);
  }
}
