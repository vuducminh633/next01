// lib/hierarchyUtils.ts

export type HierarchyNode = {
  id: string;
  label: string;
  type: "via" | "block" | "part" | "object";
  children: HierarchyNode[];
  // Store all object IDs under this node for easy "Highlight All"
  allObjectIds: number[]; 
};

export function buildMiningHierarchy(data: any[]): HierarchyNode[] {
  const root: HierarchyNode[] = [];

  // Helper to find existing node or create new one
  const getOrCreateNode = (
    parentList: HierarchyNode[],
    label: string,
    type: HierarchyNode["type"],
    idPrefix: string
  ) => {
    let node = parentList.find((n) => n.label === label);
    if (!node) {
      node = {
        id: `${idPrefix}-${label}`,
        label,
        type,
        children: [],
        allObjectIds: [],
      };
      parentList.push(node);
    }
    return node;
  };

  data.forEach((item) => {
    if (!item.viaName) return;

    // 1. Level: Vỉa (Seam)
    const viaNode = getOrCreateNode(root, item.viaName, "via", "v");
    viaNode.allObjectIds.push(item.id);

    if (item.blockName) {
      // 2. Level: Khối (Block)
      const blockNode = getOrCreateNode(viaNode.children, item.blockName, "block", `b-${item.viaName}`);
      blockNode.allObjectIds.push(item.id);

      if (item.partType) {
        // 3. Level: Type (Vách/Trụ)
        const typeNode = getOrCreateNode(blockNode.children, item.partType, "part", `t-${item.viaName}-${item.blockName}`);
        typeNode.allObjectIds.push(item.id);
        
        // (Optional) Level 4: The actual object handle if you want deep granularity
        // typeNode.children.push({ ... })
      }
    }
  });

  return root;
}