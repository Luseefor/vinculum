# Known Limits

These limits are intentional guardrails to keep the editor responsive and safe.

## Expression safety allowlist

Expression evaluation is sandboxed and validated before rendering.

Commonly allowed:

- Variables: `x`, `y`, `z`, `t`
- Constants: `pi`, `e`
- Functions (examples): `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `sqrt`, `abs`, `exp`, `log`/`ln`, `pow`, `floor`/`ceil`/`round`, `sign`, `max`/`min`

If your expression is too long, too complex, uses an unsupported function, or contains disallowed expression constructs, Vinculum will show inline diagnostics and will not replace your last valid expression.

## Expression input caps

Vinculum enforces:

- Maximum expression length: `2048` characters
- Maximum inspected AST node count: `2500`
- Maximum parametric curve samples: `8192`

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

