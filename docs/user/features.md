# Features

## Interactive 3D mathematical visualization

Vinculum renders mathematical scenes in 3D using the object types supported by the editor:

- Surfaces (explicit functions)
- Planes
- Parametric curves
- Parametric surfaces (x(u,v), y(u,v), z(u,v) with u/v ranges)
- Implicit surfaces (F(x,y,z) = 0 extracted from a bounded 3D sampling box)
- Points, vectors, lines, rays, and segments
- 3D vector fields and 2D/3D linear transformations
- Planar Cartesian equations and 2D parametric objects embedded at z=0

Use the 3D viewport controls to orbit/pan/zoom your view.

## 2D plotting and sketch authoring

Vinculum also includes a 2D canvas for plotting and sketch-style authoring.

In 2D mode you can edit and preview mathematical objects, and you can export the current view as PNG or SVG (where supported).

## Scene objects you can author

Objects are built from mathematical definitions:

- **Surfaces**: explicit functions (with a bounded domain and render resolution)
- **Planes**: plane equations with size/appearance
- **Cartesian equations**: automatic classification of planar relations and spatial surfaces
- **Parametric curves**: 2D or 3D coordinates with a sampling cap
- **Parametric surfaces**: 2D filled XY regions or 3D meshes with u/v ranges and grid resolution
- **Implicit surfaces**: F(x,y,z) = 0 as a bare field or equality, extracted from a bounded x/y/z sampling box
- **Geometry**: points, vectors, lines, rays, and segments defined by coordinates
- **Vector fields**: 2D planar arrows or 3D spatial arrows
- **Linear transformations**: 2D or 3D matrix diagrams

Spatial surfaces and primitives show coordinate-plane intersections in 2D;
parametric curves project onto the selected axes. An off-plane object can have
an empty slice. 3D fields and 3D transformation diagrams remain in the spatial
viewport. See [known limits](limits.md) for the detailed view semantics.

## Projects (save/load) and recovery

You can save scenes as **named local projects** (stored in your browser), reopen them later, and recover in-progress work after a restart.

## Shareable scene links

You can create share links that reconstruct the scene by encoding the scene document in the URL.

If a scene is too large for the URL size limit, Vinculum will guide you to use JSON export instead.

## Export

Vinculum can export:

- Scene JSON (portable, versioned)
- PNG exports for 2D and 3D views
- 2D SVG exports (best-effort; some features may appear as warnings)

## Safety and diagnostics for expressions

Math expression inputs are sandboxed and validated before evaluation. Invalid or unsafe expressions produce inline diagnostics in the inspector, so the editor remains responsive.

## Optional performance HUD

Enable the Performance HUD from the editor's Appearance menu to inspect
measured rendering performance. It is off by default. In 3D, FPS counts
submitted draw frames; an unchanged viewport deliberately stops drawing and
can show zero FPS while idle. Navigation and scene changes resume drawing.

## Automatic field solutions

In Math Lab, choose **Solve** and enter vector components, a scalar function,
a polar curve, or a complex function. Answers update automatically; no analysis
point is required for symbolic curl, divergence, gradients, or Laplacians.
**Show solution** opens the formula, derivative steps, final answer, and domain
conditions. Existing integral results also offer a numerical calculation overlay.

Polar definitions use `r` and `theta` (radians). Vector components refer to the
orthonormal radial and angular basis. **Add to scene** creates canonical
Cartesian vector fields, explicit surfaces, or parametric curves/surfaces from
these definitions. For complex functions, choose the associated `(u,v)` field,
real part, imaginary part, magnitude, or phase before adding the plot.

Selected fields and surfaces also have automatic solutions in **Analyze**.
For a 2D field, choose **Complex function P + i Q** to check Cauchy–Riemann
conditions. The solver can verify identities, reject constant contradictions,
solve independent linear residual systems, and construct supported polynomial
harmonic conjugates with an arbitrary additive real constant.
