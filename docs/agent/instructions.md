# instructions.md — Vinculum Agent Coding Instructions

## Purpose

These instructions define how AI coding agents must implement Vinculum pre-publish features without creating redundancy, architectural drift, low-value UI, or unmaintainable code.

The goal is to make Vinculum publishable as a coherent, stable, technically clean project. Every change must improve the product in a measurable way.

---

## 1. Core Development Rules

### 1.1 Do not create redundant systems

Before adding any new file, component, hook, store, schema, utility, route, service, or UI pattern, first inspect the existing codebase.

Do not create:

- Duplicate project stores.
- Duplicate scene serialization logic.
- Duplicate export pipelines.
- Duplicate parser or evaluator wrappers.
- Duplicate modal, dialog, toast, or notification systems.
- Duplicate toolbar implementations.
- Duplicate object-browser/tree components.
- Duplicate localStorage or IndexedDB access layers.
- Duplicate API clients.
- Duplicate validation logic.

If similar functionality exists, extend it instead of creating a parallel implementation.

A new abstraction is allowed only when:

1. The existing code cannot safely support the new requirement.
2. The new abstraction replaces the older one cleanly.
3. The migration path is explicit.
4. Dead code is removed in the same change.

---

### 1.2 Do not add AI slop

Do not add vague, decorative, or placeholder code that looks complete but is not functional.

Avoid:

- Placeholder buttons with no behavior.
- Fake telemetry.
- Fake exports.
- Fake autosave status.
- Mock data in production paths.
- Generic marketing text inside app UI.
- Over-explained comments that restate obvious code.
- Unused configuration files.
- Empty service layers.
- Components named `Enhanced`, `Improved`, `New`, `Final`, or `Advanced`.
- Large files generated without understanding existing architecture.

Every UI control must either work or be clearly disabled with a meaningful reason.

---

### 1.3 Keep implementation product-first

Vinculum is an interactive mathematical scene editor. Every feature must support one of these goals:

- Create scenes faster.
- Edit mathematical objects more safely.
- Save and recover work reliably.
- Share exact scenes with others.
- Export useful outputs.
- Improve stability, performance, accessibility, or security.

Do not add unrelated features, decorative dashboards, social features, chat UI, account systems, or unnecessary backend complexity unless explicitly required by the implementation phase.

---

## 2. Architecture Rules

### 2.1 Single source of truth

The scene document must have one canonical representation.

All save, load, share, export, import, autosave, migration, and recovery flows must use the same scene serialization path.

Required structure:

- `scene.schemaVersion`
- `scene.objects`
- `scene.parameters`
- `scene.camera` or viewport state if supported
- `scene.metadata`
- Optional feature-specific fields only when versioned

Do not serialize different shapes for different features.

---

### 2.2 Version everything that persists

Any persistent scene or project document must include a schema version.

Required metadata:

```ts
{
  name: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
}
```

Any future change to persistent structure must go through the migration pipeline.

Never silently ignore old scene formats.

---

### 2.3 Separate domain logic from UI

UI components must not directly implement persistence, compression, validation, migration, import, export, or expression evaluation logic.

Preferred layering:

```txt
ui/components
  calls hooks/actions only

features/<feature>
  feature-level state and orchestration

lib/scene
  serialization, validation, migration

lib/storage
  local persistence and recovery

lib/export
  PNG/SVG/JSON/render export

lib/expression
  parsing, diagnostics, guarded evaluation
```

UI should display results from domain services, not become the service.

---

### 2.4 Use typed boundaries

Every import/export/persistence boundary must validate data before use.

Required:

- Runtime validation for imported scene JSON.
- Typed project metadata.
- Typed migration input and output.
- Typed export options.
- Typed expression diagnostics.
- Typed share-link payloads.

Do not trust `JSON.parse` output directly.

---

### 2.5 Keep state predictable

Do not scatter scene state across unrelated stores.

Scene editing, project metadata, autosave status, export state, onboarding state, and UI preferences should be clearly separated but coordinated.

Avoid hidden mutation. Prefer explicit actions such as:

- `createProject`
- `loadProject`
- `saveProject`
- `autosaveProject`
- `recoverAutosave`
- `importScene`
- `exportScene`
- `migrateScene`
- `validateScene`

---

## 3. UI/UX Rules

### 3.1 No cluttered feature dumping

Do not add every feature as a new top-level button.

Use existing product surfaces intelligently:

- Project actions belong in the project menu or command palette.
- Export actions belong in a dedicated export dialog/menu.
- Share actions belong near project/export controls.
- Templates belong in welcome/onboarding and quick-open flows.
- Object grouping belongs inside the object browser.
- Animation belongs in a timeline panel.
- Measurements belong in the viewport tools area.

Every new UI surface must have a clear information hierarchy.

---

### 3.2 Prefer progressive disclosure

Advanced features must not overwhelm first-time users.

Use:

- Menus.
- Popovers.
- Command palette actions.
- Collapsible panels.
- Empty states.
- Focused onboarding hints.

Avoid large permanent panels unless the feature is central to active editing.

---

### 3.3 Every error must be actionable

Error messages must explain:

1. What failed.
2. Why it likely failed.
3. What the user can do next.

Bad:

```txt
Invalid JSON
```

Good:

```txt
This scene file could not be imported because object #3 is missing a required `type` field. Export a fresh copy or remove the invalid object and try again.
```

Expression errors must include syntax location when possible.

---

### 3.4 Avoid fake polish

Do not hide broken states with animations or generic loading UI.

Prefer honest states:

- Saving...
- Saved 12 seconds ago.
- Autosave failed. Retry.
- Scene recovered from previous session.
- Export failed because the scene is too large.
- Link is outdated. Try importing manually.

---

### 3.5 Accessibility is not optional

All core workflows must be keyboard-accessible.

Required:

- Focus trapping in modals.
- Escape closes dialogs/popovers where appropriate.
- Proper ARIA labels for icon buttons.
- Visible focus states.
- Reduced-motion compatibility.
- High-contrast-safe status indicators.
- No color-only meaning for errors, warnings, or success.

---

## 4. Persistence Rules

### 4.1 Named projects

Projects must be persistent and named.

Each project must store:

- Unique project id.
- Name.
- Created timestamp.
- Updated timestamp.
- Scene schema version.
- Scene payload.

Do not rely only on session state.

---

### 4.2 Autosave

Autosave must be debounced and resilient.

Requirements:

- Autosave after meaningful scene changes.
- Do not autosave every keystroke immediately.
- Show save status.
- Store enough data to recover after crash/restart.
- Do not overwrite a healthy saved project with corrupted state.
- Validate before writing persistent state.

---

### 4.3 Recovery

On startup, detect recoverable autosave state.

Recovery UI must let users:

- Restore autosaved scene.
- Discard autosave.
- Compare timestamp/project name when available.

Never silently replace the user’s current project with recovered data.

---

## 5. Share-Link Rules

### 5.1 Exact scene reproduction

A share link must reproduce the exact scene state intended by the user.

Include:

- Scene data.
- Schema version.
- Required camera/viewport state if supported.
- Relevant parameters.

Do not include unrelated local UI state unless required for scene reproduction.

---

### 5.2 Small and large scene strategy

Use two paths:

1. Small scenes: encoded scene JSON in URL.
2. Large scenes: short-link backend path if backend exists or is added.

If the backend path is not implemented yet, the UI must clearly explain the size limit and offer JSON export instead.

---

### 5.3 Invalid or outdated links

Invalid links must not crash the app.

Required fallback:

- Show import/link error dialog.
- Explain whether the link is malformed, too large, unsupported, or outdated.
- Offer manual JSON import when possible.

---

## 6. Export Rules

### 6.1 Export formats

Minimum publish-ready export support:

- JSON scene export.
- PNG export.

Preferred additional support:

- SVG export for 2D scenes.
- 3D rendered PNG screenshot.

Animation export can come later unless the timeline feature is implemented.

---

### 6.2 Export UX

Export UI must show:

- Format.
- Resolution or scale where applicable.
- What will be included.
- Validation errors before export starts.
- Clear success/failure state.

Do not trigger silent downloads without user context.

---

### 6.3 JSON import/export

JSON import must validate before applying.

JSON export must include:

- Scene schema version.
- Project or scene metadata.
- All required objects and parameters.

Do not export transient UI-only state unless explicitly useful.

---

## 7. Math Input and Evaluation Rules

### 7.1 Safe evaluation only

Expression execution must be sandboxed and bounded.

Required guardrails:

- Maximum input length.
- Maximum recursion or nesting depth.
- Compute timeout or operation budget where possible.
- No arbitrary JavaScript execution.
- No filesystem, network, DOM, or global access.
- No `eval` or `Function` constructor.

---

### 7.2 Diagnostics

Math input must provide inline diagnostics.

Diagnostics should include:

- Syntax errors.
- Unknown variables.
- Unsupported functions.
- Domain errors where detectable.
- Suggested corrections when obvious.

Do not show raw stack traces to users.

---

### 7.3 Debounced preview

Expression previews must be debounced.

Avoid rendering on every keystroke if it causes noisy updates or performance issues.

Preview state should clearly distinguish:

- Valid expression.
- Parsing.
- Invalid expression.
- Evaluation failed.

---

## 8. Performance Rules

### 8.1 Do not degrade interaction speed

Core editing must remain responsive.

Avoid:

- Heavy synchronous validation on every render.
- Full-scene reserialization on every keystroke.
- Re-rendering the full object tree for small changes.
- Blocking export work on the main thread when avoidable.

Use memoization, debouncing, workers, or chunking when appropriate.

---

### 8.2 Performance HUD

The performance HUD should be optional and non-invasive.

It may show:

- FPS.
- Frame time.
- Object count.
- Memory estimate when available.
- Heavy-scene warnings.

Do not show technical HUD by default to normal users.

---

## 9. Security Rules

### 9.1 Treat imports as untrusted

Every imported file, URL payload, or shared scene must be treated as hostile until validated.

Protect against:

- Oversized payloads.
- Malformed JSON.
- Deeply nested structures.
- Unsupported schema versions.
- Prototype pollution fields.
- Expression abuse.
- Recursive or high-cost computations.

---

### 9.2 Fail closed

If validation fails, do not partially apply the scene.

Show a safe error and preserve the current scene.

---

## 10. Testing Rules

### 10.1 Required tests for persistent features

Add tests for:

- Scene validation.
- Schema migration.
- Project create/load/save.
- Autosave and recovery.
- Import failure cases.
- Share-link encode/decode.
- Export request validation.
- Expression diagnostics and safety limits.

---

### 10.2 Regression prevention

Every bug fixed in import, export, migration, persistence, or expression evaluation must include a regression test.

Do not patch critical data flows without tests.

---

## 11. Code Quality Rules

### 11.1 Small, reviewable changes

Prefer focused commits/PRs:

- One domain feature at a time.
- One UI surface at a time.
- Tests included with the feature.
- Dead code removed immediately.

Do not submit giant mixed changes that combine persistence, export, onboarding, styling, and refactors together.

---

### 11.2 Naming rules

Names must be specific and durable.

Good:

- `sceneMigration.ts`
- `projectStorage.ts`
- `ShareSceneDialog.tsx`
- `ExportSceneMenu.tsx`
- `ExpressionDiagnosticsPanel.tsx`

Bad:

- `utils2.ts`
- `newStore.ts`
- `BetterModal.tsx`
- `FinalExport.tsx`
- `AdvancedSceneThing.tsx`

---

### 11.3 Remove obsolete paths

When replacing an old flow, remove the old flow.

Do not keep multiple paths unless there is a documented compatibility reason.

---

## 12. Definition of Done

A feature is done only when:

- It works through the real UI.
- It uses existing architecture where possible.
- Persistent data is versioned and validated.
- Failure states are handled gracefully.
- Accessibility basics are covered.
- Tests cover critical behavior.
- No duplicate systems were introduced.
- No placeholder production UI remains.
- Documentation or changelog is updated if user-facing behavior changed.

