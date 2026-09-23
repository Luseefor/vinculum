import type { BufferGeometry, Group, Line, OrthographicCamera, PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from "three";
import type { Mesh } from "three";
import type { WebGLRenderer } from "three";
import type { GraphThreeEngineTickRuntime } from "./graphThreeEngineTickTypes";

export type GraphThreeEngineInputMutableState = {
  isSketching: boolean;
  hoverProbePoint: { x: number; y: number; z: number } | null;
  sketchPoints: { x: number; y: number; z: number }[];
};

export type PanePickContext = {
  camera: PerspectiveCamera | OrthographicCamera;
  rect: { left: number; top: number; width: number; height: number };
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
  /**
   * Multi-view override hook. Returns the pane camera + client rect for an
   * event, or null for legacy full-canvas perspective behavior.
   */
  resolvePickContext?: (clientX: number, clientY: number) => PanePickContext | null;
};
