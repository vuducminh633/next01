"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
// Make sure to import BOTH generate actions here
import { generateBatch3DModel, generate3DModel, deleteMap } from "@/app/actions"; 
import MineMap from "@/components/MineMap";
import SurfaceViewer3D from "@/components/SurfaceViewer3D";

// --- RESIZABLE HANDLE COMPONENT ---
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
        <div className={`bg-gray-600 ${vertical ? "w-8 h-px" : "h-8 w-px"}`} />
    </div>
  );
};

// --- MAIN LAYOUT ---
// Note: initialData is now a single map object containing the nested tree
export default function CadUnityLayout({ initialData }: { initialData: any }) {
  const router = useRouter();

  // --- DATA STATE ---
  const [mapData, setMapData] = useState<any>(initialData);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sceneMeshes, setSceneMeshes] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // --- UI STATE (Resizable Panes) ---
  const [leftWidth, setLeftWidth] = useState(260); 
  const [rightWidth, setRightWidth] = useState(280);
  const [sceneHeight, setSceneHeight] = useState(500); 

  // Keep state synced if server data changes
  useEffect(() => { 
    setMapData(initialData); 
    
    // Automatically load any saved database meshes into the 3D viewer on load
    const savedMeshes: any[] = [];
    if (initialData?.vias) {
      initialData.vias.forEach((via: any) => {
        via.blocks.forEach((block: any) => {
          if (block.mesh) savedMeshes.push({ ...block.mesh, id: `db-mesh-${block.id}` });
        });
      });
    }
    setSceneMeshes(savedMeshes);
  }, [initialData]);

  const handleRefresh = () => router.refresh();

  // --- FLATTEN DATA FOR VIEWERS ---
  // The 2D Map expects a flat list of lines. We extract them from the tree here.
  const allLines = useMemo(() => {
    if (!mapData || !mapData.vias) return [];
    const lines: any[] = [];
    mapData.vias.forEach((via: any) => {
      via.blocks.forEach((block: any) => {
        if (block.lines) {
          block.lines.forEach((line: any) => {
             // Attach parent names just in case the UI needs to display them
            lines.push({ ...line, viaName: via.name, blockName: block.name });
          });
        }
      });
    });
    return lines;
  }, [mapData]);

  // --- HIERARCHY LOGIC ---
  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // --- ACTION: DELETE PROJECT ---
  const handleDeleteProject = async () => {
    if (!confirm("Are you sure you want to delete this ENTIRE project? This cannot be undone.")) return;
    
    setIsDeleting(true);
    if (mapData?.id) {
      const res = await deleteMap(mapData.id);
      if (res.success) router.push("/");
      else alert("Error deleting map. Check console.");
    }
    setIsDeleting(false);
  };

  // --- ACTION: GENERATE SINGLE BLOCK (PERMANENT) ---
  const handleGenerateBlock = async (e: React.MouseEvent, blockId: number) => {
    e.stopPropagation(); // Prevent expanding the folder
    setIsProcessing(true);
    try {
      const result = await generate3DModel(blockId);
      if (result.success) {
         // Refresh the page to pull the newly saved mesh from the database
         router.refresh(); 
      } else {
         alert("Failed to generate Block: " + result.error);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- ACTION: GENERATE BATCH (TEMPORARY PREVIEW) ---
  const handleGenerateMultiple = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      const idsToProcess = Array.from(selectedIds);
      const result = await generateBatch3DModel(idsToProcess);
      if (result.success && result.mesh) {
        setSceneMeshes(prev => [...prev, { ...result.mesh, id: `batch-${Date.now()}` }]);
      } else {
        alert("Batch Gen Error: " + (result.error || ""));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- SELECTION LOGIC ---
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
    if (selectedIds.size === allLines.length && allLines.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(allLines.map(d => d.id)));
  };

  const singleSelectedItem = selectedIds.size === 1 
    ? allLines.find(d => d.id === Array.from(selectedIds)[0]) 
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
          <span className="text-blue-500">♦</span> {mapData?.name || "Empty Map"}
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={handleRefresh} 
            className="text-[10px] bg-[#333] hover:bg-[#444] text-white px-3 py-1 rounded border border-black transition-colors"
          >
            Refresh Data
          </button>
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
        
        {/* LEFT PANE (HIERARCHY) */}
        <div style={{ width: leftWidth }} className="bg-[#1a1a1a] flex flex-col shrink-0 min-w-[150px] border-r border-black select-none">
          <div className="p-2 flex justify-between items-center bg-[#222] border-b border-black">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hierarchy</span>
            <button onClick={handleSelectAll} className="text-[10px] text-blue-400 hover:text-blue-300">
              {selectedIds.size > 0 && selectedIds.size === allLines.length ? "Deselect" : "Select All"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-gray-800 font-sans">
            {/* NEW RENDER LOOP USING REAL DATABASE TREE */}
            {mapData?.vias?.map((via: any) => {
              const viaKey = `via-${via.id}`;
              const isViaOpen = expanded.has(viaKey);
              
              return (
                <div key={viaKey} className="mb-0.5">
                  {/* LEVEL 1: VIA */}
                  <div onClick={() => toggleExpand(viaKey)} className="flex items-center gap-1 px-1 py-1 cursor-pointer hover:bg-[#2a2a2a] text-[11px] font-bold text-blue-400">
                    <span className={`transform transition-transform ${isViaOpen ? 'rotate-90' : ''}`}>▶</span>
                    <span className="opacity-70">📂</span> {via.name}
                  </div>

                  {isViaOpen && (
                    <div className="ml-3 border-l border-gray-800">
                      {via.blocks?.map((block: any) => {
                        const blockKey = `block-${block.id}`;
                        const isBlockOpen = expanded.has(blockKey);
                        const hasDbMesh = !!block.mesh; // Check if DB has a mesh for this block
                        const allBlockItemsSelected = block.lines?.length > 0 && block.lines.every((i: any) => selectedIds.has(i.id));

                        return (
                          <div key={blockKey} className="mb-0.5">
                            {/* LEVEL 2: BLOCK */}
                            <div onClick={() => toggleExpand(blockKey)} className={`flex items-center gap-1 px-1 py-1 cursor-pointer text-[10px] font-semibold group ${allBlockItemsSelected ? "text-yellow-500" : "text-gray-400 hover:text-gray-200"}`}>
                              <span className={`transform transition-transform ${isBlockOpen ? 'rotate-90' : ''}`}>▶</span>
                              <span className="opacity-70">📦</span> {block.name}
                              
                              {/* Dedicated Block Generation Button */}
                              <button 
                                onClick={(e) => handleGenerateBlock(e, block.id)}
                                className={`ml-auto text-[8px] px-1.5 py-0.5 rounded transition-colors ${hasDbMesh ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-blue-900 text-blue-200 opacity-0 group-hover:opacity-100 hover:bg-blue-700'}`}
                              >
                                {hasDbMesh ? "✓ 3D" : "Gen 3D"}
                              </button>

                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMultiSelect(new Set(block.lines.map((i:any) => i.id)), allBlockItemsSelected ? "replace" : "add");
                                }}
                                className="ml-1 opacity-0 group-hover:opacity-100 text-[8px] bg-[#333] px-1 rounded text-white hover:bg-[#555]"
                              >
                                {allBlockItemsSelected ? "−" : "+"}
                              </button>
                            </div>

                            {isBlockOpen && (
                              <div className="ml-3 border-l border-gray-800">
                                {/* LEVEL 3: CAD LINES */}
                                {block.lines?.map((line: any) => {
                                  const isSelected = selectedIds.has(line.id);
                                  return (
                                    <div 
                                      key={line.id}
                                      onClick={(e) => handleMultiSelect(new Set([line.id]), (e.ctrlKey || e.metaKey) ? "toggle" : "replace")}
                                      className={`cursor-pointer text-[9px] px-2 py-1 flex items-center gap-2 transition-colors ${isSelected ? 'bg-blue-600 text-white' : 'hover:bg-[#2a2a2a] text-gray-500'}`}
                                    >
                                      <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
                                      <span className="truncate flex-1">{line.partType} ({line.handle})</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            
            {(!mapData?.vias || mapData.vias.length === 0) && (
                <div className="p-4 text-center text-xs text-gray-600 italic">No objects found.</div>
            )}
          </div>

          {/* GENERATE BATCH PREVIEW BUTTON */}
          <div className="p-2 bg-[#222] border-t border-black">
            <button 
              onClick={handleGenerateMultiple} 
              disabled={isProcessing || selectedIds.size === 0} 
              className="w-full py-2 rounded text-[10px] font-bold uppercase tracking-widest bg-gray-700 hover:bg-gray-600 text-white disabled:bg-[#333] disabled:text-gray-600 transition-all active:scale-95"
            >
              {isProcessing ? "Processing..." : `Preview Batch 3D (${selectedIds.size})`}
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
            <SurfaceViewer3D meshes={sceneMeshes} selectedIds={selectedIds} onMultiSelect={(ids) => handleMultiSelect(ids, "replace")} />
          </div>

          <ResizeHandle vertical onDrag={(d) => setSceneHeight(p => Math.max(100, Math.min(window.innerHeight - 200, p + d)))} />

          {/* BOTTOM: 2D Map */}
          <div className="flex-1 relative overflow-hidden min-h-[100px]">
            <div className="absolute top-2 left-2 z-10 bg-black/70 text-gray-400 text-[10px] px-2 py-1 rounded border border-gray-800 pointer-events-none">
              2D MAP (Left: Select | Middle: Pan)
            </div>
            <MineMap data={allLines} selectedIds={selectedIds} onMultiSelect={(ids) => handleMultiSelect(ids, "replace")} />
          </div>
        </div>

        <ResizeHandle onDrag={(d) => setRightWidth(p => Math.max(200, Math.min(500, p - d)))} />

        {/* RIGHT PANE (INSPECTOR) */}
        <div style={{ width: rightWidth }} className="bg-[#1a1a1a] flex flex-col shrink-0 border-l border-black">
          <div className="p-2 text-[10px] font-bold text-gray-400 uppercase bg-[#222] border-b border-black">Inspector</div>
          <div className="flex-1 p-4 overflow-y-auto">
            {selectedIds.size === 0 ? (
              <div className="text-center text-gray-600 text-xs mt-10">No Selection</div>
            ) : selectedIds.size > 1 ? (
              <div className="text-white text-xs space-y-2">
                <div className="font-bold text-blue-400">{selectedIds.size} Items Selected</div>
                <div className="text-[10px] text-gray-500">Select single item to view properties</div>
              </div>
            ) : singleSelectedItem ? (
              <div className="space-y-3">
                  <div className="border-b border-gray-700 pb-2">
                      <div className="text-xs font-bold text-white">{singleSelectedItem.partType || "Object"}</div>
                      <div className="text-[10px] text-gray-500">ID: {singleSelectedItem.handle}</div>
                  </div>
                  <pre className="text-[9px] text-green-500 overflow-auto bg-[#111] p-2 rounded border border-gray-800">
                    {JSON.stringify(singleSelectedItem.properties, null, 2)}
                  </pre>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}