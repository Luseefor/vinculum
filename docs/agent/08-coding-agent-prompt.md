# 08-coding-agent-prompt.md — Prompts to Use While Coding Vinculum

Use these prompts when assigning work to a coding agent. Replace bracketed text with the actual task.

## General implementation prompt

```txt
You are working in the Vinculum repo.

Before coding, read AGENTS.md, project-description.md, and all files under docs/agent/ in the required order.
Use the current codebase as the source of truth when implementation details differ from the docs.

Task:
[Describe one vertical slice only.]

Constraints:
- Do not create duplicate stores, duplicate scene serialization, duplicate validators, duplicate toolbar/dialog systems, or placeholder services.
- Do not add fake UI, fake telemetry, fake exports, fake autosave, or TODO-only implementations.
- Reuse existing Vinculum architecture: @vinculum/scene for shared scene/domain types, apps/graph for editor behavior and UI.
- Preserve graphStore, editorStore, and historyStore ownership boundaries.
- Validate saved/imported/exported/shared scenes through canonical scene validation and migration.
- Add or update tests for the changed behavior.

Before editing:
1. List the existing files you inspected.
2. Identify the canonical owner files for this feature.
3. State the smallest complete vertical slice.

After editing, report:
- Implemented
- Files changed
- Tests added/updated
- Commands run
- Known limitations
- No-deviation confirmation
```

## Feature-specific prompt: schema migration

```txt
Implement the next schema-versioning slice from planned.md.

Read AGENTS.md and docs/agent first.
Inspect existing scene serialization, validation, import, export, and store hydration code.
Add schema versioning and migration only through the canonical scene path.
Do not create a parallel scene format.
Do not apply invalid imported scenes to graphStore.
Add unit tests for valid, invalid, legacy, future-version, and malformed scenes.
```

## Feature-specific prompt: named projects and autosave

```txt
Implement the named project and autosave slice from planned.md.

Read AGENTS.md and docs/agent first.
Inspect graphStore persistence, editorStore persistence, historyStore behavior, serializeScene, deserializeScene, and existing dialogs.
Create a local project persistence layer without duplicating scene serialization.
Autosave must be debounced, validated before write, and recoverable after reload/crash.
Add UI only where it has working behavior.
Add tests for create, save, load, rename, delete, autosave restore, autosave discard, and corrupted recovery data.
```

## Feature-specific prompt: shareable links

```txt
Implement the shareable scene link slice from planned.md.

Read AGENTS.md and docs/agent first.
Inspect scene serialization, validation, migration, import dialogs, and toolbar actions.
Encode only canonical serialized scene documents.
Decode, validate, and migrate before applying to graphStore.
Add invalid-link and oversized-link fallback UI.
Do not add a backend short-link service unless explicitly requested.
Add tests for encode/decode, invalid payload, oversized payload, outdated schema, and future schema.
```

## Feature-specific prompt: export polish

```txt
Implement the export pipeline slice from planned.md.

Read AGENTS.md and docs/agent first.
Inspect existing JSON import/export, Graph2DCanvas, Viewport3D, and toolbar export actions.
Create or extend one canonical export service.
Support JSON and PNG first. Add SVG only if it fits the existing 2D rendering path safely.
Every export action must have success and failure states.
Do not create fake export buttons.
Add tests for JSON roundtrip, invalid import, and export request validation.
```

## UI/frontend prompt

```txt
You are changing Vinculum UI.

Before coding, read:
- AGENTS.md
- project-description.md
- docs/agent/00-agent-readme.md
- docs/agent/instructions.md
- docs/agent/03-ui-ux-rules.md
- docs/agent/06-designx-frontend-skill.md
- docs/agent/04-quality-gates.md
- docs/agent/05-review-checklist.md

Design constraints:
- Vinculum is a canvas/editor tool, not a card dashboard.
- Use editor-shell patterns: top toolbar, left object browser, central viewport, right inspector, bottom/status panels only when useful.
- Do not add generic SaaS UI, decorative cards, oversized typography, or dramatic labels.
- Every control must have real behavior or be intentionally disabled.
- Preserve keyboard access, focus behavior, aria semantics, reduced motion, and responsive behavior.

Task:
[Describe the UI slice.]

After coding, report state coverage: loading, empty, error, disabled, success, and recovery states where relevant.
```

## Bugfix prompt

```txt
Fix this Vinculum bug:
[Describe bug and reproduction.]

Before coding, read AGENTS.md and the relevant docs/agent files.
Reproduce or reason from the existing tests.
Make the smallest safe fix.
Do not refactor unrelated systems.
Add a regression test.
Report the root cause, changed files, tests, and commands run.
```

## Review prompt

```txt
Review this change against Vinculum agent docs.

Check for:
- duplicate systems
- placeholder UI
- broad rewrites
- wrong store ownership
- scene validation bypasses
- missing migration path
- untested import/export/share behavior
- accessibility regressions
- UI copy bloat or generic SaaS design
- missing quality gates

Return:
1. Blockers
2. Important issues
3. Minor issues
4. Required fixes before merge
5. Whether the change follows AGENTS.md and docs/agent
```
