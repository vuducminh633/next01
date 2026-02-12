import { getMapObjects } from "@/app/actions";
import CadUnityLayout from "../CadUnityLayout";
import { notFound } from "next/navigation";
import Link from "next/link";

// Force dynamic rendering to ensure fresh data on every load
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MapProjectPage({ params }: Props) {
  // 2. AWAIT PARAMS: Unwrap the promise first
  const resolvedParams = await params;
  const mapId = parseInt(resolvedParams.id);
  
  if (isNaN(mapId)) {
    return notFound();
  }

  // 3. Fetch Data for this specific Map
  const rawData = await getMapObjects(mapId);

  // 4. Handle Empty State
  if (!rawData || rawData.length === 0) {
    return (
      <div className="h-screen bg-[#0a0a0a] text-white flex items-center justify-center flex-col gap-6 font-sans">
        <div className="text-6xl opacity-20">📭</div>
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold text-gray-300">This map is empty</h1>
          <p className="text-sm text-gray-600">No objects found for Map ID: {mapId}</p>
        </div>
        <div className="flex gap-4">
          <Link href="/">
            <button className="px-6 py-2 rounded bg-[#222] hover:bg-[#333] text-gray-300 text-sm transition-colors">
              &larr; Back to Hub
            </button>
          </Link>
          {/* Removed Upload button since we use Redis only now */}
        </div>
      </div>
    );
  }

  // 5. Format Data for Client Components
  const formattedData = rawData.map((item) => ({
    ...item,
    properties: (item.properties as Record<string, any>) || {},
    isNew: item.isNew ?? false,
    createdAt: item.createdAt ? item.createdAt.toISOString() : null,
  }));

  return <CadUnityLayout initialData={formattedData} />;
}