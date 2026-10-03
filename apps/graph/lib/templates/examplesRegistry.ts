import { createImplicitSurfaceGraph } from "@/lib/graph/createImplicitSurfaceGraph";
import { createParametricCurve } from "@/lib/graph/createParametricCurve";
import { createParametricSurfaceGraph } from "@/lib/graph/createParametricSurfaceGraph";
import { createPlaneGraph } from "@/lib/graph/createPlaneGraph";
import { createSurfaceGraph } from "@/lib/graph/createSurfaceGraph";
import { createVectorFieldGraph } from "@/lib/graph/createVectorFieldGraph";
import { deserializeScene } from "@/lib/scene/deserializeScene";
import { createSceneDocument, type SceneDocument } from "@/lib/scene/sceneSchema";
import { serializeScene } from "@/lib/scene/serializeScene";

export type ExampleCategory = "Surfaces" | "Planes" | "Parametric curves" | "Parametric surfaces" | "Implicit surfaces" | "Vector fields";
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
    description: "Sphere of radius 3 centered at the origin.",
    category: "Implicit surfaces",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Sphere Surface" },
        objects: [createImplicitSurfaceGraph({ equation: "x^2 + y^2 + z^2 = 9", domain: { xMin: -3.5, xMax: 3.5, yMin: -3.5, yMax: 3.5, zMin: -3.5, zMax: 3.5 }, resolution: 40 })]
      })
  },
  {
    id: "surface-saddle",
    title: "Saddle Surface",
    description: "Saddle that curves upward along X and downward along Y.",
    category: "Surfaces",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Saddle Surface" },
        objects: [createSurfaceGraph({ equation: "z = (x^2 - y^2)/2" })]
      })
  },
  {
    id: "plane-tilted",
    title: "Tilted Plane",
    description: "Tilted plane crossing X and Z at 3, and Y at 1.5.",
    category: "Planes",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Tilted Plane" },
        objects: [createPlaneGraph({ equation: "x + 2*y + z = 3" })]
      })
  },
  {
    id: "curve-helix",
    title: "Helix Curve",
    description: "Three turns around the Z axis, rising steadily as you follow the curve.",
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
    description: "Closed 3D curve combining three oscillations at different frequencies.",
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
    id: "parametric-sphere",
    title: "Parametric Sphere",
    description: "Unit sphere traced by polar and azimuthal angles.",
    category: "Parametric surfaces",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Parametric Sphere" },
        objects: [
          createParametricSurfaceGraph({
            xExpr: "sin(u) * cos(v)",
            yExpr: "sin(u) * sin(v)",
            zExpr: "cos(u)",
            domain: { uMin: 0, uMax: Math.PI, vMin: 0, vMax: 2 * Math.PI },
            resolution: 48
          })
        ]
      })
  },
  {
    id: "parametric-torus",
    title: "Parametric Torus",
    description: "Torus with major radius 2 and minor radius 0.5.",
    category: "Parametric surfaces",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Parametric Torus" },
        objects: [
          createParametricSurfaceGraph({
            xExpr: "(2 + 0.5 * cos(v)) * cos(u)",
            yExpr: "(2 + 0.5 * cos(v)) * sin(u)",
            zExpr: "0.5 * sin(v)",
            domain: { uMin: 0, uMax: 2 * Math.PI, vMin: 0, vMax: 2 * Math.PI },
            resolution: 48
          })
        ]
      })
  },
  {
    id: "parametric-saddle",
    title: "Parametric Saddle",
    description: "Saddle-shaped patch with unequal X and Y ranges.",
    category: "Parametric surfaces",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Parametric Saddle" },
        objects: [
          createParametricSurfaceGraph({
            xExpr: "u",
            yExpr: "v",
            zExpr: "u * v",
            domain: { uMin: -3, uMax: 2, vMin: -2, vMax: 4 },
            resolution: 48
          })
        ]
      })
  },
  {
    id: "implicit-sphere",
    title: "Implicit Sphere",
    description: "Unit sphere defined by an implicit equation. Compare it with Parametric Sphere.",
    category: "Implicit surfaces",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Implicit Sphere" },
        objects: [
          createImplicitSurfaceGraph({
            equation: "x^2 + y^2 + z^2 = 1",
            domain: { xMin: -1.5, xMax: 1.5, yMin: -1.5, yMax: 1.5, zMin: -1.5, zMax: 1.5 },
            resolution: 32
          })
        ]
      })
  },
  {
    id: "implicit-ellipsoid",
    title: "Implicit Ellipsoid",
    description: "Ellipsoid centered at (1, −2, 0.5), with semi-axes 2, 1, and 3.",
    category: "Implicit surfaces",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Implicit Ellipsoid" },
        objects: [
          createImplicitSurfaceGraph({
            equation: "(x - 1)^2 / 4 + (y + 2)^2 + (z - 0.5)^2 / 9 = 1",
            domain: { xMin: -2, xMax: 4, yMin: -4, yMax: 0, zMin: -3, zMax: 4 },
            resolution: 32
          })
        ]
      })
  },
  {
    id: "implicit-torus",
    title: "Implicit Torus",
    description: "Algebraic torus with major radius 2 and minor radius 0.5.",
    category: "Implicit surfaces",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Implicit Torus" },
        objects: [
          createImplicitSurfaceGraph({
            equation: "(x^2 + y^2 + z^2 + 3.75)^2 - 16 * (x^2 + y^2) = 0",
            domain: { xMin: -3, xMax: 3, yMin: -3, yMax: 3, zMin: -1, zMax: 1 },
            resolution: 40
          })
        ]
      })
  },
  {
    id: "implicit-gyroid",
    title: "Implicit Gyroid",
    description: "Repeating curved surface shown inside a finite box.",
    category: "Implicit surfaces",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Implicit Gyroid" },
        objects: [
          createImplicitSurfaceGraph({
            equation: "sin(x) * cos(y) + sin(y) * cos(z) + sin(z) * cos(x) = 0",
            domain: { xMin: -3.2, xMax: 3.2, yMin: -3.2, yMax: 3.2, zMin: -3.2, zMax: 3.2 },
            resolution: 32
          })
        ]
      })
  },
  {
    id: "sketch-style-wave",
    title: "Cubic Curve",
    description: "S-shaped cubic curve in the XY plane.",
    category: "Parametric curves",
    recommendedMode: "2d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "Cubic Curve" },
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
  },
  {
    id: "vector-field-2d-radial",
    title: "2D Radial Field",
    description: "Arrows point away from the origin and grow with distance.",
    category: "Vector fields",
    recommendedMode: "2d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "2D Radial Field" },
        objects: [createVectorFieldGraph({ dimension: "2d", pExpr: "x", qExpr: "y" })]
      })
  },
  {
    id: "vector-field-2d-rotation",
    title: "2D Rotation Field",
    description: "Arrows circulate counterclockwise around the origin.",
    category: "Vector fields",
    recommendedMode: "2d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "2D Rotation Field" },
        objects: [createVectorFieldGraph({ dimension: "2d", pExpr: "-y", qExpr: "x" })]
      })
  },
  {
    id: "vector-field-2d-saddle",
    title: "2D Saddle Field",
    description: "Arrows point outward along X and inward along Y.",
    category: "Vector fields",
    recommendedMode: "2d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "2D Saddle Field" },
        objects: [createVectorFieldGraph({ dimension: "2d", pExpr: "x", qExpr: "-y" })]
      })
  },
  {
    id: "vector-field-3d-radial",
    title: "3D Radial Field",
    description: "Arrows radiate from the origin in all three dimensions.",
    category: "Vector fields",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "3D Radial Field" },
        objects: [createVectorFieldGraph({ dimension: "3d", pExpr: "x", qExpr: "y", rExpr: "z" })]
      })
  },
  {
    id: "vector-field-3d-rotation",
    title: "3D Rotation Field",
    description: "Arrows circulate around the Z axis without a vertical component.",
    category: "Vector fields",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "3D Rotation Field" },
        objects: [createVectorFieldGraph({ dimension: "3d", pExpr: "-y", qExpr: "x", rExpr: "0" })]
      })
  },
  {
    id: "vector-field-3d-nonlinear",
    title: "3D Nonlinear Field",
    description: "Each arrow component varies sinusoidally with a different coordinate.",
    category: "Vector fields",
    recommendedMode: "3d",
    createScene: () =>
      createSceneDocument({
        metadata: { name: "3D Nonlinear Field" },
        objects: [
          createVectorFieldGraph({ dimension: "3d", pExpr: "sin(y)", qExpr: "sin(z)", rExpr: "sin(x)" })
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
