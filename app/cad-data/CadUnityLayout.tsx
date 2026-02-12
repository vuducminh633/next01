"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generate3DModel, deleteMap } from "../actions"; 
import MineMap from "@/components/MineMap";
import SurfaceViewer3D from "@/components/SurfaceViewer3D";


// --- RESIZABLE HANDLE ---
const ResizeHandle = ({ onDrag, vertical = false }: { onDrag: (delta: number) => void, vertical?: boolean }) => {
  const isDragging = useRef(false);

  useEffect(() => {
    const handleUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "default";
        document.body.style.userSelect = "auto";
      }
    };
    const handleMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      onDrag(vertical ? e.movementY : e.movementX);
    };

    window.addEventListener("mouseup", handleUp);
    window.addEventListener("mousemove", handleMove);
    return () => {
      window.removeEventListener("mouseup", handleUp);
      window.removeEventListener("mousemove", handleMove);
    };
  }, [onDrag, vertical]);

  return (
    <div
      className={`
        bg-black hover:bg-blue-600 transition-colors z-50 flex-shrink-0 flex items-center justify-center
        ${vertical ? "h-1 hover:h-2 w-full cursor-row-resize" : "w-1 hover:w-2 h-full cursor-col-resize"}
      `}
      onMouseDown={() => {
        isDragging.current = true;
        document.body.style.cursor = vertical ? "row-resize" : "col-resize";
        document.body.style.userSelect = "none";
      }}
    >
        {/* Optional decorative grip lines */}
        <div className={`bg-gray-600 ${vertical ? "w-8 h-px" : "h-8 w-px"}`} />
    </div>
  );
};

export default function CadUnityLayout({ initialData }: { initialData: any[] }) {
  const router = useRouter();

  // --- DATA ---
  const [data, setData] = useState<any[]>(initialData);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sceneMeshes, setSceneMeshes] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- LAYOUT STATE ---
  const [leftWidth, setLeftWidth] = useState(260); 
  const [rightWidth, setRightWidth] = useState(280);
  // Default 3D scene height (percentage or pixels). Using pixels for simpler resizing logic.
  const [sceneHeight, setSceneHeight] = useState(500); 

  useEffect(() => { setData(initialData); }, [initialData]);

  const handleRefresh = () => router.refresh();

  // --- DELETE HANDLER ---
  const handleDeleteProject = async () => {
    // 1. Safety Check
    if (!confirm("Are you sure you want to delete this ENTIRE project? This cannot be undone.")) {
      return;
    }

    setIsDeleting(true);
    
    // 2. Get Map ID from the first object (all objects share the same mapId)
    // If data is empty, we can't delete from here easily, but usually there's data.
    const currentMapId = data[0]?.mapId; 

    if (currentMapId) {
      const res = await deleteMap(currentMapId);
      if (res.success) {
        // 3. Redirect to Hub on success
        router.push("/");
      } else {
        alert("Error deleting map. Check console.");
        setIsDeleting(false);
      }
    } else {
        // Fallback if map is empty but somehow loaded
       alert("Cannot determine Map ID.");
       setIsDeleting(false);
    }
  };


  // --- SELECTION ---
  const handleMultiSelect = useCallback((ids: Set<number>, strategy: "replace" | "add" | "toggle" = "replace") => {
    setSelectedIds(prev => {
      const next = new Set(strategy === "replace" ? [] : prev);
      if (strategy === "toggle") {
        ids.forEach(id => {
          if (next.has(id)) next.delete(id);
          else next.add(id);
        });
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  }, []);

  const handleSelectAll = () => {
    if (selectedIds.size === data.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(data.map(d => d.id)));
  };

  // --- GENERATE 3D ---
  const handleGenerateMultiple = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    
    const results = [];
    const idsToProcess = Array.from(selectedIds);

    for (const id of idsToProcess) {
      const item = data.find(d => d.id === id);
      if (!item) continue;

      let meshToUse = item.properties?.threeDGeometry;

      if (!meshToUse) {
        try {
            const res = await generate3DModel(id);
            if (res.success && res.mesh) {
                meshToUse = res.mesh;
                setData(prev => prev.map(d => 
                    d.id === id ? { ...d, properties: { ...d.properties, threeDGeometry: res.mesh } } : d
                ));
            }
        } catch (err) { console.error(err); }
      }

      if (meshToUse) {
        results.push({ ...meshToUse, id: id });
      }
    }
    setSceneMeshes(results);
    setIsProcessing(false);
  };

  const singleSelectedItem = selectedIds.size === 1 
    ? data.find(d => d.id === Array.from(selectedIds)[0]) 
    : null;

  return (
    <div className="flex flex-col h-screen bg-[#121212] text-gray-300">

      {/* HEADER */}
      <div className="h-10 bg-[#1a1a1a] border-b border-black flex items-center justify-between px-4 shrink-0 z-20">
        <div className="font-bold text-sm flex items-center gap-2">
          <Link href="/" className="text-gray-500 hover:text-white transition-colors">
             &larr; Hub
          </Link>
          <span className="text-gray-700">|</span>
          <span className="text-blue-500">♦</span> {data[0]?.properties?.OriginalMapName || data[0]?.viaName || "Mine Viewer"}
        </div>
        
        <div className="flex gap-2">
          {/* Refresh Button */}
          <button 
            onClick={handleRefresh} 
            className="text-[10px] bg-[#333] hover:bg-[#444] text-white px-3 py-1 rounded border border-black transition-colors"
          >
            Refresh Data
          </button>

          {/* NEW DELETE BUTTON */}
          <button 
            onClick={handleDeleteProject} 
            disabled={isDeleting}
            className="text-[10px] bg-red-900/30 hover:bg-red-700 text-red-200 border border-red-900 px-3 py-1 rounded transition-colors flex items-center gap-1"
          >
            {isDeleting ? "Deleting..." : "🗑 Delete Project"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* LEFT PANE */}
        <div style={{ width: leftWidth }} className="bg-[#1a1a1a] flex flex-col shrink-0 min-w-[150px] border-r border-black">
          <div className="p-2 flex justify-between items-center bg-[#222] border-b border-black">
             <span className="text-[10px] font-bold text-gray-400 uppercase">Hierarchy</span>
             <button onClick={handleSelectAll} className="text-[10px] text-blue-400 hover:text-blue-300">
               {selectedIds.size === data.length ? "None" : "All"}
             </button>
          </div>
          <div className="flex-1 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-gray-600">
             {data.map((item) => {
               const isSelected = selectedIds.has(item.id);
               return (
                 <div 
                   key={item.id}
                   onClick={(e) => handleMultiSelect(new Set([item.id]), (e.ctrlKey || e.metaKey) ? "toggle" : "replace")}
                   className={`
                     cursor-pointer text-[11px] px-2 py-1.5 rounded-sm mb-0.5 flex items-center gap-2 border border-transparent
                     ${isSelected ? 'bg-blue-900/60 text-white' : 'hover:bg-[#2a2a2a] text-gray-400'}
                   `}
                 >
                   <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-yellow-400' : 'bg-gray-600'}`}></div>
                   <div className="truncate flex-1 font-mono">{item.groupName || `Object ${item.id}`}</div>
                   {item.properties?.threeDGeometry && <span className="text-[9px] text-green-500">3D</span>}
                 </div>
               );
             })}
          </div>
          <div className="p-2 bg-[#222] border-t border-black">
             <button onClick={handleGenerateMultiple} disabled={isProcessing || selectedIds.size === 0} className="w-full py-1.5 rounded text-[10px] font-bold uppercase bg-blue-700 hover:bg-blue-600 text-white disabled:bg-[#333] disabled:text-gray-600">
                {isProcessing ? "Processing..." : "Generate 3D"}
             </button>
          </div>
        </div>

        <ResizeHandle onDrag={(d) => setLeftWidth(p => Math.max(150, Math.min(600, p + d)))} />

        {/* CENTER PANE (Vertical Split) */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
          
          {/* TOP: 3D Scene */}
          <div style={{ height: sceneHeight }} className="relative overflow-hidden min-h-[100px]">
             <div className="absolute top-2 left-2 z-10 bg-black/70 text-gray-400 text-[10px] px-2 py-1 rounded border border-gray-800 pointer-events-none">
                3D SCENE (Left: Select | Right: Orbit)
             </div>
             <SurfaceViewer3D 
                meshes={sceneMeshes} 
                selectedIds={selectedIds}
                onMultiSelect={(ids) => handleMultiSelect(ids, "replace")}
             />
          </div>

          {/* Vertical Resizer */}
          <ResizeHandle vertical onDrag={(d) => setSceneHeight(p => Math.max(100, Math.min(window.innerHeight - 200, p + d)))} />

          {/* BOTTOM: 2D Map */}
          <div className="flex-1 relative overflow-hidden min-h-[100px]">
             <div className="absolute top-2 left-2 z-10 bg-black/70 text-gray-400 text-[10px] px-2 py-1 rounded border border-gray-800 pointer-events-none">
                2D MAP (Left: Select | Middle: Pan)
             </div>
             <MineMap 
                data={data} 
                selectedIds={selectedIds} 
                onMultiSelect={(ids) => handleMultiSelect(ids, "replace")} 
             />
          </div>
        </div>

        <ResizeHandle onDrag={(d) => setRightWidth(p => Math.max(200, Math.min(500, p - d)))} />

        {/* RIGHT PANE */}
        <div style={{ width: rightWidth }} className="bg-[#1a1a1a] flex flex-col shrink-0 border-l border-black">
          <div className="p-2 text-[10px] font-bold text-gray-400 uppercase bg-[#222] border-b border-black">Inspector</div>
          <div className="flex-1 p-4 overflow-y-auto">
              {/* (Inspector Content - kept same as before for brevity) */}
              {selectedIds.size === 0 ? <div className="text-center text-gray-600 text-xs mt-10">No Selection</div> : 
               selectedIds.size > 1 ? <div className="text-white text-xs">{selectedIds.size} Items Selected</div> :
               singleSelectedItem && <pre className="text-[9px] text-green-500 overflow-auto">{JSON.stringify(singleSelectedItem.properties, null, 2)}</pre>
              }
          </div>
        </div>
      </div>
    </div>
  );
}