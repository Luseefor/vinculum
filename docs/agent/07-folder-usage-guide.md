# 07-folder-usage-guide.md — Where to Put These Files and How to Use Them

## Recommended setup

Create one agent documentation folder inside the repository:

```txt
vinculum/
  AGENTS.md
  project-description.md
  docs/
    agent/
      00-agent-readme.md
      instructions.md
      planned.md
      01-architecture-contract.md
      02-feature-contracts.md
      03-ui-ux-rules.md
      04-quality-gates.md
      05-review-checklist.md
      06-designx-frontend-skill.md
      07-folder-usage-guide.md
      08-coding-agent-prompt.md
```

Use this exact placement unless your coding tool requires a different convention.

## Why this structure

- `AGENTS.md` at root gives coding agents an immediate entrypoint.
- `project-description.md` at root keeps the current architecture visible.
- `docs/agent/` keeps the detailed rulebook together.
- The numbered files create deterministic reading order.
- The split prevents one enormous instruction file from becoming impossible to maintain.

## Should you use all files or only some?

Use **all files** for serious work.

Use a smaller subset only for very small edits.

### Always include

```txt
AGENTS.md
project-description.md
docs/agent/00-agent-readme.md
docs/agent/instructions.md
docs/agent/planned.md
docs/agent/04-quality-gates.md
docs/agent/05-review-checklist.md
```

### Include for architecture or feature work

```txt
docs/agent/01-architecture-contract.md
docs/agent/02-feature-contracts.md
```

### Include for frontend, layout, UI, UX, accessibility, or responsive changes

```txt
docs/agent/03-ui-ux-rules.md
docs/agent/06-designx-frontend-skill.md
```

### Include when assigning work to an AI coding agent

```txt
docs/agent/08-coding-agent-prompt.md
```

## Do not scatter these files

Avoid this:

```txt
apps/graph/agent-notes.md
packages/scene/coding-rules.md
docs/design.md
random-plan.md
```

That causes agents to miss rules and invent behavior.

Use one root entrypoint and one docs folder.

## How to update the docs

When the codebase changes, update docs in this order:

1. `project-description.md` for actual architecture changes.
2. `01-architecture-contract.md` for ownership boundaries.
3. `02-feature-contracts.md` for feature-level expectations.
4. `planned.md` for todo status and implementation order.
5. `04-quality-gates.md` if commands/tests/CI change.
6. `03-ui-ux-rules.md` if the product UI language changes.

Do not update only `planned.md` when architecture changes. Plans must follow architecture, not replace it.

## File naming rule

Do not create new instruction files unless the concern is genuinely new.

Allowed future additions:

```txt
09-backend-contract.md          only if backend APIs are introduced
10-collaboration-contract.md    only if realtime collaboration is introduced
11-plugin-contract.md           only if plugin architecture is introduced
12-release-checklist.md         only if release management becomes separate from QA
```
