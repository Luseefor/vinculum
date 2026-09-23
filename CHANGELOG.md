# Changelog

## Unreleased

- Added true implicit 3D surfaces `F(x,y,z) = 0` via marching-tetrahedra extraction from a bounded scalar grid, with synchronized Perspective/XY/XZ/YZ views and sphere/ellipsoid/torus/gyroid examples and presets.
- Added parametric surfaces `x(u,v)`, `y(u,v)`, `z(u,v)` with independent `u`/`v` domains, grid resolutions 2–128, synchronized Perspective/XY/XZ/YZ views, and sphere/torus/saddle examples and presets.
- Scene documents now include an explicit schema version, with a migration pipeline for older/missing-version payloads.
- Added local named project persistence and recovery snapshots stored in the browser.
- Added shareable scene links (URL-encoded scene payload) with a size guard and safe fallbacks for invalid/unsupported payloads.
- Polished export pipeline with:
  - JSON export
  - 2D PNG export
  - 2D SVG export (best-effort; may include warnings)
  - 3D viewport PNG export
- Added an Examples gallery and first-run welcome dialog to help users get started quickly.
- Hardened math expression handling:
  - expression safety allowlist
  - input length/complexity/sampling caps
  - inline expression diagnostics and debounced preview/commit behavior
- Added a Performance HUD foundation (optional, off by default) and heavy-scene warnings (non-blocking).
- Accessibility final pass:
  - keyboard-first operation for core menus/dialogs/controls
  - improved focus management and ARIA semantics
  - reduced-motion compatibility for UI transitions

