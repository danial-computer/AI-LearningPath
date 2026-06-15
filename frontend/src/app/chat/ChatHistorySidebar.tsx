"use client";

import { Plus, Trash2, MessageSquare, Bot } from "lucide-react";
import type { Conversation } from "./types";

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

interface ChatHistorySidebarProps {
  conversations: Conversation[];
  activeId: string;
  onCreate: () => void;
  onSwitch: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function ChatHistorySidebar({
  conversations,
  activeId,
  onCreate,
  onSwitch,
  onDelete,
}: ChatHistorySidebarProps) {
  return (
    <aside
      className="w-64 flex flex-col shrink-0 border-r border-border/60"
      style={{ background: "#242426" }}
    >
      {/* Header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-semibold text-foreground/70 uppercase tracking-widest">Conversations</span>
        </div>

        {/* New Chat Button */}
        <button
          onClick={onCreate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/15 hover:border-primary/30 hover:shadow-[0_0_12px_rgba(10,139,248,0.1)]"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Divider */}
      <div className="h-px bg-border/40 mx-4 mb-2" />

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
        {conversations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <MessageSquare className="w-8 h-8 text-muted/40 mb-2" />
            <p className="text-xs text-muted">No conversations yet</p>
            <p className="text-[10px] text-muted/60 mt-1">Start a new chat above</p>
          </div>
        )}

        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSwitch(conv.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") onSwitch(conv.id); }}
            className={`w-full text-left px-3 py-2.5 rounded-xl transition-all duration-150 group flex items-start gap-2.5 cursor-pointer ${
              conv.id === activeId
                ? "bg-primary/10 border border-primary/15 text-foreground shadow-[0_0_12px_rgba(10,139,248,0.06)]"
                : "text-foreground/50 hover:bg-white/5 hover:text-foreground/80 border border-transparent"
            }`}
          >
            <MessageSquare className={`w-3.5 h-3.5 mt-0.5 shrink-0 transition-colors ${
              conv.id === activeId ? "text-primary" : "opacity-40"
            }`} />

            <div className="flex-1 min-w-0">
              <p className={`text-xs font-medium truncate ${conv.id === activeId ? "text-foreground" : ""}`}>
                {conv.title || "New chat"}
              </p>
              <p className="text-[10px] text-muted mt-0.5 truncate">
                {getRelativeTime(conv.updatedAt)}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all duration-150 shrink-0"
              title="Delete conversation"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
