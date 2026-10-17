// S33 drag history transactions: one drag = one undo; cancel = zero
// history with exact pre-drag restore; delete mid-drag never resurrects.

import { beforeEach, describe, expect, it } from "vitest";
import { useGraphStore } from "@/store/graphStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import { getCurrentSceneSnapshot } from "@/lib/store/sceneStore";
import {
  beginDragTransaction,
  cancelDragTransaction,
  commitDragTransaction,
  consumeHistoryActionFlag,
  isDragTransactionActive,
  resetDragTransactionForTests
} from "@/lib/interaction/dragHistoryTransaction";

function resetAll() {
  resetDragTransactionForTests();
  useGraphStore.getState().resetScene();
  useHistoryStore.getState().clear();
}

function addPoint(x: string, y: string, z: string): string {
  const store = useGraphStore.getState();
  const id = store.addPointObject();
  store.updateGeometryCoordinate(id, "xExpr", x);
  store.updateGeometryCoordinate(id, "yExpr", y);
  store.updateGeometryCoordinate(id, "zExpr", z);
  useHistoryStore.getState().clear();
  return id;
}

function pointExpressions(id: string): [string, string, string] {
  const object = useGraphStore.getState().scene.objects.find((candidate) => candidate.id === id);
  if (!object || object.kind !== "point") {
    throw new Error("point missing");
  }
  return [object.xExpr, object.yExpr, object.zExpr];
}

describe("dragHistoryTransaction", () => {
  beforeEach(() => {
    resetAll();
  });

  it("begin captures pre-drag state and reports active", () => {
    const id = addPoint("1", "2", "3");
    expect(isDragTransactionActive()).toBe(false);
    expect(beginDragTransaction(id)).toBe(true);
    expect(isDragTransactionActive()).toBe(true);
    // Nested begins refuse (no stacked transactions).
    expect(beginDragTransaction(id)).toBe(false);
  });

  it("many moves + one commit = exactly one undo entry restoring originals", () => {
    const id = addPoint("1", "2", "3");
    expect(beginDragTransaction(id)).toBe(true);
    const store = useGraphStore.getState();
    for (const x of ["1.1", "1.2", "1.3", "1.4", "1.5"]) {
      store.updateGeometryCoordinate(id, "xExpr", x);
      store.updateGeometryCoordinate(id, "yExpr", "2");
    }
    expect(pointExpressions(id)).toEqual(["1.5", "2", "3"]);
    commitDragTransaction(true);
    expect(isDragTransactionActive()).toBe(false);
    expect(useHistoryStore.getState().past.length).toBe(1);
    // Undo restores the exact pre-drag raw expressions.
    const undone = useHistoryStore.getState().undo(getCurrentSceneSnapshot());
    expect(undone).not.toBeNull();
    useGraphStore.getState().applySceneSnapshot(undone!);
    expect(pointExpressions(id)).toEqual(["1", "2", "3"]);
    // Redo restores the final drag state.
    const redone = useHistoryStore.getState().redo(getCurrentSceneSnapshot());
    expect(redone).not.toBeNull();
    useGraphStore.getState().applySceneSnapshot(redone!);
    expect(pointExpressions(id)).toEqual(["1.5", "2", "3"]);
  });

  it("clean commit (nothing changed) pushes zero history", () => {
    const id = addPoint("1", "2", "3");
    expect(beginDragTransaction(id)).toBe(true);
    commitDragTransaction(false);
    expect(useHistoryStore.getState().past.length).toBe(0);
  });

  it("cancel restores exact pre-drag values with zero history", () => {
    const id = addPoint("1", "2", "3");
    expect(beginDragTransaction(id)).toBe(true);
    const store = useGraphStore.getState();
    store.updateGeometryCoordinate(id, "xExpr", "9");
    store.updateGeometryCoordinate(id, "yExpr", "8");
    cancelDragTransaction();
    expect(isDragTransactionActive()).toBe(false);
    expect(pointExpressions(id)).toEqual(["1", "2", "3"]);
    expect(useHistoryStore.getState().past.length).toBe(0);
  });

  it("cancel after mid-drag delete clears without resurrecting the object", () => {
    const id = addPoint("1", "2", "3");
    expect(beginDragTransaction(id)).toBe(true);
    useGraphStore.getState().updateGeometryCoordinate(id, "xExpr", "9");
    useGraphStore.getState().removeObject(id);
    cancelDragTransaction();
    expect(isDragTransactionActive()).toBe(false);
    expect(
      useGraphStore.getState().scene.objects.find((candidate) => candidate.id === id)
    ).toBeUndefined();
    expect(useHistoryStore.getState().past.length).toBe(0);
  });

  it("cancel arms the shell history-skip flag exactly once", () => {
    const id = addPoint("1", "2", "3");
    expect(beginDragTransaction(id)).toBe(true);
    useGraphStore.getState().updateGeometryCoordinate(id, "xExpr", "9");
    expect(consumeHistoryActionFlag()).toBe(false);
    cancelDragTransaction();
    // The EditorShell auto-push effect must skip the cancel restore.
    expect(consumeHistoryActionFlag()).toBe(true);
    expect(consumeHistoryActionFlag()).toBe(false);
  });

  it("clean cancel (no moves) arms no flag and applies nothing", () => {
    const id = addPoint("1", "2", "3");
    expect(beginDragTransaction(id)).toBe(true);
    // S33-R8: identical refs mean the restore would be a no-op, so the
    // shell must not skip the next legitimate edit.
    cancelDragTransaction();
    expect(consumeHistoryActionFlag()).toBe(false);
    expect(pointExpressions(id)).toEqual(["1", "2", "3"]);
    expect(useHistoryStore.getState().past.length).toBe(0);
  });
});
