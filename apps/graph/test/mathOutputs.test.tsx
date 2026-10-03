import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import FieldSolutionView from "@/components/inspector/FieldSolutionView";
import { FactRow } from "@/components/inspector/FactRow";
import { MathExpression, MathText } from "@/components/math/MathExpression";
import { Graph2DCanvasUiViewportRangeBadge } from "@/components/graph/graph2d/Graph2DCanvasUiViewportRangeBadge";
import type { FieldSolution } from "@/lib/math/fieldSolutions";

const solution: FieldSolution = {
  definition: "g = 6*cos(x^2)^2",
  error: null,
  notes: [],
  answers: [{ label: "Gradient", expressions: ["-24*x*cos(x^2)*sin(x^2)", "0"], formula: "∇g = <∂g/∂x, ∂g/∂y>", steps: ["∂g/∂x = -24*x*cos(x^2)*sin(x^2)"], errors: [] }]
};

describe("mathematical outputs", () => {
  it("renders viewport bounds as horizontal intervals instead of column vectors", () => {
    render(<Graph2DCanvasUiViewportRangeBadge axisPair={{ horizontal: "x", vertical: "y", horizontalLabel: "X", verticalLabel: "Y" }} viewportRange={{ horizontalMin: -5, horizontalMax: 5, verticalMin: -3, verticalMax: 3 }} />);
    expect(screen.getByRole("math", { name: "[-5, 5]" })).toBeInTheDocument();
    expect(screen.getByRole("math", { name: "[-3, 3]" })).toBeInTheDocument();
    expect(screen.getByTestId("graph2d-viewport-range-badge").querySelector(".mtable")).toBeNull();
  });

  it("makes clipped short formulas keyboard-scrollable and removes the tab stop when they fit", () => {
    let measure!: ResizeObserverCallback;
    vi.stubGlobal("ResizeObserver", class {
      constructor(callback: ResizeObserverCallback) { measure = callback; }
      observe() {} disconnect() {}
    });
    try {
      render(<MathExpression expression="∂/∂x" latex={String.raw`\frac{\partial}{\partial x}`} />);
      const formula = screen.getByRole("math");
      expect(formula).not.toHaveAttribute("tabindex");
      Object.defineProperties(formula, {
        scrollWidth: { configurable: true, value: 100 },
        clientWidth: { configurable: true, value: 40 }
      });
      act(() => measure([], {} as ResizeObserver));
      expect(formula).toHaveAttribute("tabindex", "0");
      Object.defineProperty(formula, "clientWidth", { value: 100 });
      act(() => measure([], {} as ResizeObserver));
      expect(formula).not.toHaveAttribute("tabindex");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("typesets vector answers and retains the canonical expression as an accessible label", () => {
    render(<FieldSolutionView solution={solution} />);
    const result = screen.getByTestId("symbolic-gradient");
    expect(within(result).getByRole("math", { name: "<-24*x*cos(x^2)*sin(x^2), 0>" })).toBeDefined();
    expect(result.querySelector(".katex")).not.toBeNull();
    expect(result.querySelector(".msupsub")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show gradient solution" }));
    expect(screen.getByRole("math", { name: solution.definition })).toBeDefined();
    expect(screen.getByRole("math", { name: solution.answers[0]!.formula }).querySelector(".katex")).not.toBeNull();
    expect(screen.getByRole("math", { name: solution.answers[0]!.steps[0] })).toBeDefined();
    expect(within(screen.getByTestId("solution-final-answer")).getByRole("math")).toBeDefined();
  });

  it("renders integral operator notation in the worked solution", () => {
    render(<FieldSolutionView solution={{ ...solution, answers: [{ label: "Arc length", expressions: ["2*pi"], formula: "L = ∫ |r′(t)| dt", steps: ["Differentiate the curve components to obtain r′(t)."], errors: [] }] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Show arc length solution" }));
    expect(screen.getByRole("math", { name: "L = ∫ |r′(t)| dt" }).querySelector(".katex")).not.toBeNull();
    expect(screen.getByText("Differentiate the curve components to obtain r′(t).")).toBeDefined();
  });

  it("typesets definitions embedded in a worked explanation without formatting the prose", () => {
    render(<MathText text="Evaluate g = 6*cos(x^2)^2 on the source and multiply by the length or area element." />);
    expect(screen.getByRole("math", { name: "g = 6*cos(x^2)^2" })).toBeDefined();
    expect(screen.getByText(/Evaluate/).textContent).toContain("on the source and multiply by the length or area element.");
  });

  it("typesets polar curl operators and basis notation", () => {
    const formula = "curl F = ∂Fθ/∂r + Fθ/r − (∂Fᵣ/∂θ)/r";
    render(<FieldSolutionView solution={{ ...solution, answers: [{ label: "Scalar curl", expressions: ["2*r"], formula, steps: [], errors: [] }] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Show scalar curl solution" }));
    expect(screen.getByRole("math", { name: formula }).querySelector(".katex")).not.toBeNull();
  });

  it("typesets shared geometric facts while preserving ordinary status prose", () => {
    render(<><FactRow label="v" value="<sqrt(2), 0, 1>" testId="fact-vector" /><FactRow label="Invertible" value="Yes" /></>);
    expect(within(screen.getByTestId("fact-vector")).getByRole("math", { name: "<sqrt(2), 0, 1>" })).toBeDefined();
    expect(screen.getByText("Yes")).toBeDefined();
  });
});
