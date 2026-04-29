export const MAX_SCENE_JSON_LENGTH = 1_000_000;
export const MAX_SCENE_OBJECT_COUNT = 500;
export const MAX_SCENE_MEASUREMENT_COUNT = 2_000;
export const MAX_SCENE_GROUP_COUNT = 300;
export const MAX_SCENE_CONSTRAINT_COUNT = 2_000;
export const MAX_SCENE_METADATA_NAME_LENGTH = 120;
export const MAX_SCENE_VERSION_LENGTH = 32;
export const MAX_SCENE_LABEL_LENGTH = 160;
export const MAX_SCENE_DOCUMENT_DEPTH = 40;
export const MAX_SCENE_DOCUMENT_NODE_COUNT = 100_000;
export const MAX_SHARE_PAYLOAD_LENGTH = 2_000_000;

export function validateSceneJsonTextLength(json: string): string | null {
  if (json.length > MAX_SCENE_JSON_LENGTH) {
    return `Scene payload is too large. Maximum JSON length is ${MAX_SCENE_JSON_LENGTH} characters.`;
  }
  return null;
}

export function validateSharePayloadLength(payload: string): string | null {
  if (payload.length > MAX_SHARE_PAYLOAD_LENGTH) {
    return "Share link payload is too large. Use JSON export instead.";
  }
  return null;
}

export function validatePayloadDepthAndNodes(payload: unknown): string | null {
  const seen = new WeakSet<object>();
  const queue: Array<{ value: unknown; depth: number }> = [{ value: payload, depth: 0 }];
  let nodeCount = 0;

  while (queue.length > 0) {
    const current = queue.pop();
    if (!current) {
      continue;
    }

    nodeCount += 1;
    if (nodeCount > MAX_SCENE_DOCUMENT_NODE_COUNT) {
      return `Scene payload is too complex. Maximum node count is ${MAX_SCENE_DOCUMENT_NODE_COUNT}.`;
    }
    if (current.depth > MAX_SCENE_DOCUMENT_DEPTH) {
      return `Scene payload nesting is too deep. Maximum depth is ${MAX_SCENE_DOCUMENT_DEPTH}.`;
    }

    const value = current.value;
    if (!value || typeof value !== "object") {
      continue;
    }
    if (seen.has(value)) {
      return "Scene payload contains cyclic-looking references and cannot be imported safely.";
    }
    seen.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        queue.push({ value: item, depth: current.depth + 1 });
      }
      continue;
    }

    for (const nested of Object.values(value)) {
      queue.push({ value: nested, depth: current.depth + 1 });
    }
  }

  return null;
}
