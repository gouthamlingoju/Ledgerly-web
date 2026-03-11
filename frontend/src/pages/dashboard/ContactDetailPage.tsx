import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { contactsApi, ledgerApi } from "@/lib/api";
import { SidebarLayout } from "@/src/components/SidebarLayout";
import { ledgerSidebarItems } from "@/src/components/NavigationItems";

export default function ContactDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'direction' | 'note'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data: contact, isLoading: conLoading } = useQuery({
    queryKey: ["contact", id],
    queryFn: () => contactsApi.get(id).then((r) => r.data),
    enabled: !!id,
  });

  const { data: balance, isLoading: balLoading } = useQuery({
    queryKey: ["balance", id],
    queryFn: () => ledgerApi.getBalance(id).then((r) => r.data),
    enabled: !!id,
  });

  const { data: entries, isLoading: entLoading } = useQuery({
    queryKey: ["entries", id],
    queryFn: () => ledgerApi.listEntries(id).then((r) => r.data),
    enabled: !!id,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      ledgerApi.createEntry({
        contact_id: id,
        direction,
        amount: parseFloat(amount),
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries", id] });
      queryClient.invalidateQueries({ queryKey: ["balance", id] });
      queryClient.invalidateQueries({ queryKey: ["contact", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      setAmount("");
      setNote("");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (entryId: string) => ledgerApi.deleteEntry(entryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entries", id] });
      queryClient.invalidateQueries({ queryKey: ["balance", id] });
      queryClient.invalidateQueries({ queryKey: ["contact", id] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });

  const filteredAndSortedEntries = useMemo(() => {
    if (!entries) return [];

    let result = [...entries];

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e =>
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
      } else if (sortBy === 'direction') {
        comparison = a.direction.localeCompare(b.direction);
      } else if (sortBy === 'note') {
        comparison = (a.note || "").localeCompare(b.note || "");
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [entries, searchQuery, sortBy, sortOrder]);

  const isLoading = conLoading || balLoading || entLoading;
  const bal = Number(balance?.balance ?? 0);
  const totalCredit = Number(balance?.total_credit ?? 0);
  const totalDebit = Number(balance?.total_debit ?? 0);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  if (!id) {
    return (
      <div className="py-16 text-center text-muted">Invalid contact id.</div>
    );
  }

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

  return (
    <SidebarLayout items={ledgerSidebarItems}>
      <div className="space-y-6 sm:space-y-8">
        <div>
          <button onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/ledger/contacts')} className="inline-flex items-center gap-1.5 text-sm cursor-pointer text-muted hover:text-primary active:text-primary transition-all mb-4 px-1 py-1 -ml-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold text-white shrink-0"
                style={{ background: "var(--gradient-primary)" }}>
                {contact?.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold truncate tracking-tight">{contact?.name}</h1>
                <p className="text-muted text-sm mt-0.5">
                  {entries?.length ?? 0} transactions
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm(`Delete \"${contact?.name}\" and all their transactions?`)) {
                  contactsApi.delete(id).then(() => {
                    queryClient.invalidateQueries({ queryKey: ["contacts"] });
                    queryClient.invalidateQueries({ queryKey: ["balances"] });
                    navigate("/ledger/contacts");
                  });
                }
              }}
              className="text-muted hover:text-danger active:text-danger text-sm font-medium px-3 py-2 rounded-xl hover:bg-danger-light active:bg-danger-light transition-all cursor-pointer shrink-0"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 sm:gap-8 items-start">
          <div className="xl:col-span-1 xl:sticky xl:top-24 space-y-6 xl:order-last">
            <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-4">
              <div className="rounded-2xl p-5 text-white relative overflow-hidden border border-white/20"
                style={{ background: bal >= 0 ? "var(--gradient-success)" : "var(--gradient-danger)" }}>
                <div className="absolute top-0 right-0 w-16 h-16 rounded-full bg-white/10 -mr-4 -mt-4" />
                <p className="text-xs font-medium opacity-80 mb-1.5">Net Balance</p>
                <p className="text-xl sm:text-2xl font-bold tabular-nums">
                  {bal > 0 ? "+" : ""}₹{Math.abs(bal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs opacity-80 mt-1">
                  {bal > 0 ? "owes you" : bal < 0 ? "you owe" : "settled up"}
                </p>
              </div>
              <div className="bg-surface rounded-2xl border border-border p-4 sm:p-5"
                style={{ boxShadow: "var(--shadow-card)" }}>
                <p className="text-xs text-muted font-medium mb-1.5">Total Gave</p>
                <p className="text-lg sm:text-xl font-bold text-success tabular-nums">
                  ₹{totalCredit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-surface rounded-2xl border border-border p-4 sm:p-5"
                style={{ boxShadow: "var(--shadow-card)" }}>
                <p className="text-xs text-muted font-medium mb-1.5">Total Received</p>
                <p className="text-lg sm:text-xl font-bold text-danger tabular-nums">
                  ₹{totalDebit.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-2xl border border-border p-6 sm:p-7"
            style={{ boxShadow: "var(--shadow-card)" }}>
            <h3 className="font-semibold text-lg mb-5">New Transaction</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!amount || parseFloat(amount) <= 0) return;
                createMutation.mutate();
              }}
              className="space-y-4"
            >
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
                  ↑ Gave (Credit)
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
                  ↓ Got (Debit)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Amount (₹)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                  inputMode="decimal"
                  required
                />
                <input
                  type="text"
                  placeholder="Note (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full sm:w-auto px-6 py-3 sm:py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-50 cursor-pointer hover:opacity-90 transition-all"
                style={{ background: "var(--gradient-primary)" }}
              >
                {createMutation.isPending ? "Adding..." : "Add Transaction"}
              </button>
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
                    onClick={() => setSortBy('direction')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'direction' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-surface'}`}
                  >
                    Type
                  </button>
                  <button
                    onClick={() => setSortBy('note')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${sortBy === 'note' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-surface'}`}
                  >
                    Note
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

              <div className="relative group max-w-md">
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
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-danger hover:bg-danger/5 px-1.5 py-0.5 rounded transition-all uppercase tracking-widest"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
            <div className="divide-y divide-border">
              {!filteredAndSortedEntries.length ? (
                <div className="p-10 text-center">
                  <p className="text-muted text-sm">{searchQuery ? 'No matching transactions' : 'No transactions with this contact yet'}</p>
                </div>
              ) : (
                filteredAndSortedEntries.map((e) => (
                  <div key={e.id} className="flex items-center justify-between px-5 py-3.5 group hover:bg-surface-hover active:bg-surface-hover transition-all">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white"
                        style={{ background: e.direction === "credit" ? "var(--gradient-success)" : "var(--gradient-danger)" }}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          {e.direction === "credit" ? (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          )}
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">
                          {e.direction === "credit" ? "You gave" : "You received"}
                        </p>
                        <p className="text-xs text-muted truncate mt-0.5">
                          {e.note || "No note"} · {formatDate(e.created_at)} at {formatTime(e.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className={`text-sm font-bold tabular-nums ${e.direction === "credit" ? "text-success" : "text-danger"
                        }`}>
                        {e.direction === "credit" ? "+" : "-"}₹{Number(e.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                      <button
                        onClick={() => { if (confirm("Delete this transaction?")) deleteMutation.mutate(e.id); }}
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
    </SidebarLayout>
  );
}