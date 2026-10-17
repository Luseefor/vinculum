import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { sanitizeProperties, captureEvent, isAnalyticsEnabled } from "@/lib/analytics/posthog";

describe("analytics module - sanitizeProperties", () => {
  it("returns undefined when input is undefined", () => {
    expect(sanitizeProperties(undefined)).toBeUndefined();
  });

  it("removes forbidden equation field", () => {
    const input = { equation: "z = sin(x)", object_kind: "surface" };
    const result = sanitizeProperties(input);
    expect(result).not.toHaveProperty("equation");
    expect(result).toHaveProperty("object_kind", "surface");
  });

  it("removes forbidden expression field", () => {
    const input = { expression: "x^2 + y^2", object_count: 5 };
    const result = sanitizeProperties(input);
    expect(result).not.toHaveProperty("expression");
    expect(result).toHaveProperty("object_count", 5);
  });

  it("removes forbidden scene field", () => {
    const input = { scene: { objects: [] }, tool: "probe" };
    const result = sanitizeProperties(input);
    expect(result).not.toHaveProperty("scene");
    expect(result).toHaveProperty("tool", "probe");
  });

  it("removes forbidden projectName field", () => {
    const input = { projectName: "My Project", success: true };
    const result = sanitizeProperties(input);
    expect(result).not.toHaveProperty("projectName");
    expect(result).toHaveProperty("success", true);
  });

  it("removes forbidden url and fullUrl fields", () => {
    const input = { url: "http://example.com", fullUrl: "http://example.com/full", tool: "measure" };
    const result = sanitizeProperties(input);
    expect(result).not.toHaveProperty("url");
    expect(result).not.toHaveProperty("fullUrl");
    expect(result).toHaveProperty("tool", "measure");
  });

  it("removes forbidden error stack fields", () => {
    const input = { stack: "Error at...", errorStack: "Full stack...", error_type: "parse" };
    const result = sanitizeProperties(input);
    expect(result).not.toHaveProperty("stack");
    expect(result).not.toHaveProperty("errorStack");
    expect(result).toHaveProperty("error_type", "parse");
  });

  it("removes forbidden payload fields", () => {
    const input = { payload: "raw data", rawPayload: "more data", success: false };
    const result = sanitizeProperties(input);
    expect(result).not.toHaveProperty("payload");
    expect(result).not.toHaveProperty("rawPayload");
    expect(result).toHaveProperty("success", false);
  });

  it("removes forbidden expression fields (xExpr, yExpr, zExpr)", () => {
    const input = { xExpr: "t", yExpr: "t^2", zExpr: "t^3", object_kind: "curve" };
    const result = sanitizeProperties(input);
    expect(result).not.toHaveProperty("xExpr");
    expect(result).not.toHaveProperty("yExpr");
    expect(result).not.toHaveProperty("zExpr");
    expect(result).toHaveProperty("object_kind", "curve");
  });

  it("sanitizes nested objects recursively", () => {
    const input = {
      tool: "measureDistance",
      nested: {
        equation: "forbidden",
        valid: "allowed"
      }
    };
    const result = sanitizeProperties(input);
    expect(result).toHaveProperty("tool", "measureDistance");
    expect(result?.nested).not.toHaveProperty("equation");
    expect(result?.nested).toHaveProperty("valid", "allowed");
  });
});

describe("analytics module - captureEvent no-op", () => {
  it("does not throw when analytics is disabled", () => {
    expect(() => {
      captureEvent("landing_viewed");
    }).not.toThrow();
  });
});

describe("analytics module - isAnalyticsEnabled", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns false when NEXT_PUBLIC_POSTHOG_KEY is missing", () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    expect(isAnalyticsEnabled()).toBe(false);
  });

  it("returns false when NEXT_PUBLIC_POSTHOG_KEY is empty", () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "";
    expect(isAnalyticsEnabled()).toBe(false);
  });
});
