import { Link } from "react-router-dom";
import { useLending } from "../hooks/useLending";

export default function LendingDashboardPage() {
  const { useDashboard } = useLending();
  const { data: dashboardData, isLoading } = useDashboard();

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Lending Dashboard</h1>
          <p className="text-muted text-sm mt-1.5">Overview of active capital and interest</p>
        </div>
        <Link
          to="/dashboard/lending/loans/new"
          className="flex items-center gap-2 px-4 sm:px-5 py-2.5 text-white text-sm font-semibold rounded-xl cursor-pointer hover:opacity-90 transition-all"
          style={{ background: "var(--gradient-primary)" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">New Loan</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      <div className="flex gap-4 border-b border-border/60 pb-1">
          <Link to="/dashboard/lending" className="font-semibold text-primary border-b-2 border-primary pb-2 px-1">Overview</Link>
          <Link to="/dashboard/lending/counterparties" className="font-medium text-muted hover:text-foreground pb-2 px-1">Counterparties</Link>
          <Link to="/dashboard/lending/loans" className="font-medium text-muted hover:text-foreground pb-2 px-1">All Loans</Link>
      </div>

      {isLoading ? (
        <div className="p-10 text-center text-muted">Loading metrics...</div>
      ) : dashboardData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl p-4 sm:p-5 text-white relative overflow-hidden" style={{ background: "var(--gradient-success)" }}>
            <p className="text-xs font-medium opacity-80 mb-1.5">Active Lent</p>
            <p className="text-lg sm:text-xl font-bold">₹{Number(dashboardData.active_lent_principal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-2xl p-4 sm:p-5 text-white relative overflow-hidden" style={{ background: "var(--gradient-danger)" }}>
            <p className="text-xs font-medium opacity-80 mb-1.5">Active Borrowed</p>
            <p className="text-lg sm:text-xl font-bold">₹{Number(dashboardData.active_borrowed_principal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-2xl p-4 sm:p-5 flex flex-col justify-center bg-surface border border-border" style={{ boxShadow: "var(--shadow-card)" }}>
            <p className="text-xs font-medium text-muted mb-1.5">Accrued Lent Interest</p>
            <p className="text-lg sm:text-2xl font-bold text-success">+ ₹{Number(dashboardData.accrued_lent_interest).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="rounded-2xl p-4 sm:p-5 flex flex-col justify-center bg-surface border border-border" style={{ boxShadow: "var(--shadow-card)" }}>
            <p className="text-xs font-medium text-muted mb-1.5">Accrued Borrowed Interest</p>
            <p className="text-lg sm:text-2xl font-bold text-danger">- ₹{Number(dashboardData.accrued_borrowed_interest).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="lg:col-span-4 rounded-2xl p-4 sm:p-6 bg-surface border border-border flex items-center justify-between" style={{ boxShadow: "var(--shadow-card)" }}>
             <div>
                <p className="text-sm font-medium text-muted mb-1">Available Liquidity</p>
                <p className={`text-2xl sm:text-3xl font-black ${Number(dashboardData.available_liquidity) >= 0 ? 'text-success' : 'text-danger'}`}>
                   {Number(dashboardData.available_liquidity) >= 0 ? '+' : ''}₹{Number(dashboardData.available_liquidity).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
