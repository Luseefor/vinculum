import { describe, expect, it, vi } from "vitest";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { applySceneExampleToEditor } from "@/lib/templates/applySceneExample";

describe("applySceneExampleToEditor", () => {
  it("clears history and project session when applying example", () => {
    const clearHistory = vi.fn();
    const replaceSceneDocument = vi.fn();
    const setGraphMode = vi.fn();
    const setCurrentProjectSession = vi.fn();
    const setProjectAutosaveStatus = vi.fn();
    const scene = createSceneDocument({ objects: [] });

    applySceneExampleToEditor({
      scene,
      recommendedMode: "2d",
      clearHistory,
      replaceSceneDocument,
      setGraphMode,
      setCurrentProjectSession,
      setProjectAutosaveStatus
    });

    expect(clearHistory).toHaveBeenCalledTimes(1);
    expect(replaceSceneDocument).toHaveBeenCalledWith(scene);
    expect(setGraphMode).toHaveBeenCalledWith("2d");
    expect(setCurrentProjectSession).toHaveBeenCalledWith(null);
    expect(setProjectAutosaveStatus).toHaveBeenCalledWith("idle");
  });
});
