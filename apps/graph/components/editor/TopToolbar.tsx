"use client";

import { useState, useRef, useEffect, lazy, Suspense, type ReactNode } from "react";
import { useHistoryStore } from "@/lib/store/historyStore";
import NewSceneDialog from "@/components/layout/NewSceneDialog";
import ProjectDialog from "@/components/projects/ProjectDialog";
import ExamplesDialog from "@/components/templates/ExamplesDialog";
import {
  LocalProjectRepositoryError,
  localProjectRepository
} from "@/lib/projects/localProjectRepository";
import {
  export2dPngFromCanvas,
  export2dSvg,
  export3dPngFromCanvas,
  exportSceneJson,
  triggerSceneExportDownload
} from "@/lib/export/sceneExport";
import { buildShareSceneUrl } from "@/lib/share/shareSceneLink";
import {
  applySceneExampleToEditor
} from "@/lib/templates/applySceneExample";
import {
  createValidatedSceneExample,
  getSceneExampleById,
  SCENE_EXAMPLES
} from "@/lib/templates/examplesRegistry";
import { useGraphStore } from "@/store/graphStore";
import type { Axis2DPair } from "@/types/graphUi";
import { useEditorStore } from "@/lib/store/editorStore";
import { cn } from "@/components/ui/styles";
import {
  VinculumMark,
  UndoIcon,
  RedoIcon,
  ChevronDownIcon,
  SunIcon,
  MoonIcon,
  MoreHorizontalIcon,
  ShareIcon
} from "@/components/layout/icons";
import ThemeAccentPopover from "@/components/theme/ThemeAccentPopover";
import WorkspaceSwitcher from "@/components/editor/WorkspaceSwitcher";
import ViewControls from "@/components/editor/ViewControls";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { captureEvent } from "@/lib/analytics/posthog";
import { isDragTransactionActive } from "@/lib/interaction/dragHistoryTransaction";
import { requestCanvasFrame } from "@/lib/interaction/canvasFrameRequests";

const FieldSolverDialog = lazy(() => import("@/components/inspector/FieldSolverDialog"));

// S34: removed local matchMedia breakpoint (PART 2) — compact chrome now
// follows the central shell composition from editorStore, so responsive
// variants never coexist in the DOM and accessible names stay unique.

export default function TopToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  openExamplesSignal = 0,
  openSolverSignal = 0,
  onOpenGuide,
  activeViewType = "3d",
  onViewTypeChange = () => {},
  activeLayout = "split",
  onLayoutChange = () => {},
  plane2d = "xy",
  onPlane2dChange = () => {},
  base3d = "xy",
  onBase3dChange = () => {},
  activeToolLabel = "pan",
  onToolChange = () => {},
  inspectorOpen = false,
  onToggleInspector = () => {},
  objectsOpen = false,
  onToggleObjects = () => {},
  showObjectsToggle = false,
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenWelcome?: () => void;
  openExamplesSignal?: number;
  openSolverSignal?: number;
  onOpenGuide?: () => void;
  activeViewType?: "2d" | "3d" | "both";
  onViewTypeChange?: (view: "2d" | "3d" | "both") => void;
  activeLayout?: "split" | "quad";
  onLayoutChange?: (layout: "split" | "quad") => void;
  plane2d?: Axis2DPair;
  onPlane2dChange?: (pair: Axis2DPair) => void;
  base3d?: Axis2DPair;
  onBase3dChange?: (pair: Axis2DPair) => void;
  activeToolLabel?: "select" | "pan" | "probe" | "addPin" | "measureDistance" | "measureAngle" | "draw";
  onToolChange?: (tool: "select" | "pan" | "probe" | "addPin" | "measureDistance" | "measureAngle" | "draw") => void;
  inspectorOpen?: boolean;
  onToggleInspector?: () => void;
  objectsOpen?: boolean;
  onToggleObjects?: () => void;
  showObjectsToggle?: boolean;
}) {
  const [fieldSolverOpen, setFieldSolverOpen] = useState(false);
  const [fieldSolverRequested, setFieldSolverRequested] = useState(false);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [newSceneOpen, setNewSceneOpen] = useState(false);
  const [projectDialogMode, setProjectDialogMode] = useState<"saveAs" | "open" | null>(null);
  const [projectDialogError, setProjectDialogError] = useState<string | null>(null);
  const [examplesDialogOpen, setExamplesDialogOpen] = useState(false);
  const [examplesDialogError, setExamplesDialogError] = useState<string | null>(null);
  const [pendingExampleId, setPendingExampleId] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [copyPending, setCopyPending] = useState<"scene" | "current" | null>(null);
  const copyInFlight = useRef(false);
  const [manualCopy, setManualCopy] = useState<{ label: string; url: string } | null>(null);
  const manualCopyRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!shareDialogOpen) setManualCopy(null);
  }, [shareDialogOpen]);
  useEffect(() => {
    if (manualCopy) { manualCopyRef.current?.focus(); manualCopyRef.current?.select(); }
  }, [manualCopy]);
  const [projectsLoadError, setProjectsLoadError] = useState<string | null>(null);
  const [projects, setProjects] = useState(() => {
    try {
      return localProjectRepository.listProjects();
    } catch {
      return [];
    }
  });
  const [projectsVersion, setProjectsVersion] = useState(0);
  const composition = useEditorStore((state) => state.responsiveComposition);
  // S34 PART 2: single breakpoint source (shell composition) instead of a
  // local matchMedia interpretation. Compact chrome below wide (1100px).
  const compactBar = composition !== "wide";
  const lastOpenExamplesSignalRef = useRef(openExamplesSignal);
  const lastOpenSolverSignalRef = useRef(openSolverSignal);
  useEffect(() => {
    if (lastOpenSolverSignalRef.current === openSolverSignal) return;
    lastOpenSolverSignalRef.current = openSolverSignal;
    setFieldSolverRequested(true);
    setFieldSolverOpen(true);
  }, [openSolverSignal]);

   const [is3dCanvasAvailable, setIs3dCanvasAvailable] = useState(false);

   const scene = useGraphStore((state) => state.scene);
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const themeMode = useGraphStore((state) => state.ui.themeMode);
  const setThemeMode = useGraphStore((state) => state.setThemeMode);
  const accentPreset = useGraphStore((state) => state.ui.accentPreset);
  const currentProjectId = useGraphStore((state) => state.ui.projectSession.currentProjectId);
  const currentProjectName = useGraphStore((state) => state.ui.projectSession.currentProjectName);
  const autosaveStatus = useGraphStore((state) => state.ui.projectSession.autosaveStatus);
  const autosaveError = useGraphStore((state) => state.ui.projectSession.autosaveError);
  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const setGraphMode = useGraphStore((state) => state.setGraphMode);
  const active2dViewport = useGraphStore((state) => state.ui.active2dViewport);
  const axis2dPair = useGraphStore((state) => state.ui.axis2dPair);
  const axis2dPairQuadTop = useGraphStore((state) => state.ui.axis2dPairQuadTop);
  const viewport2d = useGraphStore((state) => state.ui.viewport2d);
  const viewport2dQuadTop = useGraphStore((state) => state.ui.viewport2dQuadTop);
  const viewport2dFrame = useGraphStore((state) => state.ui.viewport2dFrame);
  const viewport2dQuadTopFrame = useGraphStore((state) => state.ui.viewport2dQuadTopFrame);
  const setCurrentProjectSession = useGraphStore((state) => state.setCurrentProjectSession);
  const workspace = useGraphStore((state) => state.ui.workspace);
  const setProjectAutosaveStatus = useGraphStore((state) => state.setProjectAutosaveStatus);
  const resetScene = useGraphStore((state) => state.resetScene);
  const openSceneDialog = useGraphStore((state) => state.openSceneDialog);
  const replaceSceneDocument = useGraphStore((state) => state.replaceSceneDocument);
  const clearHistory = useHistoryStore((state) => state.clear);
  const showPerfHud = useEditorStore((state) => state.showPerfHud);
   useEffect(() => {
    try {
      setProjects(localProjectRepository.listProjects());
      setProjectsLoadError(null);
    } catch (error) {
      setProjects([]);
      if (error instanceof LocalProjectRepositoryError) {
        setProjectsLoadError(error.message);
      } else {
        setProjectsLoadError("Projects could not be loaded from local storage.");
      }
    }
  }, [projectsVersion]);

  useEffect(() => {
    setIs3dCanvasAvailable(Array.from(document.querySelectorAll<HTMLCanvasElement>('[data-graph3d-canvas="true"]'))
      .some((canvas) => canvas.getClientRects().length > 0 && canvas.clientWidth > 0 && canvas.clientHeight > 0));
  }, [graphMode, workspace, fileMenuOpen, shareDialogOpen, activeViewType, activeLayout, composition]);

  const refreshProjects = () => {
    setProjectsVersion((version) => version + 1);
  };

  const handleNewSceneMenuClick = () => {
    setPendingExampleId(null);
    if (objectCount === 0) {
      clearHistory();
      resetScene();
      setFileMenuOpen(false);
      return;
    }
    setNewSceneOpen(true);
    setFileMenuOpen(false);
  };

  const handleConfirmNewScene = () => {
    if (pendingExampleId) {
      setNewSceneOpen(false);
      applyExampleById(pendingExampleId);
      return;
    }
    clearHistory();
    resetScene();
    setNewSceneOpen(false);
    setFileMenuOpen(false);
  };

  const handleSaveAsProject = (name: string) => {
    try {
      const saved = localProjectRepository.saveProject({
        name,
        scene
      });
      localProjectRepository.clearUnnamedRecoverySnapshot();
      setCurrentProjectSession({ id: saved.id, name: saved.name });
      setProjectAutosaveStatus("saved");
      setProjectDialogError(null);
      setProjectDialogMode(null);
      refreshProjects();
      captureEvent("project_saved", { mode: "save_as", object_count: scene.objects.length });
    } catch (error) {
      if (error instanceof LocalProjectRepositoryError) {
        setProjectDialogError(error.message);
        captureEvent("project_save_failed", { mode: "save_as", error_type: "repository" });
        return;
      }
      setProjectDialogError("Project save failed. Try again.");
      captureEvent("project_save_failed", { mode: "save_as", error_type: "unknown" });
    }
  };

  const handleSaveProject = () => {
    try {
      if (!currentProjectId || !currentProjectName) {
        setProjectDialogError(null);
        setProjectDialogMode("saveAs");
        setFileMenuOpen(false);
        return;
      }

      localProjectRepository.saveProject({
        projectId: currentProjectId,
        name: currentProjectName,
        scene
      });
      setProjectAutosaveStatus("saved");
      setProjectDialogError(null);
      refreshProjects();
      setFileMenuOpen(false);
      captureEvent("project_saved", { mode: "save", object_count: scene.objects.length });
    } catch (error) {
      if (error instanceof LocalProjectRepositoryError) {
        setProjectDialogError(error.message);
      } else {
        setProjectDialogError("Project save failed. Try again.");
      }
      setProjectDialogMode("saveAs");
      captureEvent("project_save_failed", { mode: "save", error_type: error instanceof LocalProjectRepositoryError ? "repository" : "unknown" });
    }
  };

  const handleOpenProject = (projectId: string) => {
    try {
      const loadedProject = localProjectRepository.getProject(projectId);
      if (!loadedProject) {
        setProjectDialogError("Project was not found. It may have been deleted.");
        refreshProjects();
        return;
      }

      const loadedScene = localProjectRepository.loadProjectScene(projectId);
      localProjectRepository.clearUnnamedRecoverySnapshot();
      clearHistory();
      replaceSceneDocument(loadedScene);
      setCurrentProjectSession({ id: loadedProject.id, name: loadedProject.name });
      setProjectAutosaveStatus("idle");
      setProjectDialogError(null);
      setProjectDialogMode(null);
      captureEvent("project_opened", { object_count: loadedScene.objects.length });
    } catch (error) {
      if (error instanceof LocalProjectRepositoryError) {
        setProjectDialogError(error.message);
        return;
      }
      setProjectDialogError("Project load failed. Try again.");
    }
  };

  const handleDeleteProject = (projectId: string) => {
    try {
      localProjectRepository.deleteProject(projectId);
      if (projectId === currentProjectId) {
        setCurrentProjectSession(null);
        setProjectAutosaveStatus("idle");
      }
      setProjectDialogError(null);
      refreshProjects();
      captureEvent("project_deleted");
    } catch (error) {
      if (error instanceof LocalProjectRepositoryError) {
        setProjectDialogError(error.message);
        return;
      }
      setProjectDialogError("Project delete failed. Try again.");
    }
  };

  const copyUrl = async (url: string, kind: "scene" | "current") => {
    if (copyInFlight.current) return;
    copyInFlight.current = true;
    setCopyPending(kind);
    setActionFeedback(null);
    setManualCopy(null);
    try {
      await navigator.clipboard.writeText(url);
      setActionFeedback(kind === "scene" ? "Share link copied." : "Current URL copied.");
      if (kind === "scene") captureEvent("share_link_copied", { object_count: scene.objects.length });
    } catch {
      setManualCopy({ label: kind === "scene" ? "Share link" : "Current URL", url });
      setShareDialogOpen(true);
      setActionFeedback("Clipboard access is unavailable. Copy the selected link below.");
      if (kind === "scene") captureEvent("share_link_copy_failed", { error_type: "clipboard" });
    } finally {
      copyInFlight.current = false;
      setCopyPending(null);
    }
  };

  const handleCopyShareLink = async () => {
    if (copyInFlight.current) return;
    const shareResult = buildShareSceneUrl({ scene, baseUrl: window.location.href });
    if (!shareResult.ok || !shareResult.url) {
      setManualCopy(null);
      setShareDialogOpen(true);
      setActionFeedback(shareResult.error ?? "Share link failed. Use JSON export instead.");
      captureEvent("share_link_copy_failed", { error_type: "build_failed" });
      return;
    }
    await copyUrl(shareResult.url, "scene");
  };

  const handleCopyCurrentUrl = () => copyUrl(window.location.href, "current");

  const applyExampleById = (exampleId: string) => {
    const example = getSceneExampleById(exampleId);
    if (!example) {
      setExamplesDialogError("Selected example was not found. Please try another example.");
      return;
    }
    const validated = createValidatedSceneExample(example);
    if (!validated.ok) {
      setExamplesDialogError(validated.error);
      return;
    }
    try {
      applySceneExampleToEditor({
        scene: validated.scene,
        recommendedMode: example.recommendedMode,
        prepareView: (mode) => {
          const graph = useGraphStore.getState();
          graph.setWorkspace("math");
          graph.setActive2dViewport("primary");
          graph.setAxis2DPair("xy");
          graph.resetViewport2D();
          graph.setCanvas2dTool("pan");
          graph.setCanvas3dTool("pan");
          graph.requestCameraReset();
          useEditorStore.getState().setViewportMode(mode);
        },
        clearHistory,
        replaceSceneDocument,
        setGraphMode,
        setCurrentProjectSession,
        setProjectAutosaveStatus
      });
      localProjectRepository.clearUnnamedRecoverySnapshot();
      setExamplesDialogError(null);
      setExamplesDialogOpen(false);
      setPendingExampleId(null);
    } catch {
      setExamplesDialogError("Example could not replace the current scene. Use New Scene or JSON import as fallback.");
    }
  };

  const handleOpenExample = (exampleId: string) => {
    const hasObjects = scene.objects.length > 0;
    const hasNamedProject = Boolean(currentProjectId);
    const hasUnsavedAutosave =
      autosaveStatus === "dirty" || autosaveStatus === "saving" || autosaveStatus === "error";
    let hasRecoverySnapshot = false;
    try {
      hasRecoverySnapshot = localProjectRepository.getUnnamedRecoverySnapshot() !== null;
    } catch {
      hasRecoverySnapshot = true;
    }

    if (hasObjects || hasNamedProject || hasUnsavedAutosave || hasRecoverySnapshot) {
      setPendingExampleId(exampleId);
      setExamplesDialogOpen(false);
      setNewSceneOpen(true);
      return;
    }
    applyExampleById(exampleId);
  };

  const handleExportJson = () => {
    captureEvent("export_json_clicked", { object_count: scene.objects.length });
    const exported = exportSceneJson(scene);
    if (!exported.ok || !exported.file) {
      setActionFeedback(exported.error ?? "JSON export failed.");
      setFileMenuOpen(false);
      captureEvent("export_failed", { format: "json", error_type: "serialize" });
      return;
    }
    const download = triggerSceneExportDownload(exported.file);
    if (download.ok) {
      captureEvent("export_succeeded", { format: "json" });
    } else {
      captureEvent("export_failed", { format: "json", error_type: "download" });
    }
    setActionFeedback(download.ok ? "Export JSON downloaded." : download.error ?? "JSON download failed.");
    setFileMenuOpen(false);
    setShareDialogOpen(false);
  };

  const handleExport2dPng = async () => {
    captureEvent("export_2d_png_clicked", { object_count: scene.objects.length });
    if (graphMode !== "2d") {
      setActionFeedback("Switch to 2D mode to export 2D PNG.");
      setFileMenuOpen(false);
      return;
    }
    const variant = active2dViewport === "quadTop" ? "quadTop" : "primary";
    const canvas = document.querySelector<HTMLCanvasElement>(
      `[data-graph2d-canvas="true"][data-graph2d-variant="${variant}"]`
    );
    const exported = await export2dPngFromCanvas({
      canvas,
      sceneName: scene.metadata.name
    });
    if (!exported.ok || !exported.file) {
      setActionFeedback(exported.error ?? "2D PNG export failed.");
      setFileMenuOpen(false);
      captureEvent("export_failed", { format: "2d_png", error_type: "capture" });
      return;
    }
    const download = triggerSceneExportDownload(exported.file);
    if (download.ok) {
      captureEvent("export_succeeded", { format: "2d_png" });
    } else {
      captureEvent("export_failed", { format: "2d_png", error_type: "download" });
    }
    setActionFeedback(download.ok ? "Export 2D PNG downloaded." : download.error ?? "2D PNG download failed.");
    setFileMenuOpen(false);
    setShareDialogOpen(false);
  };

  const handleExport2dSvg = () => {
    captureEvent("export_2d_svg_clicked", { object_count: scene.objects.length });
    if (graphMode !== "2d") {
      setActionFeedback("Switch to 2D mode to export 2D SVG.");
      setFileMenuOpen(false);
      return;
    }
    const useQuadTop = active2dViewport === "quadTop";
    const exported = export2dSvg({
      sceneName: scene.metadata.name,
      objects: scene.objects,
      axisPair: useQuadTop ? axis2dPairQuadTop : axis2dPair,
      viewport: useQuadTop ? viewport2dQuadTop : viewport2d,
      viewportFrame: useQuadTop ? viewport2dQuadTopFrame : viewport2dFrame
    });
    if (!exported.ok || !exported.file) {
      setActionFeedback(exported.error ?? "2D SVG export failed.");
      setFileMenuOpen(false);
      captureEvent("export_failed", { format: "2d_svg", error_type: "build" });
      return;
    }
    const download = triggerSceneExportDownload(exported.file);
    if (!download.ok) {
      setActionFeedback(download.error ?? "2D SVG download failed.");
      setFileMenuOpen(false);
      captureEvent("export_failed", { format: "2d_svg", error_type: "download" });
      return;
    }
    captureEvent("export_succeeded", { format: "2d_svg", had_warnings: (exported.file.warnings?.length ?? 0) > 0 });
    setActionFeedback(
      exported.file.warnings && exported.file.warnings.length > 0
        ? "Export 2D SVG downloaded with some unsupported objects skipped."
        : "Export 2D SVG downloaded."
    );
    setFileMenuOpen(false);
    setShareDialogOpen(false);
  };

  const handleExport3dPng = async () => {
    captureEvent("export_3d_png_clicked", { object_count: scene.objects.length });
    const canvas = Array.from(document.querySelectorAll<HTMLCanvasElement>(`[data-graph3d-canvas="true"]`))
      .find((candidate) => candidate.getClientRects().length > 0 && candidate.clientWidth > 0 && candidate.clientHeight > 0) ?? null;
    if (!canvas) {
      setActionFeedback("3D canvas is not available. Switch to 3D mode and try again.");
      setFileMenuOpen(false);
      captureEvent("export_failed", { format: "3d_png", error_type: "no_canvas" });
      return;
    }
    const exported = await export3dPngFromCanvas({
      canvas,
      sceneName: scene.metadata.name
    });
    if (!exported.ok || !exported.file) {
      setActionFeedback(exported.error ?? "3D PNG export failed.");
      setFileMenuOpen(false);
      captureEvent("export_failed", { format: "3d_png", error_type: "capture" });
      return;
    }
    const download = triggerSceneExportDownload(exported.file);
    if (download.ok) {
      captureEvent("export_succeeded", { format: "3d_png" });
    } else {
      captureEvent("export_failed", { format: "3d_png", error_type: "download" });
    }
    setActionFeedback(download.ok ? "Export 3D PNG downloaded." : download.error ?? "3D PNG download failed.");
    setFileMenuOpen(false);
    setShareDialogOpen(false);
  };


  useEffect(() => {
    if (openExamplesSignal === lastOpenExamplesSignalRef.current) {
      return;
    }
    lastOpenExamplesSignalRef.current = openExamplesSignal;
    setExamplesDialogError(null);
    setExamplesDialogOpen(true);
    setFileMenuOpen(false);
  }, [openExamplesSignal]);

  useEffect(() => {
    if (!actionFeedback || shareDialogOpen) {
      return;
    }
    const timeout = window.setTimeout(() => setActionFeedback(null), 6500);
    return () => window.clearTimeout(timeout);
  }, [actionFeedback, shareDialogOpen]);

  return (
    <>
      {fieldSolverRequested ? <Suspense fallback={fieldSolverOpen ? <Dialog open onOpenChange={setFieldSolverOpen}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>Field solver</DialogTitle><DialogDescription>Loading solver…</DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setFieldSolverOpen(false)}>Close solver</Button></DialogFooter></DialogContent></Dialog> : null}>
        <FieldSolverDialog open={fieldSolverOpen} onOpenChange={setFieldSolverOpen} />
      </Suspense> : null}
      <NewSceneDialog
        open={newSceneOpen}
        exampleTitle={pendingExampleId ? getSceneExampleById(pendingExampleId)?.title : undefined}
        onConfirm={handleConfirmNewScene}
        onCancel={() => {
          setNewSceneOpen(false);
          if (pendingExampleId) setExamplesDialogOpen(true);
          setPendingExampleId(null);
        }}
      />
      <ProjectDialog
        open={projectDialogMode !== null}
        mode={projectDialogMode ?? "open"}
        defaultName={scene.metadata.name}
        projects={projects}
        error={projectDialogError ?? projectsLoadError}
        onClose={() => {
          setProjectDialogError(null);
          setProjectDialogMode(null);
        }}
        onSaveAs={handleSaveAsProject}
        onOpen={handleOpenProject}
        onDelete={handleDeleteProject}
      />
      <ExamplesDialog
        open={examplesDialogOpen}
        examples={SCENE_EXAMPLES}
        error={examplesDialogError}
        onClose={() => {
          setExamplesDialogOpen(false);
          setExamplesDialogError(null);
        }}
        onOpenExample={handleOpenExample}
      />
      <header
        className={cn(
          "relative z-50 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--editor-chrome)] font-sans",
          compactBar
            ? composition === "compact"
              ? "flex flex-wrap items-center gap-1 px-2 py-1"
              : "flex h-12 items-center gap-1 px-2"
            : "grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4"
        )}
      >
      <div className={cn("flex min-w-0 items-center", compactBar ? composition === "compact" ? "w-full gap-1" : "gap-1" : "gap-1.5")}>
        {compactBar ? null : (
          <div className="mr-1.5 flex shrink-0 items-center gap-2">
            <VinculumMark className="h-7 w-7 text-[var(--text-primary)]" />
            <span className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">Vinculum</span>
          </div>
        )}
        {compactBar ? <WorkspaceSwitcher compact /> : null}
        {workspace === "math" ? <Button size="sm" variant="ghost" onClick={(event) => { event.currentTarget.focus(); setFieldSolverRequested(true); setFieldSolverOpen(true); }} aria-label="Open field solver" title="Solve a scalar, vector, polar, or complex field">Solve</Button> : null}
        {compactBar ? null : (
          <>
            <div className="compact-hide-divider mx-1.5 h-5 w-px shrink-0 bg-[var(--border-subtle)]" />
            <DropdownMenu open={fileMenuOpen} onOpenChange={setFileMenuOpen}>
              <DropdownMenuTrigger>
                {(props) => (
                  <button
                    ref={props.ref as any}
                    type="button"
                    aria-expanded={props["aria-expanded"]}
                    aria-controls={props["aria-controls"]}
                    aria-haspopup={props["aria-haspopup"]}
                    onClick={props.onClick}
                    onKeyDown={props.onKeyDown}
                    className={cn(
                      "flex h-8 items-center gap-1 rounded-[var(--radius-sm)] px-2.5 text-[13px] font-medium outline-none transition-colors duration-[var(--motion-fast)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                      fileMenuOpen
                        ? "bg-[var(--surface-muted)] text-[var(--text-primary)]"
                        : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                    )}
                  >
                    Scene
                    <ChevronDownIcon className={cn("h-3.5 w-3.5 opacity-70 transition-transform", fileMenuOpen && "rotate-180")} />
                  </button>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[260px] p-0">
                <ScrollArea className="max-h-[calc(100dvh-100px)] p-1.5">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Scene</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={handleNewSceneMenuClick}>
                      New scene
                      <DropdownMenuShortcut>N</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setExamplesDialogError(null);
                        setExamplesDialogOpen(true);
                      }}
                    >
                      Open example...
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Projects</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={handleSaveProject}>Save project</DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setProjectDialogError(null);
                        setProjectDialogMode("saveAs");
                      }}
                    >
                      Save as...
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setProjectDialogError(null);
                        setProjectDialogMode("open");
                      }}
                    >
                      Open project...
                    </DropdownMenuItem>
                  </DropdownMenuGroup>

                  <DropdownMenuSeparator />

                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Transfer</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => openSceneDialog("import")}>Import...</DropdownMenuItem>
                    <DropdownMenuItem onSelect={handleCopyShareLink}>Copy share link</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => { setShareDialogOpen(true); captureEvent("share_dialog_opened"); }}>Share &amp; export...</DropdownMenuItem>
                  </DropdownMenuGroup>

                </ScrollArea>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}

        {/* S34 PART 17/59: Undo stays reachable on every composition (touch
            users need discoverable Undo); Redo joins the overflow menu below
            wide widths (one tap away, still enabled-state honest). */}
        <div className="flex shrink-0 items-center gap-0.5">
          <ToolbarAction onClick={onUndo} disabled={!canUndo} icon={<UndoIcon className="h-4 w-4" />} title="Undo" />
          {!compactBar ? (
            <ToolbarAction onClick={onRedo} disabled={!canRedo} icon={<RedoIcon className="h-4 w-4" />} title="Redo" />
          ) : null}
        </div>
      </div>

      {compactBar ? null : <WorkspaceSwitcher />}

      {compactBar ? (
        <>
          <div className={composition === "compact" ? "hidden" : "min-w-0 flex-1"} />
          <CompactChromeRightCluster
            objectsOpen={objectsOpen}
            onToggleObjects={onToggleObjects}
            showObjectsToggle={showObjectsToggle}
            inspectorOpen={inspectorOpen}
            onToggleInspector={onToggleInspector}
            objectCount={objectCount}
            canRedo={canRedo}
            onRedo={onRedo}
            autosaveStatus={autosaveStatus}
            autosaveError={autosaveError}
            themeMode={themeMode}
            onCycleTheme={() =>
              setThemeMode(themeMode === "light" ? "dark" : themeMode === "dark" ? "system" : "light")
            }
            onNewScene={handleNewSceneMenuClick}
            onOpenExample={() => {
              setExamplesDialogError(null);
              setExamplesDialogOpen(true);
            }}
            onOpenGuide={onOpenGuide}
            onImport={() => openSceneDialog("import")}
            onSaveProject={handleSaveProject}
            onSaveAs={() => { setProjectDialogError(null); setProjectDialogMode("saveAs"); }}
            onOpenProject={() => { setProjectDialogError(null); setProjectDialogMode("open"); }}
            onCopyShareLink={handleCopyShareLink}
            onFrameSelected={() => {
              if (!isDragTransactionActive()) {
                requestCanvasFrame("selected");
              }
            }}
            onFitScene={() => {
              if (!isDragTransactionActive()) {
                requestCanvasFrame("scene");
              }
            }}
            onOpenShare={() => {
              setShareDialogOpen(true);
              captureEvent("share_dialog_opened");
            }}
          />
        </>
      ) : (
      <div className="flex min-w-0 items-center justify-end gap-1">
        <AutosaveIndicator status={autosaveStatus} error={autosaveError} />
        <HeaderAction
          icon={<ShareIcon className="h-4 w-4" />}
          label="Share"
          onClick={() => { setShareDialogOpen(true); captureEvent("share_dialog_opened"); }}
        />

        {showObjectsToggle ? (
          <Button
            type="button"
            onClick={(event) => { event.currentTarget.focus(); onToggleObjects(); }}
            aria-pressed={objectsOpen}
            variant="ghost"
          className={objectsOpen ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : undefined}
            size="sm"
          >
            Objects
          </Button>
        ) : null}

        <Button type="button" size="sm" variant="ghost" onClick={(event) => { event.currentTarget.focus(); onToggleInspector(); }}
          aria-pressed={inspectorOpen}
          className={inspectorOpen ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : undefined}>
          Inspector
        </Button>

        {onOpenGuide ? <Button type="button" size="sm" variant="ghost" onClick={(event) => { event.currentTarget.focus(); onOpenGuide(); }} aria-label="Open editor guide" title="Help — find tools and learn how to use the editor">Help</Button> : null}

        <Popover open={themeMenuOpen} onOpenChange={setThemeMenuOpen}>
          <PopoverTrigger>
            {(props) => (
              <button
                ref={props.ref as any}
                type="button"
                aria-label="Open theme and accent menu"
                aria-expanded={props["aria-expanded"]}
                aria-controls={props["aria-controls"]}
                aria-haspopup={props["aria-haspopup"]}
                onClick={props.onClick}
                onKeyDown={props.onKeyDown}
                title={`Theme: ${themeMode}`}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] outline-none transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
                  themeMenuOpen && "bg-[var(--surface-muted)] text-[var(--text-primary)]"
                )}
              >
                <SunIcon aria-hidden="true" className="theme-light-only h-4 w-4" />
                <MoonIcon aria-hidden="true" className="theme-dark-only h-4 w-4" />
              </button>
            )}
          </PopoverTrigger>
          <PopoverContent ariaLabel="Appearance" className="w-72">
            <ThemeAccentPopover showPerformance={true} context="editor" />
          </PopoverContent>
        </Popover>
      </div>
      )}

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share and export</DialogTitle>
          <DialogDescription>Share a snapshot of your scene or download a backup or image.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5 px-5 py-4">
          <section className="space-y-2">
            <p className="text-[12px] font-semibold text-[var(--text-primary)]">Share</p>
            <div className="grid grid-cols-1 gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={copyPending !== null} aria-busy={copyPending === "scene"} onClick={handleCopyShareLink}>
                {copyPending === "scene" ? "Copying…" : "Copy share link"}
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={copyPending !== null} aria-busy={copyPending === "current"} onClick={handleCopyCurrentUrl}>
                {copyPending === "current" ? "Copying…" : "Copy current URL"}
              </Button>
            </div>
          </section>
          <Separator />
          <section className="space-y-2">
            <p className="text-[12px] font-semibold text-[var(--text-primary)]">Export</p>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={handleExportJson}>
                JSON
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={graphMode !== "2d"} title={graphMode !== "2d" ? "Switch to 2D to export SVG" : undefined} onClick={handleExport2dSvg}>
                2D SVG
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={graphMode !== "2d"} title={graphMode !== "2d" ? "Switch to 2D to export PNG" : undefined} onClick={handleExport2dPng}>
                2D PNG
              </Button>
              <Button type="button" variant="secondary" size="sm" disabled={!is3dCanvasAvailable} title={!is3dCanvasAvailable ? "Open a 3D view to export PNG" : undefined} onClick={handleExport3dPng}>
                3D PNG
              </Button>
            </div>
          </section>
          {actionFeedback ? (
            <div role="status" aria-atomic="true" className="action-feedback rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
              {actionFeedback}
            </div>
          ) : null}
          {manualCopy ? <label className="block space-y-2 text-[12px] text-[var(--text-secondary)]">{manualCopy.label}
            <input ref={manualCopyRef} className="input" readOnly value={manualCopy.url} onFocus={(event) => event.currentTarget.select()} aria-label={`Copy ${manualCopy.label.toLowerCase()} manually`} />
          </label> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" size="sm" data-autofocus="true" onClick={() => setShareDialogOpen(false)}>
            Close
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
      {!shareDialogOpen && (actionFeedback || copyPending) ? <div role="status" aria-atomic="true" className="action-toast action-feedback">
        <span>{copyPending ? "Copying link…" : actionFeedback}</span>
        {!copyPending ? <button type="button" aria-label="Dismiss action feedback" onClick={() => setActionFeedback(null)}>×</button> : null}
      </div> : null}
      {compactBar ? (
        <div className="flex shrink-0 items-center overflow-x-auto border-b border-[var(--border-subtle)] bg-[var(--editor-chrome)] px-2 py-1.5">
          <ViewControls
            activeViewType={activeViewType}
            onViewTypeChange={onViewTypeChange}
            activeLayout={activeLayout}
            onLayoutChange={onLayoutChange}
            plane2d={plane2d}
            onPlane2dChange={onPlane2dChange}
            base3d={base3d}
            onBase3dChange={onBase3dChange}
            activeToolLabel={activeToolLabel}
            onToolChange={onToolChange}
          />
        </div>
      ) : null}
    </>
  );
}

// S34 PART 14–17: compact right cluster. Always visible: Objects (with
// count), Inspector, Undo/Redo (in the main row), and one overflow menu.
// Secondary actions (Scene, Examples, Share, Export, Autosave status,
// theme) live in the overflow. Autosave errors surface as a dot on the
// overflow trigger so critical status is never lost (PART 134).
function CompactChromeRightCluster({
  objectsOpen,
  onToggleObjects,
  showObjectsToggle,
  inspectorOpen,
  onToggleInspector,
  objectCount,
  canRedo,
  onRedo,
  autosaveStatus,
  autosaveError,
  themeMode,
  onCycleTheme,
  onNewScene,
  onOpenExample,
  onOpenGuide,
  onImport,
  onSaveProject,
  onSaveAs,
  onOpenProject,
  onCopyShareLink,
  onOpenShare,
  onFrameSelected,
  onFitScene
}: {
  objectsOpen: boolean;
  onToggleObjects: () => void;
  showObjectsToggle: boolean;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  objectCount: number;
  canRedo: boolean;
  onRedo: () => void;
  autosaveStatus: string;
  autosaveError: string | null;
  themeMode: string;
  onCycleTheme: () => void;
  onNewScene: () => void;
  onOpenExample: () => void;
  onOpenGuide?: () => void;
  onImport: () => void;
  onSaveProject: () => void;
  onSaveAs: () => void;
  onOpenProject: () => void;
  onCopyShareLink: () => void;
  onOpenShare: () => void;
  onFrameSelected: () => void;
  onFitScene: () => void;
}) {
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <div className="chrome-panel-actions flex min-w-0 shrink-0 items-center justify-end gap-1 py-0.5">
      {showObjectsToggle ? (
        <Button
          type="button"
          onClick={(event) => { event.currentTarget.focus(); onToggleObjects(); }}
          aria-pressed={objectsOpen}
          variant="ghost"
          className={objectsOpen ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : undefined}
          size="sm"
        >
          Objects
          <span
            data-testid="compact-object-count"
            aria-hidden="true"
            className="ml-1 rounded bg-[var(--surface-muted)] px-1 font-mono text-[11px]"
          >
            {objectCount}
          </span>
        </Button>
      ) : null}
      <Button
        type="button"
        onClick={(event) => { event.currentTarget.focus(); onToggleInspector(); }}
        variant="ghost"
        aria-pressed={inspectorOpen}
        className={inspectorOpen ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]" : undefined}
        size="sm"
      >
        Inspector
      </Button>
      {onOpenGuide ? <Button type="button" size="sm" variant="ghost" onClick={(event) => { event.currentTarget.focus(); onOpenGuide(); }} aria-label="Open editor guide">Help</Button> : null}
      <DropdownMenu open={moreOpen} onOpenChange={setMoreOpen}>
        <DropdownMenuTrigger>
          {(props) => (
            <button
              ref={props.ref as any}
              type="button"
              aria-label="More actions"
              aria-expanded={props["aria-expanded"]}
              aria-controls={props["aria-controls"]}
              aria-haspopup={props["aria-haspopup"]}
              onClick={props.onClick}
              onKeyDown={props.onKeyDown}
              className={cn(
                "relative flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] transition-colors",
                moreOpen
                  ? "bg-[var(--accent-soft)] text-[var(--accent-ink)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
              )}
            >
              <MoreHorizontalIcon className="h-3.5 w-3.5" />
              {autosaveStatus === "error" ? (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-rose-400"
                />
              ) : null}
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[240px] p-0">
          <ScrollArea className="overflow-menu-scroll p-1.5">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Scene</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onNewScene}>New scene</DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenExample}>Open example...</DropdownMenuItem>
              <DropdownMenuItem onSelect={onImport}>Import...</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Projects</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onSaveProject}>Save project</DropdownMenuItem>
              <DropdownMenuItem onSelect={onSaveAs}>Save as...</DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenProject}>Open project...</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Share</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onCopyShareLink}>Copy share link</DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenShare}>Share &amp; export...</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>View</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onFrameSelected}>Frame selected</DropdownMenuItem>
              <DropdownMenuItem onSelect={onFitScene}>Fit scene</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>History</DropdownMenuLabel>
              <DropdownMenuItem onSelect={onRedo} disabled={!canRedo}>Redo</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Status</DropdownMenuLabel>
              <p role="status" className="px-2.5 py-1.5 text-xs text-[var(--text-tertiary)]">
                {AUTOSAVE_LABEL[autosaveStatus] ?? "Not saved yet"}
                {autosaveError ? ` — ${autosaveError}` : ""}
              </p>
              <DropdownMenuItem onSelect={onCycleTheme}>Theme: {themeMode}</DropdownMenuItem>
            </DropdownMenuGroup>
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function ToolbarAction({ onClick, disabled, icon, title }: any) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--text-secondary)] outline-none transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {icon}
    </button>
  );
}

const HEADER_ACTION_CLASS =
  "flex h-8 items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 text-[13px] font-medium text-[var(--text-secondary)] outline-none transition-colors duration-[var(--motion-fast)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

function HeaderAction({ icon, label, onClick }: { icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={HEADER_ACTION_CLASS}>
      {icon}
      {label}
    </button>
  );
}

const AUTOSAVE_LABEL: Record<string, string> = {
  dirty: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  error: "Save failed"
};

function AutosaveIndicator({ status, error }: { status: string; error: string | null }) {
  const label = AUTOSAVE_LABEL[status];
  if (!label) {
    return null;
  }
  return (
    <span
      role="status"
      title={error ?? `Autosave: ${label}`}
      className={cn(
        "mr-1 hidden items-center gap-1.5 whitespace-nowrap px-1 text-[12px] xl:flex",
        status === "error" ? "text-[var(--status-error-fg)]" : "text-[var(--text-tertiary)]"
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "error"
            ? "bg-[var(--status-error-fg)]"
            : status === "saving"
              ? "animate-pulse bg-amber-500 motion-reduce:animate-none"
              : status === "dirty"
                ? "bg-[var(--text-tertiary)]"
                : "bg-emerald-500"
        )}
      />
      {label}
    </span>
  );
}
