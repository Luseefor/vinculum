import { describe, expect, it } from "vitest";
import { LocalProjectRepository } from "@/lib/projects/localProjectRepository";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { serializeScene } from "@/lib/scene/serializeScene";
import {
  createValidatedSceneExample,
  SCENE_EXAMPLES,
  type SceneExampleDefinition
} from "@/lib/templates/examplesRegistry";

describe("scene examples registry", () => {
  it("every example has required metadata", () => {
    for (const example of SCENE_EXAMPLES) {
      expect(example.id.length).toBeGreaterThan(0);
      expect(example.title.length).toBeGreaterThan(0);
      expect(example.description.length).toBeGreaterThan(0);
      expect(example.category.length).toBeGreaterThan(0);
      expect(["2d", "3d"]).toContain(example.recommendedMode);
      expect(typeof example.createScene).toBe("function");
    }
  });

  it("template ids are unique", () => {
    const ids = SCENE_EXAMPLES.map((example) => example.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every registered example validates through canonical scene pipeline", () => {
    for (const example of SCENE_EXAMPLES) {
      const created = createValidatedSceneExample(example);
      expect(created.ok).toBe(true);
      if (!created.ok) {
        continue;
      }
      const parsed = deserializeScene(serializeScene(created.scene));
      expect(parsed.valid).toBe(true);
    }
  });

  it("opened example can be saved as named project", () => {
    window.localStorage.clear();
    const repository = new LocalProjectRepository();
    const created = createValidatedSceneExample(SCENE_EXAMPLES[0]!);
    if (!created.ok) {
      throw new Error(created.error);
    }
    const saved = repository.saveProject({
      name: `Example ${SCENE_EXAMPLES[0]!.title}`,
      scene: created.scene
    });
    expect(saved.id.length).toBeGreaterThan(0);
    expect(saved.name).toContain("Example");
  });

  it("fails safely for an invalid example scene", () => {
    const invalidExample: SceneExampleDefinition = {
      id: "invalid-example",
      title: "Invalid",
      description: "Intentionally malformed scene payload.",
      category: "Surfaces",
      recommendedMode: "3d",
      createScene: () =>
        ({
          schemaVersion: 1,
          version: "1.0",
          metadata: {
            name: "Invalid",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z"
          },
          objects: [{ kind: "surface", equation: "", visible: true }]
        }) as never
    };
    const created = createValidatedSceneExample(invalidExample);
    expect(created.ok).toBe(false);
    if (!created.ok) {
      expect(created.error).toMatch(/invalid/i);
    }
  });
});
