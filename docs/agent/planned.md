# planned.md — Vinculum Pre-Publish Implementation Plan



## Current alignment

This plan is aligned with the current Vinculum monorepo: `@vinculum/graph` is the main Next.js editor app in `apps/graph`, `@vinculum/scene` owns shared scene/domain types under `packages/scene`, scene validation/serialization lives in the graph app, and existing CI already runs lint, typecheck, tests, build, smoke, and Playwright browser coverage.

Follow phases in order unless the user explicitly requests a smaller isolated fix.

## Scope freeze before UI redesign

Feature scope is frozen before UI redesign begins.

Allowed work in this freeze window:
- repository stabilization
- bug fixes
- test stability fixes
- UI redesign implementation

Any new feature scope requires explicit user approval before implementation.

## Release Goal

Prepare Vinculum for public publishing by implementing the minimum product-complete foundation:

1. Named projects with autosave.
2. Scene schema versioning and migration.
3. Shareable scene links.
4. Polished export flow.
5. Templates and onboarding.
6. Error monitoring and graceful fallback UX.
7. Final accessibility, performance, and security hardening.

---

## Phase 0: Codebase Audit and Cleanup

### Goal

Understand the current architecture before adding features. Prevent duplicate systems and remove obvious dead paths.

### Tasks

- [ ] Identify the current scene state/store implementation.
- [ ] Identify existing import/export logic.
- [ ] Identify existing project/session persistence logic.
- [ ] Identify current math expression parser/evaluator path.
- [ ] Identify existing UI primitives for dialogs, menus, toasts, toolbar, panels, and object browser.
- [ ] Identify existing test setup.
- [ ] Document the canonical scene shape currently used.
- [ ] Remove or mark obsolete duplicated utilities/components.

### Deliverables

- [ ] Short internal architecture note.
- [ ] List of files that must be extended rather than duplicated.
- [ ] List of unsafe or unfinished areas.

### Acceptance checks

- [ ] Agent knows where scene serialization happens.
- [ ] Agent knows where persistent storage should be implemented.
- [ ] No new feature work begins before this audit is complete.

---

## Phase 1: Scene Schema Versioning and Migration Foundation

### Goal

Create the stable data foundation required by projects, autosave, sharing, import, and export.

### Tasks

- [ ] Define canonical `SceneDocument` type.
- [ ] Add `schemaVersion` to every saved/exported scene.
- [ ] Add scene metadata fields: `name`, `createdAt`, `updatedAt` where appropriate.
- [ ] Create runtime scene validator.
- [ ] Create migration pipeline.
- [ ] Add first migration path for current/legacy scene data.
- [ ] Add unsupported-version error handling.
- [ ] Ensure imports never apply invalid scenes.
- [ ] Add tests for valid scene, invalid scene, old scene, future scene, malformed scene.

### Suggested files

```txt
lib/scene/sceneTypes.ts
lib/scene/sceneSchema.ts
lib/scene/sceneValidation.ts
lib/scene/sceneMigration.ts
lib/scene/sceneSerialization.ts
```

### Acceptance checks

- [ ] Every saved scene has a schema version.
- [ ] Every imported scene is validated before use.
- [ ] Old scene data can migrate forward.
- [ ] Unsupported future versions show a safe error.
- [ ] Tests cover validation and migration.

---

## Phase 2: Named Projects and Persistent Storage

### Goal

Replace session-only usage with persistent named projects.

### Tasks

- [ ] Define `ProjectDocument` type.
- [ ] Add unique project IDs.
- [ ] Store project metadata: `name`, `createdAt`, `updatedAt`, `schemaVersion`.
- [ ] Implement local project storage layer.
- [ ] Add create project flow.
- [ ] Add rename project flow.
- [ ] Add save project flow.
- [ ] Add load project flow.
- [ ] Add delete project flow with confirmation.
- [ ] Add recent projects list.
- [ ] Add quick switcher.
- [ ] Connect project loading to scene migration.
- [ ] Add tests for project create/load/save/delete.

### Suggested files

```txt
lib/storage/projectStorage.ts
features/projects/projectTypes.ts
features/projects/projectActions.ts
features/projects/useProjects.ts
components/projects/ProjectMenu.tsx
components/projects/RecentProjectsDialog.tsx
```

### Acceptance checks

- [ ] User can create a named project.
- [ ] User can close/reopen app and load the project.
- [ ] Recent projects are visible.
- [ ] Project switcher does not lose unsaved work silently.
- [ ] Invalid project documents do not crash the app.

---

## Phase 3: Autosave and Crash Recovery

### Goal

Protect user work from reloads, crashes, and accidental exits.

### Tasks

- [ ] Add debounced autosave after meaningful scene changes.
- [ ] Track autosave status: idle, saving, saved, failed.
- [ ] Display save status in the UI.
- [ ] Store recovery snapshot separately from confirmed saved project.
- [ ] Validate scene before writing autosave.
- [ ] Detect recoverable autosave on startup.
- [ ] Add recovery dialog.
- [ ] Allow restore autosave.
- [ ] Allow discard autosave.
- [ ] Prevent corrupted autosave from replacing valid project data.
- [ ] Add tests for autosave debounce, restore, discard, corrupted snapshot.

### Suggested files

```txt
lib/storage/autosaveStorage.ts
features/projects/useAutosave.ts
components/projects/AutosaveStatus.tsx
components/projects/RecoveryDialog.tsx
```

### Acceptance checks

- [ ] Autosave does not fire on every keystroke instantly.
- [ ] Reloading after unsaved work offers recovery.
- [ ] Discarding recovery preserves the last valid saved project.
- [ ] Autosave failures show actionable UI.

---

## Phase 4: Import and Export Polish

### Goal

Make scene import/export reliable and understandable.

### Tasks

- [ ] Improve JSON export to include schema version and metadata.
- [ ] Improve JSON import with validation and migration.
- [ ] Add friendly import error messages.
- [ ] Add PNG export for 2D/current viewport.
- [ ] Add 3D rendered PNG screenshot export if 3D viewport exists.
- [ ] Add SVG export for 2D scenes if feasible.
- [ ] Create export dialog/menu with format choices.
- [ ] Add export settings: format, resolution/scale where relevant.
- [ ] Add export success/failure states.
- [ ] Add tests for export request validation and import failure cases.

### Suggested files

```txt
lib/export/exportTypes.ts
lib/export/exportJson.ts
lib/export/exportPng.ts
lib/export/exportSvg.ts
features/export/useSceneExport.ts
components/export/ExportSceneDialog.tsx
```

### Acceptance checks

- [ ] JSON export can be imported back without data loss.
- [ ] Invalid JSON import gives a specific error.
- [ ] PNG export works from the real UI.
- [ ] Export failure does not crash the app.
- [ ] Export UI clearly explains what will be exported.

---

## Phase 5: Shareable Scene Links

### Goal

Allow users to share scenes that reproduce exact state.

### Tasks

- [ ] Define share payload type.
- [ ] Encode small scenes into URL-safe payloads.
- [ ] Decode and validate scene payload from URL.
- [ ] Migrate decoded scene if needed.
- [ ] Add share dialog with copy-link action.
- [ ] Add size limit detection.
- [ ] Add fallback to JSON export for oversized scenes.
- [ ] Add invalid-link fallback dialog.
- [ ] Add optional backend short-link path only if backend is part of release scope.
- [ ] Add tests for encode/decode/invalid/oversized/outdated links.

### Suggested files

```txt
lib/share/shareTypes.ts
lib/share/shareEncoding.ts
lib/share/shareValidation.ts
features/share/useShareScene.ts
components/share/ShareSceneDialog.tsx
components/share/InvalidShareLinkDialog.tsx
```

### Acceptance checks

- [ ] A copied link opens the same scene.
- [ ] Invalid links do not crash the app.
- [ ] Oversized scenes give a clear fallback.
- [ ] Shared scenes use the same validation and migration path as imports.

---

## Phase 6: Templates, Examples Gallery, and Onboarding

### Goal

Help first-time users understand Vinculum quickly.

### Tasks

- [ ] Add starter templates for surfaces.
- [ ] Add starter templates for planes.
- [ ] Add starter templates for parametric curves.
- [ ] Add starter templates for sketch examples.
- [ ] Add examples gallery UI.
- [ ] Add “open example” action in welcome modal or toolbar.
- [ ] Add first-run tour state.
- [ ] Add focused hints for graph mode.
- [ ] Add focused hints for tools.
- [ ] Add focused hints for object editing.
- [ ] Ensure opening a template creates a normal editable scene/project.

### Suggested files

```txt
features/templates/templates.ts
features/templates/templateActions.ts
components/templates/ExamplesGallery.tsx
components/onboarding/WelcomeModal.tsx
components/onboarding/FirstRunTour.tsx
```

### Acceptance checks

- [ ] First-time user sees useful starting options.
- [ ] Examples are real scene documents, not screenshots.
- [ ] Opening an example does not pollute saved projects unless user saves it.
- [ ] Tour can be skipped and does not reappear unnecessarily.

---

## Phase 7: Math Input UX Hardening

### Goal

Make expression editing safer, clearer, and less noisy.

### Tasks

- [ ] Add expression input limits.
- [ ] Add parser diagnostics.
- [ ] Add inline syntax errors.
- [ ] Add unknown-variable diagnostics.
- [ ] Add unsupported-function diagnostics.
- [ ] Add actionable suggestions where feasible.
- [ ] Add debounced previews.
- [ ] Add clear preview states: parsing, valid, invalid, evaluation failed.
- [ ] Enforce safe evaluation boundaries.
- [ ] Add tests for expression safety and diagnostics.

### Suggested files

```txt
lib/expression/expressionLimits.ts
lib/expression/expressionDiagnostics.ts
lib/expression/safeEvaluate.ts
features/expression/useExpressionPreview.ts
components/expression/ExpressionInput.tsx
```

### Acceptance checks

- [ ] Invalid expressions do not crash rendering.
- [ ] Diagnostics appear inline.
- [ ] Preview updates are debounced.
- [ ] Unsafe expressions are blocked.
- [ ] Raw stack traces never appear in user UI.

---

## Phase 8: Error Monitoring and Fallback UI

### Goal

Make public release failures visible to maintainers and understandable to users.

### Tasks

- [ ] Add app-level error boundary.
- [ ] Add render/evaluation fallback UI.
- [ ] Add import/export failure fallback UI.
- [ ] Integrate Sentry or equivalent if allowed.
- [ ] Add environment-based telemetry configuration.
- [ ] Avoid sending private scene content unless explicitly configured and disclosed.
- [ ] Add manual error report copy option if telemetry is disabled.

### Suggested files

```txt
lib/monitoring/errorReporting.ts
components/error/AppErrorBoundary.tsx
components/error/RenderFallback.tsx
components/error/EvaluationFallback.tsx
```

### Acceptance checks

- [ ] Render failure does not blank the whole app.
- [ ] Evaluation failure does not crash the scene editor.
- [ ] Monitoring is disabled or safe in development.
- [ ] Sensitive scene content is not sent by default.

---

## Phase 9: Object Groups and Folders

### Goal

Improve organization for complex scenes.

### Tasks

- [ ] Extend scene schema for object groups/folders.
- [ ] Add migration support for scenes without groups.
- [ ] Add grouped hierarchy to object browser.
- [ ] Add create group.
- [ ] Add rename group.
- [ ] Add move object to group.
- [ ] Add group visibility toggle.
- [ ] Add group color preset.
- [ ] Add duplicate group.
- [ ] Add delete group with confirmation.
- [ ] Add tests for group persistence and migration.

### Acceptance checks

- [ ] Groups persist across save/load/share/export.
- [ ] Group visibility affects all child objects.
- [ ] Deleting a group is explicit and safe.
- [ ] Ungrouped legacy scenes still open.

---

## Phase 10: Animation Timeline

### Goal

Expose parameter animation in a structured timeline UI.

### Tasks

- [ ] Define animation schema.
- [ ] Add keyframe data model.
- [ ] Add migration support.
- [ ] Add timeline panel.
- [ ] Add parameter keyframe creation.
- [ ] Add play/pause controls.
- [ ] Add loop preset.
- [ ] Add scrubbing.
- [ ] Add preview playback.
- [ ] Add export pipeline planning for GIF/MP4.
- [ ] Defer GIF/MP4 if infrastructure is not ready.

### Acceptance checks

- [ ] Timeline can animate at least one parameter.
- [ ] Playback is stable.
- [ ] Animation state persists.
- [ ] Export is either functional or clearly marked as not available yet.

---

## Phase 11: Constraints, Probe, and Measurement Tools

### Goal

Improve technical editing accuracy.

### Advanced constraints tasks

- [ ] Add axis locks.
- [ ] Add numeric offset constraints.
- [ ] Add align/attach/offset validation.
- [ ] Add viewport handles for constraint editing.
- [ ] Persist constraints in scene schema.

### Probe and measurement tasks

- [ ] Add distance measurement.
- [ ] Add angle measurement.
- [ ] Add intersection measurement where supported.
- [ ] Add persistent annotation pins.
- [ ] Tie annotation pins to scene objects or coordinates.
- [ ] Add tests for measurement calculations.

### Acceptance checks

- [ ] Measurements are accurate and stable.
- [ ] Constraints survive save/load/share/export.
- [ ] Invalid constraints show user-friendly errors.

---

## Phase 12: Performance Profiling Mode

### Goal

Help diagnose heavy scenes without cluttering normal UI.

### Tasks

- [ ] Add optional performance HUD.
- [ ] Show FPS.
- [ ] Show frame time.
- [ ] Show object count.
- [ ] Show memory estimate if available.
- [ ] Add heavy-scene warnings.
- [ ] Add resolution/object-count warnings where useful.
- [ ] Ensure HUD is off by default.

### Acceptance checks

- [ ] HUD can be toggled.
- [ ] HUD does not significantly degrade performance.
- [ ] Heavy scenes produce clear warnings.

---

## Phase 13: Accessibility, Security, and Final Hardening

### Accessibility tasks

- [ ] Keyboard test toolbar.
- [ ] Keyboard test object browser.
- [ ] Keyboard test project menu.
- [ ] Keyboard test export/share dialogs.
- [ ] Add missing ARIA labels.
- [ ] Verify focus management.
- [ ] Verify high-contrast behavior.
- [ ] Verify reduced-motion compatibility.

### Security tasks

- [ ] Add max import payload size.
- [ ] Add max URL payload size.
- [ ] Add scene depth/object count limits.
- [ ] Add expression size limits.
- [ ] Add compute ceilings where possible.
- [ ] Block prototype pollution fields.
- [ ] Ensure failed validation preserves current scene.

### Final engineering tasks

- [ ] Run full test suite.
- [ ] Run lint/typecheck.
- [ ] Test save/load/recovery manually.
- [ ] Test import/export manually.
- [ ] Test share links manually.
- [ ] Test first-run onboarding manually.
- [ ] Test invalid input paths manually.

### Acceptance checks

- [ ] Core flows work by keyboard.
- [ ] Malformed imports cannot crash or corrupt state.
- [ ] Performance remains acceptable for normal scenes.
- [ ] No placeholder UI remains.

---

## Phase 14: Docs, Changelog, and Roadmap

### Goal

Make the project understandable to users and maintainers.

### Tasks

- [ ] Add user docs for creating scenes.
- [ ] Add user docs for saving/loading projects.
- [ ] Add user docs for sharing scenes.
- [ ] Add user docs for import/export.
- [ ] Add examples documentation.
- [ ] Add known limits.
- [ ] Add changelog entry for publish release.
- [ ] Add roadmap after initial launch.

### Suggested files

```txt
docs/getting-started.md
docs/projects.md
docs/share-links.md
docs/import-export.md
docs/examples.md
CHANGELOG.md
ROADMAP.md
```

### Acceptance checks

- [ ] New user can understand basic flows without asking the developer.
- [ ] Known limitations are explicit.
- [ ] Release changes are documented.

---

## Lean MVP Release Checklist

These must be complete before publishing.

- [ ] Named projects.
- [ ] Autosave.
- [ ] Recovery flow.
- [ ] Scene schema versioning.
- [ ] Migration pipeline.
- [ ] Shareable scene links.
- [ ] PNG export.
- [ ] JSON import/export polish.
- [ ] Templates/examples gallery.
- [ ] Error boundary/fallback UI.
- [ ] Error monitoring or manual report path.
- [ ] Import security limits.
- [ ] Expression safety limits.
- [ ] Basic accessibility pass.
- [ ] User docs.
- [ ] Changelog.

---

## Recommended Build Order

Follow this order strictly unless the current codebase makes a different order obviously safer.

```txt
1. Audit current codebase
2. Scene schema/versioning/migration
3. Named projects
4. Autosave/recovery
5. Import/export polish
6. Share links
7. Templates/onboarding
8. Expression UX hardening
9. Error monitoring/fallback UI
10. Accessibility/security/performance pass
11. Docs/changelog/roadmap
12. Optional advanced features: groups, animation, constraints, measurements
```

---

## Do Not Start Before These Are True

- [ ] Current scene shape is known.
- [ ] Existing storage behavior is known.
- [ ] Existing export/import behavior is known.
- [ ] Existing expression evaluation path is known.
- [ ] Existing UI primitives are known.
- [ ] A migration strategy exists.

---

## Publish Readiness Definition

Vinculum is ready to publish when:

- A user can create a scene, save it, close the app, reopen it, and continue.
- A user can recover unsaved work after a crash/reload.
- A user can export at least JSON and PNG.
- A user can share a scene link that opens correctly.
- A new user can start from templates/examples.
- Invalid input does not crash the app.
- Old scene data migrates or fails gracefully.
- Errors are understandable.
- Core flows are keyboard accessible.
- No duplicate systems, placeholder production UI, or fake features remain.
