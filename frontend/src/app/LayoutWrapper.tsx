"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import SidebarClient from "./SidebarClient";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  const isPublicPage = pathname === "/login" || pathname === "/update-password";

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsAuthenticated(true);
        localStorage.setItem("sb-access-token", session.access_token);
        if (pathname === "/login") {
          router.push("/");
        }
      } else {
        setIsAuthenticated(false);
        localStorage.removeItem("sb-access-token");
        if (!isPublicPage) {
          router.push("/login");
        }
      }
    };

    checkAuth();

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setIsAuthenticated(true);
        localStorage.setItem("sb-access-token", session.access_token);
        if (pathname === "/login") {
          router.push("/");
        }
      } else {
        setIsAuthenticated(false);
        localStorage.removeItem("sb-access-token");
        if (!isPublicPage) {
          router.push("/login");
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router, isPublicPage]);

  // Loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Redirecting state
  if (!isAuthenticated && !isPublicPage) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // If on login or update-password, render content directly without sidebar
  if (isPublicPage) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center" style={{ background: "#1C1C1E" }}>
        {children}
      </div>
    );
  }


  return (
    <>
      <SidebarClient />
      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {children}
      </main>
    </>
  );
}
