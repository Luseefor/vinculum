"use client";

import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import type { GraphStoreState } from "@/store/graphStore";
import { useGraphStore } from "@/store/graphStore";
import { selectGraph2dCanvasSlice } from "./graph2dCanvasStoreSlice";

/**
 * One shallow subscription for {@link Graph2DCanvas} store fields, so unrelated
 * graph store updates do not re-render the canvas when slice values are unchanged.
 */
export function useGraph2dCanvasStoreSlice(isQuadTop: boolean) {
  const selector = useCallback(
    (state: GraphStoreState) => selectGraph2dCanvasSlice(state, isQuadTop),
    [isQuadTop]
  );

  return useGraphStore(useShallow(selector));
}
