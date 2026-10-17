# Changelog

## Unreleased

- Organize math modules and tests by domain, and separate contributor guides,
  architecture, reports, and historical documentation.
- Add MIT licensing and contributor documentation.
- Require typed creation actions and exhaustive object-kind dispatch; add
  integration coverage for canonical kinds, dimensions, scene round trips,
  and representative viewport support.
- Reveal extended Cartesian curves in 3D while retaining the saved definition.
- Wait for the lazy math editor before starting the share-link browser workflow.
- Document the 2D/3D support matrix and unresolved public-release findings.
- Keep the in-memory editor usable when session storage is unavailable, and
  keep manually oriented automatic surfaces valid for saving and sharing.

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

