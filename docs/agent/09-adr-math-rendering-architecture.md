# ADR: Vinculum Math and Rendering Architecture

Status: decided (S1.5, branch `v0.5.1`). Read-only decision section; no dependency migrated, no renderer rewritten.

## Context

S0 restored the test baseline (61 files / 248 tests green via a test-only storage shim).
S1 characterized the 3D pipeline without changing production code and found, with
regression-test evidence:

- F1: single-point (0,0) compile probe rejects functions singular at the origin.
- F2: finite pole values are fully triangulated into stretched false triangles.
- F3: parametric gaps are bridged by chords (previous-point substitution + `THREE.Line`).
- F4: 2D parametric curves project in world frame while 2D implicit equations
  evaluate in math frame — the same circle renders two ways.
- F5: planes skip the math→world conversion that surfaces/curves apply.
- F6: visibility toggles rebuild geometry (`visible` is in the structure signature).
- F7: invalid vertices linger in buffers with zero normals and inflate bounds.
- Healthy: winding/normals consistent everywhere; camera ops never rebuild;
  rebuild gating + disposal sound; expression sandbox intact; zero browser console errors.

Every failure is a CPU-side mathematical-data or ownership issue. None is caused by
React, Next.js, Zustand, Three.js, Canvas2D, mathjs, or WebGL. Measured mathjs cost
is ~3µs per evaluation (50k evals ≈ 150ms): the hottest current path is implicit-2D
grid evaluation inside 2D repaint (up to ~49k evals per mousemove-driven repaint);
default explicit surfaces cost ~20ms per full rebuild.

A parallel `next build` + `next dev` run during gating produced a spurious
`PageNotFoundError: /_document`; sequential builds are green. Do not run build and
dev/Playwright concurrently (they share `apps/graph/.next`).

## Decision

Separate the mathematical engine from the UI and renderers. Replace no major
dependency. Target structure, derived from repository evidence:

```txt
Application UI ................. React 18 / Next.js 14 (components/, app/)
  reads store snapshots, dispatches actions, mounts canvases, schedules paint.
  Never samples, never builds geometry, never holds vertex arrays in state.

Canonical scene state .......... Zustand stores + @vinculum/scene types
  graphStore (scene/tools), editorStore (layout/params), historyStore (undo).
  Holds equation strings, domains, parameters, UI prefs. Never TypedArrays.

Mathematical definitions ...... renderer-independent math-core (pure TypeScript)
  and algorithms                  expression | domain | sampler | colormap | coordinates.
                                  Imports mathjs only. No React/Next/Zustand/Three/DOM.

Heavy numerical execution ..... Web Workers (added later, hosting math-core samplers).

2D rendering ................... Canvas2D renderer (consume math-core outputs).
3D rendering ................... Three.js renderer (consume math-core outputs).

Serialization .................. lib/scene canonical pipeline (unchanged ownership).

Future acceleration ............ WebGPU-compute / WASM only behind stable
                                  math-core-compatible interfaces (see triggers).
```

## Dependency decisions

- React: KEEP FOR UI. Evidence: Viewport3D is a thin `ssr:false` mount wrapper;
  GraphThreeEngine is imperative with direct store subscriptions; camera lives in the
  engine tick. One hotspot to relocate later: 2D expression compilation runs
  synchronously on the render path (`Graph2DCanvas.tsx:66-69` → `useMemo` over
  `buildRenderableGraphsFromScene`, which compiles via `equationRenderableBranches.ts:16-17,95`
  and uncached `tryCompileMathExpression` in `graph2dCanvasCompile.ts:13`).
- Next.js: KEEP. Evidence: App Router shell, green builds, green chromium matrix.
- Zustand: KEEP. Evidence: clean store ownership; persist works; sync path is
  headless-testable (`graph3dSyncTriggers.test.ts`).
- Three.js: KEEP FOR 3D. Evidence: S1-U5 proved normals/winding healthy; all mesh
  failures come from sampler data, not the library. Lifecycle already isolated in
  `lib/graph3d` with traversed disposal.
- Canvas: KEEP FOR 2D. Evidence: 2D issues (F4, implicit segment pairing) are
  sampling/topology problems, not Canvas problems. OffscreenCanvas: PROFILE BEFORE ADDING.
- mathjs: KEEP. Evidence: adequate speed (~3µs/eval); the AST safety layer is built
  on it; every failure is usage-side. Already wrapped by `lib/math` compilers.
- WebGL2: KEEP AS PRODUCTION BACKEND. Evidence: no GPU-side failure; scene sizes
  (≤16k-vert meshes) need no rendering acceleration.
- WebGPU: FUTURE COMPUTE BACKEND ONLY. Evidence: WebGPU solves zero S1 failures
  (all are CPU data-side); production rendering on WebGPU is unjustified while CI
  requires broad Chromium/Firefox/WebKit support. Candidate workloads: dense
  scalar-field evaluation (implicit 3D), vector-field transforms, dense contours.
- Workers: ADD LATER. Evidence: implicit-2D repaint (~150ms worst case) and
  drag-driven full-res rebuilds (~20-50ms each) are the quantified main-thread
  costs. Boundary: JSON-able params in, transferable TypedArrays out.
- WASM (incl. Rust): DEFER UNTIL PROFILE JUSTIFIES. No kernel is proven to need it.
- Vitest / Playwright: KEEP. Evidence: 278 unit tests + 11/11 chromium smoke green.

## Dependency boundaries (strict)

- math-core MUST NOT import: React, Next.js, Zustand (or editor stores), Three.js,
  Canvas/DOM, or any component. (`lib/math` already imports zero Three.js; lock it in.
  Note: `lib/math` currently reaches the editor parameter scope via
  `lib/store/editorParameters.ts` (`compileExpression.ts:2`,
  `compileParametric.ts:2`, `samplePlane.ts:2`); math-core must instead receive the
  parameter scope as a plain argument.)
- Renderers (`lib/graph3d`, 2D paint path) MUST NOT own: expression semantics
  (no ad-hoc equation sniffing per renderer — fixes F4/F5 class), project
  persistence, or scene migrations.
- React UI MUST NOT: compile expressions in render without a cache, run numerical
  sampling loops, or receive/store massive vertex arrays as component/store state.
  (Stores hold strings/params today — keep it that way.)
- Workers MUST NOT: import DOM APIs, depend on React, or return Three.js objects.
  Exchange: structured-cloneable descriptors in, transferable
  (`Float32Array`/`Float64Array`/`Uint32Array`) geometry out; mathjs runs inside.
- `@vinculum/scene` stays dependency-free (types/defaults/pure helpers only).
- No second renderer, second store library, or second scene schema (per
  architecture contract). The F4/F5 fixes centralize conversion; they do not add
  parallel implementations.

## Future migration triggers

- Consider worker isolation for a sampler only when it is measured on the hot path
  (current quantified candidates: implicit-2D repaint, high-res surface rebuilds).
- Consider Rust/WASM only when profiling shows a specific numerical kernel remains
  CPU-bound after worker isolation.
- Consider WebGPU production rendering only when browser support, Three.js backend
  maturity, and a measured Vinculum workload jointly justify it — render first,
  compute first only with numbers.
- Consider OffscreenCanvas only after profiling shows canvas upload (not sampling)
  dominating 2D frame cost.

## Consequences

Benefits: S1-class failures (F2-F5) become sampler/data fixes behind one tested
boundary instead of per-renderer patches; the next capability (implicit 3D,
contours, fields) adds a sampler + thin schema wrapper, not a renderer; workers
and GPU compute slot in without UI rewrites; React stays lean (UI orchestration,
mount/dispose, paint scheduling).

Tradeoffs: an extra boundary to maintain (math-core API stability matters);
short-term cost to relocate compile-out-of-render and centralize conversion;
worker marshaling adds complexity only where profiling justifies it — not by default.

Non-goals of this ADR: fixing F1–F9 (S2+), schema v2, UI redesign, WebGPU/WASM/worker
implementation. Those proceed under the boundaries above.
