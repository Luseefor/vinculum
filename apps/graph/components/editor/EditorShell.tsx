"use client";

import GraphViewportErrorBoundary from "@/components/graph/GraphViewportErrorBoundary";
import BottomDockPremium from "@/components/editor/BottomDockPremium";
import CommandPalette from "@/components/editor/CommandPalette";
import ContextInspectorDrawer from "@/components/editor/ContextInspectorDrawer";
import ContextMenu from "@/components/editor/ContextMenu";
import EditorHeader from "@/components/editor/EditorHeader";
import EditorLayoutPremium from "@/components/editor/EditorLayoutPremium";
import InspectorPremium from "@/components/editor/InspectorPremium";
import InspectorShell from "@/components/editor/InspectorShell";
import SceneNavigatorPremium from "@/components/editor/SceneNavigatorPremium";
import SelectedObjectChip from "@/components/editor/SelectedObjectChip";
import StatusBar from "@/components/editor/StatusBar";
import FirstRunHint from "@/components/onboarding/FirstRunHint";
import RecoveryDialog from "@/components/projects/RecoveryDialog";
import SceneImportExportDialog from "@/components/scene/SceneImportExportDialog";
import SharedSceneConfirmDialog from "@/components/scene/SharedSceneConfirmDialog";
import ThemeSync from "@/components/theme/ThemeSync";
import { Sheet } from "@/components/ui/sheet";
import ViewportHost from "@/components/viewport/ViewportHost";
import { createObjectByKey } from "@/lib/objects/objectCreation";
import { descriptorByCommandId } from "@/lib/objects/objectDescriptors";
import GeometryViewport from "@/components/viewport/GeometryViewport";
import Viewport2D from "@/components/viewport/Viewport2D";
import Viewport3D from "@/components/viewport/Viewport3D";
import { exportSceneJson, triggerSceneExportDownload } from "@/lib/export/sceneExport";
import { reportError } from "@/lib/monitoring/errorReporting";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import type { SceneDocument } from "@/lib/scene/sceneSchema";
import {
  LocalProjectRepositoryError,
  localProjectRepository
} from "@/lib/projects/localProjectRepository";
import { ProjectAutosaveController } from "@/lib/projects/projectAutosave";
import { applySharedSceneToEditor } from "@/lib/share/applySharedScene";
import { readSharedSceneFromSearch } from "@/lib/share/shareSceneLink";
import {
  readWelcomeOnboardingDismissed,
  setWelcomeOnboardingDismissed,
  shouldShowWelcomeOnStartup,
  WelcomeOnboardingStateError
} from "@/lib/onboarding/welcomeOnboardingState";
import { getCurrentSceneSnapshot } from "@/lib/store/sceneStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import type { SceneSnapshot } from "@/lib/types/scene";
import { useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { applyConstraintDerivedUpdates } from "@/lib/editor/applyConstraintDerivedUpdates";
import { captureEvent } from "@/lib/analytics/posthog";
import { consumeHistoryActionFlag, isDragTransactionActive } from "@/lib/interaction/dragHistoryTransaction";
import { requestCanvasFrame } from "@/lib/interaction/canvasFrameRequests";
import { compositionForViewport, type ResponsiveComposition } from "@/lib/responsive/composition";
export default function EditorShell() {
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const setGraphMode = useGraphStore((state) => state.setGraphMode);
  const axis2dPair = useGraphStore((state) => state.ui.axis2dPair);
  const axis2dPairQuadTop = useGraphStore((state) => state.ui.axis2dPairQuadTop);
  const active2dViewport = useGraphStore((state) => state.ui.active2dViewport);
  const setAxis2DPair = useGraphStore((state) => state.setAxis2DPair);
  const setActive2dViewport = useGraphStore((state) => state.setActive2dViewport);
  const canvas2dTool = useGraphStore((state) => state.ui.canvas2dTool);
  const canvas3dTool = useGraphStore((state) => state.ui.canvas3dTool);
  const baseline3dPlane = useGraphStore((state) => state.ui.baseline3dPlane);
  const setCanvas2dTool = useGraphStore((state) => state.setCanvas2dTool);
  const setCanvas3dTool = useGraphStore((state) => state.setCanvas3dTool);
  const setBaseline3dPlane = useGraphStore((state) => state.setBaseline3dPlane);
  const snapEnabled = useGraphStore((state) => state.ui.snapEnabled);
  const snapStep = useGraphStore((state) => state.ui.snapStep);
  const setSnapEnabled = useGraphStore((state) => state.setSnapEnabled);
  const updateObjectColor = useGraphStore((state) => state.updateObjectColor);
  const setObjectVisibility = useGraphStore((state) => state.setObjectVisibility);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const selectedMeasurementId = useGraphStore((state) => state.ui.selectedMeasurementId);
  const removeObject = useGraphStore((state) => state.removeObject);
  const applySceneSnapshot = useGraphStore((state) => state.applySceneSnapshot);
  const replaceSceneDocument = useGraphStore((state) => state.replaceSceneDocument);
  const resetScene = useGraphStore((state) => state.resetScene);
  const scene = useGraphStore((state) => state.scene);
  const currentProjectId = useGraphStore((state) => state.ui.projectSession.currentProjectId);
  const currentProjectName = useGraphStore((state) => state.ui.projectSession.currentProjectName);
  const setCurrentProjectSession = useGraphStore((state) => state.setCurrentProjectSession);
  const setProjectAutosaveStatus = useGraphStore((state) => state.setProjectAutosaveStatus);
  const resetViewport2D = useGraphStore((state) => state.resetViewport2D);
  const requestCameraReset = useGraphStore((state) => state.requestCameraReset);
  const setWorkspace = useGraphStore((state) => state.setWorkspace);

  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectorPinned, setInspectorPinned] = useState(false);
  const [userClosedInspector, setUserClosedInspector] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ open: boolean; x: number; y: number }>({
    open: false,
    x: 0,
    y: 0
  });
  const [recoveryDialogOpen, setRecoveryDialogOpen] = useState(false);
  const [recoveryUpdatedAt, setRecoveryUpdatedAt] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [sharedSceneDialogOpen, setSharedSceneDialogOpen] = useState(false);
  const [sharedSceneError, setSharedSceneError] = useState<string | null>(null);
  const [welcomeDialogOpen, setWelcomeDialogOpen] = useState(false);
  const [welcomeDialogError, setWelcomeDialogError] = useState<string | null>(null);
  const [touchHints, setTouchHints] = useState(false);
  const [examplesOpenSignal, setExamplesOpenSignal] = useState(0);
  const [viewportFallbackMessage, setViewportFallbackMessage] = useState<string | null>(null);
  const [isGraphStoreHydrated, setIsGraphStoreHydrated] = useState(false);

  const importInputRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const leftCollapsed = useEditorStore((state) => state.leftPanelCollapsed);
  const rightCollapsed = useEditorStore((state) => state.rightPanelCollapsed);
  const leftWidth = useEditorStore((state) => state.leftPanelWidth);
  const rightWidth = useEditorStore((state) => state.rightPanelWidth);
  const toggleLeftPanel = useEditorStore((state) => state.toggleLeftPanel);
  const toggleRightPanel = useEditorStore((state) => state.toggleRightPanel);
  const setLeftPanelWidth = useEditorStore((state) => state.setLeftPanelWidth);
  const setRightPanelWidth = useEditorStore((state) => state.setRightPanelWidth);
  const setLeftPanelCollapsed = useEditorStore((state) => state.setLeftPanelCollapsed);
  const setRightPanelCollapsed = useEditorStore((state) => state.setRightPanelCollapsed);
  const setBottomPanelCollapsed = useEditorStore((state) => state.setBottomPanelCollapsed);
  const setBottomPanelHeight = useEditorStore((state) => state.setBottomPanelHeight);
  const bottomPanelHeight = useEditorStore((state) => state.bottomPanelHeight);
  const bottomPanelCollapsed = useEditorStore((state) => state.bottomPanelCollapsed);
  const leftCollapseSnapOffset = useEditorStore((state) => state.leftCollapseSnapOffset);
  const rightCollapseSnapOffset = useEditorStore((state) => state.rightCollapseSnapOffset);
  const bottomCollapseSnapOffset = useEditorStore((state) => state.bottomCollapseSnapOffset);
  const beginResize = useEditorStore((state) => state.beginResize);
  const endResize = useEditorStore((state) => state.endResize);
  const setResponsiveFlags = useEditorStore((state) => state.setResponsiveFlags);
  const composition = useEditorStore((state) => state.responsiveComposition);
  const geometryView = useEditorStore((state) => state.geometryView);
  const viewportMode = useEditorStore((state) => state.viewportMode);
  const setViewportMode = useEditorStore((state) => state.setViewportMode);
  const setGeometryLayout = useEditorStore((state) => state.setGeometryLayout);
  const setGeometryView = useEditorStore((state) => state.setGeometryView);
  const addConsoleEvent = useEditorStore((state) => state.addConsoleEvent);
  const constraints = useEditorStore((state) => state.constraints);
  const pushSnapshot = useHistoryStore((state) => state.pushSnapshot);
  const undoHistory = useHistoryStore((state) => state.undo);
  const redoHistory = useHistoryStore((state) => state.redo);
  const clearHistory = useHistoryStore((state) => state.clear);
  const canUndo = useHistoryStore((state) => state.past.length > 0);
  const canRedo = useHistoryStore((state) => state.future.length > 0);
  
  const historyActionRef = useRef(false);
  const skipDerivedHistoryRef = useRef(0);
  const lastSceneSnapshotRef = useRef<SceneSnapshot | null>(null);
  const hasCheckedRecoveryRef = useRef(false);
  const hasCheckedSharedSceneRef = useRef(false);
  const hasCheckedExamplesQueryRef = useRef(false);
  const hasCheckedWelcomeRef = useRef(false);
  const pendingSharedSceneRef = useRef<SceneDocument | null>(null);
  const autosaveControllerRef = useRef<ProjectAutosaveController | null>(null);
  const effectiveViewportMode = viewportMode === "split" || viewportMode === "quad" ? viewportMode : graphMode;
  const planeSwitcherActivePair =
    effectiveViewportMode === "quad" && active2dViewport === "quadTop" ? axis2dPairQuadTop : axis2dPair;
  const selectedLabel = selectedObjectId ? selectedObjectId.slice(0, 8) : "None";
  const snapLabel = snapEnabled ? `ON (${snapStep})` : "OFF";
  const [inspectorDrawerMode, setInspectorDrawerMode] = useState(false);

  const activeTool = graphMode === "2d" ? canvas2dTool : canvas3dTool;
  const setActiveTool = (tool: any) => {
    setCanvas2dTool(tool);
    setCanvas3dTool(tool);
  };
  const activeToolLabel = activeTool === "measureDistance"
    ? "measureDistance"
    : activeTool === "measureAngle"
      ? "measureAngle"
      : activeTool === "addPin"
        ? "addPin"
        : activeTool === "draw"
          ? "draw"
          : activeTool === "probe"
            ? "probe"
            : "pan";
  const activeViewType: "2d" | "3d" | "both" =
    effectiveViewportMode === "split" || effectiveViewportMode === "quad" ? "both" : graphMode === "3d" ? "3d" : "2d";
  const activeLayout: "split" | "quad" = effectiveViewportMode === "quad" ? "quad" : "split";
  const contextInspectorOpen =
    inspectorPinned ||
    inspectorOpen ||
    (!userClosedInspector &&
      (Boolean(selectedObjectId) ||
        Boolean(selectedMeasurementId) ||
        activeTool === "measureDistance" ||
        activeTool === "measureAngle" ||
        activeTool === "addPin"));

  const clearViewportSelection = useCallback(() => {
    useGraphStore.setState((state) => ({
      ui: {
        ...state.ui,
        selectedObjectId: null,
        selectedMeasurementId: null
      }
    }));
  }, []);

  const handleWorkspacePointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!(activeTool === "pan" || activeTool === "probe")) {
        return;
      }
      // S21: an armed analysis pick owns the click (selection stays so the
      // Inspector keeps showing values after the point lands).
      if (useGraphStore.getState().ui.differentialAnalysisPickArmedId !== null) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      // S31: DOM-level deselect covers the 2D canvas only. The 3D engine
      // deselects on genuine clean misses (never on orbit/pan drags) via
      // attemptPrimitivePick; clearing here on pointerdown would wrongly
      // deselect when a drag starts.
      const isCanvasTarget = Boolean(target.closest('canvas[data-graph2d-canvas="true"]'));
      if (!isCanvasTarget) {
        return;
      }
      if (selectedObjectId === null && selectedMeasurementId === null) {
        return;
      }
      clearViewportSelection();
    },
    [activeTool, clearViewportSelection, selectedMeasurementId, selectedObjectId]
  );

  if (!autosaveControllerRef.current) {
    autosaveControllerRef.current = new ProjectAutosaveController(
      localProjectRepository,
      {
        onDirty: () => setProjectAutosaveStatus("dirty"),
        onSaving: () => setProjectAutosaveStatus("saving"),
        onSaved: () => setProjectAutosaveStatus("saved"),
        onError: (message) => setProjectAutosaveStatus("error", message)
      },
      900
    );
  }

  useEffect(() => {
    const persistApi = useGraphStore.persist;
    if (!persistApi) {
      setIsGraphStoreHydrated(true);
      return;
    }

    setIsGraphStoreHydrated(persistApi.hasHydrated());
    const unsubscribe = persistApi.onFinishHydration(() => {
      setIsGraphStoreHydrated(true);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const runUndo = useCallback(() => {
    // S33 PART 78: global undo is not processed until a drag transaction
    // ends (the snapshot must not mutate under an active drag).
    if (isDragTransactionActive()) {
      return;
    }
    const current = getCurrentSceneSnapshot();
    const previous = undoHistory(current);
    if (!previous) return;
    historyActionRef.current = true;
    applySceneSnapshot(previous);
    addConsoleEvent("Undo");
  }, [addConsoleEvent, applySceneSnapshot, undoHistory]);

  const runRedo = useCallback(() => {
    // S33 PART 78: symmetric with undo during an active drag.
    if (isDragTransactionActive()) {
      return;
    }
    const current = getCurrentSceneSnapshot();
    const next = redoHistory(current);
    if (!next) return;
    historyActionRef.current = true;
    applySceneSnapshot(next);
    addConsoleEvent("Redo");
  }, [addConsoleEvent, applySceneSnapshot, redoHistory]);

  useEffect(() => {
    const currentSnapshot = getCurrentSceneSnapshot();
    const previousSnapshot = lastSceneSnapshotRef.current;

    if (!previousSnapshot) {
      lastSceneSnapshotRef.current = currentSnapshot;
      return;
    }

    // S33-R8: consume the cancel-restore flag unconditionally first — a
    // short-circuit would leave it armed to skip the next legitimate edit.
    const historyActionConsumed = consumeHistoryActionFlag();
    if (historyActionRef.current || historyActionConsumed) {
      historyActionRef.current = false;
      lastSceneSnapshotRef.current = currentSnapshot;
      return;
    }

    // S33 PART 24: pointermove commits during a drag transaction never push
    // history (commit pushes the single pre-drag snapshot on release).
    if (isDragTransactionActive()) {
      lastSceneSnapshotRef.current = currentSnapshot;
      return;
    }

    const objectsChanged = previousSnapshot.objects !== currentSnapshot.objects;
    const selectionChanged =
      previousSnapshot.selection.selectedObjectId !== currentSnapshot.selection.selectedObjectId;

    if (objectsChanged && skipDerivedHistoryRef.current > 0) {
      skipDerivedHistoryRef.current -= 1;
      lastSceneSnapshotRef.current = currentSnapshot;
      return;
    }

    if (objectsChanged || selectionChanged) {
      pushSnapshot(previousSnapshot);
    }

    lastSceneSnapshotRef.current = currentSnapshot;
  }, [pushSnapshot, scene.objects, selectedObjectId]);

  useEffect(() => {
    if (constraints.length === 0 || scene.objects.length === 0) {
      return;
    }

    const { updateCount: derivedUpdateCount, errors } = applyConstraintDerivedUpdates(
      constraints,
      setObjectVisibility,
      updateObjectColor
    );
    for (const error of errors) {
      addConsoleEvent(`Constraint skipped: ${error}`);
    }
    if (derivedUpdateCount > 0) {
      skipDerivedHistoryRef.current += derivedUpdateCount;
    }
  }, [addConsoleEvent, constraints, scene.objects, setObjectVisibility, updateObjectColor]);

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const tag = target.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && (key === "k" || (event.shiftKey && key === "p"))) {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if (event.key === "Escape") {
        // S33 PART 47: an active drag cancels first — the engine restores
        // pre-drag values. Shell skips its own Escape handling so one
        // keypress never double-processes (no menu/pick side effects).
        if (isDragTransactionActive()) {
          return;
        }        // Functional updates return identical state when nothing is open so
        // idle keypresses never force a shell re-render (which would churn
        // downstream effect subscriptions such as drawer Escape handlers).
        setCommandPaletteOpen((wasOpen) => (wasOpen ? false : wasOpen));
        setContextMenu((state) => (state.open ? { ...state, open: false } : state));
        // S21: Escape cancels an armed analysis pick (guard typing targets:
        // an Escape inside an equation input reverts the draft instead).
        if (!isTypingTarget(event.target)) {
          const armedId = useGraphStore.getState().ui.differentialAnalysisPickArmedId;
          if (armedId !== null) {
            useGraphStore.getState().armDifferentialAnalysisPick(null);
          }
        }
        return;
      }
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isTypingTarget(event.target)) {
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        // S33 PART 77/78: no destructive or history edits mid-drag.
        if (isDragTransactionActive()) {
          return;
        }
        const selectedId = useGraphStore.getState().ui.selectedObjectId;
        if (selectedId) {
          event.preventDefault();
          removeObject(selectedId);
        }
        return;
      }
      // S33 PART 11/71: F frames the selection (Fit Scene when nothing is
      // selected). Window-level with typing/modifier guards — equivalent to
      // canvas focus without adding tab stops; equation inputs keep F.
      if (event.key === "f" || event.key === "F") {
        if (!isDragTransactionActive()) {
          requestCanvasFrame(
            useGraphStore.getState().ui.selectedObjectId ? "selected" : "scene"
          );
        }
        return;
      }
      if (event.key === "/") {
        const search = document.getElementById("object-search-input");
        if (search instanceof HTMLInputElement) {
          event.preventDefault();
          search.focus();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [removeObject]);

  const [narrowRailMode, setNarrowRailMode] = useState(false);
  // Narrow-mode drawers open only on explicit user action so a fresh narrow
  // load never starts with canvas-blocking overlays.
  const [narrowObjectsOpen, setNarrowObjectsOpen] = useState(false);  const workspace = useGraphStore((state) => state.ui.workspace);
  // Lazily mount each workspace tree on first visit, then keep it mounted
  // (suspended while hidden) so cameras, sync state, and engines survive
  // workspace switches without rebuilds.
  const [visitedWorkspaces, setVisitedWorkspaces] = useState({ geometry: false, math: true });
  useEffect(() => {
    setVisitedWorkspaces((previous) =>
      previous[workspace] ? previous : { ...previous, [workspace]: true }
    );
  }, [workspace]);

  // S34-R13: skip store writes when nothing changed — an unguarded
  // observer re-renders every composition subscriber on each resize frame.
  // Ref lives at component scope (StrictMode-safe double effects share it).
  const responsivePrevious = useRef({ initialized: false, narrow: false, drawer: false, composition: "wide" as ResponsiveComposition });

  useEffect(() => {
    const node = shellRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      const width = rect?.width ?? window.innerWidth;
      const height = rect?.height ?? window.innerHeight;
      const inspectorDrawer = width <= 1100;
      // S34 PART 1/2: one composition source (compact <720 wide, compact
      // short landscapes, medium <1100, wide ≥1100). Wide ≥1100 preserves
      // S30–S33 architecture exactly.
      const composition = compositionForViewport(width, height);
      const narrow = composition === "compact";
      if (
        responsivePrevious.current.initialized &&
        responsivePrevious.current.narrow === narrow &&
        responsivePrevious.current.drawer === inspectorDrawer &&
        responsivePrevious.current.composition === composition
      ) {
        return;
      }
      responsivePrevious.current.initialized = true;
      responsivePrevious.current.narrow = narrow;
      responsivePrevious.current.drawer = inspectorDrawer;
      responsivePrevious.current.composition = composition;
      setInspectorDrawerMode(inspectorDrawer);
      setNarrowRailMode(narrow);
      setResponsiveFlags({ inspectorDrawer, leftRail: false, bottomCollapsed: false, composition });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [setResponsiveFlags]);

  // S34-R12: one-primary-sheet invariant across composition roundtrips.
  // Toggles enforce it within compact, but a compact→widen→narrow cycle can
  // otherwise reopen both sheets at once (two stacked fixed dialogs).
  useEffect(() => {
    if (!narrowRailMode) {
      setNarrowObjectsOpen(false);
      setInspectorOpen(false);
    }
  }, [narrowRailMode]);

  useEffect(() => {
    if (effectiveViewportMode !== "quad") {
      setActive2dViewport("primary");
    }
  }, [effectiveViewportMode, setActive2dViewport]);

  useEffect(() => {
    if (hasCheckedRecoveryRef.current) {
      return;
    }
    if (!isGraphStoreHydrated) {
      return;
    }

    if (scene.objects.length > 0) {
      hasCheckedRecoveryRef.current = true;
      return;
    }

    try {
      const snapshot = localProjectRepository.getUnnamedRecoverySnapshot();
      if (!snapshot) {
        hasCheckedRecoveryRef.current = true;
        return;
      }

      const snapshotTime = Date.parse(snapshot.updatedAt);
      const sceneTime = Date.parse(scene.metadata.updatedAt);
      if (Number.isFinite(snapshotTime) && Number.isFinite(sceneTime) && snapshotTime <= sceneTime) {
        hasCheckedRecoveryRef.current = true;
        return;
      }

      setRecoveryUpdatedAt(snapshot.updatedAt);
      setRecoveryError(null);
      setRecoveryDialogOpen(true);
      hasCheckedRecoveryRef.current = true;
      captureEvent("recovery_prompt_shown");
    } catch (error) {
      const message =
        error instanceof LocalProjectRepositoryError
          ? error.message
          : "Recovery snapshot could not be read safely.";
      setRecoveryError(message);
      setRecoveryDialogOpen(true);
      hasCheckedRecoveryRef.current = true;
      captureEvent("recovery_prompt_shown", { error_type: "read-failed" });
    }
  }, [isGraphStoreHydrated, scene.metadata.updatedAt, scene.objects.length]);

  useEffect(() => {
    if (hasCheckedSharedSceneRef.current || !isGraphStoreHydrated) {
      return;
    }

    const sharedSceneResult = readSharedSceneFromSearch(window.location.search);
    hasCheckedSharedSceneRef.current = true;
    if (!sharedSceneResult) {
      return;
    }

    if (!sharedSceneResult.ok || !sharedSceneResult.scene) {
      setSharedSceneError(sharedSceneResult.error ?? "Shared scene link could not be opened.");
      setSharedSceneDialogOpen(true);
      captureEvent("editor_shared_scene_failed", { error_type: "invalid-payload" });
      return;
    }

    const hasWorkToProtect =
      scene.objects.length > 0 ||
      currentProjectId !== null ||
      recoveryDialogOpen ||
      scene.metadata.updatedAt !== scene.metadata.createdAt;

    if (hasWorkToProtect) {
      pendingSharedSceneRef.current = sharedSceneResult.scene;
      setSharedSceneError(null);
      setSharedSceneDialogOpen(true);
      captureEvent("editor_shared_scene_detected", { action: "confirmation-required" });
      return;
    }

    applySharedSceneToEditor({
      scene: sharedSceneResult.scene,
      clearHistory,
      replaceSceneDocument,
      setCurrentProjectSession,
      setProjectAutosaveStatus
    });
    captureEvent("editor_shared_scene_detected", { action: "auto-applied" });
  }, [
    clearHistory,
    currentProjectId,
    isGraphStoreHydrated,
    recoveryDialogOpen,
    replaceSceneDocument,
    scene.metadata.createdAt,
    scene.metadata.updatedAt,
    scene.objects.length,
    setCurrentProjectSession,
    setProjectAutosaveStatus
  ]);

  useEffect(() => {
    if (!isGraphStoreHydrated || hasCheckedExamplesQueryRef.current) {
      return;
    }
    hasCheckedExamplesQueryRef.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("examples") !== "1") {
      return;
    }
    setExamplesOpenSignal((current) => current + 1);
    captureEvent("editor_examples_entry_opened");
  }, [isGraphStoreHydrated]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia("(pointer: coarse)");
    const sync = () => setTouchHints(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isGraphStoreHydrated || hasCheckedWelcomeRef.current) {
      return;
    }
    if (!hasCheckedRecoveryRef.current || !hasCheckedSharedSceneRef.current) {
      return;
    }

    let dismissed = false;
    try {
      dismissed = readWelcomeOnboardingDismissed();
    } catch (error) {
      const message =
        error instanceof WelcomeOnboardingStateError
          ? error.message
          : "Welcome preference could not be read safely.";
      setWelcomeDialogError(message);
      dismissed = false;
    }

    let hasRecoverySnapshot = false;
    try {
      hasRecoverySnapshot = localProjectRepository.getUnnamedRecoverySnapshot() !== null;
    } catch {
      hasRecoverySnapshot = true;
    }

    const shouldOpen = shouldShowWelcomeOnStartup({
      dismissed,
      hasCheckedRecovery: hasCheckedRecoveryRef.current,
      hasCheckedSharedScene: hasCheckedSharedSceneRef.current,
      recoveryDialogOpen,
      sharedSceneDialogOpen,
      hasObjects: scene.objects.length > 0,
      hasNamedProject: currentProjectId !== null,
      hasRecoverySnapshot
    });

    if (shouldOpen) {
      setWelcomeDialogOpen(true);
      captureEvent("editor_opened", { entry_point: "welcome-dialog" });
    } else {
      captureEvent("editor_opened", { entry_point: "direct" });
    }
    hasCheckedWelcomeRef.current = true;
  }, [
    currentProjectId,
    isGraphStoreHydrated,
    recoveryDialogOpen,
    scene.objects.length,
    sharedSceneDialogOpen
  ]);

  useEffect(() => {
    const autosave = autosaveControllerRef.current;
    if (!autosave) {
      return;
    }
    if (!isGraphStoreHydrated) {
      autosave.clearPending();
      return;
    }

    if (recoveryDialogOpen) {
      autosave.clearPending();
      return;
    }

    if (currentProjectId && currentProjectName) {
      autosave.scheduleProjectAutosave({
        projectId: currentProjectId,
        projectName: currentProjectName,
        scene
      });
      return () => autosave.clearPending();
    }

    if (scene.objects.length === 0) {
      autosave.clearPending();
      localProjectRepository.clearUnnamedRecoverySnapshot();
      setProjectAutosaveStatus("idle");
      return;
    }

    autosave.scheduleUnnamedRecovery(scene);
    setProjectAutosaveStatus("idle");
    return () => autosave.clearPending();
  }, [
    currentProjectId,
    currentProjectName,
    isGraphStoreHydrated,
    recoveryDialogOpen,
    scene,
    scene.objects.length,
    setProjectAutosaveStatus
  ]);

  const handleRestoreRecovery = useCallback(() => {
    try {
      const restoredScene = localProjectRepository.restoreUnnamedRecoverySnapshot();
      localProjectRepository.clearUnnamedRecoverySnapshot();
      clearHistory();
      replaceSceneDocument(restoredScene);
      setCurrentProjectSession(null);
      setProjectAutosaveStatus("idle");
      setRecoveryError(null);
      setRecoveryDialogOpen(false);
      setRecoveryUpdatedAt(null);
      captureEvent("recovery_restored");
    } catch (error) {
      const message =
        error instanceof LocalProjectRepositoryError
          ? error.message
          : "Recovery restore failed.";
      setRecoveryError(message);
      captureEvent("recovery_restored", { success: false, error_type: "restore-failed" });
    }
  }, [clearHistory, replaceSceneDocument, setCurrentProjectSession, setProjectAutosaveStatus]);

  const handleDiscardRecovery = useCallback(() => {
    try {
      localProjectRepository.clearUnnamedRecoverySnapshot();
      setRecoveryError(null);
      setRecoveryDialogOpen(false);
      setRecoveryUpdatedAt(null);
      captureEvent("recovery_discarded");
    } catch (error) {
      const message =
        error instanceof LocalProjectRepositoryError
          ? error.message
          : "Recovery discard failed.";
      setRecoveryError(message);
    }
  }, []);

  const handleOpenSharedScene = useCallback(() => {
    const pendingScene = pendingSharedSceneRef.current;
    if (!pendingScene) {
      setSharedSceneDialogOpen(false);
      return;
    }
    try {
      applySharedSceneToEditor({
        scene: pendingScene,
        clearHistory,
        replaceSceneDocument,
        setCurrentProjectSession,
        setProjectAutosaveStatus
      });
      setSharedSceneError(null);
      setSharedSceneDialogOpen(false);
      pendingSharedSceneRef.current = null;
    } catch {
      setSharedSceneError("Shared scene could not replace the current scene. Try JSON import instead.");
    }
  }, [clearHistory, replaceSceneDocument, setCurrentProjectSession, setProjectAutosaveStatus]);

  const handleCancelSharedScene = useCallback(() => {
    pendingSharedSceneRef.current = null;
    setSharedSceneDialogOpen(false);
  }, []);

  const persistWelcomePreference = useCallback(
    (dismissed: boolean) => {
      try {
        setWelcomeOnboardingDismissed(dismissed);
      } catch (error) {
        const message =
          error instanceof WelcomeOnboardingStateError
            ? error.message
            : "Welcome preference could not be saved safely.";
        setWelcomeDialogError(message);
      }
    },
    []
  );

  const handleCloseWelcome = useCallback(() => {
    // S35: dismiss always persists — no checkbox dark pattern.
    persistWelcomePreference(true);
    setWelcomeDialogOpen(false);
  }, [persistWelcomePreference]);

  const handleWelcomeOpenExamples = useCallback(() => {
    persistWelcomePreference(true);
    setWelcomeDialogOpen(false);
    setExamplesOpenSignal((current) => current + 1);
  }, [persistWelcomePreference]);

  const handleViewportResetView = useCallback(() => {
    try {
      resetViewport2D();
      requestCameraReset();
      setViewportFallbackMessage(null);
    } catch (error) {
      reportError(error, {
        featureArea: "editor-shell",
        operation: "viewport-reset"
      });
      setViewportFallbackMessage("Reset view failed. Try again.");
    }
  }, [requestCameraReset, resetViewport2D]);

  const handleViewportExportSceneJson = useCallback(() => {
    const exported = exportSceneJson(scene);
    if (!exported.ok || !exported.file) {
      reportError(exported.error ?? "JSON export failed.", {
        featureArea: "export",
        operation: "viewport-fallback-export"
      });
      setViewportFallbackMessage(exported.error ?? "Export scene JSON failed.");
      return;
    }
    const download = triggerSceneExportDownload(exported.file);
    if (!download.ok) {
      reportError(download.error ?? "JSON download failed.", {
        featureArea: "export",
        operation: "viewport-fallback-download"
      });
      setViewportFallbackMessage(download.error ?? "Export scene JSON failed.");
      return;
    }
    setViewportFallbackMessage("Scene JSON exported.");
  }, [scene]);

  const runCommand = useCallback((commandId: string) => {
    if (commandId === "undo") { runUndo(); return; }
    if (commandId === "redo") { runRedo(); return; }
    if (commandId === "toggle-2d") { setGraphMode("2d"); setViewportMode("2d"); return; }
    if (commandId === "toggle-3d") { setGraphMode("3d"); setViewportMode("3d"); return; }
    if (commandId === "switch-split") { setViewportMode("split"); return; }
    if (commandId === "switch-quad") { setViewportMode("quad"); return; }
    if (commandId === "geometry-view-perspective") { setGeometryView("perspective"); return; }
    if (commandId === "geometry-view-xy") { setGeometryView("xy"); return; }
    if (commandId === "geometry-view-xz") { setGeometryView("xz"); return; }
    if (commandId === "geometry-view-yz") { setGeometryView("yz"); return; }
    if (commandId === "geometry-layout-single") { setGeometryLayout("single"); return; }
    if (commandId === "geometry-layout-split") { setGeometryLayout("split"); return; }
    if (commandId === "geometry-layout-quad") { setGeometryLayout("quad"); return; }
    if (commandId === "switch-workspace-geometry") { setWorkspace("geometry"); return; }
    if (commandId === "switch-workspace-math") { setWorkspace("math"); return; }
    // S33 PART 10/42: camera-only framing (never math/scene/analysis).
    // Distinct from Reset View (restores default cameras).
    if (commandId === "frame-selected") {
      if (!isDragTransactionActive()) {
        requestCanvasFrame("selected");
      }
      return;
    }
    if (commandId === "fit-scene") {
      if (!isDragTransactionActive()) {
        requestCanvasFrame("scene");
      }
      return;
    }
    {
      // S30: creation funnels through the central descriptors path so
      // palette/context creation cannot drift from Quick Add / Add Object.
      const entry = descriptorByCommandId(commandId);
      if (entry) {
        createObjectByKey(entry.key);
        return;
      }
    }
    {
      // S30: creation funnels through the central descriptors path so
      // palette/context creation cannot drift from Quick Add / Add Object.
      const entry = descriptorByCommandId(commandId);
      if (entry) {
        createObjectByKey(entry.key);
        return;
      }
    }
    {
      // S30: creation funnels through the central descriptors path so
      // palette/context creation cannot drift from Quick Add / Add Object.
      const entry = descriptorByCommandId(commandId);
      if (entry) {
        createObjectByKey(entry.key);
        return;
      }
    }
    {
      // S30: creation funnels through the central descriptors path so
      // palette/context creation cannot drift from Quick Add / Add Object.
      const entry = descriptorByCommandId(commandId);
      if (entry) {
        createObjectByKey(entry.key);
        return;
      }
    }
    {
      // S30: creation funnels through the central descriptors path so
      // palette/context creation cannot drift from Quick Add / Add Object.
      const entry = descriptorByCommandId(commandId);
      if (entry) {
        createObjectByKey(entry.key);
        return;
      }
    }
    {
      // S30: creation funnels through the central descriptors path so
      // palette/context creation cannot drift from Quick Add / Add Object.
      const entry = descriptorByCommandId(commandId);
      if (entry) {
        createObjectByKey(entry.key);
        return;
      }
    }
    {
      // S30: creation funnels through the central descriptors path so
      // palette/context creation cannot drift from Quick Add / Add Object.
      const entry = descriptorByCommandId(commandId);
      if (entry) {
        createObjectByKey(entry.key);
        return;
      }
    }
    {
      // S30: creation funnels through the central descriptors path so
      // palette/context creation cannot drift from Quick Add / Add Object.
      const entry = descriptorByCommandId(commandId);
      if (entry) {
        createObjectByKey(entry.key);
        return;
      }
    }
    {
      // S30: creation funnels through the central descriptors path so
      // palette/context creation cannot drift from Quick Add / Add Object.
      const entry = descriptorByCommandId(commandId);
      if (entry) {
        createObjectByKey(entry.key);
        return;
      }
    }
    {
      // S30: creation funnels through the central descriptors path so
      // palette/context creation cannot drift from Quick Add / Add Object.
      const entry = descriptorByCommandId(commandId);
      if (entry) {
        createObjectByKey(entry.key);
        return;
      }
    }
    {
      // S30: creation funnels through the central descriptors path so
      // palette/context creation cannot drift from Quick Add / Add Object.
      const entry = descriptorByCommandId(commandId);
      if (entry) {
        createObjectByKey(entry.key);
        return;
      }
    }
    {
      // S30: creation funnels through the central descriptors path so
      // palette/context creation cannot drift from Quick Add / Add Object.
      const entry = descriptorByCommandId(commandId);
      if (entry) {
        createObjectByKey(entry.key);
        return;
      }
    }
    {
      // S30: creation funnels through the central descriptors path so
      // palette/context creation cannot drift from Quick Add / Add Object.
      const entry = descriptorByCommandId(commandId);
      if (entry) {
        createObjectByKey(entry.key);
        return;
      }
    }
    {
      // S30: creation funnels through the central descriptors path so
      // palette/context creation cannot drift from Quick Add / Add Object.
      const entry = descriptorByCommandId(commandId);
      if (entry) {
        createObjectByKey(entry.key);
        return;
      }
    }
    if (commandId === "delete-selected") {
      // S33 PART 77: deleting mid-drag is cancelled safely by the engine;
      // the command path refuses to start one (no crash, no orphan handle).
      if (isDragTransactionActive()) {
        return;
      }
      const selectedId = useGraphStore.getState().ui.selectedObjectId;
      if (selectedId) {
        removeObject(selectedId);
      }
      return;
    }
    if (commandId === "toggle-snap") { setSnapEnabled(!snapEnabled); return; }
    if (commandId === "reset-view") { handleViewportResetView(); return; }
    if (commandId === "export-scene-json") { handleViewportExportSceneJson(); return; }
    if (commandId === "import-scene-json") { importInputRef.current?.click(); return; }
  }, [runUndo, runRedo, setGraphMode, setViewportMode, setGeometryLayout, setGeometryView, setWorkspace, removeObject, snapEnabled, setSnapEnabled, handleViewportResetView, handleViewportExportSceneJson]);

  const startHorizontalResize = useCallback((event: ReactPointerEvent<HTMLDivElement>, side: "left" | "right") => {    const shell = shellRef.current;
    if (!shell) return;
    const divider = event.currentTarget;
    divider.setPointerCapture(event.pointerId);
    beginResize(side, event.pointerId);
    const bounds = shell.getBoundingClientRect();
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
    const onMove = (moveEvent: PointerEvent) => {
      const x = moveEvent.clientX - bounds.left;
      const maxLeftWidth = Math.min(420, Math.floor(bounds.width * 0.45));
      const maxRightWidth = Math.min(540, Math.floor(bounds.width * 0.45));
      if (side === "left") {
        if (x <= leftCollapseSnapOffset) { setLeftPanelCollapsed(true); return; }
        setLeftPanelCollapsed(false);
        setLeftPanelWidth(clamp(x, 180, Math.max(180, maxLeftWidth)));
      } else {
        const nextWidth = bounds.right - moveEvent.clientX;
        if (nextWidth <= rightCollapseSnapOffset) { setRightPanelCollapsed(true); return; }
        setRightPanelCollapsed(false);
        setRightPanelWidth(clamp(nextWidth, 220, Math.max(220, maxRightWidth)));
      }
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      if (divider.hasPointerCapture(event.pointerId)) {
        divider.releasePointerCapture(event.pointerId);
      }
      endResize();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [beginResize, endResize, leftCollapseSnapOffset, rightCollapseSnapOffset, setLeftPanelCollapsed, setLeftPanelWidth, setRightPanelCollapsed, setRightPanelWidth]);

  const startBottomResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const shell = shellRef.current;
    if (!shell) return;
    beginResize("bottom", event.pointerId);
    const bounds = shell.getBoundingClientRect();
    const onMove = (moveEvent: PointerEvent) => {
      const nextHeight = bounds.bottom - moveEvent.clientY - 24;
      if (nextHeight <= bottomCollapseSnapOffset) { setBottomPanelCollapsed(true); return; }
      setBottomPanelCollapsed(false);
      setBottomPanelHeight(nextHeight);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      endResize();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [beginResize, bottomCollapseSnapOffset, endResize, setBottomPanelCollapsed, setBottomPanelHeight]);

  return (
    <div
      ref={shellRef}
      data-composition={composition}
      className="app-shell flex h-screen flex-col bg-[var(--bg-primary)] font-sans"
      onContextMenu={(e) => { e.preventDefault(); setContextMenu({ open: true, x: e.clientX, y: e.clientY }); }}
    >
      <ThemeSync />
      <EditorLayoutPremium
        header={
          <EditorHeader
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={runUndo}
            onRedo={runRedo}
            onOpenWelcome={() => {
              setWelcomeDialogError(null);
              try {
                setWelcomeOnboardingDismissed(false);
              } catch {
                // Preference reset is best-effort; still show tips this session.
              }
              setWelcomeDialogOpen(true);
            }}
            openExamplesSignal={examplesOpenSignal}
            activeViewType={activeViewType}
            onViewTypeChange={(view) => {
              if (view === "2d") {
                setGraphMode("2d");
                setViewportMode("2d");
                return;
              }
              if (view === "3d") {
                setGraphMode("3d");
                setViewportMode("3d");
                return;
              }
              const nextLayout =
                viewportMode === "split" || viewportMode === "quad" ? viewportMode : "split";
              setViewportMode(nextLayout);
            }}
            activeLayout={activeLayout}
            onLayoutChange={(layout) => {
              setViewportMode(layout);
            }}
            plane2d={axis2dPair}
            onPlane2dChange={setAxis2DPair}
            base3d={baseline3dPlane}
            onBase3dChange={setBaseline3dPlane}
            activeToolLabel={activeToolLabel}
            onToolChange={(tool) => {
              const actualTool = tool === "select" ? "probe" : tool;
              setActiveTool(actualTool);
              captureEvent("tool_selected", { tool: actualTool });
            }}
            inspectorOpen={contextInspectorOpen}
            onToggleInspector={() => {
              // S34 PART 6: one primary sheet on compact — opening Inspector
              // closes Objects and vice versa (no stacked full-screen sheets).
              if (narrowRailMode) {
                setNarrowObjectsOpen(false);
              }
              setInspectorOpen((open) => {
                const next = !open;
                if (next) {
                  setUserClosedInspector(false);
                }
                return next;
              });
            }}
            objectsOpen={narrowRailMode ? narrowObjectsOpen : !leftCollapsed}
            onToggleObjects={() => {
              if (narrowRailMode) {
                setInspectorOpen(false);
                setNarrowObjectsOpen((open) => !open);
                return;
              }
              toggleLeftPanel();
            }}
            showObjectsToggle={narrowRailMode}
          />
        }
        sceneNavigator={leftCollapsed || narrowRailMode ? null : <SceneNavigatorPremium width={leftWidth} />}
        sceneDivider={
          leftCollapsed || narrowRailMode ? null : <div className="divider-x" onPointerDown={(e) => startHorizontalResize(e, "left")} />
        }
        workspace={
          <>
            <GraphViewportErrorBoundary
              featureArea={graphMode === "2d" ? "2d-viewport" : "3d-viewport"}
              onResetView={handleViewportResetView}
              onExportSceneJson={handleViewportExportSceneJson}
            >
              <div className="relative h-full w-full" onPointerDownCapture={handleWorkspacePointerDownCapture}>
                {(workspace === "geometry" || visitedWorkspaces.geometry) && (
                  <div className={workspace === "geometry" ? "h-full w-full" : "hidden"}>
                    <GeometryViewport suspended={workspace !== "geometry"} />
                  </div>
                )}
                {(workspace === "math" || visitedWorkspaces.math) && (
                  <div className={workspace === "math" ? "h-full w-full" : "hidden"}>
                    <ViewportHost
                      mode={effectiveViewportMode}
                      viewport2d={<Viewport2D key="graph-2d" />}
                      viewport2dQuadTop={<Viewport2D key="graph-2d-quad-xz" variant="quadTop" />}
                      viewport3d={<Viewport3D key="graph-3d" suspended={workspace !== "math"} />}
                      selectedLabel={selectedLabel}
                      snapLabel={snapLabel}
                      workspaceId="math"
                    />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 z-20">
                  <FirstRunHint
                    open={welcomeDialogOpen}
                    workspace={workspace}
                    error={welcomeDialogError}
                    touchHints={touchHints}
                    canvasMode={
                      workspace === "math"
                        ? "math"
                        : geometryView === "perspective"
                          ? "perspective"
                          : "ortho"
                    }
                    onDismiss={handleCloseWelcome}
                    onOpenExamples={handleWelcomeOpenExamples}
                  />
                </div>
              </div>
            </GraphViewportErrorBoundary>
            {viewportFallbackMessage ? (
              <div className="pointer-events-none absolute left-3 top-3 z-[11] rounded border border-[var(--border-strong)] bg-[var(--surface-overlay)] px-2 py-1 text-[10px] text-[var(--text-secondary)]">
                {viewportFallbackMessage}
              </div>
            ) : null}
            {narrowRailMode && selectedObjectId ? (
              <SelectedObjectChip
                objectId={selectedObjectId}
                onInspect={() => {
                  // S34 PART 6/22: one primary surface — Inspect closes Objects.
                  setNarrowObjectsOpen(false);
                  setUserClosedInspector(false);
                  setInspectorOpen(true);
                }}
              />
            ) : null}
          </>
        }
        inspectorDrawer={
          <ContextInspectorDrawer
            open={!narrowRailMode && inspectorDrawerMode && !rightCollapsed && contextInspectorOpen}
            pinned={inspectorPinned}
            width={rightWidth}
            onTogglePinned={() => setInspectorPinned((v) => !v)}
            onClose={() => {
              setInspectorOpen(false);
              setUserClosedInspector(true);
            }}
            onOpenExamples={() => setExamplesOpenSignal((current) => current + 1)}
          />
        }
        inspectorDivider={
          !inspectorDrawerMode && !rightCollapsed && contextInspectorOpen ? (
            <div className="divider-x" onPointerDown={(e) => startHorizontalResize(e, "right")} />
          ) : null
        }
        inspectorPanel={
          !inspectorDrawerMode && !rightCollapsed && contextInspectorOpen ? (
            <div className="flex min-h-0 shrink-0 flex-col bg-[var(--editor-shell)]" style={{ width: rightWidth }}>
              <div className="flex h-9 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary)]">Inspector</span>
                <button
                  type="button"
                  aria-label="Close inspector"
                  onClick={() => {
                    setInspectorOpen(false);
                    setUserClosedInspector(true);
                  }}
                  className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--text-tertiary)] outline-none transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" />
                  </svg>
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <InspectorShell width={rightWidth} onOpenExamples={() => setExamplesOpenSignal((current) => current + 1)} />
              </div>
            </div>
          ) : null
        }
        bottomDivider={<div className="divider-y" onPointerDown={startBottomResize} />}
        bottomDock={<BottomDockPremium height={bottomPanelCollapsed ? 0 : bottomPanelHeight} />}
        statusBar={<StatusBar />}
      />
      <SceneImportExportDialog />
      <RecoveryDialog
        open={recoveryDialogOpen}
        updatedAt={recoveryUpdatedAt}
        error={recoveryError}
        onRestore={handleRestoreRecovery}
        onDiscard={handleDiscardRecovery}
      />
      <SharedSceneConfirmDialog
        open={sharedSceneDialogOpen}
        error={sharedSceneError}
        onConfirm={handleOpenSharedScene}
        onCancel={handleCancelSharedScene}
      />
      <Sheet open={narrowRailMode && inspectorOpen} onOpenChange={setInspectorOpen} title="Inspector">
        <InspectorPremium width={rightWidth} onOpenExamples={() => setExamplesOpenSignal((current) => current + 1)} />
      </Sheet>
      <Sheet open={narrowRailMode && narrowObjectsOpen} onOpenChange={setNarrowObjectsOpen} title="Objects">
        <SceneNavigatorPremium width={Math.min(leftWidth, 320)} />
      </Sheet>
      <ContextMenu open={contextMenu.open} x={contextMenu.x} y={contextMenu.y} onRunCommand={runCommand} hasSelection={Boolean(selectedObjectId)} canUndo={canUndo} canRedo={canRedo} snapEnabled={snapEnabled} currentMode={effectiveViewportMode} onClose={() => setContextMenu(state => ({ ...state, open: false }))} />
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} onRunCommand={runCommand} />
      
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const text = await file.text();
          const parsed = deserializeScene(text);
          if (parsed.valid && parsed.normalizedScene) {
            clearHistory();
            replaceSceneDocument(parsed.normalizedScene);
            addConsoleEvent("Imported scene JSON");
          }
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}
