"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Stage,Grid } from "@react-three/drei";
import * as THREE from "three";
import { useMemo, useState } from "react";

// --- MESH COMPONENT ---
function MiningMesh({ data, isSelected, showWireframe }: { data: any; isSelected: boolean;showWireframe: boolean; }) {
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
      {showWireframe && (
        <lineSegments>
          <wireframeGeometry args={[geometry]} />
          <lineBasicMaterial color="white" opacity={0.3} transparent linewidth={1} />
        </lineSegments>
      )}
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
  
  // Mouse Drag State
  const [dragStart, setDragStart] = useState<{x:number, y:number} | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{x:number, y:number} | null>(null);
  const [finishedBox, setFinishedBox] = useState<any>(null);

  // NEW: Unity-Style Grid Toggle State
  const [showGrid, setShowGrid] = useState(true);

  const [showWireframe, setShowWireframe] = useState(true);

  const handleMouseDown = (e: React.MouseEvent) => {
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
      {/* --- NEW: UNITY-STYLE TOOLBAR --- */}
      <div className="absolute top-2 right-2 z-10 flex gap-2">
        {/* Wireframe Button */}
        <button
          onClick={() => setShowWireframe(!showWireframe)}
          className={`px-3 py-1 text-[10px] font-bold rounded border transition-colors shadow-lg flex items-center gap-2 ${
            showWireframe
              ? "bg-[#3a3a4a] border-purple-500 text-purple-300"
              : "bg-[#222] border-gray-700 text-gray-500 hover:bg-[#333]"
          }`}
        >
          <span className="text-sm">◩</span> {showWireframe ? "MESH: ON" : "MESH: OFF"}
        </button>

        {/* Grid Button */}
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`px-3 py-1 text-[10px] font-bold rounded border transition-colors shadow-lg flex items-center gap-2 ${
            showGrid
              ? "bg-[#3a3a4a] border-blue-500 text-blue-300"
              : "bg-[#222] border-gray-700 text-gray-500 hover:bg-[#333]"
          }`}
        >
          <span className="text-sm">▦</span> {showGrid ? "GRID: ON" : "GRID: OFF"}
        </button>
      </div>

      <Canvas shadows camera={{ position: [100, 100, 100], fov: 50 }}>
        <color attach="background" args={["#1a1a2e"]} />
        
        <OrbitControls 
            makeDefault 
            mouseButtons={{
                LEFT: undefined, 
                MIDDLE: THREE.MOUSE.PAN,
                RIGHT: THREE.MOUSE.ROTATE 
            }}
        />
        
        {/* --- NEW: INFINITE GRID --- */}
        {showGrid && (
          <group>
            {/* The Drei Grid is infinite, so it never disappears no matter how far you zoom! */}
            <Grid 
              infiniteGrid 
              fadeDistance={20000} // Fades out smoothly in the distance
              sectionColor="#444444" 
              cellColor="#222222" 
              sectionSize={100} // Major grid lines
              cellSize={10}     // Minor grid lines
            />
            <axesHelper args={[500]} />
          </group>
        )}

        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 100, 50]} intensity={0.8} />
        <directionalLight position={[-100, -100, -50]} intensity={0.4} />

        <Stage intensity={0} environment={null} adjustCamera={true}>
           {meshes.map((m, i) => (
             <MiningMesh  
                  key={i} data={m} 
                  isSelected={safeIds.has(m.id)}
                  showWireframe={showWireframe} />
           ))}
        </Stage>
        
        <SelectionManager meshes={meshes} selectionBox={finishedBox} onSelect={safeSelect} />
      </Canvas>
      
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