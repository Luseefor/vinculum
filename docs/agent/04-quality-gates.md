# 04-quality-gates.md — Vinculum Quality Gates

## Purpose

This file defines what must be true before an implementation is considered complete. A coding agent must not treat visual completion as real completion.

---

## 1. Required commands

Run from the repository root unless the existing scripts require a package directory.

Minimum gate:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

E2E gate when UI flows, persistence, import/export, share links, templates, graph mode, toolbar, dialogs, or viewport behavior changed:

```bash
bun run test:e2e
```

Full browser matrix when a change touches low-level viewport input, canvas rendering, pointer behavior, keyboard behavior, layout, or CI config:

```bash
bun run test:e2e:all-browsers
```

If a command cannot be run, the final report must say why.

---

## 2. Feature-specific test requirements

### Scene schema and migration

Required tests:

- Current document validates.
- Legacy document migrates.
- Future version rejects.
- Corrupt JSON rejects.
- Invalid object rejects.
- Failed import does not mutate current scene.

### Project persistence

Required tests:

- Create project.
- List recent projects.
- Load project.
- Rename project.
- Delete project.
- Autosave debounce.
- Recovery snapshot restore.
- Recovery snapshot discard.

### Share links

Required tests:

- Valid scene encodes and decodes.
- Invalid payload rejects.
- Oversized scene shows fallback.
- Old version migrates.
- Future version rejects.
- Opening link updates scene only after successful validation.

### Import/export

Required tests:

- JSON export includes schema version.
- JSON import validates.
- Invalid JSON shows clear error.
- Invalid schema shows clear error.
- PNG export produces real image output where testable.

### Templates

Required tests:

- Every template validates.
- Every template deserializes.
- Opening template updates scene object count.
- Replacing non-empty scene requires confirmation.

### Math input and expression safety

Required tests:

- Valid expression compiles.
- Invalid expression produces diagnostic.
- Unsupported/dangerous expression rejects.
- Overlong expression rejects.
- Heavy sampling is capped or warned.
- One bad expression does not crash the editor.

### Error handling

Required tests:

- Error boundary catches component failure.
- Viewport/render failure shows fallback UI.
- Import failure leaves current scene untouched.
- Telemetry no-op mode does not send remote calls.

### Accessibility

Required tests:

- New controls have accessible names.
- Toggle state is exposed for toggles.
- Dialogs have labels/titles.
- Escape closes menus/dialogs where implemented.
- Keyboard path exists for primary action.

---

## 3. CI expectations

The existing CI must remain valid:

- Bun install with frozen lockfile.
- Lint.
- Typecheck.
- Vitest.
- Production build.
- Production server smoke.
- Playwright browser matrix.

Do not weaken CI to make a feature pass. If CI needs to change, explain why and preserve or improve coverage.

---

## 4. No-regression checks

Before finalizing, verify that these existing flows still work:

- App loads into editor.
- 3D mode is default if currently expected.
- 2D mode toggle works.
- Object count badge still updates.
- New scene confirmation still works when objects exist.
- Theme menu still works.
- Sketch flow still creates/updates object count if already supported.
- JSON import/export still works.
- Undo/redo still behaves correctly after scene edits.

---

## 5. Code quality gate

Implementation must avoid:

- `any` where a real type is available.
- Swallowed errors.
- Silent data loss.
- Duplicate state sources.
- Circular dependencies.
- Large components with mixed unrelated responsibilities.
- New dependencies without clear need.
- Unused files, exports, hooks, or services.
- TODOs in production paths.

Acceptable TODOs only when they document a real future milestone and do not represent missing behavior in the current feature.

---

## 6. Data safety gate

Before merging persistence, import, share, or migration features, confirm:

- Invalid external data cannot partially mutate the current scene.
- User can cancel destructive actions.
- Existing local/session data is handled intentionally.
- Schema migration is deterministic.
- Unsupported future versions are rejected.
- Oversized inputs are blocked or handled safely.

---

## 7. Performance gate

Before merging render, expression, import, export, or template changes, confirm:

- No unbounded loops over user-controlled data.
- No unbounded math sampling.
- No preview recalculation on every keystroke without debounce.
- Heavy scene warning appears where required.
- Render resources are disposed when no longer used.
- Large imported payloads are rejected before they freeze the UI where possible.

---

## 8. Accessibility gate

Before merging UI changes, confirm:

- Keyboard path exists.
- Focus is not trapped accidentally.
- Focus is trapped intentionally in dialogs.
- Screen-reader labels exist.
- Color is not the only signal for errors.
- Reduced motion does not break critical flow.
- High contrast is not made worse.

---

## 9. Done definition

A feature is done only when:

- It is implemented as real behavior.
- It uses canonical architecture.
- It has tests.
- It has graceful error handling.
- It has accessible UI where applicable.
- It passes required commands or reports why they could not run.
- It does not add unrelated scope.
