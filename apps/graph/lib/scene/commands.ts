import type { GraphObject } from "@vinculum/scene/types";
import type { SceneDocument, SceneMeasurement } from "./sceneSchema";

export type SceneCommand =
  | AddObjectCommand
  | UpdateObjectCommand
  | RemoveObjectCommand
  | ToggleVisibilityCommand
  | AddMeasurementCommand
  | RemoveMeasurementCommand
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

export interface AddMeasurementCommand {
  type: "ADD_MEASUREMENT";
  payload: {
    measurement: SceneMeasurement;
  };
}

export interface RemoveMeasurementCommand {
  type: "REMOVE_MEASUREMENT";
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
