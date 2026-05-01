# AGENTS.md — Vinculum Coding Agent Entrypoint

This is the root instruction file for every AI coding agent working on Vinculum.

## Read order

Before writing code, read these files in order:

1. `project-description.md`
2. `docs/agent/00-agent-readme.md`
3. `docs/agent/instructions.md`
4. `docs/agent/planned.md`
5. `docs/agent/01-architecture-contract.md`
6. `docs/agent/02-feature-contracts.md`
7. `docs/agent/03-ui-ux-rules.md`
8. `docs/agent/04-quality-gates.md`
9. `docs/agent/05-review-checklist.md`
10. `docs/agent/06-designx-frontend-skill.md` only when the task touches UI, UX, layout, interaction design, visual design, accessibility, or responsive behavior.
11. `docs/agent/07-folder-usage-guide.md`
12. `docs/agent/08-coding-agent-prompt.md`

## Source-of-truth priority

If files conflict, use this order:

```txt
latest user request
> current codebase behavior
> project-description.md
> AGENTS.md
> docs/agent/00-agent-readme.md
> docs/agent/instructions.md
> docs/agent/01-architecture-contract.md
> docs/agent/02-feature-contracts.md
> docs/agent/planned.md
> docs/agent/03-ui-ux-rules.md
> docs/agent/06-designx-frontend-skill.md
> docs/agent/04-quality-gates.md
> docs/agent/05-review-checklist.md
```

## Non-negotiable rules

- Inspect existing implementation before creating new files.
- Extend canonical systems instead of creating duplicates.
- Do not add fake buttons, fake telemetry, fake autosave, fake exports, placeholder services, or TODO-only files.
- Do not add accounts, billing, collaboration, SaaS dashboards, or unrelated backend scope unless explicitly requested.
- Keep `packages/scene` focused on shared scene/domain types and defaults.
- Keep `apps/graph` responsible for editor behavior, UI, rendering, validation integration, storage integration, import/export, and tests.
- Use existing store ownership boundaries: `graphStore` for scene/tool state, `editorStore` for layout/editor chrome, `historyStore` for undo/redo snapshots.
- Use canonical scene serialization, validation, and migration paths for any saved, imported, exported, or shared scene data.
- Every user-facing control must work, be intentionally disabled, or not be shown.
- Every implementation must include relevant tests or state exactly why tests were not added.

## Required final report after coding

```txt
Implemented:
- ...

Files changed:
- ...

Tests added/updated:
- ...

Commands run:
- bun run lint
- bun run typecheck
- bun run test
- bun run build
- bun run test:e2e, if relevant

Known limitations:
- ...

No-deviation confirmation:
- No duplicate store created.
- No duplicate serialization path created.
- No placeholder UI added.
- No unrelated feature added.
- Existing architecture preserved.
```
