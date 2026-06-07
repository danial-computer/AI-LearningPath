"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Bot, Hash } from "lucide-react";
import ChatBubble from "./ChatBubble";
import ChatInput from "./ChatInput";
import type { Message, Conversation } from "./types";
import { getGreeting, GREETING_SUBTITLE } from "./greetings";

const STORAGE_KEY = "chat_history";
const ACTIVE_KEY = "active_chat_id";

function createNewConversation(): Conversation {
  return {
    id: crypto.randomUUID(),
    title: "",
    messages: [],          // ← no initial bot message
    updatedAt: Date.now(),
  };
}

function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}

function saveConversations(convs: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
    // NOTE: do NOT dispatch "chat-history-updated" here — it causes an
    // infinite loop (persist effect → event → sidebar setState → re-render cycle).
    // Sidebar is notified via targeted dispatches after intentional actions.
  } catch {
    // ignore
  }
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [input, setInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Each conversation gets its own greeting, generated once per conversation id
  const [greetingCache, setGreetingCache] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ─── Init from localStorage ───
  useEffect(() => {
    const loaded = loadConversations();
    const savedActiveId = localStorage.getItem(ACTIVE_KEY);

    if (loaded.length > 0) {
      setConversations(loaded);
      const resolvedId =
        savedActiveId && loaded.find((c) => c.id === savedActiveId)
          ? savedActiveId
          : loaded[0].id;
      setActiveId(resolvedId);
    } else {
      const first = createNewConversation();
      setConversations([first]);
      setActiveId(first.id);
    }
    setInitialized(true);
  }, []);

  // ─── Persist to localStorage ───
  useEffect(() => {
    if (initialized) saveConversations(conversations);
  }, [conversations, initialized]);

  // ─── Sync active id ───
  useEffect(() => {
    if (initialized && activeId) {
      localStorage.setItem(ACTIVE_KEY, activeId);
    }
  }, [activeId, initialized]);

  // ─── Generate greeting for new conversation id ───
  useEffect(() => {
    if (!activeId) return;
    setGreetingCache((prev) => {
      if (prev[activeId]) return prev;        // already generated
      return { ...prev, [activeId]: getGreeting() };
    });
  }, [activeId]);

  // ─── Listen to sidebar events ───
  useEffect(() => {
    const handleSwitch = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id) {
        // Switch to existing conversation
        setActiveId(id);
        setInput("");
        setFile(null);
      } else {
        // All chats deleted — auto-create a fresh one
        const newConv = createNewConversation();
        setConversations([newConv]);
        setActiveId(newConv.id);
        setInput("");
        setFile(null);
      }
    };
    const handleNew = () => {
      const newConv = createNewConversation();
      setConversations((prev) => [newConv, ...prev]);
      setActiveId(newConv.id);
      setInput("");
      setFile(null);
    };
    // Sync conversations state when sidebar deletes a chat
    const handleChatDeleted = (e: Event) => {
      const deletedId = (e as CustomEvent<string>).detail;
      setConversations((prev) => prev.filter((c) => c.id !== deletedId));
    };
    window.addEventListener("switch-conversation", handleSwitch);
    window.addEventListener("new-conversation", handleNew);
    window.addEventListener("sidebar-deleted-chat", handleChatDeleted);
    return () => {
      window.removeEventListener("switch-conversation", handleSwitch);
      window.removeEventListener("new-conversation", handleNew);
      window.removeEventListener("sidebar-deleted-chat", handleChatDeleted);
    };
  }, []);

  // ─── Auto-scroll ───
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeId, isLoading]);

  // ─── Derived state ───
  const activeConversation = conversations.find((c) => c.id === activeId);
  const messages = activeConversation?.messages ?? [];
  const roomTitle = activeConversation?.title ?? "";
  const greeting = greetingCache[activeId] ?? "";

  // Show welcome screen only when there are no messages at all yet
  const showWelcome = messages.length === 0;

  // ─── Send message ───
  const sendMessage = useCallback(async () => {
    if ((!input.trim() && !file) || isLoading) return;

    const userMsg: Message = {
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c;
        return {
          ...c,
          messages: [...c.messages, userMsg],
          title:
            c.title ||
            userMsg.content.slice(0, 40) ||
            file?.name.slice(0, 40) ||
            "Attachment",
          updatedAt: Date.now(),
        };
      })
    );

    const currentFile = file;
    setInput("");
    setFile(null);
    setIsLoading(true);

    try {
      let data: {
        reply: string;
        file_url?: string;
        file_name?: string;
        file_size?: number;
        file_type?: string;
      };

      if (currentFile) {
        const formData = new FormData();
        formData.append("message", userMsg.content || "(File dikirim)");
        formData.append("file", currentFile);
        const res = await fetch("http://localhost:8000/api/chat", {
          method: "POST",
          headers: {
            "X-Session-ID": activeId,
          },
          body: formData,
        });
        data = await res.json();
      } else {
        const res = await fetch("http://localhost:8000/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": activeId,
          },
          body: JSON.stringify({ message: userMsg.content }),
        });
        data = await res.json();
      }

      // Attach file info to the user message if uploaded
      if (currentFile && data.file_url) {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== activeId) return c;
            const msgs = [...c.messages];
            for (let i = msgs.length - 1; i >= 0; i--) {
              if (
                msgs[i].role === "user" &&
                msgs[i].timestamp === userMsg.timestamp
              ) {
                msgs[i] = {
                  ...msgs[i],
                  attachment: {
                    name: data.file_name ?? currentFile.name,
                    url: data.file_url!,
                    type: currentFile.type,
                    size: currentFile.size,
                  },
                };
                break;
              }
            }
            return { ...c, messages: msgs };
          })
        );
      }

      const botMsg: Message = {
        role: "bot",
        content: data.reply,
        timestamp: Date.now(),
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeId) return c;
          return {
            ...c,
            messages: [...c.messages, botMsg],
            updatedAt: Date.now(),
          };
        })
      );
      // Notify sidebar to refresh title/timestamp after bot reply
      window.dispatchEvent(new CustomEvent("chat-history-updated"));
    } catch {
      const errorMsg: Message = {
        role: "bot",
        content:
          "Unable to reach the backend server. Make sure FastAPI is running on port 8000.",
        timestamp: Date.now(),
      };
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeId) return c;
          return {
            ...c,
            messages: [...c.messages, errorMsg],
            updatedAt: Date.now(),
          };
        })
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, file, isLoading, activeId]);

  // ─── Loading screen ───
  if (!initialized) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" />
          <div
            className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
            style={{ animationDelay: "0.2s" }}
          />
          <div
            className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
            style={{ animationDelay: "0.4s" }}
          />
        </div>
      </div>
    );
  }

  // ─── Render ───
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header — hidden on welcome screen */}
      {!showWelcome && (
        <div className="px-6 py-4 border-b border-border bg-sidebar/50 backdrop-blur-md sticky top-0 z-10 animate-[chat-fade-in_0.3s_ease-out]">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            Socratic AI Tutor
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Intelligent chatbot with Ethical Guardrails
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Hash className="w-3.5 h-3.5 text-gray-600" />
            {roomTitle ? (
              <span className="text-sm text-gray-400 truncate max-w-lg">
                {roomTitle}
              </span>
            ) : (
              <span className="text-sm text-gray-600 italic">New chat</span>
            )}
          </div>
        </div>
      )}

      {/* Content area — welcome screen OR chat messages */}
      <div className="flex-1 overflow-y-auto">
        {showWelcome ? (
          /* ── Welcome Screen ── */
          <div className="flex flex-col items-center justify-center h-full px-8 animate-[chat-fade-in_0.4s_ease-out]">
            {/* Glow blob */}
            <div
              className="absolute w-96 h-96 rounded-full pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(10,139,248,0.08) 0%, transparent 70%)",
              }}
            />
            {/* Greeting text */}
            <h2 className="relative text-3xl sm:text-4xl font-bold text-foreground text-center leading-tight tracking-tight max-w-xl">
              {greeting}
            </h2>
            <p className="relative text-base text-gray-500 mt-4 text-center max-w-md">
              {GREETING_SUBTITLE}
            </p>
          </div>
        ) : (
          /* ── Chat messages ── */
          <div className="p-6 space-y-6">
            {messages.map((msg, idx) => (
              <ChatBubble key={`${activeId}-${idx}`} message={msg} />
            ))}

            {/* Typing indicator */}
            {isLoading && (
              <div className="flex gap-4 justify-start animate-[chat-fade-in_0.3s_ease-out]">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div className="p-4 rounded-2xl bg-card border border-border rounded-bl-none">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-gray-500 animate-bounce" />
                    <div
                      className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    />
                    <div
                      className="w-2 h-2 rounded-full bg-gray-500 animate-bounce"
                      style={{ animationDelay: "0.4s" }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input — always visible at bottom */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={sendMessage}
        disabled={isLoading}
        file={file}
        onFileChange={setFile}
      />
    </div>
  );
}
