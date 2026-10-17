import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function checkInstalledDependencies() {
  const require = createRequire(new URL("../apps/graph/package.json", import.meta.url));
  const nextRequire = createRequire(require.resolve("eslint-config-next"));
  const pluginPath = nextRequire.resolve("@next/eslint-plugin-next");
  const pluginRequire = createRequire(pluginPath);
  const globPackage = pluginRequire("fast-glob/package.json");
  assert.equal(globPackage.name, "tinyglobby", "Next lint must use the maintained glob implementation.");
  assert.equal(globPackage.version, "0.2.17");
  const lockfile = readFileSync(new URL("../bun.lock", import.meta.url), "utf8");
  assert(!/\["(?:braces|micromatch|fast-glob|chokidar)@/.test(lockfile), "The retired tooling dependency chain must not return.");

  // Exercise the real consumer: exact directories must not expand recursively.
  // tinyglobby defaults differ from fast-glob, so the Next patch disables expansion.
  const { getRootDirs } = pluginRequire("./utils/get-root-dirs");
  const source = readFileSync(join(dirname(pluginPath), "utils/get-root-dirs.js"), "utf8");
  assert.match(source, /expandDirectories:\s*false/);
  const fixture = mkdtempSync(join(tmpdir(), "vinculum-eslint-glob-"));
  const previousCwd = process.cwd();
  try {
    for (const path of ["apps/web/pages", "apps/docs/app/about", "packages/ui/src"]) mkdirSync(join(fixture, path), { recursive: true });
    writeFileSync(join(fixture, "apps/web/pages/index.tsx"), "export default function Page() { return null; }");
    writeFileSync(join(fixture, "apps/docs/app/about/page.tsx"), "export default function Page() { return null; }");
    writeFileSync(join(fixture, "apps/not-a-directory"), "fixture");
    process.chdir(fixture);
    const roots = rootDir => getRootDirs({ cwd: fixture, settings: { next: { rootDir } } }).map(dir => dir.replace(/\/$/, "")).sort();
    assert.deepEqual(roots(undefined), [fixture]);
    assert.deepEqual(roots("apps/web"), ["apps/web"]);
    assert.deepEqual(roots("apps/*"), ["apps/docs", "apps/web"]);
    assert.deepEqual(roots("apps/{web,docs}"), ["apps/docs", "apps/web"]);
    assert.deepEqual(roots(["apps/*", "packages/*", null]), ["apps/docs", "apps/web", "packages/ui"]);
    assert.deepEqual(roots("apps\\web"), ["apps/web"]);
    assert.deepEqual(roots(join(fixture, "apps/web")), [join(fixture, "apps/web")]);
    assert.deepEqual(roots("missing/*"), []);

    const { Linter } = require("eslint");
    const linter = new Linter();
    linter.defineRule("next-internal-links", nextRequire("@next/eslint-plugin-next").rules["no-html-link-for-pages"]);
    for (const rootDir of ["apps/web", "apps/*", "apps/{web,docs}", ["apps/web", "apps/docs"]]) {
      const errors = linter.verify('<a href="/">Home</a>', {
        parserOptions: { ecmaVersion: 2020, sourceType: "module", ecmaFeatures: { jsx: true } },
        settings: { next: { rootDir } }, rules: { "next-internal-links": "error" }
      });
      assert.equal(errors.length, 1, "Next must still detect internal links after glob migration.");
      assert.equal(errors[0].ruleId, "next-internal-links");
      assert.match(errors[0].message, /Do not use an `<a>` element/);
    }
  } finally {
    process.chdir(previousCwd);
    rmSync(fixture, { recursive: true, force: true });
  }
}

export function assessAudit(advisories, status) {
  assert([0, 1].includes(status), "Audit must complete with a recognized status.");
  assert(advisories && typeof advisories === "object" && !Array.isArray(advisories), "Unexpected audit report.");
  const records = [];
  for (const [name, entries] of Object.entries(advisories)) {
    assert(Array.isArray(entries), "Unexpected audit package records.");
    for (const entry of entries) {
      assert(entry && typeof entry.url === "string" && typeof entry.severity === "string", "Unexpected advisory record.");
      records.push({ package: name, severity: entry.severity, url: entry.url });
    }
  }
  assert.equal(status, records.length ? 1 : 0, "Audit status does not match its report.");
  if (records.length) throw new Error(`Dependency advisories:\n${JSON.stringify(records, null, 2)}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  checkInstalledDependencies();
  console.log("Installed tooling dependency regression checks passed.");
  if (process.argv.includes("--audit")) {
    const result = spawnSync("bun", ["audit", "--json"], { cwd: fileURLToPath(new URL("..", import.meta.url)), encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    if (result.error || ![0, 1].includes(result.status)) throw result.error ?? new Error(`Audit could not run: ${result.stderr}`);
    assessAudit(JSON.parse(result.stdout), result.status);
    console.log("Audit passed: zero advisories; no advisory exceptions.");
  }
}
