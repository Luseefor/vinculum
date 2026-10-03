# Exact Line-by-Line Remediation Plan: Showcase Film Specification

**Target Document**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`  
**Author**: Explorer Remediation 1 (Codebase & Specification Remediation Explorer)  
**Date**: October 3, 2026  
**Status**: Ready for Worker Execution  

---

## 1. Executive Summary of Remediation Items

This remediation plan provides an exact, line-by-line blueprint to resolve all findings from Gate Iteration 2 (Reviewer 2 Technical Parity Review and Challenger 1 Timing Challenge). Every edit is grounded directly in monorepo codebase source truth (`packages/scene/src/defaults.ts`, `apps/graph/lib/math/sampleImplicitField.ts`, `apps/graph/lib/math/marchingTetrahedra.ts`, `apps/graph/lib/math/matrixEigen.ts`, and `apps/video/scripts/verify-benchmark-audit.ts`).

| Item # | Focus Area | Target Lines | Core Problem | Remediation Action |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Implicit Surface Resolution & Tetrahedra Counting** | 327, 429, 431 | Claimed $80^3$ resolution exceeds memory budget ($>2\text{ MB}$) and resolution cap ($48$); conflated 512,000 voxels with tetrahedra. | Replace $80^3$ with canonical max $48^3$; replace `TETRAHEDRA: 512,000` with `VOXELS: 110,592 // TETRAHEDRA: 663,552`. |
| **2** | **Eigensolver Attribution** | 481 | Claimed "Cardano cubic solver" in `matrixEigen.ts` when codebase explicitly uses `mathjs.eigs` with residual verification. | Replace "Cardano cubic solver" with `mathjs` numerical eigensolver with residual verification ($||A\mathbf{v} - \lambda \mathbf{v}|| \le \epsilon$). |
| **3** | **Pacing Interval Bounds Consistency** | 196, 540, 749 | Text and attestation claimed upper bound of $1.40\text{s}$, but Table 5.4 Beats 32–35 have $\Delta t = 1.50\text{s}$. | Update upper bound from $1.40\text{s}$ to $1.50\text{s}$ ($0.50\text{s} \le \Delta t \le 1.50\text{s}$), matching Table 5.4, script, and prompt. |
| **4** | **Duration Ratio Arithmetic Alignment** | 13, 252, 295, 312, 315, 316 | Summary claimed 67.6% (23.00s) / 32.4% (11.00s), but exact shot sum is 22.50s / 11.50s (66.2% / 33.8%). | Align all ratio references to exact arithmetic sum: **66.2% (22.50s)** App / **33.8% (11.50s)** Editorial. |
| **5** | **Silence Terminology ($-\infty\text{ dBFS}$)** | 516, 601, 624, 634, 649, 659, 693 | In digital audio, 0 dBFS is peak clipping level; digital silence is $-\infty\text{ dBFS}$. | Replace all occurrences of "0 dBFS silence/vacuums" with $-\infty\text{ dBFS}$ digital silence. |

---

## 2. Line-by-Line Replacement Specifications

### Item 1: Implicit Surface Resolution & Tetrahedra Counting

#### Edit 1.1: Section 5.1, Hero Moment 1 Description
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 327
- **Existing Content**:
  ```markdown
     - *Action*: User types equation; Rust WASM VM executes 6-tetrahedra cube decomposition across an $80^3$ voxel grid. Slider $a$ scrubs from $0.0 \to 0.8$, demonstrating live topological dilation and aperture bifurcation at 60 fps.
  ```
- **Replacement Content**:
  ```markdown
     - *Action*: User types equation; Rust WASM VM executes 6-tetrahedra cube decomposition across a $48^3$ voxel grid. Slider $a$ scrubs from $0.0 \to 0.8$, demonstrating live topological dilation and aperture bifurcation at 60 fps.
  ```
- **Rationale**: `packages/scene/src/defaults.ts:100` mandates `MAX_IMPLICIT_SURFACE_RESOLUTION = 48`. A resolution of 80 is clamped by `normalizeImplicitSurfaceResolution` and would otherwise exceed `MAX_IMPLICIT_FIELD_VALUES_BYTES` (2MB).

#### Edit 1.2: Section 5.3, Shot 2.2 Actual Product Action
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 429
- **Existing Content**:
  ```markdown
  - **Actual Product Action**: Rust WebAssembly postfix bytecode VM executes conforming 6-tetrahedra cube decomposition across an $80^3$ voxel grid (`marchingTetrahedra.ts`), instantiating the vertex buffer.
  ```
- **Replacement Content**:
  ```markdown
  - **Actual Product Action**: Rust WebAssembly postfix bytecode VM executes conforming 6-tetrahedra cube decomposition across a $48^3$ voxel grid (`marchingTetrahedra.ts`), instantiating the vertex buffer.
  ```
- **Rationale**: Aligns Shot 2.2 product action with the engine's canonical maximum resolution ($N=48$).

#### Edit 1.3: Section 5.3, Shot 2.2 Typography Readout
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 431
- **Existing Content**:
  ```markdown
  - **Typography**: Telemetry readout in lower-left: `VERTICES: 142,800 // TETRAHEDRA: 512,000 // EVAL: 0.82ms` (SF Mono, 10px, color `#475569`).
  ```
- **Replacement Content**:
  ```markdown
  - **Typography**: Telemetry readout in lower-left: `VOXELS: 110,592 // TETRAHEDRA: 663,552 // EVAL: 0.82ms` (SF Mono, 10px, color `#475569`).
  ```
- **Rationale**: For an $N=48$ voxel grid, total voxels (cubes) = $48^3 = 110,592$. Each cube decomposes into 6 tetrahedra in `marchingTetrahedra.ts:20–24`, giving $110,592 \times 6 = 663,552$ tetrahedra. Displaying voxels and true tetrahedra corrects the mathematical conflation while remaining 100% faithful to the codebase.

---

### Item 2: Eigensolver Attribution

#### Edit 2.1: Section 5.3, Shot 4.1 Actual Product Action
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 481
- **Existing Content**:
  ```markdown
  - **Actual Product Action**: Eigendecomposition and Cardano cubic solver in `matrixEigen.ts`. Renders invariant rays and volume deformation.
  ```
- **Replacement Content**:
  ```markdown
  - **Actual Product Action**: Eigendecomposition via `mathjs` numerical eigensolver with deterministic residual verification ($||A\mathbf{v} - \lambda \mathbf{v}|| \le \epsilon$) in `matrixEigen.ts`. Renders invariant rays and volume deformation.
  ```
- **Rationale**: `apps/graph/lib/math/matrixEigen.ts:3–8` explicitly documents the architecture decision: "No hand-rolled cubic/root solver. reuse mathjs `eigs`... correct on 2×2/3×3 diagonal, rotation... defective 3×3... and repeated eigenvalues". Attributing to Cardano solver was factually erroneous.

---

### Item 3: Pacing Interval Bounds Consistency

#### Edit 3.1: Section 3.1, Linear Launch Films Benchmark Application
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 196
- **Existing Content**:
  ```markdown
  - **Application to Vinculum**: The 34.00s film is structured with 35 distinct visual event beats, with every interval strictly bounded between 0.50s and 1.40s.
  ```
- **Replacement Content**:
  ```markdown
  - **Application to Vinculum**: The 34.00s film is structured with 35 distinct visual event beats, with every interval strictly bounded between 0.50s and 1.50s.
  ```
- **Rationale**: Eliminates internal contradiction with Table 5.4 Beats 32–35, which have $\Delta t = 1.50\text{s}$. Aligns with `ORIGINAL_REQUEST.md` (0.5s–1.5s) and `verify-benchmark-audit.ts:10`.

#### Edit 3.2: Section 5.4, Rhythm Matrix Subheader
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 540
- **Existing Content**:
  ```markdown
  ### 5.4 The 35-Event Pacing & Rhythm Matrix (0.50s $\le \Delta t \le 1.40s$)
  ```
- **Replacement Content**:
  ```markdown
  ### 5.4 The 35-Event Pacing & Rhythm Matrix (0.50s $\le \Delta t \le 1.50s$)
  ```
- **Rationale**: Aligns section header directly with the actual matrix interval bounds.

#### Edit 3.3: Section 8, Verification Attestation Item 2
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 749
- **Existing Content**:
  ```markdown
  2. **Pacing Constraints**: Visual event beat intervals across all 35 beats strictly satisfy $0.50\text{s} \le \Delta t \le 1.40\text{s}$ with alternating compression and breathing room.
  ```
- **Replacement Content**:
  ```markdown
  2. **Pacing Constraints**: Visual event beat intervals across all 35 beats strictly satisfy $0.50\text{s} \le \Delta t \le 1.50\text{s}$ with alternating compression and breathing room.
  ```
- **Rationale**: Ensures the signed attestation accurately reflects the audited data table.

---

### Item 4: Duration Ratio Arithmetic Alignment

#### Edit 4.1: Metadata & Executive Specification (Line 13)
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 13
- **Existing Content**:
  ```markdown
  - **Ratio Balance**: **67.6% (23.00s)** Live Three.js WebGPU Application Interaction / **32.4% (11.00s)** Editorial Prestige Framing
  ```
- **Replacement Content**:
  ```markdown
  - **Ratio Balance**: **66.2% (22.50s)** Live Three.js WebGPU Application Interaction / **33.8% (11.50s)** Editorial Prestige Framing
  ```
- **Rationale**: Act I (4.00s) + Act V (7.50s) = 11.50s (33.82%). Act II (7.50s) + Act III (8.00s) + Act IV (7.00s) = 22.50s (66.18%). Total = 34.00s. Corrects mental addition error of 0.50s.

#### Edit 4.2: Section 4, Debate Round 1 Concession (Line 252)
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 252
- **Existing Content**:
  ```markdown
  I concede on both points: zero motion blur, zero out-of-engine CGI, and the formula bar remains sacred. We will shoot 100% real Three.js WebGPU and Rust WASM math, but we will shoot it with the optical lens discipline of an Apple Pro reveal. The formula bar will be our opening macro altar: a lateral track across the MathLive field as keystrokes land, pulling focus directly into the coordinate manifold emerging behind it. We enforce a strict **67.6% WebGPU interaction / 32.4% editorial prestige** ratio.
  ```
- **Replacement Content**:
  ```markdown
  I concede on both points: zero motion blur, zero out-of-engine CGI, and the formula bar remains sacred. We will shoot 100% real Three.js WebGPU and Rust WASM math, but we will shoot it with the optical lens discipline of an Apple Pro reveal. The formula bar will be our opening macro altar: a lateral track across the MathLive field as keystrokes land, pulling focus directly into the coordinate manifold emerging behind it. We enforce a strict **66.2% WebGPU interaction / 33.8% editorial prestige** ratio.
  ```
- **Rationale**: Consistent narrative grounding across the debate transcript.

#### Edit 4.3: Section 4, Lead Author Synthesis (Line 295)
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 295
- **Existing Content**:
  ```markdown
  2. **Critic A (Disciplined Cinematography)**: Macro camera framing, shallow depth of field, purposeful algebraically justified motion, 67.6% WebGPU / 32.4% editorial ratio, zero motion blur, zero camera shake.
  ```
- **Replacement Content**:
  ```markdown
  2. **Critic A (Disciplined Cinematography)**: Macro camera framing, shallow depth of field, purposeful algebraically justified motion, 66.2% WebGPU / 33.8% editorial ratio, zero motion blur, zero camera shake.
  ```
- **Rationale**: Aligns debate consensus summary.

#### Edit 4.4: Section 5, Storyboard Timeline Diagram Underline (Line 312)
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 312
- **Existing Content**:
  ```markdown
  ◄────── PRESTIGE ────────►◄────────────────────────────── REAL APPLICATION (67.6%) ──────────────────────────────────────────────────►◄────── PRESTIGE ────────►
  ```
- **Replacement Content**:
  ```markdown
  ◄────── PRESTIGE ────────►◄────────────────────────────── REAL APPLICATION (66.2%) ──────────────────────────────────────────────────►◄────── PRESTIGE ────────►
  ```
- **Rationale**: Aligns ASCII timeline proportion label.

#### Edit 4.5: Section 5, Storyboard Ratio Breakdown Bullets (Lines 315–316)
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Lines**: Lines 315–316
- **Existing Content**:
  ```markdown
  - **Authentic Application Interaction**: **67.6% (23.00 seconds)** — Real Three.js WebGPU canvas, live MathLive input, parameter scrubs, armed probing, RK4 streamlines, and quad-view scissor partitions.
  - **Prestige Editorial Framing**: **32.4% (11.00 seconds)** — Axiomatic typographic propositions, macro structural transitions, and authoritative monograph lockup.
  ```
- **Replacement Content**:
  ```markdown
  - **Authentic Application Interaction**: **66.2% (22.50 seconds)** — Real Three.js WebGPU canvas, live MathLive input, parameter scrubs, armed probing, RK4 streamlines, and quad-view scissor partitions.
  - **Prestige Editorial Framing**: **33.8% (11.50 seconds)** — Axiomatic typographic propositions, macro structural transitions, and authoritative monograph lockup.
  ```
- **Rationale**: Aligns detailed executive breakdown with exact act timecode sums.

---

### Item 5: Audio Cue & Digital Silence Terminology

#### Edit 5.1: Section 5.3, Shot 5.1 Sound Cue (Line 516)
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 516
- **Existing Content**:
  ```markdown
  - **Sound Cue**: **Stem 4 (Planned Negative Silence)**: At frame 1710 (28.50s), all audio cuts instantly. **1.0 second of absolute 0 dBFS dead silence** ($-\infty$ dBFS). All reverb tails killed instantly. Extreme acoustic tension.
  ```
- **Replacement Content**:
  ```markdown
  - **Sound Cue**: **Stem 4 (Planned Negative Silence)**: At frame 1710 (28.50s), all audio cuts instantly. **1.0 second of absolute $-\infty\text{ dBFS}$ dead silence**. All reverb tails killed instantly. Extreme acoustic tension.
  ```
- **Rationale**: Digital silence is represented as $-\infty\text{ dBFS}$ (zero digital signal energy); 0 dBFS is full-scale maximum peak level.

#### Edit 5.2: Section 6, 4-Stem Architecture Table (Line 601)
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 601
- **Existing Content**:
  ```markdown
  │ STEM 4: Planned Negative Silence │ Strategic 0.3s–1.2s absolute vacuums (0 dBFS), dynamic resets,│
  ```
- **Replacement Content**:
  ```markdown
  │ STEM 4: Planned Negative Silence │ Strategic 0.3s–1.2s absolute vacuums (-∞ dBFS), dynamic resets,│
  ```
- **Rationale**: Removes 0 dBFS reference from stem description table.

#### Edit 5.3: Section 6.1, Stem 4 Specification Bullet (Line 624)
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 624
- **Existing Content**:
  ```markdown
     - Pre-transformation drops (0.3s–0.8s absolute 0 dBFS dead silence immediately before visual breakthroughs).
  ```
- **Replacement Content**:
  ```markdown
     - Pre-transformation drops (0.3s–0.8s absolute $-\infty\text{ dBFS}$ dead silence immediately before visual breakthroughs).
  ```
- **Rationale**: Replaces incorrect 0 dBFS designation.

#### Edit 5.4: Section 6.2, Audio Cue Sheet Row 1 (Line 634)
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 634
- **Existing Content**:
  ```markdown
  | **0.00 – 0.60** | 0 – 36 | Macro darkness; cursor appears on pure black | **Stem 4** | **Total, dead 0 dBFS silence.** Zero room tone, zero hum. | 0 dBFS / $-\infty$ | Cleanses the listener's ear; forces hyper-focus on the void. |
  ```
- **Replacement Content**:
  ```markdown
  | **0.00 – 0.60** | 0 – 36 | Macro darkness; cursor appears on pure black | **Stem 4** | **Total, dead $-\infty\text{ dBFS}$ silence.** Zero room tone, zero hum. | $-\infty\text{ dBFS}$ | Cleanses the listener's ear; forces hyper-focus on the void. |
  ```
- **Rationale**: Replaces `0 dBFS` in description and level target column.

#### Edit 5.5: Section 6.2, Audio Cue Sheet Row 16 (Line 649)
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 649
- **Existing Content**:
  ```markdown
  | **14.00 – 15.00** | 840 – 900 | Normal $\hat{\mathbf{n}}$ projects; camera pulls focus | **Stem 4** | **0.5s negative silence** focusing eye on normal vector. | 0 dBFS / $-\infty$ | Palate cleanser before vector field. |
  ```
- **Replacement Content**:
  ```markdown
  | **14.00 – 15.00** | 840 – 900 | Normal $\hat{\mathbf{n}}$ projects; camera pulls focus | **Stem 4** | **0.5s negative silence** focusing eye on normal vector. | $-\infty\text{ dBFS}$ | Palate cleanser before vector field. |
  ```
- **Rationale**: Standardizes target level column to $-\infty\text{ dBFS}$.

#### Edit 5.6: Section 6.2, Audio Cue Sheet Row 26 (Line 659)
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 659
- **Existing Content**:
  ```markdown
  | **28.50 – 29.50** | 1710 – 1770 | Cut to pure obsidian void: **ABSOLUTE VACUUM** | **Stem 4** | **1.0 second of absolute 0 dBFS dead silence.** All reverb killed instantly. | 0 dBFS / $-\infty$ | Extreme acoustic tension. The entire universe holds its breath. |
  ```
- **Replacement Content**:
  ```markdown
  | **28.50 – 29.50** | 1710 – 1770 | Cut to pure obsidian void: **ABSOLUTE VACUUM** | **Stem 4** | **1.0 second of absolute $-\infty\text{ dBFS}$ dead silence.** All reverb killed instantly. | $-\infty\text{ dBFS}$ | Extreme acoustic tension. The entire universe holds its breath. |
  ```
- **Rationale**: Corrects both description and level target column.

#### Edit 5.7: Section 6.3, Remotion Component Code Comment (Line 693)
- **Target File**: `/Users/lucifer/Programming/vinculum/apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md`
- **Target Line**: Line 693
- **Existing Content**:
  ```tsx
        {/* Note: Stem 4 (Negative Silence) is authored directly into the wave stems as 0 dBFS vacuums */}
  ```
- **Replacement Content**:
  ```tsx
        {/* Note: Stem 4 (Negative Silence) is authored directly into the wave stems as -∞ dBFS vacuums */}
  ```
- **Rationale**: Professional engineering comment accuracy in component code snippet.

---

## 3. Worker Implementation Checklist

The Worker agent can apply these changes using either localized `replace_file_content` calls or sequential line updates:

- [ ] Apply Item 1: Lines 327, 429, 431 ($48^3$ canonical resolution & 110,592 voxels / 663,552 tets).
- [ ] Apply Item 2: Line 481 (`mathjs` numerical eigensolver with residual verification).
- [ ] Apply Item 3: Lines 196, 540, 749 ($0.50\text{s} \le \Delta t \le 1.50\text{s}$).
- [ ] Apply Item 4: Lines 13, 252, 295, 312, 315, 316 (66.2% [22.50s] / 33.8% [11.50s]).
- [ ] Apply Item 5: Lines 516, 601, 624, 634, 649, 659, 693 ($-\infty\text{ dBFS}$ digital silence).

---

## 4. Verification Protocol for Post-Edit Quality Gate

After the Worker applies the above edits, run the following commands to guarantee zero defects and complete gate compliance:

1. **Verify Audit Document Automated Engine**:
   ```bash
   bun apps/video/scripts/verify-benchmark-audit.ts
   ```
   *Expected outcome*: 6/6 checks PASS with code 0.

2. **Verify Zero Remaining "0 dBFS" Silence Artifacts**:
   ```bash
   python3 -c '
   with open("apps/video/WORLD_CLASS_BENCHMARK_AUDIT.md") as f:
       text = f.read()
   import re
   matches = [m.start() for m in re.finditer(r"0\s*dBFS\s*(silence|vacuum|dead|/)", text, re.I)]
   assert len(matches) == 0, f"Found unexpected 0 dBFS silence tokens: {len(matches)}"
   print("PASSED: Zero 0 dBFS silence occurrences.")
   '
   ```

3. **Verify Resolution & Eigensolver Codebase Tests**:
   ```bash
   bun test apps/graph/test/implicitSurfaceExtraction.test.ts apps/graph/test/matrixEigen.test.ts
   bun run typecheck
   ```
   *Expected outcome*: 36/36 tests PASS in ~3s; typecheck clean in ~5s.
