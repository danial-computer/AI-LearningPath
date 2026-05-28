"use client";

import { Plus, Trash2, MessageSquare } from "lucide-react";
import type { Conversation } from "./types";

function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Baru saja";
  if (minutes < 60) return `${minutes}m lalu`;
  if (hours < 24) return `${hours}j lalu`;
  if (days < 7) return `${days}h lalu`;
  return new Date(timestamp).toLocaleDateString("id-ID", {
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
    <aside className="w-72 bg-sidebar/50 border-r border-border flex flex-col shrink-0">
      {/* Header + New Chat Button */}
      <div className="p-4 border-b border-border">
        <button
          onClick={onCreate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-sm font-medium transition-colors border border-primary/20"
        >
          <Plus className="w-4 h-4" />
          Chat Baru
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 && (
          <div className="text-center py-8 text-gray-500 text-sm">
            Belum ada percakapan
          </div>
        )}

        {conversations.map((conv) => (
          <div
            key={conv.id}
            onClick={() => onSwitch(conv.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter") onSwitch(conv.id); }}
            className={`w-full text-left px-3 py-3 rounded-xl transition-colors group flex items-start gap-3 cursor-pointer ${
              conv.id === activeId
                ? "bg-border/50 text-foreground"
                : "text-gray-400 hover:bg-border/30 hover:text-foreground"
            }`}
          >
            <MessageSquare className="w-4 h-4 mt-0.5 shrink-0 opacity-50" />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {conv.title || "Chat baru"}
              </p>
              <p className="text-[11px] text-gray-600 mt-0.5">
                {getRelativeTime(conv.updatedAt)}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 text-gray-600 hover:text-red-400 transition-all shrink-0"
              title="Hapus percakapan"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
