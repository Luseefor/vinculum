"use client";

import { useGraphStore } from "@/store/graphStore";
import type { SceneAction } from "@/lib/types/actions";

export function dispatchSceneAction(action: SceneAction): void {
  const store = useGraphStore.getState();

  switch (action.type) {
    case "add":
      if (action.kind === "surface") {
        store.addEmptyObject();
      } else if (action.kind === "parametricCurve") {
        store.addParametricCurve();
      } else if (action.kind === "plane") {
        store.addPlaneObject();
      }
      break;
    case "remove":
      store.removeObject(action.id);
      break;
    case "select":
      if (action.id) {
        store.selectObject(action.id);
      }
      break;
    case "toggleVisibility":
      store.toggleObjectVisibility(action.id);
      break;
    case "toggleWireframe":
      store.toggleSurfaceWireframe(action.id);
      break;
    case "updateObject":
      // Canonical update path remains command-based in graphStore; narrow updates stay there for now.
      if (action.object.kind === "surface") {
        store.updateSurfaceEquation(action.object.id, action.object.equation);
      }
      break;
    default:
      break;
  }
}

export function getCurrentSceneSnapshot() {
  const state = useGraphStore.getState();
  return {
    objects: state.scene.objects,
    measurements: state.scene.measurements,
    selection: {
      selectedObjectId: state.ui.selectedObjectId
    }
  };
}
