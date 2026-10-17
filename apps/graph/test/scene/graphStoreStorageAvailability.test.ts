import { afterEach, expect, it, vi } from "vitest";

const sessionStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage")!;

afterEach(() => {
  Object.defineProperty(globalThis, "sessionStorage", sessionStorageDescriptor);
  vi.restoreAllMocks();
  vi.resetModules();
  sessionStorage.clear();
  localStorage.clear();
});

it.each(["missing", "blocked"])("initializes and edits in memory when session storage is %s", async availability => {
  vi.resetModules();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  if (availability === "missing") {
    Reflect.deleteProperty(globalThis, "sessionStorage");
  } else {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      get() { throw new DOMException("Storage is blocked", "SecurityError"); }
    });
  }

  const { useGraphStore } = await import("@/store/graphStore");
  const { useEditorStore } = await import("@/lib/store/editorStore");
  const { serializeScene } = await import("@/lib/scene/serializeScene");
  const { deserializeScene } = await import("@/lib/scene/deserializeScene");
  expect(useGraphStore.persist).toBeUndefined();
  useGraphStore.getState().resetScene();
  const result = useGraphStore.getState().commitAutoEquation("y=a*x");
  expect(result.error).toBeNull();
  useEditorStore.getState().setParameterValue("a", 7);
  const restored = deserializeScene(serializeScene(useGraphStore.getState().scene));
  expect(restored.valid).toBe(true);
  expect(restored.normalizedScene?.parameters).toEqual([{ id: "a", value: 7, min: -10, max: 10 }]);
  useGraphStore.getState().removeObject(result.id!);
  expect(useGraphStore.getState().scene.objects).toEqual([]);
});

it("still restores saved scene parameters when session storage is available", async () => {
  sessionStorage.clear();
  localStorage.clear();
  vi.resetModules();
  const original = await import("@/store/graphStore");
  const editor = await import("@/lib/store/editorStore");
  original.useGraphStore.getState().resetScene();
  original.useGraphStore.getState().commitAutoEquation("y=a*x");
  editor.useEditorStore.getState().setParameterValue("a", 7);

  vi.resetModules();
  const { useGraphStore } = await import("@/store/graphStore");
  const { useEditorStore } = await import("@/lib/store/editorStore");
  await useGraphStore.persist.rehydrate();
  expect(useGraphStore.getState().scene.objects[0]).toMatchObject({ equation: "y=a*x" });
  expect(useEditorStore.getState().parameters).toEqual([{ id: "a", value: 7, min: -10, max: 10 }]);
});

it.each(["read failure", "malformed JSON", "read/write failure"])("settles hydration and keeps parameter snapshots live after %s", async failure => {
  vi.resetModules();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: () => {
        if (failure !== "malformed JSON") throw new DOMException("Read denied", "SecurityError");
        return "{";
      },
      setItem: () => {
        if (failure === "read/write failure") throw new DOMException("Write denied", "SecurityError");
      },
      removeItem: () => {
        if (failure === "read/write failure") throw new DOMException("Write denied", "SecurityError");
      },
      clear: () => {}, key: () => null, length: 0
    }
  });
  const { useGraphStore } = await import("@/store/graphStore");
  const { useEditorStore } = await import("@/lib/store/editorStore");
  const { serializeScene } = await import("@/lib/scene/serializeScene");
  const { deserializeScene } = await import("@/lib/scene/deserializeScene");
  await useGraphStore.persist.rehydrate();
  expect(useGraphStore.persist.hasHydrated()).toBe(true);
  expect(() => useGraphStore.persist.clearStorage()).not.toThrow();
  const result = useGraphStore.getState().commitAutoEquation("y=a*x");
  expect(result.error).toBeNull();
  useEditorStore.getState().setParameterValue("a", 7);
  const restored = deserializeScene(serializeScene(useGraphStore.getState().scene));
  expect(restored.valid).toBe(true);
  expect(restored.normalizedScene?.parameters).toEqual([{ id: "a", value: 7, min: -10, max: 10 }]);
});
