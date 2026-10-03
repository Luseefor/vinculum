# Getting started

Vinculum is a browser workspace for graphing and exploring mathematics in 2D and 3D. Open the editor from the home page, or run it locally with `bun install` followed by `bun run dev`.

## Add your first graph

1. Choose **Math Lab** for functions and fields, or **Geometry Studio** for geometric objects.
2. Open **Objects**, then **+ Add**. Search for a type or choose a category.
3. Choose **Surface** and enter `sin(x)*cos(y)` in its definition to graph `z = sin(x)*cos(y)`. Use **Implicit Surface** for an equation of the form `F(x,y,z) = 0`.
4. Switch between **2D** and **3D** with the view controls.
5. Select the object and open **Inspector** to edit its definition, style, and analysis.

On phones, Objects and Inspector open as sheets. Close the sheet to return to the graph. Formula inputs support typeset editing and a math keyboard.

**Examples** opens the existing scene gallery. Loading an example into a nonempty scene asks before replacing it.

## Explore or solve

Use **Analyze** on a selected object for supported derivatives, gradients, vector calculus, and geometric relations. A point picker previews coordinates before you click.

Use **Solve** in Math Lab for scalar, vector, polar, and complex field problems. Supported answers calculate automatically. **Show solution** opens the worked steps. **Add to scene**, where available, creates a plot; solver drafts themselves are not project objects.

Use **Distance**, **Angle**, and **Pin** from the canvas toolbar for measurements. Results appear on the graph and in Objects.

## Save and share

Use the scene menu to save a named local project or reopen one. Browser storage is local to that browser; export JSON for a portable backup.

The scene menu also provides share links, JSON export/import, 2D PNG/SVG export, and 3D PNG export. A share link contains a snapshot of the scene; later edits do not change it. Use JSON when a scene exceeds the share-link limit.

The public [guide](/documentations) includes topic navigation, expression examples, and troubleshooting.
