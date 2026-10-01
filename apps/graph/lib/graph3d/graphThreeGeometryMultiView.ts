import type { GraphRenderer } from "./graphRenderer";
import type { Group, PerspectiveCamera, Scene } from "three";
import type { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { GeometryOrthoController, type OrthoView } from "./graphThreeOrthoViews";
import { computePaneRects, routePointerToPaneIndex } from "./graphThreeGeometryViews";
import type { GeometryView } from "@/lib/types/ui";
import type { PaneRect } from "./graphThreeGeometryViews";

export interface GeometryMultiViewState {
  /** Null selects the legacy single-perspective behavior. */
  panes: GeometryView[] | null;
  activeView: GeometryView;
  ortho: GeometryOrthoController;
  drag: {
    view: OrthoView;
    startClientX: number;
    startClientY: number;
    /** Originating pointer; moves from other pointers never steer it. */
    pointerId: number;
  } | null;
  /** S34 touch pinch: two-pointer zoom/pan baseline (camera-only). */
  pointers: Array<{ id: number; x: number; y: number }>;
  pinch: {
    view: OrthoView;
    pointerIds: [number, number];
    distance: number;
    midClientX: number;
    midClientY: number;
  } | null;
}

export function createGeometryMultiViewState(): GeometryMultiViewState {
  return {
    panes: null,
    activeView: "perspective",
    ortho: new GeometryOrthoController(),
    drag: null,
    pointers: [],
    pinch: null
  };
}

const VALID_GEOMETRY_VIEWS: readonly string[] = ["perspective", "xy", "xz", "yz"];

export function setGeometryMultiViewPanes(state: GeometryMultiViewState, panes: GeometryView[] | null): void {
  // Only tilable compositions are supported (single/split/quad) and every
  // entry must name a real view: an invalid value would throw inside the
  // frame loop when the ortho orientation table is indexed.
  if (panes && panes.length !== 1 && panes.length !== 2 && panes.length !== 4) {
    return;
  }
  if (panes && panes.some((pane) => !VALID_GEOMETRY_VIEWS.includes(pane))) {
    return;
  }
  state.panes = panes && panes.length > 0 ? [...panes] : null;
  if (state.panes && !state.panes.includes(state.activeView)) {
    state.activeView = state.panes[0] as GeometryView;
  }
  if (!state.panes) {
    state.activeView = "perspective";
    state.drag = null;
    state.pinch = null;
    state.pointers = [];
  }
}

export function setActiveGeometryView(state: GeometryMultiViewState, view: GeometryView): void {
  if (state.panes && state.panes.includes(view)) {
    state.activeView = view;
  }
}

export function getActiveGeometryView(state: GeometryMultiViewState): GeometryView {
  return state.activeView;
}

export function resetActiveGeometryView(state: GeometryMultiViewState, resetPerspective: () => void): void {
  if (!state.panes) {
    resetPerspective();
    return;
  }
  if (state.activeView === "perspective") {
    resetPerspective();
    return;
  }
  state.ortho.resetView(state.activeView);
}

export interface MultiViewContainerPoint {
  x: number;
  y: number;
}

export function containerPointFromClient(
  containerRect: { left: number; top: number },
  clientX: number,
  clientY: number
): MultiViewContainerPoint {
  return { x: clientX - containerRect.left, y: clientY - containerRect.top };
}

function paneRectsForContainer(
  state: GeometryMultiViewState,
  containerWidth: number,
  containerHeight: number
): PaneRect[] {
  if (!state.panes) {
    return [];
  }
  return computePaneRects(state.panes, containerWidth, containerHeight);
}

/** Route a pointer and record it active without starting gestures. */
export function routeAndActivateGeometryView(
  state: GeometryMultiViewState,
  container: HTMLElement,
  clientX: number,
  clientY: number
): GeometryView | null {
  if (!state.panes) {
    return null;
  }
  const containerRect = container.getBoundingClientRect();
  if (containerRect.width <= 0 || containerRect.height <= 0) {
    return null;
  }
  const point = containerPointFromClient(containerRect, clientX, clientY);
  return routeMultiViewPointer(state, containerRect.width, containerRect.height, point.x, point.y);
}

/** Drop any in-progress orthographic drag (suspend/dispose paths). */
export function cancelGeometryMultiViewDrag(state: GeometryMultiViewState): void {
  state.drag = null;
  state.pinch = null;
  state.pointers = [];
}

/** Forget one tracked pointer (up/leave/cancel); ends pinch below two. */
export function forgetMultiViewPointer(state: GeometryMultiViewState, pointerId: number): void {
  state.pointers = state.pointers.filter((pointer) => pointer.id !== pointerId);
  if (state.pinch && !state.pinch.pointerIds.every((id) => state.pointers.some((pointer) => pointer.id === id))) {
    state.pinch = null;
  }
  if (state.pointers.length === 0) {
    state.drag = null;
  }
}

/** Route a container-relative pointer to its pane; records it active. */
export function routeMultiViewPointer(
  state: GeometryMultiViewState,
  containerWidth: number,
  containerHeight: number,
  x: number,
  y: number
): GeometryView | null {
  if (!state.panes) {
    return null;
  }
  const rects = paneRectsForContainer(state, containerWidth, containerHeight);
  const index = routePointerToPaneIndex(rects, x, y);
  const view = state.panes[index];
  if (view) {
    state.activeView = view;
  }
  return view ?? null;
}

export interface MultiViewPickContext {
  camera: PerspectiveCamera | import("three").OrthographicCamera;
  /** Client-coordinate rect scoping NDC computation to the pane. */
  rect: { left: number; top: number; width: number; height: number };
}

/** Pane-aware picking context for an event; null selects legacy behavior. */
export function multiViewPickContext(
  state: GeometryMultiViewState,
  perspectiveCamera: PerspectiveCamera,
  container: HTMLElement,
  clientX: number,
  clientY: number
): MultiViewPickContext | null {
  if (!state.panes) {
    return null;
  }
  const containerRect = container.getBoundingClientRect();
  if (containerRect.width <= 0 || containerRect.height <= 0) {
    return null;
  }
  const point = containerPointFromClient(containerRect, clientX, clientY);
  const rects = paneRectsForContainer(state, containerRect.width, containerRect.height);
  const index = routePointerToPaneIndex(rects, point.x, point.y);
  const pane = state.panes[index];
  const rect = rects[index];
  if (!pane || !rect) {
    return null;
  }
  if (pane === "perspective") {
    return {
      camera: perspectiveCamera,
      rect: {
        left: containerRect.left + rect.left,
        top: containerRect.top + rect.top,
        width: rect.width,
        height: rect.height
      }
    };
  }
  state.ortho.updateFrustum(pane, rect);
  return {
    camera: state.ortho.getCamera(pane),
    rect: {
      left: containerRect.left + rect.left,
      top: containerRect.top + rect.top,
      width: rect.width,
      height: rect.height
    }
  };
}

/**
 * Begin an orthographic grab-drag. Returns true when an ortho drag started,
 * so the caller can capture the pointer and keep the gesture alive outside
 * the canvas. False selects legacy behavior (also harmless for pan).
 *
 * S34 touch: two pointers in one ortho pane start a pinch (zoom + pan)
 * instead; pointer identity is tracked so a second finger never steers a
 * single drag. Touch pointerdown reports button 0 like mouse.
 */
export function multiViewPointerDown(
  state: GeometryMultiViewState,
  container: HTMLElement,
  // pointerId optional for legacy synthetic callers; production
  // PointerEvents always carry ids (S34-R21: never synthesize -1, which
  // would merge distinct streams).
  event: { clientX: number; clientY: number; button: number; pointerId?: number; pointerType?: string },
  tool: string
): boolean {
  if (!state.panes) {
    return false;
  }
  const eligibleButton = event.button === 0 || (event.pointerType !== undefined && event.pointerType !== "mouse" && event.button <= 0);
  if (!eligibleButton) {
    return false;
  }
  const containerRect = container.getBoundingClientRect();
  const point = containerPointFromClient(containerRect, event.clientX, event.clientY);
  const view = routeMultiViewPointer(state, containerRect.width, containerRect.height, point.x, point.y);
  // Ortho grab-drag starts on any tool except draw (which reserves the drag
  // for sketching), mirroring legacy behavior where probe-drag pans.
  if (view !== null && view !== "perspective" && tool !== "draw") {
    const pointerId = event.pointerId ?? -1;
    upsertMultiViewPointer(state, pointerId, event.clientX, event.clientY);
    // S34-R16: only same-pane partners pinch (route without activating —
    // routePointerToPaneIndex is side-effect free). A second finger in a
    // different pane stays an independent tracked pointer.
    const containerRect = container.getBoundingClientRect();
    const rects = paneRectsForContainer(state, containerRect.width, containerRect.height);
    const viewIndex = (state.panes ?? []).indexOf(view);
    const other = state.pointers
      .filter((pointer) => pointer.id !== pointerId)
      .filter((pointer) => {
        const partnerPoint = containerPointFromClient(containerRect, pointer.x, pointer.y);
        return routePointerToPaneIndex(rects, partnerPoint.x, partnerPoint.y) === viewIndex;
      })
      .pop();
    if (other) {
      // Second pointer in the gesture: pinch takes over from single-pan
      // (re-baselined, so no jump); camera pan stops immediately. Both
      // pointers route to this same pane (routed above for this event, and
      // the partner started here — panes only change via explicit UI).
      state.drag = null;
      state.pinch = {
        view,
        pointerIds: [other.id, pointerId],
        distance: Math.hypot(event.clientX - other.x, event.clientY - other.y),
        midClientX: (event.clientX + other.x) / 2,
        midClientY: (event.clientY + other.y) / 2
      };
      return true;
    }
    state.drag = { view, startClientX: event.clientX, startClientY: event.clientY, pointerId };
    return true;
  }
  state.drag = null;
  return false;
}

function upsertMultiViewPointer(
  state: GeometryMultiViewState,
  id: number,
  x: number,
  y: number
): void {
  const existing = state.pointers.find((pointer) => pointer.id === id);
  if (existing) {
    existing.x = x;
    existing.y = y;
    return;
  }
  state.pointers.push({ id, x, y });
}

export function multiViewPointerMove(
  state: GeometryMultiViewState,
  container: HTMLElement,
  event: { clientX: number; clientY: number; pointerId?: number }
): void {
  if (!state.panes) {
    return;
  }
  // S34-R15: hover moves (no buttons, untracked pointer) must not pollute
  // pinch tracking — otherwise a later single touch finds a stale partner
  // and starts a false pinch with a camera jump.
  const tracked = event.pointerId === undefined || state.pointers.some((pointer) => pointer.id === event.pointerId);
  if (!tracked) {
    return;
  }
  upsertMultiViewPointer(state, event.pointerId ?? -1, event.clientX, event.clientY);
  // S34 touch pinch: two pointers zoom toward their midpoint and pan with
  // it (camera-only; equivalent to the wheel path per finger pair).
  if (state.pinch) {
    const [firstId, secondId] = state.pinch.pointerIds;
    const first = state.pointers.find((pointer) => pointer.id === firstId);
    const second = state.pointers.find((pointer) => pointer.id === secondId);
    if (!first || !second) {
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const rects = paneRectsForContainer(state, containerRect.width, containerRect.height);
    const panes = state.panes;
    const index = panes.indexOf(state.pinch.view);
    const rect = rects[index];
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      state.pinch = null;
      return;
    }
    const midClientX = (first.x + second.x) / 2;
    const midClientY = (first.y + second.y) / 2;
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    const previous = state.pinch;
    // Pan with the midpoint first, then zoom anchored at the new midpoint.
    state.ortho.panByPixels(
      previous.view,
      midClientX - previous.midClientX,
      midClientY - previous.midClientY,
      rect
    );
    if (previous.distance > 0 && distance > 0) {
      const point = containerPointFromClient(containerRect, midClientX, midClientY);
      const ndcX = ((point.x - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((point.y - rect.top) / rect.height) * 2 + 1;
      state.ortho.zoomTowardScreen(previous.view, ndcX, ndcY, rect, previous.distance / distance);
    }
    state.pinch = {
      view: previous.view,
      pointerIds: previous.pointerIds,
      distance,
      midClientX,
      midClientY
    };
    return;
  }
  if (!state.drag) {
    return;
  }
  // S34-R16: only the originating pointer steers a single drag (a second
  // finger in another pane must not hijack it).
  if (event.pointerId !== undefined && event.pointerId !== state.drag.pointerId) {
    return;
  }
  const containerRect = container.getBoundingClientRect();
  const rects = paneRectsForContainer(state, containerRect.width, containerRect.height);
  const panes = state.panes;
  const index = panes.indexOf(state.drag.view);
  const rect = rects[index];
  if (!rect) {
    state.drag = null;
    return;
  }
  state.ortho.panByPixels(
    state.drag.view,
    event.clientX - state.drag.startClientX,
    event.clientY - state.drag.startClientY,
    rect
  );
  state.drag.startClientX = event.clientX;
  state.drag.startClientY = event.clientY;
}

export function multiViewPointerUp(state: GeometryMultiViewState, pointerId?: number): void {
  if (typeof pointerId === "number") {
    forgetMultiViewPointer(state, pointerId);
    return;
  }
  state.drag = null;
  state.pinch = null;
  state.pointers = [];
}

const WHEEL_ZOOM_SENSITIVITY = 0.0012;
const WHEEL_LINE_HEIGHT_PX = 16;

/**
 * Orthographic wheel zoom. Returns true when consumed (caller should
 * preventDefault); perspective panes and legacy mode return false.
 */
export function multiViewWheel(
  state: GeometryMultiViewState,
  container: HTMLElement,
  event: { clientX: number; clientY: number; deltaY: number; deltaMode: number }
): boolean {
  if (!state.panes) {
    return false;
  }
  const containerRect = container.getBoundingClientRect();
  const point = containerPointFromClient(containerRect, event.clientX, event.clientY);
  const view = routeMultiViewPointer(state, containerRect.width, containerRect.height, point.x, point.y);
  if (view === null || view === "perspective") {
    return false;
  }
  const deltaUnits = event.deltaMode === 1 ? event.deltaY * WHEEL_LINE_HEIGHT_PX : event.deltaY;
  if (!Number.isFinite(deltaUnits) || deltaUnits === 0) {
    return false;
  }
  // S33 PART 38: cursor-anchored ortho zoom (Math 2D consistency). The pane
  // rect for the routed view scopes NDC; center zoom is the safe fallback.
  const rects = paneRectsForContainer(state, containerRect.width, containerRect.height);
  const paneIndex = state.panes.indexOf(view);
  const rect = rects[paneIndex];
  if (rect && rect.width > 0 && rect.height > 0) {
    const ndcX = ((point.x - rect.left) / rect.width) * 2 - 1;
    const ndcY = -((point.y - rect.top) / rect.height) * 2 + 1;
    state.ortho.zoomTowardScreen(view, ndcX, ndcY, rect, Math.exp(deltaUnits * WHEEL_ZOOM_SENSITIVITY));
  } else {
    state.ortho.zoomByFactor(view, Math.exp(deltaUnits * WHEEL_ZOOM_SENSITIVITY));
  }
  return true;
}

export interface MultiViewRenderDeps {
  renderer: GraphRenderer;
  labelRenderer: CSS2DRenderer;
  scene: Scene;
  perspectiveCamera: PerspectiveCamera;
  container: HTMLElement;
  labelGroup: Group;
}

/**
 * Render every visible pane of the shared scene. Exactly one frame's worth
 * of draws; geometry sync runs once upstream regardless of pane count.
 * CSS2D labels and the axis label group are perspective-only: in multi-pane
 * layouts without a perspective pane they would project to wrong regions,
 * so labels are skipped and only mesh/marker geometry is shared.
 */
export function renderGeometryMultiViewPanes(state: GeometryMultiViewState, deps: MultiViewRenderDeps): void {
  const panes = state.panes;
  if (!panes || panes.length === 0) {
    return;
  }
  const { renderer, labelRenderer, scene, perspectiveCamera, container, labelGroup } = deps;
  const containerWidth = container.clientWidth;
  const containerHeight = container.clientHeight;
  if (containerWidth <= 0 || containerHeight <= 0) {
    return;
  }
  const hasPerspectivePane = panes.includes("perspective");
  labelGroup.visible = hasPerspectivePane;

  const rects = computePaneRects(panes, containerWidth, containerHeight);
  renderer.setScissorTest(true);
  const perspectiveIndex = panes.indexOf("perspective");
  for (let index = 0; index < panes.length; index += 1) {
    const pane = panes[index];
    const rect = rects[index];
    if (!pane || !rect || rect.width <= 0 || rect.height <= 0) {
      continue;
    }
    // three.js viewports/scissors use a bottom-left origin; pane rects use
    // top-left. The Y flip is purely a coordinate conversion, not a mirror:
    // NDC handedness is unchanged.
    const viewportY = containerHeight - (rect.top + rect.height);
    renderer.setViewport(rect.left, viewportY, rect.width, rect.height);
    renderer.setScissor(rect.left, viewportY, rect.width, rect.height);
    if (pane === "perspective") {
      // S16-R1: per-pane aspect — a half-width pane must not inherit the
      // full-container projection (which would squeeze the image ~2x).
      perspectiveCamera.aspect = rect.width / rect.height;
      perspectiveCamera.updateProjectionMatrix();
      renderer.render(scene, perspectiveCamera);
    } else {
      state.ortho.updateFrustum(pane, rect);
      renderer.render(scene, state.ortho.getCamera(pane));
    }
  }
  renderer.setScissorTest(false);
  // S16-R4: CSS2D labels project with one camera over the full label
  // viewport, so clip the label layer to the perspective pane. Without a
  // perspective pane there is nothing meaningful to label; probe and
  // measurement markers still render as shared scene geometry.
  const labelElement = labelRenderer.domElement as HTMLElement;
  if (perspectiveIndex >= 0) {
    const rect = rects[perspectiveIndex];
    if (rect) {
      labelElement.style.display = "block";
      labelElement.style.left = `${rect.left}px`;
      labelElement.style.top = `${rect.top}px`;
      labelRenderer.setSize(rect.width, rect.height);
      labelRenderer.render(scene, perspectiveCamera);
    }
  } else {
    labelElement.style.display = "none";
  }
}
