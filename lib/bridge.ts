import { execFile } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import crypto from "crypto";

const ROOT_DIR = process.cwd();
const BIN_DIR = path.join(ROOT_DIR, "bin");
const EXE_PATH = path.join(BIN_DIR, "MiningMesher.exe"); // [cite: 196, 201, 303]

const DEFAULT_WALL_HEIGHT = 10.0; 

export async function runCppConverter(item: any) {
  try {
    await fs.access(EXE_PATH);
  } catch {
    console.error(`CRITICAL: EXE not found at ${EXE_PATH}`); // [cite: 303, 304]
    return null;
  }

  const rawProperties = item.properties || {};
  
  // Prioritize high-precision vertices for the C++ algorithms [cite: 133, 145]
  let basePoints: number[][] = 
    rawProperties.FlattenedVertices || 
    rawProperties.Vertices || 
    (rawProperties.StartPoint && rawProperties.EndPoint ? [rawProperties.StartPoint, rawProperties.EndPoint] : []);

  if (basePoints.length < 2) return null;

  const height = rawProperties.Thickness || DEFAULT_WALL_HEIGHT;
  const zBase = basePoints[0]?.[2] || 0;

  /**
   * IMPORTANT: The new C++ code groups slices by ViaName + BlockName + Layer.
   * We send a Floor and a Roof slice so it can generate the Wall mesh. [cite: 207]
   */
  const payload = [
    {
      "ViaName": item.viaName || "Unknown",
      "BlockName": item.blockName || "Default",
      "Layer": "Bottom",
      "Type": "Floor",
      "FlattenedVertices": basePoints.map(p => [p[0], p[1], zBase])
    },
    {
      "ViaName": item.viaName || "Unknown",
      "BlockName": item.blockName || "Default",
      "Layer": "Top",
      "Type": "Roof",
      "FlattenedVertices": basePoints.map(p => [p[0], p[1], zBase + height])
    }
  ];

  const uniqueId = crypto.randomUUID();
  const tempDir = os.tmpdir();
  const inputPath = path.join(tempDir, `input_${uniqueId}.json`);
  const outputPath = path.join(tempDir, `output_${uniqueId}.obj`); // [cite: 208]

  try {
    await fs.writeFile(inputPath, JSON.stringify(payload, null, 2));
    
    // Execute the child process with paths as arguments [cite: 201]
    await new Promise<void>((resolve, reject) => {
      execFile(EXE_PATH, [inputPath, outputPath], { cwd: BIN_DIR }, (error, stdout, stderr) => {
        if (error) {
          console.error("C++ Error:", stderr);
          reject(error);
        } else {
          resolve();
        }
      });
    });

    const rawObj = await fs.readFile(outputPath, "utf-8"); // [cite: 208, 209]

    // Cleanup temp files
    await Promise.all([
      fs.unlink(inputPath).catch(() => {}),
      fs.unlink(outputPath).catch(() => {})
    ]);

    return parseObjToJSON(rawObj); // [cite: 209]

  } catch (error) {
    console.error("Bridge Error:", error);
    return null;
  }
}

function parseObjToJSON(objString: string) {
  const lines = objString.split('\n');
  const vertices: number[] = [];
  const indices: number[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'v') {
      vertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])); // [cite: 209]
    } else if (parts[0] === 'f') {
      indices.push(parseInt(parts[1]) - 1, parseInt(parts[2]) - 1, parseInt(parts[3]) - 1); // [cite: 209]
    }
  }
  return vertices.length > 0 ? { vertices, indices } : null;
}