import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { LayoutDashboard, MessageSquare, BookOpen, UserCircle } from "lucide-react";

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
        {/* Sidebar */}
        <aside className="w-64 bg-sidebar border-r border-border flex flex-col">
          <div className="p-6 border-b border-border">
            <h1 className="text-xl font-bold text-primary flex items-center gap-2">
              <BookOpen className="w-6 h-6" />
              AI Learning
            </h1>
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            <Link href="/" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-border transition-colors text-foreground">
              <LayoutDashboard className="w-5 h-5 text-gray-400" />
              Dashboard
            </Link>
            <Link href="/chat" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-border transition-colors text-foreground">
              <MessageSquare className="w-5 h-5 text-gray-400" />
              Chat AI
            </Link>
            <Link href="/silabus" className="flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-border transition-colors text-foreground">
              <BookOpen className="w-5 h-5 text-gray-400" />
              Jalur Silabus
            </Link>
          </nav>

          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 px-4 py-3">
              <UserCircle className="w-8 h-8 text-gray-400" />
              <div>
                <p className="text-sm font-medium">Mahasiswa ID</p>
                <p className="text-xs text-gray-400">Tingkat: Distinction</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col h-screen overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
