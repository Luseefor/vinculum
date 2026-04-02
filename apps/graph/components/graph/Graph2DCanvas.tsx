"use client";

import { useRef, useEffect, useCallback } from "react";
import { useGraphStore } from "@/store/graphStore";
import type { GraphObject, SurfaceGraphObject } from "@vinculum/scene/types";
import { parse, compile } from "mathjs";

interface Graph2DCanvasProps {
  className?: string;
}

interface DrawContext {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  scale: number;
}

export function Graph2DCanvas({ className = "" }: Graph2DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const objects = useGraphStore((state) => state.scene.objects);
  const viewport = useGraphStore((state) => state.ui.viewport2d);
  const updateViewport2D = useGraphStore((state) => state.updateViewport2D);
  
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Convert screen coordinates to math coordinates
  const screenToMath = useCallback((screenX: number, screenY: number, dc: DrawContext) => {
    const mathX = (screenX - dc.width / 2) / dc.scale + dc.centerX;
    const mathY = -(screenY - dc.height / 2) / dc.scale + dc.centerY;
    return { x: mathX, y: mathY };
  }, []);

  // Convert math coordinates to screen coordinates
  const mathToScreen = useCallback((mathX: number, mathY: number, dc: DrawContext) => {
    const screenX = (mathX - dc.centerX) * dc.scale + dc.width / 2;
    const screenY = -(mathY - dc.centerY) * dc.scale + dc.height / 2;
    return { x: screenX, y: screenY };
  }, []);

  // Draw the coordinate grid
  const drawGrid = useCallback((dc: DrawContext) => {
    const { ctx, width, height, centerX, centerY, scale } = dc;
    
    // Calculate visible range
    const minX = centerX - width / (2 * scale);
    const maxX = centerX + width / (2 * scale);
    const minY = centerY - height / (2 * scale);
    const maxY = centerY + height / (2 * scale);
    
    // Determine grid spacing based on zoom level
    const targetSpacing = 60; // pixels between grid lines
    const rawSpacing = targetSpacing / scale;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawSpacing)));
    const normalized = rawSpacing / magnitude;
    
    let gridSpacing: number;
    if (normalized < 2) gridSpacing = magnitude;
    else if (normalized < 5) gridSpacing = 2 * magnitude;
    else gridSpacing = 5 * magnitude;
    
    // Minor grid
    ctx.strokeStyle = "#252528";
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    const minorSpacing = gridSpacing / 5;
    for (let x = Math.floor(minX / minorSpacing) * minorSpacing; x <= maxX; x += minorSpacing) {
      const screen = mathToScreen(x, 0, dc);
      ctx.moveTo(screen.x, 0);
      ctx.lineTo(screen.x, height);
    }
    for (let y = Math.floor(minY / minorSpacing) * minorSpacing; y <= maxY; y += minorSpacing) {
      const screen = mathToScreen(0, y, dc);
      ctx.moveTo(0, screen.y);
      ctx.lineTo(width, screen.y);
    }
    ctx.stroke();
    
    // Major grid
    ctx.strokeStyle = "#3a3a40";
    ctx.lineWidth = 1;
    ctx.beginPath();
    
    for (let x = Math.floor(minX / gridSpacing) * gridSpacing; x <= maxX; x += gridSpacing) {
      const screen = mathToScreen(x, 0, dc);
      ctx.moveTo(screen.x, 0);
      ctx.lineTo(screen.x, height);
    }
    for (let y = Math.floor(minY / gridSpacing) * gridSpacing; y <= maxY; y += gridSpacing) {
      const screen = mathToScreen(0, y, dc);
      ctx.moveTo(0, screen.y);
      ctx.lineTo(width, screen.y);
    }
    ctx.stroke();
    
    // Axes
    ctx.strokeStyle = "#6a6a75";
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // X axis
    const yAxisScreen = mathToScreen(0, 0, dc);
    if (yAxisScreen.y >= 0 && yAxisScreen.y <= height) {
      ctx.moveTo(0, yAxisScreen.y);
      ctx.lineTo(width, yAxisScreen.y);
    }
    
    // Y axis
    const xAxisScreen = mathToScreen(0, 0, dc);
    if (xAxisScreen.x >= 0 && xAxisScreen.x <= width) {
      ctx.moveTo(xAxisScreen.x, 0);
      ctx.lineTo(xAxisScreen.x, height);
    }
    ctx.stroke();
    
    // Axis labels
    ctx.fillStyle = "#8a8a95";
    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    
    // X axis labels
    for (let x = Math.floor(minX / gridSpacing) * gridSpacing; x <= maxX; x += gridSpacing) {
      if (Math.abs(x) < 1e-10) continue; // Skip 0
      const screen = mathToScreen(x, 0, dc);
      const labelY = Math.min(Math.max(yAxisScreen.y + 4, 4), height - 14);
      ctx.fillText(formatNumber(x), screen.x, labelY);
    }
    
    // Y axis labels
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let y = Math.floor(minY / gridSpacing) * gridSpacing; y <= maxY; y += gridSpacing) {
      if (Math.abs(y) < 1e-10) continue; // Skip 0
      const screen = mathToScreen(0, y, dc);
      const labelX = Math.min(Math.max(xAxisScreen.x - 4, 30), width - 4);
      ctx.fillText(formatNumber(y), labelX, screen.y);
    }
    
    // Origin label
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    if (xAxisScreen.x > 20 && xAxisScreen.x < width - 20 &&
        yAxisScreen.y > 20 && yAxisScreen.y < height - 20) {
      ctx.fillText("0", xAxisScreen.x - 4, yAxisScreen.y + 4);
    }
  }, [mathToScreen]);

  // Parse and evaluate a 2D expression
  const evaluateExpression = useCallback((expr: string, x: number): number | null => {
    try {
      // Replace z= with nothing for surface equations
      let cleanExpr = expr.replace(/^z\s*=\s*/i, "").trim();
      
      // For 2D, we evaluate with y=0 to get z=f(x)
      // Or we treat it as y=f(x) directly
      const compiled = compile(cleanExpr);
      const result = compiled.evaluate({ x, y: 0, t: 0 });
      
      if (typeof result === "number" && isFinite(result)) {
        return result;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  // Draw a single graph object
  const drawGraph = useCallback((obj: GraphObject, dc: DrawContext) => {
    if (!obj.visible) return;
    
    const { ctx, width, scale, centerX } = dc;
    
    // Get the expression based on object kind
    let expr = "";
    if (obj.kind === "surface") {
      expr = (obj as SurfaceGraphObject).equation;
    } else if (obj.kind === "plane") {
      expr = (obj as any).equation || "";
    }
    
    if (!expr) return;
    
    ctx.strokeStyle = obj.color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    
    const minX = centerX - width / (2 * scale);
    const maxX = centerX + width / (2 * scale);
    const step = (maxX - minX) / (width * 0.5); // ~2 pixels per sample
    
    let isFirst = true;
    let lastY: number | null = null;
    
    for (let x = minX; x <= maxX; x += step) {
      const y = evaluateExpression(expr, x);
      
      if (y === null) {
        isFirst = true;
        lastY = null;
        continue;
      }
      
      // Check for discontinuity
      if (lastY !== null && Math.abs(y - lastY) > 50 / scale) {
        isFirst = true;
      }
      
      const screen = mathToScreen(x, y, dc);
      
      if (isFirst) {
        ctx.moveTo(screen.x, screen.y);
        isFirst = false;
      } else {
        ctx.lineTo(screen.x, screen.y);
      }
      
      lastY = y;
    }
    
    ctx.stroke();
  }, [evaluateExpression, mathToScreen]);

  // Main draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    
    ctx.scale(dpr, dpr);
    
    const dc: DrawContext = {
      ctx,
      width: rect.width,
      height: rect.height,
      centerX: viewport.centerX,
      centerY: viewport.centerY,
      scale: viewport.scale
    };
    
    // Clear canvas
    ctx.fillStyle = "#131316";
    ctx.fillRect(0, 0, dc.width, dc.height);
    
    // Draw grid
    drawGrid(dc);
    
    // Draw all visible graphs
    for (const obj of objects) {
      drawGraph(obj, dc);
    }
  }, [viewport, objects, drawGrid, drawGraph]);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const dc: DrawContext = {
      ctx: null as any,
      width: rect.width,
      height: rect.height,
      centerX: viewport.centerX,
      centerY: viewport.centerY,
      scale: viewport.scale
    };
    
    // Get mouse position in math coordinates before zoom
    const mathPos = screenToMath(mouseX, mouseY, dc);
    
    // Calculate new scale
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(1, Math.min(1000, viewport.scale * zoomFactor));
    
    // Calculate new center to keep mouse position fixed
    const newCenterX = mathPos.x - (mouseX - rect.width / 2) / newScale;
    const newCenterY = mathPos.y + (mouseY - rect.height / 2) / newScale;
    
    updateViewport2D({
      scale: newScale,
      centerX: newCenterX,
      centerY: newCenterY
    });
  }, [viewport, screenToMath, updateViewport2D]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    
    lastMouse.current = { x: e.clientX, y: e.clientY };
    
    updateViewport2D({
      centerX: viewport.centerX - dx / viewport.scale,
      centerY: viewport.centerY + dy / viewport.scale
    });
  }, [viewport, updateViewport2D]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Set up canvas and event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [handleWheel]);

  // Redraw on viewport or objects change
  useEffect(() => {
    draw();
  }, [draw]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => draw();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [draw]);

  return (
    <div 
      ref={containerRef}
      className={`w-full h-full ${className}`}
      style={{ touchAction: "none" }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}

function formatNumber(n: number): string {
  if (Math.abs(n) < 1e-10) return "0";
  if (Math.abs(n) >= 1000 || Math.abs(n) < 0.001) {
    return n.toExponential(1);
  }
  // Remove trailing zeros
  return parseFloat(n.toPrecision(4)).toString();
}
