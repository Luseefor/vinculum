import type { GraphObject } from "@vinculum/scene/types";
import {
  getRenderDescriptorSignature,
  getStructureDescriptorSignature,
  toGraphObjectRenderDescriptor
} from "@/lib/graph3d/renderDescriptors";

export function getGraphObjectRenderSignature(object: GraphObject): string {
  return getRenderDescriptorSignature(toGraphObjectRenderDescriptor(object));
}

export function getGraphObjectStructureSignature(object: GraphObject): string {
  return getStructureDescriptorSignature(toGraphObjectRenderDescriptor(object));
}
