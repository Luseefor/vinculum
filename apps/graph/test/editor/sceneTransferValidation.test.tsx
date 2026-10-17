import { beforeEach, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SceneImportExportDialog from "@/components/scene/SceneImportExportDialog";
import { useGraphStore } from "@/store/graphStore";
import { createEmptyGraphObject } from "@/store/graphStoreObjectFactory";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";

beforeEach(() => useGraphStore.getState().resetScene());

it("disables copying and downloading invalid JSON with a definition error", () => {
  useGraphStore.getState().addEmptyObject();
  useGraphStore.getState().openSceneDialog("export");
  render(<SceneImportExportDialog />);
  expect(screen.getByRole("button", { name: "Copy" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Download" })).toBeDisabled();
  expect(screen.getByText(/incomplete definition/)).toBeVisible();
});

it("rejects an incomplete import without replacing the current scene", () => {
  useGraphStore.getState().commitAutoEquation("y=x^2");
  const before = useGraphStore.getState().scene;
  useGraphStore.getState().openSceneDialog("import");
  useGraphStore.getState().setSceneDialogDraft(serializeScene(createSceneDocument({ objects: [createEmptyGraphObject("parametricCurve", 0)] })));
  render(<SceneImportExportDialog />);
  fireEvent.click(screen.getByRole("button", { name: "Import" }));
  expect(screen.getByText(/incomplete definition/)).toBeVisible();
  expect(useGraphStore.getState().scene).toBe(before);
});
