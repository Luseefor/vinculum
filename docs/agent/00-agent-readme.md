# 00-agent-readme.md — Vinculum Agent Operating Manual

## Purpose

This is the first detailed document a coding agent must read after `AGENTS.md`. It defines how to work inside Vinculum without drifting from the existing architecture or producing unfinished implementation.

Vinculum is a Bun workspaces monorepo. The main product is `@vinculum/graph` in `apps/graph`, a Next.js 14 App Router editor for interactive 3D mathematical visualization and 2D plotting/sketch authoring. Shared scene/domain types live in `@vinculum/scene` under `packages/scene`.

## Current product boundaries

Vinculum is:

- a mathematical scene editor
- a 3D visualization workspace
- a 2D plotting and sketch-authoring canvas
- a scene serialization/import/export system
- a local-first project authoring tool until backend scope is explicitly introduced

Vinculum is not currently:

- a generic CAD suite
- a cloud collaboration platform
- an account-based SaaS dashboard
- a billing/team/admin product
- a chat or AI workspace
- a marketing website

## Canonical repository areas

Before adding any file, inspect the relevant area:

```txt
apps/graph/app/                 Next.js App Router shell
apps/graph/components/editor/   main editor shell and workspace composition
apps/graph/components/layout/   top toolbar and app chrome
apps/graph/components/viewport/ viewport mounting and mode wiring
apps/graph/components/graph/    Graph2DCanvas and canvas-facing UI
apps/graph/graph2d/             2D graph rendering helpers
apps/graph/lib/graph3d/         Three.js engine, mesh/line sync, input, probes
apps/graph/lib/math/            expression compilation, sampling, sketch fitting
apps/graph/lib/scene/           scene schema, validation, serialization, commands
apps/graph/lib/store/           editor UI/layout state
apps/graph/store/               graph scene/tool/dialog state
packages/scene/                 shared scene object types and defaults
apps/graph/test/                unit/integration tests
apps/graph/e2e/                 Playwright tests
```

## Required reading order for a task

Use this reading order:

```txt
1. project-description.md
2. AGENTS.md
3. docs/agent/00-agent-readme.md
4. docs/agent/instructions.md
5. docs/agent/planned.md
6. docs/agent/01-architecture-contract.md
7. docs/agent/02-feature-contracts.md
8. docs/agent/03-ui-ux-rules.md if UI is touched
9. docs/agent/06-designx-frontend-skill.md if UI/design is touched
10. docs/agent/04-quality-gates.md
11. docs/agent/05-review-checklist.md
12. docs/agent/07-folder-usage-guide.md if file placement is unclear
13. docs/agent/08-coding-agent-prompt.md for report format and reusable prompts
```

## Implementation protocol

### 1. Inspect first

Identify the existing owner files for the requested feature. Do not create a new feature folder until you have verified no canonical owner already exists.

### 2. Choose one vertical slice

Implement one complete slice at a time.

Good:

```txt
Add schema version parsing, migration result types, import validation errors, and unit tests.
```

Bad:

```txt
Add projects, share links, onboarding, telemetry, export, and security all together.
```

### 3. Implement real behavior

A feature is complete only when the user-facing path works and the failure path is safe. Do not add visual-only UI or empty service layers.

### 4. Preserve current architecture

Reuse existing stores, validators, serialization helpers, dialogs, toolbars, render paths, and tests. Create abstractions only where the planned feature requires a stable boundary.

### 5. Validate before claiming completion

Run the relevant quality gates. If a command cannot run, explain why and state the nearest validation performed.

## Stop conditions

Stop and ask the user only when:

1. The request requires new product scope such as accounts, backend storage, cloud sync, collaboration, billing, or auth.
2. Two competing canonical implementations exist and the correct one cannot be inferred.
3. A data-loss migration choice is unsafe or unclear.
4. A required dependency, API key, or external service is missing.

Do not stop for ordinary naming, styling, file organization, or implementation details. Make the best disciplined decision.

## Definition of no deviation

Work has not deviated when:

- the change fits the existing monorepo boundaries
- the scene document path uses canonical validation, serialization, and migration
- store ownership is preserved
- every UI control has real behavior
- tests cover the changed path
- no unrelated product scope is added
- no broad rewrite is introduced without a necessary reason
