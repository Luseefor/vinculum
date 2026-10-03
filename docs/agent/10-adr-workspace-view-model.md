# ADR: Workspace / View / Layout / Tool Separation (S15)

Status: decided (S15, branch `v0.5.1`). UI organization only; no scene, math,
renderer, or persistence changes.

## Context

The toolbar's View control conflated four independent concepts: which kind of
work the user is doing (workspace), which projection is shown (view), how many
panes are arranged (layout), and which pointer interaction is active (tool).
S15 separates them explicitly while keeping one canonical scene.

## Decision

```txt
workspace:  geometry | math            (graphStore.ui.workspace)
view:       2d | 3d via graphMode     (graphStore.ui.graphMode)
layout:     2d | 3d | split | quad    (editorStore.viewportMode)
tool:       pan | probe | draw | ...   (per-mode canvas tools)
```

- `workspace` is a persisted UI preference (session storage, same funnel as
  `graphMode`). It is never written into scene/export/share payloads.
- `setWorkspace` touches `ui` only: scene objects, selection, cameras, and
  view/layout/tool state pass through untouched.
- Workspace drives organization, not existence: Quick Add priority order,
  empty-scene hints, status-bar context, and palette switch commands.
  Object visibility stays scene-controlled; no filtering by workspace.
- `ViewportHost` remains the single mount boundary for renderers
  (single/split/quad branches) and is the insertion point for future
  synchronized Perspective / XY / XZ / YZ panes. No extra renderers mounted.
- No `/geometry` or `/math` routes: one document, no reload on switch.
- New math areas (contours, fields, calculus overlays) must attach to
  canonical source objects, never duplicate scene state.

## Consequences

- Geometry Studio defaults to no view change on switch; Math Lab is the
  initial default because landing is equation-first (remembered afterwards).
- S10 equation normalization, S9 domain handling, S11 safety, and S14
  interaction contracts are workspace-independent and covered by the same
  suites in both workspaces.
