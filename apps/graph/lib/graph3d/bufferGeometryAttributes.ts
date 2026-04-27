import { BufferAttribute, BufferGeometry } from "three";

export function updateFloat32Attribute(
  geometry: BufferGeometry,
  key: "position",
  data: Float32Array,
  itemSize: number
) {
  const existing = geometry.getAttribute(key);
  if (
    existing instanceof BufferAttribute &&
    existing.array instanceof Float32Array &&
    existing.itemSize === itemSize &&
    existing.array.length === data.length
  ) {
    existing.array.set(data);
    existing.needsUpdate = true;
    return;
  }

  geometry.setAttribute(key, new BufferAttribute(data, itemSize));
}

export function updateIndexAttribute(geometry: BufferGeometry, data: Uint16Array | Uint32Array) {
  const existing = geometry.getIndex();
  if (
    existing instanceof BufferAttribute &&
    (existing.array instanceof Uint16Array || existing.array instanceof Uint32Array) &&
    existing.array.constructor === data.constructor &&
    existing.array.length === data.length
  ) {
    existing.array.set(data);
    existing.needsUpdate = true;
    return;
  }

  geometry.setIndex(new BufferAttribute(data, 1));
}

export function updateIndexAttributeUint32(geometry: BufferGeometry, data: Uint32Array) {
  const existing = geometry.getIndex();
  if (
    existing instanceof BufferAttribute &&
    existing.array instanceof Uint32Array &&
    existing.array.length === data.length
  ) {
    existing.array.set(data);
    existing.needsUpdate = true;
    return;
  }

  geometry.setIndex(new BufferAttribute(data, 1));
}
