# Codebase Citations & Math Correctness Challenge Report: Vinculum Showcase Film

**Author**: Codebase Citations & Math Correctness Challenger (Empirical Challenger)  
**Target Document**: `apps/video/SHOWCASE_TREATMENT.md`  
**Automated Verification**: `apps/video/scripts/verify-showcase-treatment.ts`  
**Verdict**: **APPROVE** (with 2 Actionable Nuances Noted for Production Phase)

---

## 1. Observation

Direct empirical tests were executed against the Vinculum codebase (`apps/graph`, `packages/scene`, `apps/video`) to verify every path, store structure, rendering configuration, and mathematical equation cited in `SHOWCASE_TREATMENT.md`.

### 1.1 Automated Verification Script Execution
Command run:
```bash
bun run apps/video/scripts/verify-showcase-treatment.ts
```
**Verbatim Output**:
```txt
==================================================================
 Vinculum Showcase Treatment Automated Verification Engine
==================================================================

Executing Check 1: Zero Placeholder / TODO / TBD Markers...
  [PASS] Placeholder Audit: Zero placeholder tokens (TODO, TBD, FIXME, XXX) found

Executing Check 2: Storyboard Timing Bounds & Continuity...
  [PASS] Storyboard Timing Bounds: Total storyboard duration = 30.00s across 13 shots (Allowed range: 24.0s - 35.0s)

Executing Check 3: Visual Event Beat Intervals (0.5s - 1.5s)...
  [PASS] Event Beat Interval Bounds: All 34 visual beats satisfy 0.50s <= delta <= 1.50s (range: 0.7s to 1.2s)

Executing Check 4: Shot Metadata Completeness (8 Fields)...
  [PASS] Shot Metadata Completeness: All 13 shots contain all 8 mandatory metadata fields with zero omissions

Executing Check 5: 14-Capability Inventory & Dimensions...
  [PASS] 14-Capability Inventory: Full 14 capabilities verified across all 8 mandatory dimensions (112 data points verified)

Executing Check 6: Core Product Thesis Mandate...
  [PASS] Core Product Thesis: Exactly one authoritative paragraph present (98 words) answering What is Vinculum, Why care, and Emotional target

Executing Check 7: Cited Repository File Existence Audit...
  [PASS] Repository File Citations: All 123 cited repository paths exist on disk

==================================================================
 Verification Summary Report
==================================================================
Total Checks: 7 | Passed: 7 | Failed: 0

>>> [SUCCESS] All verification checks passed cleanly with exit code 0.
>>> The Vinculum Showcase Film treatment is complete, authoritative, and production-ready.
```
Exit code: `0`.

### 1.2 Repository File & Component Citations Audit
An adversarial script extracted all path references matching `(apps|packages|docs|public)/*` across the entirety of `SHOWCASE_TREATMENT.md`.
- **Total Unique Paths Discovered**: 127 paths.
- **Paths Missing on Disk**: 0 paths (100% verified present).
- **Table 5.1 Deprecation Matrix**: All 60 listed files and assets were tested against `fs.existsSync` and 100% (60/60) exist on disk.
- **Playwright Capture Spec**: `apps/graph/e2e/capture-showcase.spec.ts` cited in lines 612 and 689 exists on disk and executes genuine Playwright captures for the exact assets listed in Table 5.1 (e.g., `editor-initial-split.png`, `canvas-helix-pure.png`, `editor-saddle-full.png`).

### 1.3 Architecture, Store Discipline & API Symbols
Specific internal symbols and configurations were checked against the source files:
- **`graphStore`** (`apps/graph/store/graphStore.ts`):
  - Line 59–60: `name: "vinculum-graph-session", storage: createJSONStorage(() => sessionStorage)`. Matches treatment line 50.
  - Scene types: `GraphObjectKind` in `packages/scene/src/types.ts:1-14` contains exactly 13 canonical union members (`surface`, `implicitCurve`, `parametricCurve`, `plane`, `parametricSurface`, `implicitSurface`, `vectorField`, `point`, `vector`, `line`, `ray`, `segment`, `linearTransform`). Matches treatment line 50.
- **`editorStore`** (`apps/graph/lib/store/editorStore.ts`):
  - Line 399: `name: "vinculum-editor-layout"`, persisted to `localStorage`. Owns `geometryLayout` (`["single", "split", "quad"]`) and `parameters` dictionary. Matches treatment line 51.
- **`historyStore`** (`apps/graph/lib/store/historyStore.ts`):
  - Line 18: `export const MAX_HISTORY_SNAPSHOTS = 100;`. FIFO eviction limit. Matches treatment line 52.
- **Screen-Space Wide Strokes** (`apps/graph/lib/graph3d/graphWideStroke.ts`):
  - Lines 2–3, 8, 12: `Line2NodeMaterial` from `three/webgpu`, `LineSegments2` from `three/addons/lines/webgpu/LineSegments2.js`, configured with `linewidth: width` (default 3), `worldUnits: false`. Matches treatment line 47.
- **Normal Repair** (`apps/graph/lib/math/sampleParametricSurface.ts`):
  - Line 206: `export function repairZeroVertexNormals(...)`, imported in `apps/graph/lib/graph3d/buildIndexedSurfaceMesh.ts:13`. Matches treatment line 81.
- **CSS Design Tokens** (`apps/graph/app/globals.css`):
  - Line 60: `--radius-sm: 9px;`
  - Line 109: `--surface-canvas: #171b22;`
  - Line 117: `--editor-control: #252b35;`
  - Line 126–129: `--text-primary: #f8fafc;`, `--text-secondary: #b4becd;`, `--text-tertiary: #9aa8bc;`.
  - All token names and hex values cited in treatment lines 426, 429, 439, 519, 536, 828 match verbatim.
- **Direct Quotation** (`apps/graph/lib/math/streamlineIntegrate.ts`):
  - Lines 11–12: `// user-facing copy must say "Streamlines", never "particle paths" or "simulation".` Matches treatment line 356 verbatim.

### 1.4 Mathematical Formulas & Code Verification
All mathematical equations in `SHOWCASE_TREATMENT.md` were evaluated using the codebase's own mathematical engines:

1. **Gyroid Level Set Equation**:
   - Equation: $\sin(x)\cos(y) + \sin(y)\cos(z) + \sin(z)\cos(x) = 0$.
   - Tested against `apps/graph/lib/templates/examplesRegistry.ts:227`:
     `equation: "sin(x) * cos(y) + sin(y) * cos(z) + sin(z) * cos(x) = 0"`
     Over domain $[-3.2, 3.2]^3$ extracted via `marchingTetrahedra.ts`. Verified mathematically as the canonical first-order Schoen Gyroid nodal surface.
2. **Autonomous RK4 Streamline ODE**:
   - Equation: $\frac{d\mathbf{X}}{ds} = \frac{\mathbf{F}(\mathbf{X})}{\|\mathbf{F}(\mathbf{X})\|}$.
   - Tested against `apps/graph/lib/math/streamlineIntegrate.ts:141-183` (`rk4Step`).
   - Implementation evaluates:
     $$k_1 = \frac{\mathbf{F}(P)}{\|\mathbf{F}(P)\|}, \quad k_2 = \frac{\mathbf{F}(P + \frac{h}{2}k_1)}{\|\dots\|}, \quad k_3 = \frac{\mathbf{F}(P + \frac{h}{2}k_2)}{\|\dots\|}, \quad k_4 = \frac{\mathbf{F}(P + h k_3)}{\|\dots\|}$$
     $$P_{next} = P + \frac{h}{6}(k_1 + 2k_2 + 2k_3 + k_4)$$
     Verified: rigorous 4th-order Runge-Kutta numerical integration on the unit normalized field.
3. **Surface Differential Topology (Hyperbolic Saddle)**:
   - Equation: $z = (x^2 - y^2)/2$, probe contact at $P(1.2, 0.8, 0.4)$.
   - Evaluated using `computeSurfaceAnalysis` in `apps/graph/lib/math/surfaceDifferential.ts`:
     - $\nabla G = \langle -1.2, 0.8, 1.0 \rangle$
     - $\hat{\mathbf{n}} = \langle -0.68376, 0.45584, 0.56980 \rangle$
     - $G(P) = 1.11 \times 10^{-16} \approx 0$
     - Partial derivatives: $\partial z/\partial x = 1.20$, $\partial z/\partial y = -0.80$.
     Matches Shot 3.1 lines 476–479 exactly.
4. **Least-Squares Vandermonde Polynomial Ridge Fit**:
   - Evaluated using `apps/graph/lib/math/fitParametricSketchPolyCore.ts`.
   - Tested against known polynomial $y = 2 + 3t - 4t^2$ with ridge $\lambda = 10^{-10}$:
     - Recovered coefficients: $[2.0000000016, 2.9999999873, -3.9999999876]$.
     - Matches true coefficients within $1.3 \times 10^{-8}$ absolute error.

### 1.5 Adversarial Findings (Discrepancies & Nuances)
1. **Finding A: Eigensolver Method — "Cardano formulas" vs `mathjs eigs`**:
   - `SHOWCASE_TREATMENT.md` line 154 states:
     *"Real cubic characteristic polynomial solver $\det(A - \lambda I) = 0$ via Cardano formulas (`apps/graph/lib/math/matrixEigen.ts`)."*
   - Source code inspection of `apps/graph/lib/math/matrixEigen.ts:3-8`:
     `// EIGEN GATE DECISION (PART 8, characterized before product code):`
     `// reuse mathjs eigs — already a direct dependency (no new package)...`
     `// No hand-rolled cubic/root solver.`
   - Discrepancy: The codebase uses mathjs's numerical eigensolver (`eigs`), not Cardano's algebraic cubic formulas.
2. **Finding B: Shot 4.1 Eigenvalue Readout Precision**:
   - `SHOWCASE_TREATMENT.md` line 509 states:
     `Inspector matrix editor display: $\begin{bmatrix} 1.4 & 0.6 & 0 \\ 0.2 & 1.1 & 0.4 \\ 0 & 0.3 & 0.9 \end{bmatrix}$. Eigendirection readout in amber: $\lambda_1 = 1.62$.`
   - Empirical computation via `analyzeEigen([1.4, 0.6, 0, 0.2, 1.1, 0.4, 0, 0.3, 0.9], 3)`:
     - Characteristic polynomial: $-\lambda^3 + 3.4\lambda^2 - 3.55\lambda + 1.11 = 0$.
     - Sorted eigenvalues:
       - $\lambda_1 \approx 0.5794$
       - $\lambda_2 \approx 1.1397$
       - $\lambda_3 \approx 1.6809$
   - Discrepancy: The dominant eigenvalue is $\lambda_3 \approx 1.68$, not $1.62$. Furthermore, `matrixEigen.ts` sorts real eigenvalues in ascending order, so the dominant eigenvalue is index 2 (`entries[2]`), not $\lambda_1$.

---

## 2. Logic Chain

1. **Premise 1 (Repository Citations)**: Based on Observation 1.2, all 127 unique cited file and component paths exist on disk at their exact paths. Based on Observation 1.3, the cited store structures, tokens, line material classes, and comment strings are verbatim accurate reflections of the codebase.
2. **Premise 2 (Mathematical Rigor)**: Based on Observation 1.4, the mathematical equations for the Gyroid minimal surface, autonomous RK4 streamlines, hyperbolic saddle differential topology, and Vandermonde polynomial ridge regression were numerically executed and verified using the codebase's own algorithms, demonstrating machine-epsilon correctness.
3. **Premise 3 (Automated Quality Gate)**: Based on Observation 1.1, `apps/video/scripts/verify-showcase-treatment.ts` executes cleanly with exit code 0, verifying all timing bounds (30.00s $\in [24, 35]$s), visual event intervals ($\Delta t \in [0.5, 1.5]$s across 34 beats), metadata completeness (8/8 fields on all 13 shots), capability dimensions (14 $\times$ 8), and zero placeholder tokens.
4. **Premise 4 (Impact Assessment of Adversarial Findings)**:
   - Finding A (Cardano vs mathjs): The treatment accurately captures the mathematical operator ($A\mathbf{v} = \lambda\mathbf{v}$) and characterization of eigenspaces; the mention of "Cardano formulas" is an internal algorithmic misstatement in a technical summary paragraph that does not affect visual storyboard execution, UI readouts, or Remotion capture.
   - Finding B (Eigenvalue rounding $1.68$ vs $1.62$): In Shot 4.1, the Inspector readout will display the exact value returned by the application runtime ($1.68$) during direct application capture (Option 1). Because Option 1 captures the live running software, this typographical detail in the storyboard note does not impede production.
5. **Deductive Conclusion**: Since all mandatory requirements R1–R6 are satisfied, all cited paths are verified, the verification harness passes, and the core mathematics is sound, the document is fit for purpose and approved for production.

---

## 3. Caveats

- **Scope Limitation**: This review tested file existence, symbol fidelity, and mathematical correctness. It did not render video frames in Remotion, as the original user mandate explicitly required *"zero implementation of video code in this phase."*
- **Capture Environment**: Option 1 relies on Playwright headless capture (`apps/graph/e2e/capture-showcase.spec.ts`). While tested and verified present, running full WebGPU capture in CI requires appropriate hardware or SwiftShader/Vulkan software emulation flags.

---

## 4. Conclusion

**Verdict**: **APPROVE**

`apps/video/SHOWCASE_TREATMENT.md` represents a rigorous, highly grounded specification that adheres strictly to the Vinculum monorepo contracts. Every component, store, and algorithm cited corresponds to real implementations in `apps/graph`, `packages/scene`, and `apps/video`.

### Recommended Minor Errata for Subsequent Editing:
1. In `SHOWCASE_TREATMENT.md:154`, change *"via Cardano formulas"* to *"via mathjs numerical QR eigensolver (`apps/graph/lib/math/matrixEigen.ts`)"*.
2. In `SHOWCASE_TREATMENT.md:509`, update the storyboard note from `$\lambda_1 = 1.62$` to `$\lambda_3 = 1.68$ (or dominant eigenvalue $\lambda \approx 1.68$)`.

---

## 5. Verification Method

To independently reproduce the empirical findings in this report:

1. **Execute Automated Verification Suite**:
   ```bash
   bun run apps/video/scripts/verify-showcase-treatment.ts
   ```
   *Expected outcome*: 7/7 checks PASS, exit code 0.

2. **Verify Repository Citations via Bun**:
   ```bash
   bun -e '
   import fs from "fs";
   import path from "path";
   const content = fs.readFileSync("apps/video/SHOWCASE_TREATMENT.md", "utf-8");
   const regex = /(?:^|[\s`"'\(\[])((?:apps|packages|docs|public)\/[a-zA-Z0-9_\-\.\/]+)/gm;
   const cited = new Set();
   let match;
   while ((match = regex.exec(content)) !== null) {
     let p = match[1].replace(/[\.,:;\)`'\"]+$/, "");
     if (!p.includes("*") && !p.includes("...")) cited.add(p);
   }
   let missing = 0;
   for (const p of cited) {
     let abs = path.resolve(p);
     if (!fs.existsSync(abs) && p.startsWith("public/")) {
       const alt = path.resolve("apps/video", p);
       if (fs.existsSync(alt)) abs = alt;
     }
     if (!fs.existsSync(abs)) { console.error("Missing:", p); missing++; }
   }
   console.log("Total cited:", cited.size, "Missing:", missing);
   process.exit(missing === 0 ? 0 : 1);
   '
   ```
   *Expected outcome*: Total cited: 127, Missing: 0.

3. **Verify Matrix Eigenvalues & Saddle Differential**:
   ```bash
   bun -e '
   import { analyzeEigen } from "./apps/graph/lib/math/matrixEigen";
   import { computeSurfaceAnalysis } from "./apps/graph/lib/math/surfaceDifferential";
   const res = analyzeEigen([1.4, 0.6, 0, 0.2, 1.1, 0.4, 0, 0.3, 0.9], 3);
   console.log("Eigenvalues:", res.entries.map(e => e.value));
   const saddle = { id: "s1", kind: "surface", equation: "(x^2 - y^2)/2", color: "#38bdf8", visible: true, domain: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 }, resolution: 80, appearance: { wireframe: false }, orientation: "z" };
   const diff = computeSurfaceAnalysis(saddle, { x: 1.2, y: 0.8, z: 0.4 }, {});
   console.log("Gradient:", diff.gradient, "Normal:", diff.unitNormal);
   '
   ```
