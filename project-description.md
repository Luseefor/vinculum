Vinculum — Project description
This document describes the Vinculum monorepo as it exists today: purpose, architecture, packages, runtime behavior, developer workflows, quality gates, and CI. It is intended for onboarding, planning, and handoffs.

1. High-level summary
Vinculum is a Bun workspaces monorepo whose primary ship unit is @vinculum/graph: a Next.js 14 (App Router) single-page editor for interactive 3D mathematical visualization (Three.js WebGPU, with WebGL2 fallback), paired with a 2D plotting / sketching canvas for constraints and parametric authoring. Scene data uses typed graph objects (implicit surfaces, planes, parametric curves), with mathjs parsing and symbolic analysis and Rust/WASM real numeric evaluation.

The workspace also contains @vinculum/scene, a small TypeScript-only package exporting shared scene types and defaults consumed by the app via workspace:*.

2. Repository layout
Path	Role
/	Workspace root (package.json, bun.lock, tooling entrypoints)
apps/graph/	Main product: Next.js application (@vinculum/graph)
packages/scene/	Shared @vinculum/scene types and defaults
.github/workflows/graph.yml	CI pipeline for graph app + scene package
Other apps under apps/* may exist in the future; today the graph app is the focal application.

3. Product: what the graph app provides
3.1 Core user-facing capabilities
3D viewport rendered with Three.js: orbit-style navigation, grid/shaded rendering themes, probes, pan mode, baseline plane for sketch alignment, reset camera.
2D viewport (Graph2DCanvas): axis pairs, viewport zoom/pan (wheel-driven range changes), sketch tool, probes, readable coordinate overlays and viewport range badge.
Switching graph mode between 3D and 2D within one shell (EditorShell), with toolbar and accessibility attributes (aria-pressed on mode toggles).
Scene objects backed by GraphObject variants (see §5): implicit surfaces, planes, parametric curves (includes sketch-fitted curves).
Expressions evaluated at runtime in Rust/WASM: surfaces z = f(x,y) (with orientation variants), planes, and parametric (x,y,z) in t. Parsing, differentiation, and symbolic algebra continue to use mathjs during the staged migration.
Sketch-to-curve: freehand strokes in 2D are fitted to a parametric curve via least-squares-style fitting (lib/math/fitParametricSketch*.ts).
Object browser (left rail): list objects, visibility, colors, counts; data-testid="scene-object-count" on the numeric badge for testing.
Inspector / expressions (right rail): edit object parameters and expressions with validation feedback.
Undo/redo (historyStore) tied to scene edits.
Theme: light/dark/system resolution, accent presets, persisted preferences; toolbar menus close on Escape where implemented.
Scene lifecycle: New scene clears or confirms when objects exist (TopToolbar + NewSceneDialog pattern); aligns with undo/history clearing on confirm.
Import/export JSON scene documents (deserializeScene / serializeScene, dialogs).
Constraints (editor-level): attach/align/offset between objects with derived updates (applyConstraintDerivedUpdates).
Responsive layout: soft neutral chrome around a full canvas, expression-first rows, visible Objects/Inspector toggles, collapsible rails, resize handles, and fluid drawers/sheets. Compact headers use separate readable workspace and panel-action rows; the canvas fills the space below the toolbar without a bottom dock.
Command palette and context menus provide supporting UI.
3.2 Non-goals / boundaries (current code)
The repo is optimized for browser-hosted mathematical graphing—not a general CAD suite.
Networking, accounts, or collaborative editing are not required by the core stores (session persistence is browser-local unless extended).
4. Technology stack
Layer	Choices
Package manager / runtime	Bun (workspace scripts, installs)
Framework	Next.js 14 App Router (apps/graph/app/)
UI	React 18, Tailwind CSS, internal UI primitives (components/ui/)
3D	three, three-stdlib
Math	Rust/WASM numerical core; mathjs parsing and symbolic analysis
Client state	zustand (+ persist middleware where used)
Unit / component tests	Vitest, Testing Library, jsdom
E2E	Playwright (apps/graph/e2e/)
Lint	ESLint (next lint, eslint-config-next)
Types	TypeScript 5
next.config.mjs sets transpilePackages: ["@vinculum/scene"] and allowedDevOrigins for local dev tooling.

5. Scene model (@vinculum/scene)
The shared package exports:

GraphObjectKind: "surface" | "parametricCurve" | "plane".
SurfaceGraphObject: equation string, domain (SurfaceDomain), resolution, wireframe appearance, optional orientation (SurfaceOrientation: "z" | "y" | "x").
ParametricCurveObject: xExpr, yExpr, zExpr, tMin/tMax, sample count.
PlaneGraphObject: equation, size, appearance.
The graph app augments this with richer document types (lib/types/scene.ts, schema/serialization), validation pipelines (lib/scene/validateScene*.ts), and store slices that implement CRUD and UI.

6. Application architecture (apps/graph)
6.1 Entry & routing
app/layout.tsx: HTML shell, global CSS (globals.css).
app/page.tsx: renders EditorShell (single main route /).
6.2 Shell and layout
components/editor/EditorShell.tsx: orchestrates rails, ViewportHost, Viewport3D / Viewport2D, dialogs, shortcuts, constraint application, resize logic, theme sync.
components/layout/: legacy/alternate Toolbar plus TopToolbar (production path for top chrome: file/theme/scene/actions).
components/theme/ThemeSync, components/viewport/: viewport wiring and embedding of 3D/2D canvases.
6.3 Three.js pipeline (lib/graph3d/)
Representative responsibilities (files evolve; names reflect modularization):

GraphThreeEngine.ts + graphThreeEngineTick*.ts: animation loop, orbit/grid/probe/update phases.
graphThreeEngineInput*.ts: pointer, keys, picking, baseline sketch handlers.
buildGraph*.ts: constructing meshes/lines from scene objects—surfaces (including implicit marching), planes, parametric assemblies, syncing object disposal/signatures (graphObject3dSignatures.ts, etc.).
graphThreeSketchStroke.ts, graphThreeCameraBaseline.ts, graphThreeProbeMarkers.ts, graphThreeSyncSceneObjects.ts: specialized behaviors.
6.4 2D canvas pipeline (components/graph/ + graph2d/)
Graph2DCanvas.tsx: integrates drawing, interaction, overlays.
graph2d/ helpers: buildRenderableGraphsFromScene, equation branches, zoom/interaction, grid/path drawing, probes, paint scheduling, viewport range formatting, implicit/parametric draw paths, types.
6.5 Math & sketch fitting (lib/math/)
Expression compilation and sampling (compileExpression, compileParametric, sampleSurface, sampleCurve, evaluate).
fitParametricSketch*.ts: stroke preprocessing, polynomial core, formatting—turns sketched polylines into parametric curve definitions.
6.6 Scene I/O & validation (lib/scene/)
serializeScene / deserializeScene, sceneSchema, commands / applyCommand.
validateScene.ts and split validators for parsers and primitives—surface domains, expression syntax, numeric ranges.
6.7 Stores
store/graphStore.ts: canonical scene + UI + tools state; persisted to sessionStorage under vinculum-graph-session with partialization (scene dialog reset on hydrate). Uses composed slices (graphStoreSlice*.ts): objects, viewport 2D, theme density, tools/probes, sketch strokes, snap snapshots, dialogs, etc.
lib/store/editorStore.ts: layout dimensions, panels, constraints, animation console parameters, viewport mode—with persist middleware for durable editor chrome preferences.
lib/store/historyStore.ts: undo/redo stacks of scene snapshots for editing sessions.
7. Testing
7.1 Unit / integration (Vitest)
Tests live under apps/graph/test/ and co-located *.test.ts/*.test.tsx where applicable.
test/setup.ts configures Testing Library / DOM for React components.
Coverage includes graph2d transforms, viewport math, store slices, validation, expression compilation edge cases, and canvas interaction helpers.

7.2 End-to-end (Playwright)
apps/graph/e2e/smoke.spec.ts: shell smoke—3D default, 2D toggle, orbit stability, probe hover UI, theme menu light/dark, new scene confirmation, sketch flow object count.
apps/graph/e2e/graph2d-canvas.spec.ts: 2D canvas accessibility and wheel zoom / range badge.
Playwright playwright.config.ts starts next dev -p 3100, uses base URL http://127.0.0.1:3100, enables trace: "on-first-retry", CI retries: 2, workers: 1 in CI.

Projects (browser matrix):

Project name	Browser
chromium	Desktop Chrome
firefox	Desktop Firefox
webkit	Desktop Safari (WebKit)
Default Bun workspace script runs Chromium-only E2E for fast local feedback: `bun run test:e2e` from repo root. Full matrix locally: `bun run test:e2e:all-browsers`.

8. CI/CD — workflow Graph (.github/workflows/graph.yml)
Triggers on push/PR when paths touch apps/graph/**, packages/scene/**, root project-description.md, bun.lock, or the workflow itself.

8.1 Job check (Ubuntu)
Checkout, Bun install (bun install --frozen-lockfile).
bun run lint (workspace filter → graph app).
bun run typecheck.
bun run test (Vitest).
bun run build (production next build).
Production server smoke: after build, next start -p 3102 in background, retry loop curl until / responds, basic grep on HTML payload, clean shutdown.
8.2 Job e2e (matrix)
Runs bunx playwright test --project=<browser> from apps/graph with CI=true.

OS	Browsers
ubuntu-latest	chromium, firefox, webkit
macos-latest	chromium
Ubuntu installs browsers with playwright install --with-deps <browser>; macOS uses playwright install <browser> (no --with-deps).

Matrix uses fail-fast: false so one browser/OS combination does not cancel the others.

9. Scripts reference
Root package.json
Script	Effect
bun run dev	Dev server for graph app
bun run build	Production build (graph app)
bun run lint	ESLint (graph app)
bun run typecheck	tsc --noEmit (graph app)
bun run test	Vitest once (graph app)
bun run test:e2e	Playwright chromium project (graph app)
bun run test:e2e:all-browsers	Playwright all projects
apps/graph/package.json (subset)
Script	Effect
dev	next dev
build	next build
start	next start
lint	next lint
typecheck	tsc --noEmit
test	vitest run
test:e2e	playwright test --project=chromium
test:e2e:all-browsers	playwright test (all projects)
test:e2e:install	playwright install chromium
10. Developer setup (typical)
Install Bun and clone the repo.
From repo root: bun install.
bun run dev → open the printed local URL (Next dev server).
Optional (inside `apps/graph`): `bun run test:e2e:install` for Chromium, then `bunx playwright install firefox webkit` if running the full browser suite locally.
11. Deployment notes
The app is a standard Next.js deployment:

Run bun run build (or package manager equivalent) then next start with configured HOST/PORT, or deploy to a host that runs Node and proxies to Next (for example Vercel, Docker, etc.).
Environment variables are not centrally documented in code for a minimal deployment; add host-specific docs if you introduce API keys or server-side features.
12. Operational caveats
Session storage: user scene data is persisted in sessionStorage via graphStore; clearing the tab session clears persited session state.
Local dev: Next may log webpack pack cache restore warnings; they are usually benign—clear apps/graph/.next/cache if builds or dev behave oddly.
CI minutes: macOS plus three browsers on Ubuntu multiplies runtime; adjust the matrix in .github/workflows/graph.yml if cost vs. coverage tradeoffs change.
13. Document maintenance
Update project-description.md when:

Adding packages or apps under the monorepo.
Changing CI jobs, Playwright projects, or primary scripts.
Introducing major features (collaboration, auth, backend APIs) or persistence boundaries.
Last aligned with repository layout and workflows at authoring time (see git history for precise commits).
14. Automatic field analysis
The Math Lab toolbar's Solve action opens a definition-first field solver for
Cartesian/polar scalar and vector calculus, polar curves, complex-function
component analysis, Cauchy–Riemann checks, independent linear residual systems,
and verified polynomial harmonic conjugates. Symbolic results and solution-step
overlays live in the canonical Analyze inspector; pointwise vector analysis
also includes field value, magnitude, unit direction, angle, and vector Laplacian.
Integral overlays describe the actual worker quadrature result and uncertainty.
Math lives in lib/math; UI reuses the existing Dialog primitives. Plot insertion
validates through the existing scene object parser and graphStore addDefinedObject
before one atomic append. Polar/complex plots convert to existing scene kinds,
so serialization/schema and store ownership remain unchanged. See docs/user/limits.md.

15. Mathematical notation
Formula fields use a shared MathLive editor with an optional source-text mode.
MathJSON decoding through Compute Engine converts input notation to existing
expression strings without evaluating it. Existing mathjs safety checks and
Rust/WASM computation remain authoritative. KaTeX typesets expression summaries,
analysis results, vectors, matrices, and worked solutions through MathExpression.
The inspector exposes Edit, Analyze, and Settings. Settings keeps object links
and raw object data in expandable sections; links appear only when another
object or an existing link is available. Output-axis choices relabel plot ranges
without changing the canonical domain layout.
Editor fonts are copied locally by prepare:math during dev/build; no font CDN is
required. Saved scene formats and canonical serialization remain unchanged.

16. Viewport readability and analysis picking
Geometric lines, rays, segments, and parametric curves use screen-width Three.js
node-material strokes on WebGPU and its WebGL2 fallback, with a quieter adaptive
grid. Primitive hover/selection adjusts stroke width without scene edits. The left
rail uses its existing categorized Add menu instead of a permanent shortcut block.
Explicit-surface gradient arrows reuse the scalar worker cache in both 2D and 3D;
3D glyphs are anchored on the graph and retain input-plane gradient directions,
separate from tangent-plane surface normals. Armed differentiation picks preview
the exact source hit in mathematical coordinates before committing; misses,
source updates, cancellation, and pointer exit clear or explain the preview.

The editor has no bottom dock or footer tabs. Parameters, Animation, Console, Diagnostics, and Performance panels have been removed from the editor UI. Measurements remain available through Distance/Angle/Pin in the graph toolbar, with results on the canvas and in the object browser. Saved dock layout settings cannot reopen the removed UI.

The Add picker is a viewport-bounded popover with search, category filters (Graphs, Geometry, Examples, Analysis), and two-column object choices. Basic geometry and ready-made examples are separate; every entry uses the existing canonical creation action. Escape/Close returns focus to Add; creating an object focuses its definition.

Public pages share responsive navigation, the canonical theme preference, and a soft visual style. The guide explains editor workflows with searchable topic navigation on desktop and mobile; Examples continues to open the existing scene gallery. The object actions menu omits generic kind replacements because they reset definitions. It retains Remove and the data-preserving linear transformation dimension switch.

Micro-interactions use the shared control styles: short press/hover feedback, selected theme/accent states, and switch motion that respects reduced-motion preferences. Popovers are labeled, focus their controls, and stay within the viewport. Dialogs and mobile sheets skip hidden fields when trapping focus, including single-control dialogs. Sharing shows real clipboard progress and action feedback; clipboard failures expose the canonical share URL for manual copying. Dialogs scroll inside the viewport on short screens.

Scene menu polish: the wide Scene menu has eight essential actions in Scene, Projects, and Transfer groups. Export formats live in the existing Share and export dialog, reachable from Share or Share & export; repeated format entries and onboarding tips were removed. The compact More actions menu aligns to the right, and save status is informational text rather than a disabled command. Help explains these locations.
Typeset math outputs become keyboard-focusable when their rendered content overflows, including short formulas in narrow cells; fitting inline formulas do not add extra tab stops.


Automatic Cartesian equations: Objects/Expressions has a persistent blank typeset input that plots valid equations as you type, without a kind picker. Relations in x and y (including x=y^2, circles, and named one-variable functions) use the shared implicitCurve scene kind and Canvas2D rendering, with the existing function sampler for y=f(x) and zero contours for general relations, and no surface hatching or 3D mesh. Relations including z use existing explicit/implicit 3D surfaces; bare one-variable expressions plot in 2D and bare two-variable scalar expressions in 3D. Editing an automatic equation reclassifies the same object and changes the active view when its dimension changes. Invalid drafts display a diagnostic and preserve the last valid graph. Enter finalizes the row and starts another equation. Canonical validation, serialization, undo/redo, sharing, and local recovery retain the automatic-entry metadata. SVG curves reuse the canvas contour sampler. Parametric graphs and vector fields remain available through Add rather than ambiguous Cartesian reinterpretation.

Equation-first explicit 3D surfaces follow the camera by default. Renderer-only, quantized input-plane domains expand and recenter while navigating; this preserves canonical equations, saved custom bounds, sampling resolution, and history. Inspector → Plot range → Follow view can be disabled to use a fixed custom range. Manual range edits disable automatic display bounds. Implicit/parametric surfaces retain their explicit finite domains. Camera-driven explicit-surface sampling is throttled and bounded rather than constructing infinite geometry.

Canvas right-click shows a compact scene menu with Add equation, Reset view, Fit scene, and relevant selection/history actions. The object catalog and view switches stay in their existing controls. The menu clamps to the viewport, supports keyboard navigation and Escape, and does not replace native input context menus. Right-clicking a probe pin retains its existing removal behavior.

Sketch fitting preserves mathematical axis pairs (XY, XZ, YZ); world-space 3D strokes convert through the canonical coordinate mapping once. 3D sketch picking uses the active baseline plane rather than flattening surface hits. Freehand sketch input bypasses grid snapping so strokes remain smooth; geometry and measurement tools retain snapping. The existing fitter recognizes lines, parabolas, cubics, and circular arcs within a bounded error tolerance, cleans numerical coefficient noise, and falls back to bounded piecewise-linear parametric expressions for freehand strokes instead of accepting a poor polynomial. Sketches remain ordinary parametric scene objects with the existing serialization, Rust evaluation, and undo paths. Repeated 3D drafts reset their geometry draw range correctly.

The Examples gallery uses the shared soft dialog/control styling, searchable scene choices, and a topic filter. Choices open through the existing validated example and scene-replacement confirmation paths. Search receives initial focus, filters reset on closing, empty results offer Clear filters, and the gallery scrolls within the viewport with a single column on mobile and two columns on desktop.

Example content uses mathematically correct scene kinds and equations: the radius-3 sphere is an implicit surface, the explicit saddle stores its height function, and the preset planar cubic is labeled as a cubic rather than a hand-drawn fit. Descriptions explain the visible shape instead of renderer internals. Opening an example switches to Math Lab and its recommended single view, resets tools/cameras and the primary XY plane, and uses an example-specific replacement prompt. Cancelling replacement restores the gallery and leaves scene content intact. Example regression tests compile and sample every registered scene through the real numeric pipelines and check named geometric identities.

Geometry Studio pane rendering uses the shared WebGPU renderer's top-left viewport coordinates, including its WebGL fallback. The View selector, pane chips, pointer activation, and persisted geometry view use editorStore as their single owner; split selections keep the active plane visible. MathLive placeholder hints use text mode for prose so word spacing is preserved, while equation hints use the canonical math notation formatter. Retired toolbar and unreferenced editor wrappers were removed after checking application and test references.

Named scalar symbols in math inputs create editor parameters automatically (default 1, range -10 to 10). Compact sliders and numeric values appear in the expression panel for referenced parameters and explicit scalar definitions such as a = 2. They use the existing editorStore scope, persist with editor settings, and trigger existing 2D, 3D, and analysis recomputation. Parameterized automatic equations remain valid through canonical scene loading even without their original editor scope; missing controls initialize to 1. General 2D relations entered in the legacy Surface editor convert to implicit curves, while explicit coordinate surfaces retain their selected surface type. Implicit contours use a bounded three-pixel sampling grid and center-field saddle disambiguation. Contour legends distinguish the f = 0 level from the count of contours and hide that note when contours are off.
Implicit-curve grid samples are evaluated in bounded Rust batches; a weak contour-path cache reuses the path for unchanged viewport redraws and invalidates on equation, parameter, pan, zoom, or size changes.

2D equation curves remain planar by default. In a view containing 3D, each expression offers an explicit Extend to 3D toggle; this renders a z-axis extrusion through the existing bounded implicit-surface compute pipeline without changing the curve kind or equation. The toggle is stored in canonical scene data and participates in undo/redo.

Unextended 2D equation curves are also drawn as thick strokes on the XY plane in 3D views. Filled indexed surfaces omit triangle-edge overlays; implicit mesh vertices are welded before normal calculation for smooth shading. Curve extensions use bounded resolution 48 through the existing surface worker.

Implicit surface extraction refines uncertain sign-changing edges further before rejecting them as poles, preventing false holes in smooth oscillating equations. Non-finite crossings and triangle-budget limits remain enforced; budget aborts return no partial mesh.

The optional curve extension toggle lives in each expression’s Object actions (⋯) menu in views containing 3D; the expression row stays compact without a separate extension button or helper paragraph.

Graph stress checks cover dense 2D scenes, maximum-resolution implicit meshes, singular equations, extreme triangle-budget aborts, repeated viewport changes, and Chrome heap recovery. Implicit grids use bounded Rust batches; explicit planar curves use the canonical 1D curve sampler, and unchanged implicit contour evaluators retain their path-cache identity. Numerical and browser measurements are recorded by graphStress.test.ts and graph-stress.spec.ts.

Math Lab retains visited 2D/3D viewport instances across single and split layouts, suspends hidden views, and creates the 3D renderer lazily on first use. Container resize observers keep restored canvases sized correctly, and unchanged canvas backing dimensions do not trigger buffer reallocations. Release checks include a two-minute ordinary-curve session under 4× CPU slowdown, memory/error/reload recovery gates, and accessible solver flows at narrow and desktop widths. CI runs functional browsers against a production build and isolates graph performance in its own Chromium job. Dense-scene pauses remain documented in `docs/graph-stress-report.md`.

Release verification also covers math editing focus and Tab order, solver contrast, interval and geometry notation, and responsive geometry rendering. Quad pane scissors follow the renderer’s current dimensions during layout changes; observer-driven layout writes are deferred to animation frames. Detailed coverage and tool limitations are recorded in `docs/graph-stress-report.md`.

Implicit 3D surfaces also render coordinate-plane zero cross-sections in the Math Lab 2D canvas: XY fixes z=0, XZ fixes y=0, and YZ fixes x=0. The viewport labels these as surface slices, not projections; sampling uses the existing bounded Rust grid and contour cache. Empty math-input hints are non-editable italic overlays, with native italic placeholders in source mode.
