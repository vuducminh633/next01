"use client";
import { useEffect, useRef, useState } from "react";

type CadProps = {
  type: "Circle" | "Arc" | "Polyline" | string;
  data: any; // The 'properties' JSON from your DB (contains Radius, CenterPoint, etc.)
};

export default function MeshViewer({ type, data }: CadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wasm, setWasm] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Load the Wasm Module (Only once)
  useEffect(() => {
    const script = document.createElement("script");
    script.src = `/cad_mesher.js?t=${new Date().getTime()}`;
    script.async = true;
    
    script.onload = () => {
      // Initialize the module using the name we set in EXPORT_NAME
      // @ts-ignore
      if (window.createCadModule) {
        // @ts-ignore
        window.createCadModule().then((module) => {
          setWasm(module);
          console.log("✅ Wasm Module Loaded");
        }).catch((e: any) => setError("Failed to init Wasm"));
      }
    };
    
    script.onerror = () => setError("Failed to load script");
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // 2. Draw whenever data or the Wasm module changes
  useEffect(() => {
    if (!wasm || !canvasRef.current || !data) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // --- SETUP CANVAS ---
    // Clear previous drawing
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set styles
    ctx.strokeStyle = "#2563EB"; // Blue
    ctx.lineWidth = 2;
    ctx.beginPath();

    // --- INTERACT WITH C CODE ---
    let vertices: Float32Array | null = null;
    const SEGMENTS = 64; // Smoothness of curves

    try {
      if (type === "Circle" && data.CenterPoint && data.Radius) {
        const [cx, cy] = data.CenterPoint;
        const r = data.Radius;

        // Call C function: generate_circle_mesh(cx, cy, r, segments)
        // Emscripten adds an underscore (_) to C functions
        const ptr = wasm._generate_circle_mesh(cx, cy, r, SEGMENTS);
        
        // Get the size of the array
        const count = wasm._get_last_count(SEGMENTS);
        
        // Read memory from the Heap (Shared Memory)
        // We create a view on the existing memory buffer
        vertices = new Float32Array(wasm.HEAPF32.buffer, ptr, count);
      
      } else if (type === "Arc" && data.CenterPoint && data.Radius) {
        const [cx, cy] = data.CenterPoint;
        const r = data.Radius;
        
        // Call C function for Arc
        const ptr = wasm._generate_arc_mesh(
          cx, 
          cy, 
          r, 
          data.StartAngle || 0, 
          data.EndAngle || Math.PI, 
          SEGMENTS
        );
        
        const count = wasm._get_last_count(SEGMENTS);
        vertices = new Float32Array(wasm.HEAPF32.buffer, ptr, count);
      }
      else if (type === "Polyline" && Array.isArray(data.Vertices)) {
        // Flatten the array of arrays: [[x,y,z], [x,y,z]] -> [x,y,z, x,y,z]
        const flatArray: number[] = [];
        data.Vertices.forEach((v: any) => {
          if (Array.isArray(v) && v.length >= 2) {
             flatArray.push(v[0], v[1], v[2] || 0);
          }
        });
        vertices = new Float32Array(flatArray);
      }
      else if (type === "Line" && data.StartPoint && data.EndPoint) {
        const flatArray: number[] = [];
        // Push Start Point (X, Y, Z)
        flatArray.push(data.StartPoint[0], data.StartPoint[1], data.StartPoint[2] || 0);
        // Push End Point (X, Y, Z)
        flatArray.push(data.EndPoint[0], data.EndPoint[1], data.EndPoint[2] || 0);

        vertices = new Float32Array(flatArray);
      }
    } catch (err) {
      console.error("Error calling Wasm function:", err);
      return;
    }

    // --- RENDER TO SCREEN ---
    if (vertices && vertices.length > 0) {
      // 1. Auto-Center Logic
      // Find the bounds to center the shape on the canvas
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      
      for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const y = vertices[i+1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }

      // Calculate scale to fit canvas (with padding)
      const padding = 40;
      const rangeX = maxX - minX || 1;
      const rangeY = maxY - minY || 1;
      const scaleX = (canvas.width - padding) / rangeX;
      const scaleY = (canvas.height - padding) / rangeY;
      const scale = Math.min(scaleX, scaleY); // Keep aspect ratio

      // Draw lines
      for (let i = 0; i < vertices.length; i += 3) {
        const rawX = vertices[i];
        const rawY = vertices[i+1];
        // Normalize to 0..1, then scale up, then center
        const screenX = (rawX - minX) * scale + 20;
        // Flip Y because Canvas Y is "down", but CAD Y is usually "up"
        const screenY = canvas.height - ((rawY - minY) * scale + 20);

        if (i === 0) {
          ctx.moveTo(screenX, screenY);
        } else {
          ctx.lineTo(screenX, screenY);
        }
      }
      ctx.stroke();
    }

  }, [wasm, type, data]);

  if (error) return <div className="text-red-500 text-xs">{error}</div>;

  return (
    <div className="flex flex-col items-center">
      <div className="border border-gray-200 rounded-lg shadow-sm bg-white overflow-hidden relative">
        <canvas 
          ref={canvasRef} 
          width={400} 
          height={300} 
          className="bg-gray-50 block" 
        />
        <div className="absolute bottom-2 right-2 text-[10px] text-gray-400 bg-white/80 px-2 rounded">
           Powered by C + Wasm
        </div>
      </div>
    </div>
  );
}