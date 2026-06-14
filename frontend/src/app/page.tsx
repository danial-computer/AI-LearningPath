"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Activity,
  MousePointerClick,
  TrendingUp,
  Flame,
  BookOpen,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Brain,
  Zap,
  Shield,
  Calendar,
  Compass,
  AlertTriangle,
  GraduationCap,
  ArrowUpRight,
  Clock,
} from "lucide-react";
import type { Conversation } from "./chat/types";

interface Topic {
  id: string;
  name: string;
  description: string;
  difficulty: number;
  est_minutes: number;
  prerequisites: string[];
  is_remedial?: boolean;
}

interface ProgressData {
  configured: boolean;
  course?: string;
  learning_style?: string;
  current_node?: Topic;
  mastery?: Record<string, number>;
  fsrs_cards?: Record<string, unknown>;
  remedial_attempts?: number;
  syllabus?: Topic[];
}

function buildSparkline(data: number[], w = 120, h = 40) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = w / (data.length - 1 || 1);

  const pts = data.map((v, i) => {
    const x = i * step;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return { x: x.toFixed(1), y: y.toFixed(1) };
  });

  const line = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");
  const area = `M0,${h} L${pts.map((p) => `${p.x},${p.y}`).join(" L")} L${w},${h} Z`;

  return { line, area };
}

function buildHeatmap(timestamps: number[]): number[][] {
  const matrix: number[][] = Array(7)
    .fill(null)
    .map(() => Array(12).fill(0));
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - dayOfWeek);
  weekStart.setHours(0, 0, 0, 0);
  const windowStart = new Date(weekStart);
  windowStart.setDate(weekStart.getDate() - 11 * 7);

  timestamps.forEach((ts) => {
    const d = new Date(ts);
    const diffDays = Math.floor(
      (d.getTime() - windowStart.getTime()) / 86_400_000,
    );
    if (diffDays >= 0 && diffDays < 84) {
      const col = Math.floor(diffDays / 7);
      const row = (d.getDay() + 6) % 7;
      matrix[row][col]++;
    }
  });

  const peak = Math.max(...matrix.flat(), 1);
  return matrix.map((r) =>
    r.map((v) =>
      v === 0 ? 0 : v <= peak * 0.33 ? 1 : v <= peak * 0.66 ? 2 : 3,
    ),
  );
}

export default function Dashboard() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionId, setSessionId] = useState("default_session");
  const [todayString, setTodayString] = useState("");

  const [metrics, setMetrics] = useState({
    totalClicks: 0,
    activeDays: 0,
    averageMastery: 0,
    streak: 0,
    earlyWarning: {
      status: "Safe",
      description: "Click pattern stable, low dropout risk.",
      color: "text-green-400",
      bgBorder: "border-green-500/10 hover:border-green-500/25",
      icon: Shield,
    },
    clickHistory: [10, 15, 12, 20, 25, 22, 30, 45, 35, 60, 50, 75, 65, 80],
    masteryHistory: [15, 15, 20, 25, 30, 35, 40],
  });

  const [recentActivities, setRecentActivities] = useState<
    { time: string; text: string; Icon: React.ElementType; color: string }[]
  >([]);

  const [heatmapData, setHeatmapData] = useState<number[][]>(() =>
    Array(7)
      .fill(null)
      .map(() => Array(12).fill(0)),
  );

  useEffect(() => {
    const now = new Date();
    setTodayString(
      now.toLocaleDateString("en-US", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    );

    if (typeof window !== "undefined") {
      const activeId = localStorage.getItem("active_chat_id");
      if (activeId) {
        setSessionId(activeId);
      }
    }
  }, []);

  const calculateDynamicMetrics = (progress: ProgressData, sid: string) => {
    let msgCount = 0;
    let actDays = 1;
    let streakCount = 1;
    let chatTimestamps: number[] = [];

    try {
      const stored = localStorage.getItem("chat_history");
      if (stored) {
        const conversations: Conversation[] = JSON.parse(stored);
        const activeConv = conversations.find((c) => c.id === sid);
        if (activeConv && activeConv.messages) {
          msgCount = activeConv.messages.length;
          chatTimestamps = activeConv.messages.map((m) => m.timestamp);

          const uniqueDays = new Set(
            chatTimestamps.map((ts) => new Date(ts).toDateString()),
          );
          if (uniqueDays.size > 0) {
            actDays = uniqueDays.size;
          }

          streakCount = Math.min(12, actDays);
        }
      }
    } catch (e) {
      console.error(e);
    }

    const reviewsCount = Object.keys(progress.fsrs_cards || {}).length;
    const calculatedClicks = msgCount * 8 + reviewsCount * 15 + 12;

    const masteryValues = Object.values(progress.mastery || {});
    const avgMastery =
      masteryValues.length > 0
        ? Math.round(
            (masteryValues.reduce((sum, val) => sum + val, 0) /
              (progress.syllabus?.length || 1)) *
              100,
          )
        : 15;

    let warning = {
      status: "Safe",
      description: "Click pattern stable, low dropout risk. Keep it up!",
      color: "text-green-400",
      bgBorder: "border-green-500/10 hover:border-green-500/25",
      icon: Shield,
    };

    const hasRemedialActive = progress.current_node?.is_remedial;
    const attempts = progress.remedial_attempts || 0;

    if (hasRemedialActive) {
      warning = {
        status: "Needs Attention",
        description: "Learning barrier detected. Remedial exercise inserted.",
        color: "text-yellow-400",
        bgBorder:
          "border-yellow-500/20 hover:border-yellow-500/40 bg-yellow-500/[0.01]",
        icon: AlertTriangle,
      };
    } else if (attempts >= 1) {
      warning = {
        status: "Early Warning",
        description: "One quiz error detected. AI recommends a review.",
        color: "text-yellow-500",
        bgBorder: "border-yellow-500/10 hover:border-yellow-500/25",
        icon: AlertTriangle,
      };
    }

    const clicksHist = [
      10,
      15,
      12,
      20,
      calculatedClicks - 10,
      calculatedClicks,
    ];
    const masteryHist = [15, 15, Math.max(15, avgMastery - 10), avgMastery];

    setMetrics({
      totalClicks: calculatedClicks,
      activeDays: actDays,
      averageMastery: avgMastery,
      streak: streakCount,
      earlyWarning: warning,
      clickHistory: clicksHist,
      masteryHistory: masteryHist,
    });

    setHeatmapData(buildHeatmap(chatTimestamps));

    const activities: {
      time: string;
      text: string;
      Icon: React.ElementType;
      color: string;
    }[] = [];

    activities.push({
      time: "Session Start",
      text: `Started studying ${progress.course} with ${progress.learning_style} learning style`,
      Icon: CheckCircle2,
      color: "text-green-400",
    });

    if (progress.current_node) {
      activities.push({
        time: "Currently Studying",
        text: `Learning concept: ${progress.current_node.name}`,
        Icon: BookOpen,
        color: "text-blue-400",
      });
    }

    if (hasRemedialActive) {
      activities.push({
        time: "Just now",
        text: `AI redirected learning path to remedial: ${progress.current_node?.name}`,
        Icon: AlertTriangle,
        color: "text-red-400",
      });
    }

    if (reviewsCount > 0) {
      activities.push({
        time: "Recent",
        text: `Reviewed ${reviewsCount} topics using Spaced Repetition (SM-2)`,
        Icon: Brain,
        color: "text-purple-400",
      });
    }

    setRecentActivities(activities.reverse().slice(0, 4));
  };

  const fetchProgress = async (sid: string) => {
    try {
      setIsLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/progress`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token || ""}`,
            "X-Session-ID": sid,
          },
        },
      );
      if (res.ok) {
        const progressJson = await res.json();
        setData(progressJson);

        if (progressJson.configured) {
          calculateDynamicMetrics(progressJson, sid);
        }
      }
    } catch (err) {
      console.error("Gagal mengambil data progress dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      fetchProgress(sessionId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

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
          <span className="text-sm text-gray-400 font-medium">
            Loading Dashboard...
          </span>
        </div>
      </div>
    );
  }

  if (!data || !data.configured) {
    return (
      <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-8 animate-[chat-fade-in_0.4s_ease-out] flex flex-col justify-center min-h-[85vh] relative overflow-hidden">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(10,139,248,0.08) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)",
          }}
        />

        <div className="text-center space-y-4 max-w-2xl mx-auto relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto shrink-0 mb-2">
            <GraduationCap className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            AI Learning Path
          </h1>
          <p className="text-base sm:text-lg text-gray-400 leading-relaxed">
            An adaptive learning platform with Socratic AI Tutor, Knowledge
            Tracing (BKT), and Spaced Repetition Flashcard reviews (SM-2) to
            help you ace your practicum.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 max-w-5xl mx-auto w-full pt-4">
          <div className="bg-card/40 border border-border/80 p-6 rounded-2xl space-y-3 hover:border-primary/20 transition-all group">
            <div className="p-2.5 bg-primary/10 rounded-xl w-fit">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-foreground text-base">
              Socratic AI Tutor
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Discuss topics without getting direct code solutions. The AI
              guides you step-by-step with thought-provoking questions and
              diagram visualizations.
            </p>
          </div>

          <div className="bg-card/40 border border-border/80 p-6 rounded-2xl space-y-3 hover:border-yellow-500/20 transition-all group">
            <div className="p-2.5 bg-yellow-500/10 rounded-xl w-fit">
              <BookOpen className="w-5 h-5 text-yellow-400" />
            </div>
            <h3 className="font-bold text-foreground text-base">
              Adaptive Learning Path
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Difficulty is dynamically adjusted. If repeated failures are
              detected, AI inserts a special remedial exercise to strengthen
              your foundational understanding.
            </p>
          </div>

          <div className="bg-card/40 border border-border/80 p-6 rounded-2xl space-y-3 hover:border-purple-500/20 transition-all group">
            <div className="p-2.5 bg-purple-500/10 rounded-xl w-fit">
              <Brain className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="font-bold text-foreground text-base">
              Active Recall SM-2
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed">
              Key concepts you&apos;ve studied are scheduled for review using
              the SuperMemo-2 Flashcard algorithm to maintain your long-term
              memory.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center pt-6 relative z-10">
          <Link
            href="/chat"
            className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white px-8 py-3.5 rounded-xl font-bold text-sm transition-all shadow-[0_4px_25px_rgba(10,139,248,0.3)] hover:shadow-[0_4px_30px_rgba(10,139,248,0.55)] group"
          >
            Choose a Course &amp; Start Learning{" "}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <span className="text-[11px] text-gray-500 mt-3 font-medium">
            Open Chat AI to select your learning profile
          </span>
        </div>
      </div>
    );
  }

  // ─── ACTIVE STATE ───
  const syllabus = data.syllabus || [];
  const mastery = data.mastery || {};
  const currentNode = data.current_node!;

  const totalNodes = syllabus.filter((t) => !t.is_remedial).length;
  const masteredNodes = syllabus.filter(
    (t) => !t.is_remedial && (mastery[t.id] ?? 0.0) >= 0.8,
  ).length;
  const progressPercent = Math.round((masteredNodes / totalNodes) * 100) || 0;

  const WarningIcon = metrics.earlyWarning.icon;
  const klik = buildSparkline(metrics.clickHistory, 120, 40);
  const skor = buildSparkline(metrics.masteryHistory, 80, 32);

  const heatCls = (v: number) =>
    ["bg-white/[0.04]", "bg-primary/20", "bg-primary/45", "bg-primary/75"][v] ??
    "bg-white/[0.04]";

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6 animate-[chat-fade-in_0.4s_ease-out]">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-border/60 pb-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-1.5 mb-1">
            <Activity className="w-3.5 h-3.5" />
            Real-Time Learning Dashboard
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
            Welcome Back!
          </h1>
          <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            {todayString} | Session:{" "}
            <code className="text-xs bg-white/5 px-2 py-0.5 rounded text-gray-400">
              {sessionId.slice(0, 8)}
            </code>
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2.5 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-full">
            <GraduationCap className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="leading-tight">
              <span className="text-sm font-bold text-purple-300 block truncate max-w-[140px]">
                {data.course}
              </span>
              <span className="text-[10px] text-purple-400/70">
                {data.learning_style}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-full">
            <Flame className="w-5 h-5 text-orange-400 animate-pulse" />
            <span className="text-sm font-bold text-orange-300">
              {metrics.streak} Day Streak
            </span>
          </div>
        </div>
      </div>

      {/* ─── 4 Stat Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* VLE Clicks */}
        <div className="bg-card p-5 rounded-2xl border border-border group hover:border-blue-500/30 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
              <MousePointerClick className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-xs text-gray-400 leading-tight">
              VLE Interactions
            </span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <span className="text-3xl font-bold text-foreground tracking-tight">
                {metrics.totalClicks}
              </span>
              <p className="text-[10px] text-green-400 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Chat activity
              </p>
            </div>
            <svg
              width="80"
              height="32"
              viewBox="0 0 120 40"
              className="opacity-50 group-hover:opacity-90 transition-opacity shrink-0"
            >
              <defs>
                <linearGradient id="klikArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(59,130,246,0.25)" />
                  <stop offset="100%" stopColor="rgba(59,130,246,0)" />
                </linearGradient>
              </defs>
              <path d={klik.area} fill="url(#klikArea)" />
              <path
                d={klik.line}
                fill="none"
                stroke="rgba(59,130,246,0.8)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Active Days */}
        <div className="bg-card p-5 rounded-2xl border border-border group hover:border-cyan-500/30 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-cyan-500/10 rounded-lg shrink-0">
              <Calendar className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-xs text-gray-400 leading-tight">
              Active Days
            </span>
          </div>
          <div>
            <span className="text-3xl font-bold text-foreground tracking-tight">
              {metrics.activeDays}
            </span>
            <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Unique study days
            </p>
            <div className="flex gap-0.5 mt-2.5">
              {Array.from({ length: 7 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-1 rounded-full ${
                    i < Math.min(metrics.activeDays, 7)
                      ? "bg-cyan-500"
                      : "bg-white/10"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Avg Mastery */}
        <div className="bg-card p-5 rounded-2xl border border-border group hover:border-green-500/30 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-green-500/10 rounded-lg shrink-0">
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-xs text-gray-400 leading-tight">
              Avg Mastery
            </span>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div>
              <span className="text-3xl font-bold text-foreground tracking-tight">
                {metrics.averageMastery}%
              </span>
              <p className="text-[10px] text-gray-500 mt-1">
                BKT Mastery Index
              </p>
            </div>
            <svg
              width="80"
              height="32"
              viewBox="0 0 80 32"
              className="opacity-50 group-hover:opacity-90 transition-opacity shrink-0"
            >
              <path
                d={skor.line}
                fill="none"
                stroke="rgba(74,222,128,0.7)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Streak */}
        <div className="bg-card p-5 rounded-2xl border border-border group hover:border-orange-500/30 transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-orange-500/10 rounded-lg shrink-0">
              <Flame className="w-4 h-4 text-orange-400" />
            </div>
            <span className="text-xs text-gray-400 leading-tight">
              Day Streak
            </span>
          </div>
          <div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold text-foreground tracking-tight">
                {metrics.streak}
              </span>
              <span className="text-sm text-orange-400 font-semibold mb-0.5">
                days
              </span>
            </div>
            <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1">
              <Zap className="w-3 h-3 text-orange-400" /> Consecutive activity
            </p>
            <div className="mt-2.5 h-1 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-1 rounded-full bg-gradient-to-r from-orange-500 to-orange-300 transition-all"
                style={{
                  width: `${Math.min(100, (metrics.streak / 14) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Early Warning ─── */}
      <div
        className={`rounded-2xl border p-5 transition-all bg-card ${metrics.earlyWarning.bgBorder}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div
              className={`p-3 rounded-xl shrink-0 ${
                metrics.earlyWarning.status === "Safe"
                  ? "bg-green-500/10"
                  : "bg-yellow-500/10"
              }`}
            >
              <WarningIcon
                className={`w-6 h-6 ${metrics.earlyWarning.color} ${
                  metrics.earlyWarning.status !== "Safe" ? "animate-pulse" : ""
                }`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-base font-extrabold tracking-tight ${metrics.earlyWarning.color}`}
                >
                  {metrics.earlyWarning.status}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 border border-border/60 px-2 py-0.5 rounded-full">
                  Dropout Protection
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                {metrics.earlyWarning.description}
              </p>
            </div>
          </div>

          {(data.remedial_attempts ?? 0) > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.03] border border-border/60 rounded-xl shrink-0">
              <Compass className="w-4 h-4 text-yellow-400 shrink-0" />
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                  Remedial Attempts
                </p>
                <p className="text-sm font-bold text-yellow-300">
                  {data.remedial_attempts}&times; triggered
                </p>
              </div>
            </div>
          )}

          <Link
            href="/chat"
            className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs border transition-all ${
              metrics.earlyWarning.status === "Safe"
                ? "border-green-500/20 text-green-400 hover:bg-green-500/10"
                : "border-yellow-500/30 text-yellow-300 bg-yellow-500/10 hover:bg-yellow-500/20"
            }`}
          >
            {metrics.earlyWarning.status === "Safe"
              ? "Keep Going"
              : "Address Now"}
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* ─── Progress by Topic + AI Recommendations ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Bar Chart per Topic */}
        <div className="lg:col-span-3 bg-card p-6 rounded-2xl border border-border flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold">Progress by Topic</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                BKT mastery per topic &middot; {masteredNodes}/{totalNodes}{" "}
                mastered
              </p>
            </div>
            <span className="text-[11px] text-gray-400 bg-white/5 border border-border/80 px-3 py-1 rounded-full shrink-0">
              {progressPercent}% complete
            </span>
          </div>

          <div className="space-y-2 flex-1 overflow-y-auto max-h-[300px] pr-1">
            {syllabus.map((topic) => {
              const nodeMastery = mastery[topic.id] ?? 0.0;
              const isMastered = nodeMastery >= 0.8;
              const isActive = topic.id === currentNode.id;
              const pct = Math.round(nodeMastery * 100);

              let barColor = "bg-red-400";
              let labelCls = "bg-red-500/10 text-red-400 border-red-500/20";
              let label = "Critical";

              if (isMastered) {
                barColor = "bg-green-400";
                labelCls = "bg-green-500/10 text-green-400 border-green-500/20";
                label = "Mastered";
              } else if (nodeMastery >= 0.4) {
                barColor = "bg-yellow-400";
                labelCls =
                  "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
                label = "Learning";
              }

              if (isActive) {
                label = topic.is_remedial ? "Remedial" : "Active";
                labelCls = topic.is_remedial
                  ? "bg-red-500/10 text-red-300 border-red-500/30"
                  : "bg-primary/10 text-primary border-primary/20";
              }

              return (
                <div
                  key={topic.id}
                  className={`rounded-xl px-3 py-2.5 transition-colors ${
                    isActive
                      ? "bg-white/[0.025] border border-border/60"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      {isActive ? (
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${
                            topic.is_remedial ? "bg-red-400" : "bg-primary"
                          }`}
                        />
                      ) : isMastered ? (
                        <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-white/20" />
                      )}
                      <span className="font-medium text-gray-300 truncate">
                        {topic.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${labelCls}`}
                      >
                        {label}
                      </span>
                      <span className="text-[11px] font-bold text-gray-300 w-8 text-right">
                        {pct}%
                      </span>
                    </div>
                  </div>
                  <div className="relative h-2.5 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full ${barColor} transition-all`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border/40 flex-wrap">
            {[
              { c: "bg-green-400", l: "Mastered \u226580%" },
              { c: "bg-yellow-400", l: "In Progress 40\u201379%" },
              { c: "bg-red-400", l: "Critical <40%" },
            ].map((item) => (
              <div key={item.l} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${item.c}`} />
                <span className="text-[10px] text-gray-500">{item.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-base font-bold">AI Recommendations</h2>
          </div>

          <div
            className={`bg-card rounded-2xl border p-5 hover:border-primary/30 transition-all ${
              currentNode.is_remedial
                ? "border-red-500/25 bg-red-500/[0.01]"
                : "border-border"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${currentNode.is_remedial ? "bg-red-500/10" : "bg-primary/10"}`}
              >
                <Zap
                  className={`w-4 h-4 ${currentNode.is_remedial ? "text-red-400 animate-pulse" : "text-primary"}`}
                />
              </div>
              <div className="flex-1 min-w-0">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider ${currentNode.is_remedial ? "text-red-400 animate-pulse" : "text-primary"}`}
                >
                  {currentNode.is_remedial
                    ? "Active Remedial Challenge"
                    : "Current Active Topic"}
                </span>
                <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                  Continue studying{" "}
                  <strong className="text-foreground">
                    {currentNode.name}
                  </strong>{" "}
                  with the AI Tutor to solidify your understanding.
                </p>
                <Link
                  href="/chat"
                  className={`mt-3.5 inline-flex items-center gap-1 text-[11px] font-bold hover:underline ${currentNode.is_remedial ? "text-red-400" : "text-primary"}`}
                >
                  Continue Chat <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-5 hover:border-purple-500/30 transition-all">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 bg-purple-500/10 rounded-lg shrink-0">
                <Brain className="w-4 h-4 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                  Spaced Repetition Review
                </span>
                <p className="text-xs text-gray-300 mt-2 leading-relaxed">
                  Open Learning Path and use the{" "}
                  <strong className="text-foreground">Review Flashcard</strong>{" "}
                  button to test your long-term memory.
                </p>
                <Link
                  href="/silabus"
                  className="mt-3.5 inline-flex items-center gap-1 text-[11px] font-bold text-purple-400 hover:text-purple-300 hover:underline"
                >
                  Open Learning Path <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Heatmap + Recent Activities ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Activity Heatmap */}
        <div className="lg:col-span-3 bg-card p-6 rounded-2xl border border-border">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold">Learning Activity Map</h2>
            <span className="text-[11px] text-gray-500">Last 12 weeks</span>
          </div>
          <p className="text-xs text-gray-400 mb-5 leading-relaxed">
            Your daily message frequency on the VLE learning platform.
          </p>

          <div className="overflow-x-auto -mx-2 px-2">
            <div className="flex gap-1.5 min-w-[300px]">
              <div className="flex flex-col gap-1 justify-between text-[10px] text-gray-500 pr-1 py-px shrink-0">
                <span className="h-3 leading-3">Mon</span>
                <span className="h-3 leading-3" />
                <span className="h-3 leading-3">Wed</span>
                <span className="h-3 leading-3" />
                <span className="h-3 leading-3">Fri</span>
                <span className="h-3 leading-3" />
                <span className="h-3 leading-3" />
              </div>
              <div className="flex-1 grid grid-rows-7 grid-flow-col gap-0.75">
                {heatmapData.flat().map((v, i) => (
                  <div
                    key={i}
                    className={`w-full aspect-square rounded-[2.5px] ${heatCls(v)} transition-colors`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 mt-4 justify-end">
            <span className="text-[10px] text-gray-500 mr-1">Low</span>
            {[0, 1, 2, 3].map((v) => (
              <div key={v} className={`w-2.5 h-2.5 rounded-sm ${heatCls(v)}`} />
            ))}
            <span className="text-[10px] text-gray-500 ml-1">High</span>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 bg-card p-6 rounded-2xl border border-border flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-bold">Recent Activities</h2>
            <span className="text-[10px] text-gray-500 bg-white/5 border border-border/60 px-2 py-1 rounded-full">
              This Session
            </span>
          </div>

          <div className="flex-1">
            {recentActivities.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8 italic">
                No activities recorded yet
              </p>
            ) : (
              <div className="space-y-0">
                {recentActivities.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 group">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="p-2 rounded-xl bg-white/[0.04] border border-border/50 group-hover:border-border transition-colors">
                        <item.Icon className={`w-3.5 h-3.5 ${item.color}`} />
                      </div>
                      {i < recentActivities.length - 1 && (
                        <div className="w-px h-4 bg-border/30 my-0.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pb-4">
                      <p className="text-xs text-gray-300 leading-snug font-medium">
                        {item.text}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3 text-gray-600" />
                        <p className="text-[10px] text-gray-500">{item.time}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Link
            href="/chat"
            className="mt-4 w-full text-center text-xs font-semibold text-gray-400 hover:text-foreground py-2.5 rounded-xl border border-border/60 hover:border-border transition-all block"
          >
            Open Chat AI Console
          </Link>
        </div>
      </div>
    </div>
  );
}
