# Handoff Report: Reviewer 2 (Technical Parity & Mathematical Authenticity)

**Review Target**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`  
**Reviewer Role**: Reviewer 2 (Technical Parity, Mathematical Authenticity & Adversarial Critic)  
**Date**: October 3, 2026  
**Final Verdict**: **REQUEST_CHANGES**

---

## 1. Observation

### 1.1 Ground-Truth Codebase Observations

#### A. Hero Moment 1 (Marching Tetrahedra Gyroid):
- **Deliverable Claim (lines 327, 429, 431)**:
  > Line 327: *"Rust WASM VM executes 6-tetrahedra cube decomposition across an $80^3$ voxel grid. Slider $a$ scrubs from $0.0 \to 0.8$, demonstrating live topological dilation and aperture bifurcation at 60 fps."*  
  > Line 429: *"Rust WebAssembly postfix bytecode VM executes conforming 6-tetrahedra cube decomposition across an $80^3$ voxel grid (`marchingTetrahedra.ts`), instantiating the vertex buffer."*  
  > Line 431: `VERTICES: 142,800 // TETRAHEDRA: 512,000 // EVAL: 0.82ms`
- **Codebase Reality**:
  1. `packages/scene/src/defaults.ts` line 100:
     ```ts
     export const MIN_IMPLICIT_SURFACE_RESOLUTION = 2;
     export const MAX_IMPLICIT_SURFACE_RESOLUTION = 48;
     ```
  2. `apps/graph/lib/math/sampleImplicitField.ts` lines 29–55:
     ```ts
     const MAX_IMPLICIT_FIELD_VALUES_BYTES = 2_000_000;
     ...
     const stride = resolution + 1;
     const sampleCount = stride * stride * stride;
     const estimatedBytes = sampleCount * Float32Array.BYTES_PER_ELEMENT;
     if (estimatedBytes > MAX_IMPLICIT_FIELD_VALUES_BYTES) {
       throw new Error(`Implicit surface resolution ${resolution} exceeds memory budget. Use a lower resolution.`);
     }
     ```
     At resolution $N=80$: $\text{stride} = 81$, $\text{sampleCount} = 81^3 = 531,441$. $\text{estimatedBytes} = 531,441 \times 4 = 2,125,764\text{ bytes} > 2,000,000\text{ bytes}$. The code explicitly throws a fatal error rather than evaluating.
  3. `apps/graph/lib/math/sampleImplicitField.ts` line 39:
     ```ts
     const resolution = normalizeImplicitSurfaceResolution(options.resolution);
     ```
     `normalizeImplicitSurfaceResolution` clamps any input above 48 to 48.
  4. Mathematical Tetrahedra Count:
     In `marchingTetrahedra.ts` lines 20–24, each cube is decomposed into **6 tetrahedra**.
     $80^3 = 512,000$ is the number of **cubes (voxels)**, not tetrahedra. An 80-cube grid produces $512,000 \times 6 = 3,072,000$ tetrahedra. Labeling $512,000$ as "TETRAHEDRA" conflates cubes with tetrahedra.
     At the true canonical maximum resolution $N=48$:
     - Cubes: $48^3 = 110,592$
     - Tetrahedra: $110,592 \times 6 = 663,552$
     - Samples: $49^3 = 117,649$ (well within the 2MB budget at $\approx 470\text{ KB}$).
     - Unit test in `apps/graph/test/implicitSurfaceExtraction.test.ts:557–562` explicitly enforces:
       ```ts
       expect(field.values.length).toBe(49 * 49 * 49);
       expect(field.resolution ** 3).toBe(48 * 48 * 48);
       ```

#### B. Hero Moment 2 (Differential Surface Probing):
- **Deliverable Claim (lines 329–331, 451–457)**:
  Hyperbolic paraboloid $z = (x^2 - y^2)/2$ at probe point $(1.5, 1.0, 0.625)$ yields $\partial z/\partial x = 1.500$, $\partial z/\partial y = -1.000$, $\hat{\mathbf{n}} = \langle 0.728, -0.485, -0.485 \rangle$.
- **Codebase Reality**:
  - `apps/graph/lib/math/surfaceDifferential.ts` exists and implements exact scalar gradient extraction.
  - At $p = (1.5, 1.0, 0.625)$:
    $\partial z/\partial x = 1.500$, $\partial z/\partial y = -1.000$.
    Level set $G = z - (x^2 - y^2)/2 \implies \nabla G = \langle -1.5, 1.0, 1.0 \rangle$.
    $\|\nabla G\| = \sqrt{2.25 + 1 + 1} = \sqrt{4.25} \approx 2.06155$.
    Unit normal components: $1.5 / 2.06155 \approx 0.728$, $-1.0 / 2.06155 \approx -0.485$.
  - `DifferentialAnalysisSection.tsx` exists and implements `armDifferentialAnalysisPick` and `differentialAnalysisPickArmedId`.
  - Exact match: 100% mathematically authentic and verified.

#### C. Hero Moment 3 (Autonomous RK4 Streamlines):
- **Deliverable Claim (lines 333–335, 463–469)**:
  $\mathbf{F} = \langle -y, x, z(1 - x^2 - y^2) \rangle$ integrated with 4th-order Runge-Kutta, per-stage normalization, 3px screen-space wide strokes (`Line2NodeMaterial`), converging on limit cycle $x^2 + y^2 = 1$.
- **Codebase Reality**:
  - `apps/graph/lib/math/streamlineIntegrate.ts` exists and implements normalized RK4 $d\mathbf{X}/ds = \mathbf{F}/\|\mathbf{F}\|$ with per-stage evaluation.
  - Contract in lines 10–12 mandates user-facing term "Streamlines" over "particles".
  - `graphWideStroke.ts` lines 8–18 instantiates `Line2NodeMaterial` from `three/webgpu` with `linewidth: 3, worldUnits: false`.
  - `StreamlineSection.tsx` exists and drives streamline execution.
  - Exact match: 100% mathematically authentic and verified.

#### D. Hero Moment 4 (3D Linear Operator & Eigenspaces):
- **Deliverable Claim (lines 337–340, 480–486)**:
  > Line 481: *"Eigendecomposition and Cardano cubic solver in `matrixEigen.ts`. Renders invariant rays and volume deformation."*
- **Codebase Reality**:
  - `apps/graph/lib/math/matrixEigen.ts` lines 3–8 explicitly states:
    ```ts
    // EIGEN GATE DECISION (PART 8, characterized before product code):
    // reuse mathjs `eigs` — already a direct dependency (no new package),
    // browser-compatible pure JS, correct on 2×2/3×3 diagonal, rotation
    // (complex ±i), shear (single independent direction), defective 3×3
    // (fewer vectors than values — honest, never fabricated), and repeated
    // eigenvalues with full eigenspaces. No hand-rolled cubic/root solver.
    ```
  - `matrixEigen.ts` contains **NO Cardano cubic solver**. It deliberately delegates to `mathjs` `eigs` to avoid numerical instability on defective and repeated eigenvalues.
  - `graphThreeGeometryMultiView.ts` lines 472–497 correctly implements `renderer.setScissorTest(true)` and `renderer.setScissor(...)` across 4 viewports.
  - `MatrixEntryEditor.tsx` and `ViewControls.tsx` exist and support Quad layout.

#### E. Pacing Constraint Contradictions:
- **Deliverable Claims**:
  > Line 196: *"structured with 35 distinct visual event beats, with every interval strictly bounded between 0.50s and 1.40s."*  
  > Line 540: *"### 5.4 The 35-Event Pacing & Rhythm Matrix (0.50s $\le \Delta t \le 1.40s$)"*  
  > Line 749: *"Visual event beat intervals across all 35 beats strictly satisfy $0.50\text{s} \le \Delta t \le 1.40\text{s}$"*
- **Table 5.4 Reality (lines 577–580)**:
  - Beat 32: `28.00s` ($\Delta t = \mathbf{1.50s}$)
  - Beat 33: `29.50s` ($\Delta t = \mathbf{1.50s}$)
  - Beat 34: `31.00s` ($\Delta t = \mathbf{1.50s}$)
  - Beat 35: `32.50s` ($\Delta t = \mathbf{1.50s}$)
  Four consecutive beats violate the stated $1.40\text{s}$ upper bound!
  Furthermore, `apps/video/scripts/verify-benchmark-audit.ts` line 10 altered the upper bound check to `[0.50s, 1.50s]`, masking this discrepancy while the text claimed $1.40\text{s}$.

#### F. Storyboard Duration Arithmetic:
- **Deliverable Claim (lines 13, 312)**:
  `67.6% (23.00s) Real Application / 32.4% (11.00s) Editorial Framing`
- **Storyboard Timecodes Reality**:
  - Act I (Editorial): 0.00s – 4.00s = 4.00s
  - Act II (Real App): 4.00s – 11.50s = 7.50s
  - Act III (Real App): 11.50s – 19.50s = 8.00s
  - Act IV (Real App): 19.50s – 26.50s = 7.00s
  - Act V (Editorial): 26.50s – 34.00s = 7.50s
  Sum of Real Application (Acts II + III + IV) = $7.50 + 8.00 + 7.00 = \mathbf{22.50s}$ ($66.18\%$).
  Sum of Editorial Framing (Acts I + V) = $4.00 + 7.50 = \mathbf{11.50s}$ ($33.82\%$).
  The 23.00s / 11.00s figure is an off-by-0.5s arithmetic discrepancy.

#### G. Deprecation Matrix & Verification Tests:
- All 14 files in the Deprecation Matrix (`apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md` Section 7.2) exist and match real files.
- Monorepo tests: `bun test` ran 60 unit tests across math modules; 60 passed in 2.10s.
- Monorepo typecheck: `bun run typecheck` passed cleanly in 5.11s.

---

## 2. Logic Chain

1. **Premise 1**: The deliverable's central mandate (`ORIGINAL_REQUEST.md` and `DISPATCH.md`) is that the showcase film specification must be strictly grounded in the monorepo codebase truth, with zero fabricated capabilities or unexecutable parameters.
2. **Premise 2**: In Hero Moment 1, the specification claims that the live engine evaluates an $80^3$ voxel grid with telemetry `TETRAHEDRA: 512,000`.
3. **Inference from Obs 1.1.A**:
   - Evaluating an $80^3$ grid requires 2.12 MB, exceeding `MAX_IMPLICIT_FIELD_VALUES_BYTES` (2.00 MB), triggering an immediate runtime throw in `sampleImplicitScalarField.ts`.
   - `packages/scene/src/defaults.ts` caps implicit resolution at 48 (`MAX_IMPLICIT_SURFACE_RESOLUTION = 48`).
   - Mathematically, $80^3 = 512,000$ is the cube count. Conforming decomposition generates 6 tetrahedra per cube, so an 80-cube grid would have $3,072,000$ tetrahedra. Calling 512,000 "TETRAHEDRA" is a geometric counting error.
   - Therefore, the claimed $80^3$ resolution and `TETRAHEDRA: 512,000` telemetry is unexecutable and mathematically erroneous.
4. **Premise 3**: In Hero Moment 4, the specification claims `matrixEigen.ts` contains a "Cardano cubic solver".
5. **Inference from Obs 1.1.D**:
   - `matrixEigen.ts` explicitly documented the architectural decision to avoid a hand-rolled cubic solver, instead using `mathjs` `eigs` with residual verification.
   - Claiming a Cardano cubic solver is a false technical attribution that misrepresents the codebase.
6. **Premise 4**: The deliverable claims all event intervals are strictly bounded by $0.50\text{s} \le \Delta t \le 1.40\text{s}$, and asserts this as a verified constraint in Section 8.
7. **Inference from Obs 1.1.E**:
   - Beats 32–35 in Table 5.4 have $\Delta t = 1.50\text{s}$.
   - Self-certifying that all beats satisfy $\Delta t \le 1.40\text{s}$ while four beats are $1.50\text{s}$ is an internal contradiction.
8. **Premise 5**: The ratio of Real App to Editorial is stated as 23.00s / 11.00s (67.6% / 32.4%).
9. **Inference from Obs 1.1.F**:
   - The shot timecodes sum to 22.50s / 11.50s (66.2% / 33.8%).
10. **Conclusion**: While the document is otherwise exceptional in its creative direction, forensic breakdown, sound architecture, and deprecation matrix, these technical and mathematical discrepancies must be corrected before the specification can be certified for the production phase.

---

## 3. Review Findings

### [Critical] Finding 1: Unexecutable Voxel Grid & Geometric Tetrahedra Conflation
- **What**: The specification claims an $80^3$ voxel grid in Marching Tetrahedra and displays HUD telemetry `TETRAHEDRA: 512,000 // EVAL: 0.82ms`.
- **Where**: `apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`, lines 327, 429, 431.
- **Why**:
  1. `packages/scene/src/defaults.ts` line 100 sets `MAX_IMPLICIT_SURFACE_RESOLUTION = 48`. Resolution 80 is clamped to 48.
  2. If unclamped, an $80^3$ grid requires $(81)^3 \times 4 = 2,125,764$ bytes, exceeding `MAX_IMPLICIT_FIELD_VALUES_BYTES = 2_000_000` in `sampleImplicitField.ts:29`, triggering a runtime crash.
  3. $80^3 = 512,000$ is the number of **cubes (voxels)**, NOT tetrahedra. With 6 tetrahedra per cube, it would be $3,072,000$ tetrahedra. At canonical max resolution $N=48$, there are $48^3 = 110,592$ cubes and $110,592 \times 6 = 663,552$ tetrahedra.
- **Suggestion**:
  Update lines 327, 429, and 431 to reflect the canonical maximum resolution:
  - Text: *"Rust WebAssembly postfix bytecode VM executes conforming 6-tetrahedra cube decomposition across a $48^3$ voxel grid (`marchingTetrahedra.ts`), instantiating the vertex buffer."*
  - Telemetry: `VOXELS: 110,592 // TETRAHEDRA: 663,552 // EVAL: 0.82ms` (or `CELLS: 110,592 // TETRAHEDRA: 663,552`).

### [Major] Finding 2: Algorithm Misattribution in Linear Operator Eigensolver
- **What**: The specification states that `matrixEigen.ts` uses a "Cardano cubic solver".
- **Where**: `apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`, line 481.
- **Why**: In `apps/graph/lib/math/matrixEigen.ts` lines 3–8, the architectural decision is explicitly documented: *"No hand-rolled cubic/root solver. reuse mathjs `eigs` — already a direct dependency... correct on 2×2/3×3 diagonal, rotation... defective 3×3... and repeated eigenvalues"*. Attributing this to a Cardano solver is factually wrong.
- **Suggestion**:
  Update line 481 to: *"Eigendecomposition via `mathjs` numerical eigensolver with deterministic residual verification ($||A\mathbf{v} - \lambda \mathbf{v}|| \le \epsilon$) in `matrixEigen.ts`. Renders invariant rays and volume deformation."*

### [Major] Finding 3: Internal Contradiction in Pacing Interval Bounds
- **What**: The specification claims in lines 196, 540, and 749 that visual event intervals are strictly bounded by $0.50\text{s} \le \Delta t \le 1.40\text{s}$. However, Table 5.4 lists four consecutive beats with $\Delta t = 1.50\text{s}$.
- **Where**: `apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`, lines 196, 540, 577–580, 749.
- **Why**: Beats 32, 33, 34, and 35 have $\Delta t = 1.50\text{s}$. The text self-certifies compliance with $1.40\text{s}$ while contradicting itself in the table.
- **Suggestion**:
  Either:
  1. Update the specification bound from $1.40\text{s}$ to $1.50\text{s}$ throughout the document (matching `verify-benchmark-audit.ts` line 10): $0.50\text{s} \le \Delta t \le 1.50\text{s}$, OR
  2. Adjust Beats 32–35 timecodes slightly (e.g. 27.8s, 29.1s, 30.4s, 31.8s) so all deltas are $\le 1.40\text{s}$.

### [Minor] Finding 4: Ratio Arithmetic Discrepancy
- **What**: Ratio is stated as 67.6% (23.00s) Real App / 32.4% (11.00s) Editorial, but storyboard shot timecodes sum to 22.50s (66.2%) Real App / 11.50s (33.8%) Editorial.
- **Where**: `apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`, lines 13, 309–312.
- **Why**:
  - Act I (Editorial) = 4.00s; Act V (Editorial) = 7.50s $\implies$ Total Editorial = 11.50s.
  - Acts II (7.50s) + III (8.00s) + IV (7.00s) $\implies$ Total Real App = 22.50s.
  - $22.50 / 34.00 = 66.2\%$, $11.50 / 34.00 = 33.8\%$.
- **Suggestion**:
  Align lines 13 and 312 to: **66.2% (22.50s)** Live Three.js WebGPU Application Interaction / **33.8% (11.50s)** Editorial Prestige Framing (or extend Shot 4.2 by 0.50s and reduce Shot 5.1 by 0.50s to achieve exactly 23.00s / 11.00s).

---

## 4. Adversarial Stress-Test Challenges

### [High] Challenge 1: WebGPU Headless Playwright Context Creation Failure
- **Assumption Challenged**: Headless Chromium in Playwright can capture Three.js WebGPU canvas buffers at $3840 \times 2160$ @ 60 fps without configuration caveats.
- **Attack Scenario**: By default, headless Chromium without GPU flags or on CI/remote Linux servers cannot acquire a `navigator.gpu` adapter. When Three.js `WebGPURenderer` attempts to initialize WebGPU, it either throws or falls back to WebGL2 backend. If `canvas.toBlob()` is called asynchronously outside the render loop without `preserveDrawingBuffer: true`, the backbuffer is cleared by the compositor, capturing blank black frames.
- **Blast Radius**: High. 4K capture script crashes or dumps empty black PNGs.
- **Mitigation**:
  In Section 7.1, explicitly document the mandatory capture flags:
  1. Chromium launch args: `["--enable-unsafe-webgpu", "--use-angle=metal", "--enable-features=Vulkan"]` (or explicit software WebGL2 fallback verification).
  2. Canvas capture mechanism: Use Chrome DevTools Protocol (CDP) `Page.captureScreenshot` / `page.screenshot()`, which captures the compositor output directly and avoids `preserveDrawingBuffer` clearing bugs.
  3. Frame stepping: Hook `requestAnimationFrame` via `window.__VINCULUM_TIMELINE_TICK(frame)` to synchronously tick both Three.js and CSS2DRenderer before screenshot capture.

### [Medium] Challenge 2: Audio Stems Loudness Summation & True-Peak Clipping
- **Assumption Challenged**: Summing three discrete audio stems (`stem1` at 0.90, `stem2` at 0.80, `stem3` at 0.75) concurrently will meet True Peak $\le -1.0\text{ dBTP}$ and Integrated Loudness $-14.0\text{ LUFS}$.
- **Attack Scenario**: If Stem 1 (mechanical switch click, transient peak -11 dBFS) coincides with Stem 2 (40Hz bass swell, peak -7 dBFS) and Stem 3 (crystalline tine, peak -7 dBFS) at frame 390 (Gyroid emergence), the linear acoustic sum of these signals will exceed $0\text{ dBFS}$, causing digital clipping distortion during ffmpeg stem mixdown in Remotion.
- **Blast Radius**: Audio distortion / harsh clipping on high-mass transitions.
- **Mitigation**:
  Mandate a master lookahead limiter (-1.0 dBTP ceiling, 5ms lookahead) on the final Remotion audio render pass, or calibrate individual stem mastering ceilings so worst-case phase summation never exceeds -1.0 dBTP.

---

## 5. Verified Claims Matrix

| Claim | Deliverable Citation | Verification Method | Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Gyroid Implicit Equation** | $\sin(x)\cos(y) + \sin(y)\cos(z) + \sin(z)\cos(x) = a$ | `apps/graph/test/implicitSurfaceExtraction.test.ts:429` | **PASS** | Verified in test suite |
| **Conforming 6-Tetrahedra Decomposition** | `marchingTetrahedra.ts` | `apps/graph/lib/math/marchingTetrahedra.ts:20–24` | **PASS** | Exact algorithm verified |
| **Rust WASM VM Bytecode Core** | `rustMath.ts` | `apps/graph/lib/math/rustMath.ts:1–35` | **PASS** | Verified WASM instance & opcodes |
| **Voxel Grid Resolution = 80** | Lines 327, 429 | `packages/scene/src/defaults.ts:100`, `sampleImplicitField.ts:29` | **FAIL** | Max is 48; 80 throws memory error |
| **Tetrahedra Count = 512,000** | Line 431 | Geometric calculation ($6 \times \text{cubes}$) | **FAIL** | Conflates 512k cubes with tets |
| **Hyperbolic Saddle Derivatives** | $\partial z/\partial x = 1.5, \partial z/\partial y = -1.0$ at $(1.5, 1.0)$ | `apps/graph/lib/math/surfaceDifferential.ts` | **PASS** | Exact analytical match |
| **Normal Vector $\hat{\mathbf{n}}$** | $\langle 0.728, -0.485, -0.485 \rangle$ | Magnitude $\|\nabla G\| = \sqrt{4.25}$ | **PASS** | Exact down to 3rd decimal |
| **Armed Pick Workflow** | `DifferentialAnalysisSection.tsx` | `apps/graph/components/inspector/DifferentialAnalysisSection.tsx:28–32` | **PASS** | Store actions match exactly |
| **RK4 Streamline Integrator** | $d\mathbf{X}/ds = \mathbf{F}/\|\mathbf{F}\|$ | `apps/graph/lib/math/streamlineIntegrate.ts:5–16` | **PASS** | Exact per-stage normalization |
| **Limit Cycle Attractor** | $x^2 + y^2 = 1$ | Analysis of $\mathbf{F} = \langle -y, x, z(1 - x^2 - y^2) \rangle$ | **PASS** | Cylinder limit cycle verified |
| **3px Screen-Space Wide Strokes** | `Line2NodeMaterial` | `apps/graph/lib/graph3d/graphWideStroke.ts:8–18` | **PASS** | `three/webgpu` `linewidth: 3` verified |
| **Linear Operator Multi-View Quad** | Scissor test partition | `apps/graph/lib/graph3d/graphThreeGeometryMultiView.ts:472–497` | **PASS** | `renderer.setScissorTest(true)` verified |
| **Cardano Cubic Solver** | Line 481 | `apps/graph/lib/math/matrixEigen.ts:3–8` | **FAIL** | Does not exist; uses `mathjs` `eigs` |
| **Pacing Interval Bound $\le 1.40\text{s}$** | Lines 196, 540, 749 | Inspection of Table 5.4 beats 32–35 | **FAIL** | Beats 32–35 are $1.50\text{s}$ |
| **Duration Sum (23.00s / 11.00s)** | Lines 13, 312 | Sum of storyboard shot timecodes | **FAIL** | Sums to 22.50s / 11.50s (0.5s off) |
| **Cumulative Negative Silence $\ge 4.0\text{s}$** | Section 6.2 | Sum of silence durations in cue sheet | **PASS** | Sums to 4.80s ($\ge 4.0\text{s}$) |
| **Deprecation Matrix Completeness** | Section 7.2 (14 files) | File system inspection across `apps/video` | **PASS** | All 14 files exist and verified |

---

## 6. Caveats

- **No Caveats on Codebase Investigation**: All cited engine files across `apps/graph`, `packages/scene`, and `apps/video` were directly inspected on disk and executed through unit tests and typechecks.
- **Capture Script Implementation Scope**: Per user prompt instructions, implementation of the video capture script and Remotion video code is explicitly deferred to the next phase ("zero implementation of video code in this phase"). Technical evaluation of the capture pipeline was conducted at the architectural level.

---

## 7. Conclusion

`apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md` is an exceptionally thorough, high-conviction creative and architectural document. It delivers a devastating forensic deconstruction of previous video failures, completely reimagines the sound design with a psychoacoustically justified 4-stem architecture, and establishes a 34.00s storyboard with high event density.

However, as an uncompromising reviewer and adversarial critic, the following **four concrete items** must be corrected before this deliverable can be approved:
1. **Fix Marching Tetrahedra Resolution & Counting**: Change the unexecutable $80^3$ resolution to the engine's canonical maximum of $48^3$, and correct the telemetry from `TETRAHEDRA: 512,000` to `VOXELS: 110,592 // TETRAHEDRA: 663,552` (lines 327, 429, 431).
2. **Correct Eigensolver Attribution**: Remove the claim of a "Cardano cubic solver" in `matrixEigen.ts` and replace it with `mathjs` `eigs` with deterministic residual checking (line 481).
3. **Reconcile Pacing Bound Contradiction**: Either adjust the text to $0.50\text{s} \le \Delta t \le 1.50\text{s}$ or tighten Beats 32–35 to $\le 1.40\text{s}$ (lines 196, 540, 577–580, 749).
4. **Reconcile Duration Sum**: Update the ratio summary to 66.2% (22.50s) / 33.8% (11.50s) or adjust shot durations by 0.50s to achieve exact 23.00s / 11.00s alignment (lines 13, 309–312).

Once these changes are applied, the specification will achieve 100% mathematical and technical integrity.

**Verdict: REQUEST_CHANGES**

---

## 8. Verification Method

To independently verify the observations and findings in this report:

1. **Verify Resolution Cap & Memory Budget**:
   - Inspect `packages/scene/src/defaults.ts:100` (`MAX_IMPLICIT_SURFACE_RESOLUTION = 48`).
   - Inspect `apps/graph/lib/math/sampleImplicitField.ts:29–55` (`MAX_IMPLICIT_FIELD_VALUES_BYTES = 2_000_000`).
   - Run: `bun test apps/graph/test/implicitSurfaceExtraction.test.ts` (inspect lines 528–562).
2. **Verify Eigensolver Gate Decision**:
   - Inspect `apps/graph/lib/math/matrixEigen.ts:3–8` (confirm absence of Cardano solver; presence of `mathjs.eigs`).
   - Run: `bun test apps/graph/test/matrixEigen.test.ts`.
3. **Verify Pacing Bound Discrepancy**:
   - Inspect Table 5.4 in `apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md:577–580` (confirm $\Delta t = 1.50\text{s}$ on Beats 32, 33, 34, 35 vs $\le 1.40\text{s}$ in lines 196, 540, 749).
4. **Verify Duration Arithmetic**:
   - Sum durations in Section 5.3: Act I (4.0s) + Act II (7.5s) + Act III (8.0s) + Act IV (7.0s) + Act V (7.5s) = 34.0s. Acts II+III+IV = 22.5s, Acts I+V = 11.5s.
5. **Run Full Test Suite**:
   ```bash
   bun test apps/graph/test/marchingTetrahedra.test.ts apps/graph/test/implicitSurfaceExtraction.test.ts apps/graph/test/surfaceDifferential.test.ts apps/graph/test/streamlineIntegrate.test.ts apps/graph/test/matrixEigen.test.ts
   bun run typecheck
   ```
