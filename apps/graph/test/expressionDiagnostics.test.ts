import { describe, expect, it } from "vitest";
import { getSurfaceEquationDiagnostics } from "@/lib/math/expressionDiagnostics";
import { MAX_EXPRESSION_LENGTH } from "@/lib/math/expressionSafety";

describe("expressionDiagnostics", () => {
  it("returns valid for a normal surface equation", () => {
    const diag = getSurfaceEquationDiagnostics("z = sin(x)", "z");
    expect(diag.status).toBe("valid");
    expect(diag.message).toBe("");
  });

  it("rejects overlong expressions safely", () => {
    // Ensure it is syntactically valid while exceeding the max length.
    const body = "x+".repeat(Math.ceil(MAX_EXPRESSION_LENGTH / 2)) + "x";
    const diag = getSurfaceEquationDiagnostics(`z = ${body}`, "z");
    expect(diag.status).toBe("error");
    expect(diag.message.toLowerCase()).toContain("too long");
    expect(diag.message).not.toMatch(/\\b(at|stack)\\b/i);
  });

  it("rejects unsupported functions with actionable copy", () => {
    const diag = getSurfaceEquationDiagnostics("z = factorial(x)", "z");
    expect(diag.status).toBe("error");
    expect(diag.message).toMatch(/Unsupported function/i);
    expect(diag.suggestion).toMatch(/sin|cos|tan|sqrt|abs|exp|log|pow/i);
  });

  it("formats syntax errors without leaking stack traces", () => {
    const diag = getSurfaceEquationDiagnostics("z = sin(", "z");
    expect(diag.status).toBe("error");
    expect(diag.message).toMatch(/Invalid expression syntax/i);
    expect(diag.message).not.toMatch(/\\bat\\b|\\bstack\\b/i);
  });
});

