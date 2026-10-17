import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ObjectRow from "@/components/objects/ObjectRow";
import ObjectTree from "@/components/objects/ObjectTree";
import { useGraphStore } from "@/store/graphStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import { getCurrentSceneSnapshot } from "@/lib/store/sceneStore";

function renderRow(id: string, index = 0) {
  const object = useGraphStore.getState().scene.objects.find((o) => o.id === id);
  if (!object) {
    throw new Error("object not found");
  }
  const selected = useGraphStore.getState().ui.selectedObjectId === id;
  const utils = render(
    <ObjectRow
      object={object}
      index={index}
      selected={selected}
      onSelect={(nextId) => useGraphStore.getState().selectObject(nextId)}
      onToggleVisibility={(nextId) => useGraphStore.getState().toggleObjectVisibility(nextId)}
    />
  );
  if (screen.queryByRole("textbox", { name: "Equation" }) === null) {
    fireEvent.click(screen.getByRole("button", { name: "Expand definition" }));
  }
  return utils;
}

describe("S14 creation focus contract", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("focuses and expands the new row equation input on request", async () => {
    const state = useGraphStore.getState();
    const id = state.addSurfaceObject();
    state.requestEquationFocus(id);
    renderRow(id);
    const input = screen.getByRole("textbox", { name: "Equation" });
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(useGraphStore.getState().ui.focusEquationForObjectId).toBeNull();
  });

  it("Enter in an equation input inserts the same kind below and hands off focus", async () => {
    const state = useGraphStore.getState();
    const id = state.addSurfaceObject();
    state.updateSurfaceEquation(id, "z = x^2 + y^2");
    renderRow(id);
    const input = screen.getByRole("textbox", { name: "Equation" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Enter" });
    const objects = useGraphStore.getState().scene.objects;
    expect(objects).toHaveLength(2);
    expect(objects[1]?.kind).toBe("surface");
    expect(objects[1]?.id).not.toBe(id);
    // Focus request targets the new row; the mounted row consumes it.
    expect(useGraphStore.getState().ui.focusEquationForObjectId).toBe(objects[1]?.id);
    state.clearEquationFocus();
  });

  it("Escape in an equation input blurs without losing the draft", () => {
    const state = useGraphStore.getState();
    const id = state.addSurfaceObject();
    renderRow(id);
    const input = screen.getByRole("textbox", { name: "Equation" }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "z = x + 1" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(document.activeElement).not.toBe(input);
    expect(useGraphStore.getState().scene.objects[0]).toMatchObject({ equation: "z = x + 1" });
  });
});

describe("S14 object list keyboard navigation", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("moves selection with arrows/Home/End and skips text editing targets", () => {
    const state = useGraphStore.getState();
    const first = state.addSurfaceObject();
    state.addSurfaceObject();
    state.addSurfaceObject();
    render(<ObjectTree />);
    const buttons = screen.getAllByRole("button", { name: /^(Select|Selected) / });
    expect(buttons).toHaveLength(3);
    buttons[0]?.focus();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "ArrowDown" });
    expect(document.activeElement?.getAttribute("aria-label")).toMatch(/^Selected /);
    expect(useGraphStore.getState().ui.selectedObjectId).not.toBe(first);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "End" });
    const ids = useGraphStore.getState().scene.objects.map((o) => o.id);
    expect(useGraphStore.getState().ui.selectedObjectId).toBe(ids[2]);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Home" });
    expect(useGraphStore.getState().ui.selectedObjectId).toBe(ids[0]);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "ArrowUp" });
    expect(useGraphStore.getState().ui.selectedObjectId).toBe(ids[0]);
  });

  it("does not hijack arrows inside equation inputs", () => {
    const state = useGraphStore.getState();
    const id = state.addSurfaceObject();
    state.addSurfaceObject();
    state.selectObject(id);
    render(<ObjectTree />);
    fireEvent.click(screen.getAllByRole("button", { name: "Expand definition" })[0] as HTMLElement);
    const input = screen.getAllByRole("textbox", { name: "Equation" })[0] as HTMLInputElement;
    fireEvent.change(input, { target: { value: "z = x" } });
    input.focus();
    input.setSelectionRange(1, 1);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(useGraphStore.getState().ui.selectedObjectId).toBe(id);
    expect(document.activeElement).toBe(input);
  });
});

describe("S14 delete selection policy and undo coverage", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useHistoryStore.getState().clear();
  });

  it("falls back to next sibling, then previous, then none", () => {
    const state = useGraphStore.getState();
    const first = state.addSurfaceObject();
    const second = state.addSurfaceObject();
    const third = state.addSurfaceObject();
    state.selectObject(second);
    state.removeObject(second);
    expect(useGraphStore.getState().ui.selectedObjectId).toBe(third);
    state.removeObject(third);
    expect(useGraphStore.getState().ui.selectedObjectId).toBe(first);
    state.removeObject(first);
    expect(useGraphStore.getState().ui.selectedObjectId).toBeNull();
  });

  it("history snapshots restore a deleted object", () => {
    const graph = useGraphStore.getState();
    const history = useHistoryStore.getState();
    const id = graph.addSurfaceObject();
    graph.updateSurfaceEquation(id, "z = x^2 + y^2");
    history.pushSnapshot(getCurrentSceneSnapshot());
    useGraphStore.getState().removeObject(id);
    expect(useGraphStore.getState().scene.objects).toHaveLength(0);
    const restored = useHistoryStore.getState().undo(getCurrentSceneSnapshot());
    expect(restored).not.toBeNull();
    expect(restored?.objects.some((o) => o.id === id)).toBe(true);
  });

  it("clears a pending focus request when its object is deleted", () => {
    const state = useGraphStore.getState();
    const id = state.addSurfaceObject();
    state.requestEquationFocus(id);
    state.removeObject(id);
    expect(useGraphStore.getState().ui.focusEquationForObjectId).toBeNull();
  });
});
