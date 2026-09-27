// S33 drag history transactions (UI-only).
//
// One drag gesture MUST equal one canonical undo entry (PART 24/57):
// pointermove commits write canonical scene state continuously (so canvas,
// object rows, Inspector, and analysis update live) but must not push
// history per move. This module brackets a drag:
//
//   beginDragTransaction()   — captures the pre-drag snapshot, activates.
//   commitDragTransaction()  — pushes the captured pre-drag snapshot once.
//   cancelDragTransaction()  — restores pre-drag values, pushes nothing.
//
// EditorShell's auto-push effect skips while a transaction is active, and
// global undo/redo/delete are suppressed until the transaction ends
// (PART 78). If the dragged object was deleted mid-drag, cancel/​commit
// clear without restoring (the delete is its own undoable edit).
//
// Generic and bounded: no second history stack, no scene-shape knowledge.

"use client";

import { getCurrentSceneSnapshot } from "@/lib/store/sceneStore";
import { useHistoryStore } from "@/lib/store/historyStore";
import { useGraphStore } from "@/store/graphStore";
import type { SceneSnapshot } from "@/lib/types/scene";

let activeTransaction: { preDrag: SceneSnapshot; objectId: string } | null = null;
// Set when cancel restores pre-drag values through applySceneSnapshot: the
// EditorShell auto-push effect must skip that restore (otherwise the cancel
// itself would pollute history). Consumed once by the shell effect.
let historyActionExpected = false;

export function isDragTransactionActive(): boolean {
  return activeTransaction !== null;
}

/** Consumed by EditorShell's history effect (see above). */
export function consumeHistoryActionFlag(): boolean {
  const value = historyActionExpected;
  historyActionExpected = false;
  return value;
}

export function activeDragTransactionObjectId(): string | null {
  return activeTransaction?.objectId ?? null;
}

/** Capture the pre-drag snapshot. Returns false when a drag is active. */
export function beginDragTransaction(objectId: string): boolean {
  if (activeTransaction !== null) {
    return false;
  }
  activeTransaction = { preDrag: getCurrentSceneSnapshot(), objectId };
  return true;
}

/**
 * End the drag, pushing exactly one undo entry (the pre-drag snapshot) when
 * `dirty` (canonical values changed during the drag). No-op when clean.
 */
export function commitDragTransaction(dirty: boolean): void {
  const transaction = activeTransaction;
  activeTransaction = null;
  if (!transaction || !dirty) {
    return;
  }
  useHistoryStore.getState().pushSnapshot(transaction.preDrag);
}

/**
 * Cancel the drag: restore pre-drag canonical values, push 0 history.
 * When the dragged object no longer exists (deleted mid-drag), clears
 * without restoring so the delete is not resurrected.
 * S33-R8: the shell skip-flag arms only when the restore actually changes
 * state — a clean cancel (no moves) leaves refs identical, so an
 * unconditional flag would go stale and skip the next legitimate edit.
 */
export function cancelDragTransaction(): void {
  const transaction = activeTransaction;
  activeTransaction = null;
  if (!transaction) {
    return;
  }
  const current = getCurrentSceneSnapshot();
  const stillExists = current.objects.some((object) => object.id === transaction.objectId);
  if (!stillExists) {
    return;
  }
  const unchanged =
    current.objects === transaction.preDrag.objects &&
    current.measurements === transaction.preDrag.measurements &&
    current.selection.selectedObjectId === transaction.preDrag.selection.selectedObjectId;
  if (unchanged) {
    return;
  }
  historyActionExpected = true;
  useGraphStore.getState().applySceneSnapshot(transaction.preDrag);
}

/** Test seam: reset module state without touching stores. */
export function resetDragTransactionForTests(): void {
  activeTransaction = null;
  historyActionExpected = false;
}
