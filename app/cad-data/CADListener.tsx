"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CADListener() {
  const router = useRouter();

  useEffect(() => {
    console.log("Starting lightweight SSE CAD Listener...");
    
    // Open the single, dedicated pipeline to the server
    const eventSource = new EventSource("/api/cad-stream");

    // This fires ONLY when the server pushes new data down the pipe
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === "refresh") {
          console.log(`%c[Client] SUCCESS! Server saved ${data.count} items. Refreshing UI...`, "color: green; font-weight: bold;");
          // Tell Next.js to update the screen with the new database data!
          router.refresh();
        }
      } catch (err) {
        console.error("[Client] Failed to parse SSE message", err);
      }
    };

    // If the server restarts, EventSource will automatically try to reconnect!
    eventSource.onerror = (error) => {
      console.error("[Client] SSE Connection interrupted. Reconnecting...");
    };

    // Close the pipeline if the user leaves the page
    return () => {
      eventSource.close();
    };
  }, [router]);

  // Invisible component
  return null; 
}