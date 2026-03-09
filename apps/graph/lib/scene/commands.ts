import type { GraphObject } from "@vinculum/scene/types";
import type { SceneDocument } from "./sceneSchema";

export type SceneCommand =
  | AddObjectCommand
  | UpdateObjectCommand
  | RemoveObjectCommand
  | ToggleVisibilityCommand
  | ReplaceSceneCommand;

export interface AddObjectCommand {
  type: "ADD_OBJECT";
  payload: {
    object: GraphObject;
    index?: number;
  };
}

export interface UpdateObjectCommand {
  type: "UPDATE_OBJECT";
  payload: {
    object: GraphObject;
  };
}

export interface RemoveObjectCommand {
  type: "REMOVE_OBJECT";
  payload: {
    id: string;
  };
}

export interface ToggleVisibilityCommand {
  type: "TOGGLE_VISIBILITY";
  payload: {
    id: string;
  };
}

export interface ReplaceSceneCommand {
  type: "REPLACE_SCENE";
  payload: {
    scene: SceneDocument;
  };
}
