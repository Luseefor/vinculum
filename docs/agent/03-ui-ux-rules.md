# 03-ui-ux-rules.md — Vinculum-Specific UI/UX Rules

## Purpose

This file narrows the broad frontend/design guidance in `06-designx-frontend-skill.md` to Vinculum specifically.

Use `06-designx-frontend-skill.md` for general frontend discipline. Use this file as the Vinculum override.

## Product classification

Vinculum is a **creative/canvas mathematical editor** and **developer/research-grade graphing workspace**.

Correct design archetype:

```txt
Canvas Workspace + Editor Shell
```

Expected structure:

```txt
top toolbar
left object browser / scene hierarchy
center 3D or 2D viewport
right inspector / expressions / object editing
bottom status or console panel only when useful
modal/dialog flows for import, export, recovery, templates, and destructive confirmation
```

Do not redesign Vinculum as:

- a SaaS dashboard
- a marketing landing page
- a card-based analytics product
- a generic admin panel
- a chat/agent workspace
- a file manager

## Visual direction

Vinculum should feel:

- precise
- mathematical
- technical but approachable
- viewport-first
- compact enough for serious editing
- clear under both light and dark themes

Preferred design language:

```txt
Minimal Functional + Swiss Grid + Creative Tool Workspace
```

Avoid:

- purple gradient AI SaaS styling
- huge headings inside the editor
- card spam
- decorative blobs
- fake glassmorphism
- dramatic wording such as "Command Center" or "Intelligence Hub"
- marketing copy inside editing UI

## Layout rules

The viewport is the product center. Do not let panels, cards, or banners dominate the canvas.

### Top toolbar

Use for:

- file/project actions
- graph mode switching
- import/export/share
- theme/accessibility controls
- primary scene actions

Rules:

- keep labels short
- group related controls
- close menus on Escape
- use `aria-pressed` for toggles
- do not hide core mode switching behind deep menus

### Left rail / object browser

Use for:

- scene object list
- visibility toggles
- object grouping/folders when implemented
- color indicators
- quick duplicate/delete where safe

Rules:

- object count must remain testable if existing tests depend on `data-testid="scene-object-count"`
- destructive actions require confirmation or undo
- selection state must be visible beyond color alone

### Center viewport

Use for:

- 3D viewport
- 2D graph canvas
- sketching
- probes
- visual handles
- measurements

Rules:

- preserve pan/orbit/zoom behavior
- do not overlay persistent UI that blocks editing
- overlays must be readable but lightweight
- viewport errors must show graceful fallback, not blank failure

### Right rail / inspector

Use for:

- expression editing
- object parameters
- validation errors
- constraints
- measurements
- selected-object details

Rules:

- inline diagnostics must be specific and actionable
- do not show raw parser stack traces
- debounce previews where needed
- disabled fields need clear reasons

## UI copy rules

Use direct product language:

```txt
Projects
Save
Autosave
Share
Export
Import
Templates
Objects
Inspector
Expressions
Constraints
Measurements
Timeline
Console
Settings
```

Avoid inflated labels:

```txt
Project Command Center
Graph Intelligence Hub
Scene Orchestration Layer
Mathematical Operations Nexus
Expression Control Matrix
```

Every visible sentence must help the user act, recover, or understand state. Do not add filler text.

## State requirements

Any UI added for pre-publish features must include relevant states:

```txt
loading
empty
valid
invalid
saving
saved
failed
recoverable
disabled
success
```

Examples:

- Autosave: idle, saving, saved, failed, recovery available.
- Import: idle, parsing, invalid JSON, unsupported schema, migration success, import success.
- Share link: generating, copied, too large, invalid link, outdated schema.
- Export: preparing, exported, failed, unsupported format.

## Accessibility rules

- Every toolbar button must have a label or accessible name.
- Every icon-only button must have `aria-label` and preferably tooltip text.
- Menus/dialogs must close on Escape where safe.
- Dialogs must trap focus and return focus to trigger.
- View mode toggles must expose selected/pressed state.
- Keyboard users must be able to operate toolbar, object browser, dialogs, and inspector.
- Reduced motion must be respected.
- Color must not be the only status indicator.

## Responsive rules

Desktop is primary, but tablet and small laptop layouts must not break.

Required behavior:

```txt
wide desktop      persistent rails are acceptable
small desktop     rails may collapse or resize
tablet            rails collapse into drawers/sheets as needed
small mobile      editing can degrade, but navigation must remain coherent
```

Do not design a screenshot-only fixed-width interface.

## Component rules

- Use existing UI primitives when available.
- Use dialogs/sheets/popovers consistently with current codebase patterns.
- Do not wrap every section in cards.
- Use compact controls for editor workflows.
- Prefer split panes, rails, inspectors, menus, and status bars over dashboard cards.
- Keep object/tool state visually close to the viewport.

## Frontend implementation rules

- Do not leave dead buttons.
- Do not add UI before the underlying behavior exists.
- Do not add large animation libraries for small transitions.
- Do not introduce new global styling systems unless replacing the old one deliberately.
- Do not use hardcoded dimensions where responsive, token-based sizing is needed.
- Preserve existing tests and add tests for new dialogs, toggles, and flows.
