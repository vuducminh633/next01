"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { generateBatch3DModel, deleteMap } from "@/app/actions"; // Ensure generateBatch3DModel is imported
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
export default function CadUnityLayout({ initialData }: { initialData: any[] }) {
  const router = useRouter();

  // --- DATA STATE ---
  const [data, setData] = useState<any[]>(initialData);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sceneMeshes, setSceneMeshes] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // --- UI STATE (Resizable Panes) ---
  const [leftWidth, setLeftWidth] = useState(260); 
  const [rightWidth, setRightWidth] = useState(280);
  const [sceneHeight, setSceneHeight] = useState(500); 

  useEffect(() => { setData(initialData); }, [initialData]);

  const handleRefresh = () => router.refresh();

  // --- HIERARCHY LOGIC ---
  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hierarchy = useMemo(() => {
    const tree: Record<string, Record<string, any[]>> = {};
    data.forEach((item) => {
      if (item.isPlaceholder) return; // Skip placeholder items if map is empty
      const vName = item.viaName || "Unknown Vỉa";
      const bName = item.blockName || "Unknown Khối";
      if (!tree[vName]) tree[vName] = {};
      if (!tree[vName][bName]) tree[vName][bName] = [];
      tree[vName][bName].push(item);
    });
    return tree;
  }, [data]);

  // --- ACTION: DELETE PROJECT ---
  const handleDeleteProject = async () => {
    if (!confirm("Are you sure you want to delete this ENTIRE project? This cannot be undone.")) {
      return;
    }
    setIsDeleting(true);

    const currentMapId = data[0]?.mapId; 

    if (currentMapId) {
      const res = await deleteMap(currentMapId);
      if (res.success) {
        router.push("/");
      } else {
        alert("Error deleting map. Check console.");
        setIsDeleting(false);
      }
    } else {
      alert("Cannot determine Map ID.");
      setIsDeleting(false);
    }
  };

  // --- ACTION: GENERATE 3D (BATCH) ---
  const handleGenerateMultiple = async () => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    
    try {
      // 1. Convert Selection to Array
      const idsToProcess = Array.from(selectedIds);

      // 2. Send BATCH to Server Action
      // (This connects to C++ which stitches them together)
      const result = await generateBatch3DModel(idsToProcess);

      if (result.success && result.mesh) {
        // 3. Update Scene with the single combined mesh
        const combinedMesh = {
          ...result.mesh,
          id: `batch-${Date.now()}` // Unique ID for React key
        };
        setSceneMeshes([combinedMesh]);
      } else {
        console.error("Batch Gen Error:", result.error);
        alert("Failed to generate 3D model. " + (result.error || ""));
      }
    } catch (error) {
      console.error("Client Error:", error);
      alert("An unexpected error occurred.");
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
    const validItems = data.filter(d => !d.isPlaceholder);
    if (selectedIds.size === validItems.length && validItems.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(validItems.map(d => d.id)));
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
          <span className="text-blue-500">♦</span> {data[0]?.properties?.OriginalMapName || data[0]?.viaName || (data[0]?.isPlaceholder ? "Empty Map" : "Mine Viewer")}
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
          {/* Top Bar */}
          <div className="p-2 flex justify-between items-center bg-[#222] border-b border-black">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Hierarchy</span>
            <button onClick={handleSelectAll} className="text-[10px] text-blue-400 hover:text-blue-300">
              {selectedIds.size > 0 && selectedIds.size === data.length ? "Deselect" : "Select All"}
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-gray-800 font-sans">
            {Object.entries(hierarchy).map(([viaName, blocks]) => {
              const isViaOpen = expanded.has(viaName);
              
              return (
                <div key={viaName} className="mb-0.5">
                  {/* LEVEL 1: VIA */}
                  <div 
                    onClick={() => toggleExpand(viaName)}
                    className="flex items-center gap-1 px-1 py-1 cursor-pointer hover:bg-[#2a2a2a] text-[11px] font-bold text-blue-400"
                  >
                    <span className={`transform transition-transform ${isViaOpen ? 'rotate-90' : ''}`}>▶</span>
                    <span className="opacity-70">📂</span> {viaName}
                  </div>

                  {isViaOpen && (
                    <div className="ml-3 border-l border-gray-800">
                      {Object.entries(blocks).map(([blockName, items]) => {
                        const blockKey = `${viaName}-${blockName}`;
                        const isBlockOpen = expanded.has(blockKey);
                        const allItemsSelected = items.length > 0 && items.every(i => selectedIds.has(i.id));

                        return (
                          <div key={blockName} className="mb-0.5">
                            {/* LEVEL 2: BLOCK */}
                            <div 
                              onClick={() => toggleExpand(blockKey)}
                              className={`
                                flex items-center gap-1 px-1 py-1 cursor-pointer text-[10px] font-semibold group
                                ${allItemsSelected ? "text-yellow-500" : "text-gray-400 hover:text-gray-200"}
                              `}
                            >
                              <span className={`transform transition-transform ${isBlockOpen ? 'rotate-90' : ''}`}>▶</span>
                              <span className="opacity-70">📦</span> {blockName}
                              
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const ids = new Set(items.map(i => i.id));
                                  handleMultiSelect(ids, allItemsSelected ? "replace" : "add");
                                }}
                                className="ml-auto opacity-0 group-hover:opacity-100 text-[8px] bg-[#333] px-1 rounded text-white hover:bg-[#555]"
                              >
                                {allItemsSelected ? "−" : "+"}
                              </button>
                            </div>

                            {isBlockOpen && (
                              <div className="ml-3 border-l border-gray-800">
                                {/* LEVEL 3: ITEMS */}
                                {items.map((item) => {
                                  const isSelected = selectedIds.has(item.id);
                                  return (
                                    <div 
                                      key={item.id}
                                      onClick={(e) => handleMultiSelect(new Set([item.id]), (e.ctrlKey || e.metaKey) ? "toggle" : "replace")}
                                      className={`
                                        cursor-pointer text-[9px] px-2 py-1 flex items-center gap-2 transition-colors
                                        ${isSelected ? 'bg-blue-600 text-white' : 'hover:bg-[#2a2a2a] text-gray-500'}
                                      `}
                                    >
                                      <div className={`w-1 h-1 rounded-full ${isSelected ? 'bg-yellow-400' : 'bg-gray-700'}`}></div>
                                      <span className="truncate flex-1">{item.partType || "Fragment"}</span>
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
            
            {/* Empty State in Hierarchy */}
            {Object.keys(hierarchy).length === 0 && (
                <div className="p-4 text-center text-xs text-gray-600 italic">
                    No objects found.
                </div>
            )}
          </div>

          {/* GENERATE BUTTON */}
          <div className="p-2 bg-[#222] border-t border-black">
            <button 
              onClick={handleGenerateMultiple} 
              disabled={isProcessing || selectedIds.size === 0} 
              className="w-full py-2 rounded text-[10px] font-bold uppercase tracking-widest bg-blue-700 hover:bg-blue-600 text-white disabled:bg-[#333] disabled:text-gray-600 transition-all active:scale-95"
            >
              {isProcessing ? "Processing..." : `Generate 3D (${selectedIds.size})`}
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
            
            {/* 3D VIEWER */}
            <SurfaceViewer3D 
              meshes={sceneMeshes} 
              selectedIds={selectedIds}
              onMultiSelect={(ids) => handleMultiSelect(ids, "replace")}
            />
          </div>

          <ResizeHandle vertical onDrag={(d) => setSceneHeight(p => Math.max(100, Math.min(window.innerHeight - 200, p + d)))} />

          {/* BOTTOM: 2D Map */}
          <div className="flex-1 relative overflow-hidden min-h-[100px]">
            <div className="absolute top-2 left-2 z-10 bg-black/70 text-gray-400 text-[10px] px-2 py-1 rounded border border-gray-800 pointer-events-none">
              2D MAP (Left: Select | Middle: Pan)
            </div>
            <MineMap 
              data={data.filter(d => !d.isPlaceholder)} 
              selectedIds={selectedIds} 
              onMultiSelect={(ids) => handleMultiSelect(ids, "replace")} 
            />
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