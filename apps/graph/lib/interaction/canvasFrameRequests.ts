// S33 Frame Selected / Fit Scene request bus (UI-only).
//
// EditorShell (palette, shortcuts, context menu) publishes camera-only
// framing requests; viewport owners (GeometryViewport, Math Lab Viewport3D
// where supported) subscribe and drive their engine. No React state, no
// history, no serialization — framing is transient camera presentation.

export type CanvasFrameRequestKind = "selected" | "scene";

type CanvasFrameListener = (kind: CanvasFrameRequestKind) => void;

const listeners = new Set<CanvasFrameListener>();

export function subscribeCanvasFrameRequests(listener: CanvasFrameListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestCanvasFrame(kind: CanvasFrameRequestKind): void {
  for (const listener of [...listeners]) {
    try {
      listener(kind);
    } catch {
      // One viewport's failure must not block the others.
    }
  }
}

/** Test seam: subscriber count. */
export function canvasFrameRequestSubscriberCount(): number {
  return listeners.size;
}
