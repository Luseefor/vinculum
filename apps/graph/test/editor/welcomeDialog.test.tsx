import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import FirstRunHint, { canvasNavHint, firstRunCopy } from "@/components/onboarding/FirstRunHint";

describe("FirstRunHint", () => {
  it("renders non-blocking getting-started tips for Geometry", () => {
    const onDismiss = vi.fn();
    render(
      <FirstRunHint
        open={true}
        workspace="geometry"
        error={null}
        onDismiss={onDismiss}
        onOpenExamples={vi.fn()}
      />
    );

    expect(screen.getByTestId("first-run-hint")).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: /getting started/i })).toBeInTheDocument();
    expect(screen.getByText(firstRunCopy("geometry").title)).toBeInTheDocument();
    expect(screen.getByText(/Drag to orbit/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("uses Math Lab copy and touch navigation hints", () => {
    render(
      <FirstRunHint
        open={true}
        workspace="math"
        error={null}
        touchHints
        canvasMode="math"
        onDismiss={vi.fn()}
        onOpenExamples={vi.fn()}
      />
    );

    expect(screen.getByText(firstRunCopy("math").title)).toBeInTheDocument();
    expect(screen.getByText(canvasNavHint("math", true))).toBeInTheDocument();
  });

  it("exposes a named dismiss control", () => {
    const onDismiss = vi.fn();
    render(
      <FirstRunHint
        open={true}
        workspace="geometry"
        error={null}
        onDismiss={onDismiss}
        onOpenExamples={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /dismiss getting started tips/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <FirstRunHint
        open={false}
        workspace="geometry"
        error={null}
        onDismiss={vi.fn()}
        onOpenExamples={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
