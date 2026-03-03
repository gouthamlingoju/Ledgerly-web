import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/lib/auth-context";

export default function DashboardLayout() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;

  useEffect(() => {
    if (!isLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, isLoading, navigate]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted font-medium">Loading your dashboard...</span>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      href: "/dashboard",
      label: "Home",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
        </svg>
      ),
      exact: true,
    },
    {
      href: "/dashboard/contacts",
      label: "Contacts",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      exact: false,
    },
    {
      href: "/dashboard/ledger",
      label: "Ledger",
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      exact: false,
    },
  ];

  const isActive = (item: (typeof navItems)[0]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  const displayName = user.username || user.email.split("@")[0];
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface/90 backdrop-blur-xl border-b border-border/60 sticky top-0 z-50"
        style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.05)" }}>
        <div className="max-w-[2400px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-10">
              <Link to="/dashboard" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg">
                  <span className="text-white text-4xl">📒</span>
                </div>
                <span className="text-3xl font-bold text-foreground tracking-tight">Ledgerly</span>
              </Link>
              <nav className="hidden sm:flex items-center gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive(item)
                      ? "text-white shadow-md"
                      : "text-muted hover:text-foreground hover:bg-surface-hover"
                      }`}
                    style={isActive(item) ? { background: "var(--gradient-primary)" } : undefined}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: "var(--gradient-accent)" }}>
                  {initials}
                </div>
                <span className="text-sm font-medium hidden sm:inline">{displayName}</span>
              </div>
              <div className="w-px h-6 bg-border hidden sm:block" />
              <button
                onClick={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
                className="text-sm text-muted hover:text-danger font-medium cursor-pointer px-3 py-2 rounded-xl hover:bg-danger-light transition-all"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[2400px] mx-auto px-5 sm:px-8 lg:px-12 py-7 sm:py-10 pb-32 sm:pb-10">
        <Outlet />
      </main>

      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-border/60 z-50"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", boxShadow: "0 -4px 20px 0 rgb(0 0 0 / 0.08)" }}>
        <div className="flex items-stretch">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-semibold transition-all ${isActive(item)
                ? "text-primary"
                : "text-muted active:text-foreground"
                }`}
            >
              <div className={`p-1.5 rounded-xl transition-all ${isActive(item) ? "bg-primary/15 text-primary scale-110" : ""}`}>
                {item.icon}
              </div>
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}