import type { Page } from "@playwright/test";
import { unpackStoredScene } from "../../lib/scene/sceneCompression";
import type { SceneDocument } from "../../lib/scene/sceneSchema";

/** Inspect the persisted recovery through the same transport codec as the app. */
export async function readRecoveryScene(page: Page): Promise<SceneDocument | null> {
  const json = await page.evaluate(() => {
    const raw = localStorage.getItem("vinculum-unnamed-scene-recovery-v1");
    return raw ? JSON.parse(raw).sceneJson as string : null;
  });
  return json ? JSON.parse(unpackStoredScene(json)) as SceneDocument : null;
}
