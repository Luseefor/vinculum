import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ViewControls from "@/components/editor/ViewControls";
import CanvasToolbar from "@/components/editor/CanvasToolbar";
import EditorLayoutPremium from "@/components/editor/EditorLayoutPremium";
import WorkspaceSwitcher from "@/components/editor/WorkspaceSwitcher";
import ObjectBrowserPanel from "@/components/layout/ObjectBrowserPanel";
import { migrateEditorLayout, useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";

describe("object catalog without a permanent quick-add block", () => {
  beforeEach(() => useGraphStore.getState().resetScene());
  it("keeps every kind in Add and returns keyboard focus on Escape", () => {
    render(<ObjectBrowserPanel />);
    expect(screen.queryByText("Quick add")).toBeNull();
    expect(screen.queryByRole("button", { name: "Surface" })).toBeNull();
    const trigger = screen.getByRole("button", { name: "Open object menu" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Surface" })).toBeVisible();
    fireEvent.keyDown(screen.getByRole("button", { name: "Surface" }), { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Surface" }));
    expect(useGraphStore.getState().scene.objects).toHaveLength(1);
    expect(useGraphStore.getState().scene.objects[0]?.kind).toBe("surface");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

describe("searchable object picker", () => {
  beforeEach(() => useGraphStore.getState().resetScene());
  it("filters examples, clears empty results, and creates the chosen real object", () => {
    render(<ObjectBrowserPanel />);
    const trigger = screen.getByRole("button", { name: "Open object menu" });
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Add to graph" })).toBeVisible();
    const search = screen.getByRole("searchbox", { name: "Search objects" });
    expect(search).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Geometry" }));
    expect(screen.getByRole("button", { name: "Point" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Implicit Torus" })).toBeNull();
    fireEvent.change(search, { target: { value: "torus" } });
    expect(screen.getByText(/No objects match/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Examples" }));
    fireEvent.change(search, { target: { value: "torus" } });
    fireEvent.click(screen.getByRole("button", { name: "Implicit Torus" }));
    expect(useGraphStore.getState().scene.objects[0]?.kind).toBe("implicitSurface");
    expect(screen.queryByRole("dialog", { name: "Add to graph" })).toBeNull();
  });
});

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

describe("canvas layout without a bottom dock", () => {
  it("does not restore obsolete panels from an open saved dock", () => {
    useEditorStore.getState().setBottomPanelCollapsed(false);
    useEditorStore.getState().setBottomPanelTab("parameters");
    const { container } = render(<EditorLayoutPremium header={<header>Header</header>} sceneNavigator={<aside>Objects</aside>} workspace={<div>Graph</div>} inspectorDrawer={null} />);
    expect(screen.getByRole("main")).toHaveTextContent("Graph");
    expect(container.querySelector("footer, .bottom-dock, .divider-y")).toBeNull();
    expect(screen.queryByRole("button", { name: "More panels" })).toBeNull();
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


describe("equation entry continuity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGraphStore.getState().resetScene();
  });
  afterEach(() => vi.useRealTimers());

  it("keeps the draft mounted while previewing, then finalizes into an inline equation", () => {
    render(<ObjectBrowserPanel />);
    const draft = screen.getByLabelText("New equation");
    expect(screen.queryByText("No objects in scene.")).toBeNull();
    draft.focus();
    fireEvent.change(draft, { target: { value: "y=x^2" } });
    act(() => vi.advanceTimersByTime(350));
    expect(screen.getByLabelText("New equation")).toBe(draft);
    expect(draft).toHaveFocus();
    expect(screen.queryByLabelText("Equation")).toBeNull();
    fireEvent.keyDown(draft, { key: "Enter" });
    expect(screen.getByLabelText("Equation")).toHaveValue("y=x^2");
    expect(screen.queryByText("Definition")).toBeNull();
    expect(screen.getByLabelText("New equation")).toBe(draft);
    expect(draft).toHaveFocus();
    expect(draft).toHaveValue("");
    expect(useGraphStore.getState().scene.objects).toHaveLength(1);
  });

  it("uses inline editing for Add and keeps focus when the equation changes dimension", () => {
    render(<ObjectBrowserPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Open object menu" }));
    fireEvent.click(screen.getByRole("button", { name: "Empty expression" }));
    const input = screen.getByLabelText("Equation");
    expect(input).toHaveFocus();
    expect(screen.queryByText("Definition")).toBeNull();
    for (const equation of ["x=y^2", "x=y^2+z^2", "x=y^2"]) {
      fireEvent.change(input, { target: { value: equation } });
      act(() => vi.advanceTimersByTime(350));
      expect(screen.getByLabelText("Equation")).toBe(input);
      expect(input).toHaveFocus();
    }
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getAllByLabelText("Equation")[1]).toHaveFocus();
    expect(useGraphStore.getState().scene.objects).toHaveLength(2);
  });

  it("keeps MathLive navigation keys inside the equation editor", () => {
    useGraphStore.getState().commitAutoEquation("y=x");
    const second = useGraphStore.getState().commitAutoEquation("y=x^2").id;
    render(<ObjectBrowserPanel />);
    const field = document.createElement("math-field");
    screen.getAllByLabelText("Equation")[1].parentElement!.appendChild(field);
    fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(useGraphStore.getState().ui.selectedObjectId).toBe(second);
  });

  it("waits for completion before revealing the finder at six objects", () => {
    for (let index = 0; index < 5; index++) useGraphStore.getState().commitAutoEquation(`y=x+${index}`);
    render(<ObjectBrowserPanel />);
    const draft = screen.getByLabelText("New equation");
    fireEvent.change(draft, { target: { value: "y=x+5" } });
    act(() => vi.advanceTimersByTime(350));
    expect(screen.queryByRole("group", { name: "Object list filter" })).toBeNull();
    fireEvent.keyDown(draft, { key: "Enter" });
    expect(screen.getByRole("group", { name: "Object list filter" })).toBeVisible();
  });
});
