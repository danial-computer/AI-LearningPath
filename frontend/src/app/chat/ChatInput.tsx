"use client";

import { useRef, type KeyboardEvent } from "react";
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

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && (value.trim() || file)) {
        onSend();
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    onFileChange(selected);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const isImageFile = file?.type.startsWith("image/");

  return (
    <div className="p-6 bg-background border-t border-border">
      <div className="max-w-4xl mx-auto">
        {/* File Preview */}
        {file && (
          <div className="mb-3 flex items-center gap-3 p-3 bg-card border border-border rounded-xl animate-[chat-fade-in_0.2s_ease-out]">
            {isImageFile ? (
              <img
                src={URL.createObjectURL(file)}
                alt={file.name}
                className="w-10 h-10 rounded-lg object-cover border border-border"
              />
            ) : (
              <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {file.name}
              </p>
              <p className="text-[11px] text-gray-500">
                {formatFileSize(file.size)}
              </p>
            </div>
            <button
              onClick={() => onFileChange(null)}
              className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title="Hapus file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Input row */}
        <div className="flex gap-3 items-end">
          {/* Paperclip button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="p-4 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title="Lampirkan file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
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
            placeholder="Tanyakan sesuatu materi atau minta kuis latihan..."
            rows={1}
            className="flex-1 bg-card border border-border rounded-xl px-5 py-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground placeholder-gray-500 resize-none overflow-y-auto leading-relaxed"
            style={{ maxHeight: "150px" }}
          />

          {/* Send button */}
          <button
            type="button"
            onClick={() => {
              if (!disabled && (value.trim() || file)) {
                onSend();
                if (textareaRef.current) {
                  textareaRef.current.style.height = "auto";
                }
              }
            }}
            disabled={disabled || (!value.trim() && !file)}
            className="bg-primary hover:bg-primary-dark text-white p-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        <p className="text-center text-[11px] text-gray-600 mt-2">
          Enter untuk kirim · Shift+Enter untuk baris baru · 📎 untuk lampirkan
          file
        </p>
      </div>
    </div>
  );
}
