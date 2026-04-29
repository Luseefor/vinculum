import type { GraphObject } from "@vinculum/scene/types";
import type { SceneCommand } from "./commands";
import {
  cloneGraphObject,
  cloneSceneDocument,
  cloneSceneMeasurement,
  createSceneDocument,
  type SceneDocument
} from "./sceneSchema";

export function applySceneCommand(scene: SceneDocument, command: SceneCommand): SceneDocument {
  if (command.type === "REPLACE_SCENE") {
    return cloneSceneDocument(command.payload.scene);
  }

  if (command.type === "ADD_OBJECT") {
    return applyAddObject(scene, command.payload.object, command.payload.index);
  }

  if (command.type === "UPDATE_OBJECT") {
    return applyUpdateObject(scene, command.payload.object);
  }

  if (command.type === "REMOVE_OBJECT") {
    return applyRemoveObject(scene, command.payload.id);
  }

  if (command.type === "TOGGLE_VISIBILITY") {
    return applyToggleVisibility(scene, command.payload.id);
  }

  if (command.type === "ADD_MEASUREMENT") {
    return applyAddMeasurement(scene, command.payload.measurement);
  }

  return applyRemoveMeasurement(scene, command.payload.id);
}

function applyAddObject(scene: SceneDocument, object: GraphObject, index?: number): SceneDocument {
  const hasExistingId = scene.objects.some((existingObject) => existingObject.id === object.id);
  if (hasExistingId) {
    return scene;
  }

  const insertIndex = clampInsertIndex(index, scene.objects.length);
  const nextObjects = [
    ...scene.objects.slice(0, insertIndex),
    cloneGraphObject(object),
    ...scene.objects.slice(insertIndex)
  ];

  return touchScene(scene, nextObjects);
}

function applyUpdateObject(scene: SceneDocument, object: GraphObject): SceneDocument {
  const index = scene.objects.findIndex((existingObject) => existingObject.id === object.id);
  if (index === -1) {
    return scene;
  }

  const nextObjects = scene.objects.map((existingObject, objectIndex) =>
    objectIndex === index ? cloneGraphObject(object) : existingObject
  );

  return touchScene(scene, nextObjects);
}

function applyRemoveObject(scene: SceneDocument, id: string): SceneDocument {
  const hasObject = scene.objects.some((object) => object.id === id);
  if (!hasObject) {
    return scene;
  }

  const nextObjects = scene.objects.filter((object) => object.id !== id);
  return touchScene(scene, nextObjects);
}

function applyToggleVisibility(scene: SceneDocument, id: string): SceneDocument {
  let changed = false;

  const nextObjects = scene.objects.map((object) => {
    if (object.id !== id) {
      return object;
    }

    changed = true;
    return {
      ...object,
      visible: !object.visible
    };
  });

  if (!changed) {
    return scene;
  }

  return touchScene(scene, nextObjects);
}

function touchScene(scene: SceneDocument, objects: GraphObject[]): SceneDocument {
  return createSceneDocument({
    version: scene.version,
    metadata: {
      name: scene.metadata.name,
      createdAt: scene.metadata.createdAt,
      updatedAt: new Date().toISOString()
    },
    objects,
    measurements: scene.measurements
  });
}

function touchSceneMeasurements(scene: SceneDocument, measurements: SceneDocument["measurements"]): SceneDocument {
  return createSceneDocument({
    version: scene.version,
    metadata: {
      name: scene.metadata.name,
      createdAt: scene.metadata.createdAt,
      updatedAt: new Date().toISOString()
    },
    objects: scene.objects,
    measurements
  });
}

function applyAddMeasurement(scene: SceneDocument, measurement: SceneDocument["measurements"][number]): SceneDocument {
  const hasExistingId = scene.measurements.some((candidate) => candidate.id === measurement.id);
  if (hasExistingId) {
    return scene;
  }
  return touchSceneMeasurements(scene, [...scene.measurements, cloneSceneMeasurement(measurement)]);
}

function applyRemoveMeasurement(scene: SceneDocument, id: string): SceneDocument {
  const next = scene.measurements.filter((measurement) => measurement.id !== id);
  if (next.length === scene.measurements.length) {
    return scene;
  }
  return touchSceneMeasurements(scene, next);
}

function clampInsertIndex(index: number | undefined, length: number): number {
  if (!Number.isFinite(index)) {
    return length;
  }

  const normalizedIndex = Math.floor(index as number);
  return Math.min(length, Math.max(0, normalizedIndex));
}
