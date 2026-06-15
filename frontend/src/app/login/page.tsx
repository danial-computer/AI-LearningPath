"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { BookOpen, Mail, Lock, Sparkles, AlertCircle, ArrowRight, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Check if user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.push("/");
      }
    };
    checkUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setIsLoading(true);

    try {
      if (mode === "login") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Save access token to localStorage for easy client API calls
        if (data.session) {
          localStorage.setItem("sb-access-token", data.session.access_token);
        }
        
        router.push("/");
        router.refresh();
      } else if (mode === "register") {
        if (password.length < 6) {
          throw new Error("Password minimal harus 6 karakter!");
        }
        if (password !== confirmPassword) {
          throw new Error("Password dan konfirmasi password tidak cocok!");
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          }
        });
        if (error) throw error;
        setSuccessMsg("Pendaftaran sukses! Silakan cek email Anda untuk mengaktifkan akun.");
        setPassword("");
        setConfirmPassword("");
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/update-password`,
        });
        if (error) throw error;
        setSuccessMsg("Link reset password telah dikirim ke email Anda! Silakan cek folder masuk.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan!");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative w-full h-full flex items-center justify-center px-4 select-none">
      {/* Full-screen decorative blobs */}
      <div className="fixed top-0 left-0 w-[600px] h-[600px] bg-primary/8 rounded-full blur-[120px] -translate-x-1/3 -translate-y-1/3 pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-[100px] translate-x-1/3 translate-y-1/3 pointer-events-none" />

      {/* Auth Card */}
      <div className="relative w-full max-w-md bg-card/60 border border-border/60 p-8 rounded-2xl shadow-2xl shadow-black/60">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="p-3 bg-primary/10 rounded-xl mb-3 border border-primary/20 text-primary">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-1.5 justify-center">
            AI Learning Path
            <Sparkles className="w-4 h-4 text-primary animate-bounce" />
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {mode === "login" && "Masuk untuk melanjutkan proses belajar adaptif Anda"}
            {mode === "register" && "Buat akun belajar baru Anda secara gratis"}
            {mode === "forgot" && "Reset kata sandi akun belajar Anda"}
          </p>
        </div>

        {/* Message Banner */}
        {errorMsg && (
          <div className="flex items-center gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl mb-6">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2.5 bg-green-500/10 border border-green-500/20 text-green-400 text-sm p-4 rounded-xl mb-6">
            <Sparkles className="w-5 h-5 shrink-0" />
            <p>{successMsg}</p>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email field */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full pl-11 pr-4 py-3 bg-background/50 border border-border/80 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-foreground"
              />
            </div>
          </div>

          {/* Password fields */}
          {mode !== "forgot" && (
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Password</label>
                {mode === "login" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Lupa Password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-3 bg-background/50 border border-border/80 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-400"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          )}

          {/* Confirm Password field (Register mode only) */}
          {mode === "register" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Konfirmasi Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-11 py-3 bg-background/50 border border-border/80 rounded-xl text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-foreground"
                />
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-4 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white rounded-xl text-sm font-semibold tracking-wide shadow-lg shadow-primary/25 hover:shadow-primary/30 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {mode === "login" && "Masuk"}
                {mode === "register" && "Buat Akun"}
                {mode === "forgot" && "Kirim Link Reset"}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Mode Switcher footer */}
        <div className="border-t border-border/60 mt-6 pt-5 text-center text-sm text-gray-400">
          {mode === "login" && (
            <p>
              Belum punya akun?{" "}
              <button
                onClick={() => {
                  setMode("register");
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
                className="font-semibold text-primary hover:underline"
              >
                Daftar Sekarang
              </button>
            </p>
          )}

          {mode === "register" && (
            <p>
              Sudah memiliki akun?{" "}
              <button
                onClick={() => {
                  setMode("login");
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
                className="font-semibold text-primary hover:underline"
              >
                Masuk
              </button>
            </p>
          )}

          {mode === "forgot" && (
            <p>
              Kembali ke halaman{" "}
              <button
                onClick={() => {
                  setMode("login");
                  setErrorMsg("");
                  setSuccessMsg("");
                }}
                className="font-semibold text-primary hover:underline"
              >
                Masuk
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
