# Vinculum Pre-Publish Feature Instructions

This document captures the feature set to implement before publishing Vinculum as a full project.

## 1) Highest-impact additions

### 1.1 Save/Load Projects (persistent, named)
- Add persistent named projects instead of relying only on session state.
- Store metadata: `name`, `createdAt`, `updatedAt`, and scene schema `version`.
- Include autosave and recovery flow on restart/crash.
- Add recent-projects list and quick switcher.

### 1.2 Shareable Links
- Support share links that reproduce the exact scene.
- Option A: encode scene JSON in URL for small scenes.
- Option B: add short-link backend path for larger scenes.
- Include import fallback when links are invalid or outdated.

### 1.3 Export polish
- Add 2D export: PNG and SVG.
- Add 3D export: rendered screenshot (PNG).
- Improve JSON import/export UX with clear error messaging and validation hints.

### 1.4 Onboarding + examples gallery
- Add starter templates (surfaces, planes, parametric curves, sketch examples).
- Add a first-run tour with focused hints for graph mode, tools, and object editing.
- Add “open example” actions in toolbar or welcome modal.

### 1.5 Input UX hardening
- Improve math input with inline syntax/parse diagnostics.
- Add debounced previews to reduce noisy updates.
- Improve expression error formatting and actionable suggestions.
- Enforce safe evaluation boundaries and guardrails for expression execution.

## 2) Product-completeness tier

### 2.1 Object groups/folders
- Add grouped object hierarchy in the object browser.
- Support group-level visibility toggle, color preset, duplicate, and delete.

### 2.2 Animation timeline
- Expose timeline/keyframe UI for parameter animation.
- Support play/pause/loop presets and scrubbing.
- Add export workflow for short animation outputs (GIF/MP4 via pipeline).

### 2.3 Advanced constraints
- Extend attach/align/offset with axis locks and numeric constraints.
- Add interactive visual handles in viewport for constraint editing.

### 2.4 Probe + measurement tools
- Add distance, angle, and intersection measurements.
- Add persistent annotation pins tied to scene objects/coordinates.

### 2.5 Accessibility pass
- Ensure keyboard-first operation for toolbar/object browser/core flows.
- Improve focus management and ARIA semantics for all menus/dialogs.
- Validate high-contrast behavior and reduced-motion compatibility.

## 3) Public-ready engineering must-haves

### 3.1 Error reporting + telemetry
- Integrate crash/error reporting (example: Sentry).
- Add user-friendly fallback UI when render/eval fails.

### 3.2 Performance profiling mode
- Add optional performance HUD (FPS, frame time, memory).
- Surface warnings for heavy scenes/resolution/object counts.

### 3.3 Schema/version migration
- Version scene documents explicitly.
- Add migration pipeline for old scene formats.
- Validate migrations in automated tests.

### 3.4 Security hardening
- Add expression/input limits (size, recursion, compute ceilings).
- Harden import pipeline against oversized or malformed payloads.
- Keep evaluation sandbox constraints explicit and tested.

### 3.5 Docs/changelog/roadmap
- Publish user docs with examples and known limits.
- Maintain changelog per release.
- Publish roadmap for next milestones after initial launch.

## 4) Lean MVP publish checklist (recommended)

Implement these six before release:
- Named projects + autosave
- Shareable scene links
- Polished export (PNG + JSON at minimum)
- Templates/examples gallery
- Error monitoring + graceful fallback
- Scene schema versioning and migration support

## 5) Suggested implementation order

1. Persistence foundation (projects + schema versioning)
2. Share links + import robustness
3. Export pipeline
4. Templates/onboarding
5. Error monitoring + fallback UX
6. Final accessibility/performance/security pass
