import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cadObjects } from "@/lib/schema";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Expected a JSON array" }, { status: 400 });
    }

    console.log(`Received batch of ${body.length} CAD objects.`);

    console.log("RECEIVED DATA CONTENT:");
    console.log(JSON.stringify(body, null, 2)); 
    console.log("-------------------------------------------");

    // Map JSON to Database Columns
    const recordsToInsert = body.map((item) => {
      if (!item.Handle) {
        console.warn(" Skipping item - Missing 'Handle'");
        return null;
      }

      return {
        groupName: item.GroupName || "Unknown",
        handle: item.Handle,
        objectType: item.ObjectType || "Unknown",
        layer: item.Layer || "0",
        properties: item 
      };
    });

    const validRecords = recordsToInsert.filter((r) => r !== null);

    if (validRecords.length === 0) {
      return NextResponse.json({ error: "No valid CAD objects found." }, { status: 400 });
    }

    await db.insert(cadObjects).values(validRecords as any);
    
    console.log(` Successfully saved ${validRecords.length} CAD objects.`);

    return NextResponse.json({ 
      message: "CAD data saved successfully", 
      count: validRecords.length 
    }, { status: 200 });

  } catch (error) {
    console.error(" Database Error:", error);
    return NextResponse.json({ error: "Server failed to save data" }, { status: 500 });
  }
}

