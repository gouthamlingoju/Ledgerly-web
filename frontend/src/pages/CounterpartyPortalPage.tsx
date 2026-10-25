import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AxiosError } from "axios";

import { authApi, counterpartyPortalApi } from "@/lib/api";
import type { Loan, LoanDetailResponse, LoanTransaction } from "@/src/lending/types";
import { ThemeToggle } from "@/src/components/ThemeToggle";

export default function CounterpartyPortalPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [name, setName] = useState("");
  const [loans, setLoans] = useState<Loan[]>([]);
  const [selectedLoan, setSelectedLoan] = useState<LoanDetailResponse | null>(null);
  const [loanSearch, setLoanSearch] = useState("");
  const [loanType, setLoanType] = useState<"all" | "lent" | "borrowed">("all");
  const [loanStatus, setLoanStatus] = useState<"all" | "active" | "due" | "overdue" | "closed" | "settled">("active");
  const [loanSortBy, setLoanSortBy] = useState<"date" | "due_date" | "principal" | "interest_rate" | "type" | "status">("date");
  const [loanSortOrder, setLoanSortOrder] = useState<"asc" | "desc">("asc");
  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionType, setTransactionType] = useState<"all" | LoanTransaction["transaction_type"]>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [changePasswordOpen, setChangePasswordOpen] = useState(searchParams.get("changePassword") === "1");
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  const isOverdue = (loan: Loan) =>
    new Date(loan.due_date) < new Date() &&
    Number(loan.current_principal) > 0 &&
    loan.status !== "closed" &&
    loan.status !== "settled";

  const filteredLoans = useMemo(() => {
    const query = loanSearch.trim().toLowerCase();
    const filtered = loans.filter((loan) => {
      const effectiveStatus = isOverdue(loan) ? "overdue" : loan.status;
      const matchesType = loanType === "all" || loan.type === loanType;
      const matchesStatus = loanStatus === "all" ||
        (loanStatus === "active"
          ? loan.status !== "closed" && loan.status !== "settled" && Number(loan.current_principal) > 0
          : effectiveStatus === loanStatus);
      const matchesSearch = !query || [
        loan.type,
        effectiveStatus,
        loan.current_principal,
        loan.interest_rate,
        new Date(loan.start_date).toLocaleDateString("en-IN"),
        new Date(loan.due_date).toLocaleDateString("en-IN"),
      ].some((value) => String(value).toLowerCase().includes(query));
      return matchesType && matchesStatus && matchesSearch;
    });
    return filtered.sort((a, b) => {
      const statusA = isOverdue(a) ? "overdue" : a.status;
      const statusB = isOverdue(b) ? "overdue" : b.status;
      let comparison = 0;
      if (loanSortBy === "date") comparison = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      if (loanSortBy === "due_date") comparison = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      if (loanSortBy === "principal") comparison = Number(a.current_principal) - Number(b.current_principal);
      if (loanSortBy === "interest_rate") comparison = Number(a.interest_rate) - Number(b.interest_rate);
      if (loanSortBy === "type") comparison = a.type.localeCompare(b.type);
      if (loanSortBy === "status") comparison = statusA.localeCompare(statusB);
      return loanSortOrder === "desc" ? -comparison : comparison;
    });
  }, [loans, loanSearch, loanType, loanStatus, loanSortBy, loanSortOrder]);

  const filteredTransactions = useMemo(() => {
    if (!selectedLoan) return [];
    const query = transactionSearch.trim().toLowerCase();
    return selectedLoan.transactions.filter((transaction) => {
      const matchesType = transactionType === "all" || transaction.transaction_type === transactionType;
      const matchesSearch = !query || [
        transaction.transaction_type,
        transaction.total_amount,
        transaction.notes || "",
        new Date(transaction.transaction_date).toLocaleDateString("en-IN"),
      ].some((value) => String(value).toLowerCase().includes(query));
      return matchesType && matchesSearch;
    });
  }, [selectedLoan, transactionSearch, transactionType]);

  const clearLoanFilters = () => {
    setLoanSearch("");
    setLoanType("all");
    setLoanStatus("active");
  };

  const clearTransactionFilters = () => {
    setTransactionSearch("");
    setTransactionType("all");
  };

  useEffect(() => {
    if (!localStorage.getItem("counterparty_token")) {
      navigate("/login", { replace: true });
      return;
    }

    counterpartyPortalApi.me()
      .then(async (meResponse) => {
        setName(meResponse.data.name);
        setMustChangePassword(meResponse.data.must_change_password);
        setChangePasswordOpen(meResponse.data.must_change_password || searchParams.get("changePassword") === "1");
        if (!meResponse.data.must_change_password) {
          const loansResponse = await counterpartyPortalApi.loans();
          setLoans(loansResponse.data);
        }
      })
      .catch(() => {
        localStorage.removeItem("counterparty_token");
        navigate("/login", { replace: true });
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  const openLoan = async (loan: Loan) => {
    setError("");
    try {
      const response = await counterpartyPortalApi.loan(loan.id);
      setSelectedLoan(response.data);
    } catch {
      setError("Unable to load this loan.");
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordMessage("");
    setError("");
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    try {
      const response = await authApi.changeCounterpartyPassword(currentPassword, newPassword, confirmPassword);
      setPasswordMessage(response.data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setChangePasswordOpen(false);
      setMustChangePassword(false);
      const loansResponse = await counterpartyPortalApi.loans();
      setLoans(loansResponse.data);
      searchParams.delete("changePassword");
      setSearchParams(searchParams);
    } catch (err) {
      const axiosError = err as AxiosError<{ detail?: string }>;
      setError(axiosError.response?.data?.detail || "Unable to change password.");
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted">Loading your loans...</div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-surface/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted uppercase tracking-widest font-bold">Ledgerly</p>
            <h1 className="text-xl sm:text-2xl font-bold">Welcome, {name}</h1>
            <p className="text-sm text-muted">Read-only loan portal</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => { localStorage.removeItem("counterparty_token"); navigate("/login", { replace: true }); }}
              className="px-3 py-2 rounded-xl text-sm font-semibold text-muted hover:text-danger hover:bg-danger-light"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        {error && <div className="rounded-xl border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">{error}</div>}
        {passwordMessage && <div className="rounded-xl border border-success/30 bg-success-light px-4 py-3 text-sm text-success">{passwordMessage}</div>}

        {changePasswordOpen && (
          <section className="bg-surface border border-primary/30 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-bold">Change your temporary password</h2>
            <p className="text-sm text-muted mt-1 mb-5">Choose a new password before continuing.</p>
            <form onSubmit={changePassword} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input aria-label="Current password" type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="px-4 py-3 rounded-xl border border-border bg-background" required />
              <input aria-label="New password" type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="px-4 py-3 rounded-xl border border-border bg-background" minLength={6} required />
              <input aria-label="Confirm new password" type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="px-4 py-3 rounded-xl border border-border bg-background" minLength={6} required />
              <button type="submit" className="sm:col-span-3 sm:w-fit px-5 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary-hover">Change password</button>
            </form>
          </section>
        )}

        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Your loans</h2>
            <p className="text-sm text-muted">You can view your loan details and transaction history. Editing is disabled.</p>
          </div>
          {!changePasswordOpen && !mustChangePassword && (
            <button onClick={() => setChangePasswordOpen(true)} className="text-sm font-semibold text-primary hover:text-primary-hover">
              Change password
            </button>
          )}
        </div>

        {loans.length > 0 && (
          <div className="bg-surface border border-border rounded-2xl p-4 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3">
              <input
                aria-label="Search your loans"
                type="search"
                placeholder="Search loans..."
                value={loanSearch}
                onChange={(event) => setLoanSearch(event.target.value)}
                className="px-4 py-2.5 rounded-xl border border-border bg-background text-sm"
              />
              <select aria-label="Filter loans by type" value={loanType} onChange={(event) => setLoanType(event.target.value as typeof loanType)} className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm">
                <option value="all">All types</option>
                <option value="lent">Lent</option>
                <option value="borrowed">Borrowed</option>
              </select>
              <select aria-label="Filter loans by status" value={loanStatus} onChange={(event) => setLoanStatus(event.target.value as typeof loanStatus)} className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm">
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="due">Due</option>
                <option value="overdue">Overdue</option>
                <option value="closed">Closed</option>
                <option value="settled">Settled</option>
              </select>
              <div className="flex items-center gap-1 px-2 rounded-xl border border-border bg-background">
                <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-widest text-muted">Sort by</span>
                <select aria-label="Sort loans by" value={loanSortBy} onChange={(event) => setLoanSortBy(event.target.value as typeof loanSortBy)} className="px-1 py-2.5 bg-transparent text-sm">
                  <option value="date">Start date</option>
                  <option value="due_date">Due date</option>
                  <option value="principal">Amount</option>
                  <option value="interest_rate">Interest rate</option>
                  <option value="type">Type</option>
                  <option value="status">Status</option>
                </select>
                <button onClick={() => setLoanSortOrder((order) => order === "asc" ? "desc" : "asc")} className="px-1 text-muted hover:text-primary" aria-label={loanSortOrder === "asc" ? "Sort descending" : "Sort ascending"}>
                  {loanSortOrder === "asc" ? "↑" : "↓"}
                </button>
              </div>
              {(loanSearch || loanType !== "all" || loanStatus !== "active") && (
                <button onClick={clearLoanFilters} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-muted hover:text-foreground hover:bg-surface-hover">
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        {loans.length === 0 ? (
          <div className="bg-surface border border-border border-dashed rounded-2xl p-12 text-center text-muted">No loans are available.</div>
        ) : filteredLoans.length === 0 ? (
          <div className="bg-surface border border-border border-dashed rounded-2xl p-12 text-center text-muted">
            <p>No loans match your search or filters.</p>
            <button onClick={clearLoanFilters} className="mt-3 text-sm font-semibold text-primary hover:text-primary-hover">Clear filters</button>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-surface-hover/50 border-b border-border">
                  <tr>
                    <th className="px-5 py-4 text-xs uppercase tracking-widest text-muted">Type</th>
                    <th className="px-5 py-4 text-xs uppercase tracking-widest text-muted">Principal</th>
                    <th className="px-5 py-4 text-xs uppercase tracking-widest text-muted">Interest</th>
                    <th className="px-5 py-4 text-xs uppercase tracking-widest text-muted">Due date</th>
                    <th className="px-5 py-4 text-xs uppercase tracking-widest text-muted">Status</th>
                    <th className="px-5 py-4 text-xs uppercase tracking-widest text-muted text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredLoans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-surface-hover/40">
                      <td className="px-5 py-4 capitalize font-semibold">{loan.type}</td>
                      <td className="px-5 py-4 font-bold">₹{Number(loan.current_principal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="px-5 py-4 text-muted">{loan.interest_rate}% / mo</td>
                      <td className={`px-5 py-4 ${new Date(loan.due_date) < new Date() && Number(loan.current_principal) > 0 ? "text-danger font-bold" : "text-muted"}`}>
                        {new Date(loan.due_date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-5 py-4 capitalize">{loan.status}</td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => openLoan(loan)} className="text-primary font-semibold hover:text-primary-hover">View details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {selectedLoan && (
          <section className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3 mb-5">
              <div>
                <h2 className="text-lg font-bold">Transaction history</h2>
                <p className="text-sm text-muted">{selectedLoan.loan.type} loan · ₹{Number(selectedLoan.loan.current_principal).toLocaleString("en-IN", { minimumFractionDigits: 2 })} outstanding</p>
              </div>
              <button onClick={() => setSelectedLoan(null)} className="text-sm text-muted hover:text-foreground">Close</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-3 mb-4">
              <input
                aria-label="Search transactions"
                type="search"
                placeholder="Search transactions..."
                value={transactionSearch}
                onChange={(event) => setTransactionSearch(event.target.value)}
                className="px-4 py-2.5 rounded-xl border border-border bg-background text-sm"
              />
              <select aria-label="Filter transactions by type" value={transactionType} onChange={(event) => setTransactionType(event.target.value as typeof transactionType)} className="px-3 py-2.5 rounded-xl border border-border bg-background text-sm">
                <option value="all">All transaction types</option>
                <option value="disbursement">Disbursement</option>
                <option value="repayment">Repayment</option>
                <option value="capitalization">Capitalization</option>
                <option value="settlement">Settlement</option>
                <option value="adjustment">Adjustment</option>
              </select>
              {(transactionSearch || transactionType !== "all") && (
                <button onClick={clearTransactionFilters} className="px-4 py-2.5 rounded-xl text-sm font-semibold text-muted hover:text-foreground hover:bg-surface-hover">
                  Clear
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-border">
                  <tr>
                    <th className="py-3 pr-4 text-xs uppercase tracking-widest text-muted">Date</th>
                    <th className="py-3 pr-4 text-xs uppercase tracking-widest text-muted">Type</th>
                    <th className="py-3 pr-4 text-xs uppercase tracking-widest text-muted">Amount</th>
                    <th className="py-3 text-xs uppercase tracking-widest text-muted">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="py-3 pr-4">{new Date(transaction.transaction_date).toLocaleDateString("en-IN")}</td>
                      <td className="py-3 pr-4 capitalize">{transaction.transaction_type}</td>
                      <td className="py-3 pr-4 font-semibold">₹{Number(transaction.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      <td className="py-3 text-muted">{transaction.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredTransactions.length === 0 && (
              <p className="py-6 text-center text-sm text-muted">No transactions match your search or filter.</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
