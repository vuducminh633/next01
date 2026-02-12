"use client";
import { useEffect, useRef, useState } from "react";

type CadProps = {
  type: string; // We ignore this now and trust the data properties
  data: any;    // The 'properties' JSON
};

export default function MeshViewer({ type, data }: CadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wasm, setWasm] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Load Wasm (Standard)
  useEffect(() => {
    // Check if script already exists to prevent duplicate loading
    if (document.getElementById("cad-wasm-script")) {
        // @ts-ignore
        if (window.createCadModule) window.createCadModule().then(setWasm);
        return;
    }

    const script = document.createElement("script");
    script.id = "cad-wasm-script";
    script.src = `/cad_mesher.js?t=${new Date().getTime()}`;
    script.async = true;
    
    script.onload = () => {
      // @ts-ignore
      if (window.createCadModule) {
        // @ts-ignore
        window.createCadModule().then((module) => {
          setWasm(module);
        }).catch(() => setError("Failed to init Wasm"));
      }
    };
    document.body.appendChild(script);
  }, []);

  // 2. Draw Logic
  useEffect(() => {
    if (!wasm || !canvasRef.current || !data) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Reset Canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#2563EB"; // Blue
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();

    let vertices: Float32Array | null = null;
    const SEGMENTS = 64; 

    try {
      // --- CASE 1: CIRCLE (Requires Wasm) ---
      if (data.Radius && data.CenterPoint && !data.StartAngle) {
        const [cx, cy] = data.CenterPoint;
        const ptr = wasm._generate_circle_mesh(cx, cy, data.Radius, SEGMENTS);
        const count = wasm._get_last_count(SEGMENTS);
        vertices = new Float32Array(wasm.HEAPF32.buffer, ptr, count);
      } 
      // --- CASE 2: ARC (Requires Wasm) ---
      else if (data.Radius && data.CenterPoint && data.StartAngle !== undefined) {
        const [cx, cy] = data.CenterPoint;
        const ptr = wasm._generate_arc_mesh(
          cx, cy, data.Radius, 
          data.StartAngle, 
          data.EndAngle || Math.PI * 2, 
          SEGMENTS
        );
        const count = wasm._get_last_count(SEGMENTS);
        vertices = new Float32Array(wasm.HEAPF32.buffer, ptr, count);
      }
      // --- CASE 3: POLYLINE / SHAPE (FlattenedVertices Priority) ---
      // We check for properties directly, so "Vách" or "Vỉa" works automatically.
      else if (data.FlattenedVertices || data.Vertices || (data.StartPoint && data.EndPoint)) {
        
        const rawPoints: number[] = [];

        // Priority 1: High-Res Flattened Vertices
        if (Array.isArray(data.FlattenedVertices) && data.FlattenedVertices.length > 0) {
            data.FlattenedVertices.forEach((v: number[]) => rawPoints.push(v[0], v[1], v[2]||0));
        }
        // Priority 2: Standard Vertices
        else if (Array.isArray(data.Vertices) && data.Vertices.length > 0) {
            data.Vertices.forEach((v: number[]) => rawPoints.push(v[0], v[1], v[2]||0));
        }
        // Priority 3: Simple Line
        else if (data.StartPoint && data.EndPoint) {
            rawPoints.push(...data.StartPoint, ...data.EndPoint);
        }

        if (rawPoints.length > 0) {
            vertices = new Float32Array(rawPoints);
        }
      }

    } catch (err) {
      console.error("Wasm/Data Error:", err);
      return;
    }

    // --- RENDER & AUTO-SCALE ---
    if (vertices && vertices.length > 0) {
      // 1. Calculate Bounds (Min/Max)
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      
      for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i+1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }

      // 2. Calculate Scale to Fit Canvas
      const PADDING = 40;
      const availWidth = canvas.width - PADDING;
      const availHeight = canvas.height - PADDING;
      
      // Prevent divide by zero for single points or straight lines
      const rangeX = (maxX - minX) || 1; 
      const rangeY = (maxY - minY) || 1;
      
      const scaleX = availWidth / rangeX;
      const scaleY = availHeight / rangeY;
      // Choose the smaller scale to maintain aspect ratio
      const scale = Math.min(scaleX, scaleY);

      // 3. Draw with Offset
      // Center the shape in the available space
      const offsetX = (canvas.width - rangeX * scale) / 2;
      const offsetY = (canvas.height - rangeY * scale) / 2;

      for (let i = 0; i < vertices.length; i += 2) {
        const rawX = vertices[i];
        const rawY = vertices[i+1];

        // Transform: (Value - Min) * Scale + Offset
        const screenX = (rawX - minX) * scale + offsetX;
        
        // Flip Y Axis (Canvas 0,0 is top-left, Map 0,0 is bottom-left)
        const screenY = canvas.height - ((rawY - minY) * scale + offsetY);

        if (i === 0) ctx.moveTo(screenX, screenY);
        else ctx.lineTo(screenX, screenY);
      }
      ctx.stroke();
    }

  }, [wasm, data]); // Trigger whenever data changes

  if (error) return <div className="text-red-500 text-xs">{error}</div>;

  return (
    <div className="flex flex-col items-center">
      <div className="border border-gray-200 rounded-lg shadow-sm bg-gray-50 overflow-hidden relative">
        <canvas 
          ref={canvasRef} 
          width={400} 
          height={300} 
          className="block"
        />
        <div className="absolute bottom-2 right-2 text-[10px] text-gray-400 bg-white/80 px-2 rounded">
           2D Preview
        </div>
      </div>
    </div>
  );
}