import { useEffect } from "react";
import { render, screen } from "@testing-library/react";
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
