import type { GraphObject } from "@vinculum/scene/types";
import type { SceneMeasurement, SceneParameter } from "@/lib/scene/sceneSchema";

export type SceneSelection = {
  selectedObjectId: string | null;
};

export type SceneSnapshot = {
  objects: GraphObject[];
  measurements: SceneMeasurement[];
  parameters?: SceneParameter[];
  selection: SceneSelection;
};
