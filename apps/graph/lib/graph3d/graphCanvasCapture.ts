/** Capture through the owning engine so GPU canvases are freshly drawn in
 * the same task as toBlob, including WebGL2's unpreserved drawing buffer. */
const captures = new WeakMap<HTMLCanvasElement, () => Promise<Blob | null>>();

export function registerGraphCanvasCapture(canvas: HTMLCanvasElement, capture: () => Promise<Blob | null>): () => void {
  captures.set(canvas, capture);
  return () => { captures.delete(canvas); };
}

export function getGraphCanvasCapture(canvas: HTMLCanvasElement): (() => Promise<Blob | null>) | undefined {
  return captures.get(canvas);
}
