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
import { useDialogFocusTrap } from "@/lib/a11y/useDialogFocusTrap";
import {
  applySceneExampleToEditor
} from "@/lib/templates/applySceneExample";
import {
  createValidatedSceneExample,
  getSceneExampleById,
  SCENE_EXAMPLES
} from "@/lib/templates/examplesRegistry";
import { useGraphStore } from "@/store/graphStore";
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
import { Portal } from "@/components/ui/portal";
import type { AccentPreset } from "@/types/graphUi";

const accentOptions: AccentPreset[] = ["indigo", "blue", "cyan", "emerald", "green", "amber", "orange", "rose", "pink", "violet"];

export default function TopToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenWelcome,
  openExamplesSignal = 0
}: {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenWelcome?: () => void;
  openExamplesSignal?: number;
}) {
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [newSceneOpen, setNewSceneOpen] = useState(false);
  const [projectDialogMode, setProjectDialogMode] = useState<"saveAs" | "open" | null>(null);
  const [projectDialogError, setProjectDialogError] = useState<string | null>(null);
  const [examplesDialogOpen, setExamplesDialogOpen] = useState(false);
  const [examplesDialogError, setExamplesDialogError] = useState<string | null>(null);
  const [pendingExampleId, setPendingExampleId] = useState<string | null>(null);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
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
  const fileTriggerRef = useRef<HTMLButtonElement>(null);
  const themeTriggerRef = useRef<HTMLButtonElement>(null);
  const fileMenuContainerRef = useRef<HTMLDivElement>(null);
  const themeMenuContainerRef = useRef<HTMLDivElement>(null);
  const lastOpenExamplesSignalRef = useRef(openExamplesSignal);

  useDialogFocusTrap({ open: fileMenuOpen, containerRef: fileMenuContainerRef });
  useDialogFocusTrap({ open: themeMenuOpen, containerRef: themeMenuContainerRef });

  const scene = useGraphStore((state) => state.scene);
  const objectCount = useGraphStore((state) => state.scene.objects.length);
  const themeMode = useGraphStore((state) => state.ui.themeMode);
  const setThemeMode = useGraphStore((state) => state.setThemeMode);
  const accentPreset = useGraphStore((state) => state.ui.accentPreset);
  const setAccentPreset = useGraphStore((state) => state.setAccentPreset);
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
  const setShowPerfHud = useEditorStore((state) => state.setShowPerfHud);
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
      setShareMessage(shareResult.error ?? "Share link failed. Use JSON export instead.");
      setFileMenuOpen(false);
      return;
    }

    try {
      await navigator.clipboard.writeText(shareResult.url);
      setShareMessage("Share link copied.");
    } catch {
      setShareMessage("Share link copy failed. Copy the URL from the browser bar.");
    }
    setFileMenuOpen(false);
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
      setExportMessage(exported.error ?? "JSON export failed.");
      setFileMenuOpen(false);
      return;
    }
    const download = triggerSceneExportDownload(exported.file);
    setExportMessage(download.ok ? "Export JSON downloaded." : download.error ?? "JSON download failed.");
    setFileMenuOpen(false);
  };

  const handleExport2dPng = async () => {
    if (graphMode !== "2d") {
      setExportMessage("Switch to 2D mode to export 2D PNG.");
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
      setExportMessage(exported.error ?? "2D PNG export failed.");
      setFileMenuOpen(false);
      return;
    }
    const download = triggerSceneExportDownload(exported.file);
    setExportMessage(download.ok ? "Export 2D PNG downloaded." : download.error ?? "2D PNG download failed.");
    setFileMenuOpen(false);
  };

  const handleExport2dSvg = () => {
    if (graphMode !== "2d") {
      setExportMessage("Switch to 2D mode to export 2D SVG.");
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
      setExportMessage(exported.error ?? "2D SVG export failed.");
      setFileMenuOpen(false);
      return;
    }
    const download = triggerSceneExportDownload(exported.file);
    if (!download.ok) {
      setExportMessage(download.error ?? "2D SVG download failed.");
      setFileMenuOpen(false);
      return;
    }
    setExportMessage(
      exported.file.warnings && exported.file.warnings.length > 0
        ? "Export 2D SVG downloaded with some unsupported objects skipped."
        : "Export 2D SVG downloaded."
    );
    setFileMenuOpen(false);
  };

  const handleExport3dPng = async () => {
    if (graphMode !== "3d") {
      setExportMessage("Switch to 3D mode to export 3D PNG.");
      setFileMenuOpen(false);
      return;
    }
    const canvas = document.querySelector<HTMLCanvasElement>(`[data-graph3d-canvas="true"]`);
    const exported = await export3dPngFromCanvas({
      canvas,
      sceneName: scene.metadata.name
    });
    if (!exported.ok || !exported.file) {
      setExportMessage(exported.error ?? "3D PNG export failed.");
      setFileMenuOpen(false);
      return;
    }
    const download = triggerSceneExportDownload(exported.file);
    setExportMessage(download.ok ? "Export 3D PNG downloaded." : download.error ?? "3D PNG download failed.");
    setFileMenuOpen(false);
  };

  // Robust click-outside logic for Portals
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // Check if click was inside a portal container
      const isInsidePortal = target.closest('[data-portal-content="true"]');
      if (isInsidePortal) return;

      // Close menus if clicking outside of their respective triggers
      if (fileMenuOpen && !fileTriggerRef.current?.contains(target)) {
        setFileMenuOpen(false);
      }
      if (themeMenuOpen && !themeTriggerRef.current?.contains(target)) {
        setThemeMenuOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [fileMenuOpen, themeMenuOpen]);

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
    if (!themeMenuOpen && !fileMenuOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setThemeMenuOpen(false);
        setFileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [themeMenuOpen, fileMenuOpen]);

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
      <header className="flex h-11 shrink-0 items-center border-b border-[var(--panel-border)] bg-[var(--bg-tertiary)] px-4 z-50 font-sans">
      <div className="flex items-center gap-2 mr-6">
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
            className="h-7 w-auto object-contain"
            priority
            onError={() => setShowBrandImageFallback(true)}
          />
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          ref={fileTriggerRef}
          type="button"
          onClick={() => setFileMenuOpen((v) => !v)}
          aria-expanded={fileMenuOpen}
          aria-controls="vinculum-scene-menu"
          aria-haspopup="menu"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              setFileMenuOpen((v) => !v);
            }
          }}
          className={cn(
            "flex items-center gap-1.5 h-7 px-3 rounded-full text-[10px] font-bold uppercase transition-all",
            fileMenuOpen ? "bg-[var(--surface-muted)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
          )}
        >
          Scene
          <ChevronDownIcon className={cn("h-3 w-3 transition-transform", fileMenuOpen && "rotate-180")} />
        </button>

        <div className="w-px h-4 bg-[var(--border-strong)] mx-2" />

        <div className="flex items-center gap-0.5">
          <ToolbarAction onClick={onUndo} disabled={!canUndo} icon={<UndoIcon className="h-3.5 w-3.5" />} title="Undo" />
          <ToolbarAction onClick={onRedo} disabled={!canRedo} icon={<RedoIcon className="h-3.5 w-3.5" />} title="Redo" />
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-1 shadow-sm">
          <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Objects</span>
          <span className="text-[9px] font-bold text-[var(--accent)]">{objectCount}</span>
        </div>
        {shareMessage ? (
          <div className="flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-1 shadow-sm">
            <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Share</span>
            <span className="max-w-56 truncate text-[9px] font-semibold text-[var(--accent)]">{shareMessage}</span>
          </div>
        ) : null}
        {exportMessage ? (
          <div className="flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-1 shadow-sm">
            <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Export</span>
            <span className="max-w-56 truncate text-[9px] font-semibold text-[var(--accent)]">{exportMessage}</span>
          </div>
        ) : null}
        <div className="flex items-center gap-2 rounded-full border border-[var(--border-strong)] bg-[var(--bg-primary)] px-3 py-1 shadow-sm">
          <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">Autosave</span>
          <span className="text-[9px] font-bold text-[var(--accent)]">
            {autosaveStatus === "error" ? "ERROR" : autosaveStatus.toUpperCase()}
          </span>
          {autosaveError ? (
            <span className="max-w-40 truncate text-[9px] font-medium text-amber-400" title={autosaveError}>
              {autosaveError}
            </span>
          ) : null}
        </div>

        <button
          ref={themeTriggerRef}
          type="button"
          aria-label="Open theme and accent menu"
          aria-expanded={themeMenuOpen}
          aria-controls="vinculum-theme-menu"
          aria-haspopup="menu"
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              setThemeMenuOpen((v) => !v);
            }
          }}
          onClick={() => setThemeMenuOpen((v) => !v)}
          className={cn(
            "flex items-center justify-center h-7 w-7 rounded-full transition-all",
            themeMenuOpen ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
          )}
        >
          {themeMode === "dark" ? <MoonIcon className="h-3.5 w-3.5" /> : <SunIcon className="h-3.5 w-3.5" />}
        </button>
      </div>

      {fileMenuOpen && (
        <Portal>
          <div
            id="vinculum-scene-menu"
            ref={fileMenuContainerRef}
            data-portal-content="true"
            role="menu"
            aria-label="Scene menu"
            className="fixed z-[100] w-44 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-overlay)] shadow-2xl backdrop-blur-xl animate-slide-up"
            style={{
              top: (fileTriggerRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
              left: (fileTriggerRef.current?.getBoundingClientRect().left ?? 0)
            }}
          >
            <div className="p-1 flex flex-col gap-0.5">
              <MenuButton onClick={handleNewSceneMenuClick}>New Scene</MenuButton>
              <MenuButton onClick={handleSaveProject}>Save project</MenuButton>
              <MenuButton
                onClick={() => {
                  setProjectDialogError(null);
                  setProjectDialogMode("saveAs");
                  setFileMenuOpen(false);
                }}
              >
                Save as...
              </MenuButton>
              <MenuButton
                onClick={() => {
                  setProjectDialogError(null);
                  setProjectDialogMode("open");
                  setFileMenuOpen(false);
                }}
              >
                Open project...
              </MenuButton>
              <MenuButton
                onClick={() => {
                  setExamplesDialogError(null);
                  setExamplesDialogOpen(true);
                  setFileMenuOpen(false);
                }}
              >
                Open example...
              </MenuButton>
              <MenuButton
                onClick={() => {
                  onOpenWelcome?.();
                  setFileMenuOpen(false);
                }}
              >
                Welcome / getting started
              </MenuButton>
              <MenuButton onClick={() => { openSceneDialog("import"); setFileMenuOpen(false); }}>Import...</MenuButton>
              <MenuButton onClick={handleExportJson}>Export JSON</MenuButton>
              <MenuButton onClick={handleExport2dPng}>Export 2D PNG</MenuButton>
              <MenuButton onClick={handleExport2dSvg}>Export 2D SVG</MenuButton>
              <MenuButton onClick={handleExport3dPng}>Export 3D PNG</MenuButton>
              <MenuButton onClick={handleCopyShareLink}>Copy share link</MenuButton>
            </div>
          </div>
        </Portal>
      )}

      {themeMenuOpen && (
        <Portal>
          <div
            id="vinculum-theme-menu"
            ref={themeMenuContainerRef}
            data-portal-content="true"
            role="menu"
            aria-label="Theme and accent menu"
            className="fixed z-[100] w-64 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface-overlay)] shadow-2xl backdrop-blur-xl animate-slide-up p-4 flex flex-col gap-6"
            style={{
              top: (themeTriggerRef.current?.getBoundingClientRect().bottom ?? 0) + 8,
              right: window.innerWidth - (themeTriggerRef.current?.getBoundingClientRect().right ?? 0)
            }}
          >
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Appearance</h3>
              <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--bg-primary)] border border-[var(--border-strong)]">
                <button
                  type="button"
                  aria-label="Use light theme"
                  onClick={() => setThemeMode("light")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 h-7 rounded-full text-[10px] font-bold transition",
                    themeMode === "light" ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <SunIcon className="h-3.5 w-3.5" /> LIGHT
                </button>
                <button
                  type="button"
                  aria-label="Use dark theme"
                  onClick={() => setThemeMode("dark")}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 h-7 rounded-full text-[10px] font-bold transition",
                    themeMode === "dark" ? "bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-sm" : "text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
                  )}
                >
                  <MoonIcon className="h-3.5 w-3.5" /> DARK
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Accent Color</h3>
              <div className="grid grid-cols-5 gap-3 justify-items-center">
                {accentOptions.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setAccentPreset(preset)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-all hover:scale-125 active:scale-90",
                      accentPreset === preset ? "border-[var(--text-primary)] ring-2 ring-[var(--accent-primary)]/20 shadow-md" : "border-transparent opacity-80 hover:opacity-100"
                    )}
                    style={{ backgroundColor: `var(--clr-${preset})` }}
                    aria-label={`Accent ${preset}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-tertiary)] mb-3">Performance</h3>
              <button
                type="button"
                role="checkbox"
                aria-checked={showPerfHud}
                onClick={() => setShowPerfHud(!showPerfHud)}
                className={cn(
                  "flex items-center justify-between gap-3 w-full h-8 px-3 rounded-full border text-[10px] font-bold transition",
                  showPerfHud
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                )}
              >
                <span>Performance HUD</span>
                <span className="font-mono">{showPerfHud ? "ON" : "OFF"}</span>
              </button>
            </div>
          </div>
        </Portal>
      )}
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
      className="flex items-center justify-center h-7 w-7 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
    >
      {icon}
    </button>
  );
}

function MenuButton({ children, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center px-3 py-1.5 text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-soft)] rounded-md transition-all uppercase tracking-tight"
    >
      {children}
    </button>
  );
}
