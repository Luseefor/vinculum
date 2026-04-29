import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import WelcomeDialog from "@/components/onboarding/WelcomeDialog";

describe("WelcomeDialog", () => {
  it("renders onboarding actions and toggles don't show again", () => {
    const onDontShowAgainChange = vi.fn();
    render(
      <WelcomeDialog
        open={true}
        error={null}
        dontShowAgain={false}
        onDontShowAgainChange={onDontShowAgainChange}
        onOpenExamples={vi.fn()}
        onStartBlankScene={vi.fn()}
        onContinue={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole("dialog", { name: /welcome to vinculum/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("checkbox", { name: /don't show again/i }));
    expect(onDontShowAgainChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Open example" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start blank scene" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeInTheDocument();
  });

  it("closes on escape", () => {
    const onClose = vi.fn();
    render(
      <WelcomeDialog
        open={true}
        error={null}
        dontShowAgain={false}
        onDontShowAgainChange={vi.fn()}
        onOpenExamples={vi.fn()}
        onStartBlankScene={vi.fn()}
        onContinue={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
