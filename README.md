# Vinculum

Vinculum is a local-first mathematical visualization and sketching editor.
Author equations, curves, surfaces, fields, and geometric objects, then explore
them in 2D and 3D in one workspace.

## Core features

- Interactive 3D mathematical visualization (Three.js)
- 2D plotting / sketching canvas
- Scene objects:
  - Automatic Cartesian equations and planar relations
  - Explicit, implicit, and parametric surfaces
  - Planes
  - 2D and 3D parametric curves
  - Points, vectors, lines, rays, and segments
  - 2D and 3D vector fields and linear transformations
- Bounded numerical geometry, calculus, and field analysis
- Save/load named projects (local to your browser)
- Autosave and recovery for in-progress work (local to your browser)
- Shareable scene links (URL-encoded scene payload with a size guard)
- Export:
  - Export Scene JSON
  - Export current 2D view as PNG
  - Export current 2D view as SVG (where supported)
  - Export current 3D viewport as PNG
- Examples and welcome flow (open example scenes / start blank)
- Math expression safety (limits + validation before evaluation)
- Expression diagnostics and debounced preview updates
- Optional performance HUD in Appearance (off by default)

## Developer quickstart

### Setup

Use Node 26 (see `.node-version`), Bun 1.4.3 and rustup. From the repo root:

```bash
bun install
rustup show # installs the pinned Rust toolchain and WASM target
```

### Run the app

```bash
bun run dev
```

### Validation

```bash
bun run audit:release
bun run check:public-source
bun run lint
bun run typecheck
bun run test
bun run build
bun run test:rust
```

### E2E validation

```bash
# Fast local check (Chromium)
bun run test:e2e

# Full local browser matrix
bun run test:e2e:all-browsers
```

## Computation and rendering migration

React continues to own the editor UI, scene stores, persistence, and history.
Real numeric expressions execute in the Rust/WASM core in both the main thread
and existing compute workers. Vector-field grids are sampled inside WASM.
`bun run dev` and `bun run build` regenerate the embedded WASM artifact; after
editing Rust while the dev server is running, run `bun run build:wasm`.

The 3D engine uses Three.js WebGPURenderer and node-based grid materials, with
WebGL2 fallback when WebGPU is unavailable. Initialization, device loss, disposal,
and PNG capture use the existing viewport and export paths.

This is the first migration stage: mathjs still parses and differentiates
expressions and performs symbolic algebra; mesh construction, integration, and
other sampling algorithms remain TypeScript. The 2D view remains Canvas2D.
These boundaries are explicit so the next Rust and GPU ports can preserve the
existing mathematical results and scene format.

## User documentation

- [Getting started](docs/user/getting-started.md)
- [Features](docs/user/features.md)
- [Limits](docs/user/limits.md)

## Contributing and architecture

- [Contributor setup and checks](CONTRIBUTING.md)
- [Repository and math folder layout](docs/development/repository-layout.md)
- [Adding graph and object types](docs/development/object-types.md)
- [Core engine architecture](docs/architecture/core-engine.md)
- [Public-release review and remaining gaps](docs/reports/public-release-review.md)

The main app is `apps/graph`; shared domain types are in `packages/scene`.
`apps/video` is an optional showcase workspace. Neither it nor an analytics
account is required to run the editor.

## Changelog and roadmap

- [Changelog](CHANGELOG.md)
- [Roadmap](ROADMAP.md)

## Privacy

Vinculum may collect product usage analytics when PostHog environment variables are configured (`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`). Analytics are disabled by default and require explicit configuration. When enabled, only safe metadata is tracked (such as button clicks, feature usage, and object counts). The following data is **never** tracked:

- Mathematical expressions or equations
- Scene JSON or full scene data
- Project names
- Personal information
- Raw error stacks or URLs

To disable analytics, simply omit the `NEXT_PUBLIC_POSTHOG_KEY` environment variable.

## License

[MIT](LICENSE). See [third-party notices](THIRD_PARTY_NOTICES.md) for adapted
source and bundled math fonts. Project-owned media is also MIT; ownership and
hashes are recorded in the [media inventory](docs/reports/media-provenance.json).
Dependencies retain their original licenses.

For a public repository without historical local logs, follow the
[isolated public-repository workflow](docs/development/public-release.md).
