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
} from "lucide-react";

function buildSparkline(data, w = 120, h = 40) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const step = w / (data.length - 1);

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

export default function Dashboard() {
  const klikData = [30, 45, 35, 60, 50, 75, 65, 80, 70, 90, 85, 95, 88, 102];
  const skorData = [75, 78, 76, 80, 79, 82, 81, 83, 80, 82.5];

  const klik = buildSparkline(klikData, 120, 40);
  const skor = buildSparkline(skorData, 80, 32);

  /* ---------- heatmap data (7 hari × 12 minggu) ---------- */
  const heatmap = [
    [0, 2, 1, 3, 0, 1, 2, 3, 1, 0, 2, 3],
    [1, 3, 2, 0, 2, 3, 1, 2, 0, 1, 3, 2],
    [2, 1, 3, 2, 1, 0, 3, 1, 2, 3, 0, 1],
    [0, 0, 1, 1, 3, 2, 0, 3, 2, 1, 1, 3],
    [3, 2, 0, 3, 1, 1, 2, 0, 3, 2, 3, 0],
    [1, 1, 2, 0, 0, 3, 1, 2, 1, 3, 2, 1],
    [0, 3, 1, 2, 2, 0, 0, 1, 3, 0, 1, 2],
  ];

  const heatCls = (v: number) =>
    ["bg-white/[0.04]", "bg-primary/20", "bg-primary/40", "bg-primary/65"][v] ??
    "bg-white/[0.04]";

  /* ---------- aktivitas terakhir ---------- */
  const recent = [
    {
      time: "2 jam lalu",
      text: "Menyelesaikan kuis Normalisasi DB",
      Icon: CheckCircle2,
      color: "text-green-400",
    },
    {
      time: "5 jam lalu",
      text: "Membaca materi Pipelining",
      Icon: BookOpen,
      color: "text-blue-400",
    },
    {
      time: "Kemarin, 21:30",
      text: "Review flashcard Binary Tree",
      Icon: Brain,
      color: "text-purple-400",
    },
    {
      time: "Kemarin, 15:00",
      text: "Mengerjakan latihan soal SQL",
      Icon: Zap,
      color: "text-yellow-400",
    },
  ];

  /* ====================================================== */
  return (
    <div className="p-6 lg:p-8 max-w-360 mx-auto space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Selamat Datang Kembali
          </h1>
          <p className="text-gray-400 mt-1 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Selasa, 24 Juni 2025
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-full">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="text-sm font-bold text-orange-300">
              12 Hari Streak
            </span>
          </div>
        </div>
      </div>

      {/* ─── Metric Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Klik */}
        <div className="bg-card p-5 rounded-2xl border border-border group hover:border-blue-500/30 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <MousePointerClick className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-sm text-gray-400">Total Klik VLE</span>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-4xl font-bold text-foreground tracking-tight">
                1,432
              </span>
              <p className="text-xs text-green-400 mt-1.5 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> +12% dari minggu lalu
              </p>
            </div>

            <svg
              width="120"
              height="40"
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

        {/* Hari Aktif */}
        <div className="bg-card p-5 rounded-2xl border border-border group hover:border-purple-500/30 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Activity className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-sm text-gray-400">Hari Aktif</span>
          </div>
          <div>
            <span className="text-4xl font-bold text-foreground tracking-tight">
              45
            </span>
            <span className="text-lg text-gray-500 ml-1">Hari</span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">Top 20% pengguna aktif</p>
        </div>

        {/* Rata-rata Skor */}
        <div className="bg-card p-5 rounded-2xl border border-border group hover:border-green-500/30 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-sm text-gray-400">Rata-rata Skor</span>
          </div>

          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-4xl font-bold text-foreground tracking-tight">
                82.5
              </span>
              <p className="text-xs text-gray-500 mt-1.5">
                Status: Distinction
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

        {/* Peringatan Dini — hijau karena status Aman */}
        <div className="bg-card p-5 rounded-2xl border border-green-500/10 group hover:border-green-500/25 transition-colors">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Shield className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-sm text-gray-400">Peringatan Dini</span>
          </div>
          <span className="text-3xl font-bold text-green-400 tracking-tight">
            Aman
          </span>
          <p className="text-xs text-gray-500 mt-1.5">
            Pola klik stabil, risiko dropout rendah.
          </p>
        </div>
      </div>

      {/* ─── Progress + AI Rekomendasi ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Progress Topik */}
        <div className="lg:col-span-3 bg-card p-6 rounded-2xl border border-border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold">Progress Topik</h2>
            <span className="text-[11px] text-gray-500 bg-white/4 border border-border/60 px-3 py-1 rounded-full">
              Spaced Repetition
            </span>
          </div>

          <div className="space-y-5">
            {/* Database — Normalisasi */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-sm font-medium text-gray-200">
                    Sistem Database I — Normalisasi
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-600">2 hari lalu</span>
                  <span className="text-xs font-semibold text-green-400 bg-green-500/10 px-2 py-0.5 rounded">
                    85%
                  </span>
                </div>
              </div>
              <div className="w-full bg-white/4 rounded-full h-1.5">
                <div
                  className="bg-green-400 h-1.5 rounded-full"
                  style={{ width: "85%" }}
                />
              </div>
            </div>

            {/* Orarkom — Pipelining */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                  <span className="text-sm font-medium text-gray-200">
                    Orarkom — Pipelining
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-600">5 hari lalu</span>
                  <span className="text-xs font-semibold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded">
                    45%
                  </span>
                </div>
              </div>
              <div className="w-full bg-white/4 rounded-full h-1.5">
                <div
                  className="bg-yellow-400 h-1.5 rounded-full"
                  style={{ width: "45%" }}
                />
              </div>
            </div>

            {/* Struktur Data — Binary Tree */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-sm font-medium text-gray-200">
                    Struktur Data — Binary Tree
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-gray-600">8 hari lalu</span>
                  <span className="text-xs font-semibold text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                    20%
                  </span>
                </div>
              </div>
              <div className="w-full bg-white/4 rounded-full h-1.5">
                <div
                  className="bg-red-400 h-1.5 rounded-full"
                  style={{ width: "20%" }}
                />
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 mt-6 pt-4 border-t border-border/40">
            {[
              { c: "bg-green-400", l: "Mastered" },
              { c: "bg-yellow-400", l: "Needs Review" },
              { c: "bg-red-400", l: "Critical" },
            ].map((item) => (
              <div key={item.l} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${item.c}`} />
                <span className="text-[11px] text-gray-500">{item.l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Rekomendasi */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-lg font-bold">Rekomendasi AI</h2>
          </div>

          {/* Card 1 — Prioritas Tinggi */}
          <div className="bg-card rounded-2xl border border-border p-5 hover:border-red-500/20 transition-colors">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 bg-red-500/10 rounded-lg shrink-0">
                <Zap className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold text-red-400 uppercase tracking-wider">
                  Prioritas Tinggi
                </span>
                <p className="text-sm text-gray-300 mt-1.5 leading-relaxed">
                  Ulas materi{" "}
                  <strong className="text-foreground">Binary Tree</strong>.
                  Memori Anda di topik ini menurun drastis sejak 8 hari lalu.
                </p>
                <button className="mt-3 text-xs font-medium text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                  Mulai Review <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Card 2 — Latihan Baru */}
          <div className="bg-card rounded-2xl border border-border p-5 hover:border-yellow-500/20 transition-colors">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 bg-yellow-500/10 rounded-lg shrink-0">
                <BookOpen className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-semibold text-yellow-400 uppercase tracking-wider">
                  Latihan Baru
                </span>
                <p className="text-sm text-gray-300 mt-1.5 leading-relaxed">
                  Coba kuis pendek tentang{" "}
                  <strong className="text-foreground">
                    Pipelining (Orarkom)
                  </strong>{" "}
                  untuk memperkuat ingatan.
                </p>
                <button className="mt-3 text-xs font-medium text-yellow-400 hover:text-yellow-300 flex items-center gap-1 transition-colors">
                  Buka Kuis <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Heatmap + Aktivitas Terakhir (BARU) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Peta Aktivitas */}
        <div className="lg:col-span-3 bg-card p-6 rounded-2xl border border-border">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-bold">Peta Aktivitas</h2>
            <span className="text-[11px] text-gray-600">
              12 minggu terakhir
            </span>
          </div>
          <p className="text-xs text-gray-500 mb-5">
            Intensitas interaksi Anda dengan VLE setiap hari.
          </p>

          <div className="overflow-x-auto -mx-2 px-2">
            <div className="flex gap-1.5 min-w-125">
              {/* Label hari */}
              <div className="flex flex-col gap-0.75 justify-between text-[10px] text-gray-600 pr-1 py-px shrink-0">
                <span className="h-3.5 leading-3.5">Sen</span>
                <span className="h-3.5 leading-3.5" />
                <span className="h-3.5 leading-3.5">Rab</span>
                <span className="h-3.5 leading-3.5" />
                <span className="h-3.5 leading-3.5">Jum</span>
                <span className="h-3.5 leading-3.5" />
                <span className="h-3.5 leading-3.5" />
              </div>

              {/* Grid cells */}
              <div className="flex-1 grid grid-rows-7 grid-flow-col gap-0.75">
                {heatmap.flat().map((v, i) => (
                  <div
                    key={i}
                    className={`w-full aspect-square rounded-[3px] ${heatCls(v)} transition-colors`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-4 justify-end">
            <span className="text-[10px] text-gray-600 mr-1">Sedikit</span>
            {[0, 1, 2, 3].map((v) => (
              <div key={v} className={`w-3 h-3 rounded-xs ${heatCls(v)}`} />
            ))}
            <span className="text-[10px] text-gray-600 ml-1">Banyak</span>
          </div>
        </div>

        {/* Aktivitas Terakhir */}
        <div className="lg:col-span-2 bg-card p-6 rounded-2xl border border-border">
          <h2 className="text-lg font-bold mb-5">Aktivitas Terakhir</h2>

          <div className="space-y-5">
            {recent.map((item, i) => (
              <div key={i} className="flex items-start gap-3 group">
                <div className="mt-0.5 p-2 rounded-xl bg-white/3 border border-border/50 group-hover:border-border transition-colors shrink-0">
                  <item.Icon className={`w-4 h-4 ${item.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 leading-snug">
                    {item.text}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-0.5">
                    {item.time}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button className="mt-6 w-full text-center text-xs font-medium text-gray-500 hover:text-gray-300 py-2.5 rounded-xl border border-border/50 hover:border-border transition-colors">
            Lihat Semua Aktivitas
          </button>
        </div>
      </div>
    </div>
  );
}
