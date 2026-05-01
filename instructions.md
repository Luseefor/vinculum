# VINCULUM AGENT INSTRUCTIONS

This file defines strict rules for the coding agent.

This is NOT a feature list.
This is NOT a planning document.

This is the execution rulebook.

---

# CURRENT PHASE

## ACTIVE: UI REDESIGN PHASE

The system is:
- feature complete
- architecturally stable
- ready for UI transformation

---

# CORE PRINCIPLE

Vinculum is a:

> mathematical editor / workspace

NOT:
- dashboard
- SaaS admin panel
- marketing UI

---

# UI DESIGN RULES (CRITICAL)

## 1. TOOL-FIRST DESIGN

UI must reflect:
- tools
- workflows
- interactions

NOT:
- forms
- cards
- sections

---

## 2. NO GENERIC UI

Forbidden:
- card-heavy layouts
- purple gradients
- default shadcn look
- dashboard-style UI
- decorative blobs

---

## 3. STRUCTURE OVER DECORATION

Always prioritize:
- layout hierarchy
- panel relationships
- interaction clarity

---

## 4. DENSITY IS REQUIRED

This is a tool, not a landing page.

- compact spacing
- information-rich panels
- efficient layout

---

## 5. MATCH SYSTEM ARCHITECTURE

UI must reflect:

Scene:
- objects
- measurements

Editor:
- constraints
- tools
- layout state

DO NOT invent UI that contradicts system behavior.

---

# EXECUTION RULES

## 1. NO NEW FEATURES

Forbidden:
- new tools
- new schema
- new persistence systems
- new APIs

Only:
- restructure
- refine
- improve UI

---

## 2. DO NOT BREAK SYSTEMS

Must preserve:
- scene model
- serialization/deserialization
- share links
- autosave/recovery
- export pipeline
- examples/templates

---

## 3. EXTEND, DO NOT REPLACE

- reuse existing components
- improve them
- do not rebuild everything

---

## 4. NO PLACEHOLDER UI

Everything must:
- function
- connect to real state
- reflect actual behavior

---

## 5. DEVICE-AWARE DESIGN

- desktop-first
- responsive but not stretched
- avoid oversized typography

---

# UI ARCHITECTURE TARGET

The UI must follow:

```txt
Top Bar → Mode + Tool System
Left Panel → Scene (objects + measurements)
Center → Canvas (primary)
Right Panel → Parametric Editor
Bottom Panel → Console / Diagnostics / Timeline