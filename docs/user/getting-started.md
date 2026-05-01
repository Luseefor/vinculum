# Getting Started

Vinculum is a browser-based editor for authoring mathematical scenes and exploring them in 2D and 3D.

## 1. Launch Vinculum

Run the app locally:

```bash
bun install
bun run dev
```

## 2. Choose 2D or 3D

Use the viewport mode controls to switch between:

- **3D**: orbit-style navigation with surfaces/planes/parametric objects
- **2D**: plotting and sketch authoring

## 3. Add a scene object

From the **object browser** (left rail), add:

- **Surface** (implicit equation)
- **Plane**
- **Curve** (parametric curve)

You can also open **Examples** to load a ready-made scene.

## 4. Edit equations and parameters

When an object is selected, edit its expressions/parameters in the inspector (right rail). Inputs provide inline diagnostics (and will not silently overwrite a valid expression with an invalid one).

## 5. Save and reopen your work

Use the **Scene** menu to save your current work as a **named project** and reopen it later.

Vinculum also supports local **autosave/recovery** for in-progress work.

## 6. Share or export

In the **Scene** menu you can:

- **Copy share link** (URL-encoded scene payload with a size guard)
- **Export Scene JSON**
- **Export 2D PNG** / **Export 2D SVG**
- **Export 3D PNG**

For larger scenes that don’t fit the share-link size limit, export JSON instead.

