import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial
} from "three";

export function computeAxisScaleAxes(x: number, y: number, z: number): number {
  const distance = Math.hypot(x, y, z);
  return Math.max(1, Math.min(4_500, distance / 5));
}

export function computeAxisScaleLabels(x: number, y: number, z: number): number {
  const distance = Math.hypot(x, y, z);
  return Math.max(1, Math.min(4_500, distance / 18));
}

export function createAxisGeometry(
  extent: number,
  axisColors: {
    negative: [number, number, number];
    xPositive: [number, number, number];
    yPositive: [number, number, number];
    zPositive: [number, number, number];
  }
): BufferGeometry {
  const segments = [
    { from: [-extent, 0, 0], to: [0, 0, 0], color: axisColors.negative },
    { from: [0, 0, 0], to: [extent, 0, 0], color: axisColors.xPositive },
    { from: [0, -extent, 0], to: [0, 0, 0], color: axisColors.negative },
    { from: [0, 0, 0], to: [0, extent, 0], color: axisColors.yPositive },
    { from: [0, 0, -extent], to: [0, 0, 0], color: axisColors.negative },
    { from: [0, 0, 0], to: [0, 0, extent], color: axisColors.zPositive }
  ] as const;

  const positions: number[] = [];
  const colorBuffer: number[] = [];

  for (const segment of segments) {
    positions.push(...segment.from, ...segment.to);
    colorBuffer.push(...segment.color, ...segment.color);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setAttribute("color", new BufferAttribute(new Float32Array(colorBuffer), 3));
  return geometry;
}

export function createAxisTubeGroup(
  extent: number,
  axisColors: {
    negative: [number, number, number];
    xPositive: [number, number, number];
    yPositive: [number, number, number];
    zPositive: [number, number, number];
  }
): Group {
  const group = new Group();
  const radius = 0.005;
  const half = extent / 2;

  const addTube = (
    colorRgb: [number, number, number],
    position: [number, number, number],
    rotation: [number, number, number]
  ) => {
    const mesh = new Mesh(
      new CylinderGeometry(radius, radius, extent, 10),
      new MeshBasicMaterial({
        color: new Color(colorRgb[0], colorRgb[1], colorRgb[2]),
        transparent: true,
        opacity: 0.98
      })
    );
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    group.add(mesh);
  };

  addTube(axisColors.negative, [-half, 0, 0], [0, 0, Math.PI / 2]);
  addTube(axisColors.xPositive, [half, 0, 0], [0, 0, Math.PI / 2]);
  addTube(axisColors.negative, [0, -half, 0], [0, 0, 0]);
  addTube(axisColors.yPositive, [0, half, 0], [0, 0, 0]);
  addTube(axisColors.negative, [0, 0, -half], [Math.PI / 2, 0, 0]);
  addTube(axisColors.zPositive, [0, 0, half], [Math.PI / 2, 0, 0]);

  return group;
}
