import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useLending } from "../hooks/useLending";
import { CreateCounterpartyModal } from "@/src/components/CreateCounterpartyModal";

export default function NewLoanPage() {
  const navigate = useNavigate();
  const { useCounterparties, useCreateLoan } = useLending();
  const { data: counterparties, isLoading: isLoadingCP } = useCounterparties();
  const createMutation = useCreateLoan();

  const [error, setError] = useState<string | null>(null);
  const [isCPModalOpen, setIsCPModalOpen] = useState(false);

  const [searchParams] = useSearchParams();
  const initialCounterpartyId = searchParams.get("counterparty") || "";

  // Form fields
  const [counterpartyId, setCounterpartyId] = useState(initialCounterpartyId);
  const [principal, setPrincipal] = useState("");
  const [type, setType] = useState<'lent' | 'borrowed'>("lent");
  const [interestRate, setInterestRate] = useState("0");
  const [start_date, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [duration_months, setDurationMonths] = useState("1");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterpartyId || !principal || !start_date) {
      setError("Counterparty, principal, and start date are required.");
      return;
    }

    setError(null);
    createMutation.mutate({
      counterparty_id: counterpartyId,
      type: type,
      original_principal: parseFloat(principal),
      interest_rate: parseFloat(interestRate),
      start_date: start_date,
      duration_months: parseInt(duration_months),
    }, {
      onSuccess: () => navigate("/lending/loans"),
      onError: (err: any) => {
        console.error(err);
        setError("Failed to create loan. " + (err.response?.data?.detail || ""));
      }
    });
  };

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Issue New Loan</h1>
        <Link to="/lending/loans" className="text-sm font-medium text-muted hover:text-foreground">
          Cancel
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger/10 text-danger text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 sm:p-8 bg-surface border border-border rounded-2xl space-y-6" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted" htmlFor="type">Loan Type *</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setType('lent')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${type === 'lent' ? 'bg-success text-white' : 'bg-background border border-border text-muted'}`}
              >
                Lent To
              </button>
              <button
                type="button"
                onClick={() => setType('borrowed')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${type === 'borrowed' ? 'bg-danger text-white' : 'bg-background border border-border text-muted'}`}
              >
                Borrowed From
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted" htmlFor="counterparty">Counterparty *</label>
            <div className="flex gap-2">
              <select
                id="counterparty"
                className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                value={counterpartyId}
                onChange={(e) => setCounterpartyId(e.target.value)}
                required
              >
                <option value="" disabled>Select a counterparty</option>
                {counterparties?.map((cp) => (
                  <option key={cp.id} value={cp.id}>{cp.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsCPModalOpen(true)}
                className="p-2.5 rounded-xl bg-surface border border-border text-primary hover:bg-primary-light transition-all shadow-sm"
                title="Create New Counterparty"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            {isLoadingCP && <p className="text-[10px] text-muted ml-1">Loading counterparties...</p>}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted" htmlFor="principal">Principal Amount (₹) *</label>
            <input
              id="principal"
              type="number"
              step="0.01"
              min="0"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              placeholder="e.g. 5000.00"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted" htmlFor="interest_rate">Interest Rate (% per mo) *</label>
            <input
              id="interest_rate"
              type="number"
              step="0.1"
              min="0"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              placeholder="0.0"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted" htmlFor="start_date">Start Date *</label>
            <input
              id="start_date"
              type="date"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              value={start_date}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted" htmlFor="duration_months">Initial Duration (Months)</label>
            <input
              id="duration_months"
              type="number"
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              value={duration_months}
              onChange={(e) => setDurationMonths(e.target.value)}
            />
          </div>
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <Link to="/lending/loans" className="px-6 py-2.5 rounded-xl text-sm font-semibold text-muted hover:bg-background transition-all">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-8 py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-50 hover:opacity-90 transition-all font-bold"
            style={{ background: "var(--gradient-primary)" }}
          >
            {createMutation.isPending ? "Issuing Loan..." : "Issue Loan"}
          </button>
        </div>
      </form>

      <CreateCounterpartyModal
        isOpen={isCPModalOpen}
        onClose={() => setIsCPModalOpen(false)}
        onSuccess={(id) => setCounterpartyId(id)}
      />
    </div>
  );
}
