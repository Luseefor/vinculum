import { describe, expect, it } from "vitest";
import { parseGraphObjectKind } from "@/lib/graph/graphObjectKind";

describe("parseGraphObjectKind", () => {
  it("accepts valid kinds", () => {
    expect(parseGraphObjectKind("surface")).toBe("surface");
    expect(parseGraphObjectKind("parametricCurve")).toBe("parametricCurve");
    expect(parseGraphObjectKind("plane")).toBe("plane");
  });

  it("rejects unknown values", () => {
    expect(parseGraphObjectKind("")).toBeNull();
    expect(parseGraphObjectKind("other")).toBeNull();
    expect(parseGraphObjectKind("Surface")).toBeNull();
  });
});
