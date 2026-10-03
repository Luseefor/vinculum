# Project: Vinculum Showcase Film — Creative Treatment & Technical Fidelity Specification

## Architecture
- **Target Document**: `apps/video/SHOWCASE_TREATMENT.md`
- **Verification Engine**: `apps/video/scripts/verify-showcase-treatment.ts` (executed via `bun run`)
- **Monorepo Ground Truth**:
  - `apps/graph`: Next.js 14 App Router, Three.js 0.186.1 WebGPU + WebGL2 fallback, TSL adaptive grid, screen-width node strokes, UI chrome, Zustand stores (`graphStore`, `editorStore`, `historyStore`).
  - `packages/scene`: `@vinculum/scene` canonical scene schema, 13 `GraphObjectKind` types, serialization & migration.
  - `apps/video`: Remotion 4.0 harness, editorial typography, audio, capture composition.
  - Math Engines: `rustMath` WebAssembly bytecode + `mathjs` AST symbolic algebra & differentiation.

## Feature Inventory
Every feature from the Survey phase is mapped to an assigned milestone:
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Capability Inventory (8 fields) | 14 audited capabilities across all 8 mandatory dimensions | M1 | survey_graph |
| 2 | Three.js / Shader Engine Architecture | WebGPU/WebGL2, TSL adaptive grid, node-material wide strokes | M1 | survey_graph |
| 3 | One-Paragraph Product Thesis | Authoritative definition, emotional target, intellectual positioning | M2 | survey_design |
| 4 | 4 Hero Moments & Exclusion Rationales | Gyroid level-set, RK4 streamlines, linear transform, tangent patch | M2 | survey_graph |
| 5 | Three Contrasting Concepts (A, B, C) | Notation to Space, The Instrument, Mathematical Worlds (strengths/risks) | M2 | survey_design |
| 6 | Recommended Concept & Justification | Concept A with Concept B tactile precision, deep rationale | M2 | survey_design |
| 7 | Parity Evaluation (Options 1–4) | Direct capture, component reuse, shared package, style reconstruction | M3 | survey_video |
| 8 | Definitive Pipeline & Migration Roadmap | Option 1 recommendation, 4-phase technical roadmap | M3 | survey_video |
| 9 | Prototype Deprecation & Cleanup Matrix | 60 files audited, permanent abandon vs salvaged foundations | M3 | survey_video |
| 10 | 5-Act Storyboard Architecture | Acts I–V, 24.0s–35.0s runtime, alternating pacing rhythm | M4 | original_request |
| 11 | Shot-by-Shot Specifications (8 fields) | Timecodes, visual, product action, camera, typo, transition, sound, rationale | M4 | original_request |
| 12 | Visual Event Density & Composition | Event beats every 0.5–1.5s, ~70% real product / ~30% editorial | M4 | original_request |
| 13 | Deliverable Document Synthesis | Generate authoritative `apps/video/SHOWCASE_TREATMENT.md` | M5 | original_request |
| 14 | Automated Verification Script | Implement `apps/video/scripts/verify-showcase-treatment.ts` | M5 | original_request |
| 15 | Script Execution & Gate Verification | Automated timing, beat interval, metadata, and file existence checks | M5 | original_request |
| 16 | Adversarial Creative Review | Evaluate treatment against all 23 design principles from Module 1–23 | M6 | original_request |
| 17 | Forensic Integrity Audit | Static analysis, citation validation, zero-cheating verification | M6 | original_request |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Monorepo Capability & Rendering Engine Audit | R1: Complete 14-capability inventory across 8 fields + Three.js/TSL architecture | none | DONE |
| M2 | Core Thesis, Hero Moments & 3 Concepts | R2: Product thesis, 4 hero moments, exclusion matrix, 3 concepts, recommendation | none | DONE |
| M3 | Technical Pipeline & Prototype Deprecation | R4, R5: Parity evaluation of Options 1–4, migration roadmap, deprecation matrix | none | DONE |
| M4 | Storyboard & Pacing Architecture | R3: 5-Act storyboard, all shots with 8 mandatory fields, 0.5–1.5s event density | M1, M2 | DONE |
| M5 | Deliverable Assembly & Automated Verification | R6: Full SHOWCASE_TREATMENT.md generation + verification script implementation & run | M1, M2, M3, M4 | DONE |
| M6 | Creative Director Review & Forensic Audit | R6: Adversarial review against 23 design principles + forensic integrity audit | M5 | DONE |

## Interface Contracts
### Survey Reports ↔ Drafting Workers
- Input: `/Users/lucifer/Programming/vinculum/.agents/teamwork/teamwork_preview_explorer_survey_graph/handoff.md`, `/Users/lucifer/Programming/vinculum/.agents/teamwork/teamwork_preview_explorer_survey_video/handoff.md`, `/Users/lucifer/Programming/vinculum/.agents/teamwork/teamwork_preview_spec_miner_survey_design/handoff.md`.
- Output: Section draft markdown files in subagent directories.

### Section Drafts ↔ Final Integration Worker (M5)
- Input: Drafted sections M1, M2, M3, M4.
- Output: `/Users/lucifer/Programming/vinculum/apps/video/SHOWCASE_TREATMENT.md` adhering to all requirements.
- Verification Script: `/Users/lucifer/Programming/vinculum/apps/video/scripts/verify-showcase-treatment.ts` exiting with code 0.

### Deliverable ↔ Verification & Review (M6)
- Input: `apps/video/SHOWCASE_TREATMENT.md`
- Output: Reviewer approval report + Challenger test report + Auditor clean certificate.

## Code Layout
- Deliverable: `/Users/lucifer/Programming/vinculum/apps/video/SHOWCASE_TREATMENT.md`
- Script: `/Users/lucifer/Programming/vinculum/apps/video/scripts/verify-showcase-treatment.ts`
- Metadata & Coordination: `/Users/lucifer/Programming/vinculum/.agents/teamwork/*`
