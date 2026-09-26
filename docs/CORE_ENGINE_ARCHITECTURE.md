# Vinculum Core Engine Architecture (frozen at S29)

From S29 onward:

- core scene schema conventions are stable
- math/world mapping is frozen
- worker protocol architecture is frozen
- derived-vs-canonical ownership policy is frozen
- persistence architecture is frozen

Future UI work may add presentation and workflows. Future engine changes
require a reproducible correctness/performance blocker or explicit post-v1
feature work. Normal bug fixes are not artificially prevented.

## 1. Canonical scene

- Source of truth: `graphStore.scene` (`apps/graph/store/graphStore.ts`),
  types in `packages/scene/src/types.ts` (12 kinds: surface,
  parametricCurve, plane, parametricSurface, implicitSurface, vectorField,
  point, vector, line, ray, segment, linearTransform).
- One canonical writer: `serializeScene`; one canonical reader:
  `deserializeScene` -> `validateSceneDocument` -> `parseGraphObject`.
  Share (`shareSceneLink`), export (`sceneExport`), templates
  (`examplesRegistry`), and projects all reuse this path.
- Session persist (`graphStoreMerge`) hydrates scene + sanitized UI only;
  no expression-safety bypass is introduced (scene objects were validated
  at creation/import; merge never invents objects).
- History snapshots (`historyStore`, capped at 100 by S29-R2) hold
  scene-only `{objects, measurements, selection}` — never TypedArrays,
  worker results, heatmaps, or streamlines.

## 2. Object kinds

| Kind | Math representation | Renderer | Worker? | Persisted? | Analysis support |
|---|---|---|---|---|---|
| surface | z/y/x = f (orientation) | 3D mesh + 2D branch | no | yes | differential |
| parametricCurve | x/y/z(t) | 3D line + 2D polyline | no | yes | integrals (line) |
| plane | linear eq, probe-fitted | 3D quad | no | yes | geometry relations |
| parametricSurface | x/y/z(u,v) | 3D mesh (worker) | yes | yes | differential, integrals |
| implicitSurface | F(x,y,z)=0 | marching tetra (worker) | yes | yes | — |
| vectorField 2D/3D | P/Q[/R](x,y[/z]) | glyphs (worker) + 2D arrows | yes | yes | vector calculus, streamlines, integrals |
| point | scalar-expr coords | sprite/marker | no | yes | geometry relations |
| vector/line/ray/segment | scalar-expr anchors/directions | primitive proxies | no | yes | geometry analysis |
| linearTransform 2D/3D | row-major scalar-expr entries | basis overlay | no | yes | eigen/det/rank |

Raw expression text roundtrips byte-exact; resolved numerics are transient.

## 3. Coordinate mapping (frozen)

- Canonical math 3D: (x,y,z). Three world: (x,z,y), Y-up, self-inverse.
- Single boundary: `lib/math/coordinates.ts`
  (`mathToWorld3D/worldToMath3D/mathVectorToWorld3D/projectMathToPair2D`).
  All builders map math-frame buffers through it once; picking maps
  world->math once at input. No renderer redefines semantics.
- 2D screen<->pair transforms are a separate viewport domain, not a second
  math truth.

## 4. Pure math modules

`apps/graph/lib/math/`: one specialized compiler per expression family
(surface, parametric, parametricSurface, implicit, vectorField, scalar
integrand, geometry coordinate, plane, partial-derivative), all sharing
`validateExpressionSafety` (S11: length 2048, AST 2500, literal 1e9,
allowlisted functions, disallowed AST nodes) plus per-family reserved
locals (t for curves only, u/v for surfaces only, x/y[/z] for fields,
parameter-only for coordinates/matrix entries). Generated derivative ASTs
re-enter safety validation. All caches LRU-bounded (128; coordinates 256).
No `eval`/`Function`/dynamic Worker URLs. `evaluate.ts` (unsandboxed,
unbounded) was dead code and was deleted in S29-R4.

## 5. Worker compute model (frozen)

- One protocol (`geometryComputeProtocol`, 6 kinds), one manager
  implementation (`geometryComputeManager`: lazy transport, per-object
  generations, queue coalescing, stale suppression, crash recovery with
  error-mark + lazy fresh worker, no auto-retry of poison inputs).
- Four live instances sharing the protocol: geometry (inside Three engine),
  scalar-viz, streamline, integral (module singletons). Four threads is the
  documented cost; no worker-per-object/pane.
- Workers compute numerical data only (structured-clone payloads,
  transferable results). No Three/React/Zustand/DOM in workers.
- Appliers recompute live structure signatures and discard on mismatch
  (deferred-sync backstop) plus kind guards; deletion/kind-switch/same-ID
  replacement can never apply a wrong mesh (S29-R3 fixed dispose to clear
  only tracked IDs, not siblings' statuses).

## 6. Derived analysis ownership (frozen)

| Feature | Source | State location | Persisted | Worker | Overlay namespace |
|---|---|---|---|---|---|
| Differential analysis | surface object + params | `ui.differentialAnalysisBySourceId` (transient) | no | no | `analysis:` |
| Vector calculus | vectorField + params | `ui.vectorCalculusBySourceId` | no | no | `curl:` |
| Scalar viz | scalar field expr + params | `ui.scalarVizBySourceId` + `scalarVizResults` cache | no | yes | `scalar-slice:` (+ `-contour` sibling) |
| Streamlines | vectorField + params | `ui.streamlineBySourceId` + `streamlineResults` | no | yes | `streamline:` |
| Integral analysis | curve/surface/field + integrand + params | `ui.integralBySourceId` + `integralResults` | no | yes | none (Inspector values) |
| Geometry analysis | primitives + params | `ui.geometryAnalysisBySourceId` | no | no | `geometry-analysis:` |
| Linear-transform analysis | matrix entries + params | `ui.linearTransformAnalysisBySourceId` | no | no | `linear-transform:` |

Rules: derived state is transient, source-owned, keyed by source ID +
math identity (expression/domain/params, never color/visibility/camera);
appearance edits retain, math edits invalidate, delete/kind-switch/scene
replace clears; same-ID replacement never inherits stale overlays/results
(structure backstop + live-ID GC). Overlay syncs sweep only their own
`prefix:` namespace — mutual survival is pinned by coexistence tests.

## 7. Render ownership

- 3D: one engine per viewport host (`GraphThreeEngine`); Geometry Studio
  shares one engine across panes via scissor viewports
  (`setGeometryPanes`); math-workspace quad mounts two 3D engines (known
  duplication cost, documented — canonical truth stays singular, GPU nodes
  are per-engine). Tick reads stores via `getState`, writes only on
  transitions (signature/keyed-cache early-outs); no per-frame allocation
  of large arrays, no per-frame expression compilation, no per-frame
  Zustand churn. Disposal is per-node + engine-teardown symmetric
  (geometry/material/texture/InstancedMesh/DataTexture).
- 2D: single `Graph2DCanvas` + `graph2d/` helpers; layer order
  functions/heat/contours/fields/gradients/streamlines/transforms;
  plain wheel pans, Ctrl/Cmd+wheel zooms to cursor; viewport moves never
  enqueue worker jobs.

## 8. Persistence

`serializeScene` -> validate -> version -> persist/export/share; reverse
through parse -> envelope validate -> migrate (v0->v1; future versions
rejected) -> validate -> `deserializeScene` -> store replace with
intentional history handling. Failed imports never partially mutate.
Duplicate object/measurement IDs reject (S29-R7). Size/depth/node budgets
in `importPayloadLimits` (500 objects max); per-job numeric budgets bound
every sampler/extractor; no aggregate multi-object budget (documented
limitation — 500 maxed-out implicits can still saturate the single queue,
handled serially without crash).

## 9. History

Undo/redo holds scene snapshots only; transient analysis/worker/UI state
never pollutes history; constraint-derived color/visibility edits skip
history via ordered effect. Bounded at 100 snapshots (S29-R2).

## 10. Tolerance policies (intentional, not global)

- Geometry degeneracy/relation: `geometryTolerance.ts` epsilons.
- Matrix singularity/rank: `MATRIX_ABS_TOL=1e-12`, `MATRIX_REL_TOL=1e-9`
  (scale-relative pivot acceptance).
- Marching/extraction: per-extractor budgets + residual checks.
- Integral convergence: Simpson/line/surface quadrature tolerances.
- Plane linearity probe: 1e-6; plane normal-zero: 1e-8.
Each is chosen per-domain; no single global epsilon is required.

## 11. Core extension rules

A future mathematical feature must consume existing abstractions: add its
kind to `@vinculum/scene` + parser + factory + validation; reuse
`validateExpressionSafety` + a specialized compiler (explicit params,
cache key includes param signature — S29-R5/R6/R8); reuse the worker
protocol/manager if heavy (new kind, same lifecycle); keep analysis
derived/transient with its own `prefix:` overlay namespace; extend
signatures (math vs presentation split) and persistence roundtrips. No
second store, serializer, compiler framework, or renderer may be created
without a demonstrated blocker.

## 12. S29 repairs (all pinned in `test/s29CoreFreezeAudit.test.ts`)

- S29-R1 samplePlane probe scope: locals win (`{...scope,x,y,z}`).
- S29-R2 history cap 100.
- S29-R3 manager dispose clears tracked IDs only.
- S29-R4 deleted dead `lib/math/evaluate.ts`.
- S29-R5/R6 surface + parametric caches include param signature.
- S29-R7 duplicate object/measurement IDs reject.
- S29-R8 safety gate: explicit `[]` allowedSymbols enforces base symbols.

## 13. Known non-blockers (documented, deferred)

- Math-workspace quad mounts two 3D engines (2 WebGL contexts, duplicate
  GPU nodes/jobs); canonical truth stays singular. A shared-engine
  refactor is explicitly out of scope for the freeze.
- No aggregate multi-object compute budget (per-job caps only).
- Surface/parametric import parsers check structure only (unknown symbols
  surface at render with diagnostics, fail-safe, no crash); vectorField/
  implicit/coordinate parsers additionally run authoritative checks.
- Comparisons/ternary (`==`, `>`, `?:`) parse but coerce to NaN/0/1 at
  evaluation — safe, non-mathematical grammar accepted without crash.
  Blocking them requires an operator allowlist (post-v1).
- Host-load Playwright flakes (perf-HUD/top-toolbar timing) are
  environment-sensitive; unit/typecheck/lint/build are green.
