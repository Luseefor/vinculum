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

  it("exposes tabs with roving tabindex and arrow-key navigation", () => {
    render(<InspectorPanel mode="object" activeToolLabel="Pan" />);
    const tablist = screen.getByRole("tablist", { name: "Inspector sections" });
    expect(tablist).toBeInTheDocument();
    const propsTab = screen.getByRole("tab", { name: "Props" });
    const stylesTab = screen.getByRole("tab", { name: "Styles" });
    expect(propsTab).toHaveAttribute("aria-selected", "true");
    expect(stylesTab).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tabpanel")).toBeInTheDocument();

    propsTab.focus();
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect(stylesTab).toHaveAttribute("aria-selected", "true");
    expect(stylesTab).toHaveFocus();

    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect(propsTab).toHaveAttribute("aria-selected", "true");
    expect(propsTab).toHaveFocus();

    fireEvent.keyDown(tablist, { key: "End" });
    const advancedTab = screen.getByRole("tab", { name: "Adv" });
    expect(advancedTab).toHaveAttribute("aria-selected", "true");
    expect(advancedTab).toHaveFocus();

    fireEvent.keyDown(tablist, { key: "Home" });
    expect(propsTab).toHaveAttribute("aria-selected", "true");
    expect(propsTab).toHaveFocus();
  });
});
