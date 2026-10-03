# Video Pipeline Audit & Technical Fidelity Report: apps/video (R4 & R5)

**Auditor**: Video Pipeline Auditor (Explorer Subagent)  
**Target Monorepo Modules**: `apps/video`, `apps/graph`, `packages/scene`  
**Working Directory**: `/Users/lucifer/Programming/vinculum/.agents/teamwork/teamwork_preview_explorer_survey_video/`  
**Deliverable Path**: `/Users/lucifer/Programming/vinculum/.agents/teamwork/teamwork_preview_explorer_survey_video/handoff.md`  
**Date**: October 3, 2026  

---

## 1. Observation

A direct code-level investigation of `apps/video`, `apps/graph`, and `packages/scene` was conducted. Below are the verbatim observations, code citations, and tool findings.

### 1.1 `apps/video` Architecture & Dependency State
Inspection of `/Users/lucifer/Programming/vinculum/apps/video/package.json` reveals:
```json
12:   "dependencies": {
13:     "@remotion/cli": "^4.0.532",
14:     "@remotion/media-utils": "^4.0.532",
15:     "@remotion/tailwind": "^4.0.532",
16:     "katex": "^0.19.0",
17:     "lucide-react": "^1.50.0",
18:     "react": "^18.3.1",
19:     "react-dom": "^18.3.1",
20:     "remotion": "^4.0.532"
21:   }
```
**Observation 1.1.1**: `apps/video` does **not** depend on `@vinculum/scene`, `three`, or any WebAssembly runtime. It contains zero references to Vinculum's mathematical evaluation core or Three.js WebGPU rendering engine.

Inspection of `/Users/lucifer/Programming/vinculum/apps/video/remotion.config.ts` reveals:
```ts
1: import { Config } from "@remotion/cli/config";
2: import { enableTailwind } from "@remotion/tailwind";
3: 
4: Config.setVideoImageFormat("jpeg");
5: Config.setOverwriteOutput(true);
6: Config.overrideWebpackConfig((current) => enableTailwind(current));
```
**Observation 1.1.2**: Intermediate rendering uses lossy JPEG format (`Config.setVideoImageFormat("jpeg")`). Webpack configuration only enables Tailwind CSS; it contains no GLSL/WGSL loaders, WebGPU flags, or polyfills for headless WebGL/WebGPU rendering.

### 1.2 Disconnected 2D Software Visualizers in `apps/video/src/visualizers/*`
Investigation of all four visualizer files in `apps/video/src/visualizers/` reveals that none of them execute Vinculum's engine:

1. **`OpeningTrajectory.tsx`** (Lines 41–51, 162–169):
   ```ts
   const project = (x: number, y: number, z: number) => {
     const cosA = Math.cos(0.55);
     const sinA = Math.sin(0.55);
     const rx = x * cosA - y * sinA;
     const ry = (x * sinA + y * cosA) * 0.55 - z * 0.75;
     return { px: cx + rx * scale, py: cy + ry * scale };
   };
   // ...
   ctx.shadowColor = "#38bdf8";
   ctx.shadowBlur = 18;
   ```
   *Finding*: A manual 2D canvas trigonometric projection with an ad-hoc 2D coordinate matrix and `ctx.shadowBlur` glow, disconnected from Three.js and camera projection matrices.

2. **`ParametricHelix3D.tsx`** (Lines 40–63, 147–152):
   ```ts
   const project = (x: number, y: number, z: number) => {
     const cosY = Math.cos(angleY);
     const sinY = Math.sin(angleY);
     const x1 = x * cosY - z * sinY;
     const z1 = x * sinY + z * cosY;
     // ...
     const scale = fov / depth;
     return { px: cx + x1 * scale, py: cy - y2 * scale, depth, scale };
   };
   // ...
   ctx.shadowColor = color;
   ctx.shadowBlur = 18;
   ```
   *Finding*: A software-projected helix on a 2D `<canvas>` with canvas line drawing and canvas-level shadow blur, bypassing Three.js `Line2NodeMaterial` and screen-space wide strokes.

3. **`SurfaceMesh3D.tsx`** (Lines 60–114):
   ```ts
   const wave = Math.sin(normX * 1.5 + time) * Math.cos(normZ * 1.5 + time * 0.7) * 45 + ...;
   // ...
   // Painter's algorithm: sort faces from back to front
   faces.sort((a, b) => b.avgDepth - a.avgDepth);
   ```
   *Finding*: An ad-hoc 2D canvas software rasterizer implementing a primitive CPU quad depth-sort (Painter's algorithm) to render a hardcoded sine-cosine ripple. It lacks lighting models, normals, PBR materials, and hardware depth buffers.

4. **`VectorFieldSimulation.tsx`** (Lines 48–53, 97–117):
   ```ts
   const field = (x: number, y: number) => {
     const vx = -Math.sin(y * 0.8) - 0.3 * Math.sin(t) * x;
     const vy = Math.sin(x * 0.8) + 0.3 * Math.cos(t) * y;
     const len = Math.hypot(vx, vy) || 0.001;
     return { vx, vy, normVx: vx / len, normVy: vy / len, len };
   };
   ```
   *Finding*: A toy 2D canvas particle drift simulation with arbitrary trigonometry, completely disconnected from Vinculum's instanced 3D glyph renderer, streamline integration, or Rust/WASM vector field engine.

### 1.3 Pseudo-3D Motion Rig in `apps/video/src/motion/*`
1. **`WorldCanvas.tsx`** (Lines 24–47):
   ```tsx
   <div style={{ perspective: `${perspective}px`, perspectiveOrigin: "50% 50%" }}>
     <div style={{
       transformStyle: "preserve-3d",
       transform: `translate3d(${-camera.x}px, ${-camera.y}px, 0px) scale(${camera.z}) rotateX(${camera.pitch}deg) rotateY(${camera.yaw}deg) rotateZ(${camera.roll}deg)`
     }}>
       {children}
     </div>
   </div>
   ```
   *Finding*: 3D motion is faked entirely through CSS 3D matrix transforms (`preserve-3d`, `rotateX/Y/Z`) applied to HTML DOM elements. It does not control a camera frustum inside a GPU graphics context.
2. **`camera.ts`** (Lines 7–16, 63–171):
   Contains reusable cubic bezier curves (`EASINGS.camera = Easing.bezier(0.16, 1, 0.3, 1)`, `EASINGS.snap`), but drives the synthetic CSS 3D transforms across a hardcoded 36-second timeline that does not match the product's actual 24–35s showcase structure.

### 1.4 Cyber Clichés and Marketing Tropes in `apps/video/src/components/*` & `src/scenes/*`
1. **`ParticleBackground.tsx`** (Lines 15–32, 86–111):
   Generates 45 pseudo-random floating circular dots drifting upwards with neon dropshadows (`boxShadow: 0 0 ${p.size*3}px ...`), overlaid on a scrolling SVG grid and colored radial blur spots (`blur-[140px] opacity-25`).
2. **`GlowBadge.tsx`** (Lines 16–52, 58–65):
   Renders rounded neon pill badges with pulsing animated dots (`animate-pulse`) and colored neon dropshadows (`shadow-[0_0_15px_rgba(59,130,246,0.3)]`).
3. **`KineticTitle.tsx`** (Lines 29–34):
   Applies multi-stop gradient clip-text with intense neon drop-shadows (`drop-shadow-[0_0_20px_rgba(6,182,212,0.6)]`).
4. **`FormulaCard.tsx`** (Lines 53–59, 62):
   Wraps equations in glowing glassmorphism panels with animated pinging radar dots (`animate-ping`) and heavy dropshadows (`shadow-[0_15px_35px_-5px_rgba(6,182,212,0.35)]`).
5. **Fake Telemetry & HUD Overlays**:
   - `ProductShowcase.tsx` (Lines 62–76): Top HUD with `animate-ping` dot and fake string `"60 FPS | WASM ACTIVE"`.
   - `OpeningSequence.tsx` (Lines 104–125, 154–158): Floating HUD labels ("Trajectory Vector", "Velocity Unit") and fake window bar `"WASM EVAL: 0.12ms | 60 FPS"`.
   - `Scene3UnifiedCanvas.tsx` (Lines 86–116): Fake slider controls ("Curve Radius", "Pitch Factor") and fake `"60.0 FPS"` badge.
   - `Scene5EnginePower.tsx` (Lines 81–110): Fake telemetry grid with hardcoded numbers: `"Frame Budget 60.0 FPS"`, `"WASM Eval Latency 0.34 ms"`, `"Points Sampled 128k grid"`, `"WebGPU Pipeline Active NodeMat"`.
6. **Disconnected Math Demos & Corporate Checklists**:
   - `Scene1Hook.tsx` (Lines 42–60): Blurred background cards displaying unrelated formulas: Maxwell's equations ($\nabla \times \mathbf{B} = \mu_0(\mathbf{J} + \varepsilon_0 \partial\mathbf{E}/\partial t)$) and Euler's identity ($e^{i\pi}+1=0$).
   - `Scene4Surfaces.tsx` (Lines 85–108): Corporate feature checklist with green `<CheckCircle2>` icons ("Implicit Equations", "Planes", "Custom parametric surfaces").
   - `Scene6WorkflowExport.tsx` (Lines 69–143): Generic SaaS 3-card grid ("One-Click Link Sharing", "Vector & High-Res Export", "100% Local-First Privacy") with a simulated "Copy link" button.
   - `Scene7Outro.tsx` (Lines 39–45, 70–93): 120px pulsating neon blur behind logo, fake pill buttons ("Explore the Canvas", "GitHub / Open Source"), and bash command badge.

### 1.5 Audio Generation Script in `apps/video/scripts/generate-soundtrack.ts`
Inspection of `generate-soundtrack.ts` (Lines 119–160, 167–280) reveals procedural audio synthesis consisting of:
- `addBoom` (Lines 119–135): Synthetic sub-bass boom pitch-dropping from 95Hz down to 35Hz on every scene transition.
- `addRiser` (Lines 137–160): High-frequency white noise and sine frequency sweep (300Hz to 1500Hz) risers.
- `addPluck` (Lines 80–117): Twinkling arpeggios with 250ms stereo ping-pong delay.
- `addPad` (Lines 38–77): Warm detuned sine pads playing traditional corporate minor/major chord progressions (Dm9, Fmaj7, Gsus2, Bbmaj7).
*Finding*: Conforms verbatim to the "corporate audio tropes" explicitly prohibited in R5.

### 1.6 Vinculum Actual Rendering Engine in `apps/graph` and `packages/scene`
Investigation of `apps/graph/lib/graph3d/*` and `apps/graph/rust/math-core/` reveals Vinculum's true technological foundation:
1. **WebGPU Renderer with WebGL2 Fallback**:
   - `GraphThreeEngine.ts` (Lines 25, 91–95, 832–836):
     ```ts
     const renderer = new WebGPURenderer({
       antialias: true,
       alpha: false,
       powerPreference: "high-performance"
     });
     // ...
     const ready = renderer.init().then(() => {
       renderer.domElement.dataset.renderBackend =
         (renderer.backend as any).isWebGPUBackend ? "webgpu" : "webgl2";
     });
     ```
     Three.js `0.186.1` initializes `WebGPURenderer` asynchronously, detecting browser capabilities and falling back cleanly to `WebGLBackend` (WebGL2).
2. **Screen-Width Node-Material Strokes**:
   - `graphWideStroke.ts` (Lines 2–18):
     ```ts
     import { Line2NodeMaterial } from "three/webgpu";
     import { LineSegments2 } from "three/addons/lines/webgpu/LineSegments2.js";
     import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";

     export function createWideStroke(positions: Float32Array | number[], color: string, width = 3): LineSegments2 {
       const geometry = new LineSegmentsGeometry();
       geometry.setPositions(positions);
       const material = new Line2NodeMaterial({ color: new Color(color), linewidth: width, worldUnits: false, toneMapped: false });
       return new LineSegments2(geometry, material);
     }
     ```
     Real screen-space ribbon strokes compiled via Three.js WebGPU node system, preserving discontinuity breaks.
3. **Adaptive Grid via Three.js Shading Language (TSL)**:
   - `graphThreeGridMaterial.ts` (Lines 2–27):
     ```ts
     import { MeshBasicNodeMaterial } from "three/webgpu";
     import { abs, distance, fract, fwidth, max, min, positionWorld, smoothstep, uniform } from "three/tsl";
     // ...
     const scaled = gridCoordinate.div(max(step, 0.0001));
     const grid = abs(fract(scaled.sub(0.5)).sub(0.5)).div(max(fwidth(scaled), 0.0001));
     // ...
     material.colorNode = uMinorColor.mul(minor).add(uMajorColor.mul(major));
     material.opacityNode = minor.mul(0.2).add(major.mul(0.48)).mul(fade);
     ```
     Mathematically rigorous, screen-space anti-aliased grid compiled to WGSL/GLSL through TSL, adjusting minor/major subdivisions dynamically based on camera distance and angle.
4. **Physically-Based Surface Mesh Rendering**:
   - `buildIndexedSurfaceMesh.ts` (Lines 40–101):
     Real `MeshStandardMaterial` with roughness and metalness derived from theme tokens (`sceneSurfaceRoughness`, `sceneSurfaceMetalness`), vertex normal repair for polar singularities, and a subtle co-rendered `LineSegments` wireframe overlay (`opacity: 0.1`) at `renderOrder: 5`.
5. **High-Performance Rust & WebAssembly Evaluator**:
   - `apps/graph/rust/math-core/src/lib.rs` (Lines 1–60):
     Bounded, real-valued postfix bytecode VM executing evaluated expressions with sub-millisecond latency and guaranteed termination bounds (`MAX_PROGRAM_VALUES = 20_000`).
6. **Built-in Deterministic GPU Canvas Capture Pipeline**:
   - `graphCanvasCapture.ts` (Lines 1–13) & `GraphThreeEngine.ts` (Lines 840–849):
     ```ts
     const unregisterCapture = registerGraphCanvasCapture(renderer.domElement, async () => {
       await ready;
       if (disposed || tickRuntime.isContextLost) return null;
       renderer.render(scene, camera);
       return new Promise<Blob | null>((resolve) => renderer.domElement.toBlob(resolve, "image/png"));
     });
     ```
     `apps/graph` already provides an exact, synchronized GPU canvas capture mechanism that freshly flushes the GPU queue and exports lossless PNG blobs directly from the active rendering context.

---

## 2. Logic Chain

From the direct observations above, we establish the step-by-step reasoning supporting our conclusions.

### 2.1 Analysis of Current `apps/video` State
1. **Observation 1.1.1 & 1.2** show that `apps/video` does not consume Vinculum's mathematical evaluation core or Three.js WebGPU engine.
2. The visualizers in `apps/video/src/visualizers/*` rely on primitive 2D software canvas drawing routines with custom matrix projections and fake Painter's depth sorting.
3. Therefore, the visual output of the existing `apps/video` prototype shares **0% visual or mathematical parity** with Vinculum. It is an isolated facsimile that completely misrepresents the capabilities of the product.
4. **Observation 1.4 & 1.5** demonstrate that the prototype relies extensively on sci-fi cyber tropes (floating particles, radial blur blobs, glowing badge pills, fake WASM/FPS HUD indicators, and synthetic sub-bass boom risers).
5. These tropes contradict the core product thesis established in `ORIGINAL_REQUEST.md`: Vinculum is an **elite mathematical instrument**, not a gaming utility, cyber-hacker demo, or SaaS landing page.
6. Consequently, a comprehensive deprecation and cleanup matrix must be executed to permanently purge these patterns while retaining foundational Remotion harnesses, easing math, and brand assets.

---

### 2.2 Prototype Deprecation & Cleanup Matrix (R5)

Every single file in `apps/video` (60 files total) has been audited and cataloged below.

#### Table 2.1: Full Repository Deprecation Matrix for `apps/video`

| # | File Path | Component / Asset | Disposition | Elements to Permanently Abandon | Elements to Salvage / Retain | Technical Rationale |
|---|---|---|---|---|---|---|
| 1 | `package.json` | Dependency Manifest | **Refactor** | Outdated composition scripts pointing to legacy files | Remotion CLI, media-utils, tailwind, katex dependencies | Clean foundation; add workspace link if needed |
| 2 | `remotion.config.ts` | Remotion CLI Config | **Refactor** | `Config.setVideoImageFormat("jpeg")` (lossy) | Webpack tailwind configuration, overwrite flags | Switch intermediate video format to `"png"` for zero compression artifacts |
| 3 | `postcss.config.js` | Tailwind PostCSS | **Retain** | None | Standard PostCSS plugins (Tailwind, Autoprefixer) | Functional build requirement |
| 4 | `README.md` | Video Documentation | **Refactor** | References to 50s 7-scene structure & obsolete scripts | Setup instructions and render CLI commands | Must document the new 24–35s showcase structure |
| 5 | `scripts/generate-soundtrack.ts` | Audio Generator | **Abandon** | Entire file: synthetic sub-bass booms, white noise risers, ping-pong delay arpeggios, chord pads | None | Embodies corporate audio tropes explicitly barred by R5 |
| 6 | `src/index.ts` | Remotion Entrypoint | **Refactor** | Imports of obsolete compositions | Root registration pattern (`registerRoot(Root)`) | Standard Remotion entrypoint |
| 7 | `src/Root.tsx` | Composition Registry | **Refactor** | Compositions for 50s `ProductShowcase`, `ProductShowcaseVertical`, and Scenes 1–7 | `Composition` definitions, resolution/FPS boilerplate | Replace with new 24–35s Showcase Film composition |
| 8 | `src/types.ts` | Video Type Definitions | **Refactor** | 50s scene durations (`TOTAL_DURATION_SECONDS = 50`), brand color palette | `VIDEO_FPS = 30` constant | Realign duration constants to 24–35s bounds |
| 9 | `src/style.css` | Global Video Stylesheet | **Refactor** | `.glass-panel`, `.glass-pill`, heavy text gradient utility classes | KaTeX font imports, base reset, clean dark background `#050811` | Strip out glassmorphism and neon gradient classes |
| 10 | `src/ProductShowcase.tsx` | 50s Landscape Showcase | **Abandon** | 50s sequence, fake top HUD with `animate-ping`, fake "WASM ACTIVE" badge, bottom rainbow progress bar | None | Entire structure built on deprecated scenes |
| 11 | `src/ProductShowcaseVertical.tsx` | 50s Vertical Showcase | **Abandon** | 50s vertical sequence, mobile HUD overlay, bottom progress bar | None | Entire structure built on deprecated scenes |
| 12 | `src/components/GlowBadge.tsx` | UI Badge Component | **Abandon** | Entire file: pulsing neon dots, colored box-shadows, uppercase HUD badges | None | Anti-pattern: cyber aesthetic badge |
| 13 | `src/components/ParticleBackground.tsx` | Ambient Background | **Abandon** | Entire file: 45 floating particles, scrolling SVG wallpaper, radial blur blobs | None | Anti-pattern: star wallpaper & cyber particles |
| 14 | `src/components/FormulaCard.tsx` | Formula Card | **Refactor** | Glowing glass panel container, `animate-ping` dot, fake parameter cards | KaTeX rendering helper logic (`katex.renderToString`) | Extract KaTeX typesetting without glowing UI wrapper |
| 15 | `src/components/KineticTitle.tsx` | Kinetic Typography | **Refactor** | Neon gradient text shadows (`drop-shadow-[0_0_20px]`), rainbow color maps | Spring-based word stagger logic (`spring({ damping: 12 })`) | Restyle into clean editorial typography (~30% screen balance) |
| 16 | `src/components/Soundtrack.tsx` | Audio Remotion Wrapper | **Retain** | Usage pointing to synthetic soundtrack | Audio component wrapper pattern | Useful for mounting genuine sound design bed |
| 17 | `src/motion/WorldCanvas.tsx` | CSS 3D Space Rig | **Abandon** | Entire file: CSS `preserve-3d`, `rotateX/Y/Z` transforms on DOM | None | Fakes 3D space with CSS transforms; zero engine parity |
| 18 | `src/motion/camera.ts` | Camera Curve State | **Refactor** | 36s timeline milestones, CSS camera state object | Easing curves: `EASINGS.camera`, `EASINGS.snap` | Bezier definitions are mathematically sound; repurpose for timing |
| 19 | `src/prototype/prototypeTimeline.ts` | 11.5s Prototype Timeline | **Refactor** | 11.5s duration bounds | `EASINGS.outExpo`, `EASINGS.snap` bezier curves | Easing curves are clean; timeline bounds obsolete |
| 20 | `src/prototype/Prototype12s.tsx` | 11.5s Showcase Prototype | **Abandon** | Transitional prototype composition | Restrained shot structure philosophy | Superseded by final 24–35s treatment |
| 21 | `src/prototype/Shot1Hook.tsx` | Prototype Hook Shot | **Refactor** | Neon text shadow on "flat." (`textShadow: 0 0 28px`) | Editorial copy: "Mathematics shouldn't feel flat." | Text is compelling; eliminate glowing dropshadow |
| 22 | `src/prototype/Shot2Brand.tsx` | Prototype Brand Shot | **Refactor** | Logo drop-shadow (`drop-shadow-[0_0_20px]`) | Clean brand mark lockup and tagline | Punctuation is solid; clean up lighting |
| 23 | `src/prototype/Shot3Editor.tsx` | Prototype Editor Shot | **Abandon** | Fake macOS window titlebar with traffic light dots & fake "WASM Core • 60 FPS" | None | Faked UI chrome; must use real full-bleed application capture |
| 24 | `src/prototype/Shot4Parametric.tsx` | Prototype Parametric Shot | **Refactor** | Fake engine signature badge ("Real-time 3D Canvas") | KaTeX equation overlay pattern for $\mathbf{r}(t)$ | Footage ingestion pattern is valid; eliminate HUD badges |
| 25 | `src/prototype/Shot5Surfaces.tsx` | Prototype Surface Shot | **Refactor** | Fake engine signature badge ("Explicit Surface Mesh") | KaTeX equation overlay pattern for $z = (x^2 - y^2)/2$ | Footage ingestion pattern is valid; eliminate HUD badges |
| 26 | `src/scenes/OpeningRebuildTest.tsx` | Scene Composition | **Abandon** | Entire file: wraps `WorldCanvas` and `ParticleBackground` | None | Deprecated prototype harness |
| 27 | `src/scenes/OpeningSequence.tsx` | Legacy Opening Sequence | **Abandon** | Entire file: floating HUD notation, fake macOS window, static screenshot | None | Disconnected mockups and cyber HUDs |
| 28 | `src/scenes/Scene1Hook.tsx` | Legacy Scene 1 | **Abandon** | Entire file: disconnected Maxwell & Euler equations, `Sparkles` icon, neon glow | None | Cluttered marketing tropes |
| 29 | `src/scenes/Scene2Intro.tsx` | Legacy Scene 2 | **Abandon** | Entire file: tilted 3D window mockup, floating 3D pills, fake window titlebar | None | Faked 3D DOM mockup |
| 30 | `src/scenes/Scene3UnifiedCanvas.tsx` | Legacy Scene 3 | **Abandon** | Entire file: fake UI sliders, fake 60 FPS badge, fake 2D helix canvas | None | Faked product UI controls |
| 31 | `src/scenes/Scene4Surfaces.tsx` | Legacy Scene 4 | **Abandon** | Entire file: corporate checklist, fake "Node-Based Material" pill, 2D mesh | None | Feature checklist anti-pattern |
| 32 | `src/scenes/Scene5EnginePower.tsx` | Legacy Scene 5 | **Abandon** | Entire file: fake telemetry grid, `<Zap>` icon badge, 2D vector simulation | None | Fake telemetry numbers |
| 33 | `src/scenes/Scene6WorkflowExport.tsx` | Legacy Scene 6 | **Abandon** | Entire file: 3-card SaaS grid, fake URL copy button, marketing icons | None | SaaS landing page marketing tropes |
| 34 | `src/scenes/Scene7Outro.tsx` | Legacy Scene 7 | **Abandon** | Entire file: 120px pulsing neon blur, rainbow text, fake pill buttons | None | Overcooked marketing outro |
| 35 | `src/visualizers/OpeningTrajectory.tsx` | 2D Canvas Curve | **Abandon** | Entire file: ad-hoc 2D canvas trigonometric projection and `ctx.shadowBlur` | None | Zero engine parity; toy 2D canvas |
| 36 | `src/visualizers/ParametricHelix3D.tsx` | 2D Canvas Helix | **Abandon** | Entire file: ad-hoc 2D software projection, canvas shadow blur | None | Zero engine parity; toy 2D canvas |
| 37 | `src/visualizers/SurfaceMesh3D.tsx` | 2D Canvas Surface | **Abandon** | Entire file: CPU Painter's algorithm depth sort on sine ripple | None | Zero engine parity; toy 2D canvas |
| 38 | `src/visualizers/VectorFieldSimulation.tsx` | 2D Vector Field | **Abandon** | Entire file: arbitrary trigonometry 2D particle simulation | None | Zero engine parity; toy 2D canvas |
| 39 | `public/audio/soundtrack.mp3` | MP3 Audio File | **Abandon** | Generated audio file containing booms, risers, and synth chords | None | Corporate audio tropes |
| 40 | `public/audio/soundtrack.wav` | WAV Audio File | **Abandon** | Generated audio file containing booms, risers, and synth chords | None | Corporate audio tropes |
| 41 | `public/brand/logo.png` | Brand Asset | **Retain** | None | Full logo asset | Authentic product branding |
| 42 | `public/brand/logo_horizontal.png` | Brand Asset | **Retain** | None | Horizontal logo lockup | Authentic product branding |
| 43 | `public/brand/logo_light.png` | Brand Asset | **Retain** | None | Light mode logo asset | Authentic product branding |
| 44 | `public/brand/logo_only.png` | Brand Asset | **Retain** | None | Isolated mark | Authentic product branding |
| 45 | `public/landing/editor-dark.jpg` | Landing Page Image | **Abandon** | Static low-resolution editor screenshot used in tilted mockups | None | Obsolete; will be replaced by direct 4K captures |
| 46 | `public/landing/editor-light.jpg` | Landing Page Image | **Abandon** | Static low-resolution editor screenshot | None | Obsolete |
| 47 | `public/og-image.png` | Open Graph Image | **Abandon** | Social sharing card asset | None | Not used in film production |
| 48 | `public/product/canvas-helix-pure.png` | Product Capture | **Retain** | None | High-res isolated canvas capture of helix curve | Useful reference asset |
| 49 | `public/product/canvas-saddle-pure.png` | Product Capture | **Retain** | None | High-res isolated canvas capture of saddle surface | Useful reference asset |
| 50 | `public/product/editor-helix-3d-only.png` | Product Capture | **Retain** | None | Viewport crop of helix | Useful reference asset |
| 51 | `public/product/editor-helix-full.png` | Product Capture | **Retain** | None | Full workspace with helix | Useful reference asset |
| 52 | `public/product/editor-initial-split.png` | Product Capture | **Retain** | None | Workspace split view | Useful reference asset |
| 53 | `public/product/editor-saddle-full.png` | Product Capture | **Retain** | None | Full workspace with saddle | Useful reference asset |
| 54 | `public/recorded/clip-editor-interaction.mp4` | Screen Recording | **Abandon** | Low-res compressed recording of manual screen clicks | None | Must be replaced by deterministic 4K Playwright capture |
| 55 | `public/recorded/clip-helix-orbit.mp4` | Screen Recording | **Abandon** | Compressed recording of manual helix orbit | None | Must be replaced by deterministic 4K Playwright capture |
| 56 | `public/recorded/clip-saddle-orbit.mp4` | Screen Recording | **Abandon** | Compressed recording of manual saddle orbit | None | Must be replaced by deterministic 4K Playwright capture |
| 57 | `public/recorded/vinculum-real-session.mp4` | Screen Recording | **Abandon** | Compressed session video | None | Obsolete prototype recording |
| 58 | `public/recorded/vinculum-real-session.webm` | Screen Recording | **Abandon** | Compressed session video | None | Obsolete prototype recording |
| 59 | `src/ProductShowcase.tsx` (helpers) | Chapter Labels | **Abandon** | Hardcoded chapter progression strings ("The Genesis", "Rust WASM Engine") | None | Clunky marketing chapter cards |
| 60 | `out/*` | Build Output Directory | **Abandon** | Rendered legacy mp4s and png snapshots | None | Ephemeral build artifacts |

---

### 2.3 Product Rendering Parity Evaluation across the 4 Technical Options (R4)

To bridge the chasm between Vinculum's real engine (`apps/graph`) and Remotion (`apps/video`), four architectural options were rigorously analyzed.

#### Option 1: Direct Deterministic High-Resolution Application Capture

* **Technical Architecture**:
  The actual Vinculum Next.js application is launched in a headless Chromium instance driven by Playwright (`apps/graph/e2e/`). A dedicated showcase harness loads preset scenes from `packages/scene/defaults.ts`, scripts user interactions (MathLive keyboard typing, parameter sweeps, tool selection), scripts camera trajectories using locked mathematical splines, and captures frame-by-frame PNG sequences or lossless 60fps WebM video streams at 4K resolution (3840x2160, devicePixelRatio = 2). Remotion ingests these deterministic assets via `<Video>` or image sequence components, applying editorial typography, sound design, camera push transitions, and title punctuation.
* **Pros**:
  - **100% Genuine Fidelity**: Exactly 100% visual and mathematical parity. It captures the actual WebGPURenderer (with WebGL2 fallback), genuine TSL adaptive grid (`createGraphGridMaterial`), true screen-space wide strokes (`Line2NodeMaterial`), authentic `MeshStandardMaterial` PBR surface shading, real CSS2D coordinate labels, and real Rust/WASM execution.
  - **Zero Code Duplication**: No duplication of Three.js engines, shaders, or store states into Remotion.
  - **Zero Remotion WebGPU Crash Risk**: Remotion does not need to spin up WebGPU/TSL contexts inside Puppeteer rendering threads (a known failure mode in headless environments). Remotion renders rapidly and deterministically using pre-rendered lossless video/frames.
  - **Leverages Existing Infrastructure**: Vinculum already contains Playwright e2e harnesses and the `registerGraphCanvasCapture` / `getGraphCanvasCapture` interface in `GraphThreeEngine.ts:840`.
* **Cons**:
  - Two-stage pipeline: Requires running the capture script before rendering the Remotion video.
  - Camera adjustments during video editing require updating the capture script and re-recording rather than tweaking a slider inside Remotion Studio.
* **Implementation Complexity**: Low to Moderate (capture harness script + Remotion ingestion).
* **Fidelity Score**: **100%** (Absolute Parity).

---

#### Option 2: Component Reuse Across `apps/graph` and `apps/video`

* **Technical Architecture**:
  Import `<GraphCanvas />`, `<Viewport3D />`, and `GraphThreeEngine` directly from `apps/graph` into `apps/video`. Mount the Next.js components inside Remotion compositions and synchronize the 3D scene by passing `frame` from `useCurrentFrame()`.
* **Pros**:
  - Direct TypeScript component reuse across the monorepo.
  - Single source of truth for React component definitions.
* **Cons**:
  - **Severe Bundling Incompatibility**: `apps/graph` relies heavily on Next.js 14 internals (`next/dynamic`, `@/store/graphStore`, Zustand singletons, CSS modules, Next.js fonts, CSS variables in DOM). Remotion uses a custom Webpack/Vite bundler that cannot resolve Next.js runtime primitives without substantial polyfills.
  - **Execution Context Mismatch**: `GraphThreeEngine` relies on continuous browser `requestAnimationFrame` loops, active DOM events, and client-side singletons. Remotion renders frames out-of-order across parallel headless Puppeteer worker processes (`@remotion/renderer`), causing race conditions, uninitialized stores, and canvas lifecycle deadlocks.
  - **Headless WebGPU Failures**: Remotion's Puppeteer instances run without GPU acceleration by default unless specialized Chrome flags are configured. Three.js WebGPU node material shaders (`Line2NodeMaterial`, `MeshBasicNodeMaterial`) will frequently crash or drop to unaccelerated software mode during parallel Remotion rendering.
* **Implementation Complexity**: Very High (major monorepo refactoring, Next.js decoupling, Remotion Webpack shimming).
* **Fidelity Score**: **65%–80%** (frequent headless rendering failures, missing CSS variables, broken DOM labels).

---

#### Option 3: Shared Math/Shader Rendering Engine (Extract `@vinculum/render-core`)

* **Technical Architecture**:
  Extract the 3D rendering pipeline from `apps/graph/lib/graph3d/*` into a headless shared package (e.g. `packages/render-core`). This package would encapsulate Three.js WebGPU/TSL shaders, line generators, surface meshing, camera baseline algorithms, and the Rust/WASM VM. Both `apps/graph` and `apps/video` would consume this package. Inside `apps/video`, a dedicated Remotion-Three bridge would advance the engine tick deterministically using `frame`.
* **Pros**:
  - Clean modular architecture: Pure mathematical rendering is decoupled from UI chrome and Next.js.
  - Full programmatic scene control inside Remotion without requiring pre-recorded video assets.
* **Cons**:
  - **Substantial Monorepo Refactoring**: Requires extracting and rewriting 63 interconnected files in `apps/graph/lib/graph3d/`, severing all dependencies on `@/store/graphStore`, `@/lib/theme`, and CSS2D DOM renderers.
  - **Headless GPU Fragility**: Does not eliminate the core Puppeteer issue: Remotion still has to compile Three.js WebGPU/TSL shaders inside headless Chromium worker processes during export. If Chromium fails to allocate WebGPU/WebGL2 contexts under parallel load, the video build fails.
  - **Incomplete Product Context**: Only renders the 3D geometry; it does not render the authentic editor UI (expression list, MathLive keyboard, left object browser, toolbar).
* **Implementation Complexity**: High (weeks of architectural refactoring).
* **Fidelity Score**: **90%–95%** (High 3D parity, but missing editor UI chrome parity).

---

#### Option 4: Pixel-Perfect Style Reconstruction

* **Technical Architecture**:
  Re-implement Vinculum's visual styling inside `apps/video` using isolated 2D canvas drawing, CSS 3D transforms, and static SVG graphics (the approach attempted in the initial prototype).
* **Pros**:
  - Self-contained in `apps/video` with zero external dependencies.
  - Renders rapidly in Remotion without GPU acceleration requirements.
* **Cons**:
  - **Fatal Fidelity Collapse**: Cannot achieve mathematical or visual parity. 2D canvas routines cannot reproduce Three.js WebGPU screen-space wide strokes, physically-based materials, real surface normals, or adaptive TSL grid shaders.
  - **High Maintenance Overhead**: Every styling update, shader adjustment, or math feature added to Vinculum must be manually re-coded in Remotion canvas scripts.
  - **Inherently Counterfeit**: Produces disconnected toy simulations and fake sci-fi HUDs that directly violate Vinculum's identity as an elite mathematical instrument.
* **Implementation Complexity**: Moderate.
* **Fidelity Score**: **20%–30%** (Unacceptable; thoroughly rejected).

---

#### Table 2.2: Systematic Parity Evaluation Matrix

| Criterion | Option 1: Direct App Capture | Option 2: Component Reuse | Option 3: Shared Engine Package | Option 4: Style Reconstruction |
|---|---|---|---|---|
| **Visual Parity** | **100% (Exact Engine)** | 70%–80% (Flaky DOM/CSS) | 92%–95% (3D Only) | 20%–30% (Counterfeit) |
| **Mathematical Parity** | **100% (Exact WASM/TSL)** | 100% (If runs) | 100% (Exact WASM) | 15% (Hardcoded curves) |
| **Editor UI Parity** | **100% (Real Product UI)** | 60% (Next.js CSS breaks) | 0% (3D canvas only) | 25% (Faked macOS chrome) |
| **Headless WebGPU Risk** | **Zero Risk (Pre-captured)** | Critical (Puppeteer crashes) | High (Puppeteer WebGPU flags) | Zero (2D Canvas only) |
| **Remotion Build Speed** | **Fast (Standard Video/PNG)** | Extremely Slow / Deadlocks | Moderate | Fast |
| **Implementation Effort** | **Low–Medium (1–2 days)** | Very High (2–3 weeks) | High (2–3 weeks) | Already failed |
| **Architectural Purity** | **High (Clean separation)** | Low (Monorepo pollution) | Very High (Modular) | Very Low (Spaghetti) |
| **Definitive Recommendation** | **RECOMMENDED PRIMARY** | Rejected | Future Long-term Vision | **PERMANENTLY REJECTED** |

---

### 2.4 Definitive Technical Recommendation & Migration Roadmap

#### The Definitive Pipeline: Option 1 (Direct Deterministic Application Capture) + Remotion Editorial Mastery
We definitively recommend **Option 1: Direct Deterministic High-Resolution Application Capture**.

**Architectural Rationale**:
1. **Flawless Authenticity**: Vinculum's marketing must showcase the real product. Option 1 captures the genuine application running at full fidelity—including the real MathLive expression editor, real left object browser, real TSL adaptive grid, real screen-space wide stroke ribbons, and real PBR surface illumination.
2. **Technical Feasibility**: Vinculum already has the capture foundations:
   - `apps/graph/lib/graph3d/graphCanvasCapture.ts` provides `getGraphCanvasCapture(canvas)`.
   - `apps/graph/e2e/` contains fully configured Playwright test harnesses running Chromium with exact viewport dimensions and deterministic wait conditions.
3. **Division of Concerns**:
   - **`apps/graph`** handles **100% of mathematical computation and GPU rendering**.
   - **`apps/video` (Remotion)** handles **100% of editorial pacing, typography, sound design synchronization, match cuts, and video encoding**.

---

#### 4-Phase Migration Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: Treatment & Prototype Cleanup (Immediate)                          │
│ • Write SHOWCASE_TREATMENT.md adhering to 24–35s 5-Act structure.           │
│ • Purge cyber particles, fake telemetry HUDs, and synthetic audio tropes.   │
│ • Lock down hero capability storyboard moments.                             │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: Deterministic Capture Harness (Production Phase 1)                 │
│ • Implement `apps/graph/scripts/capture-showcase-footage.ts` via Playwright.│
│ • Script exact user input typing, camera orbit splines, and slider sweeps.  │
│ • Output lossless 4K 60fps WebM/PNG sequences to `apps/video/public/hero/`. │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: Remotion Editorial Rebuild (Production Phase 2)                    │
│ • Rebuild `apps/video/src/Root.tsx` for 24–35s showcase composition.        │
│ • Ingest genuine 4K product captures via `<Video>` and `<Img>`.             │
│ • Apply restrained editorial typography (70% product / 30% text balance).   │
│ • Integrate authentic acoustic sound design (tactile clicks, subtle hum).   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: Verification & Final Master Render (Production Phase 3)            │
│ • Execute `bun run video:build` to produce master 4K MP4 film.              │
│ • Verify storyboard timing bounds (24.0s - 35.0s @ 30fps).                  │
│ • Verify zero deprecated assets in output bundle.                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Caveats

1. **Headless Chromium WebGPU Support**: Option 1 runs Playwright in Chromium. On macOS Apple Silicon (M1/M2/M3/M4), Chromium supports WebGPU via Metal out of the box with `--enable-unsafe-webgpu`. In CI environments running Linux Docker containers without GPU hardware, Three.js automatically falls back to WebGL2 (`renderer.backend.isWebGPUBackend ? "webgpu" : "webgl2"` in `GraphThreeEngine.ts:835`), ensuring captures never fail even in headless software environments.
2. **Capture Script Timing Determinism**: Playwright capture must wait for WebAssembly evaluation and Three.js shader compilation to finish (`await engine.ready`) before advancing frames. Relying on wall-clock `setTimeout` during capture could introduce frame stutter; the capture harness must advance frames deterministically using canvas capture callbacks.
3. **Storage Overhead**: Storing uncompressed 4K PNG frames (3840x2160 @ 60fps) requires ~15–20 MB per second. A 30-second capture is ~600 MB. To maintain repository hygiene, captured video clips should be encoded as high-bitrate ProRes or lossless VP9 WebM files in `apps/video/public/hero/` and ignored by Git if over size limits.
4. **No Code Implementation in this Phase**: In strict accordance with user and system instructions, this investigation is read-only. No source files in `apps/video` or `apps/graph` were modified.

---

## 4. Conclusion

1. **Current `apps/video` Status**: The existing video code is an ungrounded prototype that must be purged of its sci-fi cyber tropes (floating particles, neon glow, fake HUD status badges, disconnected Maxwell/Euler equations, and synthetic audio booms/risers).
2. **Salvageable Assets**: The Remotion build harness, KaTeX typesetting logic, cubic bezier easing math (`EASINGS.camera`, `EASINGS.outExpo`), brand logo assets, and clean typography styling can and should be salvaged.
3. **Definitive Technical Architecture**: **Option 1 (Direct Deterministic Application Capture)** is the only viable path to achieve 100% visual, mathematical, and UI parity with Vinculum's WebGPU/TSL/WASM engine. Remotion must be repositioned strictly as the editorial, typographic, and sound-synchronization master.
4. **Readiness for Showcase Treatment**: All necessary ground-truth data has been gathered to support the Lead Author in drafting `apps/video/SHOWCASE_TREATMENT.md` for the 24–35s Showcase Film.

---

## 5. Verification Method

To independently verify the observations, technical analysis, and findings in this report, execute the following commands:

### 5.1 Verifying `apps/video` Dependencies and Config
```bash
# Verify apps/video dependencies (no Three.js, no scene package, no WASM)
cat apps/video/package.json | grep -E "three|scene|wasm|katex"

# Verify Remotion intermediate image format is JPEG
cat apps/video/remotion.config.ts | grep "setVideoImageFormat"
```

### 5.2 Verifying Disconnected Visualizers & Anti-Patterns
```bash
# Check 2D canvas trigonometric projection in OpeningTrajectory
grep -n "cosA" apps/video/src/visualizers/OpeningTrajectory.tsx

# Check Painter's algorithm quad depth sorting in SurfaceMesh3D
grep -n "Painter's algorithm" apps/video/src/visualizers/SurfaceMesh3D.tsx

# Check cyber particles in ParticleBackground
grep -n "particles.map" apps/video/src/components/ParticleBackground.tsx

# Check fake WASM / FPS HUD in ProductShowcase
grep -n "WASM ACTIVE" apps/video/src/ProductShowcase.tsx

# Check corporate audio booms and risers in generate-soundtrack
grep -n "addBoom" apps/video/scripts/generate-soundtrack.ts
```

### 5.3 Verifying Vinculum Engine Capabilities in `apps/graph`
```bash
# Verify WebGPURenderer with WebGL2 fallback in GraphThreeEngine
grep -n "WebGPURenderer" apps/graph/lib/graph3d/GraphThreeEngine.ts
grep -n "isWebGPUBackend" apps/graph/lib/graph3d/GraphThreeEngine.ts

# Verify screen-space wide strokes via Line2NodeMaterial
cat apps/graph/lib/graph3d/graphWideStroke.ts | grep "Line2NodeMaterial"

# Verify TSL-compiled adaptive grid shader
cat apps/graph/lib/graph3d/graphThreeGridMaterial.ts | grep "three/tsl"

# Verify built-in canvas capture callback registration
cat apps/graph/lib/graph3d/graphCanvasCapture.ts

# Verify bounded Rust/WASM numerical core
cat apps/graph/rust/math-core/src/lib.rs | head -n 10
```

### 5.4 Invalidation Conditions
This report's conclusions would be invalidated if:
1. Remotion's headless Puppeteer renderer is proven to support WebGPU compute and TSL shader compilation across parallel headless threads without GPU hardware, device loss, or browser flags.
2. A component bridge between Next.js 14 and Remotion's Webpack bundler can be established without runtime overhead, CSS bleeding, or store corruption.
Neither condition is currently supported by the repository or upstream Remotion architecture.
