"use client"; 
import { useState } from "react";


// Define the type of your data (simplified for this example)
type RoadItem = {
  id: number;
  name: string | null;
  type: string | null; 
  code: number | null;
  bridge: string | null;
  tunnel: string | null;
  speed: number | null;
  geoText: string;
};

export default function LiveMapData({ initialData }: { initialData: RoadItem[] }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);

  // Function to re-fetch data from the server
  // const handleRefresh = async () => {
  //   setLoading(true);
  //   try {
  //     const newData = await getGeoData();
  //     setData(newData);
  //   } catch (error) {
  //     console.error("Failed to refresh", error);
  //   }
  //   setLoading(false);
  // };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">

      <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
        <h3 className="font-semibold text-gray-700">Live Data ({data.length})</h3>
        <button
       //   onClick={handleRefresh}
          disabled={loading}
          className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? "Updating..." : "Refresh Data"}
        </button>
      </div>

      {/* The List */}
      <ul className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
        {data.map((item) => (
          <li key={item.id} className="p-4 hover:bg-gray-50 grid grid-cols-12 gap-4 items-center text-sm">
            <div className="col-span-1 text-gray-500">#{item.id}</div>
            <div className="col-span-4 font-medium text-gray-900 truncate">
              {item.name || "Unnamed"}
            </div>
            <div className="col-span-3">
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                {item.type}
              </span>
            </div>
            <div className="col-span-4 truncate text-xs font-mono text-gray-400">
              {item.geoText?.substring(0, 20)}...
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}