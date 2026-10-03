# Handoff Report: Authoritative Design, Architectural Contracts & Creative Thesis

**Agent:** Design & Spec Miner (`teamwork_preview_spec_miner_survey_design`)  
**Target File:** `/Users/lucifer/Programming/vinculum/.agents/teamwork/teamwork_preview_spec_miner_survey_design/handoff.md`  
**Milestone:** Vinculum Showcase Film Creative Treatment & Technical Fidelity Specification  
**Status:** Complete (Hard Handoff)

---

## 1. Observation

Authoritative rules, contracts, and code were probed directly from the Vinculum monorepo across core documentation, architectural decision records, style sheets, and store implementations:

1. **`AGENTS.md` (Lines 1–68)**:
   - Root instruction file establishing source-of-truth priority:
     `latest user request > current codebase behavior > project-description.md > AGENTS.md > docs/agent/00-agent-readme.md > docs/agent/instructions.md > docs/agent/01-architecture-contract.md > docs/agent/02-feature-contracts.md > docs/agent/planned.md > docs/agent/03-ui-ux-rules.md > docs/agent/06-designx-frontend-skill.md > docs/agent/04-quality-gates.md > docs/agent/05-review-checklist.md`.
   - Non-negotiable rules: Zero fake buttons, zero fake telemetry, zero fake autosave, zero fake exports, zero placeholder services, zero TODO-only files. Every user-facing control must work, be intentionally disabled, or not be shown. No duplicate stores, no duplicate serialization paths.

2. **`project-description.md` (Lines 1–219)**:
   - Monorepo definition: Bun workspaces; ship unit is `@vinculum/graph` (Next.js 14 App Router) for interactive 3D mathematical visualization (Three.js WebGPU with WebGL2 fallback) paired with 2D plotting/sketching canvas.
   - Core computational architecture: Rust/WASM real numeric evaluation, mathjs parsing and symbolic algebra, MathLive typeset equation input with Compute Engine MathJSON decoding, KaTeX mathematical typesetting.
   - Viewport rendering: Screen-width node-material strokes on WebGPU/WebGL2 fallback with a quieter adaptive grid. No bottom dock or footer tabs (Parameters, Animation, Console, Diagnostics, Performance panels deliberately removed).
   - Automatic Cartesian equations (Line 218): Objects/Expressions has a persistent blank typeset input plotting valid equations as you type without a kind picker ($x,y$ in 2D, $z$ relations in 3D).

3. **`docs/agent/00-agent-readme.md` & `docs/agent/planned.md`**:
   - Explicit boundaries: Vinculum is a mathematical scene editor, 3D visualization workspace, 2D plotting/sketching canvas, and local-first authoring tool. Vinculum is NOT a CAD suite, NOT a cloud SaaS dashboard, NOT a chat/AI workspace, NOT a marketing site.
   - Current phase: UI Redesign and mathematical field analysis. Strictly forbidden: new backend scope, cloud sync, auth, or schema bloat.

4. **`docs/agent/01-architecture-contract.md` (Lines 1–334)**:
   - Single source of truth for scene documents: `live graphStore scene -> serializeScene -> validate -> apply schemaVersion -> persist/export/share`.
   - Store ownership contracts:
     - `graphStore.ts` (`apps/graph/store/`): Owns live scene objects (CRUD, visibility, color, tools, probes, sketch strokes, 2D viewport). Persisted to `sessionStorage` under `vinculum-graph-session`.
     - `editorStore.ts` (`apps/graph/lib/store/`): Owns editor layout chrome (rails, panels, collapsed states, responsive composition, layout modes `single`/`split`/`quad`, durable editor preferences). Persisted to `localStorage`.
     - `historyStore.ts` (`apps/graph/lib/store/`): Owns undo/redo snapshots of scene state (capped at 100 snapshots via FIFO eviction; `apps/graph/lib/store/historyStore.ts:18`).
   - Strict boundaries: Renderers (`lib/graph3d`, 2D canvas) must not own expression semantics or persistence; UI components must not compile expressions on render without a cache or run raw numerical loops.

5. **`docs/agent/03-ui-ux-rules.md` (Lines 1–264)**:
   - Product classification: **Creative/canvas mathematical editor** and **developer/research-grade graphing workspace**.
   - Design archetype: **Canvas Workspace + Editor Shell** (Top toolbar, Left object browser, Center 3D/2D viewport, Right inspector/expressions).
   - Visual direction: **Minimal Functional + Soft Mathematical Workspace** (clean, Desmos-like editor, readable expressions, soft neutral control fills, rounded controls, minimal framing, zero nested bordered panels around the canvas).
   - Prohibited aesthetics: Purple gradient AI SaaS styling, huge headings inside editor, card spam, decorative blobs, fake glassmorphism, dramatic labels like "Command Center" or "Intelligence Hub".

6. **`docs/agent/06-designx-frontend-skill.md` (Lines 1–3076)**:
   - Contains 23 foundational design modules/principles (Modules 1–23 plus Modules 24 & 25), defining product classification, design system selection, aesthetic directions, interaction tactile feedback, layout archetypes, quality gates, anti-patterns, and the ultimate mandate that software is behavior, comprehension, and trust—not decorating rectangles.

7. **`docs/agent/09-adr-math-rendering-architecture.md` & `10-adr-workspace-view-model.md`**:
   - Clean layer separation: UI (React 18) $\rightarrow$ Canonical Scene State (Zustand) $\rightarrow$ Math-Core (pure TypeScript, imports mathjs only, zero DOM/Three/React dependencies) $\rightarrow$ Execution (Rust/WASM / Web Workers) $\rightarrow$ Renderers (Three.js WebGPU/WebGL2 and Canvas2D).
   - Separation of four axes: Workspace (`geometry` | `math`), View (`2d` | `3d`), Layout (`single` | `split` | `quad`), and Tool (`pan` | `probe` | `draw` | `measure`).

8. **`apps/graph/app/globals.css` (Lines 1–747)**:
   - Complete palette, typography, surface tokens, and dark mode definition:
     - Dark mode surfaces: Canvas/Shell `--bg-primary: #171b22`, Chrome `--bg-secondary: #1d222b`, Controls/Inset `--bg-tertiary: #252b35`, Overlay `--panel-bg: rgba(11, 16, 32, 0.75)`.
     - Text tokens: `--text-primary: #f8fafc` (dark) / `#0f172a` (light), `--text-secondary: #b4becd` (dark) / `#334155` (light), `--text-tertiary: #9aa8bc` (dark) / `#5b6b80` (light).
     - Accent palette: 10 curated presets (Blue `#2563eb` default, Indigo, Cyan, Emerald, Green, Amber, Orange, Rose, Pink, Violet).
     - Axes colors: Origin `#94a3b8`, $+X$ RGB `(0.82, 0.36, 0.36)` (crimson), $+Y$ RGB `(0.29, 0.62, 0.41)` (forest green), $+Z$ RGB `(0.29, 0.48, 0.82)` (cobalt blue).
     - Mathematical Typography: Formula font `'Cambria Math', 'STIX Two Math', Georgia, serif`, Sans UI font `-apple-system, BlinkMacSystemFont, 'Inter', 'SF Pro Text', 'Segoe UI', system-ui, sans-serif`.

9. **`apps/video/` Prototype Audit**:
   - Existing prototype components in `apps/video/src/components/` (`ParticleBackground.tsx`, `GlowBadge.tsx`, `FormulaCard.tsx`) and `apps/video/src/scenes/` (`Scene1Hook.tsx`, `Scene5EnginePower.tsx`, etc.) contain generic particles, sci-fi glowing badges, card containers, and synthetic corporate video tropes that directly violate `03-ui-ux-rules.md`, `06-designx-frontend-skill.md` Module 21, and the showcase brief.

---

## 2. Logic Chain

1. **From Monorepo Boundaries to Core Identity**:  
   Observations 1, 2, 3, and 5 demonstrate that Vinculum is an authentic mathematical laboratory, not a generic WebGL tech demo or cloud SaaS. Its true identity is defined by the direct, unmediated translation of symbolic notation into spatial geometry and real-time computation. Any representation of Vinculum that relies on external sci-fi embellishments or fake UI betrays this core identity.

2. **From Architecture & State to Film Representation**:  
   Observations 4, 7, and 8 reveal that Vinculum's interface is an ultra-refined, distraction-free "Canvas Workspace + Editor Shell" where the canvas occupies center stage and the surrounding chrome is soft, neutral, and subordinate. Therefore, the showcase film cannot be an abstract animated video; it must feature the actual product shell (~70% real product/rendering, ~30% editorial typography) with verified camera navigation, exact coordinate markers, and authentic mathematical typography.

3. **From 23 Design Principles to Showcase Evaluation**:  
   Observation 6 provides the 23 design principles of `06-designx-frontend-skill.md`. These principles establish non-negotiable evaluation criteria. Any creative treatment that introduces purple gradients, card spam, ungrounded particle effects, fake UI badges, or disconnected 3D demos will fail an adversarial review against these principles.

4. **From Concept Analysis to Creative Selection**:  
   Comparing the 3 film concepts against the codebase reality:
   - *Concept B (The Instrument)* excels in UI tactility but risks feeling like a dry software tutorial if the mathematical magic is understated.
   - *Concept C (Mathematical Worlds)* has cinematic scale but easily drifts into generic CGI art disconnected from the actual editor workflow.
   - *Concept A (From Notation to Space)* directly captures the core architectural feedback loop: typing an equation in MathLive, computing in Rust/WASM, and watching it instantiate into a living 3D manifold in Three.js WebGPU. Concept A, executed with the tactile precision of Concept B, is the only concept that fulfills the product thesis.

---

## 3. Product Definition & Core Thesis

### 3.1 Core Definition
Vinculum is an open, browser-native mathematical graphing workspace and canvas editor built on Next.js 14, Three.js (WebGPU with WebGL2 fallback), and Rust/WASM. It unifies symbolic algebra, 2D constraint plotting/sketching, and interactive 3D surface/curve generation into a single synchronized computational document.

### 3.2 Philosophical Positioning
Mathematics in traditional digital environments is fragmented: either static typesetting on a page (LaTeX, PDF), opaque numerical notebooks (Jupyter, Mathematica), or isolated 2D plotters (Desmos, GeoGebra). Vinculum positions mathematics as **tangible, spatial computation**. It insists that symbolic notation and dimensional geometry are two manifestations of the same truth. By enforcing definition-first manipulation, AST safety, and exact coordinate fidelity, Vinculum restores intuitive physical agency to abstract mathematics without sacrificing mathematical rigor.

### 3.3 Emotional Target
The user and viewer must feel **clarity, awe, intellectual agency, and tactile mastery**. It is the thrill of a researcher or creator typing an abstract differential expression and seeing a living, continuous 3D surface materialize immediately beneath their hands—pure, unadorned, responsive to their touch, and mathematically honest.

### 3.4 Authoritative One-Paragraph Product Thesis
> **Vinculum is an elite mathematical instrument that transforms symbolic mathematical notation into living, interactive spatial geometry in real time. In a digital landscape fractured between static formulas, opaque code notebooks, and decorative 3D toys, Vinculum provides a unified, local-first canvas where equations, 2D constraint sketches, and high-dimensional manifolds interact with instant WebGPU/WebGL2 fidelity and Rust/WASM numerical precision. When experiencing Vinculum, the viewer should feel a profound sense of intellectual clarity and tactile mastery—discovering that abstract mathematics is not inert ink on paper, but a dynamic, sculptural universe governed by exact laws and responsive to their direct physical command.**

---

## 4. The 23 Design Principles (from `docs/agent/06-designx-frontend-skill.md`)

Below is the complete extraction of all 23 design principles governing Vinculum, complete with exact definitions, intended applications in Vinculum and the showcase film, and explicit evaluation criteria for adversarial creative review.

| # | Principle Name | Source / Module | Exact Definition & Rule | Intended Application in Vinculum & Film | Evaluation Criteria for Adversarial Review (Reject if...) |
|---|---|---|---|---|---|
| **1** | **Product Archetype Classification** | Module 1 (`Class K`) | Classify the exact product archetype before designing. Vinculum is strictly `Class K: Creative / Canvas Tools` and `Class E: Developer Tools / Technical Products`. Never treat spatial tools as page-based or form-based web apps. | The canvas/viewport is the core product center. Surrounding chrome (top toolbar, rails) exists solely to serve spatial creation. In the film, viewport must dominate framing; never frame like a website landing page or SaaS card feed. | UI is structured as card grids, marketing feeds, or multi-page documents rather than a continuous spatial canvas. |
| **2** | **Domain Physics & Design System Selection** | Module 2 | Select a design system grounded in the physical reality of the domain. Avoid off-the-shelf UI kit defaults. The system must reflect mathematical instruments: compact density, hairline dividers, neutral control fills. | Controls feel like precision scientific hardware. In the film, buttons, sliders, and toggles display exact tolerances, clean borders, and crisp mechanical states. | Interface looks like generic shadcn, Tailwind, or Material defaults with puffy round buttons and default SaaS shadows. |
| **3** | **Intentional Direction & Hybrid Purity** | Module 3 (`DIR-11` + `DIR-04` / `DIR-06`) | Commit to one primary aesthetic direction: `Minimal Functional + Soft Mathematical Workspace`. Hybrid styling must follow strict protocols: define base style, borrowed traits, protected rules, and explicit rejection rules. | Base style is minimal functional; borrowed traits include tactile instrument feedback and monospace coordinate readouts. Strictly rejected: cyberpunk neon, luxury gold, organic blobbiness, or glassmorphism. | Contains neon glow, rainbow gradients, dark cyber HUD graphics, floating glass cards, or conflicting stylistic languages. |
| **4** | **End-to-End User Flow Architecture** | Module 4 | Design full user journeys from intent to validation, not isolated static screens. User flow must govern every interaction state and visual transition. | Journey: Equation entry in MathLive $\rightarrow$ Real-time sampling $\rightarrow$ Manifold generation $\rightarrow$ Parameter scrub $\rightarrow$ Direct probe picking $\rightarrow$ Vector field overlay $\rightarrow$ Export. In the film, each shot represents a step in this journey. | Film cuts jump randomly between unrelated features without showing how mathematical intent progresses into spatial result. |
| **5** | **Tactile Interaction & Physical Feedback** | Module 5 | UI controls must behave with physical tactility: instant hover response, scale down (`0.98`) on press, motion $\le 200\text{ms}$ (`ease-out`), visible focus rings, and clear state transitions. | Toolbar toggles, expression inputs, probe points, and coordinate pins exhibit subtle, satisfying physical feedback. Audio beds must match tactile clicks and snaps. | Motion is sluggish ($>300\text{ms}$), bouncy, floaty, or lacks instant click/drag response. Divs used as buttons without tactile states. |
| **6** | **Modular Component Hierarchy** | Module 6 | Construct UI with composable, single-responsibility primitives. Maintain strict visual hierarchy where high-frequency controls are immediate and low-frequency tools are progressively disclosed. | Left rail (object hierarchy), right rail (expression inspector), top chrome (mode toggles). Floating panels stay close to the canvas without obscuring active geometry. | Floating windows obscure active geometry, tools are duplicated, or deep sub-menus hide primary mathematical controls. |
| **7** | **Purpose-Built Layout Archetypes** | Module 7 (`7.4` + `7.5`) | Strictly enforce the `Canvas Workspace + Editor Shell` layout archetype. Top toolbar, left object tree, center canvas, right inspector. No arbitrary dashboard card layouts. | In the film, the UI shell maintains this exact 4-quadrant layout whenever chrome is visible. Canvas fills all available space below the top toolbar. No bottom dock. | Layout slips into an analytics dashboard, floating card grid, or hero marketing split screen. Bottom dock or footer tabs appear. |
| **8** | **Operational Density & Anti-Card Dominance** | Module 8 | Match density to technical operational requirements. Avoid card spam. Dense, legible information beats oversized whitespace and decorative containers. | Mathematical expressions, coordinate matrices, and inspector fields use compact, high-density layouts without wrapping every field in a rounded card. | Expressions or controls are isolated in thick, floating "cards" with excessive padding and decorative drop shadows. |
| **9** | **Ergonomic Adaptation & Responsive Flow** | Module 9 | UI must adapt fluidly across viewport sizes without horizontal clipping, unreachable controls, or cramped touch targets ($40\text{--}44\text{px}$ on coarse pointers). | Rails collapse into sleek drawers on compact viewports; formula inputs remain fully editable without viewport overflow. | Fixed desktop layouts that break or horizontally scroll, or elements clipped by rigid pixel dimensions. |
| **10** | **Cross-Platform Mental Model Parity** | Module 10 | Ensure consistent mental models across web, desktop, and touch interfaces. The math and scene graph remain identical regardless of input modality. | Mouse orbit, touch pan, trackpad zoom, and stylus sketching manipulate the identical underlying scene graph and coordinate frame. | Feature behaves differently depending on input modality, or mobile experience is an incomplete "toy" version. |
| **11** | **Absolute Accessibility & Performance Core** | Module 11 | Non-negotiable WCAG AA contrast ($\ge 4.5:1$ for tertiary text), visible focus rings (`2px` accent outline), `aria-pressed` on toggles, reduced-motion compatibility, and zero main-thread blocking. | Dark mode text tokens (`#f8fafc`, `#b4becd`, `#9aa8bc`) exceed contrast minimums. Expressions compile asynchronously; WebGPU/WebGL2 pipeline maintains stable 60 FPS. | Text contrast fails AA, focus outlines removed without replacement, or rendering pipeline drops frames during parameter scrubs. |
| **12** | **Audit-First Redesign Discipline** | Module 12 | Never redesign or rewrite without auditing existing implementation first. Categorize problems by severity and solve real structural issues rather than superficial skinning. | Showcase film audit directly identifies obsolete prototype elements (`ParticleBackground`, `GlowBadge`) and replaces them with authentic engine components. | Implementing new video scenes without auditing existing Remotion visualizers or ignoring verified engine capabilities. |
| **13** | **Strict Frontend Architectural Layering** | Module 13 | Maintain strict separation of concerns: React UI $\leftrightarrow$ Zustand Stores $\leftrightarrow$ Math-Core $\leftrightarrow$ Web Workers/Rust WASM $\leftrightarrow$ Renderers. UI never owns math sampling or TypedArrays. | Remotion showcase compositions must not run ad-hoc math or duplicate scene stores; they must invoke canonical math-core algorithms or direct screen captures. | Video scenes invent their own math solvers or shader pipelines that diverge from the actual `lib/math` engine. |
| **14** | **Data-Heavy Rigor & Numerical Precision** | Module 14 | Technical interfaces require exact data presentation: monospaced numbers, aligned decimal points, explicit coordinate readouts, and zero horizontal truncation. | Inspector displays exact coordinates $(x,y,z)$, parameter values $(t, u, v)$, and vector field components with crisp monospaced formatting. | Numbers are arbitrarily rounded, coordinate axes lack units, or matrices overflow and truncate silently. |
| **15** | **Component Kit Adaptation & Customization** | Module 15 | Never leave UI libraries in their default state. Adapt primitives to custom design tokens, tailored density, specific border radii, and unique brand physics. | Vinculum controls use custom radius tokens (`--radius-sm: 9px`, `--radius-md: 12px`), custom focus rings, and bespoke soft fills (`--editor-control: #252b35` in dark mode). | Component library defaults (e.g., standard Radix/shadcn slate-zinc palette or generic pill buttons) appear unstyled. |
| **16** | **State-Aware Modes & Workflow Permissions** | Module 16 | The UI must clearly reflect current workspace mode (`Math Lab` vs `Geometry Studio`), tool mode, and state validity without modal obstruction. | Active tool (Pan, Probe, Measure, Draw) is highlighted with `aria-pressed`; mode switching preserves scene data while updating tool priority and empty-state hints. | User is unsure which mode is active; mode switch destroys or hides scene objects without warning. |
| **17** | **Concurrency Honesty & Real-Time Integrity** | Module 17 | Display honest system states. Never simulate fake background syncing, fake autosave, or decorative progress spinners. | Status displays reflect actual state: "Saved 12s ago", "Evaluating...", "Quadrature uncertainty: $\pm 10^{-6}$". In the film, all progress states are real. | Film shows fake "AI computing..." animations, looping loading bars, or simulated network telemetry. |
| **18** | **Layout Elasticity & Text Resilience** | Module 18 | Interfaces must accommodate dynamic mathematical content of varying length and complexity without layout breakage. | MathLive editor and KaTeX math containers expand gracefully for multi-line fractions, matrices, and long piecewise expressions without breaking the rail layout. | Long mathematical formulas clip outside container boundaries or cause horizontal scrollbars across the entire app shell. |
| **19** | **Multi-Dimensional Quality Gating & Self-Audit** | Module 19 | Score all work across 10 dimensions: Product Fit, Visual Hierarchy, Originality, IA, Interaction Depth, States, A11y, Responsiveness, Quality, Aesthetic Consistency. Must score $\ge 8/10$ to ship. | The showcase treatment must be evaluated against this exact 10-dimension rubric before entering final production. | Work is accepted based on subjective visual appeal without passing the objective 10-point self-audit gate. |
| **20** | **Systematic Token Architecture** | Module 20 | All visual attributes must derive from a unified, semantic token system (colors, surfaces, borders, radii, elevation, motion, typography). Zero hardcoded hex codes. | In the film and UI, every surface color, stroke width, and transition timing maps directly to CSS tokens in `globals.css` (`--surface-canvas`, `--accent-primary`, etc.). | Arbitrary inline hex colors (e.g. `#7928CA`, `#FF0080`), random border radii, or bespoke animation curves. |
| **21** | **Anti-Pattern Elimination (The Kill List)** | Module 21 | Zero tolerance for recognized design anti-patterns: Inter + purple gradients, card spam, generic heroes, decorative icons with no meaning, inflated labels, fake HUDs. | Showcase film strictly bans: cyber particles, pulsing glowing halos, sci-fi lens flares, floating glass boxes, and corporate SaaS marketing taglines. | Any presence of generic particle grids, neon bloom effects, corporate tech music tropes, or buzzword-heavy copy. |
| **22** | **Concrete Output Contracts & Determinism** | Module 22 | Every deliverable must follow a strict, structured output schema with explicit rationale, file locations, timecodes, and verifiable constraints. Zero ambiguity. | Storyboard in the treatment must specify all 8 mandatory fields per shot: timecode, visual description, product action, camera crop, typography, transition, sound beat, rationale. | Storyboard shots omit required fields, use vague time ranges, or rely on undefined visual concepts. |
| **23** | **The Final Principle: Behavior Over Decoration** | Module 23 | **You are not decorating rectangles. You are designing software behavior, user decisions, workflow speed, comprehension, confidence, and trust.** Every screen must answer: Where am I? What matters most? What can I do? What just happened? What happens next? What if something goes wrong? | The film must not be a montage of pretty shapes. It must showcase a user commanding a powerful computational tool and observing immediate, trustworthy mathematical results. | Film prioritizes aesthetic decoration over authentic software interaction and mathematical comprehension. |

*(Note: Modules 24 [Device-Aware Sizing & Relative Layout] and 25 [Professional UI Copy & Content Discipline] serve as mandatory operational extensions reinforcing Principles 8, 20, 21, and 23).*

---

## 5. Architectural & UI/UX Contracts

### 5.1 Store Ownership Boundaries
The monorepo enforces three immutable Zustand store boundaries in `apps/graph`:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              APP RUNTIME                               │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
┌──────────────┐             ┌──────────────┐             ┌──────────────┐
│  graphStore  │             │ editorStore  │             │ historyStore │
└──────┬───────┘             └──────┬───────┘             └──────┬───────┘
       │                            │                            │
       ▼                            ▼                            ▼
• Live Scene Objects         • Layout Dimensions          • Undo Stack (max 100)
• Object CRUD (add, edit)    • Rails / Panels Collapse    • Redo Stack
• Visibility, Color, Domain  • ViewportMode (quad/split)  • Scene Snapshots
• Active Tools & Probes      • Responsive Composition     • FIFO Eviction
• Sketch Strokes & Snaps     • Durable Preferences        • Cleared on Import/New
• SessionStorage Persisted   • LocalStorage Persisted     • In-Memory Only
```

- **`graphStore` (`apps/graph/store/graphStore.ts`)**:
  - *Allowed*: Live scene objects (`GraphObject` variants), object visibility/colors, active tools (probes, measurements, sketch strokes), 2D viewport coordinates, dialog open states.
  - *Storage*: `sessionStorage` under `vinculum-graph-session` (partialized to clear transient dialogs on hydration).
  - *Strictly Forbidden*: Durable named project database, IndexedDB interactions, telemetry, undo/redo stack, layout dimensions.
- **`editorStore` (`apps/graph/lib/store/editorStore.ts`)**:
  - *Allowed*: Layout dimensions, panel expansion/collapse, constraints (`attach`, `align`, `offset`), layout modes (`single`, `split`, `quad`), responsive composition state (`desktop`, `medium`, `compact`), durable UI preferences.
  - *Storage*: `localStorage` via Zustand `persist`.
  - *Strictly Forbidden*: Full scene documents, object math expressions, autosave snapshots, scene migration logic.
- **`historyStore` (`apps/graph/lib/store/historyStore.ts`)**:
  - *Allowed*: Linear undo and redo snapshot stacks of scene objects, bounded strictly to 100 snapshots via FIFO eviction (`MAX_HISTORY_SNAPSHOTS = 100`).
  - *Storage*: In-memory only.
  - *Strictly Forbidden*: Autosave persistence, project version history, share-link state, recovery caches.

### 5.2 Canonical Scene Document Lifecycle
All scene data entering or leaving Vinculum must follow the single canonical pipeline:
$$\text{graphStore (live)} \xrightarrow{\text{serializeScene}} \text{validate} \xrightarrow{\text{apply schemaVersion}} \text{persist / export / share}$$
$$\text{incoming JSON / URL} \xrightarrow{\text{parse}} \text{validate envelope} \xrightarrow{\text{migrate if older}} \text{deserializeScene} \xrightarrow{\text{replace scene in graphStore}}$$
- No feature may bypass `serializeScene` or `deserializeScene`.
- No feature may partially mutate the store upon validation failure.

### 5.3 UI/UX Design Contracts & Instrument Aesthetic
- **Layout Model**: `Canvas Workspace + Editor Shell`.
  - Top Toolbar: Project actions, mode toggles (`3D` / `2D`), share/export, theme toggle.
  - Left Rail: Scene Object list, visibility toggles, count badge (`data-testid="scene-object-count"`).
  - Center Viewport: Full 3D Three.js or 2D canvas, probes, distance/angle overlays. Fills all vertical space below toolbar. No bottom dock.
  - Right Rail: Inspector for active object (MathLive formula input, parameters, domains, analysis overlays).
- **Aesthetic Definition**: `Minimal Functional + Soft Mathematical Workspace`.
  - Quiet, neutral surfaces: graph first, chrome second.
  - Soft neutral control fills (`--editor-control`), subtle hairline borders (`--border-subtle`).
  - Dark mode instrument feel: deep slate-black canvases (`#171b22`, `#1d222b`) that make mathematical lines, surfaces, and vector glyphs luminous without artificial bloom.
- **Typography Tokens**:
  - Display / UI Sans: `-apple-system, BlinkMacSystemFont, 'Inter', 'SF Pro Text', 'Segoe UI', system-ui, sans-serif`.
  - Mathematical Formulas: `'Cambria Math', 'STIX Two Math', Georgia, serif` (KaTeX + MathLive, locally vendored via `prepare:math`; zero font CDNs).
  - Monospace Data / Code: System monospace for numerical coordinates and matrix entries.
- **Color Tokens (from `globals.css`)**:
  - **Light Surfaces**: Base `--bg-primary: #f7f8fa`, Shell `--editor-shell: #f7f8fa`, Chrome `--editor-chrome: #ffffff`, Inset `--editor-control: #f0f2f5`, Canvas `--surface-canvas: #ffffff`.
  - **Dark Surfaces**: Base `--bg-primary: #171b22`, Shell `--editor-shell: #171b22`, Chrome `--editor-chrome: #1d222b`, Inset `--editor-control: #252b35`, Canvas `--surface-canvas: #171b22`.
  - **Text**: Primary `#0f172a` (light) / `#f8fafc` (dark); Secondary `#334155` (light) / `#b4becd` (dark); Tertiary `#5b6b80` (light) / `#9aa8bc` (dark).
  - **Accents**: 10 selectable presets; default is Blue (`#2563eb`). Text-safe ink mixing ensures $\ge 4.5:1$ contrast against any surface.
  - **Axes RGB**: Origin `#94a3b8`, $+X$ Crimson `(0.82, 0.36, 0.36)`, $+Y$ Forest Green `(0.29, 0.62, 0.41)`, $+Z$ Cobalt Blue `(0.29, 0.48, 0.82)`.
  - **Borders & Grids**: Subtle `--border-subtle: rgba(188, 199, 215, 0.055)` (dark), Adaptive Major Grid `rgba(148, 163, 184, 0.2)`, Minor Grid `rgba(148, 163, 184, 0.08)`.
- **Rules Against Fake UI**:
  - Every visible button must trigger real code or be intentionally disabled with an explanation.
  - Zero placeholder buttons, zero fake telemetry, zero fake autosave statuses, zero mock data in production.
  - Honest status reporting: "Saving...", "Saved 12s ago", "Quadrature uncertainty: $\pm 10^{-6}$".
  - Plain, disciplined copy: "Objects", "Inspector", "Solve", "Share", "Export". Prohibited: "Command Center", "Operations Nexus", "Intelligence Hub".

---

## 6. Conceptual Alignment for the 3 Film Concepts

| Dimension | Concept A — From Notation to Space | Concept B — The Instrument | Concept C — Mathematical Worlds |
|---|---|---|---|
| **Core Concept** | **Mathematical Transformation-Driven**: Symbolic notation directly gives birth to living dimensional geometry. | **Tactile Product Interaction**: High-density UI interaction, emphasizing editor responsiveness, keyboard agility, and tool control. | **Cinematic Geometry-Led**: Macro sweeps into complex topology, singularities, and coordinate vector flows. |
| **Strengths** | • Directly expresses the core thesis of Vinculum.<br>• Dramatic visual metaphor: typing an equation causes immediate physical spatial unfolding.<br>• Showcases the definition-first Rust/WASM and Three.js WebGPU engine.<br>• Bridges abstract intellect and visual intuition. | • Proves Vinculum is an authentic, production-grade tool, not a concept render.<br>• Highlights the "Canvas Workspace + Editor Shell" layout, probes, and inspectors.<br>• Highly credible to engineers, mathematicians, and technical power users. | • Extremely high cinematic impact and stop-rate for social media.<br>• Highlights high-resolution surface shaders, screen-width node-material strokes, and vector streamlines.<br>• Visually stunning color and lighting. |
| **Risks** | • Could feel academic or detached if disconnected from the tactile UI shell.<br>• Must avoid looking like a 3Blue1Brown video by maintaining the ~70% real product / ~30% editorial typography balance. | • Risks feeling like software documentation or a dry screencast if geometry feels secondary.<br>• Lower cinematic stop-rate if the beauty of mathematical topology is understated. | • Highest risk of violating the anti-pattern kill list: can easily look like a fake CGI demo or Blender animation.<br>• Obscures the authoring workflow, leaving the viewer confused about what the product does. |
| **Alignment with True Identity** | **Exceptional (10/10)**: Strikes at the exact heart of Vinculum's reason for existing—translating notation into spatial computation. | **Strong (8/10)**: Captures the physical feel of the instrument, but misses the transformative intellectual epiphany. | **Moderate-Low (5/10)**: Treats mathematics as passive art rather than interactive, editable computation. |

### 6.1 Recommended Concept: Concept A (From Notation to Space) — Hybridized with Concept B Precision

**The Definitive Recommendation:**  
The showcase film must be built on **Concept A: From Notation to Space**, executed through the tactile precision and instrument density of **Concept B**.

### 6.2 Rigorous Justification
1. **Direct Translation of Product Thesis**:  
   The foundational definition of Vinculum is *"where mathematical notation becomes spatial, interactive computation."* Concept A is the only concept where this transformation is the literal narrative arc of the film.
2. **Ground Truth Engine Fidelity**:  
   Concept A directly mirrors the monorepo's actual engineering pipeline:
   $$\text{MathLive Input} \xrightarrow{\text{MathJSON / AST}} \text{Rust/WASM Core} \xrightarrow{\text{Three.js Node Material}} \text{Interactive 3D Manifold}$$
   Every visual beat in Concept A is backed by valid code in `apps/graph` and `packages/scene`.
3. **Emotional Arc (Epiphany over Mere Utility)**:  
   A launch film must evoke wonder. Concept B alone demonstrates utility ("it has sliders and tabs"), while Concept C demonstrates passive aesthetics ("it has pretty shapes"). Only Concept A delivers the intellectual epiphany: *human symbolic thought crystallizing into three-dimensional reality at the tap of a key.*
4. **Adversarial Review Compliance**:  
   By embedding the mathematical transformation strictly inside the authentic Vinculum editor shell (~70% product, ~30% editorial typography) using real tokens from `globals.css`, Concept A completely avoids the CGI artifice of Concept C while escaping the clinical dryness of Concept B. It satisfies all 23 design principles without deviation.

---

## 7. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|---|---|---|---|---|---|---|
| 1 | Architecture | Single-Shell Mode Switching | Seamless toggle between 3D orbit viewport and 2D canvas within a single EditorShell | `graphMode: "2d" \| "3d"` | Dynamic mounting of Three.js or Canvas2D without state reset | Fallback to default 3D on invalid state | `project-description.md:21`, `EditorShell.tsx` |
| 2 | Math Input | Persistent Automatic Equations | Persistent typeset input that plots valid equations as you type without an explicit kind picker | Equation string in $x, y, z$ | `implicitCurve` (2D) or explicit/implicit surface (3D) | Diagnostic badge, preserves last valid plot | `project-description.md:218` |
| 3 | Math Engine | Rust/WASM Numeric Evaluation | High-speed real numeric evaluation for implicit/explicit surfaces and parametric assemblies | AST expressions, domains, sample grids | `Float32Array` vertex buffers, normal vectors | Clamped pole values, singularity isolation | `project-description.md:23`, `09-adr` |
| 4 | Math Analysis | Definition-First Field Solver | Solver for Cartesian/polar scalar and vector calculus, Cauchy-Riemann checks, harmonic conjugates | Selected object, coordinate point | Analytic derivatives, vector Laplacian, KaTeX solution steps | Actionable inline diagnostics | `project-description.md:170` |
| 5 | Viewport | Screen-Width Node-Material Strokes | Constant screen-width lines for curves, rays, segments via Three.js node materials on WebGPU/WebGL2 | Scene geometric primitives, camera matrix | Constant pixel-width rendered strokes | WebGL2 fallback if WebGPU unsupported | `project-description.md:196` |
| 6 | Interaction | Armed Differentiation & Analysis Picking | Interactive hover probe that samples exact source coordinates in math frame before committing | Cursor pointer hit on 3D/2D geometry | Coordinate badge, gradient arrow, tangent plane preview | Clear preview on pointer exit or miss | `project-description.md:202` |
| 7 | Sketching | Sketch-to-Curve Fitting | Least-squares polynomial fitting turning 2D freehand pointer strokes into parametric curves | Array of 2D screen coordinate points | `ParametricCurveObject` with fitted $(x(t), y(t))$ | Discarded if points $<3$ or colinear | `project-description.md:24`, `fitParametricSketch*.ts` |
| 8 | History | Bounded Undo/Redo Engine | FIFO-evicting snapshot stack capped at 100 entries to prevent memory leaks during debounced editing | Scene snapshot push on commit | Restored `SceneSnapshot` on undo/redo | Null return when stack empty | `historyStore.ts:18` |
| 9 | Persistence | Local Session Storage Hydration | Partialized sessionStorage synchronization for rapid tab restore without leaking dialog state | Live `GraphStoreState` | Serialized JSON under `vinculum-graph-session` | Reverts to default clean scene if corrupted | `graphStore.ts:59` |
| 10 | Theming | Accent & Theme Sync | 10 accent presets with text-safe color-mixing and high-contrast dark mode | Preset string, `data-theme` attribute | Dynamic CSS variable resolution | Defaults to Blue and System theme | `globals.css:5–165` |

---

## 8. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---|---|---|
| 1 | Math Input | Singular function at origin: $f(x,y) = \frac{1}{x^2+y^2}$ | `09-adr` characterizes F1/F2: single-point $(0,0)$ probes rejected; finite pole values clamped to prevent stretched false triangles. |
| 2 | Coordinate Frames | 2D Parametric vs Implicit equations | `09-adr` characterizes F4: curves historically projected in world frame while implicit equations evaluated in math frame; unified conversion now mandatory. |
| 3 | Undo Stack Limits | $>100$ debounced expression updates | `historyStore.ts:25` slices `past` to 99 items before appending new snapshot, discarding oldest snapshot (FIFO). |
| 4 | Share URLs | Very large scene payload exceeding URL size limit | `02-feature-contracts.md:168`: UI rejects link generation with clear error: *"This scene is too large for a local share link. Export JSON instead."* |
| 5 | Reduced Motion | OS `prefers-reduced-motion: reduce` active | `globals.css:306, 740`: All keyframe animations disabled, transition durations set to `0.01ms !important`. |
| 6 | Compact Viewports | Viewport width $<720\text{px}$ or mobile coarse pointer | `globals.css:427, 477`: Rails collapse into modal sheets, minimum touch targets increase to $44\text{px}$, headers wrap gracefully. |

---

## 9. Caveats

1. **Video Codebase Boundary**:
   Per the task assignment and non-negotiable rules, zero video code or Remotion components were written or modified during this survey.
2. **WebGPU Availability**:
   WebGPU rendering in Three.js is dependent on browser runtime support; the WebGL2 fallback path remains the canonical production baseline in automated test environments.

---

## 10. Conclusion

Vinculum's documentation, architectural contracts, and codebase reveal a cohesive, research-grade mathematical instrument designed around the principle that **mathematical notation is living spatial computation**. The interface is strictly governed by the **Canvas Workspace + Editor Shell** archetype, styled with **Minimal Functional + Soft Mathematical Workspace** aesthetics, and safeguarded by 23 rigorous design principles. 

For the upcoming 24–35 second Showcase Film (`apps/video/SHOWCASE_TREATMENT.md`), **Concept A: From Notation to Space** (fortified by the tactile precision of Concept B) is the only concept that authentically embodies Vinculum's core thesis while satisfying all architectural contracts and passing adversarial review.

---

## 11. Verification Method

To independently verify the observations, contracts, and code citations in this report:

1. **Verify Store Boundaries & Architecture Contracts**:
   - Inspect `apps/graph/store/graphStore.ts` (lines 34–60) to confirm `sessionStorage` binding and slice composition.
   - Inspect `apps/graph/lib/store/editorStore.ts` (lines 1–50) to confirm layout and constraint ownership.
   - Inspect `apps/graph/lib/store/historyStore.ts` (lines 18–35) to verify the 100-snapshot FIFO limit.
2. **Verify Theme, Typography & Color Tokens**:
   - Inspect `apps/graph/app/globals.css` (lines 5–155) to verify color tokens, dark mode surface variables, axes RGB values, and mathematical font stacks.
3. **Verify Quality Gates & Baseline Health**:
   - Run workspace typecheck: `bun run typecheck`
   - Run unit test suite: `bun run test`
   - Run linter: `bun run lint`
   - Run production build: `bun run build`
