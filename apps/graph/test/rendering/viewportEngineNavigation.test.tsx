import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import GraphCanvas from "@/components/graph/GraphCanvas";
import GeometryViewport from "@/components/viewport/GeometryViewport";
import { requestCanvasFrame } from "@/lib/interaction/canvasFrameRequests";

const engine = vi.hoisted(() => ({
  ready: Promise.resolve(),
  setGeometryPanes: vi.fn(),
  setActiveGeometryView: vi.fn(),
  setSuspended: vi.fn(),
  frameSelectedObject: vi.fn(),
  fitSceneToView: vi.fn(),
  dispose: vi.fn()
}));
vi.mock("@/lib/graph3d/GraphThreeEngine", () => ({ createGraphThreeEngine: () => engine }));
vi.mock("@/components/viewport/CanvasEmptyState", () => ({ default: () => null }));

beforeEach(() => vi.clearAllMocks());

it("uses the engine's orthographic YZ camera for the quad side projection", async () => {
  render(<GraphCanvas projectionPlane="yz" />);
  await waitFor(() => expect(screen.queryByText("Starting 3D renderer…")).toBeNull());
  expect(engine.setGeometryPanes).toHaveBeenCalledWith(["yz"]);
  expect(screen.getByText("3D projection")).toBeVisible();
  expect(screen.getByText("YZ")).toBeVisible();
});

it.each([GraphCanvas, GeometryViewport])("leaves a suspended viewport's camera alone when another view is framed", async Component => {
  const view = render(<Component suspended />);
  await waitFor(() => expect(screen.queryByText("Starting 3D renderer…")).toBeNull());
  requestCanvasFrame("scene");
  requestCanvasFrame("selected");
  expect(engine.fitSceneToView).not.toHaveBeenCalled();
  expect(engine.frameSelectedObject).not.toHaveBeenCalled();
  view.rerender(<Component />);
  requestCanvasFrame("scene");
  requestCanvasFrame("selected");
  expect(engine.fitSceneToView).toHaveBeenCalledTimes(1);
  expect(engine.frameSelectedObject).toHaveBeenCalledTimes(1);
});
