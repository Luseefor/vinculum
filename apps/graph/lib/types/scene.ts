import type { GraphObject } from "@vinculum/scene/types";

export type SceneSelection = {
  selectedObjectId: string | null;
};

export type SceneSnapshot = {
  objects: GraphObject[];
  selection: SceneSelection;
};
