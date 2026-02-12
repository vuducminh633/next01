import { getMaps } from "../actions";
import Link from "next/link";

// Ensure the page always fetches fresh data
export const dynamic = "force-dynamic";

export default async function CadDataIndexPage() {
  // Fetch Maps instead of raw objects
  const maps = await getMaps();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-8 text-xs text-gray-500">
           <Link href="/" className="hover:text-white transition-colors">Home</Link>
           <span>/</span>
           <span className="text-white">All Projects</span>
        </div>

        <div className="flex justify-between items-end mb-6 pb-4 border-b border-gray-800">
          <h1 className="text-2xl font-bold text-white">
            All Mining Projects
          </h1>
          <span className="text-xs text-gray-500">{maps.length} maps found</span>
        </div>

        {/* LIST VIEW */}
        <div className="flex flex-col gap-2">
          {maps.map((map) => (
            <Link key={map.id} href={`/cad-data/${map.id}`}>
              <div className="bg-[#151515] border border-gray-800 rounded p-4 flex items-center justify-between hover:bg-[#1a1a1a] hover:border-blue-900 transition-all cursor-pointer group">
                
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 bg-[#222] rounded flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                      🗺️
                   </div>
                   <div>
                      <h2 className="font-bold text-gray-200 text-sm group-hover:text-blue-400">{map.name}</h2>
                      <p className="text-[10px] text-gray-500">ID: {map.id}</p>
                   </div>
                </div>

                <div className="flex items-center gap-8">
                   <div className="text-right hidden sm:block">
                      <p className="text-[10px] text-gray-600 uppercase">Created</p>
                      <p className="text-xs text-gray-400">
                        {map.createdAt ? new Date(map.createdAt).toLocaleDateString() : '-'}
                      </p>
                   </div>
                   
                   <div className="w-8 h-8 rounded-full border border-gray-700 flex items-center justify-center text-gray-500 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                      &rarr;
                   </div>
                </div>

              </div>
            </Link>
          ))}
        </div>

        {maps.length === 0 && (
           <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <p className="mb-4">No maps found in the database.</p>
              <Link href="/upload" className="text-blue-500 underline text-sm">Upload New Data</Link>
           </div>
        )}
      </div>
    </div>
  );
}