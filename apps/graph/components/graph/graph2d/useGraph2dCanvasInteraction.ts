import {
  type Dispatch,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import type { Active2dViewportSlot, Axis2DPair, Canvas2DTool, GraphProbePin, Viewport2D } from "@/types/graphUi";
import { SKETCH_SAMPLE_MIN_SCREEN_PX, ZOOM_IN_FACTOR, ZOOM_OUT_FACTOR } from "./graph2dCanvasConstants";
import { finalizeGraph2dSketchStroke } from "./graph2dCanvasInteractionFinishStroke";
import { graph2dViewportPatchZoomAtScreen } from "./graph2dCanvasInteractionZoom";
import { findNearestProbePinScreen } from "./graph2dCanvasProbes";
import { snapGraph2dMathPoint } from "./graph2dCanvasSnapMath";
import type { MousePosition, SketchFitPreview } from "./graph2dCanvasTypes";
import { graph2dMathToScreen, graph2dScreenToMath } from "./graph2dCanvasTransforms";

export type UseGraph2dCanvasInteractionArgs = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  isQuadTop: boolean;
  canvas2dTool: Canvas2DTool;
  viewport: Viewport2D;
  pairForCanvas: Axis2DPair;
  axis2dPairQuadTop: Axis2DPair;
  snapEnabled: boolean;
  snapStep: number;
  probePins: GraphProbePin[];
  sketchAutoCreate: boolean;
  patchViewport2D: (viewport: Partial<Viewport2D>) => void;
  setActive2dViewport: (slot: Active2dViewportSlot) => void;
  setProbePinnedMath: (point: { horizontal: number; vertical: number } | null) => void;
  removeProbePin: (id: string) => void;
  clearProbes: () => void;
  addSketchedParametricFromStroke: (stroke: { horizontal: number; vertical: number }[], axisPair?: Axis2DPair) => string;
};

export type Graph2dCanvasInteractionHandlers = {
  onContextMenu: (event: MouseEvent<HTMLCanvasElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: (event: PointerEvent<HTMLCanvasElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLCanvasElement>) => void;
  onDoubleClick: (event: PointerEvent<HTMLCanvasElement>) => void;
};

export function useGraph2dCanvasInteraction(
  args: UseGraph2dCanvasInteractionArgs
): {
  mousePos: MousePosition | null;
  sketchDraft: { horizontal: number; vertical: number }[] | null;
  sketchFitPreview: SketchFitPreview | null;
  setSketchFitPreview: Dispatch<SetStateAction<SketchFitPreview | null>>;
  canvasHandlers: Graph2dCanvasInteractionHandlers;
} {
  const {
    canvasRef,
    isQuadTop,
    canvas2dTool,
    viewport,
    pairForCanvas,
    axis2dPairQuadTop,
    snapEnabled,
    snapStep,
    probePins,
    sketchAutoCreate,
    patchViewport2D,
    setActive2dViewport,
    setProbePinnedMath,
    removeProbePin,
    clearProbes,
    addSketchedParametricFromStroke
  } = args;

  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const activePointerId = useRef<number | null>(null);
  const isSketching = useRef(false);
  const lastSketchScreen = useRef<{ x: number; y: number } | null>(null);
  const sketchAccumRef = useRef<{ horizontal: number; vertical: number }[]>([]);

  const [mousePos, setMousePos] = useState<MousePosition | null>(null);
  const [sketchDraft, setSketchDraft] = useState<{ horizontal: number; vertical: number }[] | null>(null);
  const [sketchFitPreview, setSketchFitPreview] = useState<SketchFitPreview | null>(null);

  const zoomAtScreenPoint = useCallback(
    (mouseX: number, mouseY: number, factor: number, width: number, height: number) => {
      patchViewport2D(graph2dViewportPatchZoomAtScreen(mouseX, mouseY, factor, width, height, viewport));
    },
    [patchViewport2D, viewport]
  );

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      setActive2dViewport(isQuadTop ? "quadTop" : "primary");

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      zoomAtScreenPoint(
        mouseX,
        mouseY,
        e.deltaY > 0 ? ZOOM_OUT_FACTOR : ZOOM_IN_FACTOR,
        rect.width,
        rect.height
      );
    },
    [canvasRef, isQuadTop, setActive2dViewport, zoomAtScreenPoint]
  );

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (event.pointerType === "mouse" && event.button !== 0) {
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      if (isQuadTop && canvas2dTool !== "pan") {
        return;
      }

      setActive2dViewport(isQuadTop ? "quadTop" : "primary");

      const rect = canvas.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const rawMath = graph2dScreenToMath(screenX, screenY, rect.width, rect.height, viewport);
      const mathCoords =
        snapEnabled &&
        (canvas2dTool === "probe" ||
          canvas2dTool === "draw" ||
          canvas2dTool === "measureDistance" ||
          canvas2dTool === "measureAngle" ||
          canvas2dTool === "addPin")
          ? snapGraph2dMathPoint(rawMath, snapEnabled, snapStep)
          : rawMath;

      if (
        canvas2dTool === "probe" ||
        canvas2dTool === "addPin" ||
        canvas2dTool === "measureDistance" ||
        canvas2dTool === "measureAngle"
      ) {
        setProbePinnedMath({
          horizontal: mathCoords.horizontal,
          vertical: mathCoords.vertical
        });
        return;
      }

      if (canvas2dTool === "draw") {
        isSketching.current = true;
        lastSketchScreen.current = { x: screenX, y: screenY };
        activePointerId.current = event.pointerId;
        const first = { horizontal: mathCoords.horizontal, vertical: mathCoords.vertical };
        sketchAccumRef.current = [first];
        setSketchDraft([first]);
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }

      isDragging.current = true;
      lastMouse.current = { x: event.clientX, y: event.clientY };
      activePointerId.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [canvas2dTool, canvasRef, isQuadTop, setActive2dViewport, setProbePinnedMath, snapEnabled, snapStep, viewport]
  );

  const handleContextMenu = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      event.preventDefault();
      event.stopPropagation();
      if (
        isQuadTop ||
        (canvas2dTool !== "probe" &&
          canvas2dTool !== "addPin" &&
          canvas2dTool !== "measureDistance" &&
          canvas2dTool !== "measureAngle")
      ) {
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const dc = {
        width: rect.width,
        height: rect.height,
        centerX: viewport.centerX,
        centerY: viewport.centerY,
        scale: viewport.scale
      };
      const hit = findNearestProbePinScreen(probePins, pairForCanvas, x, y, dc, graph2dMathToScreen);
      if (hit) {
        removeProbePin(hit.id);
      }
    },
    [canvas2dTool, canvasRef, isQuadTop, pairForCanvas, probePins, removeProbePin, viewport.centerX, viewport.centerY, viewport.scale]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const screenX = event.clientX - rect.left;
      const screenY = event.clientY - rect.top;
      const rawMath = graph2dScreenToMath(screenX, screenY, rect.width, rect.height, viewport);
      const snappedMath = snapGraph2dMathPoint(rawMath, snapEnabled, snapStep);
      const mathCoords =
        snapEnabled &&
        (canvas2dTool === "probe" ||
          canvas2dTool === "draw" ||
          canvas2dTool === "measureDistance" ||
          canvas2dTool === "measureAngle" ||
          canvas2dTool === "addPin")
          ? snappedMath
          : rawMath;

      setMousePos({
        screen: { x: screenX, y: screenY },
        math: mathCoords
      });

      if (
        canvas2dTool === "draw" &&
        isSketching.current &&
        event.pointerId === activePointerId.current &&
        lastSketchScreen.current
      ) {
        const dx = screenX - lastSketchScreen.current.x;
        const dy = screenY - lastSketchScreen.current.y;
        if (Math.hypot(dx, dy) >= SKETCH_SAMPLE_MIN_SCREEN_PX) {
          lastSketchScreen.current = { x: screenX, y: screenY };
          const point = { horizontal: mathCoords.horizontal, vertical: mathCoords.vertical };
          sketchAccumRef.current = [...sketchAccumRef.current, point];
          setSketchDraft([...sketchAccumRef.current]);
        }
        return;
      }

      if (!isDragging.current || event.pointerId !== activePointerId.current) {
        return;
      }

      const moveDx = event.clientX - lastMouse.current.x;
      const moveDy = event.clientY - lastMouse.current.y;
      lastMouse.current = { x: event.clientX, y: event.clientY };

      patchViewport2D({
        centerX: viewport.centerX - moveDx / viewport.scale,
        centerY: viewport.centerY + moveDy / viewport.scale
      });
    },
    [canvas2dTool, canvasRef, snapEnabled, snapStep, patchViewport2D, viewport]
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (activePointerId.current !== event.pointerId) {
        return;
      }

      if (canvas2dTool === "draw" && isSketching.current) {
        isSketching.current = false;
        lastSketchScreen.current = null;
        activePointerId.current = null;

        const stroke = sketchAccumRef.current;
        sketchAccumRef.current = [];
        setSketchDraft(null);

        finalizeGraph2dSketchStroke({
          stroke,
          sketchAutoCreate,
          isQuadTop,
          axis2dPairQuadTop,
          addSketchedParametricFromStroke,
          setSketchFitPreview
        });

        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // Pointer may already be released (e.g. touch cancelled by OS).
        }

        return;
      }

      isDragging.current = false;
      activePointerId.current = null;

      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer may already be released (e.g. touch cancelled by OS).
      }
    },
    [addSketchedParametricFromStroke, axis2dPairQuadTop, canvas2dTool, isQuadTop, sketchAutoCreate]
  );

  const handlePointerLeave = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    setMousePos(null);
    if (activePointerId.current === event.pointerId) {
      isDragging.current = false;
      activePointerId.current = null;
    }
  }, []);

  const handlePointerCancel = useCallback((event: PointerEvent<HTMLCanvasElement>) => {
    if (activePointerId.current === event.pointerId) {
      isDragging.current = false;
      isSketching.current = false;
      lastSketchScreen.current = null;
      activePointerId.current = null;
      sketchAccumRef.current = [];
      setSketchDraft(null);
    }
  }, []);

  const handleDoubleClick = useCallback(
    (event: PointerEvent<HTMLCanvasElement>) => {
      if (canvas2dTool === "draw") {
        return;
      }

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      setActive2dViewport(isQuadTop ? "quadTop" : "primary");

      const rect = canvas.getBoundingClientRect();
      zoomAtScreenPoint(event.clientX - rect.left, event.clientY - rect.top, 1.5, rect.width, rect.height);
    },
    [canvas2dTool, canvasRef, isQuadTop, setActive2dViewport, zoomAtScreenPoint]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [canvasRef, handleWheel]);

  useEffect(() => {
    if (canvas2dTool !== "draw") {
      isSketching.current = false;
      lastSketchScreen.current = null;
      sketchAccumRef.current = [];
      setSketchDraft(null);
      setSketchFitPreview(null);
    }
  }, [canvas2dTool]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      clearProbes();
      if (canvas2dTool === "draw") {
        isSketching.current = false;
        lastSketchScreen.current = null;
        sketchAccumRef.current = [];
        setSketchDraft(null);
        setSketchFitPreview(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canvas2dTool, clearProbes]);

  const canvasHandlers = useMemo(
    () => ({
      onContextMenu: handleContextMenu,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerLeave: handlePointerLeave,
      onPointerCancel: handlePointerCancel,
      onDoubleClick: handleDoubleClick
    }),
    [
      handleContextMenu,
      handleDoubleClick,
      handlePointerCancel,
      handlePointerDown,
      handlePointerLeave,
      handlePointerMove,
      handlePointerUp
    ]
  );

  return {
    mousePos,
    sketchDraft,
    sketchFitPreview,
    setSketchFitPreview,
    canvasHandlers
  };
}
