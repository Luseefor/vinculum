import type { Camera, Scene } from "three";

/** The engine's shared drawing contract. Scene/picking helpers depend on the
 * methods they use, rather than on a particular GPU backend implementation. */
export interface GraphRenderer {
  readonly domElement: HTMLCanvasElement;
  readonly shadowMap: { enabled: boolean };
  render(scene: Scene, camera: Camera): void;
  setViewport(x: number, y: number, width: number, height: number): void;
  setScissor(x: number, y: number, width: number, height: number): void;
  setScissorTest(enabled: boolean): void;
  dispose(): void;
}
