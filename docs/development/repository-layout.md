# Repository layout

## Workspaces

| Path | Responsibility |
| --- | --- |
| `apps/graph/` | Next.js application, editor, rendering, scene I/O, workers, tests |
| `packages/scene/` | Shared domain types, object-kind list, defaults; no app or renderer dependencies |
| `apps/graph/rust/math-core/` | Rust numerical evaluator compiled to WASM |
| `apps/video/` | Optional showcase video; not required to run the editor |
| `scripts/` | WASM/assets preparation, dependency gates and checked public-source exports |
| `patches/` | Versioned dependency patches applied by Bun; regression checks live in `scripts/` |
| `docs/user/` | Supported workflows and numerical limits |
| `docs/development/` | Contributor navigation and object-type integration |
| `docs/architecture/` | Core engine design |
| `docs/reports/` | Dated audits and verification evidence |
| `docs/archive/` | Historical instructions and initial test reports; not current requirements |
| `docs/agent/` | Coding-agent contracts, plans, and architecture decisions |

## Graph application

The existing feature folders stay authoritative:

| Path inside `apps/graph/` | Responsibility |
| --- | --- |
| `app/` | Routes, layout, global styles |
| `components/editor/`, `components/layout/` | Editor composition, chrome, menus |
| `components/objects/`, `components/expressions/`, `components/inspector/` | Object authoring and analysis UI |
| `components/viewport/` | View mounting and layout |
| `components/graph/graph2d/` | Canvas2D rendering, interaction, overlays, fitting |
| `lib/graph3d/` | Existing Three.js engine, builders, scene synchronization, disposal |
| `lib/graph/` | App-level object constructors |
| `lib/objects/` | Shared creation catalog and actions |
| `lib/scene/` | Canonical scene validation, migrations, cloning, serialization |
| `store/` | Canonical graphStore and slices: scene/tool state |
| `lib/store/` | Existing editorStore, historyStore, scene snapshot coordination |
| `lib/compute/`, `workers/` | Worker protocols, scheduling, result caches, worker entrypoints |
| `lib/projects/`, `lib/share/`, `lib/export/` | Local projects, share links, real exports |
| `test/<domain>/` | Unit, component, integration, and regression tests |
| `e2e/` | Playwright workflows and shared helpers |

Do not merge `store/` and `lib/store/` just to make the tree look uniform: their
ownership is intentional. Do not create parallel rendering or serialization
paths when adding a feature.

## Math domains

`apps/graph/lib/math/` is divided by responsibility:

| Folder | Contents |
| --- | --- |
| `expressions/` | Safety, notation, classification, diagnostics, expression-family compilers |
| `runtime/` | Rust/WASM adapter and generated artifact |
| `curves/` | Curve sampling, continuity, curve geometry, finite extensions |
| `surfaces/` | Mesh sampling, plane sampling, implicit extraction, indexed bounds |
| `geometry/` | Math/world coordinate conversion, primitive relations, intersections, solids, region operations |
| `fields/` | Scalar/vector fields, streamlines, polar/complex analysis, color and glyph policies |
| `calculus/` | Differential analysis, integration, quadrature, solution descriptions |
| `linear-algebra/` | Matrices, eigensystems, transform resolution |
| `sketch/` | Stroke preparation, fitting, shape recognition, expression formatting |

Import the owning module directly, normally via `@/lib/math/<domain>/<module>`.
No compatibility barrels or duplicate modules are maintained at old paths.

## Local output

`.agents/`, `.local/`, browser test reports, build output, and raw `page@*.webm`
captures are ignored. Existing tracked agent run logs were preserved locally
under `.local/agent-runs/teamwork/`. They are not contributor documentation.
Moving them out of the current tree does not remove them from Git history.

For a history-free publication snapshot and media inventory, follow the
[public release workflow](public-release.md).
