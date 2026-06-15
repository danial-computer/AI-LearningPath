"use client";

import { useState, useCallback } from "react";
import { Bot, Copy, Check, FileText, Download, AlertCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "./types";

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(type: string): boolean {
  return type.startsWith("image/");
}

// ── Code block with its own copy button ──
function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const code = typeof children === "string" ? children : String(children ?? "");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code.replace(/\n$/, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 group/code">
      <pre className="bg-black/60 border border-border/80 rounded-xl overflow-x-auto">
        <code className={`block px-4 py-3 text-[12.5px] font-mono text-primary/90 leading-relaxed ${className ?? ""}`}>
          {children}
        </code>
      </pre>
      <button
        onClick={handleCopy}
        className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all duration-200 ${
          copied
            ? "bg-green-500/20 text-green-400 opacity-100"
            : "bg-white/5 text-muted opacity-0 group-hover/code:opacity-100 hover:bg-white/10 hover:text-foreground/70"
        }`}
        title="Copy code"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

interface ChatBubbleProps {
  message: Message;
  userInitials?: string;
}

export default function ChatBubble({ message, userInitials = "U" }: ChatBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isBot = message.role === "bot";
  const isError = message.content.toLowerCase().startsWith("unable to reach") ||
    message.content.startsWith("Error:") || 
    message.content.startsWith("[Error]");

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex gap-3 ${isBot ? "justify-start" : "justify-end"} animate-[chat-fade-in_0.3s_ease-out]`}
    >
      {/* Bot avatar */}
      {isBot && (
        <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
          isError
            ? "bg-red-500/10 border-red-500/20"
            : "bg-gradient-to-br from-primary/30 to-primary/10 border-primary/20 shadow-[0_0_12px_rgba(10,139,248,0.15)]"
        }`}>
          {isError
            ? <AlertCircle className="w-4 h-4 text-red-400" />
            : <Bot className="w-4 h-4 text-primary" />
          }
        </div>
      )}

      <div className={`max-w-[75%] group flex flex-col ${isBot ? "items-start" : "items-end"}`}>
        {/* Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isBot
              ? isError
                ? "bg-red-500/[0.06] border border-red-500/20 text-red-300 rounded-tl-sm"
                : "bg-card border border-border/60 text-foreground rounded-tl-sm shadow-sm"
              : "rounded-tr-sm shadow-[0_2px_16px_rgba(10,139,248,0.2)]"
          }`}
          style={!isBot ? {
            background: "linear-gradient(135deg, #0A8BF8 0%, #1a6cf0 50%, #2563eb 100%)"
          } : undefined}
        >
          {/* Attachment */}
          {message.attachment && (
            <div className="mb-3">
              {isImageType(message.attachment.type) ? (
                <a
                  href={message.attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    src={message.attachment.url}
                    alt={message.attachment.name}
                    className="max-w-full max-h-60 rounded-xl object-cover border border-white/10"
                  />
                </a>
              ) : (
                <a
                  href={message.attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    isBot
                      ? "bg-white/[0.04] border-border/60 hover:bg-white/[0.07]"
                      : "bg-white/15 border-white/20 hover:bg-white/25"
                  }`}
                >
                  <div className={`p-2 rounded-lg shrink-0 ${isBot ? "bg-primary/15" : "bg-white/20"}`}>
                    <FileText className={`w-4 h-4 ${isBot ? "text-primary" : "text-white"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{message.attachment.name}</p>
                    <p className={`text-[11px] mt-0.5 ${isBot ? "text-muted" : "text-white/60"}`}>
                      {formatFileSize(message.attachment.size)}
                    </p>
                  </div>
                  <Download className={`w-4 h-4 shrink-0 ${isBot ? "text-muted" : "text-white/60"}`} />
                </a>
              )}
            </div>
          )}

          {/* Text content */}
          {message.content && (
            isBot ? (
              <div className="text-sm leading-relaxed prose-sm">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0 text-foreground/90">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                    em: ({ children }) => <em className="italic text-foreground/80">{children}</em>,
                    // ── Code block: uses CodeBlock for copy button ──
                    code: ({ children, className }) => {
                      const isBlock = className?.includes("language-");
                      return isBlock ? (
                        <CodeBlock className={className}>{children}</CodeBlock>
                      ) : (
                        <code className="bg-black/40 border border-border/60 rounded-md px-1.5 py-0.5 text-[12px] font-mono text-primary/90">
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => <>{children}</>,
                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2 pl-1">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 pl-1">{children}</ol>,
                    li: ({ children }) => <li className="text-sm text-foreground/90">{children}</li>,
                    h1: ({ children }) => <h1 className="text-base font-bold text-foreground mt-3 mb-1.5">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-bold text-foreground mt-3 mb-1">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h3>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-foreground/60 italic text-sm">{children}</blockquote>,
                    hr: () => <hr className="border-border/50 my-3" />,
                    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors">{children}</a>,
                    table: ({ children }) => <div className="overflow-x-auto my-3"><table className="text-xs border-collapse w-full">{children}</table></div>,
                    th: ({ children }) => <th className="border border-border/60 px-3 py-1.5 bg-white/[0.04] font-semibold text-left text-foreground">{children}</th>,
                    td: ({ children }) => <td className="border border-border/60 px-3 py-1.5 text-foreground/80">{children}</td>,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-white">{message.content}</p>
            )
          )}
        </div>

        {/* Timestamp + Copy row */}
        <div className={`flex items-center gap-2 mt-1.5 px-1 ${isBot ? "" : "flex-row-reverse"}`}>
          <span className="text-[10px] text-muted">{formatTime(message.timestamp)}</span>
          {isBot && !isError && (
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1 transition-all duration-200 rounded-md px-1.5 py-0.5 text-[10px] ${
                copied
                  ? "text-green-400 opacity-100"
                  : "text-muted opacity-0 group-hover:opacity-100 hover:text-foreground/60 hover:bg-white/5"
              }`}
              title="Copy message"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3" />
                  Copied
                </>
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* User avatar — shows initials */}
      {!isBot && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 border border-white/10 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <span className="text-[11px] font-bold text-white/90">{userInitials}</span>
        </div>
      )}
    </div>
  );
}
