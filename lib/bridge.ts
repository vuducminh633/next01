import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

// --- CONFIGURATION ---
const ROOT_DIR = process.cwd();
// Ensure this points to the folder containing your compiled 'MiningMesher.exe'
const BIN_DIR = path.join(ROOT_DIR, "bin"); 
const EXE_PATH = path.join(BIN_DIR, "MiningMesher.exe");

const DEFAULT_WALL_HEIGHT = 10.0; 

// --- MAIN CONVERTER FUNCTION ---
export async function runCppConverter(fragments: any[]) {
  // 1. Verify Executable Exists
  try {
    await fs.access(EXE_PATH);
  } catch {
    console.error(`[Bridge] CRITICAL: EXE not found at ${EXE_PATH}`);
    console.error(`[Bridge] Please compile 'main.cpp' and place 'MiningMesher.exe' in the 'bin' folder.`);
    return null;
  }

  // 2. Validate Input Data
  if (!Array.isArray(fragments) || fragments.length === 0) {
    console.error("[Bridge] No fragments provided to converter");
    return null;
  }

  // 3. Build Payload
  // This transforms your database objects into the JSON format expected by main.cpp
  const payload = fragments.flatMap((item) => {
    const rawProperties = item.properties || {};
    
    // Attempt to find vertices in various common formats
    let basePoints: number[][] = 
      rawProperties.FlattenedVertices || 
      rawProperties.Vertices || 
      (rawProperties.StartPoint && rawProperties.EndPoint 
        ? [rawProperties.StartPoint, rawProperties.EndPoint] 
        : []);

    // Skip invalid geometry
    if (!basePoints || basePoints.length < 2) return [];

    const height = rawProperties.Thickness || DEFAULT_WALL_HEIGHT;
    // Use the Z of the first point as the base elevation
    const zBase = basePoints[0]?.[2] || 0;
    const partType = item.partType || rawProperties.Type || "Wall";

    // --- CRITICAL FIX: ISOLATION LOGIC ---
    // 1. Use the SAME layer for "Floor" and "Roof" so they are grouped together.
    // 2. Append the ID to the BlockName to force main.cpp to treat this object individually.
    //    This prevents it from trying to stitch "Wall A" to "Wall B" horizontally.
    const commonLayer = item.layer || rawProperties.Layer || "DefaultLayer"; 
    const uniqueBlockName = `${item.blockName || "Default"}_${item.id}`;

    return [
      {
        "ViaName": item.viaName || "Unknown",
        "BlockName": uniqueBlockName, 
        "Layer": commonLayer,         
        "Type": "Floor",              // Bottom Slice
        "PartType": partType,
        "FlattenedVertices": basePoints.map(p => [p[0], p[1], zBase]),
        "FragmentId": item.id || 0
      },
      {
        "ViaName": item.viaName || "Unknown",
        "BlockName": uniqueBlockName, 
        "Layer": commonLayer,         
        "Type": "Roof",               // Top Slice
        "PartType": partType,
        "FlattenedVertices": basePoints.map(p => [p[0], p[1], zBase + height]),
        "FragmentId": item.id || 0
      }
    ];
  });

  if (payload.length === 0) {
    console.error("[Bridge] No valid geometry data extracted from fragments.");
    return null;
  }

  console.log(`[Bridge] Processing ${fragments.length} fragments into ${payload.length} slices...`);

  // 4. Run C++ Converter
  const uniqueId = crypto.randomUUID();
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `input_${uniqueId}.json`);
  const outputPath = path.join(tempDir, `output_${uniqueId}.obj`);

  try {
    // Write JSON input file
    await fs.writeFile(inputPath, JSON.stringify(payload, null, 2));
    
    // Execute the binary
    await new Promise<void>((resolve, reject) => {
      execFile(EXE_PATH, [inputPath, outputPath], { cwd: BIN_DIR }, (error, stdout, stderr) => {
        if (error) {
          console.error("[Bridge] C++ Execution Error:", stderr);
          console.log("[Bridge] Stdout:", stdout);
          reject(error);
        } else {
          // console.log("[Bridge] C++ Conversion Success");
          resolve();
        }
      });
    });

    // Read the resulting OBJ file
    const rawObj = await fs.readFile(outputPath, "utf-8");

    // Cleanup temporary files
    await Promise.all([
      fs.unlink(inputPath).catch(() => {}),
      fs.unlink(outputPath).catch(() => {})
    ]);

    // Parse OBJ text into JSON for the frontend
    return parseObjToJSON(rawObj);

  } catch (error) {
    console.error("[Bridge] Processing Error:", error);
    // Attempt cleanup even on error
    try {
        await fs.unlink(inputPath).catch(() => {});
        await fs.unlink(outputPath).catch(() => {});
    } catch {}
    return null;
  }
}

// --- HELPER: OBJ PARSER ---
// Converts standard .obj text format into a simple JSON { vertices, indices } object
function parseObjToJSON(objString: string) {
  const lines = objString.split('\n');
  const vertices: number[] = [];
  const indices: number[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    
    // Parse Vertex: "v 1.0 2.0 3.0"
    if (parts[0] === 'v' && parts.length >= 4) {
      vertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
    } 
    // Parse Face: "f 1 2 3" or "f 1/1/1 2/2/2 3/3/3"
    else if (parts[0] === 'f' && parts.length >= 4) {
      // OBJ indices are 1-based, convert to 0-based
      const indices1 = parseInt(parts[1].split('/')[0]) - 1;
      const indices2 = parseInt(parts[2].split('/')[0]) - 1;
      const indices3 = parseInt(parts[3].split('/')[0]) - 1;
      
      indices.push(indices1, indices2, indices3);
      
      // Handle Quads (convert to two triangles: 1-2-3 and 1-3-4)
      if (parts.length === 5) { 
        const indices4 = parseInt(parts[4].split('/')[0]) - 1;
        indices.push(indices1, indices3, indices4);
      }
    }
  }

  // Return null if empty, otherwise return the mesh data
  return vertices.length > 0 ? { vertices, indices } : null;
}