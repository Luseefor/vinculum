import type { Camera, Scene, Vector2 } from "three";

/** The engine's shared drawing contract. Scene/picking helpers depend on the
 * methods they use, rather than on a particular GPU backend implementation. */
export interface GraphRenderer {
  readonly domElement: HTMLCanvasElement;
  readonly shadowMap: { enabled: boolean };
  render(scene: Scene, camera: Camera): void;
  getSize(target: Vector2): Vector2;
  setViewport(x: number, y: number, width: number, height: number): void;
  setScissor(x: number, y: number, width: number, height: number): void;
  setScissorTest(enabled: boolean): void;
  dispose(): void;
}
