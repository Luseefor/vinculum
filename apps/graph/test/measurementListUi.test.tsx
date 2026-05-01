import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import ObjectBrowserPanel from "@/components/layout/ObjectBrowserPanel";
import { useGraphStore } from "@/store/graphStore";

describe("measurement list UI", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
    useGraphStore.getState().setCanvas2dTool("addPin");
    useGraphStore.getState().setProbePinnedMath({ horizontal: 1, vertical: 1 });
  });

  it("exposes an accessible delete button and removes a measurement", () => {
    render(<ObjectBrowserPanel width={320} />);
    fireEvent.click(screen.getByRole("button", { name: "measurements" }));
    const deleteButton = screen.getByRole("button", { name: /Delete measurement pin/i });
    expect(deleteButton).toBeInTheDocument();
    fireEvent.click(deleteButton);
    expect(useGraphStore.getState().scene.measurements).toHaveLength(0);
  });
});
