# Known Limits

These limits are intentional guardrails to keep the editor responsive and safe.

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

Parametric and implicit surfaces render in 3D views only; 2D plotting and 2D SVG export skip them (SVG export reports a warning per skipped object).

## Heavy geometry computation

Implicit and parametric surface meshes are computed in a background worker,
so editing, orbiting, and menus stay responsive while a high-resolution
surface builds. The previous mesh stays visible until the new one is ready;
a small dot next to the object name marks computation in progress.

Resolution limits are unchanged: implicit surfaces cap at `48`, parametric
and explicit surfaces at `128`. Very dense meshes can still slow down frame
rates on low-power GPUs (rasterization cost, not computation).

## Vector fields

A vector field is one scene object (`F(x,y) = <P, Q>` in 2D, `F(x,y,z) = <P, Q, R>`
in 3D). 2D fields draw as Canvas2D arrows in 2D views; 3D fields draw as
instanced arrows in Geometry Studio (all synchronized views show the same field).
3D sampling runs in the background worker like surfaces; changing arrow scale,
normalize, color, or visibility never resamples. Samples that fail to evaluate
(for example `1/x` at `x = 0`) are omitted while the rest of the field renders.
2D SVG export does not draw field arrows yet and reports a warning per field
instead of silently omitting it.

## Browser storage limits

Named projects and recovery snapshots are stored in your browser’s `localStorage`.

If `localStorage` is unavailable (for example, restricted browser settings), saving/loading projects may fail.

## Share-link URL size limit

Share links encode the scene into a URL query parameter (`?scene=...`).

There is a maximum URL length (default `6000` characters). If the encoded payload exceeds the limit, share link creation is blocked and you should use JSON export instead.

## WebGL / 3D constraints

3D export and the 3D performance features rely on the WebGL-rendered viewport.

If WebGL is unavailable or the renderer is not ready, 3D PNG capture may fail and the UI will instruct you to try again after the viewport finishes rendering.

## SVG export limitations

2D SVG export is best-effort. It may include warnings when an object uses features that are not yet represented in SVG output.

You can still download the SVG, but some object types/paths may not appear exactly like the canvas preview.

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
