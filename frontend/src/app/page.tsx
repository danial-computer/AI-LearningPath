import { Activity, MousePointerClick, AlertTriangle, TrendingUp } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard Mahasiswa</h1>
        <p className="text-gray-400 mt-2">Gambaran umum progres belajar dan interaksi platform.</p>
      </div>

      {/* Top Metrics - Berdasarkan Fitur EDA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-400">Total Klik VLE</p>
              <h3 className="text-3xl font-bold text-foreground mt-2">1,432</h3>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-lg text-primary">
              <MousePointerClick className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-green-400 mt-4 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" /> +12% dari minggu lalu
          </p>
        </div>

        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-400">Hari Aktif</p>
              <h3 className="text-3xl font-bold text-foreground mt-2">45 Hari</h3>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-lg text-purple-400">
              <Activity className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4">Top 20% pengguna aktif</p>
        </div>

        <div className="bg-card p-6 rounded-xl border border-border shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm font-medium text-gray-400">Rata-rata Skor</p>
              <h3 className="text-3xl font-bold text-foreground mt-2">82.5</h3>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg text-green-400">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4">Status: Distinction (Aman)</p>
        </div>

        <div className="bg-red-500/5 p-6 rounded-xl border border-red-500/20 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start relative z-10">
            <div>
              <p className="text-sm font-medium text-red-400">Peringatan Dini</p>
              <h3 className="text-xl font-bold text-red-300 mt-2">Aman</h3>
            </div>
            <div className="p-3 bg-red-500/10 rounded-lg text-red-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-red-400/80 mt-4 relative z-10">Pola klik stabil, risiko dropout rendah.</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Progress Belajar */}
        <div className="lg:col-span-2 bg-card p-6 rounded-xl border border-border">
          <h2 className="text-lg font-bold mb-6">Progress Topik (Spaced Repetition)</h2>
          <div className="space-y-6">
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Sistem Database I - Normalisasi</span>
                <span className="text-primary">85% Mastered</span>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '85%' }}></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Orarkom - Pipelining</span>
                <span className="text-yellow-400">45% Needs Review</span>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div className="bg-yellow-400 h-2 rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">Struktur Data - Binary Tree</span>
                <span className="text-red-400">20% Critical</span>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div className="bg-red-400 h-2 rounded-full" style={{ width: '20%' }}></div>
              </div>
            </div>

          </div>
        </div>

        {/* AI Recommendations */}
        <div className="bg-card p-6 rounded-xl border border-border">
          <h2 className="text-lg font-bold mb-6">Rekomendasi AI Harian</h2>
          <ul className="space-y-4">
            <li className="p-4 bg-border/50 rounded-lg border border-border/80">
              <span className="inline-block px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded mb-2">Prioritas Tinggi</span>
              <p className="text-sm font-medium">Ulas materi <strong>Binary Tree</strong>. Memori Anda di topik ini menurun drastis sejak minggu lalu.</p>
            </li>
            <li className="p-4 bg-border/50 rounded-lg border border-border/80">
              <span className="inline-block px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded mb-2">Latihan Baru</span>
              <p className="text-sm font-medium">Coba kuis pendek tentang <strong>Pipelining (Orarkom)</strong> untuk memperkuat ingatan.</p>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
