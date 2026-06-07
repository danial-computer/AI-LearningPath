"use client";

import { useState } from "react";
import { Bot, User, Copy, Check, FileText, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Message } from "./types";

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
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

export default function ChatBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const isBot = message.role === "bot";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex gap-4 ${isBot ? "justify-start" : "justify-end"} animate-[chat-fade-in_0.3s_ease-out]`}
    >
      {isBot && (
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-primary" />
        </div>
      )}

      <div className="max-w-[70%] group">
        <div
          className={`p-4 rounded-2xl ${
            isBot
              ? "bg-card border border-border text-foreground rounded-bl-none shadow-sm"
              : "bg-primary text-white rounded-br-none"
          }`}
        >
          {/* Attachment */}
          {message.attachment && (
            <div className="mb-3">
              {isImageType(message.attachment.type) ? (
                /* Image preview */
                <a
                  href={message.attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <img
                    src={message.attachment.url}
                    alt={message.attachment.name}
                    className="max-w-full max-h-64 rounded-lg object-cover border border-white/10"
                  />
                </a>
              ) : (
                /* File attachment card */
                <a
                  href={message.attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    isBot
                      ? "bg-white/[0.03] border-border hover:bg-white/[0.06]"
                      : "bg-white/10 border-white/20 hover:bg-white/20"
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      isBot ? "bg-primary/10" : "bg-white/15"
                    }`}
                  >
                    <FileText
                      className={`w-5 h-5 ${isBot ? "text-primary" : "text-white"}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {message.attachment.name}
                    </p>
                    <p
                      className={`text-[11px] ${
                        isBot ? "text-gray-500" : "text-white/60"
                      }`}
                    >
                      {formatFileSize(message.attachment.size)}
                    </p>
                  </div>
                  <Download
                    className={`w-4 h-4 shrink-0 ${
                      isBot ? "text-gray-500" : "text-white/60"
                    }`}
                  />
                </a>
              )}
            </div>
          )}

          {/* Text content */}
          {message.content && (
            isBot ? (
              <div className="text-sm leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    code: ({ children, className }) => {
                      const isBlock = className?.includes("language-");
                      return isBlock ? (
                        <code className={`block w-full bg-black/40 border border-border rounded-lg px-4 py-3 text-[13px] font-mono text-[#0A8BF8] overflow-x-auto my-2 ${className}`}>
                          {children}
                        </code>
                      ) : (
                        <code className="bg-black/30 border border-border rounded px-1.5 py-0.5 text-[12px] font-mono text-[#0A8BF8]">
                          {children}
                        </code>
                      );
                    },
                    pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2 pl-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 pl-2">{children}</ol>,
                    li: ({ children }) => <li className="text-sm">{children}</li>,
                    h1: ({ children }) => <h1 className="text-lg font-bold text-foreground mt-3 mb-1">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-bold text-foreground mt-3 mb-1">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mt-2 mb-1">{children}</h3>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/50 pl-3 my-2 opacity-70 italic">{children}</blockquote>,
                    hr: () => <hr className="border-border my-3" />,
                    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">{children}</a>,
                    table: ({ children }) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
                    th: ({ children }) => <th className="border border-border px-3 py-1.5 bg-white/5 font-semibold text-left">{children}</th>,
                    td: ({ children }) => <td className="border border-border px-3 py-1.5">{children}</td>,
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
            )
          )}
        </div>

        {/* Timestamp + Copy */}
        <div
          className={`flex items-center gap-2 mt-1.5 px-1 ${
            isBot ? "" : "justify-end"
          }`}
        >
          <span className="text-[11px] text-gray-600">
            {formatTime(message.timestamp)}
          </span>
          {isBot && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-300 p-0.5"
              title="Salin pesan"
            >
              {copied ? (
                <span className="flex items-center gap-1 text-[11px] text-green-400">
                  <Check className="w-3 h-3" /> Tersalin!
                </span>
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {!isBot && (
        <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-gray-300" />
        </div>
      )}
    </div>
  );
}
