// S30 central object-creation descriptors (UI metadata only).
//
// Every creation surface (Quick Add, Add Object menu, Command Palette,
// viewport context menu, Convert menu) renders from THIS module. Labels,
// categories, workspace ordering, command ids, and search aliases live here
// exactly once so the surfaces cannot drift apart.
//
// This is presentation metadata only: it carries no mathematical semantics,
// no scene state, and no renderer/worker/persistence behavior. Canonical
// object semantics stay frozen in @vinculum/scene and the S29 engine.

import type { GraphObjectKind } from "@vinculum/scene/types";

export type ObjectDescriptorCategory = "graphs" | "fields" | "geometry" | "linear-algebra";

export type PaletteCategory = "Create" | "View" | "Workspace" | "Object" | "Scene";

export interface ObjectDescriptor {
  /** Stable creation key (kind + dimension where applicable). */
  key: string;
  kind: GraphObjectKind;
  dimension?: "2d" | "3d";
  /** Canonical creation label, e.g. "Parametric Curve". */
  label: string;
  /** Existing graphStore runCommand id (unchanged by S30). */
  commandId: string;
  /** Command-palette label, e.g. "Add Parametric Curve". */
  commandLabel: string;
  /** Extra palette search terms (mathematical synonyms). */
  aliases: string[];
  /** Creation catalog category. */
  category: ObjectDescriptorCategory;
  /** Add Object menu section (Graphs/Primitives). Templates/Analysis items stay bespoke. */
  menuSection: "Graphs" | "Primitives";
  /** Quick Add rank in Geometry Studio (null = behind More). */
  geometryQuickRank: number | null;
  /** Quick Add rank in Math Lab (null = behind More). */
  mathQuickRank: number | null;
}

export const OBJECT_DESCRIPTORS: readonly ObjectDescriptor[] = [
  {
    key: "surface",
    kind: "surface",
    label: "Surface",
    commandId: "add-surface",
    commandLabel: "Add Surface",
    aliases: ["surface", "function", "graph", "explicit"],
    category: "graphs",
    menuSection: "Graphs",
    geometryQuickRank: 5,
    mathQuickRank: 0
  },
  {
    key: "parametricCurve",
    kind: "parametricCurve",
    label: "Parametric Curve",
    commandId: "add-curve",
    commandLabel: "Add Parametric Curve",
    aliases: ["curve", "parametric", "line", "path"],
    category: "graphs",
    menuSection: "Graphs",
    geometryQuickRank: null,
    mathQuickRank: 1
  },
  {
    key: "parametricSurface",
    kind: "parametricSurface",
    label: "Parametric Surface",
    commandId: "add-parametric-surface",
    commandLabel: "Add Parametric Surface",
    aliases: ["parametric", "surface", "uv"],
    category: "graphs",
    menuSection: "Graphs",
    geometryQuickRank: null,
    mathQuickRank: null
  },
  {
    key: "implicitSurface",
    kind: "implicitSurface",
    label: "Implicit Surface",
    commandId: "add-implicit-surface",
    commandLabel: "Add Implicit Surface",
    aliases: ["implicit", "surface", "level set", "sphere", "torus"],
    category: "graphs",
    menuSection: "Graphs",
    geometryQuickRank: null,
    mathQuickRank: 2
  },
  {
    key: "vectorField-2d",
    kind: "vectorField",
    dimension: "2d",
    label: "2D Vector Field",
    commandId: "add-2d-vector-field",
    commandLabel: "Add 2D Vector Field",
    aliases: ["field", "vector field", "flow", "2d", "planar"],
    category: "fields",
    menuSection: "Graphs",
    geometryQuickRank: null,
    mathQuickRank: 4
  },
  {
    key: "vectorField-3d",
    kind: "vectorField",
    dimension: "3d",
    label: "3D Vector Field",
    commandId: "add-3d-vector-field",
    commandLabel: "Add 3D Vector Field",
    aliases: ["field", "vector field", "flow", "3d"],
    category: "fields",
    menuSection: "Graphs",
    geometryQuickRank: null,
    mathQuickRank: 3
  },
  {
    key: "plane",
    kind: "plane",
    label: "Plane",
    commandId: "add-plane",
    commandLabel: "Add Plane",
    aliases: ["plane", "slice", "flat"],
    category: "geometry",
    menuSection: "Primitives",
    geometryQuickRank: 4,
    mathQuickRank: null
  },
  {
    key: "point",
    kind: "point",
    label: "Point",
    commandId: "add-point",
    commandLabel: "Add Point",
    aliases: ["point", "dot", "coordinate"],
    category: "geometry",
    menuSection: "Primitives",
    geometryQuickRank: 0,
    mathQuickRank: null
  },
  {
    key: "vector",
    kind: "vector",
    label: "Vector",
    commandId: "add-vector",
    commandLabel: "Add Vector",
    aliases: ["vector", "arrow"],
    category: "geometry",
    menuSection: "Primitives",
    geometryQuickRank: 1,
    mathQuickRank: null
  },
  {
    key: "line",
    kind: "line",
    label: "Infinite Line",
    commandId: "add-line",
    commandLabel: "Add Infinite Line",
    aliases: ["line", "infinite", "axis"],
    category: "geometry",
    menuSection: "Primitives",
    geometryQuickRank: 2,
    mathQuickRank: null
  },
  {
    key: "segment",
    kind: "segment",
    label: "Segment",
    commandId: "add-segment",
    commandLabel: "Add Segment",
    aliases: ["segment", "edge", "finite line"],
    category: "geometry",
    menuSection: "Primitives",
    geometryQuickRank: 3,
    mathQuickRank: null
  },
  {
    key: "ray",
    kind: "ray",
    label: "Ray",
    commandId: "add-ray",
    commandLabel: "Add Ray",
    aliases: ["ray", "half line", "direction"],
    category: "geometry",
    menuSection: "Primitives",
    geometryQuickRank: null,
    mathQuickRank: null
  },
  {
    key: "linearTransform-2d",
    kind: "linearTransform",
    dimension: "2d",
    label: "2D Linear Transformation",
    commandId: "add-2d-linear-transform",
    commandLabel: "Add 2D Linear Transformation",
    aliases: ["matrix", "linear", "transform", "2d", "eigen"],
    category: "linear-algebra",
    menuSection: "Graphs",
    geometryQuickRank: null,
    mathQuickRank: 5
  },
  {
    key: "linearTransform-3d",
    kind: "linearTransform",
    dimension: "3d",
    label: "3D Linear Transformation",
    commandId: "add-3d-linear-transform",
    commandLabel: "Add 3D Linear Transformation",
    aliases: ["matrix", "linear", "transform", "3d", "eigen"],
    category: "linear-algebra",
    menuSection: "Graphs",
    geometryQuickRank: null,
    mathQuickRank: null
  }
];

/** Quick Add entries for a workspace, ordered (exactly 6 per S30 Part 7). */
export function quickAddDescriptors(workspace: "geometry" | "math"): ObjectDescriptor[] {
  const rank = workspace === "geometry" ? "geometryQuickRank" : "mathQuickRank";
  return OBJECT_DESCRIPTORS.filter((entry) => entry[rank] !== null).sort(
    (a, b) => (a[rank] ?? 0) - (b[rank] ?? 0)
  );
}

/** Remaining entries behind Quick Add "More", workspace-ordered. */
export function moreAddDescriptors(workspace: "geometry" | "math"): ObjectDescriptor[] {
  const listed = new Set(quickAddDescriptors(workspace).map((entry) => entry.key));
  const rest = OBJECT_DESCRIPTORS.filter((entry) => !listed.has(entry.key));
  if (workspace === "geometry") {
    // Geometry Studio: spatial objects first.
    const priority: Record<ObjectDescriptorCategory, number> = {
      geometry: 0,
      graphs: 1,
      fields: 2,
      "linear-algebra": 3
    };
    return rest.sort((a, b) => priority[a.category] - priority[b.category]);
  }
  // Math Lab: expression/analysis-first ordering.
  const priority: Record<ObjectDescriptorCategory, number> = {
    graphs: 0,
    fields: 1,
    geometry: 2,
    "linear-algebra": 3
  };
  return rest.sort((a, b) => priority[a.category] - priority[b.category]);
}

export function descriptorByCommandId(commandId: string): ObjectDescriptor | null {
  return OBJECT_DESCRIPTORS.find((entry) => entry.commandId === commandId) ?? null;
}

export function descriptorByKey(key: string): ObjectDescriptor | null {
  return OBJECT_DESCRIPTORS.find((entry) => entry.key === key) ?? null;
}
