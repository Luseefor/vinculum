import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/monitoring/errorReporting", () => ({
  reportWarning: vi.fn(),
  reportError: vi.fn(),
  normalizeError: vi.fn()
}));

import { reportWarning } from "@/lib/monitoring/errorReporting";
import { compileSurfaceExpression } from "@/lib/math/compileExpression";

describe("expression safety monitoring", () => {
  it("reports unsupported/blocked expressions through monitoring", () => {
    const reportWarningMock = reportWarning as unknown as { mockClear: () => void; mock: { calls: unknown[][] } };
    reportWarningMock.mockClear();

    const { error } = compileSurfaceExpression("z = factorial(5)", "z");
    expect(error).toMatch(/Unsupported function: factorial/i);
    expect(reportWarning).toHaveBeenCalled();

    const [message] = reportWarningMock.mock.calls[0] ?? [];
    expect(String(message)).toMatch(/unsupported function/i);
  });
});

