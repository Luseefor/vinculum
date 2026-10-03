## 2026-10-03T01:04:13Z
You are the Lead Author & Verification Engineer for the Vinculum Showcase Film.
Your working directory is: /Users/lucifer/Programming/vinculum/.agents/teamwork/teamwork_preview_worker_lead_author/

MANDATORY FIRST STEP:
Read /Users/lucifer/Programming/vinculum/.agents/teamwork/ORIGINAL_REQUEST.md.
Also read:
- /Users/lucifer/Programming/vinculum/.agents/teamwork/orchestrator_1/PROJECT.md
- /Users/lucifer/Programming/vinculum/.agents/teamwork/teamwork_preview_explorer_survey_graph/handoff.md
- /Users/lucifer/Programming/vinculum/.agents/teamwork/teamwork_preview_explorer_survey_video/handoff.md
- /Users/lucifer/Programming/vinculum/.agents/teamwork/teamwork_preview_spec_miner_survey_design/handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

TASK:
Produce the authoritative, production-grade Creative Treatment and Technical Fidelity Specification document at `apps/video/SHOWCASE_TREATMENT.md` and implement an automated verification script at `apps/video/scripts/verify-showcase-treatment.ts`.

REQUIREMENTS FOR apps/video/SHOWCASE_TREATMENT.md:
The document must be complete, first-principles, deeply detailed, and contain zero placeholder or TODO sections. Synthesize all findings from the 3 audit reports:

1. Monorepo Capability & Rendering Engine Audit (R1):
   - Full 14-capability inventory. Every capability MUST have all 8 mandatory fields:
     (1) Exact user action/input
     (2) Exact rendered mathematical visual
     (3) Active UI controls and component paths
     (4) Responsible renderer/material/camera configurations
     (5) Direct capture feasibility vs. Remotion reuse viability
     (6) Production readiness for launch marketing
     (7) Exact mathematical formulas and parameters supported
     (8) Interactive responsiveness and state handling
   - Three.js WebGPU + WebGL2 fallback, TSL adaptive grid, screen-space wide strokes (Line2NodeMaterial), ACES Filmic, camera damping, scissor testing.

2. Core Thesis, Capability Shortlist & Three Contrasting Concepts (R2):
   - Product Thesis: Exactly one authoritative paragraph answering: What is Vinculum? Why care? What should the viewer feel?
   - Capability Shortlist: The 4 genuine hero moments (Gyroid level set, RK4 streamlines, linear transform parallelepiped, surface tangent patch) with visual progression, code backing, and rigorous exclusion rationales for discarded features.
   - Three Contrasting Concepts: Fully developed Concept A (From Notation to Space), Concept B (The Instrument), Concept C (Mathematical Worlds), detailing philosophy, visual rhythm, strengths, and risks.
   - Recommended Concept: Concept A executed with Concept B tactile precision, with deep justification.

3. Shot-by-Shot Storyboard & Pacing Architecture (R3):
   - 5-Act structure: Act I (Notation), Act II (Notation Becomes Space), Act III (Space Becomes Interactive), Act IV (Everything in One System), Act V (Decisive Finish).
   - Total runtime between 24.0s and 35.0s (e.g., 28.5s or 30.0s).
   - Every single shot MUST contain all 8 mandatory fields:
     1. Duration & exact timecodes
     2. Visual description (~70% real product/rendering, ~30% editorial framing)
     3. Actual product action ("User does X → Math does Y")
     4. Camera framing, crop, and motion
     5. Typography (editorial hierarchy, zero generic marketing badges)
     6. Transition mechanism (hard cut, match cut, spatial push, viewport takeover)
     7. Intended sound design beat (minimal ambient bed, tactile UI clicks, low-frequency transition accents, planned silence)
     8. Rationale ("Why this shot exists")
   - Enforce visual event density where meaningful changes occur every 0.5–1.5 seconds with deliberate alternating rhythm (compression vs. breathing room). Include an explicit Event Beat Timeline.

4. Product Rendering Fidelity & Technical Pipeline (R4):
   - Evaluate Options 1–4 with technical pros, cons, and fidelity scores.
   - Definitive recommendation of Option 1 (Direct Deterministic Application Capture via Playwright/Puppeteer driving apps/graph at 4K 60fps) + Option 3 shared math assets.
   - 4-Phase Migration Roadmap for production.

5. Prototype Deprecation & Cleanup Matrix (R5):
   - Exhaustive file-by-file audit of existing files in apps/video (src/prototype/*, src/scenes/*, src/visualizers/*, public/*).
   - Detail what elements must be permanently abandoned (generic glow, cyber particles, HUD overlays, disconnected math demos, corporate audio tropes) and what foundational code can be salvaged.

6. Output Deliverable & Quality Assurance (R6):
   - Automated verification script specification, test criteria, and compliance mapping against the 23 design principles.

REQUIREMENTS FOR apps/video/scripts/verify-showcase-treatment.ts:
- Implement a robust TypeScript script that can be executed via `bun run apps/video/scripts/verify-showcase-treatment.ts`.
- The script must parse `apps/video/SHOWCASE_TREATMENT.md` and verify:
  1. Storyboard timing bounds (24.0s to 35.0s total runtime).
  2. Visual event beat intervals (every beat occurs within 0.5s–1.5s interval).
  3. All 8 required metadata fields present on every shot.
  4. All cited repository files/components exist on disk (checking via fs.existsSync for cited paths like `apps/graph/...`, `packages/scene/...`).
  5. The deliverable file contains zero "TODO", "TBD", or placeholder markers.
- Run the script with `run_command` (`bun run apps/video/scripts/verify-showcase-treatment.ts`) and confirm that it passes cleanly with exit code 0.

Write your handoff report to:
`/Users/lucifer/Programming/vinculum/.agents/teamwork/teamwork_preview_worker_lead_author/handoff.md`.
Include:
- Commands run and verification output.
- Summary of written deliverables.
- Send a completion message to parent when finished.
