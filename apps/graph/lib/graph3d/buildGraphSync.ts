import { Group, type Object3D } from "three";
import type { GraphObject } from "@vinculum/scene/types";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import { disposeObject3D } from "./buildGraphObjectDisposal";
import { isGraphObjectRenderable3D } from "./graphObject3dGuards";

export function syncNonRenderableObjectNode(
  object: GraphObject,
  theme: ResolvedTheme,
  objectsRoot: Group,
  objectNodes: Map<string, Object3D>,
  objectSignatures: Map<string, string>,
  objectStructureSignatures: Map<string, string>
): boolean {
  if (isGraphObjectRenderable3D(object)) {
    return false;
  }

  const staleNode = objectNodes.get(object.id);
  if (staleNode) {
    objectsRoot.remove(staleNode);
    disposeObject3D(staleNode);
    objectNodes.delete(object.id);
  }

  const nonRenderableSignature = `${theme}:non-renderable`;
  objectSignatures.set(object.id, nonRenderableSignature);
  objectStructureSignatures.set(object.id, nonRenderableSignature);
  return true;
}
