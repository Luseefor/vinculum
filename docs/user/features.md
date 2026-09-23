# Features

## Interactive 3D mathematical visualization

Vinculum renders scenes in 3D using the implicit object types supported by the editor:

- Surfaces (implicit equations)
- Planes
- Parametric curves
- Parametric surfaces (x(u,v), y(u,v), z(u,v) with u/v ranges)
- Implicit surfaces (F(x,y,z) = 0 extracted from a bounded 3D sampling box)

Use the 3D viewport controls to orbit/pan/zoom your view.

## 2D plotting and sketch authoring

Vinculum also includes a 2D canvas for plotting and sketch-style authoring.

In 2D mode you can edit and preview mathematical objects, and you can export the current view as PNG or SVG (where supported).

## Scene objects you can author

Objects are built from mathematical definitions:

- **Surfaces**: implicit equations (with a bounded domain and render resolution)
- **Planes**: plane equations with size/appearance
- **Parametric curves**: x(t), y(t), z(t) with a sampling cap
- **Parametric surfaces**: x(u,v), y(u,v), z(u,v) with u/v ranges and grid resolution (3D views only)
- **Implicit surfaces**: F(x,y,z) = 0 as a bare field or equality, extracted from a bounded x/y/z sampling box (3D views only)

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

An optional Performance HUD can be enabled from the editor’s theme/appearance menu. It is off by default.

