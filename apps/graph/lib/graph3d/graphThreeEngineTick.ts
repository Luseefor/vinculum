import type { Group, Mesh, Object3D, PerspectiveCamera, Scene } from "three";
import type { WebGLRenderer } from "three";
import type { OrbitControls } from "three-stdlib";
import type { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import { useGraphStore } from "@/store/graphStore";
import { alignCameraToThreeBaseline } from "./graphThreeCameraBaseline";
import { CAMERA_FAR_PLANE, DEFAULT_CAMERA_POSITION } from "./graphThreeEngineConstants";
import { readResolvedThemeFromDom } from "./graphThreeEngineTheme";
import { applyGraphThreeTickPerfSampling } from "./graphThreeEngineTickPerf";
import { syncGraphThreeTickGridFrame } from "./graphThreeEngineTickGrid";
import { syncOrbitControlsToCanvas3dTool } from "./graphThreeEngineTickOrbit";
import {
  computeScenePressureFromObjects,
  recordFrameSample
} from "@/lib/performance/performanceMetrics";
import type { GraphThreeEngineTickRuntime } from "./graphThreeEngineTickTypes";
import { updateThreeMeasurementMarkers, updateThreeProbeMarkers } from "./graphThreeProbeMarkers";
import { formatMeasurementValue } from "@/lib/measurements/measurementMath";

export type { GraphThreeEngineTickRuntime } from "./graphThreeEngineTickTypes";

export type GraphThreeEngineTickDeps = {
  runtime: GraphThreeEngineTickRuntime;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  renderer: WebGLRenderer;
  labelRenderer: CSS2DRenderer;
  perfBadge: HTMLDivElement;
  gridMesh: Mesh;
  gridUniforms: {
    uMinorStep: { value: number };
    uMajorStep: { value: number };
    uFadeDistance: { value: number };
    uGridOffset: { value: import("three").Vector2 };
    uCameraPosition: { value: import("three").Vector3 };
    uPlaneMode: { value: number };
  };
  objectNodes: Map<string, Object3D>;
  probeMarkersRoot: Group;
  probeMarkerMeshes: Mesh[];
  probeMarkerLabels: CSS2DObject[];
  measurementMarkersRoot: Group;
  measurementLines: import("three").Line[];
  measurementLabels: CSS2DObject[];
  hoverMarker: Mesh;
  getHoverProbePoint: () => { x: number; y: number; z: number } | null;
  axesGroup: Group;
  labelGroup: Group;
  applyBaselinePlane: (pair: "xy" | "xz" | "yz") => void;
  setAxisLabelRoles: (pair: "xy" | "xz" | "yz") => void;
  setProbeBadge: (text: string | null) => void;
  applyThemeToScene: (theme: ResolvedTheme) => void;
  resetCamera: () => void;
  syncObjects: (theme: ResolvedTheme) => void;
  requestNextFrame: (callback: () => void) => void;
};

export function createGraphThreeEngineTick(deps: GraphThreeEngineTickDeps): () => void {
  const {
    runtime,
    scene,
    camera,
    controls,
    renderer,
    labelRenderer,
    perfBadge,
    gridMesh,
    gridUniforms,
    objectNodes,
    probeMarkersRoot,
    probeMarkerMeshes,
    probeMarkerLabels,
    measurementMarkersRoot,
    measurementLines,
    measurementLabels,
    hoverMarker,
    getHoverProbePoint,
    axesGroup,
    labelGroup,
    applyBaselinePlane,
    setAxisLabelRoles,
    setProbeBadge,
    applyThemeToScene,
    resetCamera,
    syncObjects,
    requestNextFrame
  } = deps;

  const formatProbe = (p: { x: number; y: number; z: number }) =>
    `X ${p.x.toFixed(4)} · Y ${p.y.toFixed(4)} · Z ${p.z.toFixed(4)}`;

  const tick = () => {
    if (runtime.isContextLost) {
      requestNextFrame(tick);
      return;
    }

    const now = performance.now();
    const frameDeltaMs = now - runtime.lastFrameTime;
    runtime.lastFrameTime = now;
    runtime.lastFrameDeltaMs = frameDeltaMs;
    applyGraphThreeTickPerfSampling(now, frameDeltaMs, runtime, perfBadge, runtime.scenePressure);

    const storeState = useGraphStore.getState();
    const uiState = storeState.ui;
    applyBaselinePlane(uiState.baseline3dPlane);
    if (uiState.baseline3dPlane !== runtime.lastBaselinePlanePair) {
      runtime.lastBaselinePlanePair = uiState.baseline3dPlane;
      setAxisLabelRoles(uiState.baseline3dPlane);
      const distance = camera.position.distanceTo(controls.target);
      alignCameraToThreeBaseline(
        uiState.baseline3dPlane,
        controls.target.clone(),
        distance,
        camera,
        DEFAULT_CAMERA_POSITION.length()
      );
      controls.update();
    }
    syncOrbitControlsToCanvas3dTool(controls, uiState.canvas3dTool, runtime.isAltDown);

    const pinnedPins = uiState.probePins;
    const measurements = storeState.scene.measurements;
    const selectedMeasurementId = uiState.selectedMeasurementId;
    updateThreeProbeMarkers(pinnedPins, probeMarkersRoot, probeMarkerMeshes, probeMarkerLabels);
    updateThreeMeasurementMarkers(
      measurements,
      selectedMeasurementId,
      measurementMarkersRoot,
      measurementLines,
      measurementLabels
    );

    const hoverProbePoint = getHoverProbePoint();
    if (hoverProbePoint) {
      hoverMarker.position.set(hoverProbePoint.x, hoverProbePoint.y, hoverProbePoint.z);
      hoverMarker.visible = true;
    } else {
      hoverMarker.visible = false;
    }

    if (measurements.length > 0) {
      const last = measurements[measurements.length - 1];
      if (last.kind === "pin") {
        setProbeBadge(`Pin ${formatMeasurementValue(last)}`);
      } else if (last.kind === "distance") {
        setProbeBadge(`Distance ${formatMeasurementValue(last)}`);
      } else {
        setProbeBadge(`Angle ${formatMeasurementValue(last)}`);
      }
    } else if (pinnedPins.length > 0) {
      if (pinnedPins.length === 1) {
        setProbeBadge(`Pinned ${formatProbe(pinnedPins[0].world)}`);
      } else {
        setProbeBadge(
          `Pinned (${pinnedPins.length}) · Last: ${formatProbe(pinnedPins[pinnedPins.length - 1].world)}`
        );
      }
    } else {
      setProbeBadge(null);
    }

    const domTheme = readResolvedThemeFromDom();
    if (domTheme !== runtime.lastDomTheme) {
      runtime.lastDomTheme = domTheme;
      applyThemeToScene(domTheme);
      runtime.objectsDirty = true;
    }

    const camVersion = useGraphStore.getState().cameraResetVersion;
    if (camVersion !== runtime.lastCameraResetVersion) {
      runtime.lastCameraResetVersion = camVersion;
      resetCamera();
    }

    if (runtime.objectsDirty) {
      runtime.objectsDirty = false;
      syncObjects(domTheme);
      runtime.scenePressure = computeScenePressureFromObjects(useGraphStore.getState().scene.objects);
    }

    // Track frame timing + scene pressure (throttled inside the metrics module).
    recordFrameSample({
      nowMs: now,
      frameTimeMs: frameDeltaMs,
      viewport: "3d-viewport",
      scenePressure: runtime.scenePressure
    });

    controls.update();

    const distance = Math.hypot(camera.position.x, camera.position.y, camera.position.z);
    const near = Math.max(0.05, distance / 6_000);
    const far = Math.max(CAMERA_FAR_PLANE, distance * 25);
    if (Math.abs(camera.near - near) > 1e-6 || Math.abs(camera.far - far) > 0.5) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }

    syncGraphThreeTickGridFrame(camera, runtime, gridMesh, gridUniforms, axesGroup, labelGroup);

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);

    requestNextFrame(tick);
  };

  return tick;
}
