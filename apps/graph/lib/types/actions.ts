import type { GraphObject, GraphObjectKind } from "@vinculum/scene/types";

export type SceneAction =
  | { type: "add"; kind: GraphObjectKind }
  | { type: "remove"; id: string }
  | { type: "select"; id: string | null }
  | { type: "toggleVisibility"; id: string }
  | { type: "toggleWireframe"; id: string }
  | { type: "updateObject"; object: GraphObject };
