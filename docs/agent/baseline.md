# Baseline record — v0.5.1 S0 (verified)

Date: 2026-09-21 (overnight session)
Branch: `v0.5.1`
Scope: test-environment-only storage shim in `apps/graph/test/setup.ts`. Production code untouched.

## Gate results

- `bun run test`: 61 files passed, 248 tests passed, 0 failed
- `bun run typecheck`: pass (exit 0)
- `bun run lint`: pass, no warnings or errors
- `bun run build`: pass (exit 0)
- E2E (Playwright) not run: S0 changed only the Vitest setup file; no UI, viewport, persistence, import/export, or production code changed.

## Prior state (pre-S0)

- 39 failed tests across 10 files, all caused by `window.localStorage` being `undefined` under Bun + Vitest + jsdom (diagnosis: S0-U2 CONFIRMED).
- `sessionStorage` exists natively in this environment and is preserved, not replaced.

## Environment notes

- Benign Bun runtime notice during tests: `ExperimentalWarning: localStorage is not available because --localstorage-file was not provided`. Runtime noise only; the setup-file shim supplies test-environment storage.
- Each test file runs in a fresh jsdom environment; storage shims are per-file instances. Tests self-clear storage in `beforeEach`.
