import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Graph2DCanvas } from "@/components/graph/Graph2DCanvas";
import { useGraphStore } from "@/store/graphStore";

describe("Graph2DCanvas", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("exposes an accessible 2D plot canvas and zoom controls", () => {
    render(<Graph2DCanvas />);

    const canvas = screen.getByRole("img", { name: /2D graph/i });
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute("data-graph2d-canvas", "true");

    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset 2D view" })).toBeInTheDocument();
  });
});
