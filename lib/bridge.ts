import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execFileAsync = promisify(execFile);

export async function runCppConverter(cadData: any[]) {
  console.log(`\n[Bridge] 1. Starting bridge for ${cadData.length} items...`);
  
  const reqId = Date.now().toString() + Math.floor(Math.random() * 1000);
  const tmpDir = path.join(process.cwd(), "tmp");
  const inPath = path.join(tmpDir, `input_${reqId}.json`);
  const outPath = path.join(tmpDir, `output_${reqId}.obj`);
  
  const exeName = process.platform === "win32" ? "MiningMesher.exe" : "MiningMesher";
  const exePath = path.join(process.cwd(), "bin", exeName);

  try {
    console.log("[Bridge] 2. Ensuring tmp directory exists...");
    await fs.mkdir(tmpDir, { recursive: true });

    console.log("[Bridge] 3. Formatting CAD data for C++...");
    
    let vachCount = 0;
    let truCount = 0;

    const processedData = cadData.map((obj, index) => {
      let properties = obj.properties || obj; 
      if (typeof properties === "string") {
        try { properties = JSON.parse(properties); } catch (e) {}
      }

      const safeType = properties.Type || properties.PartType || obj.partType || "Unknown";
      if (safeType.toLowerCase() === "vách") vachCount++;
      if (safeType.toLowerCase() === "trụ") truCount++;

      let cleaned = properties.FlattenedVertices || [];
      if (cleaned.length > 0) {
        cleaned = [properties.FlattenedVertices[0]]; 
        for (let i = 1; i < properties.FlattenedVertices.length; i++) {
          const curr = properties.FlattenedVertices[i];
          const prev = properties.FlattenedVertices[i - 1];
          if (curr[0] !== prev[0] || curr[1] !== prev[1] || curr[2] !== prev[2]) {
            cleaned.push(curr);
          }
        }
      }

      return { 
        ...properties, 
        Type: safeType,        // Guarantee this exists
        PartType: safeType,   
        FlattenedVertices: cleaned 
      };
    });

    console.log(`[Bridge] -> Data Analysis: Found ${vachCount} Vách lines and ${truCount} Trụ lines.`);
    if (vachCount === 0 || truCount === 0) {
      console.log(`[Bridge] WARNING: 3D Meshing usually requires BOTH Vách (Roof) and Trụ (Floor) to create a block. The C++ might crash!`);
    }

    console.log(`[Bridge] 4. Writing temporary file: ${inPath}`);
    await fs.writeFile(inPath, JSON.stringify(processedData));

    console.log(`[Bridge] 5. Executing C++ binary: ${exePath}`);
    await execFileAsync(exePath, [inPath, outPath], { timeout: 60000, windowsHide: true });

    console.log("[Bridge] 6. Execution finished! Reading generated OBJ...");
    const objContent = await fs.readFile(outPath, "utf8");

    const vertices: number[] = [];
    const indices: number[] = [];
    const lines = objContent.split("\n");

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts[0] === "v") {
        vertices.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
      } else if (parts[0] === "f") {
        indices.push(parseInt(parts[1]) - 1, parseInt(parts[2]) - 1, parseInt(parts[3]) - 1);
      }
    }

    console.log(`[Bridge] 8. SUCCESS! Parsed ${vertices.length / 3} vertices.`);
    
    await fs.unlink(inPath).catch(() => {});
    await fs.unlink(outPath).catch(() => {});

    return { vertices, indices };

  } catch (error: any) {
    console.error("\n====================================================");
    console.error(" [Bridge] C++ EXECUTION FAILED ");
    
    //WINDOWS CRASH CODE
    console.error(`Windows Crash Code: ${error.code}`); 
    console.error(`Error Message: ${error.message}`);
    
    console.error("====================================================\n");
    return null;
  }
}