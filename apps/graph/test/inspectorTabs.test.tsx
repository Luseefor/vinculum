import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import InspectorPanel from "@/components/layout/InspectorPanel";
import { useGraphStore } from "@/store/graphStore";

describe("InspectorPanel tablist", () => {
  beforeEach(() => {
    const state = useGraphStore.getState();
    state.resetScene();
    const id = state.addSurfaceObject();
    state.updateSurfaceEquation(id, "z = x^2 + y^2");
    state.selectObject(id);
  });

  it("exposes Object/Analyze/Styles/Links/Adv tabs with roving tabindex and arrow-key navigation", () => {
    render(<InspectorPanel mode="object" activeToolLabel="Pan" />);
    const tablist = screen.getByRole("tablist", { name: "Inspector sections" });
    expect(tablist).toBeInTheDocument();
    const objectTab = screen.getByRole("tab", { name: "Object" });
    const analyzeTab = screen.getByRole("tab", { name: "Analyze" });
    const stylesTab = screen.getByRole("tab", { name: "Styles" });
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
    const advancedTab = screen.getByRole("tab", { name: "Adv" });
    expect(advancedTab).toHaveAttribute("aria-selected", "true");
    expect(advancedTab).toHaveFocus();

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
