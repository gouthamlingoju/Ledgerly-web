import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (username.trim().length < 2) {
      setError("Username must be at least 2 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await authApi.register(email, username.trim(), password);
      await login(res.data.access_token);
      navigate("/dashboard");
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm";

  return (
    <div className="min-h-screen flex items-center justify-center px-5 bg-background relative overflow-hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-[0.03] -mr-48 -mt-48"
        style={{ background: "var(--gradient-accent)" }} />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full opacity-[0.03] -ml-48 -mb-48"
        style={{ background: "var(--gradient-primary)" }} />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 text-white shadow-lg"
            style={{ background: "var(--gradient-primary)" }}>
            <span className="text-2xl">✨</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">Create account</h1>
          <p className="text-muted mt-2 text-sm sm:text-base">Start tracking your finances with Ledgerly</p>
        </div>

        <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8"
          style={{ boxShadow: "var(--shadow-elevated)" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-danger-light border border-danger/20 text-danger text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                {error}
              </div>
            )}

            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1.5">Username</label>
              <input id="username" type="text" required value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass} placeholder="johndoe" autoComplete="username" />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1.5">Email</label>
              <input id="email" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass} placeholder="you@example.com" autoComplete="email" />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1.5">Password</label>
              <input id="password" type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass} placeholder="••••••••" autoComplete="new-password" />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1.5">Confirm Password</label>
              <input id="confirmPassword" type="password" required value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass} placeholder="••••••••" autoComplete="new-password" />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 text-white font-semibold rounded-xl disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed mt-2 text-sm sm:text-base hover:opacity-90 transition-all"
              style={{ background: "var(--gradient-primary)" }}
            >
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="text-center text-sm text-muted mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:text-primary-hover active:text-primary-hover font-semibold">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}