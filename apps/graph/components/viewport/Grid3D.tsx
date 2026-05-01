"use client";

import { getGridSettings } from "@/lib/graph/grid";

export function getViewport3DGrid(distance: number) {
  return getGridSettings(distance);
}
