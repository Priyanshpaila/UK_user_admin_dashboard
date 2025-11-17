"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
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
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0b0b0c] to-[#111113] text-white relative overflow-hidden">
      <div className="absolute -top-20 -right-20 w-[400px] h-[400px] bg-blue-600/20 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-600/20 blur-[120px] rounded-full"></div>

      <div className="relative w-full max-w-md bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.4)] p-8 z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
          <p className="text-neutral-400 text-sm">
            Sign in to access your dashboard
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="text-sm text-neutral-300 mb-1 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-4 py-2 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-200 placeholder-neutral-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-neutral-300 mb-1 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-2 rounded-md bg-neutral-800 border border-neutral-700 text-neutral-200 placeholder-neutral-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 transition text-white font-medium"
          >
            {loading ? (
              <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
            ) : (
              <LogIn size={18} />
            )}
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
