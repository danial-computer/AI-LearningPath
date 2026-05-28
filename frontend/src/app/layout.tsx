import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SidebarClient from "./SidebarClient";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Learning Path",
  description: "Platform belajar cerdas adaptif",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground flex h-screen overflow-hidden`}
      >
        <SidebarClient />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-screen overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
