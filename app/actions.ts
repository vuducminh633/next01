"use server";

import { vietnamData, users, cadObjects } from "@/lib/schema";
import { db } from "@/lib/db";
import { eq, desc, asc, isNotNull, sql } from "drizzle-orm";
import bcrypt from "bcrypt";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Redis from "ioredis";

// 1. Fetch Vietnam Geo Data
export async function getGeoData() {
  try {
    const data = await db
      .select({
        id: vietnamData.gid,
        name: vietnamData.name,
        type: vietnamData.fclass,
        code: vietnamData.code,
        bridge: vietnamData.bridge,
        tunnel: vietnamData.tunnel,
        speed: vietnamData.maxspeed,
        geoText: sql<string>`ST_AsText(${vietnamData.geom})`,
      })
      .from(vietnamData)
      .where(isNotNull(vietnamData.name))
      .limit(20)
      .orderBy(asc(vietnamData.gid));

    return data;
  } catch (error) {
    console.error("Database Error:", error);
    return [];
  }
}

// 2. Register User
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

// 3. Mark Group as Viewed (Remove "NEW" badge)
export async function markGroupAsViewed(groupName: string) {
  try {
    await db
      .update(cadObjects)
      .set({ isNew: false })
      .where(eq(cadObjects.groupName, groupName));

    revalidatePath("/cad-data");
  } catch (error) {
    console.error("Failed to mark group as viewed:", error);
  }
}

// 4. Save CAD Data (Manual Upload from File)
export async function saveCadData(jsonData: any[]) {
  try {
    if (!Array.isArray(jsonData)) {
      return { error: "Invalid JSON format. Expected an array." };
    }

    const records = jsonData.map((item) => ({
      groupName: item.GroupName,
      handle: item.Handle,
      objectType: item.ObjectType,
      layer: item.Layer,
      properties: item,
      isNew: true, // Mark as new so it pulses in UI
    }));

    await db.insert(cadObjects).values(records);

    revalidatePath("/cad-data");
    return { success: true };
  } catch (error) {
    console.error("Upload Error:", error);
    return { error: "Failed to save data to server." };
  }
}

// 5. Fetch CAD Data for Display
export async function getCadData() {
  const data = await db
    .select()
    .from(cadObjects)
    .orderBy(desc(cadObjects.createdAt))
    .limit(100); // Increased limit slightly to see more history

  return data;
}

// ---------------------------------------------------------
// 6. NEW FUNCTION: Sync from Redis (Button Click)
// ---------------------------------------------------------
export async function syncRedisData() {
  let redis: Redis | null = null;

  try {
    redis = new Redis({
      host: "127.0.0.1",
      port: 6379,
      lazyConnect: true,      
      maxRetriesPerRequest: 0, 
      connectTimeout: 5000,   
    });

    redis.on("error", (err) => {
      // We suppress the error here because we handle it in the try/catch below
    });

    await redis.connect();

    const rawData = await redis.get("latest_mining_data");

    if (!rawData) {
      return { error: "Tunnel is open, but no data found in Redis." };
    }

    const jsonData = JSON.parse(rawData);


    const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];
    const records = dataArray.map((item: any) => ({
      groupName: item.GroupName || "Tunnel_Import",
      handle: item.Handle || "Unknown",
      objectType: item.ObjectType || "Unknown",
      layer: item.Layer || "0",
      properties: item,
      isNew: true,
    }));

    if (records.length > 0) {
      await db.insert(cadObjects).values(records);
    }

    revalidatePath("/cad-data");
    return { success: true, count: records.length };

  } catch (error) {
    // This will catch the actual failure nicely
    console.error("Sync Failed:", error);
    return { error: "Connection failed. Is your SSH tunnel running?" };
  } finally {

    if (redis) {
      try {
 
        redis.disconnect(); 
      } catch (e) {
      }
    }
  }
}