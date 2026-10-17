# Public repository and 2D/3D review

Reviewed 2026-10-16 on `v0.5.1`, including the existing uncommitted equation,
geometry, rendering, and UI work, with follow-up fixes and validation through
2026-10-17. This is a code and validation review, not a claim that every numerical
case or security issue has been exhaustively tested.

The latest follow-up removes the final advisory-producing tooling chain entirely
and refreshes dark appearance. Earlier patched-advisory results below are
historical; see the final section for the current zero-advisory checks.

## Release findings

### Fixed [P1]: guard hydration subscriptions when session storage is unavailable

`apps/graph/store/graphStore.ts` previously called `useGraphStore.persist.onHydrate`
at module scope. Zustand does not expose `persist` when its storage factory
cannot obtain `sessionStorage`. Importing this store in Bun without a storage
shim previously threw before the editor could render; the same path affected server runtimes
without Web Storage and browsers whose storage getter throws. The existing
shell hydration effect already guards this case, but these new subscriptions
bypassed that guard. Both subscriptions now register only when the persistence
API exists. Regression tests cold-import the real store with missing storage
and with a throwing storage getter, then create, parameterize, serialize, and
remove an equation in memory. A separate test checks normal saved-parameter
hydration, so the fallback does not disable recovery when storage is available.
The browser regression also caught an unguarded `rehydrate()` call in
`components/theme/ThemeSync.tsx`; it now uses the same persistence-availability
guard and still hydrates theme, accent, and density preferences.

A final recovery probe reproduced stale parameter snapshots after failed reads
or malformed session JSON: Zustand does not fire its completion listeners on
those failures. The existing JSON-storage adapter now treats synchronous read
and parsing failures as an empty session and lets normal hydration finish.
Denied writes/removals are contained so editing stays usable in memory, with
a single generic warning. Six real-module cases cover unavailable storage,
normal recovery, failed reads, corrupt JSON and denied writes, including
`hasHydrated()` and canonical parameter round trips. The browser corrupt-session
case also checks that validated autosave resumes before sharing.

### Fixed [P2]: preserve automatic-equation validity when changing the output axis

`apps/graph/store/graphStoreSliceObjectsExpr.ts` previously rewrote an assignment's
left-hand axis while retaining `kind: "surface"` and `autoExpression: true`.
Create `z=x^2+y^2` through automatic equation entry, then call the store's
`updateSurfaceOrientation(id, "x")` action: the stored equation becomes
`x=x^2+y^2`. Canonical validation identified a
2D relation and rejected the surface with “does not match its automatically
detected equation type.” Project saving and canonical import rejected
the scene; outbound sharing/JSON paths now also validate explicitly. A manual output-axis override now preserves the explicit surface
and clears `autoExpression`, rather than claiming the equation is still inferred.
Its identity, appearance, domain, sampling, and follow-view preference remain
intact. All three output axes have regression coverage through canonical JSON,
share-link, and local-project round trips. Automatic classification remains
available through the existing automatic equation entry action.

The original report described the action as a direct inspector workflow.
That was too broad: the current automatic-equation inspector hides the
output-axis selector with its explicit-definition controls. The store API
still accepted the invalid transition and is now guarded. Tests cover the
real API transition and existing manual-surface UI separately; no control
was added to expose that transition.

Both findings were originally reproduced with the real modules before the fixes.
The follow-up changes use the existing stores and scene I/O; they do not introduce
a storage substitute, a new scene format, or an equation-classification bypass
for automatically inferred objects.

### Dependencies remediated; final advisory removed

The initial audit returned 110 records across 21 names (2 critical, 48 high,
47 moderate, 13 low). These were lockfile advisory records, not independently
verified deployed vulnerabilities. The remediation upgrades Next.js to 15.5.28,
React and its types to 19, mathjs to 15.2.0 or later, the test tooling, analytics
client and aligned Remotion packages. The home route awaits `searchParams`
under the [Next.js 15 contract](https://nextjs.org/docs/app/guides/upgrading/version-15).
CI pins Node 26 and Bun 1.4.3 to match the tested toolchain; jsdom 30 requires
a recent Node release. The framework version follows the upstream
[October 14 security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026).
PostCSS and selector-parser overrides select patched releases; both application
CSS and the optional video bundle are validated.

The intermediate remediation retained one high `braces@3.0.3` record behind a
verified local recursion patch. The final follow-up removes that dependency:
Tailwind 4 replaces Tailwind 3 in both workspaces, and the pinned Next lint
plugin's directory discovery uses `tinyglobby` with an explicit compatibility
patch. `braces`, `micromatch`, `fast-glob`, and Chokidar are absent from the
resolved lockfile. Raw `bun audit --json` now returns `{}` and exits zero.
`audit:release` now rejects every advisory, without exceptions. Ten release-script
tests cover installed Next lint behavior, audit failures and safe source export.
See [dependency maintenance and release commands](../development/public-release.md).

### 3D idle work reduced; responsiveness validation

The engine formerly submitted the entire scene every animation frame even when
nothing changed. It now keeps polling state and asynchronous workers, but
submits GPU/label work only after input, camera damping, resize, theme, scene,
parameter, view, overlay or worker-result changes. Geometry synchronization
also invalidates a frame, including delayed follow-view resampling. Capture
forces a fresh draw through the existing PNG path. Quad panes continue to share
one engine and root. Sampling density, numerical algorithms and test budgets
are unchanged. Vitest now uses two workers by default to bound the previously
observed DOM/math contention; the default unit command passes all 2,137 tests. The optional HUD counts actual draw frames and can show zero
FPS while idle. Browser tests now use one worker locally as CI already did:
two simultaneous SwiftShader test scenes still competed for a GPU process and
one workspace-switch visibility assertion exceeded five seconds, although the
failure snapshot contained the analysis result. That two-worker attempt is
retained and is not a pass. No timeout, pixel threshold or numerical assertion
was increased or removed. The production change reduces idle draws; test-worker
isolation does not establish a parallel software-rendering performance guarantee.

The initial idle-draw change exposed an ordering assumption: differential, curl
and streamline overlays read source-node visibility before source synchronization.
The first render after unhiding could therefore omit an overlay, and an idle
viewport would not draw the corrective next frame. Source synchronization now
precedes all derived overlays. The unchanged differential-overlay restoration
check passed three consecutive software-WebGL runs after this fix; the failed
captures (845 differing pixels against the original <200 limit) remain in local
evidence. Neither the pixel threshold nor its timeout was changed.

A browser regression checks an actual stable draw counter, changed output
pixels after camera and worker edits, visibility, and orthographic zoom. The
first post-change Chromium check passed the previously failing rapid streamline
workflow in 12.6 seconds and shared curl overlay in 6.2 seconds, within their
unchanged 60-second limits. Broader final verification is recorded below.

The earlier long run and isolated reruns had deadline failures in both cases.
Other heavy checks (gyroid, plane flux, helix and glyph normalization) also showed
contention sensitivity. A later pre-remediation normal rerun passed both cases
in 19.3 and 21.6 seconds, so timing variation predates this fix. No claim is made
that idle-draw elimination is the sole cause of every previous timeout.
Headless Chromium used SwiftShader WebGL2 software rendering. A separate headed
probe confirmed `backend: webgpu`, vendor `apple`, architecture `metal-3` on this
Mac. Three repetitions each of rapid streamline edits, shared curl overlay and
idle/render invalidation passed: 9/9 cases in 37.8 seconds. The native check ran
alongside the software-WebGL suite, so it is a functional hardware check rather
than an isolated benchmark. Old failed runs, passing reruns
and incomplete forced-trace archives remain in ignored local review evidence.

### History reviewed; clean public-source workflow prepared

The current source excludes the 114 historical agent-run files; original local
copies remain ignored. A read-only scan of all blobs reachable from local refs
inspected 4,187 blobs / 251,743,043 bytes. No matches were found for the targeted
private-key, GitHub-token, AWS-access-key or OpenAI-token patterns. Machine home
paths remain in 94 historical blobs. Reflogs, unreachable objects and other
credential formats are outside that scan's scope.

`bun run check:public-source` verifies the current publication file set, including
uncommitted source, media hashes and targeted sensitive-data patterns, including
the decoded embedded WASM artifact (42,263 bytes in this build).
`bun run export:public-source .local/public-source` prepares a verified source-only
snapshot with a SHA-256 manifest and no Git history, local logs, environment
files, dependencies or build outputs. It rejects symlinks and unreviewed media.
This supports a new public repository without rewriting or publishing existing
history. Making the existing repository public would still expose historical
logs. Existing branches/remotes/history remain untouched. See the
[public source workflow](../development/public-release.md#history-and-the-public-snapshot).

### Bundled media ownership and MIT redistribution confirmed

On 2026-10-16 the owner confirmed ownership and approved MIT redistribution of
all bundled logos, screenshots, recordings and soundtracks. The
[complete source-media inventory](media-provenance.json) covers 28 files, their
SHA-256 hashes, origins and MIT terms. New or changed assets fail the publication
check until their inventory is updated after rights review. The procedural audio
scripts synthesize their waveforms; no external samples were found in those
scripts. Ownership of supplied media is based on the owner's confirmation.

Dependencies retain their licenses. Motion Primitives' adapted component keeps
its original copyright and MIT permission notice. MathLive and KaTeX notices
are retained in [third-party notices](../../THIRD_PARTY_NOTICES.md); font
preparation copies both installed package licenses alongside local fonts.

### Blank-definition document policy resolved

Every portable scene object must have a complete definition, including hidden
objects. Canonical scene validation rejects the entire document with a diagnostic
instead of silently omitting unfinished surface/parametric rows or inconsistently
accepting blank Cartesian relations. Import, named projects, validated recovery,
sharing and JSON export use this policy. Export services and the legacy JSON
dialog now validate before producing output; prior outbound serialization alone
did not guarantee validity. Live editor rows and raw session drafts remain
available until completed. No schema change or draft serialization format was
introduced. Regressions cover every kind/dimension, failed transfer, healthy
project/recovery preservation, and live draft completion.

## Object extension gaps addressed

| Finding | Change |
| --- | --- |
| Catalog keys were strings independent of creation dispatch | Derive `ObjectCreationKey` from the existing catalog; require its complete creator map at typecheck time |
| Object factories silently fell back to a surface for an unhandled future kind | Explicit surface branches and exhaustive `never` checks |
| Scene parsing silently fell back to a plane for an unhandled future kind | Explicit plane branch and exhaustive check |
| 3D assembly/guards could silently omit a future kind | Exhaustive dispatch; vector fields explicitly document their worker-only assembly route |
| Kind validation repeated the domain kind list | Export `GRAPH_OBJECT_KINDS` from shared scene types and reuse it in the existing parser |
| Revealing an extended Cartesian curve selected 2D | Respect `extendTo3D` when choosing its view; regression covers both values without changing scene data |
| Persistence hooks assumed session storage was always available | Guard store subscriptions and theme rehydration; cold-import and browser startup regressions cover the fallback |
| A manual orientation action retained automatic-classification metadata | Preserve an explicit surface with consistent metadata and follow-view preference; test all output axes through scene I/O |
| Creation tests used manually maintained subsets | Integration coverage iterates all kinds and all catalog entries, including dimensions, round trips, selection, focus, and representative rendering |
| Share-link test could begin before the lazy math editor exposed source mode | Await the real source-mode control before editing; three repeated share/recipient checks passed with unchanged data assertions and overall budget |

The existing 2D/3D parity tests also cover coordinate mapping, shared curve
samples/continuity, domains, spatial slices, implicit contours, and SVG output.
This review did not identify a reason to replace the math engine or either
renderer. A passing finite test set does not prove arbitrary equation parity.

## Intentional view differences and remaining numerical limits

- Surfaces and spatial primitives use coordinate-plane intersections in 2D.
  Curves use projections. Off-plane geometry can therefore have an empty slice.
- 2D vector fields are Canvas2D objects; 3D vector fields are spatial objects.
  Neither is silently reinterpreted in the other renderer. 3D transformation
  diagrams are also intentionally absent from Canvas2D.
- SVG reuses the real Canvas2D painters but excludes transient probes,
  measurements, selection, and analysis overlays. Use PNG for the visible canvas.
- Numerical surface/curve intersections, implicit extraction, fitting, and
  region operations have finite sampling budgets. Narrow features, tangent
  contacts, and singularities can be missed; no CAD or symbolic-proof guarantee
  is made.
- Blank authoring rows are transient and are not all valid imported objects.
  A new type must define its draft and persistence behavior explicitly.
- New types still require a complete integration across the canonical domain,
  scene, editing, renderer, worker, and export owners. The typed checks reduce
  silent omissions; they do not provide a runtime plugin system.

See the [type integration guide](../development/object-types.md) for the view
matrix and implementation sequence, and [known limits](../user/limits.md) for
the detailed numerical and browser limits.

## Organization

301 existing files were relocated: 72 math modules into nine domain folders,
222 tests into domain folders (including the former co-located compiler test),
and seven reports/instruction documents into their owning documentation areas.
All source imports, mock paths, documentation references, and the WASM generator
were updated. Shared test setup stays in `test/setup.ts`.
Public feature docs now describe actual surface slices and the optional
Performance HUD that remains available in Appearance. The roadmap distinguishes
existing measurements from future options.

The existing graphStore/editorStore/historyStore boundaries, scene format,
serialization, and renderer ownership are preserved. No compatibility copies,
duplicate stores, second renderers, placeholder controls, or new object kinds
were introduced. Existing uncommitted work was preserved.

## Earlier validation and retained failures

| Check | Result |
| --- | --- |
| Baseline lint/typecheck/unit tests | Passed; 222 files, 2,028 tests |
| `bun install --frozen-lockfile` | Passed |
| `bun run lint` | Passed |
| `bun run typecheck` | Passed |
| `bun run test` | The original unrestricted run had 2 timing-related failures in the theme/HUD test file, described below |
| `bun run test --maxWorkers=2` | Latest follow-up passed all 224 files and 2,097 tests; assertions and timeouts unchanged |
| Isolated theme/HUD unit recheck | Passed; all 4 tests |
| `bun run build` | Passed, including WASM and local font preparation |
| `bun run test:rust` | Passed; 4 Rust unit tests |
| `cargo fmt --all -- --check` | Passed |
| `cargo clippy --locked --all-targets -- -D warnings` | Passed |
| `git diff --check` | Passed |
| Original Chromium functional browser suite | Before the follow-up: all 519 selected cases exercised, 517 demonstrated passing, 2 repeated timeouts; both later passed in the normal follow-up |
| Share-link startup regression | Passed 3 consecutive repetitions after the readiness precondition |
| Focused cross-browser viewport suite | Passed; 39 cases across Chromium, Firefox, and WebKit |
| Follow-up storage/share/viewport browser suite | Passed; 21 cases across Chromium, Firefox, and WebKit |
| Follow-up normal 3D recheck | Passed both formerly failing cases; earlier deadline failures remain recorded |
| `bun audit --json` | Failed with the advisory records described above |

The original unrestricted unit rerun timed out after five seconds in the first
theme/HUD interaction test; the next test then reported duplicate controls.
All four tests in that file passed in isolation. A complete rerun with two
workers passed all 2,090 tests without modifying source, assertions, or timeout
budgets. The latest follow-up then passed all 2,097 tests with two workers.
The failed unrestricted run is retained alongside the passing reruns;
it is not presented as a clean pass. Final lint, typecheck, production build,
and Rust test reruns passed. All 301 relocation destinations and relative
documentation links were checked successfully.

Browser verification uses a separate local production server and excludes the
standalone stress/performance and media-capture jobs, matching the functional
suite filter in CI. Those isolated workloads were not remeasured for this
organization change. The initial browser attempt could not launch because
the session's default cache lacked binaries; the functional rerun uses the
already-installed matching browsers through `PLAYWRIGHT_BROWSERS_PATH`.
Interrupted segments were resumed using the exact list of previously completed
cases; interrupted cases were retained for the next segment. Original failures
and isolated reruns were preserved under ignored
`.local/release-review/2026-10-16/`. This is not a clean single-run Chromium
result: the original timing failures remain part of the evidence.

The source remains a local change for review. No commit, push, public-repository
creation, history rewrite, or deployment was performed.

## Follow-up validation of the store fixes

The follow-up adds three cold-import/hydration cases, three orientation/scene-I/O
cases, and one legacy follow-view case, plus a blocked-storage browser regression.
The final complete unit suite passed all 224 files and 2,097 tests with two
workers; the focused three-file rerun also passed all 52 cases. Final lint,
typecheck, and production build passed.
A separate cold Bun process without session storage also imported the actual
store and created an equation successfully. Expected unavailable-storage
warnings remained visible in that probe.

Typecheck was initially started alongside a production build and raced with
replacement of generated `.next/types` files. It was rerun after the build.
The first new browser check found the additional `ThemeSync` call described
above. An attempted axis-selector browser check also had an invalid precondition:
the selector is intentionally hidden for automatic equations. That attempted
check was removed; the store regression and existing manual-surface browser
case exercise the supported paths. Original failed/interrupted attempts are
retained in `.local/release-review/2026-10-16/`. The final browser rerun passed
all 21 selected storage, share, manual-axis, view-parity, and dimension-support
checks across Chromium, Firefox, and WebKit. The normal 3D recheck passed both
cases as described above. Neither diagnostic failure was silently reclassified
as a pass.

## First remediation validation

The following results supersede the earlier baseline gates while retaining
failed attempts as evidence. No assertions, pixel thresholds or timeout budgets
were increased or removed.

| Check | Final result |
| --- | --- |
| Frozen install in standalone source export | Passed; no existing Git checkout, environment file or build cache |
| `bun run lint` / `bun run typecheck` | Passed |
| `bun run test` | Passed; 227 files, 2,133 tests with the configured two workers |
| `bun run test:release-scripts` | Passed; 8 cases, also repeated after clean install |
| `bun run audit:release` | Passed after clean install and in the working tree; no unmitigated advisories |
| Raw `bun audit --json` | Still exits 1 for the single locally patched high braces record; zero critical records |
| `bun run build` | Passed in the standalone source export, including WASM and local font preparation |
| Rust tests / format / clippy | Passed; 4 unit tests, formatting check, all targets with warnings denied |
| Optional video typecheck / production bundle | Passed |
| Complete native Chromium functional selection | 522 cases exercised: 517 passed initially; 5 fixture failures fixed and passed three repetitions each |
| Focused Chromium / Firefox / WebKit matrix | Passed; 99 cases, including both original reproducible 3D failures |
| Final clean-build storage, sharing, recovery and UI recheck | Passed; 27 cases across Chromium, Firefox and WebKit, including corrupt-session autosave and sharing |
| Isolated Chromium stress job | Passed; all 3 cases, including 4x CPU ordinary editing |
| Current-source sensitive-data and media-hash gate | Passed; 844 source files and 28 owner-approved MIT assets |
| `git diff --check` | Passed |

The complete native run took 19.3 minutes. Four failed narrow-screen fixtures
used Escape to close Objects immediately after creation, when MathLive still
owned keyboard focus. They now click the sheet's actual Close control and await
closure; 36 equivalent setup transitions were corrected. Existing tests of
Escape behavior remain. The fifth fixture sampled a slide-up opacity transition
with Axe before the animation completed. It now awaits finite element animations
before the unchanged contrast check. All five passed three repeated native runs
(15/15), and the cross-browser matrix includes them. This remains a full run plus
verified fixes, not a claimed clean single-run result.

The isolated stress job retained its original bounds. Dense 2D (24 objects) had
a 41.7 ms p95 frame and a 1,740 ms maximum long task. Dense 3D (8 surfaces,
software WebGL2) had a 316.6 ms p95 frame and a 423 ms maximum long task. Ordinary
2D at 4x CPU slowdown completed 120 interactions over 122.2 seconds with a 9.2 ms
p95 frame and no recorded long task. The dense checks passing their bounds does
not mean dense software-rendered scenes maintain interactive frame rates.
Heap/backing-store growth and recovery checks also stayed within their unchanged
limits, with no captured application errors.

The initial software-rendering runs, overlay-ordering failure, native fixture
failures, two-worker contention failure and passing reruns remain under ignored
`.local/release-remediation/`. Media-capture jobs were not rerun. Historical logs
remain in existing Git history; use the history-free snapshot for publication.
No commit, push, repository creation, history rewrite or deployment was performed.

The source-only artifact for that phase is `.local/public-source/`, with 844 files and a
`PUBLIC_SOURCE_MANIFEST.json` containing verified SHA-256 hashes. It contains no
Git directory/history or local environment files. Its application, dependencies,
tests and build scripts match the standalone export used for the final frozen
install, build and 27 browser checks; only the final validation report and plan
were updated afterward. Existing Git history was neither rewritten nor copied.


## Remaining-limitations follow-up

### Navigation rasterization budget

A fresh eight-surface headless Chromium/WebGL2 baseline measured a 333.4 ms p95
frame, a 516.5 ms maximum frame and a 520 ms maximum long task. CPU profiling
showed little time in JavaScript relative to browser/driver execution; this
motivated reducing rasterization work rather than changing the numerical grid.

The existing render gate now also owns a bounded navigation-resolution policy.
Two submitted frames over 40 ms, or one at least 100 ms, halve screen resolution
per dimension, down to one quarter of the normal capped device pixel ratio.
Only actual navigation starts/moves/wheels arm the policy; ordinary idle frames
and programmatic camera changes do not. The reduced target remains stable
across the gesture, with full resolution restored one second after input stops.
The canonical PNG capture always requests full resolution before drawing.
No object geometry, expressions, numerical sampling, serialized fields or
mathematical-result assertions changed.

An initial short-debounce trial measured p95 at 496–591 ms while the unit suite
was also running, so it is not an isolated comparison. Its 250 ms settling
interval could also expire between slow wheel events and repeatedly reallocate
render buffers. A separate longer-hold trial with a one-half minimum measured
217–225 ms but missed the new 200 ms target. Those failed trials are retained. The final policy passed three consecutive
runs at 191.7, 175.9 and 184.1 ms p95 (about 43–47% below the baseline), with
354.7–420.7 ms maximum frames, 349–425 ms maximum long tasks and no recorded
application errors. The new 200 ms p95 assertion supplements the original
2,500 ms maximum-frame/long-task bounds; existing bounds were not loosened.
This improves the tested software-rendering workload; it does not promise
60 FPS or constant performance across arbitrary hardware and scenes.

Four new policy cases verify fast navigation, sustained slow navigation,
severe stalls, settling and full-resolution capture. The real browser idle /
redraw check now asserts restoration of the full pixel ratio. Existing PNG
checks also assert the downloaded dimensions against the full CSS size and
device ratio, rather than only comparing with a potentially reduced canvas.

### Isolated publication repository

The previous plain source export had no `.git` directory, so `git` invoked
inside `.local/public-source` discovered the private parent checkout. This was
a real risk of pushing old history from the wrong directory. The existing
exporter now supports `bun run prepare:public-repository .local/public-repository`:
it initializes a fresh empty repository on `main`, with no copied objects,
commits, staged files, remotes or inherited Git templates. Initialization removes
Git-directory environment overrides and verifies the resulting repository root.
The regression checks isolation from the parent and empty history/remotes/index.
All nine release-script tests pass, including the existing source/media gates.

The working checkout's effective identity initially resolved to a machine-local
name/email. Its local configuration now uses the owner's requested
`Luseefor <sapanakosansar18@gmail.com>`. The prepared repository uses the same
local identity. No existing commit was rewritten, and no source commit or remote
publication was performed. The plain source-only export remains available for
standalone build verification; publication should use the isolated repository.

### Historical upstream advisory status (before dependency removal)

At the intermediate 2026-10-16 follow-up, the registry published braces 3.0.3
as its latest release and Next lint still depended on fast-glob/micromatch.
There was no fixed upstream release to select. The installed recursion fix
retained the real version 3.0.3; raw audit still showed that high record, with
zero critical records. The final follow-up below removes this dependency path
and the advisory exception entirely.


### Verification before final advisory removal

The complete headed Chromium functional selection passed **523/523 in one
uninterrupted 15.1-minute run, with one worker and zero retries** against the
standalone clean-install production build. This supplies the clean single-run
result missing from the earlier review; old failures and fixture repairs remain
recorded above. The formerly reproducible rapid streamline edit/config workflow
passed in 4.5 seconds and the shared curl overlay in 1.8 seconds, with their
existing assertions and 60-second budgets unchanged. Functional filtering still
excludes the separate stress/performance and media-capture jobs, as CI does.

Final `bun run lint`, `bun run typecheck`, and all 227 unit files / 2,137 tests
passed. A fresh standalone export passed frozen installation, the nine
release-script tests, `audit:release`, and `bun run build` (including WASM and
font preparation). No pre-existing Git checkout, environment file or build cache
was used by that production build. Existing source/media checks and relative
documentation links also passed. Pixel-budget performance trials were isolated
from the functional suite; no concurrent browser jobs or builds were used for
the complete Chromium result.


The focused browser matrix passed **111/111** across Chromium, Firefox and
WebKit in 4.6 minutes, with one worker and zero retries. It includes the new
full-resolution PNG checks, idle draw/restoration, slices and projections,
manual axis changes, invalid/corrupt storage recovery, sharing, narrow-screen
fixtures and both original heavy 3D workflows. This matrix ran separately from
the complete Chromium run and the isolated performance checks.


The existing three Rust/GPU export and recovery cases also passed in a separate
DPR-2 Chromium context (15 seconds). PNG dimensions matched the full viewport
size times the capped device pixel ratio, including Quad and the WebGL2 fallback.
The local configuration for this hardware-density recheck is retained with the
ignored follow-up evidence; the strengthened assertions live in the canonical
`e2e/rust-webgpu.spec.ts` and run in the normal matrix.


The final isolated stress job passed all three cases in 2.5 minutes. Dense 2D
recorded a 41.8 ms p95 frame and a 1,628 ms maximum long task. Dense 3D recorded
a 183.3 ms p95 frame, 367.3 ms maximum frame and 371 ms maximum long task, passing
the new 200 ms p95 bound as well as all unchanged original bounds. Ordinary 2D
completed 120 interactions over 122.1 seconds at 4x CPU slowdown with a 9.2 ms
p95 frame and no recorded long task. Memory/backing-store growth, application
errors, visibility recovery and reload preservation checks all passed.

| Final follow-up gate | Result |
| --- | --- |
| Lint / typecheck / production build | Passed, including a fresh standalone frozen installation and build |
| Unit tests | 227 files / 2,137 passed |
| Release-script tests | 9 passed in the working tree and clean install |
| Release dependency gate | Passed; the single patched upstream braces record remains visible in raw audit |
| Complete headed Chromium functional suite | 523 passed, 15.1 minutes, one run, no retries |
| Focused Chromium / Firefox / WebKit matrix | 111 passed, no retries |
| Existing GPU export/recovery cases at DPR 2 | 3 passed |
| Isolated Chromium stress suite | 3 passed, including the stricter dense-3D p95 bound |
| Source/media gate / relative documentation links / diff whitespace | Passed |

That follow-up prepared **`.local/public-repository/`**, with 844
reviewed files plus its SHA-256 source manifest and a newly initialized empty
Git repository on `main`. Its root, empty refs/object store/index, absent remotes,
source hashes and effective owner identity were checked. Application, dependency,
test and build files match the standalone build used for final verification;
only documentation was updated afterward. The earlier `.local/public-source/`
is a historical plain export and is superseded for publication by this isolated
repository. Existing branches, history and uncommitted source remain in place.
No source commit, push, GitHub repository creation or deployment was performed.

Follow-up command logs, CPU profiles, browser artifacts and the local DPR-2
configuration remain under ignored `.local/release-remediation/limits-follow-up/`.
The raw audit limitation described in this earlier follow-up is resolved by
the dependency removal below. Dense scenes still have
finite hardware costs, including cold-start/full-resolution frames; the measured
improvement is reported without a universal frame-rate guarantee.

## Final advisory removal and dark appearance — 2026-10-17

The final tooling advisory is removed from the dependency graph. The graph app
uses Tailwind 4.3.3 with its official PostCSS integration; video uses Tailwind
4.2.0 through the matching Remotion Tailwind 4 integration. The resolved lockfile
contains no braces, micromatch, fast-glob or Chokidar package. Next's pinned lint
plugin resolves its fast-glob request to tinyglobby 0.2.17. A small tracked patch
disables automatic directory expansion and preserves absolute roots; no lint rule
is disabled. Installed-consumer regressions cover literal/wildcard/brace/array,
backslash, missing and absolute roots and real internal-link diagnostics.
The old braces patch and advisory exception are removed. Fresh frozen installs
and raw `bun audit --json` pass with `{}`; the release gate rejects every advisory.

Both workspaces now keep Tailwind theme configuration in CSS. Explicit source
directories make utility generation work in a standalone export. Application
radius roles use `--ui-radius-*` so they do not collide with Tailwind 4's native
radius tokens. The official template migration's accidental component-variant
and blur-event renames were caught and restored before final verification.

Dark appearance now uses coherent charcoal surfaces, distinct controls and
floating menus, brighter secondary text, quieter neutral grid lines and readable
axis labels/negative axes. Dark CSS and the shared 2D/3D/SVG theme tokens agree on
canvas and grid definitions; 3D lighting and tone mapping can still affect pixels.
The Appearance chooser's selected state wins over its shared button utilities.
Dark focus colors clear 3:1 against chrome, controls and raised surfaces for all
ten accent presets. Existing light theme roles and user preferences are retained.
Geometry and matrix error labels use the app's semantic error color rather than
OS-theme-dependent utility variants. Sketch preview's Create action uses the
existing primary Button, keeping its label independent of the focus-ring color.
The new phone check caught an invalid live status inside the overflow menu; its
announcement now lives outside the menu, while the visible status remains there.
No scene format, math evaluator, renderer ownership or store boundary changed.

New regressions cover both themes at 390px and 1440px, all desktop accent
presets, real selected-state CSS, dark focus contrast, keyboard dismissal and
persisted theme/accent after reload. WCAG axe checks keep color contrast enabled.
Shared theme tests also enforce CSS/render-token agreement and graph-label
contrast. Early fixture/verification failures are retained with the final logs;
an initial CSS-source test used a browser URL and was corrected to the Vitest
workspace path. An early typecheck overlapped Next's generated-type regeneration;
sequential checks passed. The phone test was corrected to use the actual compact
theme menu, and its subsequently exposed menu-role defect was fixed in source.
The expanded theme cases also trigger invalid geometry and matrix definitions,
check their computed error colors, and rerun axe with contrast enabled. All twelve
theme cases passed across Chromium, Firefox and WebKit; the focused shell/theme
matrix passed all 116 cases. The two error-label component files passed their
eight existing tests. The final complete functional matrix includes the subsequent
shared-primary-button correction; an earlier matrix was stopped for these final
token corrections and is retained as incomplete.

Completed non-browser verification: all 227 unit files / 2,140 tests, ten release-script
tests, lint, typecheck, fresh standalone production build including WASM/fonts,
frozen installation and strict zero-advisory gate. The video workspace passed
typecheck, a bundle and a real 500th-frame PNG render. The focused Chromium
appearance check passed all four cases. Final browser results and their original
failures are recorded below.

The first complete follow-up Chromium run recorded **526 passes and one failure**
in the tablet start-panel handoff. A subsequent three-repeat start-panel probe
reproduced six failures across several widths. Escape could reach the launcher
under a newly visible Examples dialog before the passive focus effect ran,
collapsing the launcher while leaving the gallery open. The canonical dialog
focus trap now establishes focus and its Tab handler in a layout effect, before
paint. A regression sends Escape during the opening commit: it fails against
the previous hook and passes with the fix, checking focus containment, dismissal,
launcher survival and focus restoration. No assertion or timeout was relaxed.
These original results remain in the ignored follow-up evidence.

After the fix, all 33 start-panel cases passed across three repetitions, with
unchanged assertions and budgets. A separate complete unit rerun passed all
2,140 tests. An interrupted verification attempt had overlapped unit tests and
the production build and recorded a numerical stress timeout; it is retained as
an incomplete run, not counted as a pass. The successful complete rerun kept the
heavy jobs sequential and changed no test budgets.

The complete final functional matrix exercised all **1,581 selected cases** on
macOS with one worker, no retries and the existing CI functional filter. It
recorded **1,558 passes, 21 existing browser-capability skips and two Firefox
failures** over 1.2 hours. Chromium passed all 527; WebKit passed 520 with seven
existing CDP-only skips. Firefox passed 511 with fourteen existing touch-emulation
skips. The two Firefox failures were Follow View's post-wheel domain expansion
and the differentiation preview's final point commitment. This is not presented
as a clean single-run matrix.

A fresh Firefox run reproduced Follow View's unchanged domain. A separate
event-recording probe measured a requested 1,200-unit wheel step arriving as 600
on this Retina display. One step stayed inside the quantized domain tile; the
second expanded the shared heat/contour domain from width 32 to 64. The test now
uses two scroll steps to cross the tile. Its strict domain-expansion, changed-pixel,
custom-bound restoration, overlay and error assertions and timeouts are unchanged.
Five fresh Firefox repetitions passed with this gesture correction.

The point commitment passed in the event probe and five fresh repetitions of the
unchanged test. Its original failure's exact cause was not established. Review
found that a hidden preview retains its previous text, so the old text-only
assertion could pass before the rearmed preview became visible. The test now
requires visibility and uses locator hover/click actionability on the real canvas
instead of cached page coordinates. All existing cancellation, coordinate-label,
committed-point and post-commit hiding assertions remain. This strengthens input
readiness; it is not evidence of a mathematical-result correction. A traced
reproduction was stopped after trace cleanup stalled; its partial artifacts and
the lightweight event probe are retained with the original failures.

After those fixture corrections, both cases passed **five consecutive repetitions
per browser: 30/30 across Chromium, Firefox and WebKit**, with zero retries and
unchanged timeouts. The underlying application code matches the production build
used for the complete matrix. The fixture corrections do not make the original
matrix a clean pass; its two Firefox failures remain part of the evidence.

Final lint and typecheck passed. The final unit rerun passed all **227 files /
2,140 tests** in 146.1 seconds, after the last source and fixture changes. The
production build passed from the independent frozen installation, including
Rust WASM and local font preparation. No standalone stress job was remeasured
for these dependency/style changes; the earlier measurements above remain dated
evidence rather than new performance claims.

The current publication copy is **`.local/public-repository/`**, containing 842
reviewed source files plus its SHA-256 manifest and a new empty Git repository on
`main`. The previous 844-file prepared repository is archived intact under
`.local/release-remediation/dark-follow-up/previous-public-repository/`.
The refreshed copy is checked against the current source hashes, an independent
frozen installation, the strict zero-advisory gate and release-script regressions.
Its Git root, empty refs/index/object store, absent remotes/hooks and effective
owner author/committer identity are checked separately. Existing branch/tag refs
and private history are preserved. No source commit, staging, push, GitHub
repository creation or deployment was performed.

Original failures, interrupted checks, final command logs, browser artifacts and
the input-event probe remain under ignored
`.local/release-remediation/dark-follow-up/`. Device-dependent 3D costs, finite
numerical sampling and the documented modern-browser minimum still apply.

## GitHub delivery

After local validation, delivery uses focused commits on
`release/v0.5.1-review-fixes`, with a pull request targeting `v0.5.1` in the
existing `Luseefor/vinculum` repository. The source-only exports above remain
local validation artifacts. This delivery preserves the existing Git history;
the earlier statements about no commits or pushes describe the validation phase.
