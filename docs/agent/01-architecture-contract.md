# 01-architecture-contract.md — Vinculum Architecture Contract

## Purpose

This file defines the architecture boundaries that coding agents must follow. It prevents duplicate systems, misplaced code, and product drift.

---

## 1. Monorepo contract

Current repository shape:

```txt
/
├── package.json
├── bun.lock
├── apps/
│   └── graph/                 # Main product, @vinculum/graph
├── packages/
│   └── scene/                 # Shared scene package, @vinculum/scene
└── .github/workflows/graph.yml
```

Only `apps/graph` is the publishable application today. `packages/scene` is a shared TypeScript scene/domain package.

---

## 2. Package ownership

### 2.1 `packages/scene`

Use `packages/scene` only for app-agnostic scene definitions.

Allowed:

- Shared graph object kinds.
- Shared object shape definitions.
- Shared defaults.
- Pure scene/domain helpers with no browser, React, Next.js, Zustand, Three.js runtime, or UI dependency.

Not allowed:

- React components.
- Next.js code.
- Zustand stores.
- Editor layout state.
- Browser persistence.
- Project repositories.
- Import/export dialogs.
- Telemetry.
- Rendering engine runtime.

### 2.2 `apps/graph`

Use `apps/graph` for product implementation:

- App Router route and shell.
- `EditorShell`.
- `TopToolbar`.
- Object browser.
- Inspector and expression editing.
- 2D and 3D viewport integration.
- Scene validation adapters.
- Import/export UI.
- Project persistence UI.
- Share-link UI.
- Templates and onboarding.
- Error boundaries and graceful fallback UI.
- Tests and E2E flows.

---

## 3. Shell contract

The product must remain a single editor application.

Canonical path:

```txt
apps/graph/app/layout.tsx
apps/graph/app/page.tsx
apps/graph/components/editor/EditorShell.tsx
apps/graph/components/layout/TopToolbar.tsx
apps/graph/components/viewport/
```

Rules:

- Do not create a second editor shell.
- Do not create a second production toolbar.
- Do not replace `EditorShell` with a new wrapper unless the old one is removed and all behavior is preserved.
- Add project, share, export, template, and recovery UI through the existing shell/chrome.
- Preserve graph mode switching between 3D and 2D.
- Preserve responsive rails, bottom panel behavior, and keyboard shortcuts unless intentionally modified with tests.

---

## 4. Store ownership contract

### 4.1 `apps/graph/store/graphStore.ts`

Owns live scene and graph interaction state.

Allowed:

- Current scene objects.
- Object CRUD.
- Visibility and color.
- Scene editing actions.
- Current tools and probes where already modeled.
- Sketch state where already modeled.
- Viewport or graph mode only where already modeled.

Not allowed:

- Durable project database.
- Autosave repository implementation.
- IndexedDB logic directly inside store actions.
- Telemetry transport.
- Undo stack storage.
- Editor layout persistence if already owned by `editorStore`.

### 4.2 `apps/graph/lib/store/editorStore.ts`

Owns editor chrome and layout.

Allowed:

- Rails.
- Panels.
- Collapsed states.
- Layout sizes.
- Current editor UI mode where already modeled.
- Durable editor preferences.

Not allowed:

- Full scene documents.
- Durable named projects.
- Autosave snapshots.
- Scene migration state.

### 4.3 `apps/graph/lib/store/historyStore.ts`

Owns undo/redo snapshots for editing sessions.

Allowed:

- Undo stack.
- Redo stack.
- Scene snapshots for local editing history.

Not allowed:

- Autosave.
- Project version history.
- Recovery storage.
- Import cache.
- Share-link state.

When loading a project, importing JSON, opening a template, or opening a share link, the implementation must explicitly decide whether history is cleared, seeded, or preserved.

---

## 5. Scene lifecycle contract

All scene input/output must use one canonical pipeline:

```txt
live graphStore scene
  -> serializeScene
  -> validate serialized document
  -> apply schema version
  -> persist/export/share
```

All external scene input must use the reverse pipeline:

```txt
incoming payload
  -> parse
  -> validate envelope
  -> migrate if older version
  -> validate migrated document
  -> deserializeScene
  -> replace current scene through graphStore action
  -> update history intentionally
```

Rules:

- Do not bypass `serializeScene` or `deserializeScene`.
- Do not create separate JSON formats for projects, share links, and exports.
- Do not load external scenes directly into store internals.
- Do not allow malformed documents to partially mutate the current scene.
- Do not silently drop unsupported fields unless a migration explicitly documents that behavior.

---

## 6. Rendering contract

### 6.1 3D

Canonical location:

```txt
apps/graph/lib/graph3d/
apps/graph/components/viewport/
```

Rules:

- Do not create a parallel Three.js engine.
- Extend existing graph object builders and sync paths.
- Dispose Three.js resources when replacing geometry or removing objects.
- Keep object signatures stable so unnecessary rebuilds are avoided.
- Heavy rendering must have guardrails and warning paths.

### 6.2 2D

Canonical location:

```txt
apps/graph/components/graph/Graph2DCanvas.tsx
apps/graph/graph2d/
```

Rules:

- Do not create a second 2D graph canvas.
- Extend existing draw helpers, range formatting, interaction, and overlay behavior.
- Preserve wheel zoom, pan, coordinate overlays, probes, and accessibility.
- Any export path should reuse renderable scene helpers where practical.

---

## 7. Math and expression contract

Canonical location:

```txt
apps/graph/lib/math/
apps/graph/lib/scene/validateScene*.ts
```

Rules:

- Do not evaluate raw user expressions outside the approved math layer.
- Do not add `eval`, `Function`, dynamic imports, or arbitrary JavaScript execution.
- Do not let math expression errors crash the editor shell.
- Add limits for expression length, sampling, recursion-like constructs, and expensive operations.
- Expression diagnostics must be actionable and tied to the field that failed.

---

## 8. Persistence contract

Project persistence must be abstracted behind a repository interface.

Recommended location:

```txt
apps/graph/lib/projects/
```

Recommended shape:

```ts
interface ProjectRepository {
  listProjects(): Promise<ProjectSummary[]>;
  getProject(id: string): Promise<ProjectDocument | null>;
  createProject(input: CreateProjectInput): Promise<ProjectDocument>;
  updateProject(id: string, patch: ProjectUpdate): Promise<ProjectDocument>;
  deleteProject(id: string): Promise<void>;
  saveRecoverySnapshot(snapshot: RecoverySnapshot): Promise<void>;
  getRecoverySnapshot(): Promise<RecoverySnapshot | null>;
  clearRecoverySnapshot(): Promise<void>;
}
```

Rules:

- Do not put IndexedDB implementation details in React components.
- Do not use undo/redo as autosave.
- Do not rely only on sessionStorage for public release.
- Do not block future remote persistence by coupling UI directly to local storage.

---

## 9. Naming and file contract

Forbidden names:

```txt
Enhanced*
Improved*
Advanced*
New*
Final*
V2*
Temp*
TestComponent*
```

Use domain names instead:

```txt
ProjectMenu
RecentProjectsDialog
SceneShareDialog
ExportSceneDialog
SceneMigrationError
ProjectRecoveryDialog
```

New files must have one clear responsibility. Do not create generic utility dumps such as `helpers.ts` unless the existing codebase already uses that pattern for the same domain.

---

## 10. Forbidden architectural deviations

Do not:

- Add a backend unless the task explicitly requires short links or server-side export.
- Add accounts or auth.
- Add organization/workspace concepts.
- Add collaboration or comments.
- Add a second scene schema.
- Add a second state management library.
- Add a second renderer for the same viewport.
- Add a second design system.
- Rewrite the editor shell to make one feature easier.
- Replace existing tests with weaker smoke tests.
