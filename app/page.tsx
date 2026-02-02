import { auth } from "../auth"
import { SignIn, SignOut } from "../components/auth-buttons"
import { getGeoData } from "./actions";
import LiveMapData from "../components/LiveMapData";
import Link from "next/link";

export default async function Home() {
  const session = await auth();
  
  // Only fetch data if logged in
  const initialData = session ? await getGeoData() : [];

  if (session) {
    // --- VIEW FOR LOGGED IN USERS ---
    return (
      <div className="flex flex-col h-screen">
        <header className="flex justify-between items-center p-4 bg-white shadow-md z-10">
          <h1 className="text-xl font-bold">Vietnam Infrastructure Map</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Welcome, {session.user?.name}</span>
            <SignOut />
          </div>
        </header>

        <div className="flex-1 overflow-hidden">
           <LiveMapData initialData={initialData} />
        </div>
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