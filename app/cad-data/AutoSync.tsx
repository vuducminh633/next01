"use client";

import { useEffect, useState } from "react";
import { syncRedisData } from "../actions"; // This imports your fixed server action
import { useRouter } from "next/navigation";

export default function AutoSync() {
  const router = useRouter();
  const [status, setStatus] = useState("Idle");

  useEffect(() => {
    // Run this loop every 3 seconds
    const interval = setInterval(async () => {
      setStatus("Syncing...");
      
      try {
        // Call the server action to check Redis
        const result = await syncRedisData();

        if (result?.success && result.count && result.count > 0) {
          console.log(`AutoSync: Imported ${result.count} new items.`);
          setStatus(`Imported ${result.count} items!`);
          
          // Refresh the page to show new data
          router.refresh(); 
        } else if (result?.error) {
          // Log error but don't stop the loop
          console.warn(result.error);
          setStatus("Waiting...");
        } else {
          setStatus("Listening...");
        }
      } catch (err) {
        console.error("AutoSync failed", err);
        setStatus("Error");
      }
    }, 3000); 

    return () => clearInterval(interval);
  }, [router]);

  // Visual Indicator for the UI
  return (
    <div className="flex items-center gap-2 text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded border">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
      </span>
      {status}
    </div>
  );
}