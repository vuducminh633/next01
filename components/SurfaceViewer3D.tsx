"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Stage } from "@react-three/drei";
import * as THREE from "three";
import { useMemo, useState } from "react";

// --- MESH COMPONENT ---
function MiningMesh({ data, isSelected }: { data: any; isSelected: boolean }) {
  const geometry = useMemo(() => {
    if (!data?.vertices || !data?.indices) return null;
    
    // Create geometry from raw data
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.vertices), 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(data.indices), 1));
    geo.computeVertexNormals(); 
    return geo;
  }, [data]);

  if (!geometry) return null;

  return (
    <group>
      {/* 1. The Solid Mesh */}
      <mesh geometry={geometry}>
        <meshPhongMaterial 
          color={isSelected ? "#FFD700" : "#00a8ff"} // Blue color (#00a8ff) matches your reference
          side={THREE.DoubleSide}
          flatShading={false}
          shininess={50}
        />
      </mesh>

      {/* 2. The Wireframe Overlay */}
      <lineSegments>
        <wireframeGeometry args={[geometry]} />
        <lineBasicMaterial color="white" opacity={0.3} transparent linewidth={1} />
      </lineSegments>
    </group>
  );
}

// --- SELECTION MANAGER (Logic to handle click/box selection) ---
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
        
        // Project first vertex to screen space to check if inside box
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

// --- MAIN COMPONENT ---
export default function SurfaceViewer3D({ 
  meshes, 
  selectedIds, 
  onMultiSelect 
}: { 
  meshes: any[], 
  selectedIds?: Set<number>, 
  onMultiSelect?: (ids: Set<number>) => void 
}) {
  const safeIds = selectedIds || new Set();
  const safeSelect = onMultiSelect || (() => {});
  
  // Mouse Drag State for Selection Box
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
        className="h-full w-full bg-[#111] overflow-hidden relative select-none"
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={handleMouseDown} 
        onMouseMove={handleMouseMove} 
        onMouseUp={handleMouseUp}
    >
      <Canvas shadows camera={{ position: [100, 100, 100], fov: 50 }}>
        {/* 1. Background Color (Dark Navy to match reference) */}
        <color attach="background" args={["#1a1a2e"]} />
        
        {/* 2. Controls */}
        <OrbitControls 
            makeDefault 
            mouseButtons={{
                LEFT: undefined, // Disable Left Rotate (Used for Select)
                MIDDLE: THREE.MOUSE.PAN,
                RIGHT: THREE.MOUSE.ROTATE // Right Click to Rotate
            }}
        />
        
        {/* 3. Helpers (Grid & Axes) */}
        <gridHelper args={[500, 50, 0x444444, 0x222222]} />
        <axesHelper args={[100]} />

        {/* 4. Lighting (Matches app.js) */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 100, 50]} intensity={0.8} />
        <directionalLight position={[-100, -100, -50]} intensity={0.4} />

        {/* 5. Render Meshes */}
        <Stage intensity={0} environment={null} adjustCamera={false}>
           {meshes.map((m, i) => (
             <MiningMesh key={i} data={m} isSelected={safeIds.has(m.id)} />
           ))}
        </Stage>
        
        {/* 6. Selection Logic */}
        <SelectionManager meshes={meshes} selectionBox={finishedBox} onSelect={safeSelect} />
      </Canvas>
      
      {/* 7. Selection Box Overlay */}
      {dragStart && dragCurrent && (
         <div className="absolute border border-white bg-white/10 pointer-events-none z-50"
           style={{
             left: Math.min(dragStart.x, dragCurrent.x), 
             top: Math.min(dragStart.y, dragCurrent.y),
             width: Math.abs(dragCurrent.x - dragStart.x), 
             height: Math.abs(dragCurrent.y - dragStart.y),
           }}
         />
      )}
    </div>
  );
}