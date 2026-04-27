import type { BufferGeometry, Group, Line, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from "three";
import type { Mesh } from "three";
import type { WebGLRenderer } from "three";
import type { GraphThreeEngineTickRuntime } from "./graphThreeEngineTickTypes";

export type GraphThreeEngineInputMutableState = {
  isSketching: boolean;
  hoverProbePoint: { x: number; y: number; z: number } | null;
  sketchPoints: { x: number; y: number; z: number }[];
};

export type GraphThreeEngineInputHandlersDeps = {
  mutable: GraphThreeEngineInputMutableState;
  tickRuntime: GraphThreeEngineTickRuntime;
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  raycaster: Raycaster;
  ndc: Vector2;
  objectsRoot: Group;
  baselinePlane: Plane;
  tempGround: Vector3;
  probeMarkerMeshes: Mesh[];
  sketchGeometry: BufferGeometry;
  sketchLine: Line;
  maybeSnapPoint: (point: { x: number; y: number; z: number }) => { x: number; y: number; z: number };
  formatProbe: (p: { x: number; y: number; z: number }) => string;
  setHoverProbeBadge: (text: string | null, screenX: number, screenY: number) => void;
};
