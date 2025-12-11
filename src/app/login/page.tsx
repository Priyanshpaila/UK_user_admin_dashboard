"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn, ArrowLeft, Stethoscope } from "lucide-react";
import { loginApi } from "../../api";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await loginApi(email, password);
      const { session_token, user } = data;

      if (!user.is_admin && !user.is_pharmacist) {
        setError("Not authorized to access dashboard.");
        setLoading(false);
        return;
      }

      localStorage.setItem("session_token", session_token);
      localStorage.setItem("user", JSON.stringify(user));

      router.push("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Invalid email or password.");
      setLoading(false);
      return;
    }

    setLoading(false);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-[#0b0b0c] via-[#050509] to-[#111113] text-white">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-24 -right-10 h-[420px] w-[420px] rounded-full bg-blue-600/25 blur-[140px]" />
        <div className="absolute bottom-[-80px] -left-10 h-[420px] w-[420px] rounded-full bg-purple-600/25 blur-[140px]" />
      </div>

      {/* Top-left brand + back to home */}
      <div className="absolute top-5 left-5 flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] text-neutral-200 hover:border-white/40 hover:bg-black/50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </Link>
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900/80 p-8 shadow-[0_0_45px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-center gap-3">
          
          <div className="text-left">
            <h1 className="text-xl font-semibold tracking-tight">
              Pharmacy Express Admin
            </h1>
            <p className="text-[11px] text-neutral-400">
              Sign in to manage services & consultations
            </p>
          </div>
        </div>

        <h2 className="mb-2 text-lg font-semibold">Welcome back</h2>
        <p className="mb-5 text-xs text-neutral-400">
          Use your admin or pharmacist credentials to access the dashboard.
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs text-neutral-300">
              Email
            </label>
            <input
              type="email"
              value={email}
              autoComplete="email"
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-4 py-2 text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/60"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-neutral-300">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-4 py-2 text-sm text-neutral-200 placeholder-neutral-500 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-neutral-400 hover:text-neutral-200"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2.5 text-sm font-medium text-white shadow-[0_0_35px_rgba(37,99,235,0.6)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <LogIn size={18} />
            )}
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-neutral-500">
          Only authorised Pharmacy Express staff can sign in. Contact your
          administrator if you need access.
        </p>
      </div>
    </div>
  );
}
