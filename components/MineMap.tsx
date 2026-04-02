"use client";
import { useEffect, useRef, useState } from "react";

type MineMapProps = {
  data: any[];
  selectedIds: Set<number>;
  onMultiSelect: (ids: Set<number>, strategy?: "replace" | "toggle" | "add") => void;
};

export default function MineMap({ data, selectedIds, onMultiSelect }: MineMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // --- STATE ---
  const [camera, setCamera] = useState({ x: 0, y: 0, zoom: 1 });
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 }); // Track real size
  
  const interaction = useRef({
    isPanning: false,
    isSelecting: false,
    startX: 0, startY: 0, currX: 0, currY: 0,
  });

  const [refreshKey, setRefreshKey] = useState(0);

  // --- HANDLE RESIZE & LAYOUT ---
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (canvasRef.current) {
            canvasRef.current.width = width;
            canvasRef.current.height = height;
        }
        // Update state to trigger re-render and potential auto-fit
        setCanvasSize({ w: width, h: height });
        setRefreshKey(k => k + 1);
      }
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // ---  SMART AUTO-FIT ---
  // Only fit when we have Data AND a valid Canvas Size
  useEffect(() => {
    if (data.length > 0 && canvasSize.w > 0 && canvasSize.h > 0) {
      // Only auto-fit if the camera is currently at the default starting position
      // This prevents resetting the view if the user is just resizing the window
      if (camera.zoom === 1 && camera.x === 0 && camera.y === 0) {
          autoFitCamera(data, canvasSize.w, canvasSize.h);
      }
    }
  }, [data, canvasSize]); // Depend on size changes too!

  // ---  MAIN RENDER LOOP ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    //. BACKGROUND
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f0f0f"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    //  GRID
    drawGrid(ctx, canvas.width, canvas.height, camera);

    //  SORT OBJECTS 
    // Explicitly typed arrays to solve implicit 'any[]' error
    const unselected: any[] = [];
    const selected: any[] = [];
    
    data.forEach(item => {
      if (selectedIds.has(item.id)) selected.push(item);
      else unselected.push(item);
    });

    // Draw Unselected (Dim)
    ctx.globalAlpha = 0.6;
    unselected.forEach(item => drawObject(ctx, item, false, canvas.height));
    ctx.globalAlpha = 1.0;

    // Draw Selected (Bright & Top)
    selected.forEach(item => drawObject(ctx, item, true, canvas.height));

    // SELECTION BOX
    if (interaction.current.isSelecting) {
      const { startX, startY, currX, currY } = interaction.current;
      const rectX = Math.min(startX, currX);
      const rectY = Math.min(startY, currY);
      const rectW = Math.abs(currX - startX);
      const rectH = Math.abs(currY - startY);

      ctx.save();
      ctx.strokeStyle = "#fff";
      ctx.setLineDash([5, 3]);
      ctx.strokeRect(rectX, rectY, rectW, rectH);
      ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
      ctx.fillRect(rectX, rectY, rectW, rectH);
      ctx.restore();
    }

  }, [data, camera, selectedIds, refreshKey, canvasSize]);

  // --- DRAWING LOGIC ---
  const drawObject = (ctx: CanvasRenderingContext2D, item: any, isSelected: boolean, h: number) => {
    const prop = item.properties || {};
    ctx.beginPath();

    // High Contrast Colors
    if (isSelected) {
      ctx.strokeStyle = "#FFD700"; // Gold
      ctx.lineWidth = 3; 
    } else {
      if (item.layer === "Vỉa Than") ctx.strokeStyle = "#ff4757"; // Red
      else if (item.layer === "Lỗ Khoan") ctx.strokeStyle = "#1e90ff"; // Blue
      else ctx.strokeStyle = "#747d8c"; // Grey
      ctx.lineWidth = 1;
    }

    const points = prop.FlattenedVertices || prop.Vertices;

    if (points && points.length > 0) {
      // Polygon / LineString
      points.forEach((v: number[], i: number) => {
        const p = worldToScreen(v[0], v[1], h);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (prop.Closed) ctx.closePath();
    } else if (prop.StartPoint && prop.EndPoint) {
      // Line Segment
      const s = worldToScreen(prop.StartPoint[0], prop.StartPoint[1], h);
      const e = worldToScreen(prop.EndPoint[0], prop.EndPoint[1], h);
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(e.x, e.y);
    } else if (prop.Location) {
      // Point / Text
      const p = worldToScreen(prop.Location[0], prop.Location[1], h);
      // Draw a small crosshair for points so they are visible even at low zoom
      const size = 3; 
      ctx.moveTo(p.x - size, p.y); ctx.lineTo(p.x + size, p.y);
      ctx.moveTo(p.x, p.y - size); ctx.lineTo(p.x, p.y + size);
    }

    ctx.stroke();
  };

  const drawGrid = (ctx: CanvasRenderingContext2D, w: number, h: number, cam: any) => {
    ctx.strokeStyle = "#222"; 
    ctx.lineWidth = 1; 
    ctx.beginPath();
    
    // Adaptive Grid
    let gridSize = 50 * cam.zoom;
    if (gridSize < 15) gridSize *= 10; // Prevent ultra-dense grid
    if (gridSize > 300) gridSize /= 5;

    const offsetX = cam.x % gridSize;
    const offsetY = (h - cam.y) % gridSize;

    for (let x = offsetX; x < w; x += gridSize) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (let y = offsetY; y < h; y += gridSize) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
  };

  // --- UTILS ---
  const worldToScreen = (wx: number, wy: number, h: number) => ({
    x: (wx * camera.zoom) + camera.x,
    y: h - ((wy * camera.zoom) + camera.y)
  });

  const autoFitCamera = (items: any[], viewW: number, viewH: number) => {
    if (items.length === 0) return;
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    // Calculate Bounds
    items.forEach(item => {
      const p = item.properties;
      const check = (x: number, y: number) => {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      };
      if (p.FlattenedVertices) p.FlattenedVertices.forEach((v: any) => check(v[0], v[1]));
      else if (p.Vertices) p.Vertices.forEach((v: any) => check(v[0], v[1]));
      else if (p.StartPoint) { check(p.StartPoint[0], p.StartPoint[1]); check(p.EndPoint[0], p.EndPoint[1]); }
    });

    if (minX === Infinity) return;

    const dataW = maxX - minX || 100;
    const dataH = maxY - minY || 100;

    const scale = Math.min(viewW / dataW, viewH / dataH) * 0.9;
    
    // Center point of the data
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    // Calculate Pan to center the data
    // Screen X = (World X * Scale) + Cam X
    // We want Screen X to be ViewW/2 when World X is CX
    // ViewW/2 = (CX * Scale) + Cam X  =>  Cam X = ViewW/2 - CX * Scale
    setCamera({
      zoom: scale,
      x: (viewW / 2) - (cx * scale),
      y: (viewH / 2) - (cy * scale),
    });
  };

  // --- MOUSE HANDLERS ---
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const x = e.nativeEvent.offsetX;
    const y = e.nativeEvent.offsetY;

    if (e.button === 0) { // Left: Select
      interaction.current.isSelecting = true;
      interaction.current.startX = x; interaction.current.startY = y;
      interaction.current.currX = x; interaction.current.currY = y;
    } else if (e.button === 1) { // Middle: Pan
      interaction.current.isPanning = true;
      interaction.current.startX = e.clientX;
      interaction.current.startY = e.clientY;
      document.body.style.cursor = "move";
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (interaction.current.isPanning) {
      const dx = e.clientX - interaction.current.startX;
      const dy = e.clientY - interaction.current.startY;
      interaction.current.startX = e.clientX;
      interaction.current.startY = e.clientY;
      setCamera(p => ({ ...p, x: p.x + dx, y: p.y - dy }));
    } else if (interaction.current.isSelecting) {
      interaction.current.currX = e.nativeEvent.offsetX;
      interaction.current.currY = e.nativeEvent.offsetY;
      setRefreshKey(k => k + 1);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (interaction.current.isSelecting) calculateSelection(e.ctrlKey || e.metaKey);
    interaction.current.isPanning = false;
    interaction.current.isSelecting = false;
    document.body.style.cursor = "default";
    setRefreshKey(k => k + 1);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Slower, smoother zoom
    const zoomIntensity = 0.1;
    const direction = e.deltaY > 0 ? -1 : 1;
    const factor = 1 + (zoomIntensity * direction);
    const newZoom = Math.max(0.00001, Math.min(camera.zoom * factor, 10000));
    
    // Zoom towards cursor
    const wx = (mouseX - camera.x) / camera.zoom;
    const wy = (rect.height - mouseY - camera.y) / camera.zoom;

    const newCamX = mouseX - (wx * newZoom);
    const newCamY = (rect.height - mouseY) - (wy * newZoom);

    setCamera({ zoom: newZoom, x: newCamX, y: newCamY });
  };

  const calculateSelection = (isMulti: boolean) => {
    const { startX, startY, currX, currY } = interaction.current;
    const minX = Math.min(startX, currX); const maxX = Math.max(startX, currX);
    const minY = Math.min(startY, currY); const maxY = Math.max(startY, currY);
    const isClick = (maxX - minX) < 5 && (maxY - minY) < 5;
    
    const foundIds = new Set<number>();
    const h = canvasRef.current!.height;

    data.forEach(item => {
        const prop = item.properties;
        const points = prop.FlattenedVertices || prop.Vertices || (prop.StartPoint ? [prop.StartPoint] : []);
        let hit = false;
        
        for (const v of points) {
            const p = worldToScreen(v[0], v[1], h);
            if (isClick) {
                if (Math.abs(p.x - minX) < 10 && Math.abs(p.y - minY) < 10) { hit = true; break; }
            } else {
                if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) { hit = true; break; }
            }
        }
        if (hit) foundIds.add(item.id);
    });

    onMultiSelect(foundIds, isMulti ? "toggle" : "replace");
  };

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#0f0f0f]" onContextMenu={(e) => e.preventDefault()}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        className="block touch-none"
        style={{ width: "100%", height: "100%" }}
      />
      <div className="absolute bottom-1 left-1 text-[10px] text-gray-500 font-mono pointer-events-none">
         Z: {camera.zoom.toExponential(2)} | X: {camera.x.toFixed(0)} | Y: {camera.y.toFixed(0)}
      </div>
    </div>
  );
}