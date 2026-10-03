# Graph stress and efficiency report

Measured locally on October 3, 2026, using a production build on port 3100.
Results apply to these workloads and this machine, not every equation or device.

## Results

No page errors or Chrome crashes occurred in the automated stress runs. Both
scenes recovered after their objects were hidden. Heavy scenes can still lag:
the optimized 24-curve 2D workload produced a 1.69-second main-thread task.

| Chrome workload | Before: longest main-thread task | After: longest main-thread task | After: p95 frame interval | Retained JS heap growth |
| --- | ---: | ---: | ---: | ---: |
| 24 2D curves, including 8 oscillating implicit relations | 1,731 ms | 1,693 ms | 483 ms | 2.78 MiB |
| 8 implicit 3D surfaces at maximum resolution, WebGL2 fallback | 1,854 ms | 857 ms | 384 ms | 9.70 MiB |

Each automated workload performs 12 alternating wheel zooms, switches away
from and back to its view three times, waits for recovery, and hides all objects
through the UI. Heap measurements use Chrome garbage collection before and
after interaction. Backing-storage growth reported by Chrome, including
typed-array/WASM storage, was 0.08 MiB for 2D and 1.80 MiB for 3D. Short runs
do not establish that the application is leak-free.

A separate native WebGPU check rendered eight detailed surfaces for five
seconds: 600 animation frames, p95 frame interval 9.1 ms, maximum 9.4 ms, and
no observed main-thread long tasks. This was a steady-state check. Native
interaction timing was inconclusive: preview automation produced an initial
scheduling gap and a subsequent evaluation failure. It is excluded from the
interaction benchmark. The isolated fixture was cleared afterward.

## Efficiency changes

- Implicit 3D fields use bounded Rust/WASM grid batches instead of crossing the
  JS/WASM boundary for every scalar sample. Existing validation, numerical
  semantics, allocation limits, and worker ownership remain intact.
- Explicit planar curves shown in 3D use one-dimensional sampling instead of a
  two-dimensional contour grid. General implicit relations retain contour
  extraction; discontinuities and display bounds remain respected.
- Planar field callbacks retain identity across appearance changes, allowing
  the existing contour-path cache to reuse results. Equation and parameter
  changes invalidate compiled results.
- Normal repair uses the current mesh indices after vertex welding. Extension
  requests use the supported resolution cap of 48.

A paired, warmed-up numerical benchmark on a 49³ grid took a median **17 ms
with Rust batches versus 46 ms with scalar calls** (about 2.7× faster). Sample
values and validity masks matched exactly. This measures field sampling, not
total mesh generation or frame time.

## Coverage and budgets

Numerical cases at maximum implicit resolution over [-5, 5]: a sphere, gyroid,
the reported equation `cos(x*y+cos(4*y))^2+sin(y)=0.4*x+0.1*y^2`, a shifted
reciprocal pole, and `sin(40*x)*sin(40*y)*sin(40*z)=0.1`. Tests check finite
coordinates, valid vertex indices, and the 750,000-triangle budget. The pole
returns an empty surface rather than a false sheet. The extreme oscillating
case stops at the geometry budget instead of returning an unsafe partial mesh.
A 769² contour grid checks 591,361 batched samples.

Browser gates require no errors/crashes, frame and main-thread gaps below
2.5 seconds, and retained JS heap and backing-storage growth below 64 MiB each.
These are regression ceilings for heavy fixtures, not smooth-animation targets.

## Reproduction

Start a production server before browser benchmarking. Avoid concurrent builds
or unit tests during timing measurements.

```sh
bun run build
bun run --filter @vinculum/graph start -p 3100
```

In another terminal:

```sh
VINCULUM_STRESS_REPORT=/tmp/vinculum-graph-stress.json bun run test graphStress.test.ts --maxWorkers=1
bun run test:e2e e2e/graph-stress.spec.ts --workers=1
```

The browser suite prints `BROWSER_GRAPH_STRESS` JSON and attaches JSON to
Playwright results. The numerical suite optionally writes the supplied report
path. Keep server, build, and browser configuration consistent between runs.

## Original verification

- `bun run lint`, `bun run typecheck`, `bun run build`: passed.
- `bun run test --maxWorkers=4`: 1,760 tests in 203 files passed.
- Chrome stress suite: 2 tests passed.
- Targeted 3D-extension and oscillating-curve browser regressions: 9 tests passed
  across Chromium, Firefox, and WebKit.
- `git diff --check`: passed.

## Remaining limits

Dense 2D contour drawing and headless WebGL2 view changes still stall. Follow-up
profiling should separate contour extraction and drawing, and reduce repeated
work during wheel interaction. Native steady-state WebGPU results do not cover
mesh rebuilds or startup. These runs do not cover hour-long sessions, GPU memory
or device-loss stress, hundreds of visible objects, or low-power devices.
This short suite alone does not establish production readiness.

## Release-check follow-up

The production editor now retains its visited Math Lab 2D and 3D viewports
across Single/Split changes. Hidden views suspend drawing; the 3D renderer is
created only on its first visit and disposed when the editor unmounts.
Canvas backing buffers are resized only when their pixel dimensions change,
and the container resize observer updates retained views when they reappear.
This uses the existing viewport, renderer, and store ownership.

Isolated Chromium runs against the production build, with one test worker and
no concurrent builds or other tests, produced these results:

| Workload | p95 frame gap | Worst main-thread task | Retained JS heap growth | Errors/crashes |
| --- | ---: | ---: | ---: | --- |
| 24 curves, zoom and 2D/3D changes | 508.5 ms | 1,656 ms | 3,972,960 bytes | None |
| 8 implicit surfaces, zoom and view changes, WebGL2 fallback | 507.9 ms | 563 ms | 1,753,796 bytes | None |
| 4 ordinary curves, 4× CPU slowdown, 120 interactions over 122.4 seconds | 9.2 ms | 58 ms | 624,796 bytes | None |

The ordinary workload also checks hide/show recovery and scene/viewport
restoration after reload. Its gates are a p95 frame gap below 200 ms, a worst
main-thread task below 500 ms, and retained JS heap and backing-storage growth
below 16 MiB each. CPU throttling is a laboratory approximation, not a test of
an actual low-power device or GPU.

The dense 2D workload includes the first 3D visit and renderer startup, so its
worst pause cannot be attributed to contour drawing alone. Both dense cases
pass their crash, memory, and recovery ceilings but remain too slow to call
smooth. The earlier native WebGPU steady-state measurement does not establish
equivalent interaction performance on all GPUs.

CI browser checks now use the production build. Performance tests run in a
separate Chromium job with one worker and no retries; JSON measurements and
failure context are retained as artifacts. Promotional screenshot/recording
scripts are excluded from functional CI, while their underlying product flows
remain covered by the functional suites.

Release checks additionally cover retained viewport lifecycle, exact-zero
contours, canvas allocation reuse, safe geometry notation, horizontal range
intervals, empty-state/zoom-control overlap, focus handoff, matrix Tab and
Shift+Tab, sheet resize visibility, and solver contrast and focus restoration.
Quad rendering reads the renderer's current logical dimensions, preventing
out-of-target scissors during responsive transitions. Resize observation
queues layout updates outside observer delivery.

The Firefox mobile-emulation group is explicitly unsupported by Playwright.
Trusted multi-touch injection uses Chromium CDP and runs only in Chromium;
WebKit still runs supported tap, sheet, and responsive workflows. These skips
are tool limits, not claims that real-device touch has been verified.

## Final release-check evidence

- Lint, type checking, and the final production build passed.
- The full unit suite passed 1,768 tests in 205 files. The 30 affected math
  notation/output unit cases also passed after the final editor fixes.
- Rust formatting, Clippy with warnings denied, and all four Rust tests passed.
- All three isolated Chromium stress/recovery cases passed, with the limits
  reported above.
- A complete 1,350-case functional browser matrix ran during repairs. A
  309-case recheck covered every failure, complete responsive and geometry
  workflows, and six new empty-state overlap cases. After the last focus and
  screenshot-fixture corrections, the final 36-case pass across Chromium,
  Firefox, and WebKit was green. A final six-case pass also verified primitive
  creation focus and drag cancellation on all three browsers. Combining the
  full run with corrected reruns
  gives passing evidence for 1,336 supported cases and 20 explicit platform
  skips; no original failure remains unresolved. This is combined coverage,
  not a second complete matrix run after the last edits.
- Workflow YAML parsing and `git diff --check` passed. CI was configured and
  validated locally; the remote GitHub Actions jobs were not executed here.

Math editing now settles the native fallback's blur before requesting
MathLive's delayed focus. Browser tests verify that a context-menu equation
can be typed immediately and that text-to-math mode switching retains focus.
Quad overlay fixtures zoom each pane before comparing the translucent tint;
the area gate still requires over 200 changed pixels, rather than accepting
only a point marker.
