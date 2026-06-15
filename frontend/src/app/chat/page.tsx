"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Bot, Hash, ChevronDown } from "lucide-react";
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
    messages: [],
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
  const [userEmail, setUserEmail] = useState<string>("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Each conversation gets its own greeting, generated once per conversation id
  const [greetingCache, setGreetingCache] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // ─── Init from localStorage ───
  useEffect(() => {
    const loaded = loadConversations();
    const savedActiveId = localStorage.getItem(ACTIVE_KEY);

    if (loaded.length > 0) {
      // Find if there's already an empty chat to avoid spamming new ones
      const emptyChat = loaded.find((c) => c.messages.length === 0);
      if (emptyChat) {
        setConversations(loaded);
        setActiveId(emptyChat.id);
      } else {
        const newConv = createNewConversation();
        setConversations([newConv, ...loaded]);
        setActiveId(newConv.id);
      }
    } else {
      const first = createNewConversation();
      setConversations([first]);
      setActiveId(first.id);
    }
    setInitialized(true);
  }, []);

  // ─── Get user email for avatar initials ───
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? "");
    });
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
      if (prev[activeId]) return prev;
      return { ...prev, [activeId]: getGreeting() };
    });
  }, [activeId]);

  // ─── Auto-scroll ───
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversations, activeId, isLoading]);

  // ─── Scroll-to-bottom button visibility ───
  const handleScroll = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 200);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // ─── Derived state ───
  const activeConversation = conversations.find((c) => c.id === activeId);
  const messages = activeConversation?.messages ?? [];
  const roomTitle = activeConversation?.title ?? "";
  const greeting = greetingCache[activeId] ?? "";
  const showWelcome = messages.length === 0;

  // User avatar initials from email
  const userInitials = userEmail
    ? userEmail.charAt(0).toUpperCase()
    : "U";

  // Sorted conversations for sidebar (newest first)
  const sortedConversations = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  // ─── Sync with Global Sidebar Events ───
  useEffect(() => {
    const handleNew = () => {
      const newConv = createNewConversation();
      setConversations((prev) => [newConv, ...prev]);
      setActiveId(newConv.id);
      setInput("");
      setFile(null);
    };

    const handleSwitchEvent = (e: Event) => {
      const id = (e as CustomEvent).detail;
      setActiveId(id);
      setInput("");
      setFile(null);
      
      // Reload in case cloud sync added new sessions
      const loaded = loadConversations();
      if (loaded.length > 0) setConversations(loaded);
    };

    const handleDeleteEvent = (e: Event) => {
      const id = (e as CustomEvent).detail;
      setConversations((prev) => prev.filter((c) => c.id !== id));
    };

    window.addEventListener("new-conversation", handleNew);
    window.addEventListener("switch-conversation", handleSwitchEvent);
    window.addEventListener("sidebar-deleted-chat", handleDeleteEvent);

    return () => {
      window.removeEventListener("new-conversation", handleNew);
      window.removeEventListener("switch-conversation", handleSwitchEvent);
      window.removeEventListener("sidebar-deleted-chat", handleDeleteEvent);
    };
  }, []);

  // ─── Sidebar handlers (Internal) ───
  const handleNew = useCallback(() => {
    const newConv = createNewConversation();
    setConversations((prev) => [newConv, ...prev]);
    setActiveId(newConv.id);
    setInput("");
    setFile(null);
  }, []);

  const handleSwitch = useCallback((id: string) => {
    setActiveId(id);
    setInput("");
    setFile(null);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (id === activeId) {
        if (filtered.length > 0) {
          setActiveId(filtered[0].id);
        } else {
          const newConv = createNewConversation();
          setActiveId(newConv.id);
          return [newConv];
        }
      }
      return filtered;
    });
  }, [activeId]);

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

      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const token = session?.access_token || "";

      if (currentFile) {
        const formData = new FormData();
        formData.append("message", userMsg.content || "(File dikirim)");
        formData.append("file", currentFile);
        const res = await fetch((`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/chat`), {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "X-Session-ID": activeId,
          },
          body: formData,
        });
        data = await res.json();
      } else {
        const res = await fetch((`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/chat`), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
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
              if (msgs[i].role === "user" && msgs[i].timestamp === userMsg.timestamp) {
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
          return { ...c, messages: [...c.messages, botMsg], updatedAt: Date.now() };
        })
      );
    } catch {
      const errorMsg: Message = {
        role: "bot",
        content:
          `Unable to reach the backend server (${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}). Please make sure the backend is running and accessible.`,
        timestamp: Date.now(),
      };
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeId) return c;
          return { ...c, messages: [...c.messages, errorMsg], updatedAt: Date.now() };
        })
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, file, isLoading, activeId]);

  // ─── Loading screen ───
  if (!initialized) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: "#1C1C1E" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_20px_rgba(10,139,248,0.15)]">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div className="flex gap-1.5">
            {[0, 0.15, 0.3].map((delay, i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce"
                style={{ animationDelay: `${delay}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ───
  return (
    <div className="flex h-full" style={{ background: "#1C1C1E" }}>
      {/* ── Main chat area ── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header — hidden on welcome screen */}
        {!showWelcome && (
          <div
            className="px-5 py-3 border-b border-border/60 sticky top-0 z-10 animate-[chat-fade-in_0.3s_ease-out] flex items-center gap-3"
            style={{ background: "rgba(28,28,30,0.85)", backdropFilter: "blur(12px)" }}
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(10,139,248,0.15)]">
              <Bot className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <h1 className="text-lg font-bold text-foreground">Smart AI Tutor</h1>
                <span className="text-sm font-medium text-muted">· Ethical Guardrails</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <Hash className="w-4 h-4 text-muted/60" />
                {roomTitle ? (
                  <span className="text-sm font-medium text-muted truncate max-w-xs">{roomTitle}</span>
                ) : (
                  <span className="text-sm font-medium text-muted/50 italic">New chat</span>
                )}
              </div>
            </div>
            {/* Online indicator */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
              <span className="text-sm font-medium text-muted">Online</span>
            </div>
          </div>
        )}

        {/* Content area — welcome screen OR chat messages */}
        <div
          ref={chatContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto relative"
        >
          {showWelcome ? (
            /* ── Welcome Screen ── */
            <div className="flex flex-col items-center justify-center h-full px-8 animate-[chat-fade-in_0.5s_ease-out] relative overflow-hidden">
              {/* Glow orb */}
              <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
                style={{ background: "radial-gradient(circle, rgba(10,139,248,0.07) 0%, transparent 65%)" }}
              />
              {/* Bot icon */}
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/10 border border-primary/20 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(10,139,248,0.15)]">
                <Bot className="w-8 h-8 text-primary" />
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-[#1C1C1E] shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
              </div>
              {/* Greeting */}
              <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-3">
                {greeting}
              </h2>
              <p className="text-sm text-muted">Send a message to start configuring your Learning Profile and Syllabus.</p>
              {/* Quick prompts — now functional */}
              <div className="relative mt-8 flex flex-wrap gap-2 justify-center max-w-md">
                {[
                  "Explain this concept with an analogy",
                  "Give me a practice quiz",
                  "What should I study next?",
                ].map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => setInput(prompt)}
                    className="px-3 py-1.5 rounded-xl text-xs text-muted border border-border/60 hover:border-primary/30 hover:text-foreground/80 hover:bg-primary/5 transition-all duration-200"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* ── Chat messages ── */
            <div className="px-4 py-5 space-y-5 w-full">
              {messages.map((msg, idx) => (
                <ChatBubble
                  key={`${activeId}-${idx}`}
                  message={msg}
                  userInitials={userInitials}
                />
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex gap-3 justify-start animate-[chat-fade-in_0.3s_ease-out]">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-[0_0_12px_rgba(10,139,248,0.15)]">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-card border border-border/60 shadow-sm flex items-center gap-2">
                    {[0, 0.2, 0.4].map((delay, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-primary/40"
                        style={{
                          animation: `bounce 1.2s ease-in-out ${delay}s infinite`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Scroll to bottom button */}
          {showScrollBtn && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-card border border-border/60 flex items-center justify-center shadow-lg hover:bg-card/80 transition-all duration-200 animate-[chat-fade-in_0.2s_ease-out]"
              title="Scroll to bottom"
            >
              <ChevronDown className="w-4 h-4 text-muted" />
            </button>
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
    </div>
  );
}
