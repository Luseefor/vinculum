import assert from "node:assert/strict";
import { test } from "node:test";
import { assessAudit, checkInstalledDependencies } from "./check-dependencies.mjs";

const advisory = {
  url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm",
  severity: "high",
  vulnerable_versions: "<=3.0.3"
};

test("real Next lint consumer preserves directory globs and internal-link diagnostics", () => {
  checkInstalledDependencies();
});

test("accepts a clean audit with no exceptions", () => {
  assert.equal(assessAudit({}, 0), 0);
});

test("rejects every advisory, including the formerly patched braces record", () => {
  for (const severity of ["low", "moderate", "high", "critical"]) {
    assert.throws(() => assessAudit({ braces: [{ ...advisory, severity }] }, 1), /Dependency advisories/);
    assert.throws(() => assessAudit({ next: [{ ...advisory, severity }] }, 1), /Dependency advisories/);
  }
});

test("fails malformed reports, network statuses and contradictory exit codes", () => {
  for (const [report, status] of [[null, 0], [[], 0], [{ braces: {} }, 1], [{ braces: [null] }, 1], [{}, 1], [{}, 2], [{ braces: [advisory] }, 0]]) {
    assert.throws(() => assessAudit(report, status));
  }
});
