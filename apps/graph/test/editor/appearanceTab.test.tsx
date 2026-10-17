import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import AppearanceTab from "@/components/inspector/AppearanceTab";
import { useGraphStore } from "@/store/graphStore";

describe("AppearanceTab", () => {
  beforeEach(() => {
    useGraphStore.getState().resetScene();
  });

  it("shows empty state without selection", () => {
    render(<AppearanceTab />);
    expect(screen.getByText("Select an object to edit style controls.")).toBeInTheDocument();
  });

  it("updates selected parametric curve color", () => {
    const id = useGraphStore.getState().addParametricCurve();
    useGraphStore.getState().selectObject(id);

    const view = render(<AppearanceTab />);
    const colorInput = view.container.querySelector('input[type="color"]') as HTMLInputElement | null;
    expect(colorInput).not.toBeNull();

    fireEvent.change(colorInput!, { target: { value: "#112233" } });

    const object = useGraphStore.getState().scene.objects.find((entry) => entry.id === id);
    expect(object?.color).toBe("#112233");
  });

  it("toggles plane wireframe from appearance tab", () => {
    const id = useGraphStore.getState().addPlaneObject();
    useGraphStore.getState().selectObject(id);

    render(<AppearanceTab />);
    const wireframeSwitch = screen.getByRole("switch", { name: "Toggle Wireframe" });
    fireEvent.click(wireframeSwitch);

    const object = useGraphStore.getState().scene.objects.find((entry) => entry.id === id);
    expect(object?.kind).toBe("plane");
    if (object?.kind === "plane") {
      expect(object.appearance.wireframe).toBe(true);
    }
  });
});
