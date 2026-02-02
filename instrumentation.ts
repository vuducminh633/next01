// import { db } from "@/lib/db";
// import { cadObjects } from "@/lib/schema";

// export async function register() {
//   // Only run this on the server side (Node.js)
//   if (process.env.NEXT_RUNTIME === 'nodejs') {
    
//     console.log("  Worker started: Polling Bridge for CAD data...");

//     // Define the polling function
//     const checkBridgeForData = async () => {
//       try {
//         const response = await fetch('http://127.0.0.1:3000/api/cad-data', {
//             method: 'GET',
//             cache: 'no-store', 
//         });

//         if (response.status === 404) {
//             // Silence is golden. No data waiting.
//             return; 
//         }

//         if (!response.ok) {
//             console.warn(`[Worker] Bridge returned error: ${response.status}`);
//             return;
//         }

//         const body = await response.json();
//         console.log(` [Worker] Retrieved ${body.length} items from Bridge.`);

//         if (Array.isArray(body) && body.length > 0) {
            
//             // Map to DB Schema
//             const records = body.map((item: any) => ({
//                 groupName: item.GroupName || "Unknown",
//                 handle: item.Handle,
//                 objectType: item.ObjectType || "Unknown",
//                 layer: item.Layer || "0",
//                 properties: item 
//             })).filter((r: any) => r.handle); 

//             // Insert into Database
//             if (records.length > 0) {
//                 await db.insert(cadObjects).values(records as any);
//                 console.log(` [Worker] Saved ${records.length} objects to Database.`);
//             }
//         }

//       } catch (error) {
//         // This usually happens if the SSH Tunnel is closed
//         console.error(" [Worker] Connection failed. Is the SSH Tunnel open? (Port 3000)");
//       }
//     };

//     setInterval(checkBridgeForData, 5000);
//   }
// }