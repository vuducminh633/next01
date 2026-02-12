import { auth } from "../auth";
import { SignOut } from "../components/auth-buttons";
import { getMaps } from "./actions"; 
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();

  // --- VIEW FOR LOGGED IN USERS (PROJECT HUB) ---
  if (session) {
    const maps = await getMaps();

    return (
      <div className="min-h-screen bg-[#0f0f0f] text-gray-200 font-sans">
        
        {/* HEADER */}
        <header className="flex justify-between items-center px-8 py-5 bg-[#1a1a1a] border-b border-[#333]">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white w-8 h-8 flex items-center justify-center rounded font-bold shadow-lg shadow-blue-900/50">M</div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">Mine Digital Twin</h1>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Project Hub</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-400">Welcome back,</p>
              <p className="text-sm font-semibold text-white">{session.user?.name}</p>
            </div>
            <SignOut />
          </div>
        </header>

        {/* MAIN CONTENT */}
        <main className="p-8 max-w-7xl mx-auto">
          
          <div className="flex justify-between items-end mb-8">
            <div>
              <h2 className="text-2xl font-light text-white">Your Projects</h2>
              <p className="text-xs text-gray-500 mt-1">Select a map to view its Digital Twin</p>
            </div>
            
            <Link href="/cad-data">
              <button className="bg-[#222] hover:bg-[#333] text-gray-300 text-xs font-bold px-4 py-2 rounded transition-all border border-gray-700">
                View All Data
              </button>
            </Link>
          </div>

          {/* PROJECTS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            
            {/* Map Cards */}
            {maps.map((map) => (
              <Link key={map.id} href={`/cad-data/${map.id}`}>
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-4 hover:border-gray-600 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer h-full flex flex-col group relative overflow-hidden">
                  
                  {/* Thumbnail Placeholder */}
                  <div className="h-32 bg-gradient-to-br from-[#222] to-[#111] rounded-lg border border-gray-800 mb-4 flex items-center justify-center relative overflow-hidden group-hover:border-gray-600 transition-colors">
                     <span className="text-4xl opacity-20 group-hover:opacity-100 group-hover:scale-110 transition-all duration-500">🗺️</span>
                     <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md text-[9px] text-gray-300 px-2 py-1 rounded border border-white/10">
                        ID: {map.id}
                     </div>
                  </div>

                  {/* Card Info */}
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-gray-100 group-hover:text-blue-400 transition-colors truncate mb-1">
                      {map.name}
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Created {map.createdAt ? new Date(map.createdAt).toLocaleDateString() : 'Unknown'}
                    </p>
                  </div>

                  {/* Hover Action */}
                  <div className="mt-4 pt-3 border-t border-[#333] flex justify-between items-center opacity-60 group-hover:opacity-100 transition-opacity">
                     <span className="text-[10px] text-gray-500">3D View Ready</span>
                     <span className="text-[10px] text-blue-500 font-bold">Open &rarr;</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {maps.length === 0 && (
            <div className="mt-12 text-center border border-gray-800 rounded-2xl p-10 bg-[#161616]">
              <div className="text-4xl mb-4 opacity-30">📡</div>
              <h3 className="text-gray-300 font-bold mb-2">No projects found</h3>
              <p className="text-gray-500 text-sm mb-6">Waiting for data stream from server tunnel...</p>
              <div className="animate-pulse text-xs text-blue-500">Listening to Redis channel...</div>
            </div>
          )}

        </main>
      </div>
    );
  }

  // --- VIEW FOR GUESTS (Landing Page) ---
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="text-center space-y-6 bg-white p-10 rounded-2xl shadow-xl max-w-md w-full">
        <h1 className="text-3xl font-bold text-gray-900">Welcome</h1>
        <p className="text-gray-500">Please sign in to access the infrastructure data.</p>
        
        <div className="space-y-3">
          <Link href="/login" className="block w-full">
            <button className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition">
              Sign In
            </button>
          </Link>
          
          <Link href="/register" className="block w-full">
            <button className="w-full py-3 px-4 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold rounded-lg transition">
              Create Account
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}