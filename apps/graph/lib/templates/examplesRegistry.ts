import { createParametricCurve } from "@/lib/graph/createParametricCurve";
import { createPlaneGraph } from "@/lib/graph/createPlaneGraph";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { createSceneDocument, type SceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";

export type ExampleCategory = "Surfaces" | "Planes" | "Parametric curves" | "Sketch examples";
export type ExampleRecommendedMode = "2d" | "3d";

export interface SceneExampleDefinition {
  id: string;
  title: string;
  description: string;
  category: ExampleCategory;
  recommendedMode: ExampleRecommendedMode;
  createScene: () => SceneDocument;
}

export const SCENE_EXAMPLES: SceneExampleDefinition[] = [
  {
    id: "surface-sphere",
    title: "Sphere Surface",
    description: "Implicit sphere centered at the origin.",
    category: "Surfaces",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Sphere Surface" },
        objects: [createSurfaceGraph({ equation: "x^2 + y^2 + z^2 - 9" })]
      })
  },
  {
    id: "surface-saddle",
    title: "Saddle Surface",
    description: "Hyperbolic paraboloid for curvature exploration.",
    category: "Surfaces",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Saddle Surface" },
        objects: [createSurfaceGraph({ equation: "z - (x^2 - y^2)/2" })]
      })
  },
  {
    id: "plane-tilted",
    title: "Tilted Plane",
    description: "Single plane with a non-axis-aligned normal.",
    category: "Planes",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Tilted Plane" },
        objects: [createPlaneGraph({ equation: "x + 2y + z - 3" })]
      })
  },
  {
    id: "curve-helix",
    title: "Helix Curve",
    description: "Classic 3D helix parameterized by t.",
    category: "Parametric curves",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Helix Curve" },
        objects: [
          createParametricCurve({
            xExpr: "cos(t)",
            yExpr: "sin(t)",
            zExpr: "t / 3",
            tMin: 0,
            tMax: 6 * Math.PI,
            samples: 300
          })
        ]
      })
  },
  {
    id: "curve-lissajous",
    title: "Lissajous Curve",
    description: "Oscillating parametric curve with mixed frequencies.",
    category: "Parametric curves",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Lissajous Curve" },
        objects: [
          createParametricCurve({
            xExpr: "sin(3*t)",
            yExpr: "sin(4*t + pi/2)",
            zExpr: "cos(2*t)",
            tMin: 0,
            tMax: 2 * Math.PI,
            samples: 320
          })
        ]
      })
  },
  {
    id: "sketch-style-wave",
    title: "Sketch-style Wave",
    description: "2D-style fitted polynomial curve sample.",
    category: "Sketch examples",
    recommendedMode: "2d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Sketch-style Wave" },
        objects: [
          createParametricCurve({
            xExpr: "t",
            yExpr: "0.15*t^3 - 0.8*t",
            zExpr: "0",
            tMin: -4,
            tMax: 4,
            samples: 240
          })
        ]
      })
  }
];

export function getSceneExampleById(exampleId: string): SceneExampleDefinition | null {
  return SCENE_EXAMPLES.find((example) => example.id === exampleId) ?? null;
}

export function createValidatedSceneExample(example: SceneExampleDefinition): {
  ok: true;
  scene: SceneDocument;
} | {
  ok: false;
  error: string;
} {
  const scene = example.createScene();
  const parsed = deserializeScene(serializeScene(scene));
  if (!parsed.valid || !parsed.normalizedScene) {
    return {
      ok: false,
      error: `Example "${example.title}" is invalid: ${parsed.errors.join(" ")}`
    };
  }
  return {
    ok: true,
    scene: parsed.normalizedScene
  };
}
