// S33 canvas interaction: hover, cursor, direct-manipulation drags, and
// camera framing for the Three.js viewports (UI-only, renderer-local).
//
// Precedence (PART 1): armed analysis pick > explicit canvas tools
// (probe/measure/draw) > active handle drag > handle press > body
// selection > camera gesture. Derived overlays are never pickable.
//
// - Hover: rAF-coalesced proxy raycast, material-only emphasis weaker than
//   selection, same-id guards (no store/React churn, no worker jobs).
// - Drags: orthographic panes only, literal-backed coordinates only,
//   hidden-axis preserving, pointer-captured, one-undo transactions.
// - Framing: camera-only (never math/scene/analysis).
// - Perspective: hover/select/frame supported; positional dragging disabled
//   (underdetermined — PART 16 policy).

import { Box3, Matrix4, Vector3, type Group, type Object3D, type PerspectiveCamera, type Raycaster, type Vector2, type WebGLRenderer } from "three";
import type { OrbitControls } from "three-stdlib";
import { useGraphStore } from "@/store/graphStore";
import { useEditorStore } from "@/lib/store/editorStore";
import { getEditorParameterScope } from "@/lib/store/editorParameters";
import { resolveVectorGeometry } from "@/lib/math/geometryResolve";
import { mathToWorld3D, worldToMath3D } from "@/lib/math/coordinates";
import { isTypingTarget } from "./graphThreeEngineDom";
import { applyHoverEmphasisToNode, SELECTION_EMPHASIS_KINDS } from "./buildGraphObjectDisposal";
import {
  clearInteractionHandles,
  pickInteractionHandle,
  resolveHandleWorldPositions,
  setActiveHandleEmphasis,
  syncInteractionHandles,
  type InteractionHandleHit
} from "./graphThreeInteractionHandles";
import {
  eligibleDragHandles,
  paneEditedAxes,
  type InteractionHandleKind,
  type OrthoPaneView
} from "@/lib/interaction/dragEligibility";
import { formatDragLiteral } from "@/lib/interaction/directManipulationLiterals";
import {
  beginDragTransaction,
  cancelDragTransaction,
  commitDragTransaction,
  isDragTransactionActive
} from "@/lib/interaction/dragHistoryTransaction";
import {
  fitSceneBounds,
  frameBoundsForObject,
  frameOrthoPane,
  framePerspectiveCamera
} from "./graphThreeFrameCamera";
import { computePaneRects } from "./graphThreeGeometryViews";
import { pickGeometryPrimitiveAtPointer } from "./graphThreePrimitivePick";
import { setPickRaycaster } from "./graphThreeEnginePickWorld";
import { snapWorldPoint } from "./graphThreeSnapWorld";
import type { GeometryMultiViewState } from "./graphThreeGeometryMultiView";
import type { PanePickContext } from "./graphThreeEngineInputTypes";
import type { GraphObject } from "@vinculum/scene/types";
import type { GeometryView } from "@/lib/types/ui";

export interface CanvasInteractionDeps {
  renderer: WebGLRenderer;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  raycaster: Raycaster;
  ndc: Vector2;
  objectsRoot: Group;
  interactionRoot: Group;
  objectNodes: Map<string, Object3D>;
  container: HTMLElement;
  multiView: GeometryMultiViewState;
  baselinePlane: import("three").Plane;
  tempGround: Vector3;
  getPickContext: (clientX: number, clientY: number) => PanePickContext | null;
}

interface ActiveDrag {
  objectId: string;
  handle: InteractionHandleKind;
  pane: OrthoPaneView;
  startClientX: number;
  startClientY: number;
  anchorMath: { x: number; y: number; z: number };
  anchorWorld: { x: number; y: number; z: number };
  pointerId: number;
  dirty: boolean;
  baselineWorkspace: string;
  baselineGraphMode: string;
  baselinePanesKey: string;
}

function panesKey(panes: GeometryView[] | null): string {
  return panes ? panes.join("+") : "legacy";
}

export function createCanvasInteraction(deps: CanvasInteractionDeps) {
  const { renderer, camera, controls, raycaster, ndc, objectsRoot, interactionRoot } = deps;
  const { container, multiView } = deps;

  let hoveredId: string | null = null;
  let hoveredHandle: InteractionHandleHit | null = null;
  let hoverRequested: { x: number; y: number } | null = null;
  let cameraDragging = false;
  let lastCursor = "\0";
  let lastEmphasisKey = "";
  let lastSceneRef: unknown = null;
  let lastSelectedId: string | null = null;
  let lastPaneKey = "";
  let lastParamsSignature = "";
  let activeDrag: ActiveDrag | null = null;
  let disposed = false;

  const readNodeBox = (objectId: string) => {
    const node = deps.objectNodes.get(objectId);
    if (!node) {
      return null;
    }
    try {
      const box = new Box3().setFromObject(node);
      if (box.isEmpty()) {
        return null;
      }
      return {
        min: { x: box.min.x, y: box.min.y, z: box.min.z },
        max: { x: box.max.x, y: box.max.y, z: box.max.z }
      };
    } catch {
      return null;
    }
  };

  const activeOrthoPane = (): OrthoPaneView | null => {
    const view = multiView.activeView;
    return view === "perspective" ? null : view;
  };

  const paneRectFor = (pane: OrthoPaneView) => {
    if (!multiView.panes) {
      return null;
    }
    const rect = container.getBoundingClientRect();
    const rects = computePaneRects(multiView.panes, rect.width, rect.height);
    const index = multiView.panes.indexOf(pane);
    return index >= 0 ? rects[index] ?? null : null;
  };

  const applyCursor = (cursor: string) => {
    if (cursor === lastCursor) {
      return;
    }
    lastCursor = cursor;
    renderer.domElement.style.cursor = cursor;
  };

  const syncEmphasis = (selectedId: string | null, hoverId: string | null) => {
    // Selection wins and is owned by the sync pass: the selected node is
    // never touched here (restoring it would wipe selection emphasis until
    // the next sync). Hover applies only to non-selected nodes.
    const kindsById = new Map<string, GraphObject["kind"]>();
    for (const object of useGraphStore.getState().scene.objects) {
      kindsById.set(object.id, object.kind);
    }
    for (const [id, node] of deps.objectNodes) {
      const kind = kindsById.get(id);
      if (!kind || !SELECTION_EMPHASIS_KINDS.has(kind) || id === selectedId) {
        continue;
      }
      applyHoverEmphasisToNode(node, id === hoverId);
    }
  };

  const refreshHandles = () => {
    const state = useGraphStore.getState();
    const selected = state.scene.objects.find((object) => object.id === state.ui.selectedObjectId) ?? null;
    const pane = activeOrthoPane();
    if (!selected || !pane || state.ui.canvas3dTool !== "pan" || state.ui.differentialAnalysisPickArmedId) {
      clearInteractionHandles(interactionRoot);
      return;
    }
    const handles = eligibleDragHandles(selected, pane).map((entry) => entry.handle);
    syncInteractionHandles(interactionRoot, selected, handles);
  };

  const endDragCleanup = () => {
    activeDrag = null;
    setActiveHandleEmphasis(interactionRoot, null);
  };

  const releaseCapture = (pointerId: number) => {
    try {
      if (renderer.domElement.hasPointerCapture?.(pointerId)) {
        renderer.domElement.releasePointerCapture(pointerId);
      }
    } catch {
      // Already released or unsupported.
    }
  };

  const cancelActiveDrag = () => {
    if (!activeDrag) {
      return;
    }
    const pointerId = activeDrag.pointerId;
    cancelDragTransaction();
    endDragCleanup();
    releaseCapture(pointerId);
    refreshHandles();
  };

  const commitActiveDrag = () => {
    if (!activeDrag) {
      return;
    }
    const pointerId = activeDrag.pointerId;
    const dirty = activeDrag.dirty;
    commitDragTransaction(dirty);
    endDragCleanup();
    releaseCapture(pointerId);
    refreshHandles();
  };

  const applyDragAt = (clientX: number, clientY: number): boolean => {
    const drag = activeDrag;
    if (!drag) {
      return false;
    }
    const rect = paneRectFor(drag.pane);
    if (!rect) {
      return false;
    }
    const state = useGraphStore.getState();
    const object = state.scene.objects.find((candidate) => candidate.id === drag.objectId);
    if (!object) {
      cancelActiveDrag();
      return false;
    }
    const delta = multiView.ortho.dragWorldDelta(
      drag.pane,
      clientX - drag.startClientX,
      clientY - drag.startClientY,
      rect
    );
    const targetWorld = {
      x: drag.anchorWorld.x + delta.x,
      y: drag.anchorWorld.y + delta.y,
      z: drag.anchorWorld.z + delta.z
    };
    const targetMath = worldToMath3D(targetWorld);
    const snapped = snapWorldPoint(targetMath, {
      enabled: state.ui.snapEnabled,
      step: state.ui.snapStep
    });
    const [axisA, axisB] = paneEditedAxes(drag.pane);
    const writes = dragFieldWrites(object, drag.handle, axisA, axisB, snapped, drag.anchorMath);
    if (writes.length === 0) {
      return true;
    }
    const store = useGraphStore.getState();
    let changed = false;
    for (const write of writes) {
      const current = (object as unknown as Record<string, unknown>)[write.field];
      if (current !== write.value) {
        store.updateGeometryCoordinate(object.id, write.field as Parameters<typeof store.updateGeometryCoordinate>[1], write.value);
        changed = true;
      }
    }
    if (changed) {
      drag.dirty = true;
      // Keep the grabbed marker glued to the pointer (no overlay rebuild).
      const marker = findHandleMarker(drag.objectId, drag.handle);
      if (marker) {
        const anchorMarker = markerWorldFor(drag, snapped);
        marker.position.set(anchorMarker.x, anchorMarker.y, anchorMarker.z);
      }
    }
    return true;
  };

  const findHandleMarker = (objectId: string, handle: InteractionHandleKind): { position: Vector3 } | null => {
    let found: { position: Vector3 } | null = null;
    interactionRoot.traverse((child) => {
      if (found) {
        return;
      }
      const hit = (child.userData as { vinculumDragHandle?: unknown }).vinculumDragHandle as
        | InteractionHandleHit
        | undefined;
      if (!hit || hit.objectId !== objectId || hit.handle !== handle) {
        return;
      }
      const material = (child as { material?: { colorWrite?: boolean } }).material;
      if (material && material.colorWrite === false) {
        return;
      }
      found = child as { position: Vector3 };
    });
    return found;
  };

  const markerWorldFor = (
    drag: ActiveDrag,
    snappedMath: { x: number; y: number; z: number }
  ): { x: number; y: number; z: number } => {
    // The marker tracks the dragged point: merged edited axes over the
    // anchor (hidden axis preserved). For tip drags the merged point IS the
    // new tip, so no origin/components recombination is needed.
    const [axisA, axisB] = paneEditedAxes(drag.pane);
    const merged = { ...drag.anchorMath };
    (merged as unknown as Record<string, number>)[axisA] = (snappedMath as unknown as Record<string, number>)[axisA] as number;
    (merged as unknown as Record<string, number>)[axisB] = (snappedMath as unknown as Record<string, number>)[axisB] as number;
    return mathToWorld3D(merged);
  };

  const tryStartDrag = (event: { clientX: number; clientY: number; button: number; pointerId: number }): boolean => {
    if (event.button !== 0) {
      return false;
    }
    const state = useGraphStore.getState();
    if (state.ui.canvas3dTool !== "pan") {
      return false;
    }
    if (state.ui.differentialAnalysisPickArmedId) {
      return false;
    }
    if (isDragTransactionActive()) {
      return false;
    }
    const pane = activeOrthoPane();
    if (!pane || !multiView.panes) {
      // Perspective positional dragging is disabled (underdetermined).
      return false;
    }
    const rect = paneRectFor(pane);
    if (!rect) {
      return false;
    }
    const canvasRect = container.getBoundingClientRect();
    // Pane ray setup reuses the shared S21 picker (identical NDC scoping,
    // multi-view override, and degenerate guards as selection picking).
    setPickRaycaster(
      { clientX: event.clientX, clientY: event.clientY },
      {
        renderer: deps.renderer,
        camera,
        raycaster,
        ndc,
        objectsRoot,
        baselinePlane: deps.baselinePlane,
        tempGround: deps.tempGround,
        pickOverride: {
          camera: multiView.ortho.getCamera(pane),
          rect: {
            left: canvasRect.left + rect.left,
            top: canvasRect.top + rect.top,
            width: rect.width,
            height: rect.height
          }
        }
      }
    );
    const hit = pickInteractionHandle(raycaster, interactionRoot);
    if (!hit) {
      return false;
    }
    const object = state.scene.objects.find((candidate) => candidate.id === hit.objectId);
    if (!object || state.ui.selectedObjectId !== object.id) {
      return false;
    }
    // Handles render only when eligible; re-verify eligibility at press time
    // (expression edits can lock a handle without a sync pass running yet).
    const eligible = eligibleDragHandles(object, pane).some((entry) => entry.handle === hit.handle);
    if (!eligible) {
      return false;
    }
    const anchor = anchorMathFor(object, hit.handle);
    if (!anchor) {
      return false;
    }
    // Commit/reconcile any focused editor draft before drag writing begins
    // (editors commit on blur per established semantics — no competing drafts).
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName)) {
      focused.blur();
    }
    if (!beginDragTransaction(object.id)) {
      return false;
    }
    const anchorWorld = mathToWorld3D(anchor);
    activeDrag = {
      objectId: object.id,
      handle: hit.handle,
      pane,
      startClientX: event.clientX,
      startClientY: event.clientY,
      anchorMath: anchor,
      anchorWorld,
      pointerId: event.pointerId,
      dirty: false,
      baselineWorkspace: state.ui.workspace,
      baselineGraphMode: state.ui.graphMode,
      baselinePanesKey: panesKey(multiView.panes)
    };
    try {
      renderer.domElement.setPointerCapture(event.pointerId);
    } catch {
      // Unsupported — the drag still tracks while over the canvas.
    }
    setActiveHandleEmphasis(interactionRoot, hit);
    return true;
  };

  const anchorMathFor = (
    object: GraphObject,
    handle: InteractionHandleKind
  ): { x: number; y: number; z: number } | null => {
    // Resolved (compiled) anchor: literal-backed by eligibility, but sibling
    // coordinates may be compiled expressions (e.g. x="1+2" while dragging
    // in YZ), so Number() of raw text is wrong — use the same resolvers the
    // renderer and handle markers use.
    const positions = resolveHandleWorldPositions(object);
    if (!positions) {
      return null;
    }
    const math =
      handle === "point"
        ? positions.point
        : handle === "origin"
          ? positions.origin
          : handle === "tip"
            ? positions.tip
            : handle === "start"
              ? positions.start
              : positions.end;
    if (!math || !Number.isFinite(math.x) || !Number.isFinite(math.y) || !Number.isFinite(math.z)) {
      return null;
    }
    return { x: math.x, y: math.y, z: math.z };
  };

  const onControlsStart = () => {
    cameraDragging = true;
  };
  const onControlsEnd = () => {
    cameraDragging = false;
  };
  controls.addEventListener("start", onControlsStart);
  controls.addEventListener("end", onControlsEnd);

  const handleWindowBlur = () => {
    if (disposed) {
      return;
    }
    // Losing focus mid-drag rolls back (safe: the user cannot see state).
    if (activeDrag) {
      cancelActiveDrag();
    }
  };
  window.addEventListener("blur", handleWindowBlur);

  const handlePointerCancel = (event: PointerEvent) => {
    if (disposed) {
      return;
    }
    // Pointercancel commits the current valid position (matches release),
    // but only for the owning pointer.
    if (activeDrag && event.pointerId === activeDrag.pointerId) {
      commitActiveDrag();
    }
  };
  renderer.domElement.addEventListener("pointercancel", handlePointerCancel);

  const tick = () => {
    if (disposed) {
      return;
    }
    const state = useGraphStore.getState();
    const selectedId = state.ui.selectedObjectId;

    // Mid-drag guards: tool/view/workspace/selection/deletion changes end
    // the gesture safely (PART 76/77/78). Arming an analysis pick mid-drag
    // also ends it (handles must not move geometry under an explicit tool).
    if (activeDrag) {
      const drag = activeDrag;
      if (state.ui.canvas3dTool !== "pan" || state.ui.differentialAnalysisPickArmedId !== null) {
        cancelActiveDrag();
      } else if (
        state.ui.workspace !== drag.baselineWorkspace ||
        state.ui.graphMode !== drag.baselineGraphMode ||
        panesKey(multiView.panes) !== drag.baselinePanesKey
      ) {
        cancelActiveDrag();
      } else if (selectedId !== null && selectedId !== drag.objectId) {
        commitActiveDrag();
      } else if (!state.scene.objects.some((object) => object.id === drag.objectId)) {
        // Deleted mid-drag: clear without restoring (delete is its own edit).
        cancelActiveDrag();
      }
    }

    // Handle overlay sync on selection/pane/scene/parameter changes.
    const paramsSignature = useEditorStore
      .getState()
      .parameters.map((parameter) => `${parameter.id}:${parameter.value}`)
      .join("|");
    const paneKey = multiView.activeView;
    const sceneRef = state.scene;
    if (
      sceneRef !== lastSceneRef ||
      selectedId !== lastSelectedId ||
      paneKey !== lastPaneKey ||
      paramsSignature !== lastParamsSignature
    ) {
      lastSceneRef = sceneRef;
      lastSelectedId = selectedId;
      lastPaneKey = paneKey;
      lastParamsSignature = paramsSignature;
      if (!activeDrag) {
        refreshHandles();
      }
      // Re-apply emphasis after rebuilds (nodes may be new objects).
      lastEmphasisKey = "";
    }

    // Hover pick, coalesced to one raycast per frame (PART 4).
    const tool = state.ui.canvas3dTool;
    if (
      hoverRequested &&
      !activeDrag &&
      !cameraDragging &&
      tool === "pan" &&
      !state.ui.differentialAnalysisPickArmedId
    ) {
      const { x, y } = hoverRequested;
      hoverRequested = null;
      const pickContext = deps.getPickContext(x, y);
      // Shared S21 ray setup (identical to selection picking); the handle
      // pass reuses the resulting ray before the body pass re-arms it.
      if (
        setPickRaycaster(
          { clientX: x, clientY: y },
          {
            renderer: deps.renderer,
            camera,
            raycaster,
            ndc,
            objectsRoot,
            baselinePlane: deps.baselinePlane,
            tempGround: deps.tempGround,
            pickOverride: pickContext
          }
        )
      ) {
        hoveredHandle = pickInteractionHandle(raycaster, interactionRoot);
        hoveredId = pickGeometryPrimitiveAtPointer(
          { clientX: x, clientY: y },
          {
            renderer: deps.renderer,
            camera,
            raycaster,
            ndc,
            objectsRoot,
            baselinePlane: deps.baselinePlane,
            tempGround: deps.tempGround,
            pickOverride: pickContext
          }
        );
      } else {
        hoveredId = null;
        hoveredHandle = null;
      }
    } else if (!hoverRequested) {
      // No-op: hover state persists until the next requested pick or leave.
    } else {
      hoverRequested = null;
    }

    // Emphasis sync on change only (no per-frame traversal storms).
    const emphasisKey = `${selectedId ?? ""}|${hoveredId ?? ""}|${hoveredHandle ? "h" : ""}`;
    if (emphasisKey !== lastEmphasisKey) {
      lastEmphasisKey = emphasisKey;
      syncEmphasis(selectedId, hoveredId);
    }

    // Cursor semantics (PART 2): armed pick > handle > hover > camera > default.
    if (state.ui.differentialAnalysisPickArmedId) {
      applyCursor("crosshair");
    } else if (activeDrag || hoveredHandle) {
      applyCursor("move");
    } else if (hoveredId !== null) {
      applyCursor("pointer");
    } else if (cameraDragging) {
      applyCursor("grabbing");
    } else {
      applyCursor("");
    }
  };

  return {
    /** Returns true when the gesture is consumed (skip camera + selection). */
    handlePointerDown(event: { clientX: number; clientY: number; button: number; pointerId: number }): boolean {
      return tryStartDrag(event);
    },
    /** Returns true while a handle drag continues (skip camera pan). */
    handlePointerMove(event: { clientX: number; clientY: number; pointerId: number }): boolean {
      if (activeDrag) {
        // S33-R5 (multi-pointer): only the owning pointer steers the drag;
        // unrelated pointers are swallowed so no camera gesture can run
        // alongside the object drag.
        if (event.pointerId === activeDrag.pointerId) {
          applyDragAt(event.clientX, event.clientY);
        }
        return true;
      }
      hoverRequested = { x: event.clientX, y: event.clientY };
      return false;
    },
    handlePointerUp(event?: { clientX: number; clientY: number; pointerId?: number }): void {
      if (activeDrag && event) {
        // A second pointer releasing must not commit someone else's drag.
        if (event.pointerId !== undefined && event.pointerId !== activeDrag.pointerId) {
          return;
        }
        applyDragAt(event.clientX, event.clientY);
      }
      if (activeDrag) {
        commitActiveDrag();
      }
    },
    handlePointerLeave(): void {
      hoverRequested = null;
      hoveredId = null;
      hoveredHandle = null;
      // Without pointer capture the drag cannot continue outside the canvas.
      if (activeDrag) {
        let captured = false;
        try {
          captured =
            renderer.domElement.hasPointerCapture?.(activeDrag.pointerId) === true;
        } catch {
          captured = false;
        }
        if (!captured) {
          commitActiveDrag();
        }
      }
    },
    /** Returns true when Escape cancelled a drag (caller skips other actions). */
    handleKeyDown(event: KeyboardEvent): boolean {
      if (event.key !== "Escape") {
        return false;
      }
      if (isTypingTarget(event.target)) {
        return false;
      }
      if (activeDrag) {
        event.preventDefault();
        cancelActiveDrag();
        return true;
      }
      return false;
    },
    /** Camera-only framing of the selected object in the active pane. */
    frameSelected(): boolean {
      const state = useGraphStore.getState();
      const selectedId = state.ui.selectedObjectId;
      if (!selectedId) {
        return false;
      }
      const object = state.scene.objects.find((candidate) => candidate.id === selectedId);
      if (!object) {
        return false;
      }
      const bounds = frameBoundsForObject(object, readNodeBox);
      if (!bounds) {
        return false;
      }
      if (!multiView.panes || multiView.activeView === "perspective") {
        return framePerspectiveCamera(camera, controls, bounds);
      }
      return frameOrthoPane(multiView.ortho, multiView.activeView, bounds);
    },
    /** Camera-only fit of visible content in the active pane. */
    fitScene(): boolean {
      const state = useGraphStore.getState();
      const bounds = fitSceneBounds(state.scene.objects, readNodeBox);
      if (!bounds) {
        return false;
      }
      if (!multiView.panes || multiView.activeView === "perspective") {
        return framePerspectiveCamera(camera, controls, bounds);
      }
      return frameOrthoPane(multiView.ortho, multiView.activeView, bounds);
    },
    isDragging(): boolean {
      return activeDrag !== null;
    },
    /** View/layout switch mid-drag: end with pre-drag restore (PART 76). */
    endForViewSwitch(): void {
      if (activeDrag) {
        cancelActiveDrag();
      }
    },
    /** Suspension/disposal mid-drag: commit current work (preserve math). */
    endForSuspend(): void {
      if (activeDrag) {
        commitActiveDrag();
      }
    },
    tick,
    dispose(): void {
      disposed = true;
      if (activeDrag) {
        commitActiveDrag();
      }
      controls.removeEventListener("start", onControlsStart);
      controls.removeEventListener("end", onControlsEnd);
      window.removeEventListener("blur", handleWindowBlur);
      renderer.domElement.removeEventListener("pointercancel", handlePointerCancel);
      clearInteractionHandles(interactionRoot);
      applyCursor("");
    }
  };
}

function dragFieldWrites(
  object: GraphObject,
  handle: InteractionHandleKind,
  axisA: "x" | "y" | "z",
  axisB: "x" | "y" | "z",
  snapped: { x: number; y: number; z: number },
  anchor: { x: number; y: number; z: number }
): Array<{ field: string; value: string }> {
  // Vector tip edits components (tip − origin); every other handle edits
  // positional fields directly. The hidden axis is never written.
  // S33-R6: the origin resolves through the compiler (same as the anchor),
  // never Number() of raw text — an expression-backed origin (parameter,
  // foldable text) would otherwise yield NaN and swallow the gesture.
  if (object.kind === "vector" && handle === "tip") {
    const resolved = resolveVectorGeometry(
      [object.oxExpr, object.oyExpr, object.ozExpr],
      [object.vxExpr, object.vyExpr, object.vzExpr],
      getEditorParameterScope()
    );
    if (resolved.status !== "ok") {
      return [];
    }
    const origin = resolved.value.origin;
    const suffix = (axis: "x" | "y" | "z") => (axis === "x" ? "vxExpr" : axis === "y" ? "vyExpr" : "vzExpr");
    const writes: Array<{ field: string; value: string }> = [];
    for (const axis of [axisA, axisB] as const) {
      const component =
        (snapped as unknown as Record<string, number>)[axis] -
        (origin as unknown as Record<string, number>)[axis];
      const formatted = formatDragLiteral(component);
      if (formatted !== null) {
        writes.push({ field: suffix(axis), value: formatted });
      }
    }
    return writes;
  }
  const prefixFor = (): string | null => {
    if (object.kind === "point" && handle === "point") {
      return "";
    }
    if (object.kind === "segment" && handle === "start") {
      return "a";
    }
    if (object.kind === "segment" && handle === "end") {
      return "b";
    }
    if (object.kind === "vector" && handle === "origin") {
      return "o";
    }
    if (object.kind === "line" && handle === "point") {
      return "p";
    }
    if (object.kind === "ray" && handle === "origin") {
      return "o";
    }
    return null;
  };
  const prefix = prefixFor();
  if (prefix === null) {
    return [];
  }
  void anchor;
  const suffix = (axis: "x" | "y" | "z") => `${prefix}${axis}Expr`;
  const writes: Array<{ field: string; value: string }> = [];
  for (const axis of [axisA, axisB] as const) {
    const formatted = formatDragLiteral((snapped as unknown as Record<string, number>)[axis]);
    if (formatted !== null) {
      writes.push({ field: suffix(axis), value: formatted });
    }
  }
  return writes;
}
