import { afterEach, expect, it, vi } from "vitest";
import { decodeSceneText, encodeSceneText, packStoredScene, unpackStoredScene } from "@/lib/scene/sceneCompression";
import { createSceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import { LocalProjectRepository } from "@/lib/projects/localProjectRepository";
import { buildShareSceneUrl, decodeSharedScenePayload } from "@/lib/share/shareSceneLink";

afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it("compresses canonical Unicode scenes and keeps legacy links and raw storage readable", () => {
  const scene = createSceneDocument({ objects: Array.from({ length: 30 }, (_, i) => createSurfaceGraph({ id: `s${i}`, equation: "x^2+y^2" })) });
  scene.metadata.name = "café θ 🌐";
  const json = serializeScene(scene), packed = encodeSceneText(json);
  expect(packed).toMatch(/^z1\./);
  expect(packed.length).toBeLessThan(json.length / 3);
  expect(decodeSceneText(packed)).toBe(json);
  expect(decodeSceneText(Buffer.from(json).toString("base64url"))).toBe(json);
  expect(unpackStoredScene(json)).toBe(json);
  expect(unpackStoredScene(packStoredScene(json))).toBe(json);
  const link = buildShareSceneUrl({ scene, baseUrl: "https://example.com/" });
  expect(link.ok).toBe(true);
  expect(link.url!.length).toBeLessThan(6000);
  expect(decodeSharedScenePayload(new URL(link.url!).searchParams.get("scene")!).scene?.objects).toEqual(scene.objects);
});

it("rejects truncated, oversized, and dishonest compressed payloads", () => {
  const encoded = encodeSceneText("a".repeat(10000));
  expect(() => decodeSceneText(encoded.replace("z1.10000.", "z1.1."))).toThrow();
  expect(() => decodeSceneText(encoded.slice(0, -5))).toThrow();
  expect(() => decodeSceneText(encoded.replace("z1.10000.", "z1.4000001."))).toThrow();
  expect(() => decodeSceneText("z1.1.%%%" )).toThrow();
});

it("stores compressed projects while exposing canonical JSON and preserves the last save on quota failure", () => {
  const repository = new LocalProjectRepository();
  const scene = createSceneDocument({ objects: [createSurfaceGraph({ equation: "x+y" })] });
  const saved = repository.saveProject({ name: "Backup", scene });
  const previous = localStorage.getItem("vinculum-local-projects-v1")!;
  expect(JSON.parse(previous).projects[0].sceneJson).toMatch(/^z1\./);
  expect(repository.getProject(saved.id)?.sceneJson).toBe(serializeScene(scene));
  const spy = vi.spyOn(window.localStorage, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
  expect(() => repository.saveProject({ projectId: saved.id, name: "Changed", scene })).toThrow(/previous saved data was preserved/);
  spy.mockRestore();
  expect(localStorage.getItem("vinculum-local-projects-v1")).toBe(previous);
  expect(repository.loadProjectScene(saved.id).objects).toEqual(scene.objects);
});
