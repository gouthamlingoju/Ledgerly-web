import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useLending } from "../hooks/useLending";
import { Counterparty } from "../types";

export default function CounterpartiesPage() {
  const { useCounterparties, useCreateCounterparty, useUpdateCounterparty, useDeleteCounterparty } = useLending();
  const { data: counterparties, isLoading } = useCounterparties();
  const createMutation = useCreateCounterparty();
  const updateMutation = useUpdateCounterparty();
  const deleteMutation = useDeleteCounterparty();
  
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<'name' | 'recent'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filteredAndSortedCPs = useMemo(() => {
    if (!counterparties) return [];
    
    let result = [...counterparties];

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(cp => 
        cp.name.toLowerCase().includes(q) || 
        (cp.phone && cp.phone.toLowerCase().includes(q)) ||
        (cp.notes && cp.notes.toLowerCase().includes(q))
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'recent') {
        comparison = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [counterparties, searchQuery, sortBy, sortOrder]);

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName("");
    setPhone("");
    setNotes("");
    setError("");
  };

  const startEdit = (cp: Counterparty) => {
    setEditingId(cp.id);
    setName(cp.name);
    setPhone(cp.phone || "");
    setNotes(cp.notes || "");
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const data = { 
      name: name.trim(), 
      phone: phone.trim() || undefined, 
      notes: notes.trim() || undefined 
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data }, {
        onSuccess: () => resetForm(),
        onError: (err: any) => setError(err.response?.data?.detail || "Failed to update counterparty")
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: () => resetForm(),
        onError: (err: any) => setError(err.response?.data?.detail || "Failed to create counterparty")
      });
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Are you sure you want to delete this counterparty?")) return;
    deleteMutation.mutate(id, {
      onError: (err: any) => alert(err.response?.data?.detail || "Failed to delete counterparty")
    });
  };

  const avatarGradients = [
    "linear-gradient(135deg, #6366f1, #8b5cf6)",
    "linear-gradient(135deg, #ec4899, #f43f5e)",
    "linear-gradient(135deg, #14b8a6, #10b981)",
    "linear-gradient(135deg, #f59e0b, #f97316)",
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Counterparties</h1>
          <p className="text-muted text-sm mt-1.5">Manage individuals you lend to or borrow from</p>
        </div>
        <button
          onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
          className="flex items-center gap-2 px-4 sm:px-5 py-2.5 text-white text-sm font-semibold rounded-xl cursor-pointer shrink-0 hover:opacity-90 transition-all font-bold shadow-sm"
          style={{ background: "var(--gradient-primary)" }}
        >
          <span>{showForm ? "Cancel" : "Add Counterparty"}</span>
        </button>
      </div>

      <div className="flex gap-4 border-b border-border/60 pb-1">
          <Link to="/dashboard/lending" className="font-medium text-muted hover:text-foreground pb-2 px-1">Overview</Link>
          <Link to="/dashboard/lending/counterparties" className="font-semibold text-primary border-b-2 border-primary pb-2 px-1">Counterparties</Link>
          <Link to="/dashboard/lending/loans" className="font-medium text-muted hover:text-foreground pb-2 px-1">All Loans</Link>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-surface border border-border p-4 rounded-2xl"  style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="flex flex-1 w-full sm:w-auto gap-2">
           <div className="relative flex-1 group">
             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none transition-colors group-focus-within:text-primary">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
             </span>
             <input 
               type="text" 
               placeholder="Search counterparties..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
             />
           </div>
        </div>

        <div className="flex w-full sm:w-auto gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
           <div className="flex bg-background border border-border rounded-xl p-1 gap-1">
             <select 
               className="bg-transparent text-xs outline-none cursor-pointer pr-1"
               value={sortBy}
               onChange={(e) => setSortBy(e.target.value as any)}
             >
               <option value="name">Name</option>
               <option value="recent">Recently Added</option>
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

           {searchQuery && (
             <button 
               onClick={() => setSearchQuery("")}
               className="px-3 py-2 text-[10px] font-bold text-danger hover:bg-danger/5 rounded-xl transition-all uppercase tracking-widest"
             >
               Clear
             </button>
           )}
        </div>
      </div>

      {showForm && (
        <div className="bg-surface rounded-2xl border border-border p-6 sm:p-7" style={{ boxShadow: "var(--shadow-card)" }}>
          <h3 className="font-bold text-base mb-4">{editingId ? "Edit Counterparty" : "New Counterparty"}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">Full Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">Phone (Optional)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Details about relationship or credit history..."
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                rows={2}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-8 py-2.5 text-white text-sm font-bold rounded-xl disabled:opacity-50 hover:opacity-90 transition-all shadow-sm"
                style={{ background: "var(--gradient-primary)" }}
              >
                {editingId ? "Save Changes" : "Create Counterparty"}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2.5 bg-background border border-border text-sm font-bold rounded-xl hover:bg-surface transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
          {error && <p className="text-danger text-xs font-bold mt-3">{error}</p>}
        </div>
      )}

      {isLoading ? (
        <div className="p-10 text-center"><p className="text-muted">Loading counterparties...</p></div>
      ) : !filteredAndSortedCPs.length ? (
        <div className="bg-surface rounded-2xl border border-border p-14 text-center">
          <p className="font-bold text-lg">{searchQuery ? 'No counterparties found' : 'No counterparties yet'}</p>
          <p className="text-muted text-sm mt-1.5">{searchQuery ? 'Try adjusting your search' : 'Add a counterparty to start managing loans'}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAndSortedCPs.map((cp, idx) => {
            const gradient = avatarGradients[idx % avatarGradients.length];
            return (
              <div key={cp.id} className="bg-surface rounded-2xl border border-border p-5 relative overflow-hidden flex flex-col justify-between hover:border-primary/30 transition-all group" style={{ boxShadow: "var(--shadow-card)" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" style={{ background: gradient }}>
                    {cp.name.slice(0, 2).toUpperCase()}
                  </div>
                  <Link to={`/dashboard/lending/counterparties/${cp.id}`} className="min-w-0 flex-1 hover:text-primary transition-colors">
                    <p className="font-bold text-sm truncate">{cp.name}</p>
                    {cp.phone && <p className="text-[11px] text-muted mt-0.5 truncate">{cp.phone}</p>}
                  </Link>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                     <button onClick={() => startEdit(cp)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                     </button>
                     <button onClick={() => handleDelete(cp.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-danger transition-all">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 3H9" /></svg>
                     </button>
                  </div>
                </div>
                {cp.notes && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <p className="text-[11px] text-muted line-clamp-2 italic">“{cp.notes}”</p>
                  </div>
                )}
                {cp.status === 'inactive' && (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-gray-100 text-[9px] font-bold text-gray-500 rounded uppercase tracking-tighter">Inactive</div>
                )}
              </div>
            );
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
                  <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-muted">Phone</th>
                  <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-muted">Notes</th>
                  <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-muted text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredAndSortedCPs.map((cp, idx) => {
                  const gradient = avatarGradients[idx % avatarGradients.length];
                  return (
                    <tr key={cp.id} className="hover:bg-background/40 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: gradient }}>
                             {cp.name.slice(0, 2).toUpperCase()}
                           </div>
                           <Link to={`/dashboard/lending/counterparties/${cp.id}`} className="font-bold hover:text-primary transition-colors">{cp.name}</Link>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-muted text-xs">{cp.phone || "—"}</td>
                      <td className="px-6 py-4 truncate max-w-[200px] text-xs text-muted">{cp.notes || "—"}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end items-center gap-1">
                           <button onClick={() => startEdit(cp)} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-all">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                           </button>
                           <button onClick={() => handleDelete(cp.id)} className="p-1.5 rounded-lg hover:bg-danger/10 text-danger transition-all">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v2m3 3H9" /></svg>
                           </button>
                        </div>
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
