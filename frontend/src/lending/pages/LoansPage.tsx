import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useLending } from "../hooks/useLending";

export default function LoansPage() {
  const { useLoans, useCounterparties } = useLending();
  const { data: loans, isLoading: isLoadingLoans } = useLoans();
  const { data: counterparties, isLoading: isLoadingCounterparties } = useCounterparties();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<'all' | 'lent' | 'borrowed'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'overdue' | 'closed'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'principal' | 'counterparty'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const isLoading = isLoadingLoans || isLoadingCounterparties;

  const cpMap = counterparties?.reduce((acc, cp) => {
    acc[cp.id] = cp.name;
    return acc;
  }, {} as Record<string, string>) || {};

  const filteredAndSortedLoans = useMemo(() => {
    if (!loans) return [];
    
    let result = [...loans];

    // Filter by type
    if (filterType !== 'all') {
      result = result.filter(l => l.type === filterType);
    }

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(l => l.status === filterStatus);
    }

    // Filter by search (case insensitive)
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => {
        const cpName = cpMap[l.counterparty_id]?.toLowerCase() || "";
        return cpName.includes(q) || l.current_principal.includes(q);
      });
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
      } else if (sortBy === 'principal') {
        comparison = Number(a.current_principal) - Number(b.current_principal);
      } else if (sortBy === 'counterparty') {
        const nameA = cpMap[a.counterparty_id] || "";
        const nameB = cpMap[b.counterparty_id] || "";
        comparison = nameA.localeCompare(nameB);
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [loans, filterType, filterStatus, searchQuery, sortBy, sortOrder, cpMap]);

  const handleExportCSV = () => {
    if (!filteredAndSortedLoans.length) return;
    
    const headers = ["Counterparty", "Type", "Principal", "Interest Rate (%)", "Due Date", "Status"];
    const rows = filteredAndSortedLoans.map(l => [
      cpMap[l.counterparty_id] || "Unknown",
      l.type,
      l.current_principal,
      l.interest_rate,
      new Date(l.due_date).toLocaleDateString(),
      l.status
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `loans_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Structured Loans</h1>
          <p className="text-muted text-sm mt-1.5">Manage incoming and outgoing term loans</p>
        </div>
        <Link
          to="/dashboard/lending/loans/new"
          className="flex items-center gap-2 px-4 sm:px-5 py-2.5 text-white text-sm font-semibold rounded-xl cursor-pointer hover:opacity-90 transition-all"
          style={{ background: "var(--gradient-primary)" }}
        >
          <span className="hidden sm:inline">New Loan</span>
          <span className="sm:hidden">New</span>
        </Link>
      </div>

      <div className="flex gap-4 border-b border-border/60 pb-1">
          <Link to="/dashboard/lending" className="font-medium text-muted hover:text-foreground pb-2 px-1">Overview</Link>
          <Link to="/dashboard/lending/counterparties" className="font-medium text-muted hover:text-foreground pb-2 px-1">Counterparties</Link>
          <Link to="/dashboard/lending/loans" className="font-semibold text-primary border-b-2 border-primary pb-2 px-1">All Loans</Link>
      </div>

      {/* Summary Stats Bar */}
      {!isLoading && loans && loans.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface border border-border p-4 rounded-2xl">
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Total Lent</p>
            <p className="text-xl font-black text-success">₹{loans.filter(l => l.type === 'lent' && l.status !== 'closed' && l.status !== 'settled').reduce((acc, l) => acc + Number(l.current_principal), 0).toLocaleString()}</p>
          </div>
          <div className="bg-surface border border-border p-4 rounded-2xl">
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Total Borrowed</p>
            <p className="text-xl font-black text-danger">₹{loans.filter(l => l.type === 'borrowed' && l.status !== 'closed' && l.status !== 'settled').reduce((acc, l) => acc + Number(l.current_principal), 0).toLocaleString()}</p>
          </div>
          <div className="bg-surface border border-border p-4 rounded-2xl">
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Overdue Loans</p>
            <p className="text-xl font-black text-danger">{loans.filter(l => l.status === 'overdue').length}</p>
          </div>
          <div className="bg-surface border border-border p-4 rounded-2xl">
            <p className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1">Active Portfolio</p>
            <p className="text-xl font-black text-primary">{loans.filter(l => l.status !== 'closed' && l.status !== 'settled').length}</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-surface border border-border p-4 rounded-2xl"  style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex flex-1 w-full sm:w-auto gap-2">
           <div className="relative flex-1 group">
             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none transition-colors group-focus-within:text-primary">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             </span>
             <input 
               type="text" 
               placeholder="Search by name or amount..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
             />
           </div>
           
           <select 
             className="bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
             value={filterType}
             onChange={(e) => setFilterType(e.target.value as any)}
           >
             <option value="all">All Types</option>
             <option value="lent">Lent</option>
             <option value="borrowed">Borrowed</option>
           </select>
        </div>

        <div className="flex w-full sm:w-auto gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
           <select 
             className="bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
             value={filterStatus}
             onChange={(e) => setFilterStatus(e.target.value as any)}
           >
             <option value="all">Any Status</option>
             <option value="active">Active</option>
             <option value="overdue">Overdue</option>
             <option value="closed">Closed</option>
           </select>

           <div className="flex bg-background border border-border rounded-xl p-1 gap-1">
             <select 
               className="bg-transparent text-xs outline-none cursor-pointer pr-1"
               value={sortBy}
               onChange={(e) => setSortBy(e.target.value as any)}
             >
               <option value="date">Date</option>
               <option value="principal">Amount</option>
               <option value="counterparty">Name</option>
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

           <div className="flex bg-background border border-border rounded-xl p-1 gap-1">
             <button 
               onClick={() => setViewMode('grid')}
               className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-surface'}`}
               title="Grid View"
             >
               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
             </button>
             <button 
               onClick={() => setViewMode('list')}
               className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-surface'}`}
               title="List View"
             >
               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
             </button>
           </div>

           <button 
             onClick={handleExportCSV}
             className="p-2 rounded-xl text-muted hover:bg-surface hover:text-primary transition-all flex items-center gap-1.5 border border-border"
             title="Export to CSV"
           >
             <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
             <span className="text-[10px] font-bold uppercase tracking-widest hidden lg:inline">Export</span>
           </button>

           {(searchQuery || filterType !== 'all' || filterStatus !== 'all') && (
             <button 
               onClick={() => {
                 setSearchQuery("");
                 setFilterType("all");
                 setFilterStatus("all");
               }}
               className="px-3 py-2 text-[10px] font-bold text-danger hover:bg-danger/5 rounded-xl transition-all uppercase tracking-widest"
             >
               Clear Filters
             </button>
           )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-10 text-center"><p className="text-muted">Loading loans...</p></div>
      ) : !filteredAndSortedLoans.length ? (
        <div className="bg-surface rounded-2xl border border-border p-14 text-center">
          <p className="font-semibold text-lg">{searchQuery ? 'No matching loans found' : 'No structured loans yet'}</p>
          <p className="text-muted text-sm mt-1.5">{searchQuery ? 'Try adjusting your search or filters' : 'Create your first term loan to start tracking'}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredAndSortedLoans.map((loan) => {
             const isLent = loan.type === 'lent';
             return (
              <Link 
                key={loan.id} 
                to={`/dashboard/lending/loans/${loan.id}`}
                className="block bg-surface rounded-2xl border border-border p-5 sm:p-6 hover:border-primary/50 transition-all hover:-translate-y-1 relative"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex justify-between items-start mb-4">
                   <div>
                     <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${isLent ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                       {isLent ? 'Lent To' : 'Borrowed From'}
                     </span>
                     <Link to={`/dashboard/lending/counterparties/${loan.counterparty_id}`} className="hover:text-primary transition-colors">
                       <h3 className="font-bold text-lg mt-2">{cpMap[loan.counterparty_id] || "Unknown"}</h3>
                     </Link>
                   </div>
                   <div className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${loan.status === 'active' ? 'bg-primary/10 text-primary' : loan.status === 'overdue' ? 'bg-danger/10 text-danger' : 'bg-gray-100 text-gray-600'}`}>
                     {loan.status}
                   </div>
                </div>
                
                <div className="space-y-2 mb-4">
                   <div className="flex justify-between text-sm">
                     <span className="text-muted text-xs">Principal</span>
                     <span className="font-bold">₹{Number(loan.current_principal).toLocaleString()}</span>
                   </div>
                   <div className="flex justify-between text-sm">
                     <span className="text-muted text-xs">Interest</span>
                     <span className="font-semibold text-xs">{Number(loan.interest_rate)}% / mo</span>
                   </div>
                   <div className="flex justify-between text-sm">
                     <span className="text-muted text-xs">Due Date</span>
                     <span className={`font-semibold text-xs ${new Date(loan.due_date) < new Date() && loan.current_principal !== '0.00' ? 'text-danger' : ''}`}>
                        {new Date(loan.due_date).toLocaleDateString()}
                     </span>
                   </div>
                </div>
              </Link>
             )
          })}
        </div>
      ) : (
        /* List View */
        <div className="bg-surface rounded-2xl border border-border overflow-hidden" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-border bg-background/50">
                  <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-muted">Counterparty</th>
                  <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-muted">Type</th>
                  <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-muted text-right">Principal</th>
                  <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-muted">Interest</th>
                  <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-muted">Due Date</th>
                  <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-muted">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredAndSortedLoans.map((loan) => {
                  const isLent = loan.type === 'lent';
                  return (
                    <tr key={loan.id} onClick={() => window.location.href = `/dashboard/lending/loans/${loan.id}`} className="hover:bg-background/40 cursor-pointer transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                         <Link 
                           to={`/dashboard/lending/counterparties/${loan.counterparty_id}`} 
                           onClick={(e) => e.stopPropagation()}
                           className="font-bold hover:text-primary transition-colors"
                         >
                           {cpMap[loan.counterparty_id] || "Unknown"}
                         </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                         <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${isLent ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                           {loan.type}
                         </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right font-black">₹{Number(loan.current_principal).toLocaleString()}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold">{Number(loan.interest_rate)}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                         <span className={new Date(loan.due_date) < new Date() && loan.current_principal !== '0.00' ? 'text-danger font-bold' : ''}>
                           {new Date(loan.due_date).toLocaleDateString()}
                         </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${loan.status === 'active' ? 'bg-primary/10 text-primary' : loan.status === 'overdue' ? 'bg-danger/10 text-danger' : 'bg-gray-100 text-gray-600'}`}>
                          {loan.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
