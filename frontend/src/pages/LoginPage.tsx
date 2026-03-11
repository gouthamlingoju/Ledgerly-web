import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authApi.login(identifier, password);
      await login(res.data.access_token);
      navigate("/ledger");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-background relative overflow-hidden ">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <div className="w-full max-w-md bg-surface border border-border rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10">
        <div className="text-center mb-5">
          <h1 className="text-2xl font-bold tracking-tight">📒 Welcome back</h1>
          <p className="text-muted text-sm mt-2">Sign in to your Ledgerly account</p>
        </div>

        {error && (
          <div className="bg-danger-light border border-danger/20 text-danger text-sm px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
          <div className="space-y-1.5">
            <label htmlFor="identifier" className="block text-sm font-medium">
              Email or Username
            </label>
            <input
              id="identifier"
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className={inputClass}
              placeholder="Email or Username"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 text-white font-semibold rounded-xl disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed mt-2 text-sm sm:text-base hover:opacity-90 transition-all"
            style={{ background: "var(--gradient-primary)" }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-sm text-muted mt-8">
          Don&apos;t have an account?{" "}
          <Link
            to="/register"
            className="text-primary hover:text-primary-hover active:text-primary-hover font-semibold"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}