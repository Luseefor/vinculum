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
import { updateAnalysisOverlays, updateVectorCurlOverlays } from "./buildAnalysisOverlays";
import { updateScalarSliceOverlays } from "./buildScalarSliceOverlays";
import { updateStreamlineOverlays } from "./buildStreamlineOverlays";
import { getScalarSyncContext, syncScalarViz } from "@/lib/compute/scalarVizSync";
import { useScalarVizResultsStore } from "@/lib/compute/scalarVizResults";
import { getStreamlineSyncContext, syncStreamlines } from "@/lib/compute/streamlineSync";
import { useStreamlineResultsStore } from "@/lib/compute/streamlineResults";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import { useGeometryComputeStore } from "@/lib/compute/geometryComputeStatus";
import { formatMeasurementValue } from "@/lib/measurements/measurementMath";
import {
  renderGeometryMultiViewPanes,
  resetActiveGeometryView,
  type GeometryMultiViewState
} from "./graphThreeGeometryMultiView";
import {
  activeOrthoSpansForDisplay,
  computePrimitiveDisplayHalfExtent,
  perspectiveDistanceForDisplay,
  updateGeometryPrimitiveDisplay
} from "./graphThreePrimitiveDisplay";
import { updateGeometryAnalysisOverlays } from "./buildGeometryAnalysisOverlays";
import { updateLinearTransformOverlays } from "./buildLinearTransformOverlays";

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
  analysisOverlayRoot: Group;
  analysisOverlayCache: Map<string, { key: string; group: Group }>;
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
  container: HTMLElement;
  multiView: GeometryMultiViewState;
  isSuspended: () => boolean;
  /** S33 canvas interaction pass (hover/handles/cursor), before render. */
  onFrameEnd?: () => void;
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
    analysisOverlayRoot,
    analysisOverlayCache,
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
    requestNextFrame,
    container,
    multiView,
    isSuspended,
    onFrameEnd
  } = deps;

  const formatProbe = (p: { x: number; y: number; z: number }) =>
    `X ${p.x.toFixed(4)} · Y ${p.y.toFixed(4)} · Z ${p.z.toFixed(4)}`;

  const tick = () => {
    if (isSuspended()) {
      return;
    }
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
    // S21: derived analysis overlays (normal + tangent patch) for picked
    // surface points. Reads transient store records; rebuilds only on
    // input change; never touches object sync or the compute manager.
    updateAnalysisOverlays({
      analyses: uiState.differentialAnalysisBySourceId,
      objects: storeState.scene.objects,
      objectNodes,
      overlayRoot: analysisOverlayRoot,
      cache: analysisOverlayCache,
      theme: domTheme,
      params: getEditorParameterScope(),
      tokens: getGraphThemeTokens(domTheme),
      computeStatusOf: (sourceId) =>
        useGeometryComputeStore.getState().entries[sourceId]?.status ?? "idle",
      clearAnalysis: (sourceId) => useGraphStore.getState().clearDifferentialAnalysis(sourceId)
    });
    // S22: one transient curl arrow per analyzed 3D field. Same shared
    // overlay root (synchronized views for free), zero worker jobs, valid
    // while S20 sampling is pending (expressions evaluate directly).
    updateVectorCurlOverlays({
      records: uiState.vectorCalculusBySourceId,
      objects: storeState.scene.objects,
      objectNodes,
      overlayRoot: analysisOverlayRoot,
      cache: analysisOverlayCache,
      theme: domTheme,
      params: getEditorParameterScope(),
      tokens: getGraphThemeTokens(domTheme),
      clearVectorCalculus: (sourceId) => useGraphStore.getState().clearVectorCalculus(sourceId)
    });
    // S23: scalar-field jobs (heat/contour/gradient grids + planar slices)
    // requested signature-tracked, then slice meshes synced from the
    // result cache into the same shared overlay root. Source geometry
    // sync below is untouched (0 rebuilds from scalar controls).
    syncScalarViz(getScalarSyncContext(), storeState.scene.objects, getEditorParameterScope());
    updateScalarSliceOverlays({
      configs: uiState.scalarVizBySourceId,
      objects: storeState.scene.objects,
      objectNodes,
      results: useScalarVizResultsStore.getState().entries,
      overlayRoot: analysisOverlayRoot,
      cache: analysisOverlayCache,
      theme: domTheme,
      params: getEditorParameterScope()
    });
    // S24: streamline jobs (signature-tracked) plus packed-polyline
    // overlays in the same shared root. Source geometry sync below is
    // untouched (0 rebuilds from streamline controls).
    syncStreamlines(getStreamlineSyncContext(), storeState.scene.objects, getEditorParameterScope());
    updateStreamlineOverlays({
      configs: uiState.streamlineVizBySourceId,
      objects: storeState.scene.objects,
      objectNodes,
      results: useStreamlineResultsStore.getState().entries,
      overlayRoot: analysisOverlayRoot,
      cache: analysisOverlayCache,
      params: getEditorParameterScope()
    });

    const camVersion = useGraphStore.getState().cameraResetVersion;
    if (camVersion !== runtime.lastCameraResetVersion) {
      runtime.lastCameraResetVersion = camVersion;
      if (multiView.panes) {
        resetActiveGeometryView(multiView, resetCamera);
      } else {
        resetCamera();
      }
    }

    // S24-R1: pressure also refreshes when streamline configs change
    // (ui-only commits never set objectsDirty, but they change render
    // load). Ref comparison is exact: every config commit replaces the map.
    const streamlineConfigs = useGraphStore.getState().ui.streamlineVizBySourceId;
    const configsChanged = streamlineConfigs !== runtime.lastStreamlineConfigs;
    if (runtime.objectsDirty || configsChanged) {
      const needsSync = runtime.objectsDirty;
      runtime.objectsDirty = false;
      runtime.lastStreamlineConfigs = streamlineConfigs;
      if (needsSync) {
        syncObjects(domTheme);
      }
      runtime.scenePressure = computeScenePressureFromObjects(
        useGraphStore.getState().scene.objects,
        streamlineConfigs
      );
    }

    // Track frame timing + scene pressure (throttled inside the metrics module).
    recordFrameSample({
      nowMs: now,
      frameTimeMs: frameDeltaMs,
      viewport: "3d-viewport",
      scenePressure: runtime.scenePressure
    });

    if (multiView.panes) {
      if (multiView.activeView === "perspective") {
        controls.update();
      }
    } else {
      controls.update();
    }

    const distance = Math.hypot(camera.position.x, camera.position.y, camera.position.z);
    const near = Math.max(0.05, distance / 6_000);
    const far = Math.max(CAMERA_FAR_PLANE, distance * 25);
    if (Math.abs(camera.near - near) > 1e-6 || Math.abs(camera.far - far) > 0.5) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }

    syncGraphThreeTickGridFrame(camera, runtime, gridMesh, gridUniforms, axesGroup, labelGroup);

    // S26: camera-driven Line/Ray endpoint refresh (render-only, in
    // place). Runs after object sync so fresh nodes refresh the same
    // frame; steady-state cost is one node-map scan with a 2% drift gate.
    // S27: the same extent feeds derived plane-line overlays (PART 26).
    const primitiveDisplayHalfExtent = computePrimitiveDisplayHalfExtent(
      perspectiveDistanceForDisplay(camera),
      activeOrthoSpansForDisplay(multiView)
    );
    updateGeometryPrimitiveDisplay(objectNodes, primitiveDisplayHalfExtent);
    // S27: transient geometry-analysis overlays (projection markers,
    // connectors, intersection points/lines). Same shared overlay root
    // (synchronized views for free); facts recompute live from canonical
    // sources, zero worker jobs, no scene mutation.
    updateGeometryAnalysisOverlays({
      configs: uiState.geometryAnalysisBySourceId,
      objects: storeState.scene.objects,
      overlayRoot: analysisOverlayRoot,
      cache: analysisOverlayCache,
      params: getEditorParameterScope(),
      halfExtent: primitiveDisplayHalfExtent,
      clearAnalysis: (primaryId) => useGraphStore.getState().clearGeometryAnalysis(primaryId)
    });
    // S28: transient linearTransform overlays (transformed-vector
    // arrows, eigendirection lines). Same shared overlay root; facts
    // recompute live, zero worker jobs, no scene mutation.
    updateLinearTransformOverlays({
      configs: uiState.linearTransformAnalysisBySourceId,
      objects: storeState.scene.objects,
      overlayRoot: analysisOverlayRoot,
      cache: analysisOverlayCache,
      params: getEditorParameterScope(),
      clearAnalysis: (transformId) => useGraphStore.getState().clearLinearTransformAnalysis(transformId)
    });

    if (multiView.panes) {
      renderGeometryMultiViewPanes(multiView, {
        renderer,
        labelRenderer,
        scene,
        perspectiveCamera: camera,
        container,
        labelGroup
      });
    } else {
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
    }

    // S33 canvas interaction pass (hover pick, emphasis, handles, cursor)
    // runs before the frame is scheduled so state stays frame-coherent.
    onFrameEnd?.();

    requestNextFrame(tick);
  };

  return tick;
}
