# Vinculum Agent Review Checklist

## Purpose

Use this checklist before, during, and after agent coding. It is designed to catch deviation early.

---

## 1. Before coding

- [ ] I read the latest user request.
- [ ] I read the project description.
- [ ] I read `instructions.md`.
- [ ] I read `planned.md`.
- [ ] I read `00-agent-readme.md`.
- [ ] I read `01-architecture-contract.md`.
- [ ] I read `02-feature-contracts.md`.
- [ ] I read `03-ui-ux-rules.md`.
- [ ] I read `04-quality-gates.md`.
- [ ] I identified the exact vertical slice.
- [ ] I identified the existing files that own this behavior.
- [ ] I checked for existing components, stores, validators, and utilities before creating new ones.
- [ ] I know which tests need to be added or updated.

---

## 2. Architecture check

- [ ] I did not create a second editor shell.
- [ ] I did not create a second toolbar.
- [ ] I did not create a second scene schema.
- [ ] I did not create a second serialization path.
- [ ] I did not create a second validation path.
- [ ] I did not create a second math evaluator.
- [ ] I did not create a second state management system.
- [ ] I did not put project database logic directly inside React components.
- [ ] I did not put app-specific UI logic inside `packages/scene`.
- [ ] I did not use undo/redo history as autosave or persistence.

---

## 3. Product scope check

- [ ] I did not add auth.
- [ ] I did not add billing.
- [ ] I did not add organizations or teams.
- [ ] I did not add cloud sync unless explicitly requested.
- [ ] I did not add collaboration unless explicitly requested.
- [ ] I did not add generic dashboard UI.
- [ ] I did not add marketing pages.
- [ ] I kept Vinculum focused on mathematical visualization and scene authoring.

---

## 4. UI quality check

- [ ] Every visible button works or is intentionally disabled with a clear reason.
- [ ] I did not add placeholder controls.
- [ ] I did not add fake status text.
- [ ] Dialogs have clear titles and actions.
- [ ] Error messages explain what failed and what to do next.
- [ ] Copy is concise and professional.
- [ ] I avoided exaggerated AI-style product language.
- [ ] I did not make the interface more card-heavy without need.
- [ ] I preserved existing responsive behavior.

---

## 5. Data safety check

- [ ] External input is parsed before it mutates the store.
- [ ] Invalid input does not partially change the scene.
- [ ] Destructive actions ask for confirmation.
- [ ] Scene documents include schema version where required.
- [ ] Older scenes migrate through the migration pipeline.
- [ ] Future unsupported scenes are rejected clearly.
- [ ] Autosave writes only after a real debounce and successful serialization.
- [ ] Recovery restore is explicit.

---

## 6. Expression safety check

- [ ] I did not use JavaScript `eval`.
- [ ] I did not use the `Function` constructor.
- [ ] I did not allow arbitrary JavaScript execution.
- [ ] Expression length is limited where required.
- [ ] Sampling or resolution is capped where required.
- [ ] Expression errors are field-level where practical.
- [ ] A bad expression does not crash the editor shell.

---

## 7. Performance check

- [ ] I did not add unbounded loops over user data.
- [ ] I did not recompute heavy previews on every keystroke.
- [ ] I did not add always-on expensive telemetry or HUD logic.
- [ ] Heavy scene warnings are real if added.
- [ ] Three.js resources are disposed when replaced or removed.
- [ ] Large imports/share payloads have size protection where applicable.

---

## 8. Accessibility check

- [ ] Icon buttons have accessible names.
- [ ] Toggle buttons expose state.
- [ ] Dialogs are labeled.
- [ ] Menus/dialogs close with Escape where expected.
- [ ] Primary workflows are keyboard reachable.
- [ ] Errors are not communicated by color only.
- [ ] Existing ARIA attributes were preserved.

---

## 9. Test check

- [ ] I added or updated Vitest tests for logic changes.
- [ ] I added or updated component tests for UI state changes where useful.
- [ ] I added or updated Playwright tests for user flows.
- [ ] I preserved existing smoke tests.
- [ ] I did not weaken assertions to pass tests.
- [ ] I did not skip failing tests without explanation.

---

## 10. Required command check

Run and record results:

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

Run when UI or viewport behavior changed:

```bash
bun run test:e2e
```

Run when browser-specific input/layout/render behavior changed:

```bash
bun run test:e2e:all-browsers
```

If any command cannot be run, explain exactly why.

---

## 11. Final response template for coding agent

```txt
Implemented:
- ...

Files changed:
- ...

Tests added or updated:
- ...

Commands run:
- ...

Behavior verified:
- ...

Known limitations:
- ...

Deviation check:
- No duplicate architecture added.
- No placeholder UI added.
- No unrelated product scope added.
- No unsafe expression execution added.
```
