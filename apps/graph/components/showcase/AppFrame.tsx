"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import NewSceneDialog from "@/components/layout/NewSceneDialog";
import SceneImportExportDialog from "@/components/scene/SceneImportExportDialog";
import ThemeSync from "@/components/theme/ThemeSync";
import BottomPanel from "@/components/showcase/BottomPanel";
import InspectorEmptyState from "@/components/showcase/InspectorEmptyState";
import LeftRail from "@/components/showcase/LeftRail";
import ScenePanel from "@/components/showcase/ScenePanel";
import SplitWorkspace from "@/components/showcase/SplitWorkspace";
import StatusBar from "@/components/showcase/StatusBar";
import TopCommandBar from "@/components/showcase/TopCommandBar";
import WorkspaceTabs from "@/components/showcase/WorkspaceTabs";
import { useEditorStore } from "@/lib/store/editorStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import { useGraphStore } from "@/store/graphStore";

export default function AppFrame() {
  const frameRef = useRef<HTMLDivElement>(null);
  const [newSceneOpen, setNewSceneOpen] = useState(false);
  const [activeRail, setActiveRail] = useState("select");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);

  const graphMode = useGraphStore((state) => state.ui.graphMode);
  const setGraphMode = useGraphStore((state) => state.setGraphMode);
  const canvas2dTool = useGraphStore((state) => state.ui.canvas2dTool);
  const canvas3dTool = useGraphStore((state) => state.ui.canvas3dTool);
  const setCanvas2dTool = useGraphStore((state) => state.setCanvas2dTool);
  const setCanvas3dTool = useGraphStore((state) => state.setCanvas3dTool);
  const snapEnabled = useGraphStore((state) => state.ui.snapEnabled);
  const snapStep = useGraphStore((state) => state.ui.snapStep);
  const setSnapEnabled = useGraphStore((state) => state.setSnapEnabled);
  const setSnapStep = useGraphStore((state) => state.setSnapStep);
  const themeMode = useGraphStore((state) => state.ui.themeMode);
  const setThemeMode = useGraphStore((state) => state.setThemeMode);
  const accentPreset = useGraphStore((state) => state.ui.accentPreset);
  const setAccentPreset = useGraphStore((state) => state.setAccentPreset);
  const density = useGraphStore((state) => state.ui.density);
  const setDensity = useGraphStore((state) => state.setDensity);
  const addSurfaceObject = useGraphStore((state) => state.addSurfaceObject);
  const addParametricCurve = useGraphStore((state) => state.addParametricCurve);
  const addPlaneObject = useGraphStore((state) => state.addPlaneObject);
  const openSceneDialog = useGraphStore((state) => state.openSceneDialog);
  const resetScene = useGraphStore((state) => state.resetScene);
  const requestCameraReset = useGraphStore((state) => state.requestCameraReset);
  const sceneObjectCount = useGraphStore((state) => state.scene.objects.length);

  const clearHistory = useHistoryStore((state) => state.clear);

  const viewportMode = useEditorStore((state) => state.viewportMode);
  const setViewportMode = useEditorStore((state) => state.setViewportMode);
  const bottomPanelHeight = useEditorStore((state) => state.bottomPanelHeight);
  const setBottomPanelHeight = useEditorStore((state) => state.setBottomPanelHeight);

  const workspaceMode = useMemo<"split" | "quad" | "single">(() => {
    if (viewportMode === "split") {
      return "split";
    }
    if (viewportMode === "quad") {
      return "quad";
    }
    return "single";
  }, [viewportMode]);

  const activeTool = graphMode === "2d" ? canvas2dTool : canvas3dTool;
  const showcaseTool: "pan" | "probe" | "draw" =
    activeTool === "pan" || activeTool === "probe" || activeTool === "draw" ? activeTool : "pan";

  useEffect(() => {
    setViewportMode("split");
    setGraphMode("3d");
  }, [setGraphMode, setViewportMode]);

  useEffect(() => {
    const node = frameRef.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 1280;
      setRightCollapsed(width < 1100);
      setLeftCollapsed(width < 900);
      setBottomCollapsed(width < 700);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handleToolChange = useCallback(
    (tool: "pan" | "probe" | "draw") => {
      setCanvas2dTool(tool);
      setCanvas3dTool(tool);
    },
    [setCanvas2dTool, setCanvas3dTool]
  );

  const handleNewScene = useCallback(() => {
    if (sceneObjectCount <= 1) {
      clearHistory();
      resetScene();
      return;
    }
    setNewSceneOpen(true);
  }, [clearHistory, resetScene, sceneObjectCount]);

  const handleConfirmNewScene = useCallback(() => {
    clearHistory();
    resetScene();
    setNewSceneOpen(false);
  }, [clearHistory, resetScene]);

  const startBottomResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const root = frameRef.current;
      if (!root) {
        return;
      }
      const bounds = root.getBoundingClientRect();
      const onMove = (moveEvent: PointerEvent) => {
        const nextHeight = bounds.bottom - moveEvent.clientY - 30;
        if (nextHeight < 70) {
          setBottomCollapsed(true);
          return;
        }
        setBottomCollapsed(false);
        setBottomPanelHeight(nextHeight);
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [setBottomPanelHeight]
  );

  return (
    <div ref={frameRef} className="app-frame">
      <ThemeSync />

      <NewSceneDialog open={newSceneOpen} onConfirm={handleConfirmNewScene} onCancel={() => setNewSceneOpen(false)} />

      <TopCommandBar
        mode={graphMode}
        onModeChange={setGraphMode}
        tool={showcaseTool}
        onToolChange={handleToolChange}
        snapEnabled={snapEnabled}
        onSnapEnabledChange={setSnapEnabled}
        snapStep={snapStep}
        onSnapStepChange={setSnapStep}
        viewportMode={workspaceMode}
        onViewportModeChange={(mode) => {
          if (mode === "split") {
            setViewportMode("split");
            return;
          }
          if (mode === "quad") {
            setViewportMode("quad");
            return;
          }
          setViewportMode(graphMode);
        }}
        themeMode={themeMode}
        onThemeModeChange={setThemeMode}
        density={density}
        onDensityChange={setDensity}
        accentPreset={accentPreset}
        onAccentPresetChange={setAccentPreset}
        onNewScene={handleNewScene}
        onImportScene={() => openSceneDialog("import")}
        onExportScene={() => openSceneDialog("export")}
        onResetView={requestCameraReset}
      />

      <div className="app-frame-main">
        <LeftRail activeId={activeRail} onSelect={setActiveRail} />

        {!leftCollapsed ? (
          <ScenePanel
            onAddSurface={addSurfaceObject}
            onAddCurve={addParametricCurve}
            onAddSphere={addSurfaceObject}
            onAddCylinder={addPlaneObject}
            onAddPlane={addPlaneObject}
            onAddPoint={addParametricCurve}
          />
        ) : null}

        <section className="workspace-area" aria-label="Workspace">
          <WorkspaceTabs
            mode={workspaceMode}
            onModeChange={(mode) => {
              if (mode === "split") {
                setViewportMode("split");
                return;
              }
              if (mode === "quad") {
                setViewportMode("quad");
                return;
              }
              setViewportMode(graphMode);
            }}
          />
          <SplitWorkspace mode={workspaceMode} snapStep={snapStep} toolLabel={activeTool === "draw" ? "Sketch" : activeTool === "probe" ? "Probe" : "Pan"} />
        </section>

        {!rightCollapsed ? <InspectorEmptyState /> : null}
      </div>

      <BottomPanel
        collapsed={bottomCollapsed}
        height={bottomPanelHeight}
        onResizeStart={startBottomResize}
        onHandleDoubleClick={() => setBottomCollapsed((value) => !value)}
      />

      <StatusBar snapStep={snapStep} />
      <SceneImportExportDialog />
    </div>
  );
}
