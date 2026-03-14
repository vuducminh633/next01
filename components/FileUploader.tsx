"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { saveCadData } from "@/app/actions";

export default function FileUploader() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

const processFile = async (file: File) => {
    if (!file.name.endsWith(".json")) {
      setMessage({ text: "Please upload a valid JSON file.", type: "error" });
      return;
    }

    setIsUploading(true);
    setMessage({ text: "Sending file to server...", type: "info" });

    try {
      const mapName = file.name.replace(".json", "");
      
      console.log("1. Reading file in browser...");
      const rawText = await file.text();
      
      console.log(`2. File read successfully! Length: ${rawText.length} characters.`);
      console.log("3. Knocking on server's door...");
      
      // Pass the string directly
      const result = await saveCadData(rawText, mapName);

      console.log("4. Server responded!", result);

      if (result.success) {
        setMessage({ text: `Success! Created map: ${mapName} (${result.count} items)`, type: "success" });
        router.refresh(); 
      } else {
        setMessage({ text: result.error || "Failed to save data.", type: "error" });
      }
    } catch (error) {
      console.error(error);
      setMessage({ text: "Network error while uploading.", type: "error" });
    } finally {
      setIsUploading(false);
      setIsDragging(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto my-6">
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 relative
          ${isDragging ? "border-blue-500 bg-blue-500/10" : "border-gray-700 bg-[#1a1a1a] hover:border-gray-500"}
          ${isUploading ? "opacity-50 pointer-events-none" : "cursor-pointer"}
        `}
      >
        {/* Hidden File Input so clicking also works */}
        <input 
          type="file" 
          accept=".json" 
          onChange={handleFileInput} 
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />

        <div className="flex flex-col items-center justify-center space-y-3 pointer-events-none">
          <div className="text-4xl">{isUploading ? "⏳" : "📁"}</div>
          <h3 className="text-sm font-bold text-gray-200">
            {isUploading ? "Processing..." : "Drag & Drop JSON here"}
          </h3>
          <p className="text-xs text-gray-500">
            or click to browse files
          </p>
        </div>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`mt-3 p-3 rounded text-xs text-center font-bold
          ${message.type === "success" ? "bg-green-900/30 text-green-400 border border-green-800" : ""}
          ${message.type === "error" ? "bg-red-900/30 text-red-400 border border-red-800" : ""}
          ${message.type === "info" ? "bg-blue-900/30 text-blue-400 border border-blue-800" : ""}
        `}>
          {message.text}
        </div>
      )}
    </div>
  );
}