import { applySceneCommand } from "@/lib/scene/applyCommand";
import type { GraphObject } from "@vinculum/scene/types";
import type { GraphStoreSet } from "./graphStoreTypes";

export function appendObject(
  set: GraphStoreSet,
  createObject: (colorIndex: number) => GraphObject
): string {
  let createdObjectId = "";

  set((state) => {
    const nextObject = createObject(state.scene.objects.length);
    createdObjectId = nextObject.id;

    const nextScene = applySceneCommand(state.scene, {
      type: "ADD_OBJECT",
      payload: {
        object: nextObject
      }
    });

    return {
      scene: nextScene,
      ui: {
        ...state.ui,
        selectedObjectId: nextObject.id
      }
    };
  });

  return createdObjectId;
}
