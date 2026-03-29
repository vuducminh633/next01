import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execFileAsync = promisify(execFile);

export async function runCppConverter(cadData: any[]) {
  console.log(`\n[Bridge] 1. Starting bridge for ${cadData.length} items...`);
  
  // Use a simple timestamp ID so we don't rely on external crypto libraries
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
    const processedData = cadData.map(obj => {
      const properties = obj.properties || obj; 
      if (properties.FlattenedVertices && Array.isArray(properties.FlattenedVertices)) {
        const cleaned = [properties.FlattenedVertices[0]]; 
        for (let i = 1; i < properties.FlattenedVertices.length; i++) {
          const curr = properties.FlattenedVertices[i];
          const prev = properties.FlattenedVertices[i - 1];
          if (curr[0] !== prev[0] || curr[1] !== prev[1] || curr[2] !== prev[2]) {
            cleaned.push(curr);
          }
        }
        return { ...properties, FlattenedVertices: cleaned };
      }
      return properties;
    });

    console.log(`[Bridge] 4. Writing temporary file: ${inPath}`);
    await fs.writeFile(inPath, JSON.stringify(processedData));

    console.log(`[Bridge] 5. Executing C++ binary: ${exePath}`);

    await execFileAsync(exePath, [inPath, outPath], { timeout: 15000, windowsHide: true });

    console.log("[Bridge] 6. Execution finished! Reading generated OBJ...");
    const objContent = await fs.readFile(outPath, "utf8");

    console.log("[Bridge] 7. Parsing OBJ data into WebGL arrays...");
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

    console.log(`[Bridge] 8. SUCCESS! Parsed ${vertices.length / 3} vertices and ${indices.length / 3} faces.`);
    return { vertices, indices };

  } catch (error: any) {
    console.error("\n[Bridge] C++ EXECUTION ERROR:", error.message || error);
    return null;
  } finally {
    console.log("[Bridge] 9. Cleaning up temporary files...");
    await fs.unlink(inPath).catch(() => {});
    await fs.unlink(outPath).catch(() => {});
  }
}