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


// // Save CAD Data (Simplified: Create Map -> Save Objects)
// export async function saveCadData(jsonData: any[], mapNameStr: string = "Bản đồ Nhập liệu") {
//   try {
//     if (!Array.isArray(jsonData) || jsonData.length === 0) {
//       return { error: "Invalid JSON format or empty data." };
//     }

//     //  FIND OR CREATE MAP
//     let [mapRecord] = await db.select().from(maps).where(eq(maps.name, mapNameStr)).limit(1);
//     if (!mapRecord) {
//       [mapRecord] = await db.insert(maps).values({ name: mapNameStr }).returning();
//     }

//     //  GROUP THE FLAT JSON IN MEMORY
//     // Structure: { "Via 1": { "Khoi 1": [item1, item2], "Khoi 2": [...] } }
//     const groupedData: Record<string, Record<string, any[]>> = {};
    
//     for (const item of jsonData) {
//       const vName = item.ViaName || item.GroupName || "Unknown Vỉa";
//       const bName = item.BlockName || "Default Khối";
      
//       if (!groupedData[vName]) groupedData[vName] = {};
//       if (!groupedData[vName][bName]) groupedData[vName][bName] = [];
//       groupedData[vName][bName].push(item);
//     }

//     // INSERT INTO RELATIONAL TABLES
//     const linesToInsert = [];

//     for (const [vName, blocksObj] of Object.entries(groupedData)) {
//       // A. Insert or Find Vỉa
//       let [viaRecord] = await db.select().from(vias)
//         .where(and(eq(vias.mapId, mapRecord.id), eq(vias.name, vName))).limit(1);
      
//       if (!viaRecord) {
//         [viaRecord] = await db.insert(vias).values({ mapId: mapRecord.id, name: vName }).returning();
//       }

//       for (const [bName, items] of Object.entries(blocksObj)) {
//         // B. Insert or Find Khối
//         let [blockRecord] = await db.select().from(blocks)
//           .where(and(eq(blocks.viaId, viaRecord.id), eq(blocks.name, bName))).limit(1);
        
//         if (!blockRecord) {
//           [blockRecord] = await db.insert(blocks).values({ viaId: viaRecord.id, name: bName }).returning();
//         }

//         // Prepare CAD Lines for this Khối
//         for (const item of items) {
//           linesToInsert.push({
//             blockId: blockRecord.id,
//             handle: item.Handle || crypto.randomUUID(), // Handle must be unique
//             partType: item.PartType || item.Type || item.ObjectType || "Unknown",
//             layer: item.Layer || "0",
//             properties: item, // Save the raw geometry here
//           });
//         }
//       }
//     }

//     // BULK INSERT ALL CAD LINES
//     if (linesToInsert.length > 0) {
//       // Using onConflictDoNothing in case you re-upload the same file
//       await db.insert(cadLines).values(linesToInsert).onConflictDoNothing({ target: cadLines.handle });
//     }

//     revalidatePath("/", "layout");
//     return { success: true, count: linesToInsert.length };

//   } catch (error) {
//     console.error("[Server] CRITICAL SAVE ERROR:", error);
//     return { error: "Failed to process and save hierarchical map data." };
//   }
// }
// --- DATA FETCHING ---

// Save CAD Data (Simplified: Create Map -> Save Objects)
// Save CAD Data (FormData Version)
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
                .onConflictDoNothing({ target: cadLines.handle });
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
    // 1. Fetch ALL fragments (Vách/Trụ) belonging directly to this Block
    const fragments = await db
      .select()
      .from(cadLines)
      .where(eq(cadLines.blockId, blockId));

    if (!fragments || fragments.length === 0) {
      return { error: "No fragments found in this block." };
    }

    console.log(`[Server] Stitching ${fragments.length} fragments for Block ID: ${blockId}`);
    
    //  Pass the ENTIRE fragments array to the C++ converter for stitching
    const mesh = await runCppConverter(fragments);
    
    if (!mesh) {
      console.error(`[Server] C++ conversion failed`);
      return { error: "C++ conversion failed." };
    }

    //  Save the resulting 3D Model into the dedicated block_meshes table
    // We use onConflictDoUpdate so if you click "Generate" again, it overwrites the old mesh instead of crashing.
    await db.insert(blockMeshes)
      .values({
        blockId: blockId,
        vertices: mesh.vertices,
        indices: mesh.indices,
      })
      .onConflictDoUpdate({
        target: blockMeshes.blockId, // The unique constraint we set in schema.ts
        set: {
          vertices: mesh.vertices,
          indices: mesh.indices,
        }
      });

    console.log(`[Server] Successfully saved 3D Mesh for Block ID: ${blockId}`);

    revalidatePath("/", "layout");
    return { success: true, mesh, fragmentCount: fragments.length };

  } catch (error) {
    console.error("[Server] Generate 3D Error:", error);
    return { error: "Server error during 3D generation." };
  }
}

export async function deleteMap(mapId: number) {
  try {
    console.log(`[Server] Deleting Map ID: ${mapId}`);

    // Because we set 'onDelete: "cascade"' in schema.ts, 
    // deleting the Map automatically triggers PostgreSQL to delete 
    // all connected Vias, Blocks, CAD Lines, and Meshes instantly!
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
      try {
        if (lineIds.length === 0) return { error: "No IDs provided" };
    
        // Fetch ALL selected CAD lines at once using the new table
        const items = await db
          .select()
          .from(cadLines)
          .where(inArray(cadLines.id, lineIds));
    
        if (items.length === 0) return { error: "No items found" };
    
        //  Send the WHOLE BATCH to the C++ Converter
        const mesh = await runCppConverter(items);
    
        if (!mesh) {
            return { error: "Converter returned empty mesh" };
        }
    
        // Return the combined mesh
        // As you noted, we just return this for a temporary UI preview. 
        // We don't save it to the DB because it's a custom batch, not a strict Khối.
        return { success: true, mesh };
    
      } catch (e) {
        console.error("Batch Gen Error:", e);
        return { error: "Server Error during batch generation" };
      }
    }


// export async function autoFetchFromRedis() {
//   try {
//     // Pull the oldest item from the Redis list (Queue)
//     // *Note: Change "cad_exports" to whatever key C# plugin is saving to in Redis!
//     const rawData = await redisClient.lpop("cad_exports"); 

//     if (!rawData) {
//       return { success: false, message: "No new data in Redis." };
//     }

//     // Parse the JSON string from AutoCAD
//     const parsedData = JSON.parse(rawData);
    
//     // Ensure it's an array for our saveCadData function
//     const dataArray = Array.isArray(parsedData) ? parsedData : [parsedData];

//     if (dataArray.length === 0) {
//       return { success: false, message: "Redis data was empty." };
//     }

//     console.log(`[Server] Pulled ${dataArray.length} items from Redis. Saving to database...`);

//     // Pass the parsed data directly to hierarchical save function!
//     const saveResult = await saveCadData(dataArray, "Bản đồ Live (AutoCAD)");

//     if (saveResult.success) {
//       return { success: true, count: saveResult.count };
//     } else {
//       console.error("[Server] DB Save Error:", saveResult.error);
//       return { success: false, message: saveResult.error };
//     }

//   } catch (error) {
//     console.error("[Server] Redis Polling Error:", error);
//     return { success: false, message: "Internal Server Error" };
//   }
// }
export async function autoFetchFromRedis() {
  try {

    const Redis = (await import("ioredis")).default;
    const redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    
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
    
  