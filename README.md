# Vinculum

Vinculum is an interactive math visualization and sketching editor. You can author mathematical scenes (implicit surfaces, planes, and parametric curves) and explore them in 2D and 3D in a single editor.

## Core features

- Interactive 3D mathematical visualization (Three.js)
- 2D plotting / sketching canvas
- Scene objects:
  - Surfaces (implicit equations)
  - Planes
  - Parametric curves (x(t), y(t), z(t))
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
- Optional performance HUD (off by default)

## Developer quickstart

### Setup

From the repo root:

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

This project is licensed under the [MIT License](LICENSE).
