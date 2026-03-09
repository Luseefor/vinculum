"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GraphObject, GraphObjectKind } from "@vinculum/scene/types";
import { ui } from "@/components/ui/styles";
import { useGraphStore } from "@/store/graphStore";
import type { ExpressionFocusDirection, ExpressionRemoveReason } from "@/types/graphUi";
import ExpressionRow from "./ExpressionRow";

export default function ExpressionList() {
  const objects = useGraphStore((state) => state.scene.objects);
  const selectedObjectId = useGraphStore((state) => state.ui.selectedObjectId);
  const selectObject = useGraphStore((state) => state.selectObject);
  const insertObjectAfter = useGraphStore((state) => state.insertObjectAfter);
  const removeObject = useGraphStore((state) => state.removeObject);

  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const inputRegistryRef = useRef<Map<string, HTMLInputElement>>(new Map());

  const registerInputRef = useCallback((id: string, node: HTMLInputElement | null) => {
    if (node) {
      inputRegistryRef.current.set(id, node);
      return;
    }

    inputRegistryRef.current.delete(id);
  }, []);

  const focusInputById = useCallback((id: string) => {
    const nextInput = inputRegistryRef.current.get(id);
    if (!nextInput) {
      return false;
    }

    nextInput.focus();
    const position = nextInput.value.length;
    nextInput.setSelectionRange(position, position);
    return true;
  }, []);

  useEffect(() => {
    if (!pendingFocusId) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const focused = focusInputById(pendingFocusId);
      if (focused) {
        setPendingFocusId(null);
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [focusInputById, pendingFocusId, objects]);

  const focusAdjacentInput = useCallback(
    (currentId: string, direction: ExpressionFocusDirection) => {
      const currentIndex = objects.findIndex((object) => object.id === currentId);
      if (currentIndex === -1) {
        return;
      }

      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      const targetId = objects[targetIndex]?.id;
      if (!targetId) {
        return;
      }

      focusInputById(targetId);
    },
    [focusInputById, objects]
  );

  const insertBelow = useCallback(
    (id: string, kind: GraphObjectKind) => {
      const createdId = insertObjectAfter(id, kind);
      if (createdId) {
        setPendingFocusId(createdId);
      }
    },
    [insertObjectAfter]
  );

  const removeRow = useCallback(
    (id: string, reason: ExpressionRemoveReason) => {
      if (reason === "keyboard" && objects.length <= 1) {
        return;
      }

      const index = objects.findIndex((object) => object.id === id);
      if (index === -1) {
        return;
      }

      const fallbackFocusId = objects[index + 1]?.id ?? objects[index - 1]?.id ?? null;
      removeObject(id);

      if (fallbackFocusId) {
        setPendingFocusId(fallbackFocusId);
      }
    },
    [objects, removeObject]
  );

  const openInspector = useCallback(
    (id: string) => {
      selectObject(id);
      const inspectorElement = document.getElementById("graph-inspector");
      inspectorElement?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
    [selectObject]
  );

  if (objects.length === 0) {
    return (
      <div className={ui.panelMuted + " border-dashed px-3 py-4 text-center text-xs text-slate-500"}>
        No expressions yet. Add one to start graphing.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {objects.map((object: GraphObject) => (
        <ExpressionRow
          key={object.id}
          object={object}
          isSelected={object.id === selectedObjectId}
          canRemoveWithBackspace={objects.length > 1}
          registerInputRef={registerInputRef}
          onSelect={selectObject}
          onMoveFocus={focusAdjacentInput}
          onInsertBelow={insertBelow}
          onRemove={removeRow}
          onOpenInspector={openInspector}
        />
      ))}
    </div>
  );
}
