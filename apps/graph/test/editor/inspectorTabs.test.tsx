import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import InspectorPanel from "@/components/layout/InspectorPanel";
import { useEditorStore } from "@/lib/store/editorStore";
import { useGraphStore } from "@/store/graphStore";

describe("InspectorPanel tablist", () => {
  beforeEach(() => {
    const state = useGraphStore.getState();
    state.resetScene();
    const id = state.addSurfaceObject();
    state.updateSurfaceEquation(id, "z = x^2 + y^2");
    state.selectObject(id);
  });

  it("exposes Edit/Analyze/Settings tabs with roving tabindex and arrow-key navigation", () => {
    render(<InspectorPanel mode="object" activeToolLabel="Pan" />);
    const tablist = screen.getByRole("tablist", { name: "Inspector sections" });
    expect(tablist).toBeInTheDocument();
    const objectTab = screen.getByRole("tab", { name: "Edit" });
    const analyzeTab = screen.getByRole("tab", { name: "Analyze" });
    const stylesTab = screen.getByRole("tab", { name: "Settings" });
    expect(objectTab).toHaveAttribute("aria-selected", "true");
    expect(stylesTab).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();

    objectTab.focus();
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(analyzeTab).toHaveAttribute("aria-selected", "true");
    expect(analyzeTab).toHaveFocus();

    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(objectTab).toHaveAttribute("aria-selected", "true");
    expect(objectTab).toHaveFocus();

    fireEvent.keyDown(tablist, { key: "End" });
    expect(stylesTab).toHaveAttribute("aria-selected", "true");
    expect(stylesTab).toHaveFocus();

    fireEvent.keyDown(tablist, { key: "Home" });
    expect(objectTab).toHaveAttribute("aria-selected", "true");
    expect(objectTab).toHaveFocus();
  });

  it("shows definition on Object and contextual analysis on Analyze for a surface", () => {
    render(<InspectorPanel mode="object" activeToolLabel="Pan" />);
    // Object tab: expression-first definition with compact domain. Analysis
    // mounts on demand (S32: selection alone starts no analysis compute).
    expect(screen.getByLabelText("Surface expression z = f(x,y)")).toBeVisible();
    expect(screen.getByLabelText("x min")).toBeVisible();
    expect(screen.queryByTestId("integral-analysis-section")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Analyze" }));
    // Analyze tab: differential + scalar + integral for a surface.
    expect(screen.getByTestId("integral-analysis-section")).toBeVisible();
    expect(screen.queryByLabelText("Surface expression z = f(x,y)")).toBeNull();
  });
});

describe("Inspector essential and secondary controls", () => {
  beforeEach(() => {
    useEditorStore.setState({ constraints: [] });
    useGraphStore.getState().resetScene();
    const id = useGraphStore.getState().addSurfaceObject();
    useGraphStore.getState().updateSurfaceEquation(id, "sin(x) * cos(y)");
    useGraphStore.getState().selectObject(id);
  });

  it("keeps three primary workflows and discloses object data only on request", () => {
    render(<InspectorPanel mode="object" />);
    expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["Edit", "Analyze", "Settings"]);
    expect(screen.queryByText("Selected object JSON")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
    expect(screen.getByLabelText("Surface color")).toBeVisible();
    expect(screen.queryByText("Object links")).toBeNull();
    expect(screen.queryByText("Selected object JSON")).toBeNull();
    const details = screen.getByText("Object data").closest("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    expect(screen.getByText("Selected object JSON")).toBeVisible();
    expect(screen.getByRole("button", { name: "Copy JSON" })).toBeVisible();
    details.open = false;
    fireEvent(details, new Event("toggle"));
    expect(screen.queryByText("Selected object JSON")).toBeNull();
  });

  it("shows link tools when another scene object is available", () => {
    const state = useGraphStore.getState();
    const selectedId = state.ui.selectedObjectId!;
    state.addSurfaceObject();
    state.selectObject(selectedId);
    render(<InspectorPanel mode="object" />);
    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
    const details = screen.getByText("Object links").closest("details")!;
    expect(screen.queryByLabelText("Target object")).toBeNull();
    details.open = true;
    fireEvent(details, new Event("toggle"));
    expect(screen.getByLabelText("Target object")).toBeEnabled();
  });

  it("shows tint controls only for color-tint links and labels the real color channels", () => {
    const state = useGraphStore.getState();
    const selectedId = state.ui.selectedObjectId!;
    state.addSurfaceObject();
    state.selectObject(selectedId);
    render(<InspectorPanel mode="object" />);
    fireEvent.click(screen.getByRole("tab", { name: "Settings" }));
    const details = screen.getByText("Object links").closest("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    fireEvent.click(screen.getByRole("button", { name: "Add visibility sync link" }));
    expect(screen.queryByLabelText("Constraint offset")).toBeNull();
    expect(screen.queryByRole("button", { name: "Tint red channel" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Add color tint link" }));
    expect(screen.getByLabelText("Constraint offset")).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Tint red channel" }));
    expect(useEditorStore.getState().constraints.find(constraint => constraint.type === "offset")?.axisLocks.x).toBe(false);
  });

  it("toggles the selected object's visibility without changing its expression", () => {
    render(<InspectorPanel mode="object" />);
    fireEvent.click(screen.getByRole("button", { name: "Hide selected object" }));
    expect(useGraphStore.getState().scene.objects[0]).toMatchObject({ visible: false, equation: "sin(x) * cos(y)" });
    expect(screen.getByText("Explicit surface · Hidden")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Show selected object" }));
    expect(useGraphStore.getState().scene.objects[0].visible).toBe(true);
    expect(screen.getByRole("button", { name: "Hide selected object" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the no-selection state free of orphaned tab labels and inert controls", () => {
    useGraphStore.getState().resetScene();
    render(<InspectorPanel mode="scene" />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tabpanel")).toBeNull();
    expect(screen.queryByRole("button", { name: "Examples" })).toBeNull();
    expect(screen.getByRole("button", { name: "Add Object" })).toBeEnabled();
  });
});
