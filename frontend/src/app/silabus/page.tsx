"use client";

import React, { useState, useEffect } from "react";

import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  BookOpen,
  ArrowRight,
  Lock,
  Play,
  CheckCircle2,
  Activity,
  Sparkles,
  Brain,
  Clock,
  Compass,
  AlertCircle,
  X,
  HelpCircle,
  ChevronRight
} from "lucide-react";

interface Topic {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  est_minutes: number;
  prerequisites: string[];
  is_remedial?: boolean;
}

interface Flashcard {
  q: string;
  a: string;
}

interface ProgressData {
  configured: boolean;
  course?: string;
  learning_style?: string;
  current_node?: Topic;
  mastery?: Record<string, number>;
  fsrs_cards?: Record<string, any>;
  remedial_attempts?: number;
  syllabus?: Topic[];
}

export default function SyllabusPathPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState("default_session");

  // State untuk Flashcards Modal
  const [activeFlashcardsTopic, setActiveFlashcardsTopic] = useState<Topic | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFlashcardDone, setIsFlashcardDone] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Ambil Session ID dari localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const activeId = localStorage.getItem("active_chat_id");
      if (activeId) {
        setSessionId(activeId);
      }
    }
  }, []);

  // Fetch data kemajuan berdasarkan Session ID
  const fetchProgress = async (sid: string) => {
    try {
      setIsLoading(true);
      // supabase may be null if env vars are not configured
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      const res = await fetch((`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/progress`), {
        headers: {
          "Authorization": `Bearer ${session?.access_token || ""}`,
          "X-Session-ID": sid,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to fetch progress data.");
      }
      const progressJson = await res.json();
      setData(progressJson);
    } catch (err: any) {
      setError(
        "Cannot connect to backend. Make sure FastAPI is running on port 8000."
      );
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchProgress(sessionId);
    }
  }, [sessionId]);

  // Load flashcards untuk topik tertentu
  const openFlashcards = async (topic: Topic) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/flashcards?topic_id=${topic.id}`);
      if (res.ok) {
        const cardsData = await res.json();
        setFlashcards(cardsData.cards || []);
        setActiveFlashcardsTopic(topic);
        setCurrentCardIdx(0);
        setIsFlipped(false);
        setIsFlashcardDone(false);
      }
    } catch (err) {
      console.error("Gagal memuat flashcards", err);
    }
  };

  // Kirim rating SM-2 ke backend
  const submitFlashcardRating = async (rating: number) => {
    if (!activeFlashcardsTopic || isSubmittingRating) return;
    setIsSubmittingRating(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch((`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/flashcard/review`), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token || ""}`,
          "X-Session-ID": sessionId,
        },
        body: JSON.stringify({
          topic_id: activeFlashcardsTopic.id,
          rating: rating,
        }),
      });

      if (res.ok) {
        // Jika masih ada kartu berikutnya, geser. Jika habis, tampilkan selesai.
        if (currentCardIdx < flashcards.length - 1) {
          setIsFlipped(false);
          // Beri sedikit Latency agar efek flip selesai
          setTimeout(() => {
            setCurrentCardIdx((prev) => prev + 1);
            setIsSubmittingRating(false);
          }, 150);
        } else {
          setIsFlashcardDone(true);
          setIsSubmittingRating(false);
          // Refetch progress untuk memperbarui state penguasaan graf
          fetchProgress(sessionId);
        }
      } else {
        setIsSubmittingRating(false);
      }
    } catch (err) {
      console.error("Gagal mengirim ulasan flashcard", err);
      setIsSubmittingRating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background animate-[chat-fade-in_0.2s_ease-out]">
        <div className="flex flex-col items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-primary animate-bounce" />
            <div
              className="w-3 h-3 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "0.2s" }}
            />
            <div
              className="w-3 h-3 rounded-full bg-primary animate-bounce"
              style={{ animationDelay: "0.4s" }}
            />
          </div>
          <span className="text-sm text-gray-400 font-medium">Loading Learning Path...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-full items-center justify-center bg-background px-6">
        <div className="bg-card border border-red-500/10 p-8 rounded-2xl max-w-md w-full text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto animate-pulse" />
          <h2 className="text-xl font-bold text-foreground">Backend Connection Lost</h2>
          <p className="text-sm text-gray-400 leading-relaxed">
            {error || "No response from the API server."}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-white/5 border border-border/80 hover:bg-white/10 text-foreground py-2.5 rounded-xl text-sm font-medium transition-all"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // ─── Layar Belum Dikonfigurasi ───
  if (!data.configured || !data.syllabus || !data.mastery || !data.current_node) {
    return (
      <div className="flex h-full items-center justify-center bg-background px-6">
        <div className="relative bg-card border border-border p-8 sm:p-10 rounded-3xl max-w-lg w-full text-center space-y-6 overflow-hidden">
          <div
            className="absolute -top-24 -left-24 w-64 h-64 rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(10,139,248,0.12) 0%, transparent 70%)"
            }}
          />
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto shrink-0">
            <Compass className="w-8 h-8 text-primary animate-[spin_6s_linear_infinite]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              Learning Path Not Active
            </h2>
            <p className="text-sm text-gray-400 leading-relaxed">
              You haven't chosen your learning material yet. Please go to Chat AI first and select a course and learning style to unlock your adaptive curriculum.
            </p>
          </div>
          <Link
            href="/chat"
            className="inline-flex items-center justify-center gap-2 w-full bg-primary hover:bg-primary-hover text-white py-3 rounded-xl font-semibold text-sm transition-all shadow-[0_4px_20px_rgba(10,139,248,0.25)] hover:shadow-[0_4px_25px_rgba(10,139,248,0.4)]"
          >
            Start Chat Configuration <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // ─── Layar Jalur Silabus Aktif ───
  const syllabus = data.syllabus;
  const mastery = data.mastery;
  const currentNode = data.current_node;
  
  const totalNodes = syllabus.filter((t) => !t.is_remedial).length;
  const masteredNodes = syllabus.filter((t) => !t.is_remedial && (mastery[t.id] ?? 0.0) >= 0.8).length;
  const progressPercent = Math.round((masteredNodes / totalNodes) * 100) || 0;

  const getDifficultyBadge = (difficulty: number) => {
    if (difficulty <= 0.4) {
      return <span className="px-2 py-0.5 text-[10px] font-semibold text-green-400 bg-green-500/10 rounded">Easy</span>;
    } else if (difficulty <= 0.7) {
      return <span className="px-2 py-0.5 text-[10px] font-semibold text-yellow-400 bg-yellow-500/10 rounded">Medium</span>;
    } else {
      return <span className="px-2 py-0.5 text-[10px] font-semibold text-red-400 bg-red-500/10 rounded">Hard</span>;
    }
  };

  // ── Stitch-inspired accent palette — rotates per topic ──
  const TOPIC_ACCENTS = [
    { color: "#0A8BF8", bg: "rgba(10,139,248,0.12)",  border: "rgba(10,139,248,0.25)",  text: "#0A8BF8"  }, // Electric Blue
    { color: "#8B5CF6", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.25)", text: "#8B5CF6" }, // Violet
    { color: "#06B6D4", bg: "rgba(6,182,212,0.12)",  border: "rgba(6,182,212,0.25)",  text: "#06B6D4"  }, // Cyan
    { color: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.25)", text: "#10B981" }, // Emerald
    { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)", text: "#F59E0B" }, // Amber
    { color: "#F43F5E", bg: "rgba(244,63,94,0.12)",  border: "rgba(244,63,94,0.25)",  text: "#F43F5E"  }, // Rose
  ];


  return (
    <div className="relative animate-[chat-fade-in_0.4s_ease-out]">
      {/* Top page glow */}
      <div
        className="fixed top-0 left-0 right-0 h-64 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% -20%, rgba(10,139,248,0.06) 0%, transparent 70%)" }}
      />

      <div className="relative p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
      {/* Header Jalur */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-border/60 pb-6">
        <div className="space-y-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" />
            Adaptive Learning Path
          </span>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground leading-tight">
            {data.course}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <Brain className="w-3 h-3 text-primary" />
              <span className="text-foreground/70">Style:</span>
              <strong className="text-primary font-medium">{data.learning_style}</strong>
            </span>
            <span className="text-border/60">·</span>
            <span className="flex items-center gap-1">
              <span className="text-foreground/50">Session:</span>
              <code className="text-[10px] text-muted font-mono">{sessionId.slice(0, 8)}...</code>
            </span>
          </div>
        </div>

        {/* Progress ring card */}
        <div className="flex items-center gap-5 bg-card/50 border border-border/60 px-7 py-5 rounded-3xl shrink-0 min-w-max shadow-sm">
          <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="36" stroke="rgba(255,255,255,0.04)" strokeWidth="6" fill="transparent" />
              <circle
                cx="40" cy="40" r="36"
                stroke="rgb(10,139,248)"
                strokeWidth="6"
                fill="transparent"
                strokeDasharray="226.2"
                strokeDashoffset={226.2 - (226.2 * progressPercent) / 100}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <span className="absolute text-xl font-bold text-foreground">{progressPercent}%</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted font-bold uppercase tracking-wider">Overall Progress</p>
            <p className="text-3xl font-extrabold text-foreground">
              {masteredNodes} <span className="text-muted font-medium text-lg">/ {totalNodes}</span>
            </p>
            <p className="text-xs font-medium text-muted">Topics Mastered</p>
          </div>
        </div>
      </div>

      {/* ─── How It Works Info Banner (Bento Style) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-gray-400">
        {/* BKT Card */}
        <div className="bg-card/40 border border-primary/20 rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden group hover:border-primary/40 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-2xl -translate-y-1/2 translate-x-1/2 rounded-full pointer-events-none" />
          <div className="p-2 bg-primary/10 rounded-lg shrink-0 group-hover:scale-110 transition-transform">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <div className="relative z-10">
            <span className="font-bold text-gray-200 block mb-1">Cognitive Mastery (BKT)</span>
            <p className="leading-relaxed">Reach <strong className="text-green-400">≥ 80%</strong> mastery to unlock the next topic. Updates automatically via Chat AI.</p>
          </div>
        </div>
        {/* Remedial Card */}
        <div className="bg-card/40 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden group hover:border-red-500/40 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/10 blur-2xl -translate-y-1/2 translate-x-1/2 rounded-full pointer-events-none" />
          <div className="p-2 bg-red-500/10 rounded-lg shrink-0 group-hover:scale-110 transition-transform">
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>
          <div className="relative z-10">
            <span className="font-bold text-gray-200 block mb-1">Remedial Trigger</span>
            <p className="leading-relaxed"><strong className="text-red-400">2 incorrect answers</strong> in a row inserts a Reinforcement Exercise before advancing.</p>
          </div>
        </div>
        {/* SM-2 Card */}
        <div className="bg-card/40 border border-purple-500/20 rounded-2xl p-4 flex items-start gap-3 relative overflow-hidden group hover:border-purple-500/40 transition-colors">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/10 blur-2xl -translate-y-1/2 translate-x-1/2 rounded-full pointer-events-none" />
          <div className="p-2 bg-purple-500/10 rounded-lg shrink-0 group-hover:scale-110 transition-transform">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div className="relative z-10">
            <span className="font-bold text-gray-200 block mb-1">Spaced Repetition</span>
            <p className="leading-relaxed">Completed topics get scheduled for <strong className="text-gray-200">Flashcard</strong> reviews to maintain long-term memory.</p>
          </div>
        </div>
      </div>

      {/* Timeline List */}
      <div className="relative space-y-6">
        <div className="absolute left-[26px] top-6 bottom-6 w-0.5 bg-border/40 pointer-events-none overflow-hidden rounded-full">
           <div 
             className="absolute top-0 w-full bg-gradient-to-b from-primary via-purple-500 to-transparent" 
             style={{ height: `${Math.max(10, progressPercent + 15)}%`, boxShadow: "0 0 10px rgba(10,139,248,0.5)" }} 
           />
        </div>

        {syllabus.map((topic, index) => {
          const nodeMastery = mastery[topic.id] ?? 0.0;
          const isMastered = nodeMastery >= 0.8;
          const isActive = topic.id === currentNode.id;
          
          const prereqs = topic.prerequisites || [];
          const isPrereqsMet = prereqs.every((pid) => (mastery[pid] ?? 0.0) >= 0.8);
          
          const isLocked = !isMastered && !isActive && !isPrereqsMet;
          const isAvailable = !isMastered && !isActive && isPrereqsMet;

          // Per-topic accent color (rotates through Stitch palette, skip remedial)
          const accentIdx = (index) % TOPIC_ACCENTS.length;
          const accent = TOPIC_ACCENTS[accentIdx];

          // Status & Styling
          let borderCls = "border-border/60 bg-card/25";
          let icon = <Play className="w-4 h-4" style={{ color: accent.color }} />;
          let iconBgStyle: React.CSSProperties = { background: accent.bg, borderColor: accent.border };
          let iconBg = "border";
          let statusText = "";

          if (isMastered) {
            borderCls = "border-green-500/20 bg-green-500/[0.02] hover:border-green-500/35 backdrop-blur-xl";
            icon = <CheckCircle2 className="w-5 h-5 text-green-400 relative z-10" />;
            iconBgStyle = { background: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.3)" };
            statusText = "COMPLETED";
          } else if (isActive) {
            borderCls = topic.is_remedial
              ? "border-red-500 bg-red-500/[0.04] shadow-[0_0_20px_rgba(239,68,68,0.15)] backdrop-blur-xl"
              : `border-[${accent.color}]/50 bg-white/[0.02] shadow-[0_0_24px_${accent.color}33] backdrop-blur-xl`;
            
            icon = (
              <>
                <Activity className={`w-5 h-5 relative z-10 ${topic.is_remedial ? "text-red-400" : ""}`} style={topic.is_remedial ? {} : { color: accent.color }} />
                <div className={`absolute inset-0 rounded-full animate-ping opacity-50 ${topic.is_remedial ? "bg-red-400" : ""}`} style={topic.is_remedial ? {} : { backgroundColor: accent.color }} />
              </>
            );
            
            iconBgStyle = topic.is_remedial
              ? { background: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.3)" }
              : { background: accent.bg, borderColor: accent.border };
            statusText = topic.is_remedial ? "REMEDIAL & REINFORCEMENT" : "CURRENTLY STUDYING";
          } else if (isLocked) {
            borderCls = "border-white/[0.03] bg-white/[0.01] opacity-45 select-none";
            icon = <Lock className="w-4 h-4 text-gray-500" />;
            iconBgStyle = { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.06)" };
            statusText = "LOCKED";
          } else if (isAvailable) {
            borderCls = "border-border/60 bg-card/30 hover:border-border";
            icon = <Play className="w-4 h-4" style={{ color: accent.color }} />;
            iconBgStyle = { background: accent.bg, borderColor: accent.border };
            statusText = "READY TO STUDY";
          }

          return (
            <div
              key={topic.id}
              className={`relative pl-14 transition-all duration-300 ${
                isLocked ? "pointer-events-none" : ""
              }`}
            >
              {/* Timeline dot — accent colored */}
              <div
                className={`absolute left-2.5 top-4 w-[34px] h-[34px] rounded-xl border-2 flex items-center justify-center z-10 transition-all duration-300 ${iconBg}`}
                style={iconBgStyle}
              >
                {icon}
              </div>

              {/* Card Content */}
              <div className={`p-5 rounded-2xl border transition-all duration-300 ${borderCls}`}>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="text-[10px] font-bold tracking-wider"
                        style={{ color: topic.is_remedial ? "#F43F5E" : accent.color }}
                      >
                        {topic.is_remedial ? "SPECIAL EXERCISE" : `TOPIC ${index + 1}`}
                      </span>
                      {statusText && (
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wider ${
                            isMastered
                              ? "bg-green-500/10 text-green-400"
                              : isActive
                              ? topic.is_remedial
                                ? "bg-red-500/10 text-red-400 animate-pulse"
                                : "bg-primary/10 text-primary animate-pulse"
                              : isLocked
                              ? "bg-white/5 text-gray-500"
                              : "bg-yellow-500/10 text-yellow-400"
                          }`}
                        >
                          {statusText}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-foreground">{topic.name}</h3>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0">
                    {getDifficultyBadge(topic.difficulty)}
                    <span className="text-[11px] text-gray-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {topic.est_minutes}m
                    </span>
                  </div>
                </div>

                <p className="text-sm text-gray-400 leading-relaxed mb-4">{topic.description}</p>

                {/* Prasyarat */}
                {prereqs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-4 text-xs text-gray-500">
                    <span>Prerequisites:</span>
                    {prereqs.map((pid) => {
                      const reqTopic = syllabus.find((t) => t.id === pid);
                      const reqMastery = mastery[pid] ?? 0.0;
                      const reqMastered = reqMastery >= 0.8;
                      return (
                        <span
                          key={pid}
                          className={`px-2 py-0.5 rounded border text-[10px] flex items-center gap-1 ${
                            reqMastered
                              ? "border-green-500/10 bg-green-500/5 text-green-400"
                              : "border-white/5 bg-white/[0.02] text-gray-500"
                          }`}
                        >
                          {reqMastered
                            ? <CheckCircle2 className="w-2.5 h-2.5" />
                            : <Lock className="w-2.5 h-2.5" />}
                          {reqTopic?.name || pid}
                          <span className={`font-bold ${
                            reqMastered ? "text-green-400" : reqMastery > 0 ? "text-yellow-500" : "text-gray-600"
                          }`}>
                            {Math.round(reqMastery * 100)}%
                          </span>
                          {!reqMastered && <span className="text-gray-600">/80%</span>}
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Mastery Bar with 80% threshold */}
                {!isLocked && (
                  <div className="pt-2 border-t border-border/30 mt-4 flex flex-col gap-3">
                    <div>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-gray-500 font-medium flex items-center gap-1">
                          <Brain className="w-3.5 h-3.5 text-primary" />
                          Cognitive Mastery (BKT)
                        </span>
                        <span className={`font-bold text-sm ${
                          isMastered ? "text-green-400" : isActive ? "text-primary" : "text-yellow-400"
                        }`}>
                          {Math.round(nodeMastery * 100)}%
                          <span className="text-muted font-bold text-xs ml-1.5">
                            {isMastered ? "✓ Mastered" : `/ 80% needed`}
                          </span>
                        </span>
                      </div>
                      {/* Bar with 80% threshold marker */}
                      <div className="relative w-full bg-white/[0.04] rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all duration-500 ${
                            isMastered
                              ? "bg-green-400"
                              : isActive
                              ? "bg-primary progress-glow-edge"
                              : "bg-yellow-400"
                          }`}
                          style={{ width: `${Math.min(nodeMastery * 100, 100)}%` }}
                        />
                        {/* 80% threshold marker */}
                        {!isMastered && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-green-400 shadow-[0_0_8px_#4ade80] rounded z-10"
                            style={{ left: "80%" }}
                            title="Mastery threshold: 80%"
                          >
                            <span className="absolute -top-5 -translate-x-1/2 text-[9px] text-green-400/80 whitespace-nowrap font-bold drop-shadow-[0_0_4px_rgba(74,222,128,0.5)]">80%</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Remedial attempt warning on active topic */}
                    {isActive && !topic.is_remedial && (data.remedial_attempts ?? 0) > 0 && (
                      <div className={`flex items-center gap-2 text-[11px] rounded-lg px-3 py-2 ${
                        (data.remedial_attempts ?? 0) >= 2
                          ? "bg-red-500/10 border border-red-500/20 text-red-400"
                          : "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"
                      }`}>
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                        {(data.remedial_attempts ?? 0) >= 2
                          ? <span><strong>Reinforcement exercise will be inserted</strong> — 2 incorrect answers detected on this topic.</span>
                          : <span><strong>{data.remedial_attempts} incorrect answer detected.</strong> 1 more will trigger a Reinforcement Exercise.</span>
                        }
                      </div>
                    )}

                    {/* Remedial context on remedial node */}
                    {isActive && topic.is_remedial && (
                      <div className="flex items-center gap-2 text-[11px] rounded-lg px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-300">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-400" />
                        <span>This Reinforcement Exercise was added because you had difficulty with the previous topic. Complete it to continue advancing.</span>
                      </div>
                    )}
                  </div>
                )}

                {/* CTA untuk Topik Aktif / Review Flashcards */}
                {!isLocked && (
                  <div className="mt-5 pt-4 border-t border-border/30 flex justify-end gap-3">
                    {/* Tombol Flashcard Review (Hanya jika tuntas atau siap diulas) */}
                    {(isMastered || isAvailable) && (
                      <button
                        onClick={() => openFlashcards(topic)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 text-gray-200 border border-border/80 text-xs font-semibold rounded-lg transition-all"
                      >
                        <Brain className="w-3.5 h-3.5 text-primary" /> Review Flashcard
                      </button>
                    )}

                    {isActive && (
                      <Link
                        href="/chat"
                        className="relative overflow-hidden inline-flex items-center gap-1 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-all shadow-[0_2px_10px_rgba(10,139,248,0.2)] group animate-shimmer"
                      >
                        <span className="relative z-10 flex items-center gap-1">Continue Learning <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" /></span>
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── MODAL POP-UP FLASHCARDS (Active Recall SM-2) ─── */}
      {activeFlashcardsTopic && flashcards.length > 0 && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6 animate-[chat-fade-in_0.2s_ease-out]">
          <div className="bg-card border border-border rounded-3xl w-full max-w-lg p-6 sm:p-8 relative flex flex-col space-y-6 shadow-2xl overflow-hidden">
            {/* Radial Glow */}
            <div
              className="absolute -top-32 -right-32 w-64 h-64 rounded-full pointer-events-none"
              style={{
                background: "radial-gradient(circle, rgba(10,139,248,0.1) 0%, transparent 70%)"
              }}
            />

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-4">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1">
                  <Brain className="w-3.5 h-3.5" /> Active Recall SM-2
                </span>
                <h3 className="text-base font-bold text-foreground truncate max-w-sm">
                  {activeFlashcardsTopic.name}
                </h3>
              </div>
              <button
                onClick={() => setActiveFlashcardsTopic(null)}
                className="p-1.5 text-gray-500 hover:text-foreground hover:bg-border rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Flashcard Cards */}
            {!isFlashcardDone ? (
              <div className="flex-1 flex flex-col space-y-6">
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>Review Progress</span>
                  <span>{currentCardIdx + 1} of {flashcards.length} Cards</span>
                </div>

                {/* 3D Flip Card Container */}
                <div
                  onClick={() => setIsFlipped((prev) => !prev)}
                  className="relative h-48 w-full cursor-pointer group [perspective:1000px]"
                >
                  <div
                    className={`relative w-full h-full text-center transition-transform duration-500 [transform-style:preserve-3d] border border-border/80 rounded-2xl p-6 flex flex-col items-center justify-center bg-white/[0.01] hover:bg-white/[0.02] ${
                      isFlipped ? "[transform:rotateY(180deg)] border-primary/30" : ""
                    }`}
                  >
                    {/* Sisi Depan (Question) */}
                    <div className="absolute inset-0 p-6 flex flex-col items-center justify-center [backface-visibility:hidden]">
                      <HelpCircle className="w-8 h-8 text-primary mb-3" />
                      <p className="text-sm font-bold text-foreground text-center">
                        {flashcards[currentCardIdx]?.q}
                      </p>
                      <span className="text-[10px] text-gray-600 mt-4 italic">Click card to reveal answer</span>
                    </div>

                    {/* Sisi Belakang (Answer) */}
                    <div className="absolute inset-0 p-6 flex flex-col items-center justify-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
                      <CheckCircle2 className="w-8 h-8 text-green-400 mb-3" />
                      <p className="text-sm text-gray-300 text-center leading-relaxed">
                        {flashcards[currentCardIdx]?.a}
                      </p>
                      <span className="text-[10px] text-gray-600 mt-4 italic">Click card to see question</span>
                    </div>
                  </div>
                </div>

                {/* Control / Rating Buttons */}
                <div className="flex flex-col gap-3">
                  {!isFlipped ? (
                    <button
                      onClick={() => setIsFlipped(true)}
                      className="w-full bg-primary hover:bg-primary-hover text-white py-3 rounded-xl font-bold text-sm transition-all"
                    >
                      Reveal Answer
                    </button>
                  ) : (
                    <div className="space-y-3 animate-[chat-fade-in_0.2s_ease-out]">
                      <p className="text-center text-xs text-gray-500">How well did you recall this concept?</p>
                      <div className="grid grid-cols-2 gap-2.5">
                        {/* Rating 1 - Again */}
                        <button
                          onClick={() => submitFlashcardRating(1)}
                          disabled={isSubmittingRating}
                          className="flex flex-col items-center justify-center p-2.5 border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/40 rounded-xl transition-all"
                        >
                          <span className="text-xs font-bold text-red-400">Forgot Completely</span>
                          <span className="text-[9px] text-red-500/70 mt-0.5">Review now (SM-2)</span>
                        </button>
                        {/* Rating 2 - Hard */}
                        <button
                          onClick={() => submitFlashcardRating(2)}
                          disabled={isSubmittingRating}
                          className="flex flex-col items-center justify-center p-2.5 border border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500/40 rounded-xl transition-all"
                        >
                          <span className="text-xs font-bold text-yellow-400">Hesitant</span>
                          <span className="text-[9px] text-yellow-500/70 mt-0.5">Review tomorrow</span>
                        </button>
                        {/* Rating 3 - Good */}
                        <button
                          onClick={() => submitFlashcardRating(3)}
                          disabled={isSubmittingRating}
                          className="flex flex-col items-center justify-center p-2.5 border border-primary/20 bg-primary/5 hover:bg-primary/10 hover:border-primary/40 rounded-xl transition-all"
                        >
                          <span className="text-xs font-bold text-primary">Remembered Well</span>
                          <span className="text-[9px] text-primary/70 mt-0.5">Review in 4 days</span>
                        </button>
                        {/* Rating 4 - Easy */}
                        <button
                          onClick={() => submitFlashcardRating(4)}
                          disabled={isSubmittingRating}
                          className="flex flex-col items-center justify-center p-2.5 border border-green-500/20 bg-green-500/5 hover:bg-green-500/10 hover:border-green-500/40 rounded-xl transition-all"
                        >
                          <span className="text-xs font-bold text-green-400">Very Easy</span>
                          <span className="text-[9px] text-green-500/70 mt-0.5">Review in 7 days</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Success Selesai Review */
              <div className="flex-1 flex flex-col items-center justify-center py-6 text-center space-y-4 animate-[chat-fade-in_0.3s_ease-out]">
                <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <div className="space-y-2">
                  <h4 className="text-lg font-bold text-foreground">Review Session Complete</h4>
                  <p className="text-xs text-gray-400 leading-relaxed max-w-sm">
                    Great job! All key concepts for this topic have been reviewed. Your memory schedule (SM-2) has been updated in the cognitive database.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setActiveFlashcardsTopic(null);
                    // Reload data
                    fetchProgress(sessionId);
                  }}
                  className="w-full bg-primary hover:bg-primary-hover text-white py-3 rounded-xl font-bold text-sm transition-all"
                >
                  Done & Back to Learning Path
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
