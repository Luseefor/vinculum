# Public source release

Project source and owner-confirmed bundled media use [MIT](../../LICENSE).
Third-party components and fonts keep their [original notices](../../THIRD_PARTY_NOTICES.md).
The owner confirmed ownership and MIT redistribution of the bundled logos,
screenshots, recordings and soundtracks on 2026-10-16. The complete source-media
inventory is [media-provenance.json](../reports/media-provenance.json), including
SHA-256 hashes. New or changed media requires an updated rights review and hash.
Generated MathLive fonts are installed dependencies, excluded from the source
snapshot and prepared with their notices during dev/build.

## Dependencies

Use Node 26 and Bun 1.4.3, matching CI. Install with
`bun install --frozen-lockfile`, then run `bun run audit:release`.
This runs actual installed-package regression checks before interpreting audit
output. Next.js is pinned to 15.5.28, with React 19 and asynchronous home-route
search parameters; mathjs is 15.2.0 or later. PostCSS and its selector parser
are overridden to patched versions. Remotion packages share one exact version.

The lockfile no longer contains `braces`, `micromatch`, `fast-glob`, or
Tailwind 3's Chokidar chain. Both workspaces use Tailwind 4: the graph app uses
`@tailwindcss/postcss`, and video uses the matching `@remotion/tailwind-v4`
integration. Theme configuration lives in each workspace's stylesheet. Explicit
source directories keep utility generation independent of where the source
snapshot is checked out. Tailwind 4 requires Safari 16.4+, Chrome 111+, or
Firefox 128+; the graph's GPU capabilities still depend on the device/browser.

Next's pinned ESLint plugin currently requests `fast-glob`. The root override
resolves that request to the maintained `tinyglobby@0.2.17` package. This is an
implementation replacement, with no copied `braces` code. The small
`patches/@next%2Feslint-plugin-next@15.5.28.patch` preserves exact-directory
matching and absolute-path behavior, following the upstream
[tinyglobby migration guide](https://superchupu.dev/tinyglobby/migration).
It changes directory discovery only; all Next lint rules remain enabled.
`test:dependencies` exercises the actual installed plugin with literal, wildcard,
brace, array, backslash, missing and absolute roots, and verifies that internal
link violations are still reported. Revisit the override and patch together when
upgrading Next's lint plugin; other consumers may need a different glob API.

`audit:release` requires zero advisory records. It has no advisory allowlist,
including for the previously patched braces advisory. It also rejects malformed
reports, contradictory exit codes and network failures. The old braces patch has
been removed. Recheck raw `bun audit --json` before each release.

## History and the public snapshot

Removing local run logs from the current tree does not remove their historical
copies. A read-only review on 2026-10-16 inspected all 4,187 blobs reachable
from local refs (251,743,043 bytes). It found machine home paths in 94 historical
blobs. The targeted private-key, GitHub-token, AWS-access-key and OpenAI-token
patterns found no credentials. This is a bounded pattern scan, not a guarantee
about every credential format, prompt, asset, reflog or unreachable object.
Raw findings remain in ignored `.local/release-remediation/history-scan.json`.

Prepare an isolated repository for publication:

```sh
bun run check:public-source
bun run test:release-scripts
bun run prepare:public-repository .local/public-repository
```

The destination must not exist. The script copies current tracked and untracked,
nonignored files, including reviewed uncommitted changes. It excludes Git
history, local run logs, credentials/configuration files, dependencies and build
outputs. It rejects symlinks, targeted sensitive-data matches, and media absent
from the approved inventory. The known base64-embedded Rust/WASM artifact is
also decoded and scanned rather than checking only its text wrapper. Every copied file is verified against its SHA-256
hash and recorded in `PUBLIC_SOURCE_MANIFEST.json`. An `.env.example` remains
eligible, but is still scanned. Treat a failed or interrupted export as unusable.

This creates a fresh empty Git repository on `main`, without commits, remotes,
inherited templates or previous objects. Git commands inside it operate on this
new repository instead of discovering the private parent checkout. Git-directory
environment overrides are removed during initialization. Nothing is staged,
committed or published. The source manifest records that no existing history
was copied.

Review the prepared files and run a frozen install, dependency checks and normal
quality gates there before committing or connecting a public remote. Confirm the
effective identity with `git var GIT_AUTHOR_IDENT` and `git var GIT_COMMITTER_IDENT`.
For this project use `Luseefor <sapanakosansar18@gmail.com>`.
The prepared repository contains no previous prompts/logs.
Existing branches, remotes and history remain untouched. Changing the existing
repository's visibility would expose its historical files; the clean snapshot
does not sanitize that existing repository. No force push or history rewrite is
part of this workflow. Verify author and committer identity before any commit.

For a plain source export used only for build verification, use
`bun run export:public-source .local/public-source`. That command does not create
a `.git` directory. When nested inside another checkout, Git commands from that
plain directory still discover the parent's history; use the prepared repository
above for publication.

## Blank definitions

Portable scene documents require complete definitions for every object,
including hidden objects. Canonical validation rejects an incomplete definition
with its object index; it never silently drops the object. JSON import/export,
sharing, named projects and validated recovery snapshots use this policy.
Finish or remove the object before those operations. The live editor and raw
session drafts can still contain unfinished authoring rows. No draft schema or
second serialization path was introduced. Existing invalid documents are
rejected with a diagnostic instead of being silently normalized into data loss.
