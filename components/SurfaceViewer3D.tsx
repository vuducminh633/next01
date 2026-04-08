"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Stage, Grid, Center, Bounds, Edges } from "@react-three/drei";
import * as THREE from "three";

import { useMemo, useState, memo, useEffect } from "react";

// --- MESH COMPONENT ---
const MiningMesh = memo(function MiningMesh({ 
  data, 
  isSelected, 
  showWireframe, 
  onBlockClick 
}: { 
  data: any; 
  isSelected: boolean;
  showWireframe: boolean; 
  onBlockClick?: (blockId: number) => void; 
}) {
  const geometry = useMemo(() => {
    if (!data?.vertices || !data?.indices) return null;
    
    // Create geometry from raw data
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(data.vertices), 3));
    geo.setIndex(new THREE.BufferAttribute(new Uint32Array(data.indices), 1));
    geo.computeVertexNormals(); 
    return geo;
  }, [data]);


  // This tells WebGL to delete the math from the GPU when the mesh is hidden or refreshed.
  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  if (!geometry) return null;

  const meshColor = data.color || "#00a8ff";

  return (
    <group>
      {/* The Solid Mesh */}
      <mesh 
        geometry={geometry}
        onClick={(e) => {
          e.stopPropagation(); // Prevent clicking objects behind this one
          if (onBlockClick && data.id) { // Changed data.blockId to data.id based on DB structure
            onBlockClick(data.id);
          }
        }}
        onPointerOver={(e) => (document.body.style.cursor = 'pointer')}
        onPointerOut={(e) => (document.body.style.cursor = 'auto')}
      >
        <meshPhongMaterial 
          color={isSelected ? "#FFD700" : meshColor}
          side={THREE.DoubleSide}
          flatShading={false}
          shininess={50}
          polygonOffset={true}
          polygonOffsetFactor={1}
          polygonOffsetUnits={1}
        />
      </mesh>

      {/* The Wireframe Overlay */}
      {showWireframe && (
       <mesh geometry={geometry}>
          <meshBasicMaterial 
            color="white" 
            wireframe={true}  // WebGL draws the triangles as lines!
            transparent={true} 
            opacity={0.08} 
            depthWrite={false} 
        />
      </mesh>
      )}
    </group>
  );
});

// --- SELECTION MANAGER ---
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
            if (Math.abs(sx - minX) < 20 && Math.abs(sy - minY) < 20) newSelection.add(meshData.id);
        } else {
            if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) newSelection.add(meshData.id);
        }
    });
    onSelect(newSelection);
  }, [selectionBox, camera, size, meshes, onSelect]);

  return null;
}


export default function SurfaceViewer3D({ 
  meshes, 
  selectedIds, 
  onMultiSelect ,
  onBlockClick,
  isPaused = false
}: { 
  meshes: any[], 
  selectedIds?: Set<number>, 
  onMultiSelect?: (ids: Set<number>) => void, 
  onBlockClick?: (blockId: number) => void,
  isPaused?: boolean
}) {
  const safeIds = selectedIds || new Set();
  const safeSelect = onMultiSelect || (() => {});
  
  // Mouse Drag State
  const [dragStart, setDragStart] = useState<{x:number, y:number} | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{x:number, y:number} | null>(null);
  const [finishedBox, setFinishedBox] = useState<any>(null);

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
      {/* --- UNITY-STYLE TOOLBAR --- */}
      <div className="absolute top-2 right-2 z-10 flex gap-2">
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

      {/* ---CPU PAUSE OVERLAY --- */}
      {isPaused && (
        <div className="absolute inset-0 bg-black/70 z-40 flex flex-col items-center justify-center backdrop-blur-sm">
           <div className="text-4xl animate-spin mb-4">↺</div>
           <h2 className="text-white text-xl font-bold tracking-widest uppercase">Processing C++ Mesh Data</h2>
           <p className="text-blue-400 text-sm mt-2 font-mono">3D Rendering Paused: Freeing up CPU cores...</p>
        </div>
      )}

      <Canvas 
          camera={{ position: [100, 100, 100], fov: 50, far: 100000 }}
          frameloop={isPaused ? "never" : "demand"}
      >

        <color attach="background" args={["#1a1a2e"]} />
        
        <OrbitControls 
            makeDefault 
            mouseButtons={{
                LEFT: undefined, 
                MIDDLE: THREE.MOUSE.PAN,
                RIGHT: THREE.MOUSE.ROTATE 
            }}
        />
        
        {/* --- INFINITE GRID --- */}
        {showGrid && (
         <group>
            <gridHelper args={[5000, 50, "#555555", "#333333"]} />
            <axesHelper args={[500]} />
         </group>
        )}

        <ambientLight intensity={0.6} />
        <directionalLight position={[100, 100, 50]} intensity={0.8} />
        <directionalLight position={[-100, -100, -50]} intensity={0.4} />


        {/* Auto-Center and Auto-Zoom the camera to fit the CAD data */}
        <Bounds key={meshes.length} fit clip margin={1.2}>
            <Center>
               <group>
                  {meshes.map((m, i) => (
                    <MiningMesh  
                        key={m.id || i}
                        data={m} 
                        isSelected={safeIds.has(m.id)}
                        showWireframe={showWireframe} 
                        onBlockClick={onBlockClick} />
                  ))}
                </group>
            </Center>
        </Bounds>
       
        
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