# 02-feature-contracts.md — Vinculum Feature Contracts

## Purpose

This file defines exact implementation contracts for the pre-publish feature set. Agents must implement these as real vertical slices, not placeholders.

---

## 1. Scene schema versioning and migration

### Goal

All scene documents must be explicit, versioned, validated, and migratable.

### Required concepts

```ts
type SceneSchemaVersion = number;

const CURRENT_SCENE_SCHEMA_VERSION: SceneSchemaVersion = 1;

interface SceneDocument {
  schemaVersion: SceneSchemaVersion;
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  objects: GraphObject[];
  // Include only fields currently owned by the canonical scene document.
}
```

Use the actual existing scene shape if different. Do not invent fields that are not used.

### Required behavior

- Serialized scenes include `schemaVersion`.
- Missing schema version is treated as legacy and migrated.
- Older supported versions migrate to the current version.
- Future unsupported versions are rejected with a clear error.
- Malformed payloads do not mutate the current scene.
- Migration result includes structured failure reasons.

### Required tests

- Current version round trip.
- Missing version migration.
- Older supported version migration.
- Unsupported future version rejection.
- Invalid object rejection.
- Corrupt JSON rejection.
- No partial store mutation on failed import.

---

## 2. Named projects, autosave, and recovery

### Goal

Users can create, save, load, rename, delete, recover, and switch named projects without relying on tab session state.

### Required data types

```ts
interface ProjectDocument {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  scene: SceneDocument;
}

interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  objectCount: number;
  schemaVersion: number;
}

interface RecoverySnapshot {
  projectId?: string;
  capturedAt: string;
  scene: SceneDocument;
  reason: "autosave" | "crash-recovery" | "manual";
}
```

Adjust names to match the existing codebase, but preserve the responsibilities.

### Required behavior

- New project creates a named scene document.
- Save updates `updatedAt`.
- Autosave is debounced and does not fire for every keystroke.
- Recent projects are sorted by `updatedAt` descending.
- Loading a project replaces current scene through the canonical store action.
- Loading a project intentionally clears or seeds undo/redo history.
- Deleting a project asks for confirmation.
- Recovery snapshot appears only when real recoverable data exists.
- Recovery restore is explicit. It must not silently overwrite the current scene.

### Required UI

- Project menu in existing top chrome.
- Recent projects dialog or menu.
- Rename project action.
- Delete project action.
- Autosave status only when backed by real save state.
- Recovery dialog on startup only when needed.

### Forbidden

- Fake autosave labels.
- Storing all projects only in `graphStore`.
- Using history stack as persistence.
- Silent project overwrite.
- Creating a backend for local projects.

### Required tests

- Create/list/load project.
- Rename project.
- Delete project.
- Autosave debounce behavior.
- Recovery snapshot detection.
- Recovery restore.
- Failed project load does not mutate current scene.

---

## 3. Shareable scene links

### Goal

Users can share a link that reconstructs the exact scene when opened.

### Required behavior

- Small scenes may be encoded in the URL.
- Link payload uses canonical serialized scene document.
- Payload should be compressed or compacted if implemented.
- Invalid links show an import/share error, not a crash.
- Outdated links attempt migration.
- Unsupported future versions are rejected clearly.
- Link opening must not mutate current scene until payload is valid.

### Recommended URL shape

Use one stable format. Example:

```txt
/?scene=<encoded-payload>
```

or

```txt
/#scene=<encoded-payload>
```

Pick the shape that works best with the existing Next.js route and client-side parsing.

### Large scene rule

If the scene exceeds safe URL size, do not pretend the link works. Show a clear message:

```txt
This scene is too large for a local share link. Export JSON instead.
```

Short-link backend is a later milestone unless explicitly requested.

### Required tests

- Encode/decode round trip.
- Invalid payload rejection.
- Old version payload migration.
- Future version rejection.
- Too-large scene handling.
- Opening a valid link updates scene through canonical load action.

---

## 4. Import/export polish

### Goal

Import and export should be reliable, understandable, and safe.

### Required export formats before release

- JSON scene document.
- PNG image export at minimum.

### Product-completeness formats

- SVG for 2D.
- 3D rendered screenshot PNG.

### JSON export behavior

- Export canonical serialized scene document.
- Include schema version.
- Include metadata if supported.
- Use stable formatting.
- Filename should include project or scene name and date when possible.

### JSON import behavior

- Parse file safely.
- Validate size before parsing if possible.
- Validate schema.
- Migrate older versions.
- Report field-level or object-level errors where practical.
- Never partially mutate current scene on failed import.

### PNG export behavior

- Export real viewport or render output.
- Do not export empty placeholder images.
- Error if renderer is unavailable.
- Use a clear filename.

### Required tests

- Valid JSON import.
- Invalid JSON error.
- Invalid schema error.
- Future version error.
- JSON export includes schema version.
- PNG export function returns a real image blob or data URL where testable.

---

## 5. Templates and examples gallery

### Goal

Users can open high-quality starter scenes that demonstrate Vinculum's real capabilities.

### Required template types

At minimum:

- Surface example.
- Plane example.
- Parametric curve example.
- 2D sketch or sketch-fitted curve example.
- Mixed scene example.

### Template source

Templates must be real scene documents using the canonical schema.

Recommended location:

```txt
apps/graph/lib/templates/
```

or an equivalent existing scene/examples location.

### Required behavior

- Open template action validates the template scene.
- Opening a template replaces the current scene only after confirmation if the current scene has unsaved changes or objects.
- Opening a template intentionally clears or seeds history.
- Template cards use concise names and descriptions.

### Forbidden

- Marketing-heavy cards.
- Fake templates that are not loadable scene documents.
- Images that do not match the scene.
- A separate template scene format.

### Required tests

- Each template validates.
- Each template deserializes.
- Opening a template updates object count.
- Confirmation appears when replacing a non-empty scene.

---

## 6. Math input diagnostics and safety

### Goal

Expression input must be safer, clearer, and less noisy.

### Required behavior

- Inline syntax diagnostics.
- Debounced preview updates.
- Field-level error messages.
- Actionable suggestions where possible.
- Safe evaluation boundaries.
- Expression length limits.
- Sampling and resolution ceilings.
- Heavy expression warnings.

### Forbidden

- JavaScript `eval`.
- `Function` constructor.
- Dynamic code execution.
- Unbounded expression compilation.
- Unbounded sampling.
- Recomputing expensive previews on every keystroke.
- Crashing the shell when one object has a bad expression.

### Required tests

- Valid expression compiles.
- Invalid expression produces diagnostic.
- Dangerous/unsupported expression rejected.
- Overlong expression rejected.
- Sampling cap enforced.
- Failed expression does not crash scene rendering.

---

## 7. Error reporting and graceful fallback

### Goal

Rendering, importing, exporting, and expression evaluation failures must degrade gracefully.

### Required behavior

- Add local error boundaries around risky editor regions.
- Render/eval failures show a user-friendly fallback.
- Error details are available for debugging without overwhelming normal users.
- Telemetry integration must be real if added.
- If no telemetry key/config exists, use a local no-op adapter and do not claim remote reporting is active.

### Required tests

- Error boundary catches viewport failure.
- Import failure shows recoverable error UI.
- Expression failure isolates to object/field.
- No telemetry call is made when telemetry is disabled.

---

## 8. Performance guardrails

### Goal

Vinculum should warn before heavy scenes make the editor unusable.

### Required behavior

- Warn for high object count.
- Warn for high surface resolution.
- Warn for high curve samples.
- Warn for heavy combined scene complexity.
- Provide a way to reduce quality/resolution.
- Optional performance HUD may show FPS, frame time, and memory if available.

### Forbidden

- Always-on noisy HUD.
- Fake FPS.
- Performance metrics that are not measured.
- Blocking scene load without a clear reason.

### Required tests

- Complexity estimator returns expected warning levels.
- Heavy resolution triggers warning.
- Normal scene does not trigger warning.

---

## 9. Accessibility pass

### Goal

Core editor workflows must be usable with keyboard and assistive technologies.

### Required behavior

- Toolbar controls have labels.
- Toggle controls expose pressed state.
- Dialogs trap focus and restore focus on close.
- Menus close on Escape.
- Core flows are keyboard reachable.
- Reduced motion is respected where animations exist.
- High contrast remains usable.

### Required tests

- Existing graph mode toggles retain `aria-pressed`.
- Dialog open/close has focus behavior where testable.
- New project/share/export/template controls have accessible names.
- Escape closes menus/dialogs where implemented.

---

## 10. Docs, changelog, and roadmap

### Goal

Public release should explain what Vinculum does, what it supports, and what it does not support.

### Required docs

- User quickstart.
- Example gallery explanation.
- Import/export docs.
- Known limits.
- Changelog.
- Roadmap.

### Rules

- Keep docs truthful.
- Do not claim cloud sync, collaboration, accounts, or CAD-level precision unless implemented.
- Known limitations are acceptable. False claims are not.
