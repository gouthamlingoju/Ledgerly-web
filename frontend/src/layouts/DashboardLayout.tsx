import { useEffect } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/src/components/ThemeToggle";

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
          <span className="text-sm text-muted font-medium">
            Loading your dashboard...
          </span>
        </div>
      </div>
    );
  }

  const navItems = [
    {
      href: "/lending",
      label: "Lending",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      exact: false,
    },
    {
      href: "/ledger",
      label: "Ledger",
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
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
      <header
        className="bg-surface/90 backdrop-blur-xl border-b border-border/60 sticky top-0 z-50"
        style={{ boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.05)" }}
      >
        <div className="max-w-[2400px] mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-10">
              <Link to="/ledger" className="flex items-center gap-2.5 group">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg">
                  <span className="text-white text-4xl">📒</span>
                </div>
                <span className="text-3xl font-bold text-foreground tracking-tight">
                  Ledgerly
                </span>
              </Link>
              <nav className="hidden sm:flex items-center gap-2 p-1 bg-surface-hover/50 rounded-2xl border border-border/50">
                <Link
                  to="/lending"
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${pathname.startsWith("/lending")
                    ? "text-white shadow-md ring-1 ring-black/5"
                    : "text-muted hover:text-foreground hover:bg-surface/80"
                    }`}
                  style={pathname.startsWith("/lending") ? { background: "var(--gradient-primary)" } : {}}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Lending
                </Link>
                <Link
                  to="/ledger"
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${pathname.startsWith("/ledger")
                    ? "text-white shadow-md ring-1 ring-black/5"
                    : "text-muted hover:text-foreground hover:bg-surface/80"
                    }`}
                  style={pathname.startsWith("/ledger") ? { background: "var(--gradient-accent)" } : {}}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  Ledger
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="w-px h-6 bg-border hidden sm:block" />
              <Link
                to="/profile"
                className={`hidden sm:inline text-sm font-medium px-3 py-2 rounded-xl transition-all ${pathname === "/profile"
                  ? "text-primary bg-primary/10"
                  : "text-muted hover:text-foreground hover:bg-surface-hover"
                  }`}
              >
                Profile
              </Link>
              <div className="flex items-center gap-2.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ background: "var(--gradient-accent)" }}
                >
                  {initials}
                </div>
                <span className="text-sm font-medium hidden sm:inline">
                  {displayName}
                </span>
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

      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-border/60 z-50"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 -4px 20px 0 rgb(0 0 0 / 0.08)",
        }}
      >
        <div className="flex items-stretch">
          <Link
            to="/profile"
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-semibold transition-all ${pathname === "/profile" ? "text-primary" : "text-muted active:text-foreground"
              }`}
          >
            <div className={`p-1.5 rounded-xl transition-all ${pathname === "/profile" ? "bg-primary/15 text-primary scale-110" : ""}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A9 9 0 1118.88 17.8M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            Profile
          </Link>
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[11px] font-semibold transition-all ${isActive(item)
                ? "text-primary"
                : "text-muted active:text-foreground"
                }`}
            >
              <div
                className={`p-1.5 rounded-xl transition-all ${isActive(item) ? "bg-primary/15 text-primary scale-110" : ""}`}
              >
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
