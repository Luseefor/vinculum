# Vinculum progress and UX review

Reviewed 2026-10-15 against the current working tree, including changes already present before this review.

Vinculum is an advanced local mathematical editor in stabilization and UX polish. It has substantially more implementation than an early graphing prototype: canonical scene validation and migration, local projects and recovery, scene sharing, JSON/image export, examples, math notation, geometry, fields, and analysis. The roadmap's completed labels describe implemented areas; they do not establish that every workflow is release-ready. A completion percentage would be misleading without a fixed release checklist.

The baseline passed lint, TypeScript, and 1,888 tests in 212 files. The final full regression run passed 1,925 tests in 215 files. Browser/build results must be considered separately from unit coverage.

## Where the UX is difficult

For a new user, difficulty is moderate to high. Workspaces, dimensions, coordinate planes, layouts, and pointer tools are separate choices. The same object can show a slice in one pane and a projection in another. A blank graph can mean an empty intersection, an unsupported object, a hidden object, an invalid formula, or an object outside the camera. These distinctions carry a learning cost even when rendering is mathematically correct.

The existing equation-first entry, object definitions, example scenes, persistent Help, and inspector reduce that cost. The highest-priority gaps were navigation and inconsistent tool behavior rather than a missing collection of mathematical features.

## Fixed in this review

- Equation dimension changes preserve combined layouts. Spatial object creation in Math Lab reveals the 3D result; planar fields and transforms reveal XY. Split and Quad stay open. Geometry Studio keeps its spatial view unless a planar object needs Math Lab. Blank expressions keep the current view.
- Switching dimensions no longer requests a camera reset or overwrites the other dimension's selected tool. Incomplete measurement drafts are cancelled intentionally.
- Math Lab Quad replaces a duplicate perspective viewport with a labeled YZ orthographic projection of the shared 3D scene. The two graph panes remain slices/projections according to their existing render paths.
- Single, Split, and Quad retain their mounted views and cameras. Hidden 3D views ignore fit/frame commands sent to the visible workspace.
- The second 2D graph supports its displayed tools. Pin and measurement actions receive the originating pane's coordinate plane; overlays and measurement readouts appear there.
- Single-view dimension notices offer a real route to the other dimension, including planar-field recovery from Geometry Studio.
- Escape closes the Add picker even when WebKit leaves category clicks unfocused, and focus returns to Add.
- Projection is disabled with a visible prerequisite until a parametric curve is selected; selecting one enables the existing copy-to-XY action.
- The split divider is keyboard adjustable. Thirteen repeated creation-command dispatch blocks were removed from the editor shell.

## Remaining product limits

The follow-up below adds coordinate-plane slices for spatial parametric surfaces and geometry. A mathematically empty surface slice still looks empty; spatial primitives offer a route back to 3D. Planar equations and transform diagrams use XY. 3D fields and 3D transforms retain their spatial representations.

The follow-up below supersedes the original Fit limitation: Canvas2D now handles bounded Fit/Frame requests, with explicit empty-slice and unbounded-equation feedback. Hidden 3D cameras remain protected.

Small-screen editing still has a higher learning cost: Objects and Inspector use sheets, and multiple graph panes have less room for labels and tools. Further layout simplification should be based on observed user tasks and browser/device testing. This review is an engineering and heuristic UX assessment, not a usability study with participants or a complete release certification.

## Files changed by this review

Viewport composition and rendering integration:

- `apps/graph/components/editor/EditorShell.tsx`
- `apps/graph/components/editor/CanvasToolbar.tsx`
- `apps/graph/components/viewport/ViewportHost.tsx`
- `apps/graph/components/viewport/SplitViewport.tsx`
- `apps/graph/components/viewport/Viewport3D.tsx`
- `apps/graph/components/viewport/GeometryViewport.tsx`
- `apps/graph/components/viewport/PlanarFieldNotice.tsx`
- `apps/graph/components/graph/GraphCanvas.tsx`

Creation, equation entry, and interactions:

- `apps/graph/lib/objects/objectCreation.ts`
- `apps/graph/components/objects/AddObjectMenu.tsx`
- `apps/graph/components/expressions/AutomaticEquationInput.tsx`
- `apps/graph/components/graph/graph2d/Graph2DCanvasUiTopIdentity.tsx`
- `apps/graph/components/graph/graph2d/Graph2DCanvasUiBottomLeftColumn.tsx`
- `apps/graph/components/graph/graph2d/graph2dCanvasPaintFrame.ts`
- `apps/graph/components/graph/graph2d/useGraph2dCanvasInteraction.ts`
- `apps/graph/store/graphStoreSliceUiDialogMode.ts`
- `apps/graph/store/graphStoreSliceToolsProbes.ts`
- `apps/graph/store/graphStoreSliceObjectsExpr.ts`
- `apps/graph/store/graphStoreTypes.ts`

Regression tests and documentation:

- `apps/graph/test/editor/viewNavigation.test.tsx`
- `apps/graph/test/editor/canvasToolbarFit.test.tsx`
- `apps/graph/test/rendering/viewportEngineNavigation.test.tsx`
- `apps/graph/test/rendering/viewportRetention.test.tsx`
- `apps/graph/test/math/automaticEquationInput.test.tsx`
- `apps/graph/test/math/oscillatingImplicitCurve.test.ts`
- `apps/graph/e2e/view-navigation.spec.ts`
- `apps/graph/e2e/fit-availability.spec.ts`
- `docs/user/getting-started.md`
- `docs/reports/ux-progress.md`

Other working-tree changes predate this review and were preserved.

## State coverage

Empty input retains the current view. Valid creations reveal the object, invalid equations retain the previous graph, and dimension notices provide recovery when the current renderer cannot show an object. Projection has explicit disabled and enabled states. Existing renderer loading/error paths and canonical scene handling remain in place. Keyboard resizing includes bounded values and visible focus. No new asynchronous service, persistence format, or schema was introduced.


## Final validation

- `bun run lint`: passed.
- `bun run typecheck`: passed.
- `bun run test -- --maxWorkers=4`: 215 files and 1,925 tests passed.
- `bun run build`: passed, including the pinned Rust/WASM build and Next.js production build.
- `git diff --check`: passed.
- Scoped Playwright checks covered navigation, automatic equations, rendering parity, Canvas2D input, responsive/touch workflows, smoke flows, and Fit availability across Chromium, Firefox, and WebKit. Combined results verify 199 distinct passing browser cases; 20 pre-existing touch cases are Chromium-only and skip on Firefox/WebKit. The final confirmation run passed all 51 navigation/Fit/smoke checks after corrections. The entire browser suite was not run.

The broad browser run exposed a test locator that became ambiguous when the Inspector mounted and a real WebKit Escape/focus bug. The locator was corrected and the picker was fixed; both cases passed the final browser confirmation. A unit run under concurrent build load timed out in the existing performance-menu test; that test passed in isolation and the final full suite passed with bounded workers.

The fresh production preview is available at `http://127.0.0.1:3101/editor`. The existing server process on port 3100 was left running.

No duplicate store, serialization path, scene schema, renderer implementation, or placeholder UI was introduced. No unrelated feature was added. Existing architecture and pre-existing working-tree edits were preserved.

## Follow-up: plane recovery and gesture cancellation

This follow-up inspected the existing review changes and found additional gaps:

- A primary-pane sketch preview could be created using the other pane's active coordinate plane. Both automatic sketch creation and the preview's Create action now pass the originating plane explicitly.
- Retained Canvas2D panes could preserve an unfinished sketch, fit preview, pan, or pinch through a plane/tool change or suspension. These transitions now cancel transient input and release captures; ordinary pan/zoom state is preserved.
- 3D Escape cleared the visible stroke without ending sketching, and cancelled touch input did not clear the stroke. Escape, pointer cancellation, and suspension now use one cancellation path so later input cannot create an unintended curve.
- The XY-only notice explained missing planar equations/transforms but offered no recovery. Its keyboard-accessible Show on XY action now changes the pane containing the notice, preserving the other pane and layout.
- Fit/Frame availability differed between the wide toolbar, compact menu, context menu, palette, and shortcut. A single Math Lab 2D view now omits unsupported menu commands and ignores framing shortcuts; Reset remains available. Spatial/combined views retain framing.

The implementation extended the existing input handlers, viewport chrome, shell, menus, and canonical sketch-creation action. It introduced no stores, serialization paths, scene types, dependencies, or placeholder controls.

Additional source files touched in this follow-up:
- `apps/graph/components/editor/CommandPalette.tsx`
- `apps/graph/components/editor/ContextMenu.tsx`
- `apps/graph/components/editor/EditorShell.tsx`
- `apps/graph/components/editor/TopToolbar.tsx`
- `apps/graph/components/graph/Graph2DCanvas.tsx`
- `apps/graph/components/graph/graph2d/Graph2DCanvasUiChrome.tsx`
- `apps/graph/components/graph/graph2d/Graph2DCanvasUiTopIdentity.tsx`
- `apps/graph/components/graph/graph2d/Graph2DCanvasUiBottomLeftColumn.tsx`
- `apps/graph/components/graph/graph2d/Graph2DCanvasUiSketchFitPreview.tsx`
- `apps/graph/components/graph/graph2d/graph2dCanvasInteractionFinishStroke.ts`
- `apps/graph/components/graph/graph2d/useGraph2dCanvasInteraction.ts`
- `apps/graph/lib/graph3d/GraphThreeEngine.ts`
- `apps/graph/lib/graph3d/graphThreeEngineInputHandlers.ts`
- `apps/graph/lib/graph3d/graphThreeEngineInputPointer.ts`

Tests: `viewportPlaneRecovery.test.tsx`, `graph3dSketchCancellation.test.ts`, `canvasToolbarFit.test.tsx`, `graph2dCanvasInteractionFinishStroke.test.ts`, `view-navigation.spec.ts`, and `fit-availability.spec.ts`.

This remains an engineering assessment rather than a participant usability study. The production build reports approximately 957 kB of first-load JavaScript for the editor; startup performance and the learning cost of multiple coordinate/view choices remain release concerns.


## 2026-10-16 limitation follow-up

Standalone 2D Fit/Frame now uses canonical renderable geometry and the existing
frame-request bus. Finite geometry uses its sampled bounds; unbounded equations
use the current window and report that scope. Only the active 2D quad pane frames.
Spatial primitives and 3D parametric meshes now draw actual coordinate-plane
intersections, including coplanar areas and sampled contact points.

SVG records the canonical graph/grid drawing routines, preserving arrows,
transform diagrams, branch gaps, labels, hatching, and the selected light/dark
palette. PNG remains the full-canvas capture for transient analysis/editor layers.
Share links and local project/recovery storage compress canonical scene JSON
with bounded decompression and legacy compatibility. Browser quotas and the
6,000-character share URL guard remain intentional; JSON export is the fallback.

Explicit curve redraws reuse bounded path caches. Implicit contours cache
world-space paths with pan padding and a screen-error resampling budget, and
refine sign-changing edges to reject poles and finite jumps. Finite sampling
still cannot guarantee every small or tangent feature of an arbitrary equation.

Validation evidence for this follow-up is recorded after the final browser and
performance checks; earlier scoped counts above remain historical evidence.

Mobile follow-up: Safari in an iPhone 17 Pro / iOS 26.3 simulator rendered a
created spatial parametric curve, switched to its labeled XY projection, and
successfully fitted it through the scrolled compact menu. The displayed X range
changed from approximately ±4.02 to ±1.25 and announced “View fitted.” This is
simulator evidence, not physical-device certification. Chromium and WebKit also
pass compact menu tap tests that check the persisted viewport coordinates;
Playwright Firefox's touch-emulation limitation is an explicit skip.

Final follow-up validation:

- Lint, type checking, production build, and `git diff --check` passed.
- Full unit regression: 2,025 tests in 222 files passed. All four Rust tests passed.
- The complete 1,521-case functional matrix ran across Chromium, Firefox, and
  WebKit: 1,420 passed, 81 failed, and 20 documented platform skips. Rechecks
  resolved all 81 failures: the decorative placeholder could become tabbable
  under `aria-hidden`, and old tests assumed pre-navigation UI labels or an
  inactive 2D canvas. Heavy timing cases also passed with bounded concurrency.
- With the new compact tap case, combined evidence covers 1,503 passing browser
  cases and 21 explicit tool/platform skips (1,524 distinct functional cases).
  This is the full run plus corrected reruns, not a second complete matrix
  after the final edits. The last 90-case feature pass verified 89 cases with
  one Firefox touch-emulation skip, including all scalar visualization flows,
  rendered slice positions, Fit, SVG download, and placeholder keyboard behavior.
- Performance tests run separately with one Chromium worker and no concurrent
  builds or functional tests. All three passed, including the 120-interaction
  ordinary workload under 4× CPU slowdown (10 ms p95 frame gap / 62 ms worst
  long task). Dense-scene pauses remain measured in the [stress report](graph-stress.md).

Follow-up implementation owners:

- Framing/chrome: `Graph2DCanvas.tsx`, `graph2dCanvasFit.ts`, `CanvasToolbar.tsx`,
  `EditorShell.tsx`, `TopToolbar.tsx`, and the existing `canvasFrameRequests.ts` bus.
- Rendering: `buildRenderableGraphsFromScene.ts`, `graph2dCanvasGeometrySlice.ts`,
  `graph2dCanvasParametricPolyline.ts`, `graph2dCanvasTypes.ts`,
  `Graph2DCanvasUiTopIdentity.tsx`, the explicit/implicit curve painters,
  `surfaceIntersection.ts`, `marchingSquares.ts`, and `buildGraphImplicitCurve.ts`.
- Export/storage: `sceneExport.ts`, `svgCanvasContext.ts`, `sceneCompression.ts`,
  `shareSceneLink.ts`, `localProjectRepository.ts`, the existing graph package
  manifest, and `bun.lock` (direct `fflate` dependency).
- Accessibility: the decorative placeholder in `MathInput.tsx`.
- Regression coverage: framing/slice/cache/compression unit tests, canonical
  object/export tests, browser Fit/slice tests, and updated recovery/operation/
  scalar/inspector workflows. Existing stores, canonical scene serialization,
  validation, history ownership, and scene schema remain in place.

## Empty-workspace start panel redesign — 2026-10-16

The two floating onboarding cards are now one start panel. Opening an example
has one clear primary action; object creation uses three compact rows through
`createObjectByKey`. First-run tips expand inside the same panel, with the
existing welcome preference still owned by `EditorShell`. Starting an object,
opening examples, or hiding the panel dismisses those tips intentionally. The
panel can be hidden with its close button or Escape and reopened from Start;
focus follows those actions without trapping the rest of the editor.

Math Lab renders the panel outside individual split/quad panes. It remains a
single presentation across workspace/layout changes and yields to canvas tools.
Quad starts minimized so pane labels and zoom controls stay clear; Start opens
the same panel explicitly.
Short phones reserve the zoom column instead of a full bottom band; landscape
screens place example and object actions side by side. Help and expanded tips
scroll inside the panel on short screens. The source uses existing theme,
radius, shadow, focus, and icon primitives.

Motion Primitives' [Animated Group](https://motion-primitives.com/docs/animated-group)
is adapted locally, using Motion 14.3.0 with the smaller `m`/`domAnimation`
feature set. Entry uses a five-pixel slide and short stagger; button presses
have a small tonal/scale response. Reduced-motion states show content immediately,
including during hydration and live OS preference changes, while preserving
focused actions.

Files for this slice:

- `components/viewport/CanvasEmptyState.tsx`, `ViewportHost.tsx`, and
  `GeometryViewport.tsx`: launcher presentation and placement.
- `components/onboarding/FirstRunHint.tsx` and `components/editor/EditorShell.tsx`:
  inline tips and the existing onboarding state/actions.
- `components/ui/animated-group.tsx`, `app/globals.css`, `apps/graph/package.json`,
  and `bun.lock`: animation primitive, responsive styles, and Motion dependency.
- `test/editor/editorGuide.test.tsx`, `test/editor/welcomeDialog.test.tsx`,
  `e2e/start-panel.spec.ts`, `e2e/editor-guide.spec.ts`, and
  `e2e/s35-product-polish.spec.ts`: creation, dismissal/focus, layout, scrolling,
  guide/example handoffs, motion preferences, and light/dark accessibility.
- `e2e/s33-canvas-interaction.spec.ts` and `e2e/s34-responsive-touch.spec.ts`:
  dismiss the center panel through its actual button before testing canvas
  gestures; pan/pinch assertions remain intact. `e2e/surface-range-context.spec.ts`
  waits for finite menu animation before its unchanged contrast scan.
- `docs/user/getting-started.md` and this review: actual user behavior and evidence.

Validation: lint, typecheck, production build, and 2,028 tests in 222 unit-test
files passed. The focused start-panel/guide/product-polish matrix passed all
90 cases across Chromium, Firefox, and WebKit, including 320×568 and 844×390
layouts and axe scans with expanded tips in both themes.

The complete functional matrix ran 1,563 cases using four workers: 1,517 passed,
25 failed, and 21 retained their explicit platform skips. All 25 failures passed
in a subsequent single-worker recheck against the final production build. This
provides combined passing evidence for all 1,542 supported cases; it is not a
second clean run of the entire matrix. The failures comprised 15 shell-selector
collisions from nested header/footer elements (fixed with local containers),
three gesture setups starting over the new launcher (now explicitly dismissing
it), one contrast scan during a finite menu entrance (now awaiting animation),
one heavy-compute timing overrun under parallel load, and five WebKit
rendering/navigation stalls. No numerical assertion, timing budget, or
accessibility rule was weakened. The standalone stress suite was excluded from
this functional matrix; the existing isolated stress report remains unchanged.

Commands and evidence:

- `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` — passed.
- `bun run test:e2e` — used for focused Chromium development checks; the final
  stronger three-browser runs include those cases.
- `PLAYWRIGHT_SERVER_MODE=production bun run test:e2e:all-browsers -- start-panel.spec.ts editor-guide.spec.ts s35-product-polish.spec.ts`
  — 90 passed, followed by the final Quad checks in all three engines.
- `PLAYWRIGHT_SERVER_MODE=production bun run test:e2e:all-browsers -- --workers=4 --grep-invert 'stress|ordinary 2D editing stays responsive'`
  — full functional matrix; `/tmp/vinculum-start-browser-full-final.log`.
- `PLAYWRIGHT_SERVER_MODE=production bun run test:e2e:all-browsers -- --last-failed --workers=1`
  — all 25 passed; `/tmp/vinculum-start-browser-recheck.log`.
- `PLAYWRIGHT_SERVER_MODE=production bun run test:e2e:all-browsers -- start-panel.spec.ts`
  — all 33 final release cases passed; `/tmp/vinculum-start-panel-release.log`.
- `git diff --check` — passed.

No new scene/store/serialization path, modal system, placeholder action, or
unrelated feature was introduced. Native physical-device certification was not
part of this overlay slice; the viewport-level responsive checks are browser
emulation, not a physical-device accessibility certification.
