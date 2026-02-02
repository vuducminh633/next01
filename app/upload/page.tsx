"use client";

import { useState, useCallback } from "react";
import { saveCadData } from "../actions"; // Import our new action
import { useRouter } from "next/navigation";

export default function UploadPage() {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // 1. Handle File Selection
  const handleFile = async (file: File) => {
    setError(null);

    // Validate File Type
    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      setError("Error: Only .json files are allowed.");
      return;
    }

    setLoading(true);

    try {
      // Read file content
      const text = await file.text();
      const json = JSON.parse(text);

      // Send to Server
      const result = await saveCadData(json);

      if (result.error) {
        setError(result.error);
        setLoading(false);
      } else {
        // Success! Go to results page
        router.push("/cad-data");
      }
    } catch (err) {
      setError("Error parsing JSON file.");
      setLoading(false);
    }
  };

  // 2. Drag Events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  // 3. Render Loading Screen
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto"></div>
          <h2 className="text-xl font-bold text-gray-700">Processing Data...</h2>
          <p className="text-gray-500">Saving to database</p>
        </div>
      </div>
    );
  }

  // 4. Render Upload Form
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-800 text-center">Upload CAD Data</h1>

        <div
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
            dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white"
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          {/* Hidden Input */}
          <input
            type="file"
            accept=".json"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          <div className="text-center space-y-2 pointer-events-none">
            <span className="text-4xl"></span>
            <p className="text-lg font-medium text-gray-700">
              Drag & Drop your JSON file here
            </p>
            <p className="text-sm text-gray-500">or click to browse</p>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-4 text-center text-red-600 border border-red-200">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}