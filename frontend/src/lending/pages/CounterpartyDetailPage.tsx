import { useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { lendingApi } from "../api/lendingApi";
import { useLending } from "../hooks/useLending";
import { LoanStatus, LoanType } from "../types";
import { SidebarLayout } from "../../components/SidebarLayout";
import { lendingSidebarItems } from "../../components/NavigationItems";

export default function CounterpartyDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortBy, setSortBy] = useState<'date' | 'due_date' | 'principal' | 'interest_rate' | 'type' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [error, setError] = useState("");

  const { useCounterpartyDetail, useUpdateCounterparty, useDeleteCounterparty } = useLending();

  const { data: detail, isLoading } = useCounterpartyDetail(id);
  const updateMutation = useUpdateCounterparty();
  const deleteMutation = useDeleteCounterparty();

  const rawLoans = detail?.loans || [];

  const loans = useMemo(() => {
    let result = [...rawLoans];
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      } else if (sortBy === 'due_date') {
        comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      } else if (sortBy === 'principal') {
        comparison = Number(a.current_principal) - Number(b.current_principal);
      } else if (sortBy === 'interest_rate') {
        comparison = Number(a.interest_rate) - Number(b.interest_rate);
      } else if (sortBy === 'type') {
        comparison = a.type.localeCompare(b.type);
      } else if (sortBy === 'status') {
        comparison = a.status.localeCompare(b.status);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    return result;
  }, [rawLoans, sortBy, sortOrder]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-muted">Loading...</span>
        </div>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="py-16 text-center text-muted">Counterparty not found.</div>
    );
  }

  const { counterparty } = detail;

  const totalLent = loans
    .filter(l => l.type === 'lent')
    .reduce((sum, l) => sum + Number(l.current_principal), 0);
  const totalBorrowed = loans
    .filter(l => l.type === 'borrowed')
    .reduce((sum, l) => sum + Number(l.current_principal), 0);
  const activeLoans = loans.filter(l => l.status === 'active').length;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  const startEditing = () => {
    setIsEditing(true);
    setEditName(counterparty.name);
    setEditPhone(counterparty.phone || "");
    setEditNotes(counterparty.notes || "");
    setError("");
  };

  const handleUpdate = async () => {
    if (!editName.trim()) {
      setError("Name cannot be empty.");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: counterparty.id,
        data: {
          name: editName,
          phone: editPhone || undefined,
          notes: editNotes || undefined,
        }
      });
      setIsEditing(false);
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update counterparty.");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${counterparty.name}? This will delete the counterparty and ALL their loans permanently.`)) return;
    try {
      await deleteMutation.mutateAsync(counterparty.id);
      navigate("/dashboard/lending/counterparties");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete counterparty.");
    }
  };

  return (
    <SidebarLayout items={lendingSidebarItems}>
      <div className="space-y-6 sm:space-y-8">
        <div>
          <button onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/dashboard/lending/counterparties')} className="inline-flex items-center gap-1.5 text-sm cursor-pointer text-muted hover:text-primary active:text-primary transition-all mb-4 px-1 py-1 -ml-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shrink-0"
                style={{ background: "var(--gradient-primary)" }}>
                {counterparty.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold truncate tracking-tight">{counterparty.name}</h1>
                <p className="text-muted text-sm mt-0.5">
                  {counterparty.phone || "No phone"} · {activeLoans} active loans
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={startEditing}
                className="p-2.5 rounded-xl border border-border bg-surface text-muted hover:text-primary hover:border-primary transition-all"
                title="Edit Counterparty"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              </button>
              <button
                onClick={handleDelete}
                className="p-2.5 rounded-xl border border-border bg-surface text-muted hover:text-danger hover:border-danger transition-all"
                title="Delete Counterparty"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
              <Link
                to={`/dashboard/lending/loans/new?counterparty=${counterparty.id}`}
                className="flex items-center gap-2 px-4 sm:px-5 py-2.5 text-white text-sm font-semibold rounded-xl cursor-pointer hover:opacity-90 active:opacity-90 transition-all font-inter shadow-sm"
                style={{ background: "var(--gradient-primary)" }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span className="hidden sm:inline">New Loan</span>
                <span className="sm:hidden">New</span>
              </Link>
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="bg-surface rounded-2xl border border-border p-5 space-y-4" style={{ boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-lg font-bold">Edit Counterparty</h3>
            {error && <p className="text-danger text-sm">{error}</p>}
            <div>
              <label htmlFor="editName" className="block text-sm font-medium text-muted mb-1">Name</label>
              <input
                type="text"
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full p-2 border border-border rounded-lg bg-background focus:ring-primary focus:border-primary outline-none"
              />
            </div>
            <div>
              <label htmlFor="editPhone" className="block text-sm font-medium text-muted mb-1">Phone</label>
              <input
                type="text"
                id="editPhone"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full p-2 border border-border rounded-lg bg-background focus:ring-primary focus:border-primary outline-none"
              />
            </div>
            <div>
              <label htmlFor="editNotes" className="block text-sm font-medium text-muted mb-1">Notes</label>
              <textarea
                id="editNotes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                className="w-full p-2 border border-border rounded-lg bg-background focus:ring-primary focus:border-primary outline-none"
              ></textarea>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-border bg-surface text-muted hover:bg-surface-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={updateMutation.isPending}
                className="px-4 py-2 text-sm font-semibold rounded-xl text-white bg-primary hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl p-5 text-white relative overflow-hidden border border-white/20"
            style={{ background: "var(--gradient-success)" }}>
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-white/10 -mr-4 -mt-4" />
            <p className="text-xs font-medium opacity-80 mb-1.5">Total Lent (Principal)</p>
            <p className="text-xl sm:text-2xl font-bold tabular-nums">
              ₹{totalLent.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-2xl p-5 text-white relative overflow-hidden border border-white/20"
            style={{ background: "var(--gradient-danger)" }}>
            <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-white/10 -mr-4 -mt-4" />
            <p className="text-xs font-medium opacity-80 mb-1.5">Total Borrowed (Principal)</p>
            <p className="text-xl sm:text-2xl font-bold tabular-nums">
              ₹{totalBorrowed.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-surface rounded-2xl border border-border p-5 flex flex-col justify-center"
            style={{ boxShadow: "var(--shadow-card)" }}>
            <p className="text-xs text-muted font-medium mb-1.5">Net Principal Position</p>
            <p className={`text-xl sm:text-2xl font-bold tabular-nums ${(totalLent - totalBorrowed) >= 0 ? "text-success" : "text-danger"}`}>
              {(totalLent - totalBorrowed) >= 0 ? "+" : ""}
              ₹{Math.abs(totalLent - totalBorrowed).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {counterparty.notes && (
          <div className="bg-surface rounded-2xl border border-border p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <h3 className="text-sm font-semibold mb-2">Notes</h3>
            <p className="text-sm text-muted leading-relaxed">{counterparty.notes}</p>
          </div>
        )}

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="font-bold text-lg">Loans ({loans.length})</h2>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="flex bg-background border border-border rounded-xl p-1 gap-1 flex-1 sm:flex-initial">
                <select
                  className="bg-transparent text-xs outline-none cursor-pointer pr-1 flex-1"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                >
                  <option value="date">Start Date</option>
                  <option value="due_date">Due Date</option>
                  <option value="principal">Amount</option>
                  <option value="interest_rate">Interest Rate</option>
                  <option value="type">Type</option>
                  <option value="status">Status</option>
                </select>
                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="p-1.5 rounded-lg text-muted hover:bg-surface hover:text-primary transition-all"
                  title={sortOrder === 'asc' ? "Sort Descending" : "Sort Ascending"}
                >
                  {sortOrder === 'asc' ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" /></svg>
                  )}
                </button>
              </div>

              <div className="flex bg-surface-hover/50 p-1 rounded-xl gap-1 border border-border/50">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-surface shadow-sm text-primary' : 'text-muted hover:text-foreground'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-surface shadow-sm text-primary' : 'text-muted hover:text-foreground'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {!loans.length ? (
            <div className="bg-surface rounded-2xl border border-border border-dashed p-12 text-center">
              <p className="text-muted text-sm">No loans found for this counterparty.</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {loans.map(loan => (
                <LoanCard key={loan.id} loan={loan} />
              ))}
            </div>
          ) : (
            <div className="bg-surface rounded-2xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-surface-hover/30 border-b border-border">
                      <th className="px-6 py-4 font-semibold">Type</th>
                      <th className="px-6 py-4 font-semibold">Amount</th>
                      <th className="px-6 py-4 font-semibold">Rate</th>
                      <th className="px-6 py-4 font-semibold">Due Date</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loans.map(loan => (
                      <tr key={loan.id} className="hover:bg-surface-hover/30 transition-colors group">
                        <td className="px-6 py-4 capitalize font-medium">{loan.type}</td>
                        <td className="px-6 py-4 font-bold tabular-nums">
                          ₹{Number(loan.current_principal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 text-muted">{loan.interest_rate}%/m</td>
                        <td className="px-6 py-4 text-muted">{formatDate(loan.due_date)}</td>
                        <td className="px-6 py-4">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${loan.status === 'active' ? 'bg-success-light text-success' :
                            loan.status === 'overdue' ? 'bg-danger-light text-danger' :
                              'bg-surface-hover text-muted'
                            }`}>
                            {loan.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link to={`/dashboard/lending/loans/${loan.id}`} className="text-primary hover:text-primary-hover font-semibold transition-colors">
                            View →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </SidebarLayout>
  );
}

function LoanCard({ loan }: { loan: any }) {
  const isLent = loan.type === 'lent';
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <Link
      to={`/dashboard/lending/loans/${loan.id}`}
      className="bg-surface border border-border rounded-2xl p-5 hover:border-primary active:scale-[0.98] transition-all group block shadow-sm"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2 rounded-xl ${isLent ? 'bg-success-light text-success' : 'bg-danger-light text-danger'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isLent ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            )}
          </svg>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${loan.status === 'active' ? 'bg-success-light text-success' :
          loan.status === 'overdue' ? 'bg-danger-light text-danger' :
            'bg-surface-hover text-muted'
          }`}>
          {loan.status}
        </span>
      </div>
      <div>
        <p className="text-xs text-muted font-medium mb-1 capitalize">{loan.type}</p>
        <p className="text-xl font-bold tabular-nums">
          ₹{Number(loan.current_principal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </p>
      </div>
      <div className="mt-4 pt-4 border-t border-border/50 flex justify-between items-center text-xs">
        <span className="text-muted">Due {formatDate(loan.due_date)}</span>
        <span className="font-semibold text-primary group-hover:translate-x-1 transition-transform">View Details →</span>
      </div>
    </Link>
  );
}
