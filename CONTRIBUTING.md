# Contributing to Vinculum

Vinculum is a local-first mathematical editor. The graph application, scene
types, and optional showcase video have separate ownership boundaries.

Start with the [repository layout](docs/development/repository-layout.md) and
[object-type integration guide](docs/development/object-types.md). Coding agents
must also follow [AGENTS.md](AGENTS.md). The current release review is in
[public-release-review.md](docs/reports/public-release-review.md).

## Setup

Use Node 26 (`.node-version`), Bun 1.4.3 (`packageManager`) and rustup.
The upgraded jsdom test dependency requires Node 22.22.2+, 24.15+ or 26+.
CI selects Node 26 explicitly. Run from the repository root:

```sh
bun install --frozen-lockfile
rustup show
bun run dev
```

The Rust toolchain and `wasm32-unknown-unknown` target are pinned in
`rust-toolchain.toml`. Development and production builds regenerate the WASM
module and copy math-editor fonts from installed dependencies. Do not edit the
generated `apps/graph/lib/math/runtime/rustMathArtifact.ts` by hand.

## Changes and verification

Keep each change focused. Preserve the canonical scene validation, migration,
serialization, stores, and renderers. Explain user-visible behavior and test
coverage in the pull request. Include a regression test for a bug fix.

```sh
bun run audit:release
bun run check:public-source
bun run test:release-scripts
bun run lint
bun run typecheck
bun run test
bun run build
bun run test:rust
```

For viewport or editor workflows, install Chromium with
`bun run --filter @vinculum/graph test:e2e:install` and run `bun run test:e2e`.
Use `bun run test:e2e:all-browsers` for browser-sensitive input or rendering.
Browser runs use one worker because live canvases share a GPU process; numerical
assertions, pixel thresholds and timing budgets stay unchanged.
Build, typecheck, and browser-server runs must be sequential: Next.js updates
the shared `.next` directory during builds.

Vitest uses two workers to bound DOM/math contention without changing test
assertions or timeouts. Tests live under `apps/graph/test/<domain>/`; shared DOM setup remains in
`test/setup.ts`. For focused runs:

```sh
bun run --filter @vinculum/graph test test/objects/objectTypeIntegration.test.ts
bun run --filter @vinculum/graph test:e2e e2e/rendering-view-parity.spec.ts
```

Keep credentials, local agent transcripts, browser reports, and raw captures
out of commits. Commit source changes and the relevant lockfile together.

## License

Vinculum source is licensed under [MIT](LICENSE). Dependencies and any
third-party media retain their own licenses; keep their required notices when
redistributing them.
