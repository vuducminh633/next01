// app/api/cad-stream/route.ts
import { NextResponse } from "next/server";
import Redis from "ioredis";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const redisClient = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

  // Create a readable stream that the browser can listen to
  const stream = new ReadableStream({
    async start(controller) {
      console.log("[SSE] Client connected to Redis stream.");

      // Function to check Redis
      const checkRedis = async () => {
        try {
          // Check for data
          const rawData = await redisClient.lpop("cad_exports");
          
          if (rawData) {
            console.log("[SSE] Found new CAD data! Pushing to client...");
            // Push the data down the open pipe to the browser
            controller.enqueue(`data: ${rawData}\n\n`);
          }
        } catch (error) {
          console.error("[SSE] Redis Error:", error);
        }
      };

      // Check every 2 seconds, but doing it HERE on the server means 
      // it takes ZERO network lanes away from the browser!
      const interval = setInterval(checkRedis, 2000);

      // Clean up if the user closes the browser tab
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        redisClient.quit();
        console.log("[SSE] Client disconnected.");
      });
    }
  });

  // Return the stream with the specific headers required for SSE
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}