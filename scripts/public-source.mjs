import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, lstat, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const privateDirectories = new Set([".git", ".agents", ".claude", ".local", "node_modules", ".next", "build", "target", "dist", "out", "coverage", "test-results", "playwright-report", "blob-report"]);
const mediaExtension = /\.(png|jpe?g|webp|gif|svg|wav|mp3|mp4|webm|woff2?|ttf|otf)$/i;

export function excludedPath(path) {
  const parts = path.split("/");
  return parts.some(part => privateDirectories.has(part)) ||
    path === "PUBLIC_SOURCE_MANIFEST.json" ||
    parts.some(part => part === ".." || part === "") || isAbsolute(path) ||
    (parts.at(-1).startsWith(".env") && parts.at(-1) !== ".env.example") ||
    /\.(log|tsbuildinfo)$/.test(path) || path.startsWith("apps/graph/public/mathlive/");
}

// Return categories only: a failed check must never print credential contents.
export function sensitiveCategories(contents) {
  const patterns = [
    ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
    ["GitHub token", /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/],
    ["AWS access key", /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
    ["OpenAI token", /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{40,}\b/],
    ["machine home path", /\/(?:Users|home)\/[A-Za-z0-9._-]+\//]
  ];
  return patterns.filter(([, pattern]) => pattern.test(contents)).map(([category]) => category);
}

export function sensitiveSourceCategories(path, contents) {
  const source = contents.toString("utf8");
  const categories = sensitiveCategories(source);
  if (path === "apps/graph/lib/math/runtime/rustMathArtifact.ts") {
    const artifact = source.match(/^export const RUST_MATH_WASM_BASE64 = "([A-Za-z0-9+/]*={0,2})";/m);
    if (!artifact) throw new Error("Cannot inspect the embedded Rust/WASM artifact.");
    categories.push(...sensitiveCategories(Buffer.from(artifact[1], "base64").toString("utf8")).map(category => `embedded WASM: ${category}`));
  }
  return categories;
}

export async function collectPublicSource(sourceRoot) {
  const listed = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: sourceRoot });
  if (listed.status !== 0) throw new Error("Cannot enumerate Git source files.");
  const paths = [...new Set(listed.stdout.toString().split("\0").filter(Boolean))].sort();
  const inventory = JSON.parse(await readFile(resolve(sourceRoot, "docs/reports/media-provenance.json"), "utf8"));
  const assets = new Map(inventory.assets.map(asset => [asset.path, asset]));
  const files = [];
  for (const path of paths) {
    if (excludedPath(path)) continue;
    const absolute = resolve(sourceRoot, path);
    const stat = await lstat(absolute).catch(error => { if (error.code === "ENOENT") return null; throw error; });
    if (!stat) continue; // Relocated/deleted files still in the index.
    if (!stat.isFile()) throw new Error(`Source must be a regular file: ${path}`);
    const contents = await readFile(absolute);
    const categories = sensitiveSourceCategories(path, contents);
    if (categories.length) throw new Error(`Public source review failed: ${path}: ${categories.join(", ")}`);
    const sha256 = createHash("sha256").update(contents).digest("hex");
    if (mediaExtension.test(path)) {
      const asset = assets.get(path);
      if (!asset || asset.sha256 !== sha256 || asset.license !== "MIT" || asset.copyright !== "2026 Luseefor") {
        throw new Error(`Media requires an updated ownership/license inventory: ${path}`);
      }
      assets.delete(path);
    }
    files.push({ path, sha256, bytes: contents.length });
  }
  if (assets.size) throw new Error(`Media inventory contains missing files: ${[...assets.keys()].join(", ")}`);
  return files;
}

export async function exportPublicSource(sourceRoot, destination, { initializeRepository = false } = {}) {
  const relativeDestination = relative(sourceRoot, destination);
  if (!relativeDestination || (!relativeDestination.startsWith(`..${sep}`) && relativeDestination !== ".." && !relativeDestination.startsWith(`.local${sep}`))) {
    throw new Error("Export into an unused .local directory or outside the source repository.");
  }
  const files = await collectPublicSource(sourceRoot);
  await mkdir(destination, { recursive: false }); // Never merge into or delete another directory.
  for (const file of files) {
    const target = resolve(destination, file.path);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(sourceRoot, file.path), target);
    const copiedHash = createHash("sha256").update(await readFile(target)).digest("hex");
    if (copiedHash !== file.sha256) throw new Error(`Source changed during export; discard snapshot: ${file.path}`);
  }
  await writeFile(resolve(destination, "PUBLIC_SOURCE_MANIFEST.json"), JSON.stringify({ format: 1, historyIncluded: false, files }, null, 2) + "\n");
  if (initializeRepository) {
    // A source-only directory nested in a checkout otherwise discovers the
    // parent's history when someone runs git push from the snapshot.
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")));
    const result = spawnSync("git", ["-c", "init.templateDir=", "init", "--initial-branch=main", destination], { env, encoding: "utf8" });
    if (result.status !== 0) throw new Error("Could not initialize the isolated public repository; discard this export.");
    const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: destination, env, encoding: "utf8" });
    if (top.status !== 0 || resolve(top.stdout.trim()) !== resolve(destination)) throw new Error("Public repository isolation failed; discard this export.");
  }
  return files;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const outputIndex = process.argv.indexOf("--output");
    if (outputIndex !== -1 && !process.argv[outputIndex + 1]) throw new Error("--output needs an unused destination directory.");
    if (process.argv.includes("--initialize") && outputIndex === -1) throw new Error("--initialize requires --output and an unused destination directory.");
    const files = outputIndex === -1 ? await collectPublicSource(root) :
      await exportPublicSource(root, resolve(process.argv[outputIndex + 1]), { initializeRepository: process.argv.includes("--initialize") });
    console.log(`${outputIndex === -1 ? "Reviewed" : "Exported"} ${files.length} source files; media hashes and targeted sensitive-data checks passed. No Git history included or changed.`);
    if (process.argv.includes("--initialize")) console.log("Initialized an isolated empty Git repository on main, with no commits or remotes.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
