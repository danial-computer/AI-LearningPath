"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  UserCircle,
  ChevronDown,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Conversation } from "./chat/types";

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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [profile, setProfile] = useState<{ course: string; style: string }>({
    course: "",
    style: ""
  });
  const popupRef = useRef<HTMLDivElement>(null);

  // Fetch session configuration for profile display
  useEffect(() => {
    if (!activeId) return;

    const fetchSessionInfo = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/progress", {
          headers: {
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

  const handleDelete = (id: string) => {
    const updated = conversations.filter((c) => c.id !== id);
    setConversations(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    // Notify backend to clean up session state from memory
    fetch("http://localhost:8000/api/session", {
      method: "DELETE",
      headers: { "X-Session-ID": id },
    }).catch(() => {/* ignore if backend is offline */});

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
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <UserCircle className="w-8 h-8 text-gray-400 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate text-foreground">
              {profile.course ? `${profile.course}` : "Guest Learner"}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {profile.style ? `${profile.style} Learner` : "Session Not Started"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
