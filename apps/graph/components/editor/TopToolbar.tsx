"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
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
  MoonIcon 
} from "@/components/layout/icons";
import ThemeAccentPopover from "@/components/theme/ThemeAccentPopover";
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
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
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

export default function TopToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenWelcome,
  openExamplesSignal = 0,
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
  onToggleInspector = () => {}
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenWelcome?: () => void;
  openExamplesSignal?: number;
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
}) {
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
  const [projectsLoadError, setProjectsLoadError] = useState<string | null>(null);
  const [projects, setProjects] = useState(() => {
    try {
      return localProjectRepository.listProjects();
    } catch {
      return [];
    }
  });
  const [projectsVersion, setProjectsVersion] = useState(0);
  const [showBrandImageFallback, setShowBrandImageFallback] = useState(false);
  const lastOpenExamplesSignalRef = useRef(openExamplesSignal);

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
  const setProjectAutosaveStatus = useGraphStore((state) => state.setProjectAutosaveStatus);
  const resetScene = useGraphStore((state) => state.resetScene);
  const openSceneDialog = useGraphStore((state) => state.openSceneDialog);
  const replaceSceneDocument = useGraphStore((state) => state.replaceSceneDocument);
  const clearHistory = useHistoryStore((state) => state.clear);
  const showPerfHud = useEditorStore((state) => state.showPerfHud);
  const headerLogoSrc = themeMode === "dark" ? "/brand/logo.png" : "/brand/logo_horizontal.png";
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
    } catch (error) {
      if (error instanceof LocalProjectRepositoryError) {
        setProjectDialogError(error.message);
        return;
      }
      setProjectDialogError("Project save failed. Try again.");
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
    } catch (error) {
      if (error instanceof LocalProjectRepositoryError) {
        setProjectDialogError(error.message);
      } else {
        setProjectDialogError("Project save failed. Try again.");
      }
      setProjectDialogMode("saveAs");
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
    } catch (error) {
      if (error instanceof LocalProjectRepositoryError) {
        setProjectDialogError(error.message);
        return;
      }
      setProjectDialogError("Project delete failed. Try again.");
    }
  };

  const handleCopyShareLink = async () => {
    const shareResult = buildShareSceneUrl({
      scene,
      baseUrl: window.location.href
    });
    if (!shareResult.ok || !shareResult.url) {
      setActionFeedback(shareResult.error ?? "Share link failed. Use JSON export instead.");
      return;
    }

    try {
      await navigator.clipboard.writeText(shareResult.url);
      setActionFeedback("Share link copied.");
    } catch {
      setActionFeedback("Share link copy failed. Copy the URL from the browser bar.");
    }
  };

  const handleCopyCurrentUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setActionFeedback("Current URL copied.");
    } catch {
      setActionFeedback("Current URL copy failed.");
    }
  };

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
      setNewSceneOpen(true);
      return;
    }
    applyExampleById(exampleId);
  };

  const handleExportJson = () => {
    const exported = exportSceneJson(scene);
    if (!exported.ok || !exported.file) {
      setActionFeedback(exported.error ?? "JSON export failed.");
      setFileMenuOpen(false);
      return;
    }
    const download = triggerSceneExportDownload(exported.file);
    setActionFeedback(download.ok ? "Export JSON downloaded." : download.error ?? "JSON download failed.");
    setFileMenuOpen(false);
    setShareDialogOpen(false);
  };

  const handleExport2dPng = async () => {
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
      return;
    }
    const download = triggerSceneExportDownload(exported.file);
    setActionFeedback(download.ok ? "Export 2D PNG downloaded." : download.error ?? "2D PNG download failed.");
    setFileMenuOpen(false);
    setShareDialogOpen(false);
  };

  const handleExport2dSvg = () => {
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
      return;
    }
    const download = triggerSceneExportDownload(exported.file);
    if (!download.ok) {
      setActionFeedback(download.error ?? "2D SVG download failed.");
      setFileMenuOpen(false);
      return;
    }
    setActionFeedback(
      exported.file.warnings && exported.file.warnings.length > 0
        ? "Export 2D SVG downloaded with some unsupported objects skipped."
        : "Export 2D SVG downloaded."
    );
    setFileMenuOpen(false);
    setShareDialogOpen(false);
  };

  const handleExport3dPng = async () => {
    if (graphMode !== "3d") {
      setActionFeedback("Switch to 3D mode to export 3D PNG.");
      setFileMenuOpen(false);
      return;
    }
    const canvas = document.querySelector<HTMLCanvasElement>(`[data-graph3d-canvas="true"]`);
    const exported = await export3dPngFromCanvas({
      canvas,
      sceneName: scene.metadata.name
    });
    if (!exported.ok || !exported.file) {
      setActionFeedback(exported.error ?? "3D PNG export failed.");
      setFileMenuOpen(false);
      return;
    }
    const download = triggerSceneExportDownload(exported.file);
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
    if (!actionFeedback) {
      return;
    }
    const timeout = window.setTimeout(() => setActionFeedback(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [actionFeedback]);

  return (
    <>
      <NewSceneDialog
        open={newSceneOpen}
        onConfirm={handleConfirmNewScene}
        onCancel={() => {
          setNewSceneOpen(false);
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
      <header className="z-50 flex h-12 shrink-0 items-center border-b border-[var(--border-subtle)] bg-[var(--editor-chrome)] px-3 font-sans shadow-[0_1px_0_var(--border-subtle)]">
      <div className="mr-3 flex shrink-0 items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-transparent px-2 py-1">
        {showBrandImageFallback ? (
          <>
            <VinculumMark className="h-5 w-5" />
            <span className="text-[11px] font-bold tracking-tight text-[var(--text-primary)] uppercase">Vinculum</span>
          </>
        ) : (
          <Image
            src={headerLogoSrc}
            alt="Vinculum"
            width={160}
            height={28}
            className="h-5 w-auto object-contain"
            priority
            onError={() => setShowBrandImageFallback(true)}
          />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-transparent px-1.5 py-1">
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
                  "flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12px] font-medium transition-all",
                  fileMenuOpen
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                )}
              >
                Scene
                <ChevronDownIcon className={cn("h-3 w-3 transition-transform", fileMenuOpen && "rotate-180")} />
              </button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[260px] p-0">
            <ScrollArea className="max-h-[420px] p-1.5">
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
                <DropdownMenuItem onSelect={() => onOpenWelcome?.()}>Welcome / Getting started</DropdownMenuItem>
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
                <DropdownMenuLabel>Import / Export</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => openSceneDialog("import")}>Import...</DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExportJson}>Export JSON</DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExport2dPng} disabled={graphMode !== "2d"}>
                  Export 2D PNG
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExport2dSvg} disabled={graphMode !== "2d"}>
                  Export 2D SVG
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={handleExport3dPng} disabled={graphMode !== "3d"}>
                  Export 3D PNG
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuLabel>Share</DropdownMenuLabel>
                <DropdownMenuItem onSelect={handleCopyShareLink}>Copy share link</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShareDialogOpen(true)}>Open share/export dialog</DropdownMenuItem>
              </DropdownMenuGroup>
            </ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="mx-1 h-4 w-px bg-[var(--border-strong)]" />

        <div className="flex items-center gap-0.5">
          <ToolbarAction onClick={onUndo} disabled={!canUndo} icon={<UndoIcon className="h-3.5 w-3.5" />} title="Undo" />
          <ToolbarAction onClick={onRedo} disabled={!canRedo} icon={<RedoIcon className="h-3.5 w-3.5" />} title="Redo" />
        </div>
      </div>

      <div className="mx-2 hidden min-h-0 min-w-0 flex-1 items-center justify-start lg:flex">
        <div className="flex w-full min-w-0 justify-start overflow-x-auto overscroll-x-contain [scrollbar-width:thin]">
          <div className="flex w-max items-center gap-2">
        <div
          className="flex h-8 shrink-0 items-center gap-0.5 rounded-md border border-[var(--border-subtle)] bg-transparent p-0.5"
          role="group"
          aria-label="View type"
        >
          <span className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">View</span>
          {(["2d", "3d", "both"] as const).map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={activeViewType === id}
              aria-label={id === "both" ? "2D and 3D together" : `${id.toUpperCase()} only`}
              onClick={() => onViewTypeChange(id)}
              className={cn(
                "h-7 rounded-[5px] px-2 text-[11px] font-semibold uppercase tracking-wide outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
                activeViewType === id
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]/60 hover:text-[var(--text-primary)]"
              )}
            >
              {id === "both" ? "2D+3D" : id.toUpperCase()}
            </button>
          ))}
        </div>
        {activeViewType === "both" ? (
          <div
            className="flex h-8 shrink-0 items-center gap-0.5 rounded-md border border-[var(--border-subtle)] bg-transparent p-0.5"
            role="group"
            aria-label="Multi-panel layout"
          >
            <span className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Layout</span>
            {(["split", "quad"] as const).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={activeLayout === id}
                aria-label={id === "split" ? "Side-by-side layout" : "Four-panel layout"}
                onClick={() => onLayoutChange(id)}
                className={cn(
                  "h-7 rounded-[5px] px-2 text-[11px] font-semibold uppercase tracking-wide outline-none transition-colors focus-visible:ring-1 focus-visible:ring-[var(--accent)]",
                  activeLayout === id
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]/60 hover:text-[var(--text-primary)]"
                )}
              >
                {id === "split" ? "Split" : "Quad"}
              </button>
            ))}
          </div>
        ) : null}
        {activeViewType !== "3d" ? (
          <label className="flex h-8 shrink-0 items-center gap-1 rounded border border-[var(--border-subtle)] bg-transparent px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            2D Plane
            <Select
              data-testid="toolbar-2d-plane-select"
              aria-label="2D Plane"
              value={plane2d}
              onChange={(event) => onPlane2dChange(event.target.value as Axis2DPair)}
              className="h-6 border-0 bg-transparent px-1 text-[12px] uppercase"
            >
              <option value="xy">XY</option>
              <option value="xz">XZ</option>
              <option value="yz">YZ</option>
            </Select>
          </label>
        ) : null}
        {activeViewType !== "2d" ? (
          <label className="flex h-8 shrink-0 items-center gap-1 rounded border border-[var(--border-subtle)] bg-transparent px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            3D Base
            <Select
              data-testid="toolbar-3d-base-select"
              aria-label="3D Base"
              value={base3d}
              onChange={(event) => onBase3dChange(event.target.value as Axis2DPair)}
              className="h-6 border-0 bg-transparent px-1 text-[12px] uppercase"
            >
              <option value="xy">Base XY</option>
              <option value="xz">Base XZ</option>
              <option value="yz">Base YZ</option>
            </Select>
          </label>
        ) : null}
        <label className="flex h-8 shrink-0 items-center gap-1 rounded border border-[var(--border-subtle)] bg-transparent px-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
          Tool
          <Select
            value={activeToolLabel === "select" ? "probe" : activeToolLabel}
            onChange={(event) => onToolChange(event.target.value as "select" | "pan" | "probe" | "addPin" | "measureDistance" | "measureAngle" | "draw")}
            className="h-6 border-0 bg-transparent px-1 text-[12px] uppercase"
          >
            <option value="pan">Pan</option>
            <option value="probe">Probe</option>
            <option value="addPin">Pin</option>
            <option value="measureDistance">Distance</option>
            <option value="measureAngle">Angle</option>
            <option value="draw">Sketch</option>
          </Select>
        </label>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 shrink-0 items-center justify-end gap-1.5 overflow-x-auto rounded-md border border-[var(--border-subtle)] bg-transparent px-1.5 py-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => {
            setExamplesDialogError(null);
            setExamplesDialogOpen(true);
          }}
          className="uppercase tracking-wide"
        >
          Examples
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setShareDialogOpen(true)}
          className="uppercase tracking-wide"
        >
          Share
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleExportJson}
          className="uppercase tracking-wide"
        >
          Export
        </Button>
        <div className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-transparent px-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Objects</span>
          <Badge variant="default" className="h-5 rounded">{objectCount}</Badge>
        </div>
        <div
          className={cn(
            "flex h-8 min-w-0 max-w-[220px] shrink-0 items-center gap-1.5 rounded-md border bg-transparent px-2.5",
            autosaveStatus === "error"
              ? "border-rose-500/40"
              : autosaveStatus === "saving"
                ? "border-amber-500/40"
                : autosaveStatus === "saved"
                  ? "border-emerald-500/40"
                  : "border-[var(--border-strong)]"
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Autosave</span>
          <span
            className={cn(
              "shrink-0 text-[11px] font-semibold",
              autosaveStatus === "error"
                ? "text-rose-400"
                : autosaveStatus === "saving"
                  ? "text-amber-400"
                  : autosaveStatus === "saved"
                    ? "text-emerald-400"
                    : "text-[var(--text-secondary)]"
            )}
          >
            {autosaveStatus === "dirty"
              ? "Unsaved"
              : autosaveStatus === "saved"
                ? "Saved"
                : autosaveStatus === "saving"
                  ? "Saving"
                  : autosaveStatus === "error"
                    ? "Error"
                    : "Idle"}
          </span>
          {autosaveError ? (
            <span className="truncate text-[10px] font-medium text-rose-300" title={autosaveError}>{autosaveError}</span>
          ) : null}
        </div>

        <Button
          type="button"
          onClick={onToggleInspector}
          variant={inspectorOpen ? "primary" : "secondary"}
          size="sm"
          className="uppercase tracking-wide"
        >
          Inspector
        </Button>

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
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md border transition-all",
                  themeMenuOpen
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                )}
              >
                {themeMode === "dark" ? <MoonIcon className="h-3.5 w-3.5" /> : <SunIcon className="h-3.5 w-3.5" />}
              </button>
            )}
          </PopoverTrigger>
          <PopoverContent className="w-72">
            <ThemeAccentPopover showPerformance={true} />
          </PopoverContent>
        </Popover>
      </div>

      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Share and export</DialogTitle>
          <DialogDescription>Copy a share URL or trigger existing export actions.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-5 py-4">
          <section className="space-y-2 rounded-[6px] border border-[var(--border-subtle)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Share</p>
            <div className="grid grid-cols-1 gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={handleCopyShareLink}>
                Copy share link
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleCopyCurrentUrl}>
                Copy current URL
              </Button>
            </div>
          </section>
          <Separator />
          <section className="space-y-2 rounded-[6px] border border-[var(--border-subtle)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Export</p>
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={handleExportJson}>
                JSON
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleExport2dSvg}>
                2D SVG
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleExport2dPng}>
                2D PNG
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={handleExport3dPng}>
                3D PNG
              </Button>
            </div>
          </section>
          {actionFeedback ? (
            <div className="rounded-md border border-[var(--border-subtle)] bg-transparent px-3 py-2 text-[11px] text-[var(--text-secondary)]">
              {actionFeedback}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" size="sm" data-autofocus="true" onClick={() => setShareDialogOpen(false)}>
            Close
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
    </>
  );
}

function ToolbarAction({ onClick, disabled, icon, title }: any) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-[var(--text-secondary)] transition-all hover:border-[var(--border-subtle)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-30"
    >
      {icon}
    </button>
  );
}

