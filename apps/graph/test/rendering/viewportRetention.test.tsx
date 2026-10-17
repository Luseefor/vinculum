import { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import ViewportHost from "@/components/viewport/ViewportHost";

vi.mock("@/components/viewport/CanvasEmptyState", () => ({ default: () => null }));

it("lazily mounts one 3D viewport, retains it across mode changes, and suspends hidden views", () => {
  const mount = vi.fn();
  const dispose = vi.fn();
  function View({ name, suspended }: { name: string; suspended?: boolean }) {
    useEffect(() => { mount(name); return () => dispose(name); }, [name]);
    return <div data-testid={name} data-suspended={String(Boolean(suspended))}>{name}</div>;
  }
  const props = { workspaceId: "math" as const, viewport2d: <View name="2d" />, viewport3d: <View name="3d" /> };
  const view = render(<ViewportHost {...props} mode="2d" />);
  expect(screen.queryByTestId("3d")).toBeNull();
  view.rerender(<ViewportHost {...props} mode="3d" />);
  expect(screen.getByTestId("3d")).toBeVisible();
  expect(screen.getByTestId("2d")).not.toBeVisible();
  expect(screen.getByTestId("2d")).toHaveAttribute("data-suspended", "true");
  view.rerender(<ViewportHost {...props} mode="split" />);
  expect(screen.getByTestId("2d")).toBeVisible();
  expect(screen.getByTestId("3d")).toBeVisible();
  view.rerender(<ViewportHost {...props} mode="2d" />);
  expect(screen.getByTestId("3d")).not.toBeVisible();
  expect(screen.getByTestId("3d")).toHaveAttribute("data-suspended", "true");
  view.rerender(<ViewportHost {...props} mode="3d" />);
  expect(mount.mock.calls).toEqual([["2d"], ["3d"]]);
  expect(dispose).not.toHaveBeenCalled();
  view.unmount();
  expect(dispose).toHaveBeenCalledTimes(2);
});

it("preserves workspace suspension when the visible viewport is already suspended", () => {
  function View({ suspended }: { suspended?: boolean }) { return <div data-testid="3d" data-suspended={String(suspended)} />; }
  render(<ViewportHost workspaceId="math" mode="3d" viewport2d={null} viewport3d={<View suspended />} />);
  expect(screen.getByTestId("3d")).toHaveAttribute("data-suspended", "true");
});

it("retains all four distinct views across quad, split, and single layouts", () => {
  const mount = vi.fn();
  const dispose = vi.fn();
  function View({ name, suspended }: { name: string; suspended?: boolean }) {
    useEffect(() => { mount(name); return () => dispose(name); }, [name]);
    return <div data-testid={name} data-suspended={String(Boolean(suspended))} />;
  }
  const props = {
    workspaceId: "math" as const,
    viewport2d: <View name="primary" />,
    viewport3d: <View name="perspective" />,
    viewport3dQuadSide: <View name="yz-projection" />,
    viewport2dQuadTop: <View name="xz-graph" />
  };
  const view = render(<ViewportHost {...props} mode="split" />);
  expect(mount).toHaveBeenCalledTimes(2);
  view.rerender(<ViewportHost {...props} mode="quad" />);
  for (const name of ["primary", "perspective", "yz-projection", "xz-graph"]) {
    expect(screen.getByTestId(name)).toBeVisible();
  }
  expect(mount).toHaveBeenCalledTimes(4);
  view.rerender(<ViewportHost {...props} mode="3d" />);
  for (const name of ["primary", "yz-projection", "xz-graph"]) {
    expect(screen.getByTestId(name)).not.toBeVisible();
    expect(screen.getByTestId(name)).toHaveAttribute("data-suspended", "true");
  }
  view.rerender(<ViewportHost {...props} mode="quad" />);
  expect(mount).toHaveBeenCalledTimes(4);
  expect(dispose).not.toHaveBeenCalled();
  view.unmount();
  expect(dispose).toHaveBeenCalledTimes(4);
});

it("resizes the split with a keyboard and keeps the divider within its limits", () => {
  render(<ViewportHost workspaceId="math" mode="split" viewport2d={null} viewport3d={null} />);
  const divider = screen.getByRole("separator", { name: "Resize 2D and 3D views" });
  fireEvent.keyDown(divider, { key: "ArrowRight" });
  expect(divider).toHaveAttribute("aria-valuenow", "52");
  fireEvent.keyDown(divider, { key: "End" });
  fireEvent.keyDown(divider, { key: "ArrowRight" });
  expect(divider).toHaveAttribute("aria-valuenow", "72");
  fireEvent.keyDown(divider, { key: "Home" });
  fireEvent.keyDown(divider, { key: "ArrowLeft" });
  expect(divider).toHaveAttribute("aria-valuenow", "28");
});
