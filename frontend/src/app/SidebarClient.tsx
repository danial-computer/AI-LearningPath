"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  UserCircle,
  ChevronDown,
  Plus,
  Trash2,
  X,
  LogOut,
} from "lucide-react";
import type { Conversation } from "./chat/types";
import { supabase } from "@/lib/supabase";

const STORAGE_KEY = "chat_history";
const ACTIVE_KEY = "active_chat_id";

function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

export default function SidebarClient() {
  const pathname = usePathname();
  const router = useRouter();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [profile, setProfile] = useState<{ course: string; style: string }>({
    course: "",
    style: ""
  });
  const popupRef = useRef<HTMLDivElement>(null);

  // Fetch logged in user email
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    fetchUser();
  }, []);

  // Fetch session configuration for profile display
  useEffect(() => {
    if (!activeId) return;

    const fetchSessionInfo = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch((`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/progress`), {
          headers: {
            "Authorization": `Bearer ${session?.access_token || ""}`,
            "X-Session-ID": activeId
          }
        });
        if (res.ok) {
          const json = await res.json();
          if (json.configured) {
            setProfile({
              course: json.course || "",
              style: json.learning_style || ""
            });
          } else {
            setProfile({ course: "", style: "" });
          }
        }
      } catch {
        // ignore
      }
    };

    fetchSessionInfo();

    // Listen to custom chat events to reload profile info when configuration happens
    const handleChatUpdate = () => {
      fetchSessionInfo();
    };

    window.addEventListener("chat-history-updated", handleChatUpdate);
    window.addEventListener("switch-conversation", handleChatUpdate);
    return () => {
      window.removeEventListener("chat-history-updated", handleChatUpdate);
      window.removeEventListener("switch-conversation", handleChatUpdate);
    };
  }, [activeId]);

  // Load conversations from localStorage
  const loadConversations = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const activeIdStored = localStorage.getItem(ACTIVE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setConversations(parsed);
          setActiveId(activeIdStored || (parsed[0]?.id ?? ""));
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadConversations();

    // Listen for changes from chat page
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === ACTIVE_KEY) {
        loadConversations();
      }
    };
    // Also listen for custom event from same tab
    const handleChatUpdate = () => loadConversations();

    window.addEventListener("storage", handleStorage);
    window.addEventListener("chat-history-updated", handleChatUpdate);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("chat-history-updated", handleChatUpdate);
    };
  }, []);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    };
    if (historyOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [historyOpen]);

  const handleSwitch = (id: string) => {
    localStorage.setItem(ACTIVE_KEY, id);
    window.dispatchEvent(new CustomEvent("switch-conversation", { detail: id }));
    setActiveId(id);
    setHistoryOpen(false);
  };

  const handleDelete = async (id: string) => {
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Notify backend to clean up session state from memory
    try {
      const { data: { session } } = await supabase.auth.getSession();
      fetch((`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/session`), {
        method: "DELETE",
        headers: { 
          "Authorization": `Bearer ${session?.access_token || ""}`,
          "X-Session-ID": id 
        },
      });
    } catch {
      // ignore if backend is offline
    }

    // Notify chat page to remove this conversation from its state
    window.dispatchEvent(new CustomEvent("sidebar-deleted-chat", { detail: id }));

    if (id === activeId) {
      const newActive = updated[0]?.id ?? "";
      setActiveId(newActive);
      localStorage.setItem(ACTIVE_KEY, newActive);
      window.dispatchEvent(
        new CustomEvent("switch-conversation", { detail: newActive })
      );
    }
    window.dispatchEvent(new CustomEvent("chat-history-updated"));
  };


  const handleNewChat = () => {
    window.dispatchEvent(new CustomEvent("new-conversation"));
    setHistoryOpen(false);
  };

  const isChatActive = pathname === "/chat";

  return (
    <aside className="w-64 bg-sidebar border-r border-border flex flex-col relative z-20">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-bold text-primary flex items-center gap-2">
          <BookOpen className="w-6 h-6" />
          AI Learning
        </h1>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-2">
        <Link
          href="/"
          className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-border transition-colors ${
            pathname === "/" ? "bg-border text-foreground" : "text-foreground"
          }`}
        >
          <LayoutDashboard className="w-5 h-5 text-gray-400" />
          Dashboard
        </Link>

        {/* Jalur Silabus — now above Chat AI */}
        <Link
          href="/silabus"
          className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg hover:bg-border transition-colors ${
            pathname === "/silabus"
              ? "bg-border text-foreground"
              : "text-foreground"
          }`}
        >
          <BookOpen className="w-5 h-5 text-gray-400" />
          Learning Path
        </Link>

        {/* Chat AI — with dropdown history */}
        <div className="relative" ref={popupRef}>
          <div
            className={`flex items-center rounded-lg transition-colors ${
              isChatActive ? "bg-border" : ""
            }`}
          >
            <Link
              href="/chat"
              className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-foreground flex-1 hover:bg-border rounded-lg transition-colors"
            >
              <MessageSquare className="w-5 h-5 text-gray-400" />
              Chat AI
            </Link>
            {/* Chevron toggle — rotates when open */}
            <button
              onClick={() => {
                loadConversations();
                setHistoryOpen((prev) => !prev);
              }}
              className="p-2 mr-1 text-gray-400 hover:text-foreground hover:bg-border/60 rounded-lg transition-all"
              title="View chat history"
            >
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  historyOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>

          {/* Dropdown Panel — opens below */}
          {historyOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-sidebar border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden animate-[chat-fade-in_0.15s_ease-out] z-50">
              {/* Action buttons row */}
              <div className="flex items-center justify-between px-3 pt-2 pb-1">
                <button
                  onClick={handleNewChat}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  title="New chat"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New chat
                </button>
                <button
                  onClick={() => setHistoryOpen(false)}
                  className="p-1.5 text-gray-500 hover:text-foreground hover:bg-border rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Conversation List */}
              <div className="max-h-64 overflow-y-auto px-2 pb-2 space-y-0.5">
                {conversations.length === 0 ? (
                  <p className="text-center text-xs text-gray-500 py-4">
                    No conversations yet
                  </p>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => handleSwitch(conv.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSwitch(conv.id);
                      }}
                      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer group transition-colors ${
                        conv.id === activeId
                          ? "bg-primary/10 text-foreground"
                          : "text-gray-400 hover:bg-border/40 hover:text-foreground"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {conv.title || "New chat"}
                        </p>
                        <p className="text-[10px] text-gray-600 mt-0.5">
                          {getRelativeTime(conv.updatedAt)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(conv.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 rounded transition-all shrink-0"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* User profile */}
      <div className="p-4 border-t border-border flex flex-col gap-2">
        <div className="flex items-center gap-3 px-2 py-1">
          <UserCircle className="w-8 h-8 text-gray-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-gray-400 truncate">
              {userEmail || "Loading..."}
            </p>
            <p className="text-[10px] text-gray-500 truncate mt-0.5">
              {profile.course ? `${profile.course} (${profile.style || "Adaptive"})` : "No Active Course"}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 px-2 mt-1">
          <button
            onClick={async () => {
              if (confirm("Apakah Anda yakin ingin keluar?")) {
                await supabase.auth.signOut();
                localStorage.removeItem("sb-access-token");
                router.push("/login");
              }
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 bg-border hover:bg-border/80 text-xs text-foreground font-medium rounded-md transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-gray-400" />
            Logout
          </button>
          <button
            onClick={async () => {
              if (confirm("PERINGATAN: Apakah Anda yakin ingin menghapus akun ini secara permanen? Seluruh data progres belajar dan riwayat chat Anda akan dihapus selamanya.")) {
                const passwordConfirm = prompt("Ketik 'HAPUS' untuk mengonfirmasi penghapusan:");
                if (passwordConfirm === "HAPUS") {
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const res = await fetch((`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/delete-account`), {
                      method: "DELETE",
                      headers: {
                        "Authorization": `Bearer ${session?.access_token || ""}`
                      }
                    });
                    if (res.ok) {
                      alert("Akun Anda telah berhasil dihapus secara permanen.");
                      await supabase.auth.signOut();
                      localStorage.clear();
                      window.location.href = "/login";
                    } else {
                      const errJson = await res.json();
                      alert(`Gagal menghapus akun: ${errJson.detail || "Terjadi kesalahan"}`);
                    }
                  } catch (err) {
                    alert("Gagal menghubungi server untuk menghapus akun.");
                  }
                }
              }
            }}
            className="flex items-center justify-center p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md transition-all cursor-pointer"
            title="Hapus Akun Permanen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
