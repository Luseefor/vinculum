import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  Line,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Plane,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Raycaster,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Object3D
} from "three";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { OrbitControls } from "three-stdlib";
import { createAdaptiveGridState } from "@/lib/graph/adaptiveGridState";
import { dispatchGraphInteractionEvent } from "@/hooks/useAdaptiveResolution";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import { useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";
import {
  computeScenePressureFromObjects,
  getLatestPerformanceMetricsSnapshot,
  subscribePerformanceMetrics
} from "@/lib/performance/performanceMetrics";
import { createAxisGeometry, createAxisTubeGroup } from "./graphThreeAxisGeometry";
import { alignCameraToThreeBaseline } from "./graphThreeCameraBaseline";
import { BASE_AXIS_EXTENT, CAMERA_FAR_PLANE, DEFAULT_CAMERA_POSITION, LABEL_DISTANCE } from "./graphThreeEngineConstants";
import {
  applyLabelStyles,
  createAxisLabelDiv,
  getParameterSignature,
  shouldShowPerfBadge
} from "./graphThreeEngineDom";
import { readResolvedThemeFromDom } from "./graphThreeEngineTheme";
import { GRID_FRAGMENT_SHADER, GRID_VERTEX_SHADER } from "./graphThreeGridShaders";
import { disposeGraphThreeEngineThreeResources } from "./graphThreeEngineDisposeResources";
import { createGraphThreeEngineInputHandlers } from "./graphThreeEngineInputHandlers";
import { createGraphThreeEngineTick } from "./graphThreeEngineTick";
import type { GraphThreeEngineTickRuntime } from "./graphThreeEngineTickTypes";
import { snapWorldPoint } from "./graphThreeSnapWorld";
import { syncThreeSceneObjects } from "./graphThreeSyncSceneObjects";
import type { GraphThreeEngine } from "./graphThreeEngineTypes";
import { reportWarning } from "@/lib/monitoring/errorReporting";

export type { GraphThreeEngine } from "./graphThreeEngineTypes";
export { snapWorldPoint } from "./graphThreeSnapWorld";

export function createGraphThreeEngine(container: HTMLElement): GraphThreeEngine {
  const scene = new Scene();
  const camera = new PerspectiveCamera(48, 1, 0.1, CAMERA_FAR_PLANE);
  camera.position.copy(DEFAULT_CAMERA_POSITION);

  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = false;
  renderer.shadowMap.type = PCFSoftShadowMap;

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.domElement.style.position = "absolute";
  labelRenderer.domElement.style.inset = "0";
  labelRenderer.domElement.style.pointerEvents = "none";

  container.style.position = "relative";
  container.appendChild(renderer.domElement);
  container.appendChild(labelRenderer.domElement);

  renderer.domElement.style.display = "block";
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.setAttribute("data-graph3d-canvas", "true");

  const perfBadge = document.createElement("div");
  perfBadge.className =
    "pointer-events-none absolute right-3 top-14 z-[18] rounded border border-[var(--border-subtle)]/70 bg-[var(--surface-overlay)]/75 px-2 py-1 font-mono text-[10px] text-[var(--text-secondary)] backdrop-blur";
  perfBadge.style.display = shouldShowPerfBadge() ? "block" : "none";
  perfBadge.textContent = "FPS -- · Frame --ms";
  perfBadge.setAttribute("data-graph3d-perf", "true");
  container.appendChild(perfBadge);

  const warningBadge = document.createElement("div");
  warningBadge.className =
    "pointer-events-none absolute left-3 bottom-[7.5rem] z-[18] max-w-[min(260px,calc(100%-1.5rem))] min-w-0 rounded border border-[var(--border-subtle)]/70 bg-[var(--surface-overlay)]/88 px-2 py-1 font-mono text-[10px] text-[var(--text-primary)] backdrop-blur whitespace-pre-line";
  warningBadge.style.display = "none";
  warningBadge.setAttribute("data-graph3d-performance-warning", "true");
  warningBadge.setAttribute("role", "status");
  warningBadge.setAttribute("aria-live", "polite");
  container.appendChild(warningBadge);

  const probeBadge = document.createElement("div");
  probeBadge.className =
    "pointer-events-none absolute left-3 bottom-16 z-[18] max-w-[min(280px,calc(100%-1.5rem))] min-w-0 rounded border border-[var(--border-subtle)]/70 bg-[var(--surface-overlay)]/88 px-2 py-1 font-mono text-[10px] text-[var(--text-primary)] shadow-sm backdrop-blur-sm";
  probeBadge.style.display = "none";
  probeBadge.setAttribute("data-graph3d-probe", "true");
  container.appendChild(probeBadge);
  const hoverProbeBadge = document.createElement("div");
  hoverProbeBadge.className =
    "pointer-events-none absolute z-[19] max-w-[min(240px,calc(100vw-2rem))] rounded border border-[var(--border-subtle)]/70 bg-[var(--surface-overlay)]/92 px-2 py-1 font-mono text-[10px] text-[var(--text-primary)] shadow-sm backdrop-blur-sm";
  hoverProbeBadge.style.display = "none";
  hoverProbeBadge.setAttribute("data-graph3d-probe-hover", "true");
  container.appendChild(hoverProbeBadge);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.5;
  controls.maxDistance = 80_000;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI;
  controls.target.set(0, 0, 0);

  const markInteraction = () => {
    dispatchGraphInteractionEvent();
  };
  controls.addEventListener("start", markInteraction);
  controls.addEventListener("change", markInteraction);

  const ambient = new AmbientLight(0xffffff, 0.4);
  scene.add(ambient);

  const hemi = new HemisphereLight(0xffffff, 0x444444, 0.5);
  scene.add(hemi);

  const keyLight = new DirectionalLight(0xffffff, 1);
  keyLight.position.set(8, 10, 6);
  keyLight.castShadow = false;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.normalBias = 0.02;
  keyLight.shadow.bias = -0.00008;
  scene.add(keyLight);

  const fillLight = new DirectionalLight(0xffffff, 0.35);
  fillLight.position.set(-6, 4, -8);
  scene.add(fillLight);

  const gridUniforms = {
    uMinorStep: { value: 1 },
    uMajorStep: { value: 1 },
    uFadeDistance: { value: 100 },
    uGridOffset: { value: new Vector2(0, 0) },
    uCameraPosition: { value: new Vector3() },
    uMinorColor: { value: new Color() },
    uMajorColor: { value: new Color() },
    uPlaneMode: { value: 0 }
  };

  const gridMaterial = new ShaderMaterial({
    depthWrite: false,
    side: DoubleSide,
    transparent: true,
    toneMapped: false,
    uniforms: gridUniforms,
    vertexShader: GRID_VERTEX_SHADER,
    fragmentShader: GRID_FRAGMENT_SHADER
  });

  const gridMesh = new Mesh(new PlaneGeometry(1, 1, 1, 1), gridMaterial);
  gridMesh.frustumCulled = false;
  gridMesh.rotation.x = -Math.PI / 2;
  gridMesh.position.y = -0.0035;
  scene.add(gridMesh);

  const axesGroup = new Group();
  scene.add(axesGroup);

  let axisLineGeometry: BufferGeometry | null = null;
  let axisLineSegments: LineSegments | null = null;
  let axisTubeGroup: Group | null = null;
  const originMesh = new Mesh(
    new SphereGeometry(0.045, 10, 10),
    new MeshBasicMaterial({ transparent: true, opacity: 0.65 })
  );
  originMesh.renderOrder = 3;
  axesGroup.add(originMesh);

  const labelGroup = new Group();
  scene.add(labelGroup);

  // World axis mapping in this renderer is: world.x -> math.X, world.y -> math.Z, world.z -> math.Y.
  // Keep label text aligned with math axes and annotate if the axis belongs to the selected baseline.
  const labelX = createAxisLabelDiv("X");
  const labelY = createAxisLabelDiv("Z");
  const labelZ = createAxisLabelDiv("Y");
  const css2dX = new CSS2DObject(labelX);
  const css2dY = new CSS2DObject(labelY);
  const css2dZ = new CSS2DObject(labelZ);
  css2dX.position.set(LABEL_DISTANCE, 0, 0);
  css2dY.position.set(0, LABEL_DISTANCE, 0);
  css2dZ.position.set(0, 0, LABEL_DISTANCE);
  labelGroup.add(css2dX, css2dY, css2dZ);

  const objectsRoot = new Group();
  scene.add(objectsRoot);
  const objectNodes = new Map<string, Object3D>();
  const objectSignatures = new Map<string, string>();
  const objectStructureSignatures = new Map<string, string>();

  const tickTime0 = performance.now();
  const tickRuntime: GraphThreeEngineTickRuntime = {
    isContextLost: false,
    isAltDown: false,
    lastFrameTime: tickTime0,
    lastFrameDeltaMs: 0,
    sampleWindowStart: tickTime0,
    sampleFrames: 0,
    sampleFrameTimeSumMs: 0,
    sampleWorstFrameMs: 0,
    lastLongFrameLogAt: 0,
    lastBaselinePlanePair: useGraphStore.getState().ui.baseline3dPlane,
    lastDomTheme: readResolvedThemeFromDom(),
    lastCameraResetVersion: useGraphStore.getState().cameraResetVersion,
    objectsDirty: true,
    gridState: createAdaptiveGridState(camera.position.x, camera.position.y, camera.position.z),
    baselinePlaneMode: 0,
    scenePressure: computeScenePressureFromObjects(useGraphStore.getState().scene.objects)
  };

  let animationHandle = 0;
  let resizeObserver: ResizeObserver | null = null;
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const baselinePlane = new Plane(new Vector3(0, 1, 0), 0);
  const tempGround = new Vector3();
  const inputMutable = {
    isSketching: false,
    hoverProbePoint: null as { x: number; y: number; z: number } | null,
    sketchPoints: [] as { x: number; y: number; z: number }[]
  };

  const sketchGeometry = new BufferGeometry();
  const sketchMaterial = new LineBasicMaterial({
    color: "#38bdf8",
    transparent: true,
    opacity: 0.95
  });
  const sketchLine = new Line(sketchGeometry, sketchMaterial);
  sketchLine.visible = false;
  scene.add(sketchLine);

  const probeMarkersRoot = new Group();
  scene.add(probeMarkersRoot);
  const probeMarkerMeshes: Mesh[] = [];
  const probeMarkerLabels: CSS2DObject[] = [];
  const measurementMarkersRoot = new Group();
  scene.add(measurementMarkersRoot);
  const measurementLines: Line[] = [];
  const measurementLabels: CSS2DObject[] = [];

  const hoverMarker = new Mesh(
    new SphereGeometry(0.08, 10, 10),
    new MeshBasicMaterial({ color: "#f472b6", transparent: true, opacity: 0.5 })
  );
  hoverMarker.visible = false;
  scene.add(hoverMarker);

  const setProbeBadge = (text: string | null) => {
    if (!text) {
      probeBadge.style.display = "none";
      return;
    }
    probeBadge.textContent = text;
    probeBadge.style.display = "block";
  };
  const setHoverProbeBadge = (text: string | null, screenX: number, screenY: number) => {
    if (!text) {
      hoverProbeBadge.style.display = "none";
      return;
    }
    const maxX = Math.max(0, container.clientWidth - 220);
    const maxY = Math.max(0, container.clientHeight - 36);
    hoverProbeBadge.textContent = text;
    hoverProbeBadge.style.left = `${Math.min(screenX + 12, maxX)}px`;
    hoverProbeBadge.style.top = `${Math.min(screenY + 12, maxY)}px`;
    hoverProbeBadge.style.display = "block";
  };

  const formatProbe = (p: { x: number; y: number; z: number }) =>
    `X ${p.x.toFixed(4)} · Y ${p.y.toFixed(4)} · Z ${p.z.toFixed(4)}`;

  const maybeSnapPoint = (point: { x: number; y: number; z: number }): { x: number; y: number; z: number } => {
    const ui = useGraphStore.getState().ui;
    return snapWorldPoint(point, { enabled: ui.snapEnabled, step: ui.snapStep });
  };

  const applyBaselinePlane = (pair: "xy" | "xz" | "yz") => {
    // 0: world.xz (xy baseline), 1: world.xy (xz baseline), 2: world.yz (yz baseline)
    if (pair === "xz") {
      tickRuntime.baselinePlaneMode = 1;
      baselinePlane.normal.set(0, 0, 1);
      baselinePlane.constant = 0;
      gridMesh.rotation.set(0, 0, 0);
      gridMesh.position.set(0, 0, -0.0035);
    } else if (pair === "yz") {
      tickRuntime.baselinePlaneMode = 2;
      baselinePlane.normal.set(1, 0, 0);
      baselinePlane.constant = 0;
      gridMesh.rotation.set(0, Math.PI / 2, 0);
      gridMesh.position.set(-0.0035, 0, 0);
    } else {
      tickRuntime.baselinePlaneMode = 0;
      baselinePlane.normal.set(0, 1, 0);
      baselinePlane.constant = 0;
      gridMesh.rotation.set(-Math.PI / 2, 0, 0);
      gridMesh.position.set(0, -0.0035, 0);
    }
    (gridMaterial.uniforms.uPlaneMode as any).value = tickRuntime.baselinePlaneMode;
  };

  /** World axis letters only; base-plane context lives in the 3D viewport chrome. */
  const setAxisLabelRoles = (_pair: "xy" | "xz" | "yz") => {
    labelX.textContent = "X";
    labelY.textContent = "Z";
    labelZ.textContent = "Y";
  };

  const rebuildAxesGeometry = (theme: ResolvedTheme) => {
    const tokens = getGraphThemeTokens(theme);

    if (axisLineSegments) {
      axesGroup.remove(axisLineSegments);
      axisLineSegments.geometry.dispose();
      (axisLineSegments.material as LineBasicMaterial).dispose();
      axisLineSegments = null;
    }
    if (axisLineGeometry) {
      axisLineGeometry.dispose();
      axisLineGeometry = null;
    }
    if (axisTubeGroup) {
      axesGroup.remove(axisTubeGroup);
      axisTubeGroup.traverse((child) => {
        if (child instanceof Mesh) {
          child.geometry.dispose();
          const mat = child.material;
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose());
          } else {
            mat.dispose();
          }
        }
      });
      axisTubeGroup = null;
    }

    axisLineGeometry = createAxisGeometry(BASE_AXIS_EXTENT, {
      negative: tokens.axisNegativeRgb,
      xPositive: tokens.axisXPositiveRgb,
      yPositive: tokens.axisYPositiveRgb,
      zPositive: tokens.axisZPositiveRgb
    });
    const axisMaterial = new LineBasicMaterial({ transparent: true, opacity: 0.88 });
    axisMaterial.vertexColors = true;
    axisLineSegments = new LineSegments(axisLineGeometry, axisMaterial);
    axisLineSegments.renderOrder = 2;
    axesGroup.add(axisLineSegments);

    axisTubeGroup = createAxisTubeGroup(BASE_AXIS_EXTENT, {
      negative: tokens.axisNegativeRgb,
      xPositive: tokens.axisXPositiveRgb,
      yPositive: tokens.axisYPositiveRgb,
      zPositive: tokens.axisZPositiveRgb
    });
    axesGroup.add(axisTubeGroup);

    (originMesh.material as MeshBasicMaterial).color.set(tokens.axisOrigin);

    applyLabelStyles(labelX, labelY, labelZ, tokens);

    gridUniforms.uMinorColor.value.set(tokens.gridMinor);
    gridUniforms.uMajorColor.value.set(tokens.gridMajor);
  };

  const applyThemeToScene = (theme: ResolvedTheme) => {
    const tokens = getGraphThemeTokens(theme);
    scene.background = new Color(tokens.surfaceCanvas);
    ambient.intensity = tokens.sceneAmbientIntensity;
    hemi.intensity = tokens.sceneHemiIntensity;
    hemi.color.set(tokens.sceneHemiSky);
    hemi.groundColor.set(tokens.sceneHemiGround);
    keyLight.intensity = tokens.sceneKeyIntensity;
    fillLight.intensity = tokens.sceneFillIntensity;

    rebuildAxesGeometry(theme);
  };

  const syncObjects = (theme: ResolvedTheme) => {
    syncThreeSceneObjects(
      theme,
      useGraphStore.getState().scene.objects,
      objectsRoot,
      objectNodes,
      objectSignatures,
      objectStructureSignatures,
      keyLight,
      renderer
    );
  };

  const resetCamera = () => {
    controls.reset();
    const pair = useGraphStore.getState().ui.baseline3dPlane;
    const target = controls.target.clone();
    const distance = DEFAULT_CAMERA_POSITION.length();
    alignCameraToThreeBaseline(pair, target, distance, camera, DEFAULT_CAMERA_POSITION.length());
    controls.target.set(0, 0, 0);
    controls.update();
  };

  let prevSceneRef = useGraphStore.getState().scene;
  const unsub = useGraphStore.subscribe((state) => {
    if (state.scene !== prevSceneRef) {
      prevSceneRef = state.scene;
      tickRuntime.objectsDirty = true;
    }
  });
  let prevParameterSignature = getParameterSignature();
  const unsubEditor = useEditorStore.subscribe((state) => {
    const nextParameterSignature = state.parameters
      .map((parameter) => `${parameter.id}:${parameter.value}`)
      .join("|");
    if (nextParameterSignature !== prevParameterSignature) {
      prevParameterSignature = nextParameterSignature;
      tickRuntime.objectsDirty = true;
    }
  });

  let prevPerfHud = useEditorStore.getState().showPerfHud;
  const unsubPerfHud = useEditorStore.subscribe((state) => {
    if (state.showPerfHud === prevPerfHud) return;
    prevPerfHud = state.showPerfHud;
    perfBadge.style.display = shouldShowPerfBadge() ? "block" : "none";
  });

  const unsubPerformanceMetrics = subscribePerformanceMetrics(() => {
    const latest = getLatestPerformanceMetricsSnapshot();
    if (latest.warningLevel === "ok") {
      warningBadge.style.display = "none";
      return;
    }
    const firstItems = latest.warningItems.slice(0, 3);
    const itemsText = firstItems.length > 0 ? firstItems.join("\n") : latest.warningSummary;
    warningBadge.textContent = `${latest.warningSummary}\n${itemsText}`;
    warningBadge.style.display = "block";
  });

  const requestNextFrame = (callback: () => void) => {
    animationHandle = window.requestAnimationFrame(callback);
  };

  const {
    handlePointerMove,
    handlePointerDown,
    handlePointerUp,
    handlePointerLeave,
    handleKeyDown,
    handleKeyUp,
    handleContextMenu
  } = createGraphThreeEngineInputHandlers({
    mutable: inputMutable,
    tickRuntime,
    renderer,
    camera,
    raycaster,
    ndc,
    objectsRoot,
    baselinePlane,
    tempGround,
    probeMarkerMeshes,
    sketchGeometry,
    sketchLine,
    maybeSnapPoint,
    formatProbe,
    setHoverProbeBadge
  });

  const tick = createGraphThreeEngineTick({
    runtime: tickRuntime,
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
    getHoverProbePoint: () => inputMutable.hoverProbePoint,
    axesGroup,
    labelGroup,
    applyBaselinePlane,
    setAxisLabelRoles,
    setProbeBadge,
    applyThemeToScene,
    resetCamera,
    syncObjects,
    requestNextFrame
  });

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width <= 0 || height <= 0) {
      return;
    }
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    labelRenderer.setSize(width, height);
  };

  const handleContextLost = (event: Event) => {
    event.preventDefault();
    tickRuntime.isContextLost = true;
    reportWarning("WebGL context lost.", {
      featureArea: "3d-viewport",
      operation: "webgl-context-lost"
    });
  };

  const handleContextRestored = () => {
    tickRuntime.isContextLost = false;
    reportWarning("WebGL context restored.", {
      featureArea: "3d-viewport",
      operation: "webgl-context-restored"
    });
    applyThemeToScene(readResolvedThemeFromDom());
    tickRuntime.objectsDirty = true;
    resize();
  };

  renderer.domElement.addEventListener("webglcontextlost", handleContextLost, false);
  renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored, false);

  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  renderer.domElement.addEventListener("pointerdown", handlePointerDown);
  renderer.domElement.addEventListener("pointerup", handlePointerUp);
  renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  renderer.domElement.addEventListener("contextmenu", handleContextMenu);

  resizeObserver = new ResizeObserver(() => {
    resize();
  });
  resizeObserver.observe(container);
  resize();

  applyThemeToScene(tickRuntime.lastDomTheme);
  setAxisLabelRoles(tickRuntime.lastBaselinePlanePair);
  syncObjects(tickRuntime.lastDomTheme);
  tickRuntime.objectsDirty = false;

  animationHandle = window.requestAnimationFrame(tick);

  return {
    dispose: () => {
      window.cancelAnimationFrame(animationHandle);
      unsub();
      unsubEditor();
      unsubPerfHud();
      unsubPerformanceMetrics();
      resizeObserver?.disconnect();
      resizeObserver = null;
      controls.removeEventListener("start", markInteraction);
      controls.removeEventListener("change", markInteraction);
      controls.dispose();
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);

      disposeGraphThreeEngineThreeResources({
        scene,
        objectsRoot,
        objectNodes,
        objectSignatures,
        objectStructureSignatures,
        sketchGeometry,
        sketchMaterial,
        probeMarkersRoot,
        probeMarkerMeshes,
        probeMarkerLabels,
        measurementMarkersRoot,
        measurementLines,
        measurementLabels,
        hoverMarker,
        gridMesh,
        gridMaterial,
        axisLineGeometry,
        axisLineSegments,
        axisTubeGroup,
        originMesh,
        labelX,
        labelY,
        labelZ,
        perfBadge,
        warningBadge,
        probeBadge,
        hoverProbeBadge,
        renderer,
        labelRenderer,
        container
      });
    }
  };
}
