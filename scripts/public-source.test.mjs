import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { collectPublicSource, excludedPath, exportPublicSource, sensitiveCategories, sensitiveSourceCategories } from "./public-source.mjs";

async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "vinculum-public-source-"));
  try {
    execFileSync("git", ["init", "-q", root]);
    await mkdir(join(root, "docs/reports"), { recursive: true });
    await writeFile(join(root, "docs/reports/media-provenance.json"), '{"assets":[]}');
    await run(root);
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("excludes private history, credentials and build outputs while keeping example configuration", () => {
  for (const path of [".git/config", ".agents/teamwork/prompts.txt", ".local/review.json", ".env.local", "apps/graph/.env", "apps/graph/.next/server.js", "../outside", "target/release/binary", "PUBLIC_SOURCE_MANIFEST.json"]) {
    assert.equal(excludedPath(path), true, path);
  }
  assert.equal(excludedPath("apps/graph/.env.example"), false);
  assert.equal(excludedPath("patches/@next%2Feslint-plugin-next@15.5.28.patch"), false);
});

test("sensitive checks return redacted categories", () => {
  const token = "ghp_" + "A".repeat(40);
  assert.deepEqual(sensitiveCategories(token), ["GitHub token"]);
  assert.deepEqual(sensitiveCategories("-----BEGIN " + "PRIVATE KEY-----"), ["private key"]);
  assert.deepEqual(sensitiveCategories(["", "Users", "private", "project"].join("/")), ["machine home path"]);
});

test("checks the decoded embedded WASM rather than only its base64 wrapper", () => {
  const path = "apps/graph/lib/math/runtime/rustMathArtifact.ts";
  const token = "ghp_" + "A".repeat(40);
  const contents = Buffer.from(`export const RUST_MATH_WASM_BASE64 = "${Buffer.from(token).toString("base64")}";`);
  assert.deepEqual(sensitiveSourceCategories(path, contents), ["embedded WASM: GitHub token"]);
  assert.throws(() => sensitiveSourceCategories(path, Buffer.from("unrecognized wrapper")), /Cannot inspect/);
});

test("exports dirty/untracked source and patches without Git history, ignored files or deleted paths", async () => fixture(async root => {
  await writeFile(join(root, "tracked.txt"), "before");
  await writeFile(join(root, "deleted.txt"), "delete me");
  await writeFile(join(root, "PUBLIC_SOURCE_MANIFEST.json"), "previous generated manifest");
  execFileSync("git", ["add", "."], { cwd: root });
  await writeFile(join(root, "tracked.txt"), "reviewed changes");
  await rm(join(root, "deleted.txt"));
  await writeFile(join(root, "new.txt"), "new source");
  await mkdir(join(root, "patches"));
  await writeFile(join(root, "patches/dependency.patch"), "reviewed patch");
  await mkdir(join(root, ".local"));
  await writeFile(join(root, ".env.local"), "private configuration");
  await writeFile(join(root, ".local/prompts.txt"), "private prompts");
  const destination = join(root, ".local/snapshot");
  const files = await exportPublicSource(root, destination);
  assert(files.some(file => file.path === "new.txt"));
  assert(files.some(file => file.path === "patches/dependency.patch"));
  assert(!files.some(file => excludedPath(file.path) || file.path === "deleted.txt"));
  assert.equal(await readFile(join(destination, "tracked.txt"), "utf8"), "reviewed changes");
  assert.equal(JSON.parse(await readFile(join(destination, "PUBLIC_SOURCE_MANIFEST.json"), "utf8")).historyIncluded, false);
  await assert.rejects(exportPublicSource(root, destination), /EEXIST/);
}));

test("rejects secrets, unreviewed media and symlinks before exporting", async () => fixture(async root => {
  await writeFile(join(root, "credential.txt"), "ghp_" + "A".repeat(40));
  await assert.rejects(collectPublicSource(root), /credential.txt: GitHub token/);
  await rm(join(root, "credential.txt"));
  await writeFile(join(root, "new.png"), "new asset");
  await assert.rejects(collectPublicSource(root), /updated ownership\/license inventory/);
  await rm(join(root, "new.png"));
  await symlink(join(root, "docs/reports/media-provenance.json"), join(root, "linked.json"));
  await assert.rejects(collectPublicSource(root), /regular file/);
}));

test("prepared public repositories cannot discover parent history or inherit Git-directory overrides", async () => fixture(async root => {
  await writeFile(join(root, "source.txt"), "reviewed source");
  await mkdir(join(root, ".local"));
  const destination = join(root, ".local/public-repository");
  const previous = process.env.GIT_DIR;
  process.env.GIT_DIR = join(root, ".git");
  try { await exportPublicSource(root, destination, { initializeRepository: true }); }
  finally {
    if (previous === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = previous;
  }
  const git = (...args) => execFileSync("git", args, { cwd: destination, encoding: "utf8" }).trim();
  assert.equal(git("rev-parse", "--show-toplevel"), destination);
  assert.equal(git("symbolic-ref", "HEAD"), "refs/heads/main");
  assert.equal(git("rev-list", "--all"), "");
  assert.equal(git("remote"), "");
  assert.equal(git("diff", "--cached", "--name-only"), "");
  assert.equal(execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: root, encoding: "utf8" }).trim(), root);
  assert.equal(JSON.parse(await readFile(join(destination, "PUBLIC_SOURCE_MANIFEST.json"), "utf8")).historyIncluded, false);
}));
