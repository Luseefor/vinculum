import { OrthographicCamera, Vector3 } from "three";
import { ORTHO_CAMERA_ORIENTATION } from "./graphThreeGeometryViews";
import type { GeometryView } from "@/lib/types/ui";
import type { PaneRect } from "./graphThreeGeometryViews";

export type OrthoView = Exclude<GeometryView, "perspective">;

export const DEFAULT_ORTHO_SPAN = 12;
const MIN_ORTHO_SPAN = 0.05;
const MAX_ORTHO_SPAN = 60_000;
const ORTHO_CAMERA_DISTANCE = 100;
const ORTHO_NEAR = -30_000;
const ORTHO_FAR = 30_000;

interface OrthoViewState {
  center: Vector3;
  span: number;
}

function createDefaultOrthoState(): OrthoViewState {
  return { center: new Vector3(0, 0, 0), span: DEFAULT_ORTHO_SPAN };
}

/**
 * Engine-owned orthographic cameras for Geometry Studio panes.
 * World-frame state (center target + min-dimension span); the shared scene
 * is never touched. Cameras hold no GL resources and need no disposal.
 */
export class GeometryOrthoController {
  private readonly cameras = new Map<OrthoView, OrthographicCamera>();
  private readonly states = new Map<OrthoView, OrthoViewState>();

  getCamera(view: OrthoView): OrthographicCamera {
    let camera = this.cameras.get(view);
    if (!camera) {
      camera = new OrthographicCamera(-1, 1, 1, -1, ORTHO_NEAR, ORTHO_FAR);
      this.cameras.set(view, camera);
    }
    return camera;
  }

  getState(view: OrthoView): OrthoViewState {
    let state = this.states.get(view);
    if (!state) {
      state = createDefaultOrthoState();
      this.states.set(view, state);
    }
    return state;
  }

  /** Fit the frustum to a pane rect preserving mathematical scale (no stretch). */
  updateFrustum(view: OrthoView, rect: PaneRect): void {
    const camera = this.getCamera(view);
    const state = this.getState(view);
    const safeWidth = Math.max(1, rect.width);
    const safeHeight = Math.max(1, rect.height);
    const halfMin = state.span / 2;
    if (safeWidth >= safeHeight) {
      const halfWidth = halfMin * (safeWidth / safeHeight);
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.top = halfMin;
      camera.bottom = -halfMin;
    } else {
      const halfHeight = halfMin * (safeHeight / safeWidth);
      camera.left = -halfMin;
      camera.right = halfMin;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
    }
    const orientation = ORTHO_CAMERA_ORIENTATION[view];
    camera.position.set(
      state.center.x + orientation.positionDirection[0] * ORTHO_CAMERA_DISTANCE,
      state.center.y + orientation.positionDirection[1] * ORTHO_CAMERA_DISTANCE,
      state.center.z + orientation.positionDirection[2] * ORTHO_CAMERA_DISTANCE
    );
    camera.up.set(orientation.up[0], orientation.up[1], orientation.up[2]);
    camera.lookAt(state.center);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }

  /** Grab-pan: content follows the pointer. Positive dx moves content right. */
  panByPixels(view: OrthoView, dxPixels: number, dyPixels: number, rect: PaneRect): void {
    const camera = this.getCamera(view);
    const state = this.getState(view);
    camera.updateMatrixWorld();
    const worldPerPixel = state.span / Math.max(1, Math.min(rect.width, rect.height));
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    state.center.addScaledVector(right, -dxPixels * worldPerPixel);
    state.center.addScaledVector(up, dyPixels * worldPerPixel);
  }

  /** Center zoom; factor > 1 zooms out. Clamped to scene-safe extents. */
  zoomByFactor(view: OrthoView, factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      return;
    }
    const state = this.getState(view);
    state.span = Math.min(MAX_ORTHO_SPAN, Math.max(MIN_ORTHO_SPAN, state.span * factor));
  }

  resetView(view: OrthoView): void {
    const state = this.getState(view);
    state.center.set(0, 0, 0);
    state.span = DEFAULT_ORTHO_SPAN;
  }
}
