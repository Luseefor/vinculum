import { describe, expect, it, vi } from "vitest";
import {
  normalizeError,
  reportError
} from "@/lib/monitoring/errorReporting";

describe("error reporting", () => {
  it("normalizes Error, string, and unknown object safely", () => {
    const err = normalizeError(new Error("boom"));
    expect(err.message).toBe("boom");
    expect(err.name).toBe("Error");

    const str = normalizeError("problem");
    expect(str.message).toBe("problem");

    const unknown = normalizeError({ message: "from object", name: "ObjErr" });
    expect(unknown.message).toBe("from object");
    expect(unknown.name).toBe("ObjErr");
  });

  it("reportError is safe with no external provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      reportError(new Error("no provider"), {
        featureArea: "3d-viewport",
        operation: "unit-test"
      })
    ).not.toThrow();
    spy.mockRestore();
  });
});
