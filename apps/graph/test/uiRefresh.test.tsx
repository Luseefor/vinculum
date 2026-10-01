import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ViewControls from "@/components/editor/ViewControls";
import CanvasToolbar from "@/components/editor/CanvasToolbar";
import BottomPanel from "@/components/editor/BottomPanel";
import StatusBar from "@/components/layout/StatusBar";
import WorkspaceSwitcher from "@/components/editor/WorkspaceSwitcher";
import { migrateEditorLayout, useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";

describe("UI refresh: canvas view controls", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useGraphStore.getState().setWorkspace("geometry");
    useEditorStore.getState().setGeometryLayout("single");
  });

  it("renders the Geometry Studio selects wired to editorStore", () => {
    render(<ViewControls />);
    expect(screen.getByTestId("toolbar-geometry-view-select")).toBeInTheDocument();
    const layout = screen.getByTestId("toolbar-geometry-layout-select") as HTMLSelectElement;
    expect(screen.queryByTestId("toolbar-geometry-split-select")).toBeNull();
    fireEvent.change(layout, { target: { value: "split" } });
    expect(useEditorStore.getState().geometryLayout).toBe("split");
    expect(screen.getByTestId("toolbar-geometry-split-select")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "View type" })).toBeNull();
  });

  it("canvas toolbar fits the scene", () => {
    const onFit = vi.fn();
    render(<CanvasToolbar viewControls={{}} onFitScene={onFit} />);
    expect(screen.queryByRole("button", { name: "Frame selected" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Zoom to fit all objects" }));
    expect(onFit).toHaveBeenCalledTimes(1);
  });

  it("keeps workspace switcher names and pressed state", () => {
    render(<WorkspaceSwitcher />);
    expect(screen.getByRole("button", { name: "Geometry Studio" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Math Lab" }));
    expect(useGraphStore.getState().ui.workspace).toBe("math");
  });
});

describe("UI refresh: bottom dock lives behind status bar tabs", () => {
  beforeEach(() => {
    useEditorStore.getState().setBottomPanelCollapsed(true);
    useEditorStore.getState().setBottomPanelTab("parameters");
  });

  it("renders nothing while collapsed", () => {
    const { container } = render(<BottomPanel />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens the chosen tab from the status bar and collapses on a second click", () => {
    render(
      <>
        <BottomPanel />
        <StatusBar />
      </>
    );
    fireEvent.click(screen.getByRole("button", { name: "Parameters" }));
    expect(useEditorStore.getState().bottomPanelCollapsed).toBe(false);
    expect(screen.getByRole("region", { name: "Parameters panel" })).toBeInTheDocument();
    expect(screen.getByLabelText("Parameter r")).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "Console" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "More panels" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Console" }));
    expect(useEditorStore.getState().bottomPanelTab).toBe("console");
    expect(screen.getByRole("button", { name: "Console" })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Console" }));
    expect(useEditorStore.getState().bottomPanelCollapsed).toBe(true);
  });

  it("closes from the panel header", () => {
    useEditorStore.getState().setBottomPanelCollapsed(false);
    render(<BottomPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(useEditorStore.getState().bottomPanelCollapsed).toBe(true);
  });
});

describe("UI refresh: persisted layout migration", () => {
  it("collapses the dock and widens narrow panels from v0 layouts", () => {
    const migrated = migrateEditorLayout(
      { bottomPanelCollapsed: false, leftPanelWidth: 240, rightPanelWidth: 400, rightPanelLastOpenWidth: 400 },
      0
    );
    expect(migrated.bottomPanelCollapsed).toBe(true);
    expect(migrated.leftPanelWidth).toBe(272);
    expect(migrated.rightPanelWidth).toBe(400);
    expect(migrated.rightPanelLastOpenWidth).toBe(400);
  });

  it("leaves current-version state untouched and tolerates garbage", () => {
    expect(migrateEditorLayout({ bottomPanelCollapsed: false }, 1)).toEqual({ bottomPanelCollapsed: false });
    expect(migrateEditorLayout(null, 0)).toEqual({});
  });
});
