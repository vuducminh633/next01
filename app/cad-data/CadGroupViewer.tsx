"use client";

import { useState } from "react";
// import { markGroupAsViewed } from "../actions"; // REMOVED to fix build error
import MeshViewer from "../../components/MeshViewer"; 

// Type matches our Prisma/Drizzle Model
type CadItem = {
  id: number;
  groupName: string | null;
  handle: string;
  objectType: string | null;
  layer: string | null;
  properties: any;
  isNew: boolean;
};

export default function CadGroupViewer({ data }: { data: CadItem[] }) {
  const [selectedItem, setSelectedItem] = useState<CadItem | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // 1. Group the data by "groupName" (or viaName if preferred)
  const groupedData = data.reduce((acc, item) => {
    const group = item.groupName || "Ungrouped";
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {} as Record<string, CadItem[]>);

  // 2. Toggle Group Expansion
  const toggleGroup = async (groupName: string, items: CadItem[]) => {
    const next = new Set(expandedGroups);
    
    if (next.has(groupName)) {
      next.delete(groupName); // Collapse
    } else {
      next.add(groupName); // Expand
      // Note: "Mark as viewed" logic removed for now
    }
    setExpandedGroups(next);
  };

  return (
    <div className="space-y-4">
      {Object.entries(groupedData).map(([groupName, items]) => {
        const isGroupNew = items.some(i => i.isNew);

        return (
          <div key={groupName} className="border border-gray-200 rounded-lg bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
            
            {/* Accordion Header */}
            <button
              onClick={() => toggleGroup(groupName, items)}
              className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-gray-800">{groupName}</span>
                
                {isGroupNew && (
                  <span className="animate-pulse px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold tracking-wider shadow-sm">
                    NEW
                  </span>
                )}
                
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                  {items.length} items
                </span>
              </div>
              <span className={`text-gray-400 transform transition-transform duration-200 ${expandedGroups.has(groupName) ? "rotate-90" : ""}`}>
                ▶
              </span>
            </button>

            {/* Accordion Body */}
            {expandedGroups.has(groupName) && (
              <div className="border-t border-gray-200">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3">Handle</th>
                      <th className="px-6 py-3">Type</th>
                      <th className="px-6 py-3">Layer</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item) => (
                      <tr 
                        key={item.id} 
                        onClick={() => setSelectedItem(item)}
                        className={`cursor-pointer transition-colors ${item.isNew ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        <td className="px-6 py-3 font-mono text-gray-600">{item.handle}</td>
                        <td className="px-6 py-3">
                          <span className="inline-block px-2 py-1 rounded border bg-white text-xs text-gray-600">
                            {item.objectType}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-gray-500">{item.layer}</td>
                        <td className="px-6 py-3 text-right text-blue-600 font-medium hover:underline">View</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Modal Overlay */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            
           <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
             
             {/* Modal Header */}
             <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-800">
                  {selectedItem.objectType} <span className="text-gray-400 font-normal">#{selectedItem.handle}</span>
                </h3>
                <button 
                  onClick={() => setSelectedItem(null)}
                  className="text-gray-400 hover:text-gray-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200"
                >
                  ✕
                </button>
             </div>

             <div className="p-6 overflow-y-auto">
               
               {/* Visual Preview */}
               <div className="mb-6 bg-gray-100 border rounded-xl overflow-hidden h-[300px] flex items-center justify-center relative">
                  {(selectedItem.objectType === "Circle" || selectedItem.objectType === "Arc" || selectedItem.objectType === "Polyline" || selectedItem.objectType === "Line") ? (
                      <div className="w-full h-full">
                        <MeshViewer 
                          type={selectedItem.objectType as any} 
                          data={selectedItem.properties} 
                        />
                      </div>
                  ) : (
                      <div className="text-gray-400 text-sm flex flex-col items-center gap-2">
                        <span>🚫</span>
                        <span>No visual preview available for {selectedItem.objectType}</span>
                      </div>
                  )}
               </div>

               {/* Raw Data View */}
               <div>
                 <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Raw Properties</h4>
                 <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-40 text-xs font-mono shadow-inner">
                   {JSON.stringify(selectedItem.properties, null, 2)}
                 </pre>
               </div>
             </div>
             
             {/* Modal Footer */}
             <div className="p-4 border-t bg-gray-50 flex justify-end">
               <button 
                 onClick={() => setSelectedItem(null)} 
                 className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
               >
                 Close Viewer
               </button>
             </div>

           </div>
        </div>
      )}
    </div>
  );
}