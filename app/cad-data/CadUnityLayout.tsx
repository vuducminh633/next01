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

const InspectorSection = ({ title, children, defaultOpen = true }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border-b border-[#111]">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full text-left px-2 py-1.5 bg-[#222] hover:bg-[#333] text-[10px] font-bold text-gray-400 flex items-center gap-1 transition-colors"
      >
        <span className={`transform transition-transform text-[8px] ${isOpen ? 'rotate-90' : ''}`}>▶</span>
        {title}
      </button>
      {isOpen && <div className="p-2 bg-[#1a1a1a]">{children}</div>}
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

  //Unity-style active inspector item
  const [inspectedItem, setInspectedItem] = useState<{ type: "map" | "via" | "block" | "line", data: any } | null>(null);

  const [sceneMeshes, setSceneMeshes] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // --- UI STATE (Resizable Panes) ---
  const [leftWidth, setLeftWidth] = useState(260); 
  const [rightWidth, setRightWidth] = useState(280);
 
  //state for 2d map
  const [isObjInfoExpanded, setIsObjInfoExpanded] = useState(true);
  const [isMapExpanded, setIsMapExpanded] = useState(true);
  const [mapHeight, setMapHeight] = useState(300);

  const [activeBlockInfo, setActiveBlockInfo] = useState<{ id: number; name: string; viaName: string; totalLines: number; vachCount: number; truCount: number } | null>(null);

  const handleBlockClick = (blockId: number) => {
    let foundBlock: any = null;
    let parentVia: any = null;

    mapData?.vias.forEach((via: any) => {
      const block = via.blocks.find((b: any) => b.id === blockId);
      if (block) {
        foundBlock = block;
        parentVia = via;
      }
    });

    if (!foundBlock) return;

    let vachCount = 0;
    let truCount = 0;
    
    foundBlock.lines?.forEach((line: any) => {
      const type = line.partType?.toLowerCase() || "";
      if (type === "vách") vachCount++;
      if (type === "trụ") truCount++;
    });

    setActiveBlockInfo({
      id: foundBlock.id,
      name: foundBlock.name,
      viaName: parentVia.name,
      totalLines: foundBlock.lines?.length || 0,
      vachCount: vachCount,
      truCount: truCount,
    });
    setInspectedItem({ type: 'block', data: foundBlock });
  };

  // Keep state synced if server data changes
  useEffect(() => { 
    setMapData(initialData); 
    
    // Automatically load any saved database meshes into the 3D viewer on load
    const savedMeshes: any[] = [];
    if (initialData?.vias) {
      initialData.vias.forEach((via: any) => {
        via.blocks.forEach((block: any) => {
          if (block.mesh) savedMeshes.push({ ...block.mesh, id: block.id });
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

  const handleGenerateMultiple = async () => {

    console.log("DEBUG: Checking Action Type:", typeof generateBatch3DModel);
  console.log("DEBUG: Action Details:", generateBatch3DModel);
    console.log("--- BATCH ACTION STARTED ---");
  
  // LOG 2: Check exactly what the selection state is
  console.log("Current Selected Count:", selectedIds.size);
  console.log("Current Selected IDs:", Array.from(selectedIds));


    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      const idsToProcess = Array.from(selectedIds);
      // LOG 3: Right before the network call
    console.log("Attemping Server Action call with:", idsToProcess);
      const result = await generateBatch3DModel(idsToProcess);
      if (result.success && result.meshes) {
        const newMeshes = result.meshes.map((meshData, index) => ({
          ...meshData,
          id: Date.now() + index // Add index so they don't share the exact same millisecond ID
        }));
        setSceneMeshes(prev => [...prev, ...newMeshes]);
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

{/* CENTER PANE (100% 3D Scene) */}
        <div className="flex-1 relative bg-[#0a0a0a] min-w-0">
          <div className="absolute top-2 left-2 z-10 bg-black/70 text-gray-400 text-[10px] px-2 py-1 rounded border border-gray-800 pointer-events-none">
            3D SCENE (Left: Select | Right: Orbit)
          </div>
          {/* The 3D viewer now naturally fills the entire center area */}
          <div className="absolute inset-0">
              <SurfaceViewer3D 
                meshes={sceneMeshes} 
                selectedIds={selectedIds} 
                onMultiSelect={(ids) => handleMultiSelect(ids, "replace")} 
                onBlockClick={handleBlockClick}
/>          </div>
        </div>

        <ResizeHandle onDrag={(d) => setRightWidth(p => Math.max(200, Math.min(600, p - d)))} />

{/* RIGHT PANE (MASTER INSPECTOR) */}
        <div style={{ width: rightWidth }} className="bg-[#1a1a1a] flex flex-col shrink-0 border-l border-black h-full">
          
          {/* FIXED TAB HEADER */}
          <div className="p-2 text-[10px] font-bold text-gray-400 uppercase bg-[#222] border-b border-black shrink-0 shadow-sm z-10">
            Inspector
          </div>

          {/* ========================================= */}
          {/* COMPONENT 1: SELECTED OBJECT INFO           */}
          {/* ========================================= */}
          <button 
            onClick={() => setIsObjInfoExpanded(!isObjInfoExpanded)}
            className="p-2 text-[10px] font-bold text-gray-300 uppercase bg-[#2a2a2a] hover:bg-[#333] border-b border-[#111] flex items-center gap-2 w-full text-left transition-colors shrink-0"
          >
            <span className={`transform transition-transform text-xs ${isObjInfoExpanded ? 'rotate-90' : ''}`}>▶</span>
            Object Information
          </button>

          {isObjInfoExpanded && (
            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800 flex flex-col min-h-0 bg-[#1a1a1a]">
              {!inspectedItem ? (
                <div className="text-center text-gray-500 text-xs mt-10 italic">No object selected</div>
              ) : (
                <div className="flex flex-col pb-4">
                  
                  {/* Unity-Style Header */}
                  <div className="p-3 border-b border-gray-800 bg-[#1e1e1e]">
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      {inspectedItem.type === 'map' && ""}
                      {inspectedItem.type === 'via' && " "}
                      {inspectedItem.type === 'block' && " "}
                      {inspectedItem.type === 'line' && "➖ "}
                      {inspectedItem.data.name || inspectedItem.data.partType || "Project"}
                    </div>
                    <div className="text-[9px] text-gray-500 mt-1 uppercase tracking-wider">
                      {inspectedItem.type} {inspectedItem.data.id ? `| ID: ${inspectedItem.data.handle || inspectedItem.data.id}` : ''}
                    </div>
                  </div>

                  {/* Properties Section */}
                  <InspectorSection title="Properties" defaultOpen={true}>
                    <pre className="text-[9px] text-green-500 overflow-x-auto bg-[#111] p-2 rounded border border-gray-800">
                      {JSON.stringify(inspectedItem.data.properties || inspectedItem.data, (key, value) => {
                        if (key === 'vias' || key === 'blocks' || key === 'lines' || key === 'mesh') return undefined; 
                        return value;
                      }, 2)}
                    </pre>
                  </InspectorSection>

                  {/* Children List: VIAS */}
                  {(inspectedItem.type === 'map' && inspectedItem.data.vias?.length > 0) && (
                    <InspectorSection title={`Child Vias (${inspectedItem.data.vias.length})`}>
                      <div className="space-y-1">
                        {inspectedItem.data.vias.map((v: any) => (
                          <div key={v.id} className="text-[10px] text-gray-400 bg-[#222] px-2 py-1 rounded cursor-pointer hover:bg-[#333] border border-gray-800" 
                               onClick={() => setInspectedItem({ type: 'via', data: v })}>
                             {v.name}
                          </div>
                        ))}
                      </div>
                    </InspectorSection>
                  )}

                  {/* Children List: BLOCKS */}
                  {(inspectedItem.type === 'via' && inspectedItem.data.blocks?.length > 0) && (
                    <InspectorSection title={`Child Blocks (${inspectedItem.data.blocks.length})`}>
                      <div className="space-y-1">
                        {inspectedItem.data.blocks.map((b: any) => (
                           <div key={b.id} className="text-[10px] text-gray-400 bg-[#222] px-2 py-1 rounded cursor-pointer hover:bg-[#333] border border-gray-800 flex justify-between" 
                                onClick={() => setInspectedItem({ type: 'block', data: b })}>
                             <span> {b.name}</span>
                             <span className="text-blue-500">{b.lines?.length || 0} lines</span>
                           </div>
                        ))}
                      </div>
                    </InspectorSection>
                  )}

                  {/* Children List: LINES */}
                  {(inspectedItem.type === 'block' && inspectedItem.data.lines?.length > 0) && (
                    <InspectorSection title={`Child Lines (${inspectedItem.data.lines.length})`} defaultOpen={false}>
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-700">
                        {inspectedItem.data.lines.map((l: any) => (
                           <div key={l.id} className="text-[9px] text-gray-400 bg-[#222] px-2 py-1 rounded flex justify-between cursor-pointer hover:bg-[#333] border border-gray-800" 
                                onClick={() => setInspectedItem({ type: 'line', data: l })}>
                             <span className="truncate">{l.partType}</span>
                             <span className="text-gray-600 shrink-0 ml-2">{l.handle}</span>
                           </div>
                        ))}
                      </div>
                    </InspectorSection>
                  )}

                </div>
              )}
            </div>
          )}

          {/* ========================================= */}
          {/* RESIZER: Only appears if BOTH are open      */}
          {/* ========================================= */}
          {isObjInfoExpanded && isMapExpanded && (
            <ResizeHandle 
              vertical 
              onDrag={(d) => setMapHeight(prev => Math.max(100, Math.min(800, prev - d)))} 
            />
          )}

          {/* ========================================= */}
          {/* COMPONENT 2: 2D MAP PREVIEW                 */}
          {/* ========================================= */}
          <button 
            onClick={() => setIsMapExpanded(!isMapExpanded)}
            className={`p-2 text-[10px] font-bold text-gray-300 uppercase bg-[#2a2a2a] hover:bg-[#333] border-b border-[#111] flex items-center gap-2 w-full text-left transition-colors shrink-0 ${!isObjInfoExpanded && isMapExpanded ? 'border-t border-black mt-auto' : 'border-t border-black'}`}
          >
            <span className={`transform transition-transform text-xs ${isMapExpanded ? 'rotate-90' : ''}`}>▶</span>
            2D Map Preview
          </button>
          
          {isMapExpanded && (
            <div 
              style={{ height: isObjInfoExpanded ? mapHeight : 'auto' }} 
              className={`relative bg-[#0a0a0a] ${!isObjInfoExpanded ? 'flex-1 min-h-0' : 'shrink-0'}`}
            >
              <div className="absolute top-2 left-2 z-10 bg-black/70 text-gray-400 text-[10px] px-2 py-1 rounded border border-gray-800 pointer-events-none">
                2D MAP
              </div>
              <div className="absolute inset-0">
                <MineMap data={allLines} selectedIds={selectedIds} onMultiSelect={(ids) => handleMultiSelect(ids, "replace")} />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}