# Graph Renderer Migration Plan

This document tracks the migration from React Three Fiber (R3F) to an imperative Three.js runtime for improved stability and predictable performance.

## Goals

- Keep feature parity for 3D graph visualization.
- Reduce rendering glitches caused by framework-level reconciliation.
- Make rendering independent from UI framework choices.
- Keep rollback path available during transition.

## Current State

- 3D rendering is now handled by `lib/graph3d/GraphThreeEngine.ts`.
- Scene object construction lives in `lib/graph3d/buildGraphObjects.ts`.
- Grid adaptation logic is framework-agnostic in `lib/graph/adaptiveGridState.ts`.
- `components/graph/GraphCanvas.tsx` is now a thin mount/unmount wrapper.

## Migration Workflow

### Phase 1: Stabilize runtime (in progress)

- [x] Replace R3F scene tree with imperative Three.js engine.
- [x] Preserve controls, labels, lighting, axes, and adaptive grid.
- [x] Add deterministic camera reset behavior.
- [x] Remove R3F and Drei dependencies.
- [x] Add incremental object syncing by object signature.
- [x] Add render loop diagnostics (FPS, long frame logger).
- [x] Add WebGL context loss/recovery handling.

### Phase 2: Harden data flow

- [x] Extract renderer adapter (`scene objects -> render descriptors`).
- [x] Unit test signatures for all graph object kinds.
- [x] Add targeted updates for object color-only edits (material mutation path).
- [x] Add explicit disposal assertions in tests.

### Phase 3: Validate with tests

- [x] Add Playwright checks for 3D interactions:
  - orbit / pan / zoom input behavior
  - object add/remove visibility
  - camera reset
  - theme switch in 3D
- [x] Add smoke test for sketch-generated parametric curve in 3D.

### Phase 4: Optional framework migration

If full React migration is desired, keep renderer and math modules unchanged and only swap UI shell incrementally.

## Constraints

- Do not regress scene import/export format.
- Do not change graph math semantics.
- Keep TypeScript and test suite green on each migration step.

## Rollback Plan

- If regression is detected, revert the engine integration in `GraphCanvas.tsx` and restore previous renderer integration branch.
- Because scene schema and store API are unchanged, rollback is isolated to renderer modules.
