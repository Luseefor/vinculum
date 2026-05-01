import { type RefObject, useEffect, useRef } from "react";
import type { Viewport2DFrame } from "@/types/graphUi";

type SetFrame = (frame: Viewport2DFrame) => void;

export function useGraph2dCanvasPaintSchedule(args: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLElement | null>;
  setFrameForCanvas: SetFrame;
  draw: () => void;
}): void {
  const { canvasRef, containerRef, setFrameForCanvas, draw } = args;

  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => drawRef.current());
    return () => window.cancelAnimationFrame(frame);
  }, [draw]);

  useEffect(() => {
    let resizeRaf = 0;

    const flushDraw = () => {
      resizeRaf = 0;
      drawRef.current();
    };

    const scheduleDraw = () => {
      if (resizeRaf === 0) {
        resizeRaf = window.requestAnimationFrame(flushDraw);
      }
    };

    const handleResize = () => {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        setFrameForCanvas({ width: rect.width, height: rect.height });
      }
      scheduleDraw();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeRaf !== 0) {
        window.cancelAnimationFrame(resizeRaf);
      }
    };
  }, [containerRef, setFrameForCanvas]);
}
