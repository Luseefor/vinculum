# Adding graph and object types

Prefer a preset or definition conversion using an existing kind. A new
persistent kind is appropriate when existing definitions cannot represent its
mathematics and editing behavior. There is no plugin loader or separate scene
format: extend the canonical systems below.

## Existing view semantics

| Definition | Canvas2D | Three.js |
| --- | --- | --- |
| Cartesian `implicitCurve` | XY relation or explicit function | Same relation on math z=0; optional finite Z extension |
| Explicit surface | Intersection with selected coordinate plane; coplanar area when applicable | Sampled surface mesh |
| Implicit surface | Bounded zero cross-section | Bounded isosurface mesh |
| Parametric curve, 2D or 3D | Projection onto selected axes using canonical samples and continuity mask | Canonical sampled curve; planar curves have z=0 |
| 2D parametric surface | Filled XY mesh | Planar sampled mesh |
| 3D parametric surface | Mesh/plane intersection, including sampled areas and contacts | Sampled mesh |
| Plane | Intersection of the finite displayed patch | Same finite patch |
| Point, vector, line, ray, segment | Actual coordinate-plane intersection; off-plane geometry can be empty | Spatial primitive |
| 2D vector field | Planar arrows and optional analysis | Intentionally omitted; notice offers Show in 2D |
| 3D vector field | Intentionally omitted with a notice | Worker-sampled instanced arrows |
| 2D linear transformation | XY basis/unit-square diagram | Planar basis/unit-square diagram |
| 3D linear transformation | Intentionally omitted with a notice | Spatial basis/unit-cube diagram |

XY fixes z=0, XZ fixes y=0, and YZ fixes x=0 for intersections. Math and Three.js
coordinates differ; always use `lib/math/geometry/coordinates.ts`. An empty
slice is a valid mathematical result. Projection and intersection are distinct
contracts and must not be interchanged to make an object visible.

## Integration sequence

1. **Domain and defaults.** Add the kind to `GRAPH_OBJECT_KINDS`, its discriminated
   `GraphObject` variant in `packages/scene/src/types.ts`, and defaults in
   `packages/scene/src/defaults.ts`. Keep app and renderer dependencies out of
   this package.
2. **Construction and editing.** Extend the existing `lib/graph/` constructors,
   `store/graphStoreObjectFactory.ts`, store types and owning slices. Define
   blank-draft behavior, dimensions, conversion, duplication, insert-after,
   history, removal, and parameter discovery. Drafts are transient; do not
   assume they round trip as finished scene definitions.
3. **Canonical scene I/O.** Extend `lib/scene/sceneSchema.ts` cloning,
   `validateSceneGraphParsers.ts`, and any affected parameter logic. Define a
   migration in the existing `validateScene.ts` pipeline when persisted shape
   changes. Reject malformed imports before applying them. Projects, recovery,
   sharing, and JSON export must keep using this pipeline.
4. **Math.** Add bounded compilation/sampling to the relevant math domain.
   Reuse expression safety and the Rust adapter. Define invalid samples,
   continuity, budgets, and cancellation behavior. Keep render buffers out of
   scene data.
5. **Creation UI.** Add metadata to `lib/objects/objectDescriptors.ts` and a
   creator to the existing typed `objectCreators` map in `objectCreation.ts`.
   Keys are derived from the catalog; a missing creator fails typecheck.
   Automatic Cartesian equations use `inferGraphEquation` and
   `lib/graph/createEquationGraph.ts` instead of a separate Add entry.
6. **Rendering.** Extend the canonical 2D renderable builder and painter in
   `components/graph/graph2d/`; define XY/XZ/YZ behavior. Extend Three.js guards,
   `renderDescriptors.ts`, `buildGraphAssemblies.ts`, signatures, and disposal
   in `lib/graph3d/`. Exhaustive dispatch makes omitted kinds fail typecheck.
   For heavy geometry, extend the existing compute protocol, manager/sync,
   worker, and result paths. Vector fields deliberately bypass synchronous
   assembly because their glyphs consume worker results.
7. **Authoring and analysis.** Extend existing object-row display metadata,
   expression editors, inspector, picking, Fit/Frame, and any supported
   analysis. Explicitly handle unsupported views or operations. Do not leave
   a working-looking control disconnected.
8. **Export and coverage.** SVG reuses Canvas2D painters through
   `lib/export/sceneExport.ts`; add only the missing primitive support to
   `svgCanvasContext.ts` if needed. Define warnings for omitted content.
   Add round-trip, invalid-input, dimension, viewport, parameter-update,
   undo/redo, worker-staleness, disposal, and export tests relevant to the kind.

## Tests that catch incomplete integrations

- `test/objects/objectTypeIntegration.test.ts` iterates every canonical kind
  through factories and scene round trips, and every catalog key through
  actual creation, selection, and focus. Update the deliberate automatic-entry
  exception if another kind is authored without an Add entry.
- `test/rendering/renderingViewParity.test.ts` checks sampling, coordinate
  planes, bounded ranges, SVG, and supported viewport paths.
- Existing geometry, compute, fields, scene, export, and browser tests cover
  behavior beyond construction. Add a representative fixture for the new type;
  successful construction alone does not prove it renders correctly.

Run the [contributor checks](../../CONTRIBUTING.md) and document numerical
limits in `docs/user/limits.md`. A complete integration is a vertical slice
through these owners, not a second registry containing new math or scene state.

Portable scene documents reject incomplete definitions for every kind; live
authoring rows may remain unfinished. See the [document policy](public-release.md#blank-definitions)
and `test/scene/blankDefinitions.test.ts` when adding a kind.
