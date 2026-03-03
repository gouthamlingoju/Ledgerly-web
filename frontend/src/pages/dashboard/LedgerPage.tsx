import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";

import { contactsApi, ledgerApi } from "@/lib/api";

export default function LedgerPage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const contactFilter = searchParams.get("contact");

  const [showForm, setShowForm] = useState(false);
  const [contactId, setContactId] = useState(contactFilter || "");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filterDirection, setFilterDirection] = useState<'all' | 'credit' | 'debit'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data: contacts } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => contactsApi.list().then((r) => r.data),
  });

  const { data: entries, isLoading } = useQuery({
    queryKey: ["entries", contactFilter],
    queryFn: () =>
      ledgerApi.listEntries(contactFilter || undefined).then((r) => r.data),
  });

  const filteredAndSortedEntries = useMemo(() => {
    if (!entries) return [];
    
    let result = [...entries];

    // Filter by contact (handled by API mostly, but good for local filtering if needed)
    // Filter by direction
    if (filterDirection !== 'all') {
      result = result.filter(e => e.direction === filterDirection);
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => 
        (e.contact_name?.toLowerCase() || "").includes(q) || 
        (e.note && e.note.toLowerCase().includes(q)) ||
        e.amount.toString().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortBy === 'amount') {
        comparison = Number(a.amount) - Number(b.amount);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [entries, searchQuery, filterDirection, sortBy, sortOrder]);

  const { data: balance } = useQuery({
    queryKey: ["balance", contactFilter],
    queryFn: () =>
      contactFilter
        ? ledgerApi.getBalance(contactFilter).then((r) => r.data)
        : null,
    enabled: !!contactFilter,
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      contact_id: string;
      direction: "credit" | "debit";
      amount: number;
      note?: string;
    }) => ledgerApi.createEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      resetForm();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || "Failed to create entry");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ledgerApi.deleteEntry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries"] });
      queryClient.invalidateQueries({ queryKey: ["balance"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setAmount("");
    setNote("");
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!contactId || isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please fill all required fields with valid values");
      return;
    }
    createMutation.mutate({
      contact_id: contactId,
      direction,
      amount: parsedAmount,
      note: note.trim() || undefined,
    });
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Ledger</h1>
          <p className="text-muted text-sm mt-1.5">
            {contactFilter && balance
              ? `Transactions with ${balance.contact_name}`
              : `${entries?.length ?? 0} total transactions`}
          </p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 sm:px-5 py-2.5 text-white text-sm font-semibold rounded-xl cursor-pointer shrink-0 hover:opacity-90 active:opacity-90 transition-all"
          style={{ background: "var(--gradient-primary)" }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          <span className="hidden sm:inline">New Entry</span>
          <span className="sm:hidden">New</span>
        </button>
      </div>

      {contactFilter && balance && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl p-4 sm:p-5 text-white relative overflow-hidden"
            style={{ background: "var(--gradient-success)" }}>
            <div className="absolute top-0 right-0 w-14 h-14 rounded-full bg-white/10 -mr-3 -mt-3" />
            <p className="text-xs font-medium opacity-80 mb-1.5">Total Gave</p>
            <p className="text-lg sm:text-xl font-bold tabular-nums">
              ₹{Number(balance.total_credit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-2xl p-4 sm:p-5 text-white relative overflow-hidden"
            style={{ background: "var(--gradient-danger)" }}>
            <div className="absolute top-0 right-0 w-14 h-14 rounded-full bg-white/10 -mr-3 -mt-3" />
            <p className="text-xs font-medium opacity-80 mb-1.5">Total Received</p>
            <p className="text-lg sm:text-xl font-bold tabular-nums">
              ₹{Number(balance.total_debit).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="rounded-2xl p-4 sm:p-5 text-white relative overflow-hidden"
            style={{ background: Number(balance.balance) >= 0 ? "var(--gradient-success)" : "var(--gradient-danger)" }}>
            <div className="absolute top-0 right-0 w-14 h-14 rounded-full bg-white/10 -mr-3 -mt-3" />
            <p className="text-xs font-medium opacity-80 mb-1.5">Net Balance</p>
            <p className="text-lg sm:text-xl font-bold tabular-nums">
              {Number(balance.balance) >= 0 ? "+" : ""}₹{Math.abs(Number(balance.balance)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8 items-start">
        <div className="xl:col-span-1 xl:sticky xl:top-24 space-y-6">
          <button
            onClick={() => setShowForm(!showForm)}
            className="w-full xl:hidden flex items-center justify-between px-4 py-3 bg-surface border border-border rounded-xl font-medium text-sm mb-4"
          >
            <span>{showForm ? "Hide Form" : "Add New Entry"}</span>
            <svg className={`w-5 h-5 transition-transform ${showForm ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div className={`bg-surface rounded-2xl border border-border p-6 sm:p-7 ${showForm ? "block" : "hidden xl:block"}`}
            style={{ boxShadow: "var(--shadow-card)" }}>
            <h3 className="font-semibold text-lg mb-5">New Ledger Entry</h3>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="bg-danger-light border border-danger/20 text-danger text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Contact</label>
                  <select
                    value={contactId}
                    onChange={(e) => setContactId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                  >
                    <option value="">Select contact...</option>
                    {contacts?.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Type</label>
                  <div className="flex rounded-xl overflow-hidden border border-border">
                    <button
                      type="button"
                      onClick={() => setDirection("credit")}
                      className={`flex-1 py-3 text-sm font-semibold cursor-pointer transition-all ${direction === "credit"
                        ? "text-white"
                        : "bg-background text-muted hover:text-foreground"
                        }`}
                      style={direction === "credit" ? { background: "var(--gradient-success)" } : undefined}
                    >
                      ↑ Gave
                    </button>
                    <button
                      type="button"
                      onClick={() => setDirection("debit")}
                      className={`flex-1 py-3 text-sm font-semibold cursor-pointer transition-all ${direction === "debit"
                        ? "text-white"
                        : "bg-background text-muted hover:text-foreground"
                        }`}
                      style={direction === "debit" ? { background: "var(--gradient-danger)" } : undefined}
                    >
                      ↓ Received
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Amount (₹)</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                    inputMode="decimal"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">Note (optional)</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Lunch payment"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 sm:flex-none px-6 py-3 sm:py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-50 cursor-pointer hover:opacity-90 transition-all"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  {createMutation.isPending ? "Saving..." : "Save Entry"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-3 sm:py-2.5 text-muted hover:text-foreground text-sm font-medium cursor-pointer rounded-xl hover:bg-surface-hover active:bg-surface-hover transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="bg-surface rounded-2xl border border-border overflow-hidden"
            style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="px-6 py-5 border-b border-border space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="font-semibold text-lg">Transaction History</h2>
                <div className="flex bg-background border border-border rounded-xl p-1 gap-1">
                  <button 
                    onClick={() => setSortBy('date')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'date' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-surface'}`}
                  >
                    Date
                  </button>
                  <button 
                    onClick={() => setSortBy('amount')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'amount' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-surface'}`}
                  >
                    Amount
                  </button>
                  <button 
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-1.5 rounded-lg text-muted hover:bg-surface hover:text-primary transition-all border-l border-border ml-1"
                    title={sortOrder === 'asc' ? "Sort Descending" : "Sort Ascending"}
                  >
                    {sortOrder === 'asc' ? (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" /></svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1 group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </span>
                  <input 
                    type="text" 
                    placeholder="Search transactions..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  />
                </div>
                <div className="flex gap-2">
                  <select 
                    className="bg-background border border-border rounded-xl px-3 py-2 text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-primary/20"
                    value={filterDirection}
                    onChange={(e) => setFilterDirection(e.target.value as any)}
                  >
                    <option value="all">All Types</option>
                    <option value="credit">Gave (Credit)</option>
                    <option value="debit">Received (Debit)</option>
                  </select>
                  {(searchQuery || filterDirection !== 'all') && (
                    <button 
                      onClick={() => { setSearchQuery(""); setFilterDirection("all"); }}
                      className="px-3 py-2 text-[10px] font-bold text-danger hover:bg-danger/5 rounded-xl transition-all uppercase tracking-widest border border-danger/20"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="divide-y divide-border">
              {isLoading ? (
                <div className="p-10 text-center">
                  <p className="text-muted text-sm">Loading transactions...</p>
                </div>
              ) : !entries?.length ? (
                <div className="p-10 text-center">
                  <p className="text-muted text-sm">{searchQuery ? 'No matching transactions' : 'No transactions yet'}</p>
                  <p className="text-muted text-sm mt-1">{searchQuery ? 'Try adjusting your filters' : 'Use the form to add a new transaction'}</p>
                </div>
              ) : (
                filteredAndSortedEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-surface-hover active:bg-surface-hover transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white"
                        style={{ background: entry.direction === "credit" ? "var(--gradient-success)" : "var(--gradient-danger)" }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          {entry.direction === "credit" ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          )}
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <Link
                            to={`/dashboard/contacts/${entry.contact_id}`}
                            className="font-semibold hover:text-primary active:text-primary transition-colors truncate"
                          >
                            {entry.contact_name}
                          </Link>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${entry.direction === "credit"
                            ? "bg-success-light text-success"
                            : "bg-danger-light text-danger"
                            }`}>
                            {entry.direction === "credit" ? "Gave" : "Received"}
                          </span>
                        </div>
                        <p className="text-xs text-muted truncate mt-0.5">
                          {entry.note || "No note"} · {formatDate(entry.created_at)} at {formatTime(entry.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={`text-sm font-bold tabular-nums ${entry.direction === "credit" ? "text-success" : "text-danger"
                        }`}>
                        {entry.direction === "credit" ? "+" : "-"}₹{Number(entry.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                      <button
                        onClick={() => { if (confirm("Delete this entry?")) deleteMutation.mutate(entry.id); }}
                        className="text-muted hover:text-danger active:text-danger sm:opacity-0 sm:group-hover:opacity-100 transition-all cursor-pointer p-2 rounded-lg hover:bg-danger-light active:bg-danger-light"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}