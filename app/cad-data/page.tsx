// app/cad-data/page.tsx
import { getCadData, syncRedisData } from "../actions";
import Link from "next/link";
import CadGroupViewer from "./CadGroupViewer";
import AutoSync from "./AutoSync";

export const dynamic = "force-dynamic"; 

export default async function CadDataPage() {
  const rawData = await getCadData();

  const formattedData = rawData.map((item) => ({
    ...item,
    properties: (item.properties as Record<string, any>) || {},
    isNew: item.isNew ?? false,
    createdAt: item.createdAt ? item.createdAt.toISOString() : null,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-5xl">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">CAD Data Viewer</h1>
            <div className="flex items-center gap-3 mt-1">
               <p className="text-gray-500 text-sm">PostgreSQL Geometry Database</p>
               <AutoSync />
            </div>
          </div>
          
          
          <div className="flex gap-2">
          
            <form action={async () => {
              "use server";
              await syncRedisData();
            }}>
              <button className="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300 transition shadow text-sm font-medium">
                Force Sync
              </button>
            </form>

            <Link href="/upload">
              <button className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition shadow text-sm font-medium">
                + Upload File
              </button>
            </Link>
          </div>
        </div>

        {formattedData.length > 0 ? (
          <CadGroupViewer data={formattedData} />
        ) : (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
             <p className="text-gray-500">No data found.</p>
          </div>
        )}
      </div>
    </div>
  );
}