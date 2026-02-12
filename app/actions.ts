"use server";

import { users, cadObjects, drillCoreData, maps } from "@/lib/schema";
import { db } from "@/lib/db";
import { eq, desc, sql, and  } from "drizzle-orm";
import bcrypt from "bcrypt";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Redis from "ioredis";
import { runCppConverter } from "@/lib/bridge";

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

// --- CAD DATA MANAGEMENT ---

// Save CAD Data (Simplified: Create Map -> Save Objects)
export async function saveCadData(jsonData: any[]) {
  console.log(`[Server] saveCadData called with ${jsonData?.length} items`);

  try {
    if (!Array.isArray(jsonData) || jsonData.length === 0) {
      console.error("[Server] Error: Data is not an array or is empty");
      return { error: "Invalid JSON format or empty data." };
    }

    // 1. Group by Map
    const dataByMap: Record<string, typeof jsonData> = {};
    for (const item of jsonData) {
      const mapName = item.MapName || "Untitled Map";
      if (!dataByMap[mapName]) dataByMap[mapName] = [];
      dataByMap[mapName].push(item);
    }

    let lastMapId: number | null = null;

    // 2. Process Maps
    for (const [mapName, items] of Object.entries(dataByMap)) {
      console.log(`[Server] Processing Map: "${mapName}" with ${items.length} objects`);

      // 1. ALWAYS CREATE OR FIND MAP (Upsert-like logic)
      let mapRecord;
      
      // Try finding first
      const [existingMap] = await db.select().from(maps).where(eq(maps.name, mapName)).limit(1);
      
      if (existingMap) {
         mapRecord = existingMap;
      } else {
         console.log(`[Server] Map "${mapName}" not found. Creating new...`);
         const [newMap] = await db.insert(maps).values({ name: mapName }).returning();
         mapRecord = newMap;
      }
      
      console.log(`[Server] Using Map ID: ${mapRecord.id}`);
      lastMapId = mapRecord.id;

      // 2. Insert Objects
      const records = items.map((item: any) => ({
        mapId: mapRecord!.id,
        handle: item.Handle,
        layer: item.Layer,
        viaName: item.ViaName,
        blockName: item.BlockName,
        partType: item.Type,
        objectType: "Polyline",
        properties: item,
        isNew: true,
      }));

      console.log(`[Server] Bulk inserting/updating ${records.length} records...`);
      
     console.log(`[Server] Inserting ${records.length} records into DB...`);
      await db.insert(cadObjects).values(records);
      
      console.log(`[Server] DB Write Successful for ${mapName}`);
        
      console.log(`[Server] Success for ${mapName}`);
    }

    // Refresh UI
    console.log("[Server] Revalidating Layout...");
    revalidatePath("/", "layout");
    
    return { success: true, count: jsonData.length, mapId: lastMapId };

  } catch (error) {
    console.error("[Server] CRITICAL SAVE ERROR:", error);
    return { error: "Failed to process map data." };
  }
}

// --- DATA FETCHING ---

export async function getMaps() {
  return await db.select().from(maps).orderBy(desc(maps.createdAt));
}

export async function getMapObjects(mapId: number) {
  return await db
    .select()
    .from(cadObjects)
    .where(eq(cadObjects.mapId, mapId))
    .orderBy(desc(cadObjects.createdAt));
}

// --- 3D GENERATION STUB ---
export async function generate3DModel(id: number) {
  try {
    // 1. Find the target object to get its group identifiers
    const [target] = await db.select().from(cadObjects).where(eq(cadObjects.id, id));
    if (!target || !target.viaName || !target.blockName) {
      return { error: "Object or group metadata not found." };
    }

    // 2. Fetch ALL fragments in this group [cite: 142]
    // The C++ tool needs the entire collection to perform stitching [cite: 202, 205]
    const fragments = await db
      .select()
      .from(cadObjects)
      .where(
        and(
          eq(cadObjects.mapId, target.mapId),
          eq(cadObjects.viaName, target.viaName),
          eq(cadObjects.blockName, target.blockName)
        )
      );

    console.log(`[Server] Merging ${fragments.length} fragments for ${target.viaName} - ${target.blockName}`);

    // 3. Call the C++ bridge with the full array [cite: 65, 197]
    const mesh = await runCppConverter(fragments);

    if (!mesh) return { error: "C++ conversion failed to produce a mesh." };

    // 4. Update all objects in the group with the new mesh data [cite: 128]
    // This ensures that clicking any part of the tunnel shows the full stitched model
    const updatedProperties = {
      threeDGeometry: mesh,
      processingStatus: "done",
      vertexCount: mesh.vertices.length / 3, // [cite: 294]
    };

    await db
      .update(cadObjects)
      .set({
        properties: sql`properties || ${JSON.stringify(updatedProperties)}::jsonb`,
        isNew: false,
      })
      .where(
        and(
          eq(cadObjects.mapId, target.mapId),
          eq(cadObjects.viaName, target.viaName),
          eq(cadObjects.blockName, target.blockName)
        )
      );

    revalidatePath("/", "layout");
    return { success: true, mesh };
  } catch (error) {
    console.error("Merge-and-Generate Error:", error);
    return { error: "Server error during 3D generation." };
  }
}

// --- REDIS AUTOMATION ---

export async function autoFetchFromRedis() {
  const redis = new Redis({
    host: "127.0.0.1",
    port: 6379,
    connectTimeout: 2000,
    lazyConnect: true,
  });

  try {
     console.log("[Redis] Connecting...");
    await redis.connect();
    const rawData = await redis.get("latest_mining_data");

    if (!rawData) {
      await redis.quit();
      return { success: false, message: "No new data" };
    }

    console.log(`[Redis] DATA RECEIVED! Length: ${rawData.length} chars`);
    
    let jsonData;
    try {
      jsonData = JSON.parse(rawData);
    } catch (e) {
      console.error("[Redis] JSON Parse Error:", e);
      await redis.quit();
      return { success: false, error: "Invalid JSON in Redis" };
    }

    const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
    console.log(`[Redis] Sending ${dataArray.length} items to DB...`);

    const result = await saveCadData(dataArray);

    if (result.success) {
      console.log("[Redis] Save Successful. Deleting key...");
      await redis.del("latest_mining_data");
      await redis.quit();
      return { success: true, count: result.count, mapId: result.mapId };
    } else {
      console.error("[Redis] Save Failed:", result.error);
    }

    await redis.quit();
    return { success: false };
  } catch (err) {
    console.error("[Redis] Connection Error:", err);
    try { await redis.quit(); } catch {}
    return { success: false };
  }
}

export async function deleteMap(mapId: number) {
  try {
    console.log(`[Server] Deleting Map ID: ${mapId}`);

    // 1. Delete all objects associated with this map first
    await db.delete(cadObjects).where(eq(cadObjects.mapId, mapId));

    // 2. Delete the map entry itself
    await db.delete(maps).where(eq(maps.id, mapId));

    // 3. Revalidate to remove the card from the Hub immediately
    revalidatePath("/", "layout");

    return { success: true };
  } catch (error) {
    console.error("Delete Map Error:", error);
    return { success: false, error: "Failed to delete project" };
  }
}

