import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { useLending } from "../hooks/useLending";

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { useLoan, useRepayment, useExtension, useSettlement } = useLending();
  
  const { data: loanDetail, isLoading: isLoadingLoan } = useLoan(id!);
  const repaymentMutation = useRepayment(id!);
  const extensionMutation = useExtension(id!);
  const settlementMutation = useSettlement(id!);

  const loan = loanDetail?.loan;
  const transactions = loanDetail?.transactions;
  const counterparty = loanDetail?.counterparty;

  const [activeTab, setActiveTab] = useState<'details' | 'repay' | 'settle'>('details');
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

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
      onSuccess: () => { setAmount(""); setNotes(""); setActiveTab('details'); },
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
      onSuccess: () => { setAmount(""); setNotes(""); setActiveTab('details'); },
      onError: (err: any) => setError(err.response?.data?.detail || "Settlement failed")
    });
  };

  const handleExtension = () => {
    if (!window.confirm("This will capitalize current accrued interest and extend the due date by the original duration. Proceed?")) return;
    extensionMutation.mutate({ notes: "Manual extension" }, {
      onError: (err: any) => setError(err.response?.data?.detail || "Extension failed")
    });
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Link to="/dashboard/lending/loans" className="p-2 rounded-full hover:bg-surface border border-transparent hover:border-border transition-all">
           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
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
               </div>
            </div>

            {/* Action Tabs Content */}
            <div className="bg-surface rounded-2xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="flex border-b border-border">
                   <button onClick={() => setActiveTab('details')} className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'details' ? 'bg-background text-primary border-b-2 border-primary' : 'text-muted hover:text-foreground'}`}>Actions</button>
                   <button onClick={() => setActiveTab('repay')} className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'repay' ? 'bg-background text-primary border-b-2 border-primary' : 'text-muted hover:text-foreground'}`}>Record Repayment</button>
                   <button onClick={() => setActiveTab('settle')} className={`flex-1 py-4 text-sm font-bold transition-all ${activeTab === 'settle' ? 'bg-background text-primary border-b-2 border-primary' : 'text-muted hover:text-foreground'}`}>Final Settlement</button>
                </div>

                <div className="p-6 sm:p-8 text-sm">
                   {activeTab === 'details' && (
                      <div className="space-y-4">
                         <p className="text-muted leading-relaxed">Choose an action to manage this loan. Repayments reduce principal or cover interest, while extensions capitalize accrued interest and push the due date forward.</p>
                         <div className="pt-4 flex flex-wrap gap-3">
                            <button 
                              onClick={handleExtension}
                              disabled={extensionMutation.isPending || loan.status === 'settled' || loan.status === 'closed'}
                              className="px-6 py-2.5 rounded-xl bg-background border border-border font-bold text-primary hover:bg-primary/5 transition-all disabled:opacity-50"
                            >
                               Extend & Capitalize
                            </button>
                         </div>
                      </div>
                   )}

                   {activeTab === 'repay' && (
                      <form onSubmit={handleRepayment} className="space-y-4">
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
                         <button type="submit" disabled={repaymentMutation.isPending} className="px-8 py-3 rounded-xl bg-primary text-white font-bold hover:opacity-90 transition-all disabled:opacity-50">
                            {repaymentMutation.isPending ? "Recording..." : "Record Repayment"}
                         </button>
                      </form>
                   )}

                   {activeTab === 'settle' && (
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
                      <th className="px-6 py-3 font-bold text-[10px] uppercase tracking-widest text-muted">Amount</th>
                      <th className="px-6 py-3 font-bold text-[10px] uppercase tracking-widest text-muted">Principal</th>
                      <th className="px-6 py-3 font-bold text-[10px] uppercase tracking-widest text-muted">Interest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {transactions?.map((tx) => (
                      <tr key={tx.id} className="hover:bg-background/20 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{new Date(tx.transaction_date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap capitalize">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            tx.transaction_type === 'disbursement' ? 'bg-indigo-100 text-indigo-700' :
                            tx.transaction_type === 'repayment' ? 'bg-success/10 text-success' :
                            tx.transaction_type === 'capitalization' ? 'bg-amber-100 text-amber-700' :
                            'bg-muted/10 text-muted'
                          }`}>
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap font-bold">₹{Number(tx.total_amount).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-muted">₹{Number(tx.principal_component).toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-muted">₹{Number(tx.interest_component).toLocaleString()}</td>
                      </tr>
                    ))}
                    {transactions?.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-muted italic">No transactions found</td>
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

            <div className="bg-indigo-600 rounded-2xl p-6 text-white relative overflow-hidden">
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
    </div>
  );
}
