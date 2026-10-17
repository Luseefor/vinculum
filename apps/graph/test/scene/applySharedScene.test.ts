import { describe, expect, it, vi } from "vitest";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { applySharedSceneToEditor } from "@/lib/share/applySharedScene";

describe("applySharedSceneToEditor", () => {
  it("replaces scene through canonical path and clears project session", () => {
    const clearHistory = vi.fn();
    const replaceSceneDocument = vi.fn();
    const setCurrentProjectSession = vi.fn();
    const setProjectAutosaveStatus = vi.fn();
    const scene = createSceneDocument();

    applySharedSceneToEditor({
      scene,
      clearHistory,
      replaceSceneDocument,
      setCurrentProjectSession,
      setProjectAutosaveStatus
    });

    expect(clearHistory).toHaveBeenCalledTimes(1);
    expect(replaceSceneDocument).toHaveBeenCalledWith(scene);
    expect(setCurrentProjectSession).toHaveBeenCalledWith(null);
    expect(setProjectAutosaveStatus).toHaveBeenCalledWith("idle");
  });
});
