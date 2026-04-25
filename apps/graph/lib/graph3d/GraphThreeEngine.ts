import {
  ACESFilmicToneMapping,
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  Line,
  LineSegments,
  MOUSE,
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
import { createAdaptiveGridState, hasAdaptiveGridStateChanged } from "@/lib/graph/adaptiveGridState";
import {
  applyObjectColorToNode,
  buildGraphObject,
  disposeObject3D,
  getGraphObjectRenderSignature,
  getGraphObjectStructureSignature,
  sceneHasVisibleSurface,
  syncNonRenderableObjectNode
} from "@/lib/graph3d/buildGraphObjects";
import { dispatchGraphInteractionEvent } from "@/hooks/useAdaptiveResolution";
import { getGraphThemeTokens } from "@/lib/theme/graphTheme";
import type { ResolvedTheme } from "@/lib/theme/resolveTheme";
import { useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";

const DEFAULT_CAMERA_POSITION = new Vector3(6, 6, 6);
const CAMERA_FAR_PLANE = 30_000;
const BASE_AXIS_EXTENT = 120;
const LABEL_DISTANCE = 20;
const PERF_SAMPLE_WINDOW_MS = 1000;
const LONG_FRAME_MS = 34;
const LONG_FRAME_LOG_COOLDOWN_MS = 2000;

const GRID_VERTEX_SHADER = `
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const GRID_FRAGMENT_SHADER = `
uniform float uMinorStep;
uniform float uMajorStep;
uniform float uFadeDistance;
uniform vec2 uGridOffset;
uniform vec3 uCameraPosition;
uniform vec3 uMinorColor;
uniform vec3 uMajorColor;
uniform int uPlaneMode;

varying vec3 vWorldPosition;

float lineIntensity(vec2 coord, float step) {
  vec2 scaled = coord / step;
  vec2 grid = abs(fract(scaled - 0.5) - 0.5) / max(fwidth(scaled), vec2(0.0001));
  float dist = min(grid.x, grid.y);
  return 1.0 - min(dist, 1.0);
}

void main() {
  float safeMinorStep = max(uMinorStep, 0.0001);
  float safeMajorStep = max(uMajorStep, 0.0001);

  vec2 gridCoord;
  vec2 camCoord;
  if (uPlaneMode == 1) {
    // world.xy (math x-z baseline)
    gridCoord = vWorldPosition.xy - uGridOffset;
    camCoord = uCameraPosition.xy;
  } else if (uPlaneMode == 2) {
    // world.yz (math y-z baseline)
    gridCoord = vWorldPosition.yz - uGridOffset;
    camCoord = uCameraPosition.yz;
  } else {
    // world.xz (math x-y baseline)
    gridCoord = vWorldPosition.xz - uGridOffset;
    camCoord = uCameraPosition.xz;
  }
  float major = lineIntensity(gridCoord, safeMajorStep);
  float minor = lineIntensity(gridCoord, safeMinorStep);
  float minorMasked = minor * (1.0 - major);

  float radialDistance = distance(gridCoord + uGridOffset, camCoord);
  float fade = 1.0 - smoothstep(uFadeDistance * 0.12, uFadeDistance * 0.88, radialDistance);

  vec3 color = (uMinorColor * minorMasked) + (uMajorColor * major);
  float alpha = ((minorMasked * 0.38) + (major * 0.82)) * fade;

  if (alpha <= 0.001) {
    discard;
  }

  gl_FragColor = vec4(color, alpha);
}
`;

function readResolvedThemeFromDom(): ResolvedTheme {
  const value = document.documentElement.dataset.theme;
  if (value === "light" || value === "dark") {
    return value;
  }
  return "dark";
}

function computeAxisScaleAxes(x: number, y: number, z: number): number {
  const distance = Math.hypot(x, y, z);
  return Math.max(1, Math.min(4_500, distance / 5));
}

function computeAxisScaleLabels(x: number, y: number, z: number): number {
  const distance = Math.hypot(x, y, z);
  return Math.max(1, Math.min(4_500, distance / 18));
}

function createAxisGeometry(
  extent: number,
  axisColors: {
    negative: [number, number, number];
    xPositive: [number, number, number];
    yPositive: [number, number, number];
    zPositive: [number, number, number];
  }
): BufferGeometry {
  const segments = [
    { from: [-extent, 0, 0], to: [0, 0, 0], color: axisColors.negative },
    { from: [0, 0, 0], to: [extent, 0, 0], color: axisColors.xPositive },
    { from: [0, -extent, 0], to: [0, 0, 0], color: axisColors.negative },
    { from: [0, 0, 0], to: [0, extent, 0], color: axisColors.yPositive },
    { from: [0, 0, -extent], to: [0, 0, 0], color: axisColors.negative },
    { from: [0, 0, 0], to: [0, 0, extent], color: axisColors.zPositive }
  ] as const;

  const positions: number[] = [];
  const colorBuffer: number[] = [];

  for (const segment of segments) {
    positions.push(...segment.from, ...segment.to);
    colorBuffer.push(...segment.color, ...segment.color);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colorBuffer), 3));
  return geometry;
}

function createAxisTubeGroup(
  extent: number,
  axisColors: {
    negative: [number, number, number];
    xPositive: [number, number, number];
    yPositive: [number, number, number];
    zPositive: [number, number, number];
  }
): Group {
  const group = new Group();
  const radius = 0.005;
  const half = extent / 2;

  const addTube = (
    colorRgb: [number, number, number],
    position: [number, number, number],
    rotation: [number, number, number]
  ) => {
    const mesh = new Mesh(
      new CylinderGeometry(radius, radius, extent, 10),
      new MeshBasicMaterial({
        color: new Color(colorRgb[0], colorRgb[1], colorRgb[2]),
        transparent: true,
        opacity: 0.98
      })
    );
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    group.add(mesh);
  };

  // X axis
  addTube(axisColors.negative, [-half, 0, 0], [0, 0, Math.PI / 2]);
  addTube(axisColors.xPositive, [half, 0, 0], [0, 0, Math.PI / 2]);
  // Y axis
  addTube(axisColors.negative, [0, -half, 0], [0, 0, 0]);
  addTube(axisColors.yPositive, [0, half, 0], [0, 0, 0]);
  // Z axis
  addTube(axisColors.negative, [0, 0, -half], [Math.PI / 2, 0, 0]);
  addTube(axisColors.zPositive, [0, 0, half], [Math.PI / 2, 0, 0]);

  return group;
}

export interface GraphThreeEngine {
  dispose: () => void;
}

export function snapWorldPoint(
  point: { x: number; y: number; z: number },
  options: { enabled: boolean; step: number }
): { x: number; y: number; z: number } {
  if (!options.enabled || !Number.isFinite(options.step) || options.step <= 0) {
    return point;
  }
  const step = options.step;
  return {
    x: Math.round(point.x / step) * step,
    y: Math.round(point.y / step) * step,
    z: Math.round(point.z / step) * step
  };
}

export function createGraphThreeEngine(container: HTMLElement): GraphThreeEngine {
  const scene = new Scene();
  const camera = new PerspectiveCamera(48, 1, 0.1, CAMERA_FAR_PLANE);
  camera.position.copy(DEFAULT_CAMERA_POSITION);

  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance"
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
    "pointer-events-none absolute right-3 top-3 rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)]/80 px-2 py-1 font-mono text-[10px] text-[var(--text-secondary)] backdrop-blur";
  perfBadge.style.display = shouldShowPerfBadge() ? "block" : "none";
  perfBadge.textContent = "FPS -- · Frame --ms";
  perfBadge.setAttribute("data-graph3d-perf", "true");
  container.appendChild(perfBadge);

  const probeBadge = document.createElement("div");
  probeBadge.className =
    "pointer-events-none absolute left-3 bottom-11 rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)]/85 px-2 py-1 font-mono text-[10px] text-[var(--text-primary)] shadow";
  probeBadge.style.display = "none";
  probeBadge.setAttribute("data-graph3d-probe", "true");
  container.appendChild(probeBadge);
  const hoverProbeBadge = document.createElement("div");
  hoverProbeBadge.className =
    "pointer-events-none absolute rounded border border-[var(--border-subtle)] bg-[var(--surface-overlay)]/90 px-2 py-1 font-mono text-[10px] text-[var(--text-primary)] shadow";
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

  let lastCameraResetVersion = useGraphStore.getState().cameraResetVersion;
  let lastBaselinePlanePair = useGraphStore.getState().ui.baseline3dPlane;
  let lastDomTheme = readResolvedThemeFromDom();
  let objectsDirty = true;
  let gridState = createAdaptiveGridState(camera.position.x, camera.position.y, camera.position.z);

  let animationHandle = 0;
  let resizeObserver: ResizeObserver | null = null;
  let isContextLost = false;
  let lastFrameTime = performance.now();
  let sampleWindowStart = lastFrameTime;
  let sampleFrames = 0;
  let sampleWorstFrameMs = 0;
  let lastLongFrameLogAt = 0;
  let isAltDown = false;
  const raycaster = new Raycaster();
  const ndc = new Vector2();
  const baselinePlane = new Plane(new Vector3(0, 1, 0), 0);
  let baselinePlaneMode = 0;
  const tempProbe = new Vector3();
  const tempGround = new Vector3();
  let hoverProbePoint: { x: number; y: number; z: number } | null = null;
  let sketchPoints: { x: number; y: number; z: number }[] = [];

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

  const updateProbeMarkers = (pins: { id: string; color: string; world: { x: number; y: number; z: number } }[]) => {
    // Sync mesh count
    while (probeMarkerMeshes.length < pins.length) {
      const mesh = new Mesh(
        new SphereGeometry(0.08, 10, 10),
        new MeshBasicMaterial({ color: "#f472b6", transparent: true, opacity: 0.95 })
      );
      probeMarkerMeshes.push(mesh);
      probeMarkersRoot.add(mesh);

      const label = document.createElement("div");
      label.style.pointerEvents = "none";
      label.style.whiteSpace = "nowrap";
      label.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace";
      label.style.fontSize = "10px";
      label.style.padding = "2px 6px";
      label.style.borderRadius = "6px";
      label.style.border = "1px solid rgba(148,163,184,0.35)";
      label.style.background = "rgba(15,23,42,0.78)";
      label.style.color = "#e2e8f0";
      label.style.boxShadow = "0 6px 18px rgba(0,0,0,0.18)";
      const labelObj = new CSS2DObject(label);
      probeMarkerLabels.push(labelObj);
      probeMarkersRoot.add(labelObj);
    }
    while (probeMarkerMeshes.length > pins.length) {
      const mesh = probeMarkerMeshes.pop();
      if (mesh) {
        probeMarkersRoot.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as MeshBasicMaterial).dispose();
      }
      const label = probeMarkerLabels.pop();
      if (label) {
        probeMarkersRoot.remove(label);
        (label.element as HTMLElement).remove();
      }
    }

    // Update positions
    for (let i = 0; i < pins.length; i++) {
      const pin = pins[i];
      probeMarkerMeshes[i].position.set(pin.world.x, pin.world.y, pin.world.z);
      (probeMarkerMeshes[i].material as MeshBasicMaterial).color.set(pin.color);
      probeMarkerMeshes[i].userData.probePinId = pin.id;
      probeMarkerMeshes[i].visible = true;

      const labelObj = probeMarkerLabels[i];
      labelObj.position.set(pin.world.x, pin.world.y + 0.14, pin.world.z);
      const el = labelObj.element as HTMLElement;
      el.textContent = `X ${pin.world.x.toFixed(4)} · Y ${pin.world.y.toFixed(4)} · Z ${pin.world.z.toFixed(4)}`;
      labelObj.visible = true;
    }
  };

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

  const pickWorldPointFromEvent = (event: PointerEvent): { x: number; y: number; z: number } | null => {
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }
    ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);

    const hits = raycaster.intersectObjects(objectsRoot.children, true);
    for (const hit of hits) {
      if (hit.object instanceof Mesh) {
        return { x: hit.point.x, y: hit.point.y, z: hit.point.z };
      }
    }

    if (raycaster.ray.intersectPlane(baselinePlane, tempGround)) {
      return { x: tempGround.x, y: tempGround.y, z: tempGround.z };
    }
    return null;
  };

  const applyBaselinePlane = (pair: "xy" | "xz" | "yz") => {
    // 0: world.xz (xy baseline), 1: world.xy (xz baseline), 2: world.yz (yz baseline)
    if (pair === "xz") {
      baselinePlaneMode = 1;
      baselinePlane.normal.set(0, 0, 1);
      baselinePlane.constant = 0;
      gridMesh.rotation.set(0, 0, 0);
      gridMesh.position.set(0, 0, -0.0035);
    } else if (pair === "yz") {
      baselinePlaneMode = 2;
      baselinePlane.normal.set(1, 0, 0);
      baselinePlane.constant = 0;
      gridMesh.rotation.set(0, Math.PI / 2, 0);
      gridMesh.position.set(-0.0035, 0, 0);
    } else {
      baselinePlaneMode = 0;
      baselinePlane.normal.set(0, 1, 0);
      baselinePlane.constant = 0;
      gridMesh.rotation.set(-Math.PI / 2, 0, 0);
      gridMesh.position.set(0, -0.0035, 0);
    }
    (gridMaterial.uniforms.uPlaneMode as any).value = baselinePlaneMode;
  };

  const setAxisLabelRoles = (pair: "xy" | "xz" | "yz") => {
    const isBaseAxis = (axis: "x" | "y" | "z"): boolean => {
      if (pair === "xy") return axis === "x" || axis === "y";
      if (pair === "xz") return axis === "x" || axis === "z";
      return axis === "y" || axis === "z";
    };
    labelX.textContent = `X ${isBaseAxis("x") ? "base" : "perp"}`;
    labelY.textContent = `Z ${isBaseAxis("z") ? "base" : "perp"}`;
    labelZ.textContent = `Y ${isBaseAxis("y") ? "base" : "perp"}`;
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
    const allObjects = useGraphStore.getState().scene.objects;
    const parameterSignature = getParameterSignature();
    const hasSurfaces = sceneHasVisibleSurface(allObjects);
    keyLight.castShadow = hasSurfaces;
    renderer.shadowMap.enabled = hasSurfaces;
    const nextIds = new Set<string>();

    for (const object of allObjects) {
      nextIds.add(object.id);
      if (
        syncNonRenderableObjectNode(
          object,
          theme,
          objectsRoot,
          objectNodes,
          objectSignatures,
          objectStructureSignatures
        )
      ) {
        continue;
      }

      const nextSignature = `${theme}:${parameterSignature}:${getGraphObjectRenderSignature(object)}`;
      const nextStructure = `${theme}:${parameterSignature}:${getGraphObjectStructureSignature(object)}`;
      const prevSignature = objectSignatures.get(object.id);
      const prevStructure = objectStructureSignatures.get(object.id);
      if (prevSignature === nextSignature) {
        continue;
      }

      const prevNode = objectNodes.get(object.id);
      if (prevNode && prevStructure === nextStructure) {
        applyObjectColorToNode(prevNode, object.color);
        prevNode.visible = object.visible;
        objectSignatures.set(object.id, nextSignature);
        objectStructureSignatures.set(object.id, nextStructure);
        continue;
      }

      if (prevNode) {
        objectsRoot.remove(prevNode);
        disposeObject3D(prevNode);
        objectNodes.delete(object.id);
      }

      const nextNode = buildGraphObject(object, theme);
      if (nextNode) {
        nextNode.visible = object.visible;
        objectsRoot.add(nextNode);
        objectNodes.set(object.id, nextNode);
      }
      objectSignatures.set(object.id, nextSignature);
      objectStructureSignatures.set(object.id, nextStructure);
    }

    for (const [id, node] of objectNodes.entries()) {
      if (nextIds.has(id)) {
        continue;
      }
      objectsRoot.remove(node);
      disposeObject3D(node);
      objectNodes.delete(id);
      objectSignatures.delete(id);
      objectStructureSignatures.delete(id);
    }
  };

  const resetCamera = () => {
    controls.reset();
    const pair = useGraphStore.getState().ui.baseline3dPlane;
    const target = controls.target.clone();
    const distance = DEFAULT_CAMERA_POSITION.length();
    alignCameraToBaseline(pair, target, distance);
    controls.target.set(0, 0, 0);
    controls.update();
  };

  const alignCameraToBaseline = (
    pair: "xy" | "xz" | "yz",
    target: Vector3,
    distance: number
  ) => {
    const safeDistance = Number.isFinite(distance) && distance > 0.001 ? distance : DEFAULT_CAMERA_POSITION.length();
    let up = new Vector3(0, 1, 0);
    let direction = new Vector3(1, 1, 1);

    if (pair === "xz") {
      up = new Vector3(0, 0, 1);
      direction = new Vector3(1, -1, 1);
    } else if (pair === "yz") {
      up = new Vector3(1, 0, 0);
      direction = new Vector3(1, 1, 1);
    }

    camera.up.copy(up.normalize());
    const nextPosition = target.clone().add(direction.normalize().multiplyScalar(safeDistance));
    camera.position.copy(nextPosition);
    camera.lookAt(target);
  };

  let prevSceneRef = useGraphStore.getState().scene;
  const unsub = useGraphStore.subscribe((state) => {
    if (state.scene !== prevSceneRef) {
      prevSceneRef = state.scene;
      objectsDirty = true;
    }
  });
  let prevParameterSignature = getParameterSignature();
  const unsubEditor = useEditorStore.subscribe((state) => {
    const nextParameterSignature = state.parameters
      .map((parameter) => `${parameter.id}:${parameter.value}`)
      .join("|");
    if (nextParameterSignature !== prevParameterSignature) {
      prevParameterSignature = nextParameterSignature;
      objectsDirty = true;
    }
  });

  const tick = () => {
    if (isContextLost) {
      animationHandle = window.requestAnimationFrame(tick);
      return;
    }

    const now = performance.now();
    const frameDeltaMs = now - lastFrameTime;
    lastFrameTime = now;
    sampleFrames += 1;
    sampleWorstFrameMs = Math.max(sampleWorstFrameMs, frameDeltaMs);

    if (frameDeltaMs > LONG_FRAME_MS && now - lastLongFrameLogAt > LONG_FRAME_LOG_COOLDOWN_MS) {
      lastLongFrameLogAt = now;
      // Keep diagnostics low-noise with cooldown; helps catch intermittent stalls.
      console.warn("[graph3d] long frame", {
        frameMs: Number(frameDeltaMs.toFixed(2)),
        objectCount: objectNodes.size
      });
    }

    const sampleElapsedMs = now - sampleWindowStart;
    if (sampleElapsedMs >= PERF_SAMPLE_WINDOW_MS) {
      const fps = (sampleFrames * 1000) / sampleElapsedMs;
      perfBadge.textContent = `FPS ${Math.round(fps)} · Frame ${sampleWorstFrameMs.toFixed(1)}ms`;
      sampleWindowStart = now;
      sampleFrames = 0;
      sampleWorstFrameMs = 0;
    }

    const uiState = useGraphStore.getState().ui;
    applyBaselinePlane(uiState.baseline3dPlane);
    if (uiState.baseline3dPlane !== lastBaselinePlanePair) {
      lastBaselinePlanePair = uiState.baseline3dPlane;
      setAxisLabelRoles(uiState.baseline3dPlane);
      const distance = camera.position.distanceTo(controls.target);
      alignCameraToBaseline(uiState.baseline3dPlane, controls.target.clone(), distance);
      controls.update();
    }
    if (uiState.canvas3dTool === "pan" || isAltDown) {
      controls.enableRotate = true;
      controls.enablePan = true;
      controls.enableZoom = true;
      controls.mouseButtons.LEFT = MOUSE.ROTATE;
      controls.mouseButtons.RIGHT = MOUSE.PAN;
    } else if (uiState.canvas3dTool === "probe") {
      controls.enableRotate = false;
      controls.enablePan = false;
      controls.enableZoom = true;
      controls.mouseButtons.LEFT = MOUSE.PAN;
      controls.mouseButtons.RIGHT = MOUSE.PAN;
    } else {
      controls.enableRotate = false;
      controls.enablePan = false;
      controls.enableZoom = true;
      controls.mouseButtons.LEFT = MOUSE.PAN;
      controls.mouseButtons.RIGHT = MOUSE.PAN;
    }

    const pinnedPins = uiState.probePins;
    updateProbeMarkers(pinnedPins);

    if (hoverProbePoint) {
      hoverMarker.position.set(hoverProbePoint.x, hoverProbePoint.y, hoverProbePoint.z);
      hoverMarker.visible = true;
    } else {
      hoverMarker.visible = false;
    }

    if (pinnedPins.length > 0) {
      if (pinnedPins.length === 1) {
        setProbeBadge(`Pinned ${formatProbe(pinnedPins[0].world)}`);
      } else {
        setProbeBadge(`Pinned (${pinnedPins.length}) · Last: ${formatProbe(pinnedPins[pinnedPins.length - 1].world)}`);
      }
    } else {
      setProbeBadge(null);
    }

    const domTheme = readResolvedThemeFromDom();
    if (domTheme !== lastDomTheme) {
      lastDomTheme = domTheme;
      applyThemeToScene(domTheme);
      objectsDirty = true;
    }

    const camVersion = useGraphStore.getState().cameraResetVersion;
    if (camVersion !== lastCameraResetVersion) {
      lastCameraResetVersion = camVersion;
      resetCamera();
    }

    if (objectsDirty) {
      objectsDirty = false;
      syncObjects(domTheme);
    }

    controls.update();

    const distance = Math.hypot(camera.position.x, camera.position.y, camera.position.z);
    const near = Math.max(0.05, distance / 6_000);
    const far = Math.max(CAMERA_FAR_PLANE, distance * 25);
    if (Math.abs(camera.near - near) > 1e-6 || Math.abs(camera.far - far) > 0.5) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }

    const nextGrid = createAdaptiveGridState(camera.position.x, camera.position.y, camera.position.z);
    if (hasAdaptiveGridStateChanged(gridState, nextGrid)) {
      gridState = nextGrid;
      gridUniforms.uMinorStep.value = nextGrid.minorStep;
      gridUniforms.uMajorStep.value = nextGrid.majorStep;
      gridUniforms.uFadeDistance.value = nextGrid.fadeDistance;
      if (baselinePlaneMode === 1) {
        gridUniforms.uGridOffset.value.set(camera.position.x, camera.position.y);
      } else if (baselinePlaneMode === 2) {
        gridUniforms.uGridOffset.value.set(camera.position.y, camera.position.z);
      } else {
        gridUniforms.uGridOffset.value.set(nextGrid.gridOffset[0], nextGrid.gridOffset[1]);
      }
    }

    if (baselinePlaneMode === 1) {
      gridMesh.position.set(camera.position.x, camera.position.y, -0.0035);
    } else if (baselinePlaneMode === 2) {
      gridMesh.position.set(-0.0035, camera.position.y, camera.position.z);
    } else {
      gridMesh.position.set(camera.position.x, -0.0035, camera.position.z);
    }
    const diameter = nextGrid.fadeDistance * 2;
    gridMesh.scale.set(diameter, diameter, 1);
    gridUniforms.uCameraPosition.value.copy(camera.position);

    const axisScaleAxes = computeAxisScaleAxes(camera.position.x, camera.position.y, camera.position.z);
    axesGroup.scale.setScalar(axisScaleAxes);

    const axisScaleLabels = computeAxisScaleLabels(camera.position.x, camera.position.y, camera.position.z);
    labelGroup.scale.setScalar(axisScaleLabels);

    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);

    animationHandle = window.requestAnimationFrame(tick);
  };

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
    isContextLost = true;
    console.warn("[graph3d] WebGL context lost");
  };

  const handleContextRestored = () => {
    isContextLost = false;
    console.info("[graph3d] WebGL context restored");
    applyThemeToScene(readResolvedThemeFromDom());
    objectsDirty = true;
    resize();
  };

  renderer.domElement.addEventListener("webglcontextlost", handleContextLost, false);
  renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored, false);

  let isSketching = false;
  const appendSketchPoint = (point: { x: number; y: number; z: number }) => {
    const prev = sketchPoints[sketchPoints.length - 1];
    if (prev && Math.hypot(point.x - prev.x, point.y - prev.y, point.z - prev.z) < 0.04) {
      return;
    }
    sketchPoints = [...sketchPoints, point];
    const arr = new Float32Array(sketchPoints.length * 3);
    for (let i = 0; i < sketchPoints.length; i += 1) {
      const p = sketchPoints[i];
      arr[i * 3] = p.x;
      arr[i * 3 + 1] = p.y;
      arr[i * 3 + 2] = p.z;
    }
    sketchGeometry.setAttribute("position", new BufferAttribute(arr, 3));
    sketchGeometry.computeBoundingSphere();
    sketchLine.visible = sketchPoints.length > 1;
  };

  const clearSketch = () => {
    sketchPoints = [];
    sketchGeometry.setDrawRange(0, 0);
    sketchLine.visible = false;
  };

  const handlePointerMove = (event: PointerEvent) => {
    const tool = useGraphStore.getState().ui.canvas3dTool;
    if (tool === "probe") {
      const point = pickWorldPointFromEvent(event);
      const snappedPoint = point ? maybeSnapPoint(point) : null;
      hoverProbePoint = snappedPoint;
      if (snappedPoint) {
        const rect = renderer.domElement.getBoundingClientRect();
        setHoverProbeBadge(
          `Probe ${formatProbe(snappedPoint)}`,
          event.clientX - rect.left,
          event.clientY - rect.top
        );
      } else {
        setHoverProbeBadge(null, 0, 0);
      }
      return;
    }

    if (tool === "draw" && isSketching) {
      const point = pickWorldPointFromEvent(event);
      if (!point) {
        return;
      }
      const snapped = maybeSnapPoint(point);
      if (baselinePlaneMode === 1) snapped.z = 0;
      else if (baselinePlaneMode === 2) snapped.x = 0;
      else snapped.y = 0;
      appendSketchPoint(snapped);
    }
  };

  const handlePointerDown = (event: PointerEvent) => {
    const state = useGraphStore.getState();
    const tool = state.ui.canvas3dTool;
    if (tool === "probe") {
      const point = pickWorldPointFromEvent(event);
      state.setProbePinnedWorld(point ? maybeSnapPoint(point) : null);
      return;
    }

    if (tool === "draw" && event.button === 0) {
      isSketching = true;
      const point = pickWorldPointFromEvent(event);
      clearSketch();
      if (point) {
        const snapped = maybeSnapPoint(point);
        if (baselinePlaneMode === 1) snapped.z = 0;
        else if (baselinePlaneMode === 2) snapped.x = 0;
        else snapped.y = 0;
        appendSketchPoint(snapped);
      }
    }
  };

  const handlePointerUp = () => {
    const state = useGraphStore.getState();
    if (state.ui.canvas3dTool !== "draw" || !isSketching) {
      return;
    }
    isSketching = false;
    if (sketchPoints.length >= 4) {
      state.addSketchedParametricFromStroke3d(sketchPoints);
    }
    clearSketch();
  };

  const handlePointerLeave = () => {
    hoverProbePoint = null;
    setHoverProbeBadge(null, 0, 0);
    handlePointerUp();
  };

  renderer.domElement.addEventListener("pointermove", handlePointerMove);
  renderer.domElement.addEventListener("pointerdown", handlePointerDown);
  renderer.domElement.addEventListener("pointerup", handlePointerUp);
  renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (isTypingTarget(event.target)) {
      return;
    }
    if (event.key === "Alt") {
      isAltDown = true;
    } else if (event.key === "1") {
      useGraphStore.getState().setCanvas3dTool("pan");
    } else if (event.key === "2") {
      useGraphStore.getState().setCanvas3dTool("probe");
    } else if (event.key === "3") {
      useGraphStore.getState().setCanvas3dTool("draw");
    } else if (event.key === "Escape") {
      useGraphStore.getState().clearProbes();
      clearSketch();
    }
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (event.key === "Alt") {
      isAltDown = false;
    }
  };

  const handleContextMenu = (event: Event) => {
    event.preventDefault();
    event.stopPropagation?.();
    const tool = useGraphStore.getState().ui.canvas3dTool;
    if (tool !== "probe") {
      return;
    }
    const mouseEvent = event as MouseEvent;
    const rect = renderer.domElement.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    ndc.x = ((mouseEvent.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((mouseEvent.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(probeMarkerMeshes, false);
    const hit = hits[0];
    const id = hit?.object?.userData?.probePinId as string | undefined;
    if (id) {
      useGraphStore.getState().removeProbePin(id);
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);
  renderer.domElement.addEventListener("contextmenu", handleContextMenu);

  resizeObserver = new ResizeObserver(() => {
    resize();
  });
  resizeObserver.observe(container);
  resize();

  applyThemeToScene(lastDomTheme);
  setAxisLabelRoles(lastBaselinePlanePair);
  syncObjects(lastDomTheme);
  objectsDirty = false;

  animationHandle = window.requestAnimationFrame(tick);

  return {
    dispose: () => {
      window.cancelAnimationFrame(animationHandle);
      unsub();
      unsubEditor();
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

      while (objectsRoot.children.length > 0) {
        const child = objectsRoot.children[0];
        objectsRoot.remove(child);
        disposeObject3D(child);
      }
      objectNodes.clear();
      objectSignatures.clear();
      objectStructureSignatures.clear();

      scene.remove(objectsRoot);
      sketchGeometry.dispose();
      sketchMaterial.dispose();
      
      while (probeMarkerMeshes.length > 0) {
        const mesh = probeMarkerMeshes.pop();
        if (mesh) {
          probeMarkersRoot.remove(mesh);
          mesh.geometry.dispose();
          (mesh.material as MeshBasicMaterial).dispose();
        }
      }
      while (probeMarkerLabels.length > 0) {
        const label = probeMarkerLabels.pop();
        if (label) {
          probeMarkersRoot.remove(label);
          (label.element as HTMLElement).remove();
        }
      }
      scene.remove(probeMarkersRoot);

      hoverMarker.geometry.dispose();
      (hoverMarker.material as MeshBasicMaterial).dispose();
      scene.remove(hoverMarker);

      gridMesh.geometry.dispose();
      gridMaterial.dispose();
      if (axisLineGeometry) {
        axisLineGeometry.dispose();
      }
      if (axisLineSegments) {
        axisLineSegments.geometry.dispose();
        (axisLineSegments.material as LineBasicMaterial).dispose();
      }
      if (axisTubeGroup) {
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
      }
      originMesh.geometry.dispose();
      (originMesh.material as MeshBasicMaterial).dispose();
      labelX.remove();
      labelY.remove();
      labelZ.remove();
      perfBadge.remove();
      probeBadge.remove();
      hoverProbeBadge.remove();

      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
      if (labelRenderer.domElement.parentElement === container) {
        container.removeChild(labelRenderer.domElement);
      }
    }
  };
}

function getParameterSignature(): string {
  return useEditorStore
    .getState()
    .parameters.map((parameter) => `${parameter.id}:${parameter.value}`)
    .join("|");
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function shouldShowPerfBadge(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("perf") === "1") {
      return true;
    }
    return window.localStorage.getItem("vinculum:graph3d:showPerf") === "1";
  } catch {
    return false;
  }
}

function createAxisLabelDiv(text: string): HTMLDivElement {
  const div = document.createElement("div");
  div.textContent = text;
  div.className =
    "pointer-events-none rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide shadow-sm";
  return div;
}

function applyLabelStyles(
  labelX: HTMLDivElement,
  labelY: HTMLDivElement,
  labelZ: HTMLDivElement,
  tokens: ReturnType<typeof getGraphThemeTokens>
) {
  const style = {
    borderColor: tokens.axisLabelBorder,
    backgroundColor: tokens.axisLabelBg,
    color: tokens.axisLabelText
  };
  for (const el of [labelX, labelY, labelZ]) {
    el.style.borderColor = style.borderColor;
    el.style.backgroundColor = style.backgroundColor;
    el.style.color = style.color;
  }
}
