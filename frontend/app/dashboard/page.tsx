"use client";

import { useQuery } from "@tanstack/react-query";
import { ledgerApi, contactsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function DashboardPage() {
    const { user } = useAuth();

    const { data: balances, isLoading: balLoading } = useQuery({
        queryKey: ["balances"],
        queryFn: () => ledgerApi.getAllBalances().then((r) => r.data),
    });

    const { data: entries, isLoading: entLoading } = useQuery({
        queryKey: ["entries"],
        queryFn: () => ledgerApi.listEntries().then((r) => r.data),
    });

    const totalOwed = balances?.reduce((sum, b) => { const v = Number(b.balance); return sum + (v > 0 ? v : 0); }, 0) ?? 0;
    const totalOwe = balances?.reduce((sum, b) => { const v = Number(b.balance); return sum + (v < 0 ? Math.abs(v) : 0); }, 0) ?? 0;
    const netBalance = totalOwed - totalOwe;
    const contactCount = balances?.length ?? 0;

    const isLoading = balLoading || entLoading;

    const displayName = user?.username || user?.email.split("@")[0] || "there";

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

    return (
        <div className="space-y-7 sm:space-y-10">
            {/* Welcome */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Hello, {displayName} 👋
                </h1>
                <p className="text-muted mt-1.5 text-sm sm:text-base">Here&apos;s your financial overview</p>
            </div>

            {/* Summary Cards — gradient backgrounds */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
                {/* You're owed */}
                <div className="rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden"
                    style={{ background: "linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%)" }}>
                    <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/10 -mr-6 -mt-6" />
                    <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-white/10 -ml-4 -mb-4" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                            <span className="text-xs sm:text-sm font-medium opacity-90">You&apos;re owed</span>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold tabular-nums">
                            {isLoading ? "—" : `₹${totalOwed.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                        </p>
                    </div>
                </div>

                {/* You owe */}
                <div className="rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden"
                    style={{ background: "linear-gradient(135deg, #ef4444 0%, #f87171 50%, #fca5a5 100%)" }}>
                    <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/10 -mr-6 -mt-6" />
                    <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-white/10 -ml-4 -mb-4" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                            <span className="text-xs sm:text-sm font-medium opacity-90">You owe</span>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold tabular-nums">
                            {isLoading ? "—" : `₹${totalOwe.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                        </p>
                    </div>
                </div>

                {/* Net balance */}
                <div className="rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden"
                    style={{ background: "linear-gradient(135deg, #6366f1 0%, #818cf8 50%, #a5b4fc 100%)" }}>
                    <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/10 -mr-6 -mt-6" />
                    <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-white/10 -ml-4 -mb-4" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                            </svg>
                            <span className="text-xs sm:text-sm font-medium opacity-90">Net balance</span>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold tabular-nums">
                            {isLoading ? "—" : `${netBalance >= 0 ? "+" : ""}₹${netBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                        </p>
                    </div>
                </div>

                {/* Contacts */}
                <div className="rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden"
                    style={{ background: "linear-gradient(135deg, #8b5cf6 0%, #a78bfa 50%, #c4b5fd 100%)" }}>
                    <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-white/10 -mr-6 -mt-6" />
                    <div className="absolute bottom-0 left-0 w-16 h-16 rounded-full bg-white/10 -ml-4 -mb-4" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <svg className="w-4 h-4 opacity-80" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <span className="text-xs sm:text-sm font-medium opacity-90">Contacts</span>
                        </div>
                        <p className="text-xl sm:text-2xl font-bold">{isLoading ? "—" : contactCount}</p>
                    </div>
                </div>
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                {/* Contact Balances */}
                <div className="bg-surface rounded-2xl border border-border overflow-hidden"
                    style={{ boxShadow: "var(--shadow-card)" }}>
                    <div className="flex justify-between items-center px-5 py-4 border-b border-border">
                        <h2 className="font-semibold text-base">Contact Balances</h2>
                        <Link href="/dashboard/contacts" className="text-xs text-primary hover:text-primary-hover font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-light active:bg-primary-light transition-all">
                            View all →
                        </Link>
                    </div>
                    <div className="divide-y divide-border">
                        {isLoading ? (
                            <div className="p-6 flex items-center justify-center gap-3">
                                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm text-muted">Loading...</span>
                            </div>
                        ) : !balances?.length ? (
                            <div className="p-10 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                    </svg>
                                </div>
                                <p className="font-semibold text-foreground">No contacts yet</p>
                                <p className="text-muted text-sm mt-1">Add your first contact to get started</p>
                                <Link href="/dashboard/contacts" className="inline-block mt-4 text-sm font-semibold text-white px-5 py-2.5 rounded-xl"
                                    style={{ background: "var(--gradient-primary)" }}>
                                    Add Contact
                                </Link>
                            </div>
                        ) : (
                            balances.slice(0, 6).map((b) => {
                                const bal = Number(b.balance);
                                return (
                                    <Link
                                        key={b.contact_id}
                                        href={`/dashboard/contacts/${b.contact_id}`}
                                        className="flex justify-between items-center px-5 py-3.5 hover:bg-surface-hover active:bg-surface-hover transition-all"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white"
                                                style={{ background: "var(--gradient-primary)" }}>
                                                {b.contact_name.slice(0, 2).toUpperCase()}
                                            </div>
                                            <span className="font-medium text-sm">{b.contact_name}</span>
                                        </div>
                                        <span className={`text-sm font-bold tabular-nums ${bal > 0 ? "text-success" : bal < 0 ? "text-danger" : "text-muted"
                                            }`}>
                                            {bal > 0 ? "+" : ""}₹{Math.abs(bal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                        </span>
                                    </Link>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Recent Transactions */}
                <div className="bg-surface rounded-2xl border border-border overflow-hidden"
                    style={{ boxShadow: "var(--shadow-card)" }}>
                    <div className="flex justify-between items-center px-5 py-4 border-b border-border">
                        <h2 className="font-semibold text-base">Recent Transactions</h2>
                        <Link href="/dashboard/ledger" className="text-xs text-primary hover:text-primary-hover font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-light active:bg-primary-light transition-all">
                            View all →
                        </Link>
                    </div>
                    <div className="divide-y divide-border">
                        {isLoading ? (
                            <div className="p-6 flex items-center justify-center gap-3">
                                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm text-muted">Loading...</span>
                            </div>
                        ) : !entries?.length ? (
                            <div className="p-10 text-center">
                                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-7 h-7 text-primary" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                    </svg>
                                </div>
                                <p className="font-semibold text-foreground">No transactions yet</p>
                                <p className="text-muted text-sm mt-1">Add your first ledger entry</p>
                                <Link href="/dashboard/ledger" className="inline-block mt-4 text-sm font-semibold text-white px-5 py-2.5 rounded-xl"
                                    style={{ background: "var(--gradient-primary)" }}>
                                    New Entry
                                </Link>
                            </div>
                        ) : (
                            entries.slice(0, 6).map((e) => (
                                <div key={e.id} className="flex justify-between items-center px-5 py-3.5">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${e.direction === "credit"
                                            ? "text-white" : "text-white"
                                            }`}
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
                                            <p className="font-semibold text-sm truncate">{e.contact_name}</p>
                                            <p className="text-xs text-muted truncate mt-0.5">
                                                {e.note || (e.direction === "credit" ? "Gave" : "Received")} · {formatDate(e.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-bold tabular-nums shrink-0 ml-3 ${e.direction === "credit" ? "text-success" : "text-danger"
                                        }`}>
                                        {e.direction === "credit" ? "+" : "-"}₹{Number(e.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
