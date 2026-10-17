# Getting started

Vinculum is a browser workspace for graphing and exploring mathematics in 2D and 3D. Open the editor from the home page, or run it locally with `bun install` followed by `bun run dev`.

The empty canvas shows one start panel. **Open example** opens the scene gallery;
choosing an object creates it and focuses its definition. **Quick tips** expands
inline on your first visit. Hide the panel with its close button or press Escape
while focused inside it; **Start** reopens it. The rest of the canvas stays usable. Quad starts with the panel minimized to
keep all four views clear.

## Add your first graph

1. Choose **Math Lab** for functions and fields, or **Geometry Studio** for geometric objects.
2. Open **Objects**, then **+ Add**. Search for a type or choose a category.
3. Choose **Surface** and enter `sin(x)*cos(y)` in its definition to graph `z = sin(x)*cos(y)`. Use **Implicit Surface** for an equation of the form `F(x,y,z) = 0`.
4. Switch between **2D** and **3D** with the view controls.
5. Select the object and open **Inspector** to edit its definition, style, and analysis.

For automatic equation entry, type in the blank input in **Objects**, or choose **Add → Empty expression**. Equations such as `x=y^2` open the XY graph; including `z`, as in `x=y^2+z^2`, opens 3D. Split and Quad layouts stay open. Invalid drafts keep the last valid plot. Press Enter to finish a direct entry or continue in a new row after an Add-created expression.

Equation rows stay editable inline, including rows created with Add → Empty expression. The blank equation input stays in place while plotting a preview; press Enter to finish it and continue with another equation.

On phones, Objects and Inspector open as sheets. Close the sheet to return to the graph. Formula inputs support typeset editing and a math keyboard.

**Examples** opens the existing scene gallery. Loading an example into a nonempty scene asks before replacing it.

## Understand the 2D and 3D views

An ordinary equation in `x` and `y` stays on the XY plane in 3D. Its sampled display range follows the camera. **Extend to 3D** extrudes that relation along the z axis. Set **z min** and **z max** in **Inspector → Edit** to control the finite extension; those bounds are saved with the scene.

For explicit and implicit surfaces and planes, 2D shows the intersection with the selected coordinate plane: XY fixes `z=0`, XZ fixes `y=0`, and YZ fixes `x=0`. Fixed surface bounds and the plane's displayed size still apply; explicit surfaces with **Follow view** enabled sample the visible range in each view. A surface that does not cross the chosen plane has an empty slice. A flat surface coinciding with that plane shows its area. Parametric curves instead show their projection onto the chosen axes, using the same samples and branch breaks as 3D.

Viewport notes explain these differences. 3D parametric surfaces, spatial geometry, 3D fields, and 3D transforms remain in 3D; 2D vector fields remain in 2D. Planar equations, 2D parametric regions, and 2D transform diagrams use the XY canvas. If a planar equation or transform is missing in XZ or YZ, choose **Show on XY** in that pane. The other pane and layout stay unchanged.

## Solid area and volume

Select a surface and open **Inspector → Analyze → Integral Analysis**. For an explicit surface, choose **Volume between functions** or **Solid boundary area**, then enter the other boundary `g` (initially `0`). Analysis uses the saved rectangular plot range from **Edit → Plot range**. Volume integrates the absolute difference of the functions; solid boundary area includes both graphs and all four side walls.

For an implicit or parametric surface, choose **Enclosed volume**. The sampled surface must be closed; open or clipped surfaces show a diagnostic. Implicit surfaces also offer **Surface area** over the saved range. **Quality** controls analysis sampling independently of display resolution, and **Show solution** explains the calculation and numerical uncertainty. On phones, Escape closes the solution and returns to the Inspector sheet. Analysis modes and the other boundary are temporary and reset when a scene is reopened.

## Piecewise functions

Type or paste `f(t)={0 for t<0; 1 for t>=0}` into the blank equation input for a step function. `f(t)` plots against the horizontal axis in 2D. You can also use `f(x)` or a surface such as `z={0 for x+y<0; 1 otherwise}`.

Separate cases with semicolons. Both `value for condition` and `condition:value` work; conditions support comparisons, chained intervals (`-1<=t<1`), `and`, and `or`. The first matching case wins. A final `value otherwise` supplies a fallback; without it, uncovered intervals are undefined and stay empty. Formula inputs show cases with a brace. Use **Text** to edit the source directly.

The 2D curve, 3D curve/surface, and SVG paths separate sampled jumps instead of connecting the branches. Continuous joins remain connected.

Contour maps show numeric values directly on visible lines. For example, a ring labeled `1` contains points where the scalar function equals `1`. Labels follow pan and zoom; tightly packed lines may omit a label to keep values readable.

## Explore or solve

Use **Analyze** on a selected object for supported derivatives, gradients, vector calculus, and geometric relations. A point picker previews coordinates before you click.

Use **Solve** in Math Lab for scalar, vector, polar, and complex field problems. Supported answers calculate automatically. **Show solution** opens the worked steps. **Add to scene**, where available, creates a plot; solver drafts themselves are not project objects.

Use **Distance**, **Angle**, and **Pin** from the canvas toolbar for measurements. Results appear on the graph and in Objects. Undo and redo include measurement edits. Press Escape on the canvas to return to Pan; Escape in a dialog closes that dialog first.

## Save and share

Use the scene menu to save a named local project or reopen one. Browser storage is local to that browser; export JSON for a portable backup.

The scene menu also provides share links, JSON export/import, 2D PNG/SVG export, and 3D PNG export. A share link contains a snapshot of the scene, including parameter values and slider bounds; later edits do not change it. Projects and JSON backups preserve the same values. Measurement-only scenes are included in local recovery. The 2D export formats remain available in split and quad views, exporting the active 2D pane. Use JSON when a scene exceeds the share-link limit.

The public [guide](/documentations) includes topic navigation, expression examples, and troubleshooting.
# 3D parametric graphs and intersections

Open **Add** and search for **3D parametric**. Choose **Parametric Curve** for
`x(t), y(t), z(t)` or **Parametric Surface** for `x(u,v), y(u,v), z(u,v)`.
Creation opens the 3D view and focuses the definition for editing.

To compare two surfaces (or a surface and plane), select one, open
**Inspector → Analyze → Geometry Analysis**, and choose the **Second object**.
Enable **Show intersection curve** to highlight the numerical curve in 3D.
Expand **Solution** for the equations, available substitution, and sample
coordinates. Results apply within the saved plot ranges.

For two planar equations, the same Analyze workflow finds intersection points
in the current XY view. Enable **Show intersection points** to mark them.

To combine regions, select the first equation and open **Inspector → Settings →
Object operations**. Choose the second object, then **Union**, **Intersection**,
or **Subtract**. Subtract removes the second region from the first. An implicit
equation F = 0 uses F ≤ 0 as its inside; explicit surfaces use the side below
the dependent coordinate. Use two 2D regions or two 3D regions.

The result stays linked to its sources and updates when either definition or a
parameter changes. Sources are kept and hidden. Open the result’s **Edit** tab
to select a source or **Make independent**. Deleting a source also removes its
linked results; Undo restores them.

## Keep your place while changing views

Adding a spatial object in Math Lab opens 3D; adding a 2D field or transform opens the XY graph. Split and Quad layouts stay open while you add objects. In Geometry Studio, spatial objects keep the current view; adding a 2D field opens Math Lab so its arrows are visible. Viewport notes offer **Show in 2D** or **Show in 3D** when an object needs another view.

Switching between 2D and 3D preserves camera position, zoom, and the tools chosen for each dimension. Unfinished measurements are cancelled on a dimension switch. Use Reset when you want to reset the camera.

Math Lab's Quad layout combines the primary 2D graph, the perspective scene, a YZ orthographic projection of the 3D scene, and a second 2D graph (XZ initially). A surface slice shows an intersection; the YZ projection shows the spatial objects from the side. Both 2D graphs support Pan, Probe, Pin, Distance, Angle, and Sketch using their own coordinate plane. Changing layouts preserves their cameras. On desktop, focus the split divider and use Left/Right or Home/End to resize it.

**Add → Analysis → Projection** copies a selected parametric curve onto XY. Select a parametric curve first to enable it.

Sketches keep the coordinate plane of the pane where they were drawn, including when you create a fit preview after using another pane. Changing that plane, changing tools, or hiding the pane cancels unfinished sketch input and previews. Escape cancels a 3D sketch; cancelled touch gestures do not create curves.

Fit and Frame selected currently operate on spatial views. In a single Math Lab 2D view, use **Reset 2D view**; unsupported framing commands are omitted from menus and the command palette.

### Parametric objects in 2D and 3D

In **Add**, choose **2D Parametric Curve** for x(t), y(t), or **2D Parametric Surface** for a filled region x(u,v), y(u,v). The matching 3D choices include a Z expression. The **2D / 3D** buttons beside the definition switch the selected object and reveal its view with one click. Switching to 2D fixes Z at zero and retains the previous Z expression; switching back restores it. X/Y expressions, parameter ranges, color, and sampling stay intact. Planar parametric surfaces render in the XY canvas and export to SVG. Spatial parametric surfaces remain available in the 3D viewport.
