"use client";

import { useRef, useEffect, type KeyboardEvent } from "react";
import { Send, Paperclip, X, FileText } from "lucide-react";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  file: File | null;
  onFileChange: (file: File | null) => void;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  file,
  onFileChange,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageUrlRef = useRef<string | null>(null);

  // ── Fix: revoke object URL to prevent memory leak ──
  useEffect(() => {
    if (file?.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      imageUrlRef.current = url;
      return () => URL.revokeObjectURL(url);
    } else {
      imageUrlRef.current = null;
    }
  }, [file]);

  // ── Auto-focus when re-enabled ──
  useEffect(() => {
    if (!disabled && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled]);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && (value.trim() || file)) {
        onSend();
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    onFileChange(selected);
    e.target.value = "";
  };

  const isImageFile = file?.type.startsWith("image/");
  const canSend = !disabled && (value.trim().length > 0 || !!file);

  return (
    <div className="px-4 pb-4 pt-2 flex justify-center w-full" style={{ background: "#1C1C1E" }}>
      <div className="w-full max-w-4xl">
        {/* File Preview */}
      {file && (
        <div className="mb-2 mx-1 flex items-center gap-3 p-2.5 bg-card border border-border/60 rounded-2xl animate-[chat-fade-in_0.2s_ease-out]">
          {isImageFile && imageUrlRef.current ? (
            <img
              src={imageUrlRef.current}
              alt={file.name}
              className="w-9 h-9 rounded-xl object-cover border border-border/60"
            />
          ) : (
            <div className="p-2 bg-primary/10 rounded-xl shrink-0">
              <FileText className="w-4 h-4 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{file.name}</p>
            <p className="text-[10px] text-muted mt-0.5">{formatFileSize(file.size)}</p>
          </div>
          <button
            onClick={() => onFileChange(null)}
            className="p-1.5 text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
            title="Remove file"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Unified input container */}
      <div className={`flex items-end gap-0 rounded-2xl border transition-all duration-200 bg-card ${
        disabled ? "opacity-60" : "border-border/60 focus-within:border-primary/40 focus-within:shadow-[0_0_0_1px_rgba(10,139,248,0.15)]"
      }`}>
        {/* Paperclip — inside container left */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="p-3.5 text-muted hover:text-primary transition-colors disabled:cursor-not-allowed shrink-0 self-end mb-0.5"
          title="Attach file"
        >
          <Paperclip className="w-[18px] h-[18px]" />
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.txt,.py,.js,.ts,.html,.css,.md,.csv,.json,.xml,.ipynb"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            adjustHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask about a topic or request a practice quiz..."
          rows={1}
          disabled={disabled}
          className="flex-1 bg-transparent py-3.5 pr-2 text-sm text-foreground placeholder-muted resize-none overflow-y-auto leading-relaxed focus:outline-none"
          style={{ maxHeight: "140px" }}
        />

        {/* Send button — inside container right */}
        <div className="p-2 self-end mb-1 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (canSend) {
                onSend();
                if (textareaRef.current) textareaRef.current.style.height = "auto";
              }
            }}
            disabled={!canSend}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 ${
              canSend
                ? "bg-gradient-to-br from-primary to-blue-600 hover:opacity-90 text-white shadow-[0_2px_8px_rgba(10,139,248,0.35)] scale-100"
                : "bg-white/5 text-muted cursor-not-allowed scale-95"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <p className="text-center text-[10px] text-muted mt-2">
        Enter to send · Shift+Enter for new line · 📎 to attach a file
      </p>
      </div>
    </div>
  );
}
