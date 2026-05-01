# Graph 2D canvas (`graph2d/`)

This folder holds the **2D plot canvas**: math → screen transforms, grid and curve drawing, pointer/sketch interaction, and floating UI chrome.

## Naming

- **`graph2d*`** (camelCase): pure helpers, hooks, and modules (`graph2dCanvasFormat.ts`, `useGraph2dCanvasDraw.ts`).
- **`Graph2D*` / `Graph2d*`** (PascalCase): React components (`Graph2DCanvas.tsx` lives one level up; chrome pieces use the `Graph2DCanvasUi*` prefix).

## Data flow

1. **`useGraph2dCanvasStoreSlice`** — shallow-selected Zustand fields for the active viewport (primary vs quad-top). `useShallow` from `zustand/react/shallow` must be called at the top level (not inside `useMemo`).
2. **`buildRenderableGraphsFromScene`** — scene objects + axis pair → `RenderableGraph[]` for the painter.
3. **`useGraph2dCanvasInteraction`** — wheel, pointers, sketch completion, Escape; owns `mousePos` / sketch preview state.
4. **`useGraph2dCanvasDraw`** + **`paintGraph2dCanvasFrame`** — `requestAnimationFrame` (see `useGraph2dCanvasPaintSchedule`) repaints the canvas from store + interaction state.

## Where to extend

- **New curve / implicit style**: `equationRenderableBranches.ts`, `graph2dCanvasDrawRenderableGraph*.ts`, and types in `graph2dCanvasTypes.ts`.
- **New tool behavior**: `useGraph2dCanvasInteraction.ts` and small pure modules alongside it (`graph2dCanvasInteractionZoom.ts`, `graph2dCanvasSnapMath.ts`, …).
- **Theme colors**: `graph2dPaintPalette.ts` and `Graph2dPaintPalette` in `graph2dCanvasTypes.ts`.
