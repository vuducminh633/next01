import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import CADListener from "./cad-data/CADListener"; 

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Mine Digital Twin",
  description: "Real-time Mining Data Visualization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* Mount the listener HERE so it runs on the Home Page, 
           Hub Page, and Map Page automatically. 
        */}
        <CADListener />
        
        {children}
      </body>
    </html>
  );
}