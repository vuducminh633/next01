"use server";

import { users} from "@/lib/schema";
import { maps, vias, blocks, cadLines, blockMeshes } from "@/lib/schema";
import { db } from "@/lib/db";
import { eq, desc, sql, and  , inArray} from "drizzle-orm";
import bcrypt from "bcrypt";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Redis from "ioredis";
import { runCppConverter } from "@/lib/bridge";


const redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
redisClient.on("error", () => {});

const rgbToHex = (r: number, g: number, b: number) => {
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
};

// --- USER AUTHENTICATION ---
export async function registerUser(prevState: any, formData: FormData) {
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password || !name) {
    return { error: "Please fill in all fields." };
  }

  try {
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    
    if (existingUser) {
      return { error: "This email is already registered." };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
    });
  } catch (error) {
    console.error("Registration Error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  redirect("/login");
}


export async function saveCadData(rawText: string, mapNameStr: string = "Bản đồ Nhập liệu") {
  try {
    console.log("\n--- [Server] STARTING CAD DATA UPLOAD ---");
    console.log(`[Server] 1. Parsing string payload (${rawText.length} characters)`);

    // 1. Safely Parse the String back into JSON on the Server
    let jsonData = JSON.parse(rawText);
    if (!Array.isArray(jsonData)) jsonData = [jsonData];
    
    console.log(`[Server] 2. Parsed JSON successfully. Found ${jsonData.length} objects.`);
    if (jsonData.length === 0) return { error: "Empty JSON data." };

    // 3. Database: Map
    console.log(`[Server] 3. Finding or creating Map: ${mapNameStr}`);
    let [mapRecord] = await db.select().from(maps).where(eq(maps.name, mapNameStr)).limit(1);
    if (!mapRecord) {
      [mapRecord] = await db.insert(maps).values({ name: mapNameStr }).returning();
    }

    // 4. Memory Grouping
    console.log(`[Server] 4. Grouping data into hierarchy...`);
    const groupedData: Record<string, Record<string, any[]>> = {};
    for (const item of jsonData) {
      const vName = item.ViaName || item.GroupName || "Unknown Vỉa";
      const bName = item.BlockName || "Default Khối";
      if (!groupedData[vName]) groupedData[vName] = {};
      if (!groupedData[vName][bName]) groupedData[vName][bName] = [];
      groupedData[vName][bName].push(item);
    }

    // 5. Database: Vỉa, Khối, and Lines
    console.log(`[Server] 5. Preparing relational data...`);
    const linesToInsert = [];

    for (const [vName, blocksObj] of Object.entries(groupedData)) {
      let [viaRecord] = await db.select().from(vias).where(and(eq(vias.mapId, mapRecord.id), eq(vias.name, vName))).limit(1);
      if (!viaRecord) [viaRecord] = await db.insert(vias).values({ mapId: mapRecord.id, name: vName }).returning();

      for (const [bName, items] of Object.entries(blocksObj)) {
        let [blockRecord] = await db.select().from(blocks).where(and(eq(blocks.viaId, viaRecord.id), eq(blocks.name, bName))).limit(1);
        if (!blockRecord) [blockRecord] = await db.insert(blocks).values({ viaId: viaRecord.id, name: bName }).returning();

        for (const item of items) {
          linesToInsert.push({
            blockId: blockRecord.id,
            handle: item.Handle || `CAD-${Date.now()}-${Math.floor(Math.random() * 10000)}`, 
            partType: item.PartType || item.Type || item.ObjectType || "Unknown",
            layer: item.Layer || "0",
            properties: item, 
          });
        }
      }
    }

    // 6. Bulk Insert (CHUNKED to prevent call stack crashes!)
    console.log(`[Server] 6. Pushing ${linesToInsert.length} lines to PostgreSQL...`);
    
    if (linesToInsert.length > 0) {
      const CHUNK_SIZE = 100; 
      for (let i = 0; i < linesToInsert.length; i += CHUNK_SIZE) {
        const chunk = linesToInsert.slice(i, i + CHUNK_SIZE);
        await db.insert(cadLines)
                .values(chunk)
        console.log(`[Server] -> Safely inserted items ${i + 1} to ${i + chunk.length}`);
      }
    }

    console.log(`[Server] 7. Upload Complete! Revalidating UI...`);
    revalidatePath("/", "layout");
    
    return { success: true, count: linesToInsert.length };

  } catch (error: any) {
    console.error("\n[Server] CRITICAL SAVE ERROR:", error);
    return { error: `Server failed to save: ${error.message}` };
  }
}

export async function getMaps() {
  return await db.select().from(maps).orderBy(desc(maps.createdAt));
}

export async function getMapObjects(mapId: number) {
  // Using db.query allows Drizzle to automatically join all the tables
  // and return the data as a perfect Map -> Via -> Block -> Lines tree!
  const mapData = await db.query.maps.findFirst({
    where: eq(maps.id, mapId),
    with: {
      vias: {
        with: {
          blocks: {
            with: {
              lines: true,
              mesh: true, // Also fetches the 3D model if it has been generated
            },
          },
        },
      },
    },
  });

  return mapData;
}

// --- 3D GENERATION STUB ---
export async function generate3DModel(blockId: number) {
  try {
    console.log(`\n--- [Server] STARTING 3D GEN FOR BLOCK ID: ${blockId} ---`);
    
    console.log("[Server] 1. Fetching CAD fragments from database...");
    const fragments = await db.select().from(cadLines).where(eq(cadLines.blockId, blockId));

    if (!fragments || fragments.length === 0) {
      console.log("[Server] Error: No fragments found in database for this block.");
      return { error: "No fragments found in this block." };
    }

    console.log(`[Server] 2. Found ${fragments.length} fragments! Passing to C++ Bridge...`);
    const mesh = await runCppConverter(fragments);

    if (!mesh) {
      console.error(`[Server] 3. Error: C++ Bridge failed to return a mesh.`);
      return { error: "C++ conversion failed." };
    }



    // --- RGB COLOR EXTRACTION ---
    const rawProperties = fragments[0]?.properties as any;
    let webColor = "#00a8ff"; // Default fallback blue

    if (rawProperties?.TrueColor && Array.isArray(rawProperties.TrueColor) && rawProperties.TrueColor.length === 3) {
      const [r, g, b] = rawProperties.TrueColor;
      
      // Only convert if it's not [0,0,0] (standard AutoCAD "unset" color)
      if (r !== 0 || g !== 0 || b !== 0) {
        webColor = rgbToHex(r, g, b);
      }
    }
    // ----------------------------

    console.log(`[Server] 3. Mesh generated! Block color (RGB): ${webColor}. Saving...`);


    await db.insert(blockMeshes)
      .values({
        blockId: blockId,
        vertices: mesh.vertices,
        indices: mesh.indices,
        color: webColor,
      })
      .onConflictDoUpdate({
        target: blockMeshes.blockId, 
        set: { vertices: mesh.vertices, indices: mesh.indices, color: webColor }
      });

    console.log(`[Server] 4. Save successful! Refreshing UI...`);
    revalidatePath("/", "layout");
    return { success: true, mesh, fragmentCount: fragments.length };

  } catch (error: any) {
    console.error("\n[Server] 3D GENERATION ERROR:", error.message || error);
    return { error: "Server error during 3D generation." };
  }
}

export async function deleteMap(mapId: number) {
  try {
    console.log(`[Server] Deleting Map ID: ${mapId}`);
    await db.delete(maps).where(eq(maps.id, mapId));

    // Revalidate to remove the card from the Hub immediately
    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    console.error("Delete Map Error:", error);
    return { success: false, error: "Failed to delete project" };
  }
}
export async function generateBatch3DModel(lineIds: number[]) {
  process.stdout.write(`\n\n>>> CRITICAL: SERVER RECEIVED CALL FOR ${lineIds.length} IDs <<<\n\n`);
  try {
    console.log(`\n--- [Server] STARTING BATCH 3D GEN FOR ${lineIds?.length} IDs ---`);

    if (!lineIds || lineIds.length === 0) {
      console.log("[Server] Error: No IDs provided in the array.");
      return { error: "No IDs provided" };
    }

    console.log("[Server] 1. Fetching CAD lines from PostgreSQL...");
    // Fetch ALL selected CAD lines at once
    const items = await db
      .select()
      .from(cadLines)
      .where(inArray(cadLines.id, lineIds));

    console.log(`[Server] 2. Found ${items.length} items in DB matching those IDs.`);
    
    if (items.length === 0) {
      console.log("[Server] Error: Database returned 0 items.");
      return { error: "No items found" };
    }

    console.log("[Server] 3. Grouping lines by Block (Khối)...");
    const groupedByBlock: Record<number, typeof items> = {};
    for (const item of items) {
      if (!groupedByBlock[item.blockId]) {
        groupedByBlock[item.blockId] = [];
      }
      groupedByBlock[item.blockId].push(item);
    }

    const generatedMeshes = [];
    console.log(`[Server] 4. Found ${Object.keys(groupedByBlock).length} separate Blocks. Sending to C++ Converter...`);

    // Loop through each group and generate a separate mesh
    for (const [blockIdStr, blockItems] of Object.entries(groupedByBlock)) {
      const blockId = parseInt(blockIdStr);
      console.log(`[Server] -> Processing Block ID: ${blockId} with ${blockItems.length} lines`);

      const mesh = await runCppConverter(blockItems);

      if (mesh) {
        // Find the color specifically for this Block
        const rawProps = blockItems[0]?.properties as any;
        let previewColor = "#00a8ff"; // Default fallback
        
        if (rawProps?.TrueColor && Array.isArray(rawProps.TrueColor) && rawProps.TrueColor.length === 3) {
          const [r, g, b] = rawProps.TrueColor;
          // Only use RGB if it is not pure black [0,0,0]
          if (r !== 0 || g !== 0 || b !== 0) {
            previewColor = rgbToHex(r, g, b);
          }
        }

        generatedMeshes.push({
          ...mesh,
          blockId: blockId,
          color: previewColor
        });
      } else {
        console.error(`[Server] -> Error: Converter failed for Block ID: ${blockId}`);
      }
    }

    if (generatedMeshes.length === 0) {
        return { error: "Converter failed to generate any meshes" };
    }

    console.log(`[Server] 5. Batch generation successful! Returning ${generatedMeshes.length} meshes to UI...`);
    
    // Notice we are returning `meshes` (array) instead of `mesh` (single object)
    return { success: true, meshes: generatedMeshes };

  } catch (e: any) {
    console.error("\n[Server] BATCH GEN ERROR:", e.message || e);
    return { error: `Server Error during batch generation: ${e.message}` };
  }
}

export async function autoFetchFromRedis() {
  try {

    const Redis = (await import("ioredis")).default;
    //const redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

    const rawData = await redisClient.lpop("cad_exports"); 

    if (!rawData) {
      return { success: false, message: "No new data in Redis." };
    }

    console.log(`[Server] Pulled new data from Redis. Formatting for database...`);

    // Send the raw string directly to our function! No fake Files needed.
    const saveResult = await saveCadData(rawData, "Bản đồ Live (AutoCAD)");

    if (saveResult.success) {
      return { success: true, count: saveResult.count };
    } else {
      console.error("[Server] DB Save Error:", saveResult.error);
      return { success: false, message: saveResult.error };
    }

  } catch (error) {
    console.error("[Server] Redis Polling Error:", error);
    return { success: false, message: "Internal Server Error" };
  }
}
    
  