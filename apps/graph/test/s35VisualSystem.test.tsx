import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FactRow } from "@/components/inspector/FactRow";
import { StatusCallout } from "@/components/ui/StatusCallout";

describe("S35 status and fact presentation", () => {
  it("renders FactRow with aligned value", () => {
    render(<FactRow label="Distance" value="4" testId="fact-distance" />);
    expect(screen.getByText("Distance")).toBeInTheDocument();
    expect(screen.getByTestId("fact-distance")).toHaveTextContent("4");
  });

  it("exposes distinct status tones without painting panels", () => {
    const { rerender } = render(
      <StatusCallout tone="error" testId="status">
        Invalid expression
      </StatusCallout>
    );
    expect(screen.getByTestId("status")).toHaveAttribute("data-tone", "error");

    rerender(
      <StatusCallout tone="warning" testId="status">
        Convergence warning
      </StatusCallout>
    );
    expect(screen.getByTestId("status")).toHaveAttribute("data-tone", "warning");

    rerender(
      <StatusCallout tone="pending" testId="status">
        Updating…
      </StatusCallout>
    );
    expect(screen.getByTestId("status")).toHaveAttribute("data-tone", "pending");

    rerender(
      <StatusCallout tone="neutral" testId="status">
        No real eigendirections.
      </StatusCallout>
    );
    expect(screen.getByTestId("status")).toHaveAttribute("data-tone", "neutral");
  });
});
