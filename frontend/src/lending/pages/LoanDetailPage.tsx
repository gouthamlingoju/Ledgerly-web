import { useParams, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useLending } from "../hooks/useLending";
import { SidebarLayout } from "../../components/SidebarLayout";
import { lendingSidebarItems } from "../../components/NavigationItems";

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    useLoan, useRepayment, useExtension, useSettlement,
    useUpdateLoan, useDeleteLoan, useUpdateTransaction, useDeleteTransaction
  } = useLending();

  const { data: loanDetail, isLoading: isLoadingLoan } = useLoan(id!);
  const repaymentMutation = useRepayment(id!);
  const extensionMutation = useExtension(id!);
  const settlementMutation = useSettlement(id!);
  const updateLoanMutation = useUpdateLoan();
  const deleteLoanMutation = useDeleteLoan();
  const updateTxMutation = useUpdateTransaction(id);
  const deleteTxMutation = useDeleteTransaction(id);

  const loan = loanDetail?.loan;
  const transactions = loanDetail?.transactions;
  const counterparty = loanDetail?.counterparty;

  const [activeTab, setActiveTab] = useState<'repayment' | 'extension' | 'settlement' | 'edit'>('repayment');
  const [amount, setAmount] = useState<string>('');
  const [rate, setRate] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isEditingTx, setIsEditingTx] = useState<any | null>(null);
  const [showExtensionModal, setShowExtensionModal] = useState(false);
  const [extIsPaid, setExtIsPaid] = useState<boolean>(false);
  const [extInterestOverride, setExtInterestOverride] = useState<string>('');
  const [extRate, setExtRate] = useState<string>('');
  const [extDuration, setExtDuration] = useState<string>('');

  const isLent = loan?.type === 'lent';

  if (isLoadingLoan) return <div className="p-10 text-center text-muted">Loading loan details...</div>;
  if (!loan) return <div className="p-10 text-center text-danger font-bold">Loan not found</div>;

  const handleRepayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    repaymentMutation.mutate({
      amount: parseFloat(amount),
      transaction_date: date,
      notes: notes || undefined
    }, {
      onSuccess: () => { setAmount(""); setNotes(""); setActiveTab('repayment'); setError(null); },
      onError: (err: any) => setError(err.response?.data?.detail || "Repayment failed")
    });
  };

  const handleSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    settlementMutation.mutate({
      settlement_amount: parseFloat(amount),
      transaction_date: date,
      notes: notes || undefined
    }, {
      onSuccess: () => { setAmount(""); setNotes(""); setActiveTab('repayment'); setError(null); },
      onError: (err: any) => setError(err.response?.data?.detail || "Settlement failed")
    });
  };

  const handleExtension = (e: React.FormEvent) => {
    e.preventDefault();
    extensionMutation.mutate({
      is_interest_paid: extIsPaid,
      accrued_interest_override: extInterestOverride ? parseFloat(extInterestOverride) : undefined,
      new_interest_rate: extRate ? parseFloat(extRate) : undefined,
      new_duration_months: extDuration ? parseInt(extDuration) : undefined,
      transaction_date: date,
      notes: notes || undefined
    }, {
      onSuccess: () => {
        setShowExtensionModal(false);
        setNotes("");
        setExtInterestOverride("");
        setExtRate("");
        setExtDuration("");
        setError(null);
      },
      onError: (err: any) => setError(err.response?.data?.detail || "Extension failed")
    });
  };

  const openExtensionModal = () => {
    if (!loan) return;

    // Calculate live interest for the default override
    const daily = (Number(loan.current_principal) * (Number(loan.interest_rate) / 100)) / 30;

    // Month-based logic for default value
    let totalEquivalentDays = 0;
    let tempDate = new Date(loan.cycle_start_date);
    const evalDate = new Date();

    while (true) {
      const nextMonth = new Date(tempDate);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      if (nextMonth <= evalDate) {
        totalEquivalentDays += 30;
        tempDate = nextMonth;
      } else {
        break;
      }
    }
    totalEquivalentDays += Math.max(0, Math.floor((evalDate.getTime() - tempDate.getTime()) / (1000 * 60 * 60 * 24)));

    const calculatedNet = Math.max(0, (daily * totalEquivalentDays) - Number(loan.interest_paid_in_cycle));

    setExtInterestOverride(calculatedNet.toFixed(2));
    setExtRate(loan.interest_rate.toString());
    setExtDuration(loan.duration_months.toString());
    setDate(new Date().toISOString().split('T')[0]);
    setShowExtensionModal(true);
  };

  const handleUpdateLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan) return;
    try {
      await updateLoanMutation.mutateAsync({
        id: loan.id,
        data: {
          original_principal: Number(amount),
          interest_rate: Number(rate),
          due_date: date,
        },
      });
      setError(null);
      setActiveTab('repayment');
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update loan");
    }
  };

  const handleDeleteLoan = () => {
    if (!window.confirm("Are you sure? This will delete the loan and ALL associated transactions permanently.")) return;
    deleteLoanMutation.mutate(id!, {
      onSuccess: () => { window.location.href = "/dashboard/lending/loans"; },
      onError: (err: any) => setError(err.response?.data?.detail || "Delete failed")
    });
  };

  const handleDeleteTransaction = (txId: string) => {
    if (!window.confirm("Delete this transaction? The loan balance will be automatically adjusted.")) return;
    deleteTxMutation.mutate(txId, {
      onError: (err: any) => setError(err.response?.data?.detail || "Delete failed")
    });
  };

  const startEditTransaction = (tx: any) => {
    setIsEditingTx(tx);
    setAmount(tx.total_amount.toString());
    setDate(tx.transaction_date);
    setNotes(tx.notes || "");
  };

  const handleUpdateTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditingTx) return;
    updateTxMutation.mutate({
      id: isEditingTx.id,
      data: {
        total_amount: parseFloat(amount),
        transaction_date: date,
        notes: notes || undefined
      }
    }, {
      onSuccess: () => { setIsEditingTx(null); setAmount(""); setNotes(""); setError(null); },
      onError: (err: any) => setError(err.response?.data?.detail || "Update failed")
    });
  };

  return (
    <SidebarLayout items={lendingSidebarItems}>
      <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto">
        <div className="flex items-center gap-4">
          <button onClick={() => window.history.length > 2 ? navigate(-1) : navigate('/dashboard/lending/loans')} className="p-2 cursor-pointer rounded-full hover:bg-surface border border-transparent hover:border-border transition-all">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Loan Details</h1>
            <p className="text-muted text-sm">{isLent ? 'Lent To' : 'Borrowed From'} {counterparty?.name || '...'}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-surface rounded-2xl border border-border p-6 sm:p-8" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex justify-between items-center mb-8 pb-4 border-b border-border/50">
                <div>
                  <p className="text-xs font-bold text-muted uppercase tracking-widest mb-1">Outstanding Principal</p>
                  <p className="text-4xl font-black text-foreground">₹{Number(loan.current_principal).toLocaleString()}</p>
                </div>
                <div className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${loan.status === 'active' ? 'bg-primary/10 text-primary' : loan.status === 'overdue' ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                  {loan.status}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-6 gap-x-4">
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Original Principal</p>
                  <p className="font-semibold text-sm">₹{Number(loan.original_principal).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Interest Rate</p>
                  <p className="font-semibold text-sm">{Number(loan.interest_rate)}% / mo</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Interest Paid</p>
                  <p className="font-semibold text-sm text-success">₹{Number(loan.total_interest_paid).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Interest Capitalized</p>
                  <p className="font-semibold text-sm text-amber-600">₹{Number(loan.total_interest_capitalized).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Start Date</p>
                  <p className="font-semibold text-sm">{new Date(loan.start_date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Due Date</p>
                  <p className={`font-semibold text-sm ${new Date(loan.due_date) < new Date() && loan.current_principal !== '0.00' ? 'text-danger' : ''}`}>
                    {new Date(loan.due_date).toLocaleDateString()}
                  </p>
                </div>

                {/* New Metrics */}
                {loan.status !== 'closed' && loan.status !== 'settled' && (
                  <>
                    <div className="pt-2 border-t border-border/30 col-span-full"></div>
                    <div>
                      <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">Accrued Interest (Live)</p>
                      <p className="font-bold text-sm text-primary">
                        ₹{(() => {
                          const daily = (Number(loan.current_principal) * (Number(loan.interest_rate) / 100)) / 30;

                          // Repeat our month-based logic for display
                          let totalEquivalentDays = 0;
                          let tempDate = new Date(loan.cycle_start_date);
                          const evalDate = new Date();

                          while (true) {
                            const nextMonth = new Date(tempDate);
                            nextMonth.setMonth(nextMonth.getMonth() + 1);
                            if (nextMonth <= evalDate) {
                              totalEquivalentDays += 30;
                              tempDate = nextMonth;
                            } else {
                              break;
                            }
                          }
                          totalEquivalentDays += Math.max(0, Math.floor((evalDate.getTime() - tempDate.getTime()) / (1000 * 60 * 60 * 24)));

                          const accruedInterest = daily * totalEquivalentDays;
                          return accruedInterest.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Expected Total returns</p>
                      <p className="font-bold text-sm text-indigo-600">
                        ₹{(() => {
                          const daily = (Number(loan.current_principal) * (Number(loan.interest_rate) / 100)) / 30;
                          const totalDays = Math.max(0, Math.ceil((new Date(loan.due_date).getTime() - new Date(loan.cycle_start_date).getTime()) / (1000 * 60 * 60 * 24)));
                          const totalExpected = Number(loan.current_principal) + (daily * totalDays);
                          return totalExpected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        })()}
                      </p>
                      <p className="text-[9px] text-muted italic">on {new Date(loan.due_date).toLocaleDateString()}</p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Action Tabs Content */}
            <div className="bg-surface rounded-2xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="flex border-b border-border">
                <button onClick={() => setActiveTab('repayment')} className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'repayment' ? 'bg-background text-primary border-b-2 border-primary' : 'text-muted hover:text-foreground'}`}>Actions</button>
                <button onClick={() => setActiveTab('settlement')} className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'settlement' ? 'bg-background text-primary border-b-2 border-primary' : 'text-muted hover:text-foreground'}`}>Final Settlement</button>
                <button onClick={() => { setActiveTab('edit'); setAmount(loan.original_principal.toString()); setRate(loan.interest_rate.toString()); setDate(loan.due_date); }} className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'edit' ? 'bg-background text-primary border-b-2 border-primary' : 'text-muted hover:text-foreground'}`}>Edit Loan</button>
              </div>

              <div className="p-6 sm:p-8 text-sm">
                {activeTab === 'repayment' && (
                  <form onSubmit={handleRepayment} className="space-y-4">
                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 mb-4">
                      <p className="font-bold flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Record Repayment
                      </p>
                      <p className="text-xs">Record a payment received from or made to the counterparty. This will reduce the outstanding principal and/or cover accrued interest.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Repayment Amount (₹)</label>
                        <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none" placeholder="0.00" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Date</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none" required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Notes (Optional)</label>
                      <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none" placeholder="e.g. Paid via UPI" />
                    </div>
                    <div className="pt-4 flex flex-wrap gap-3">
                      <button type="submit" disabled={repaymentMutation.isPending} className="px-8 py-3 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition-all disabled:opacity-50">
                        {repaymentMutation.isPending ? "Recording..." : "Record Repayment"}
                      </button>
                      <button
                        type="button"
                        onClick={openExtensionModal}
                        disabled={extensionMutation.isPending || loan.status === 'settled' || loan.status === 'closed'}
                        className="px-6 py-2.5 rounded-xl bg-background border border-border font-bold text-primary hover:bg-primary/5 transition-all disabled:opacity-50"
                      >
                        Extend Loan
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteLoan}
                        disabled={deleteLoanMutation.isPending}
                        className="px-6 py-2.5 rounded-xl bg-danger/10 text-danger border border-danger/20 font-bold hover:bg-danger/20 transition-all disabled:opacity-50"
                      >
                        Delete Loan
                      </button>
                    </div>
                  </form>
                )}

                {activeTab === 'settlement' && (
                  <form onSubmit={handleSettlement} className="space-y-4">
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 mb-4">
                      <p className="font-bold flex items-center gap-2 mb-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        Full Settlement
                      </p>
                      <p className="text-xs">Settlement marks the loan as closed regardless of the amount paid. Any difference between the settlement amount and theoretical outstanding (Principal + Interest) will be recorded as a loss or gain.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Settlement Amount (₹)</label>
                        <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none" placeholder="0.00" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Date</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none" required />
                      </div>
                    </div>
                    <button type="submit" disabled={settlementMutation.isPending} className="px-8 py-3 rounded-xl bg-success text-white font-bold hover:opacity-90 transition-all disabled:opacity-50">
                      {settlementMutation.isPending ? "Processing..." : "Confirm Full Settlement"}
                    </button>
                  </form>
                )}

                {activeTab === 'edit' && (
                  <form onSubmit={handleUpdateLoan} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Loan Amount (₹)</label>
                        <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Interest Rate (% / mo)</label>
                        <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none" required />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Due Date</label>
                        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 outline-none" required />
                      </div>
                    </div>
                    <button type="submit" disabled={updateLoanMutation.isPending} className="px-8 py-3 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition-all disabled:opacity-50">
                      {updateLoanMutation.isPending ? "Saving..." : "Save Loan Changes"}
                    </button>
                  </form>
                )}
                {error && <p className="mt-4 text-xs font-bold text-danger">{error}</p>}
              </div>
            </div>

            {/* History Card */}
            <div className="bg-surface rounded-2xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="p-6 sm:p-8 border-b border-border/50">
                <h3 className="font-bold text-lg">Transaction History</h3>
                <p className="text-xs text-muted">All disbursements, repayments, and capitalizations related to this loan.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-border bg-background/50">
                      <th className="px-6 py-3 font-bold text-[10px] uppercase tracking-widest text-muted">Date</th>
                      <th className="px-6 py-3 font-bold text-[10px] uppercase tracking-widest text-muted">Type</th>
                      <th className="px-6 py-3 font-bold text-[10px] uppercase tracking-widest text-muted">Total Amount</th>
                      <th className="px-6 py-3 font-bold text-[10px] uppercase tracking-widest text-muted">Principal</th>
                      <th className="px-6 py-3 font-bold text-[10px] uppercase tracking-widest text-muted">Interest</th>
                      <th className="px-6 py-3 font-bold text-[10px] uppercase tracking-widest text-muted text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {transactions?.map((tx) => (
                      <tr key={tx.id} className="hover:bg-background/20 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{new Date(tx.transaction_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap capitalize">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${tx.transaction_type === 'disbursement' ? 'bg-indigo-100 text-indigo-700' :
                            tx.transaction_type === 'repayment' ? 'bg-success/10 text-success' :
                              tx.transaction_type === 'capitalization' ? 'bg-amber-100 text-amber-700' :
                                'bg-muted/10 text-muted'
                            }`}>
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold">₹{Number(tx.total_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-muted">₹{Number(tx.principal_component).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-muted">₹{Number(tx.interest_component).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={() => startEditTransaction(tx)} className="text-primary hover:text-primary-dark p-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            {tx.transaction_type !== 'disbursement' && (
                              <button onClick={() => handleDeleteTransaction(tx.id)} className="text-danger hover:text-danger-dark p-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {transactions?.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-10 text-center text-muted italic">No transactions found</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-surface rounded-2xl border border-border p-6" style={{ boxShadow: "var(--shadow-card)" }}>
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                Counterparty Info
              </h3>
              {counterparty ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-0.5">Name</p>
                    <p className="text-sm font-semibold">{counterparty.name}</p>
                  </div>
                  {counterparty.phone && (
                    <div>
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-0.5">Phone</p>
                      <p className="text-sm font-semibold">{counterparty.phone}</p>
                    </div>
                  )}
                  <Link to={`/dashboard/lending/counterparties`} className="block text-xs text-primary font-bold mt-4 hover:underline">
                    View All Counterparties →
                  </Link>
                </div>
              ) : <p className="text-xs text-muted italic">Counterparty details not available</p>}
            </div>

            <div className="bg-indigo-600 rounded-2xl p-6 text-white relative overflow-hidden border border-white/20">
              <div className="relative z-10">
                <h3 className="text-lg font-black mb-1">Structured Note</h3>
                <p className="text-xs opacity-90 leading-relaxed">
                  Lending module interest is calculated monthly and capitalizes upon extension if unpaid. Always record partial payments to keep principal reduced.
                </p>
              </div>
              <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            </div>
          </div>
        </div>

        {/* Extension Modal */}
        {showExtensionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-surface w-full max-w-lg rounded-2xl border border-border p-6 sm:p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">Extension Details</h3>
                <button onClick={() => setShowExtensionModal(false)} className="text-muted hover:text-foreground">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleExtension} className="space-y-5">
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 mb-2">
                  <p className="text-xs font-bold text-primary uppercase tracking-tight mb-2">Interest Payment Status</p>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="radio" checked={extIsPaid} onChange={() => setExtIsPaid(true)} className="w-4 h-4 accent-primary" />
                      <span className={`text-sm font-semibold transition-colors ${extIsPaid ? 'text-primary' : 'text-muted group-hover:text-foreground'}`}>Interest Paid</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input type="radio" checked={!extIsPaid} onChange={() => setExtIsPaid(false)} className="w-4 h-4 accent-primary" />
                      <span className={`text-sm font-semibold transition-colors ${!extIsPaid ? 'text-primary' : 'text-muted group-hover:text-foreground'}`}>Add to Principal</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Accrued Interest (₹)</label>
                    <input type="number" step="0.01" value={extInterestOverride} onChange={(e) => setExtInterestOverride(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary/20" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Extension Date</label>
                    <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary/20" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest">New Int. Rate (% / mo)</label>
                    <input type="number" step="0.01" value={extRate} onChange={(e) => setExtRate(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary/20" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Extension Duration (Months)</label>
                    <input type="number" value={extDuration} onChange={(e) => setExtDuration(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary/20" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted uppercase tracking-widest">Extension Notes</label>
                  <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary/20" placeholder="e.g. Extended on request" />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowExtensionModal(false)} className="flex-1 px-4 py-3 rounded-xl border border-border font-bold hover:bg-muted/5 transition-all">Cancel</button>
                  <button type="submit" disabled={extensionMutation.isPending} className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-bold hover:opacity-90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20">
                    {extensionMutation.isPending ? "Processing..." : "Confirm Extension"}
                  </button>
                </div>
                {error && <p className="text-xs font-bold text-danger text-center">{error}</p>}
              </form>
            </div>
          </div>
        )}
      </div>
    </SidebarLayout>
  );
}
