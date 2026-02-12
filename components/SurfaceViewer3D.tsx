"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import * as THREE from "three";
import { useMemo, useState } from "react";

// --- MESH ---
function MiningMesh({ data, isSelected }: { data: any; isSelected: boolean }) {
  const geometry = useMemo(() => {
    if (!data?.vertices || !data?.indices) {
      console.warn("Missing Geometry Data for ID:", data?.id);
      return null;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.vertices), 3));
    geo.setIndex(data.indices);
    
    // This is vital for the "Solid" look in your friend's image
    geo.computeVertexNormals(); 
    return geo;
  }, [data]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial 
        color={isSelected ? "#FFD700" : "#ff8800"} 
        roughness={0.3} 
        metalness={0.8} 
        side={THREE.DoubleSide}
        wireframe={false} // Change to true to see the grid like your friend
      />
    </mesh>
  );
}
// --- SELECTION LOGIC ---
function SelectionManager({ 
  meshes, selectionBox, onSelect 
}: { 
  meshes: any[], selectionBox: any, onSelect: (ids: Set<number>) => void
}) {
  const { camera, size } = useThree();

  useMemo(() => {
    if (!selectionBox) return;
    const { start, end } = selectionBox;
    const minX = Math.min(start.x, end.x); const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y); const maxY = Math.max(start.y, end.y);
    const isClick = (maxX - minX) < 5 && (maxY - minY) < 5;

    const newSelection = new Set<number>();

    meshes.forEach((meshData) => {
        if (!meshData.vertices || meshData.vertices.length < 3) return;
        const v = new THREE.Vector3(meshData.vertices[0], meshData.vertices[1], meshData.vertices[2]);
        v.project(camera);
        const sx = (v.x * 0.5 + 0.5) * size.width;
        const sy = (-(v.y) * 0.5 + 0.5) * size.height;

        if (isClick) {
            // Loose click detection (approximate)
            if (Math.abs(sx - minX) < 20 && Math.abs(sy - minY) < 20) newSelection.add(meshData.id);
        } else {
            // Box selection
            if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) newSelection.add(meshData.id);
        }
    });
    onSelect(newSelection);
  }, [selectionBox, camera, size, meshes, onSelect]);

  return null;
}

// --- MAIN ---
export default function SurfaceViewer3D({ meshes, selectedIds, onMultiSelect }: { meshes: any[], selectedIds?: Set<number>, onMultiSelect?: (ids: Set<number>) => void }) {
  const safeIds = selectedIds || new Set();
  const safeSelect = onMultiSelect || (() => {});
  
  const [dragStart, setDragStart] = useState<{x:number, y:number} | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{x:number, y:number} | null>(null);
  const [finishedBox, setFinishedBox] = useState<any>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // LEFT MOUSE (0) -> SELECT
    if (e.button === 0) { 
        setDragStart({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
        setDragCurrent({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStart) setDragCurrent({ x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
  };

  const handleMouseUp = () => {
    if (dragStart && dragCurrent) setFinishedBox({ start: dragStart, end: dragCurrent });
    setDragStart(null); setDragCurrent(null);
    setTimeout(() => setFinishedBox(null), 100);
  };

  return (
    <div 
        className="h-full w-full bg-[#111] overflow-hidden relative"
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
    >
      <Canvas shadows camera={{ position: [50, 50, 50], fov: 50 }}>
        <color attach="background" args={["#0a0a0a"]} />
        <OrbitControls 
            makeDefault 
            autoRotate={false}
            mouseButtons={{
                LEFT: undefined, // Disable Left Rotate (Used for Select)
                MIDDLE: THREE.MOUSE.PAN,
                RIGHT: THREE.MOUSE.ROTATE // Right Click to Rotate
            }}
        />
        <Stage intensity={0.5} environment="city" adjustCamera={meshes.length > 0}>
           {meshes.map((m, i) => <MiningMesh key={i} data={m} isSelected={safeIds.has(m.id)} />)}
        </Stage>
        <SelectionManager meshes={meshes} selectionBox={finishedBox} onSelect={safeSelect} />
      </Canvas>
      
      {/* Box Overlay */}
      {dragStart && dragCurrent && (
         <div className="absolute border border-white bg-white/10 pointer-events-none z-50"
           style={{
             left: Math.min(dragStart.x, dragCurrent.x), top: Math.min(dragStart.y, dragCurrent.y),
             width: Math.abs(dragCurrent.x - dragStart.x), height: Math.abs(dragCurrent.y - dragStart.y),
           }}
         />
      )}
    </div>
  );
}