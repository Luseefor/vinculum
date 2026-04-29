Vinculum — Project description
This document describes the Vinculum monorepo as it exists today: purpose, architecture, packages, runtime behavior, developer workflows, quality gates, and CI. It is intended for onboarding, planning, and handoffs.

1. High-level summary
Vinculum is a Bun workspaces monorepo whose primary ship unit is @vinculum/graph: a Next.js 14 (App Router) single-page editor for interactive 3D mathematical visualization (Three.js), paired with a 2D plotting / sketching canvas for constraints and parametric authoring. Scene data uses typed graph objects (implicit surfaces, planes, parametric curves) validated and evaluated with mathjs expressions.

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
Expressions evaluated at runtime (mathjs): surfaces z = f(x,y) (with orientation variants), planes, and parametric (x,y,z) in t.
Sketch-to-curve: freehand strokes in 2D are fitted to a parametric curve via least-squares-style fitting (lib/math/fitParametricSketch*.ts).
Object browser (left rail): list objects, visibility, colors, counts; data-testid="scene-object-count" on the numeric badge for testing.
Inspector / expressions (right rail): edit object parameters and expressions with validation feedback.
Undo/redo (historyStore) tied to scene edits.
Theme: light/dark/system resolution, accent presets, persisted preferences; toolbar menus close on Escape where implemented.
Scene lifecycle: New scene clears or confirms when objects exist (TopToolbar + NewSceneDialog pattern); aligns with undo/history clearing on confirm.
Import/export JSON scene documents (deserializeScene / serializeScene, dialogs).
Constraints (editor-level): attach/align/offset between objects with derived updates (applyConstraintDerivedUpdates).
Responsive layout: collapsible rails, resize handles, breakpoints; bottom panel tabs (parameters, console, etc. per editorStore).
Command palette, context menus, status bar as supporting UI.
3.2 Non-goals / boundaries (current code)
The repo is optimized for browser-hosted mathematical graphing—not a general CAD suite.
Networking, accounts, or collaborative editing are not required by the core stores (session persistence is browser-local unless extended).
4. Technology stack
Layer	Choices
Package manager / runtime	Bun (workspace scripts, installs)
Framework	Next.js 14 App Router (apps/graph/app/)
UI	React 18, Tailwind CSS, internal UI primitives (components/ui/)
3D	three, three-stdlib
Math	mathjs
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