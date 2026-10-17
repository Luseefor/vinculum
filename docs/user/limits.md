# Known Limits

Some limits are safety budgets; others are numerical, rendering, or browser constraints.

## Expression safety allowlist

Expression evaluation is sandboxed and validated before rendering.

Commonly allowed:

- Variables: `x`, `y`, `z`, `t`, plus `u`, `v` inside parametric-surface coordinate expressions
- Vector-field components use only `x`, `y` (2D) or `x`, `y`, `z` (3D) plus parameters; `u`, `v`, `t` are rejected there
- Constants: `pi`, `e`
- Functions (examples): `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sqrt`, `abs`, `exp`, `log`/`ln`, `pow`, `floor`/`ceil`/`round`, `sign`, `max`/`min`

If your expression is too long, too complex, uses an unsupported function, or contains disallowed expression constructs, Vinculum will show inline diagnostics and will not replace your last valid expression.

## Expression input caps

Vinculum enforces:

- Maximum expression length: `2048` characters
- Maximum inspected AST node count: `2500`
- Maximum parametric curve samples: `8192`
- Maximum surface resolution: `128` (explicit and parametric surfaces)
- Maximum parametric-surface grid: `129 × 129` vertices (~200KB positions, within a 2MB allocation budget)
- Maximum implicit-surface resolution: `48` (default `32`); the sampling grid is `(resolution + 1)^3` (up to `49^3 = 117,649` samples)
- Vector-field density: `2–32` per axis in 2D (up to `32 × 32 = 1024` arrows), `2–12` per axis in 3D (up to `12^3 = 1728` arrows); arrow scale is bounded to `0.1–3`

Explicit and implicit surfaces show coordinate-plane cross-sections in 2D and SVG export: XY fixes z=0, XZ fixes y=0, and YZ fixes x=0. These are intersections, not projections; a surface that does not cross the plane has an empty slice. Fixed ranges clip the slices; automatic explicit surfaces follow each viewport. Plane slices use the finite displayed plane patch. Flat coordinate-plane surfaces show their area. 3D parametric surfaces use triangle/plane intersections from the same sampled mesh as 3D; coplanar triangles retain their area and exact sampled contact points are marked. Spatial points, vectors, lines, rays, and segments also show their actual intersections with the chosen plane. Off-plane objects can have empty slices. Canvas and SVG share these drawing routines, including hatching. 2D parametric surfaces draw filled XY regions using the same valid sampled triangles, including in SVG; they are not coordinate-plane slices of a 3D surface. Parametric curves project onto the selected axes using the canonical curve samples and continuity mask.

Planar Cartesian curves in 3D follow bounded camera sampling tiles rather than imposing a ±5 coordinate cutoff. Sampling remains finite (2,049 points for explicit curves; a 257×257 grid for general relations), so narrow or highly oscillatory features can be missed as the displayed range grows. Optional curve extensions use the existing bounded implicit mesh sampler.

## 2D Fit and Frame

Fit and Frame selected work in standalone and combined 2D views, including the
active 2D quad pane. Finite samples, primitive intersections, matrix diagrams,
and field arrows determine their bounds. Unbounded relations search the current
window, with a status message explaining that they may continue outside it.
An empty slice reports that no geometry was found. This bounded numerical fit
cannot establish global bounds for arbitrary equations or discover all off-screen
components; choose a suitable window or finite plot range first.

## Heavy geometry computation

Solid analysis runs in the existing geometry worker. Volume between two explicit functions uses finite, continuous boundaries over a saved rectangle; sampled jumps, poles, and undefined values are rejected. Boundary area includes both graphs and the four rectangular side walls. Coincident functions enclose zero volume and have zero solid boundary area. Continuity screening is numerical and can miss narrow features or singularities between samples.

Enclosed-volume analysis for implicit and parametric surfaces welds sampled seams and requires each mesh edge to have two consistently oriented faces. Open or clipped meshes are rejected. Implicit analysis uses resolutions 16/32/48; parametric volume uses 32/64/128. Each computation compares two resolutions and caps output at 80,000 triangles. Small components may be missed; closure checks do not establish that a parameterization is injective or free of self-intersections. Avoid overlapping or multiply covered parameterizations. Reported uncertainty is an estimate, not a guaranteed error bound. Implicit surface area measures the sampled surface inside the bounds and does not add caps to a clipped surface.

Surface intersection analysis supports explicit, implicit, and parametric
surfaces paired with one another or a plane. It uses saved finite plot ranges
(and the displayed plane size), with analysis sampling capped at 40 for explicit
and parametric surfaces and 20 for implicit surfaces. The intersection curve,
length, and sample coordinates are approximations; small components and tangent
contacts may be missed. Shared sampled areas have no unique curve. Computation
and output budgets return a diagnostic instead of a partial solution. Results
are cached by definitions and parameters and refreshed after edits. This bounded
analysis runs synchronously; it does not replace the background mesh renderer.
The Solution section shows both constraints and, where possible, their symbolic
substitution, rather than claiming a general closed-form intersection solver.

Implicit and parametric surface meshes are computed in a background worker,
so editing, orbiting, and menus stay responsive while a high-resolution
surface builds. The previous mesh stays visible until the new one is ready;
a small dot next to the object name marks computation in progress.

Resolution limits are unchanged: implicit surfaces cap at `48`, parametric
and explicit surfaces at `128`. Very dense meshes can still slow down frame
rates on low-power GPUs (rasterization cost, not computation).

Dense scenes can still pause during zoom and view changes, especially during the first 3D renderer startup. Repeated curve redraws reuse bounded path caches. See the
[graph stress report](../reports/graph-stress.md) for measured workloads,
efficiency changes, and remaining performance limits.

## Vector fields

A vector field is one scene object (`F(x,y) = <P, Q>` in 2D, `F(x,y,z) = <P, Q, R>`
in 3D). 2D fields draw as Canvas2D arrows in 2D views; 3D fields draw as
instanced arrows in Geometry Studio (all synchronized views show the same field).
3D sampling runs in the background worker like surfaces; changing arrow scale,
normalize, color, or visibility never resamples. Samples that fail to evaluate
(for example `1/x` at `x = 0`) are omitted while the rest of the field renders.
2D SVG export draws 2D field arrows through the same drawing routine. 3D fields remain spatial objects, with an explicit export warning when absent from the selected 2D plane.

## Browser storage limits

Named projects and recovery snapshots are compressed in your browser’s `localStorage`. Existing uncompressed saves remain readable, and JSON export remains the portable backup format.

Browser quotas and storage permissions still apply. Failed saves report an actionable error and preserve the previous saved data; export a JSON backup if site storage is blocked or full. Clearing site data removes local projects.

## Share-link URL size limit

Share links compress the canonical scene JSON into a URL query parameter (`?scene=...`). Existing uncompressed links remain readable. Decompression has bounded input/output sizes and the normal scene validation still applies.

There is a maximum URL length (default `6000` characters). If the encoded payload exceeds the limit, share link creation is blocked and you should use JSON export instead.

## GPU / 3D constraints

3D export and the 3D performance features rely on the GPU-rendered viewport. The renderer uses WebGPU when available and falls back to WebGL2.

Editor styling requires Safari 16.4+, Chrome 111+, or Firefox 128+, following
the [Tailwind 4 browser requirements](https://tailwindcss.com/docs/compatibility).
GPU support and available device memory remain separate constraints.

During slow camera navigation, the 3D image temporarily uses fewer screen pixels.
Full resolution returns one second after navigation stops, and PNG capture always
draws at full resolution. Object geometry, sampling, equations and saved scene
data are unchanged. Fast navigation retains full resolution.

If both GPU backends are unavailable or the renderer is not ready, 3D PNG capture may fail. The viewport provides retry and scene JSON export when initialization fails or the GPU device is lost.

## Piecewise sampling

Piecewise notation accepts at most 16 cases per group and uses the existing expression length and execution limits. Conditions are checked in order. Undefined cases produce no geometry. Finite jumps in cases, `floor`, `ceil`, `round`, and `sign` use bounded continuity probes; existing pole detection remains in place. Surface boundaries use the chosen mesh resolution, so they can appear stepped or leave a narrow gap. Features narrower than the sampling interval can be missed. The graph is a numerical approximation, not a proof of continuity. Open/closed endpoint circles are not currently drawn.

## SVG export limitations

SVG uses the canonical Canvas2D graph and grid painters, preserving theme colors, grid labels, vector arrows, transformation diagrams, curve discontinuities, and coordinate-plane intersections. Visible objects with no geometry in the chosen plane produce an explicit warning. Transient editor overlays (selection, probes, measurements, scalar-analysis layers, and streamlines) are not part of the vector scene export; use 2D PNG to capture the displayed canvas.

## No accounts or collaboration (yet)

Vinculum is currently local-first: there is no account system and no multi-user collaboration.


## Symbolic field analysis

Symbolic derivatives use the existing expression-safety policy; unsupported
rules show `unavailable`, with no silent numerical substitute. Simplified
answers apply only on the original source's differentiable domain. Direction
is undefined at a zero field or gradient. Polar field calculus requires `r > 0`;
polar field plots omit the origin. Polar scalar surface plots start at `r = 0.05`.

Complex `f(z)` expansion supports arithmetic, integer powers from 0 to 12,
`exp`, `sin`, `cos`, and `conj`. Use explicit `u(x,y), v(x,y)` components for
other functions. Logarithm and root branches are not automatically expanded.
Complex divergence and curl mean divergence/curl of the real field `(u,v)`.
Cauchy–Riemann equality at an isolated point does not prove analyticity.
Nonlinear or dependent residual systems expose their conditions without
claiming a closed-form solution. Harmonic-conjugate construction uses verified
polynomial integration up to degree 8 in each integration variable.

The solver's input drafts persist while the editor remains mounted. Plotted
objects use the existing scene format and survive save/export/reload; the
original polar or complex notation is converted to canonical expressions.
No new persistent object kinds or scene format are introduced. Scalar functions
of three variables can be analyzed symbolically; the solver does not plot their
volumetric values. Integral overlays describe numerical quadrature and its error
estimate, rather than a general theorem-proof engine.

Scene schema v2 stores parameter values and slider bounds. Earlier shared files did not contain those values, so migration cannot recover original slider settings; missing legacy parameter values start at 1. Existing local sessions can retain matching values from their editor settings. Parameter snapshots are limited to 256 names, with at most 64 characters per name, and require finite values inside finite slider bounds.

Heat maps, contour lines, and gradient fields follow the same bounded display range as explicit surfaces when Follow view is enabled. Navigation resamples only when the quantized display range changes. Custom bounds remain unchanged in saved scenes. 3D heat maps and contours use the rendered surface triangles, preserving gaps and keeping contours on the surface rather than floating above or below it.

Visible 2D and 3D panes share scalar samples over their combined bounded display ranges. Widely separated views share the fixed sampling budget, which can reduce detail. Hiding a pane removes its range. In 2D, contour values sit in gaps in the contour lines and turn with the line; labels that would collide or fall outside the view are omitted.


## Geometric region operations and planar intersections

Union, intersection, and subtraction support equation curves, explicit surfaces,
implicit surfaces, and planes. Parametric objects, points, vectors, and fields
do not supply an implicit inside region. Mixed dimensions require extending the
2D curve first. Operations use F ≤ 0; reversing an implicit equation’s sign
reverses its inside. Saved implicit bounds and extension Z ranges clip operand
regions. Explicit surfaces clip their two input ranges. Unbounded axes and 2D
regions start with a finite default sampling range (±5 on unbounded axes).
To edit that range directly, make the result independent first. Results use sampled zero boundaries,
so thin features and contacts without interior may be missed.

Source links persist in scene schema v3 and support at most 12 dependency levels,
subject to the existing expression and sampling budgets. Invalid source drafts
hide the derived result until corrected. Deleting a source removes its dependent
results; use Make independent first to keep a frozen result.

Planar curve intersections sample a 128-cell grid in quantized active XY view
bounds and refine candidates against both equations. Markers update with the
view and parameters. Small, coincident, or tangent features can be unresolved or
missed; results do not prove that every intersection was found.

Saved, shared and imported scene documents require complete object definitions,
including hidden objects. Finish or remove an unfinished row before saving or
exporting. Invalid imports leave the current scene untouched. Unfinished live
authoring rows remain available in the current browser session.
