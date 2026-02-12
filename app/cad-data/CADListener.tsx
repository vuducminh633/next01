"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { autoFetchFromRedis } from "@/app/actions";

export default function CADListener() {
  const router = useRouter();

  useEffect(() => {
    const checkNewData = async () => {
      try {
         console.log("Polling Redis..."); // Uncomment if you want to see every poll
        const res = await autoFetchFromRedis();
        
        if (res?.success) {
          console.log(`%c[Client] SUCCESS! Received ${res.count} items. Refreshing UI...`, "color: green; font-weight: bold;");
          router.refresh();
        } else if (res && !res.success) {
           console.warn("[Client] Polling returned error:", res.message);
        }
      } catch (err) {
        console.error("[Client] Polling crashed:", err);
      }
    };

    // Poll every 3 seconds
    const interval = setInterval(checkNewData, 3000);
    return () => clearInterval(interval);
  }, [router]);

  return null;
}