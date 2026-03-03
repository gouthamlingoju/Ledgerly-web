import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { contactsApi, type Contact } from "@/lib/api";

export default function ContactsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBalance, setFilterBalance] = useState<'all' | 'owed' | 'owing' | 'settled'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'balance' | 'recent'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: () => contactsApi.list().then((r) => r.data),
  });

  const filteredAndSortedContacts = useMemo(() => {
    if (!contacts) return [];
    
    let result = [...contacts];

    // Filter by balance
    if (filterBalance !== 'all') {
      result = result.filter(c => {
        const bal = Number(c.balance);
        if (filterBalance === 'owed') return bal > 0;
        if (filterBalance === 'owing') return bal < 0;
        if (filterBalance === 'settled') return bal === 0;
        return true;
      });
    }

    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'balance') {
        comparison = Number(a.balance) - Number(b.balance);
      } else if (sortBy === 'recent') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [contacts, searchQuery, filterBalance, sortBy, sortOrder]);

  const createMutation = useMutation({
    mutationFn: (newName: string) => contactsApi.create(newName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      resetForm();
    },
    onError: () => setError("Failed to create contact"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updatedName }: { id: string; updatedName: string }) =>
      contactsApi.update(id, updatedName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
      resetForm();
    },
    onError: () => setError("Failed to update contact"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contactsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
    onError: () => setError("Failed to delete contact"),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setName("");
    setError("");
  };

  const startEdit = (contact: Contact) => {
    setEditId(contact.id);
    setName(contact.name);
    setShowForm(true);
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editId) {
      updateMutation.mutate({ id: editId, updatedName: name.trim() });
    } else {
      createMutation.mutate(name.trim());
    }
  };

  const totalOwed = contacts?.reduce((s, c) => { const v = Number(c.balance); return s + (v > 0 ? v : 0); }, 0) ?? 0;
  const totalOwe = contacts?.reduce((s, c) => { const v = Number(c.balance); return s + (v < 0 ? Math.abs(v) : 0); }, 0) ?? 0;

  const avatarGradients = [
    "linear-gradient(135deg, #6366f1, #8b5cf6)",
    "linear-gradient(135deg, #ec4899, #f43f5e)",
    "linear-gradient(135deg, #14b8a6, #10b981)",
    "linear-gradient(135deg, #f59e0b, #f97316)",
    "linear-gradient(135deg, #3b82f6, #6366f1)",
    "linear-gradient(135deg, #8b5cf6, #d946ef)",
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Contacts</h1>
          <p className="text-muted text-sm mt-1.5">
            {contacts?.length ?? 0} contacts · ₹{totalOwed.toLocaleString("en-IN", { minimumFractionDigits: 0 })} owed · ₹{totalOwe.toLocaleString("en-IN", { minimumFractionDigits: 0 })} owing
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
          <span className="hidden sm:inline">Add Contact</span>
          <span className="sm:hidden">Add</span>
        </button>
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
               placeholder="Search contacts..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-xl text-xs focus:ring-2 focus:ring-primary/20 outline-none transition-all"
             />
           </div>
           
           <select 
             className="bg-background border border-border rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-primary/20"
             value={filterBalance}
             onChange={(e) => setFilterBalance(e.target.value as any)}
           >
             <option value="all">Any Balance</option>
             <option value="owed">Owes You</option>
             <option value="owing">You Owe</option>
             <option value="settled">Settled</option>
           </select>
        </div>

        <div className="flex w-full sm:w-auto gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
           <div className="flex bg-background border border-border rounded-xl p-1 gap-1">
             <select 
               className="bg-transparent text-xs outline-none cursor-pointer pr-1"
               value={sortBy}
               onChange={(e) => setSortBy(e.target.value as any)}
             >
               <option value="name">Name</option>
               <option value="balance">Balance</option>
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

           {(searchQuery || filterBalance !== 'all') && (
             <button 
               onClick={() => {
                 setSearchQuery("");
                 setFilterBalance("all");
               }}
               className="px-3 py-2 text-[10px] font-bold text-danger hover:bg-danger/5 rounded-xl transition-all uppercase tracking-widest"
             >
               Clear
             </button>
           )}
        </div>
      </div>

      {showForm && (
        <div className="bg-surface rounded-2xl border border-border p-6 sm:p-7"
          style={{ boxShadow: "var(--shadow-card)" }}>
          <h3 className="font-semibold text-base mb-4">
            {editId ? "Edit Contact" : "New Contact"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-0 sm:flex sm:gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contact name"
              className="w-full sm:flex-1 px-4 py-3 rounded-xl border border-border bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 sm:flex-none px-5 py-3 sm:py-2.5 text-white text-sm font-semibold rounded-xl disabled:opacity-50 cursor-pointer hover:opacity-90 transition-all"
                style={{ background: "var(--gradient-primary)" }}
              >
                {editId ? "Update" : "Create"}
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
          {error && <p className="text-danger text-sm mt-3">{error}</p>}
        </div>
      )}

      {isLoading ? (
        <div className="bg-surface rounded-2xl border border-border p-14 text-center"
          style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted text-sm mt-4">Loading contacts...</p>
        </div>
      ) : !filteredAndSortedContacts.length ? (
        <div className="bg-surface rounded-2xl border border-border p-14 text-center"
          style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--gradient-primary)" }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </div>
          <p className="font-semibold text-lg">{searchQuery ? 'No matching contacts' : 'No contacts yet'}</p>
          <p className="text-muted text-sm mt-1.5">{searchQuery ? 'Try adjusting your search or filters' : 'Add a contact to start tracking transactions'}</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
          {filteredAndSortedContacts.map((contact, idx) => {
            const bal = Number(contact.balance);
            const gradient = avatarGradients[idx % avatarGradients.length];

            return (
              <Link
                key={contact.id}
                to={`/dashboard/contacts/${contact.id}`}
                className="group bg-surface rounded-2xl border border-border p-5 sm:p-6 hover:border-primary/50 transition-all hover:-translate-y-1 relative overflow-hidden flex flex-col justify-between"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-start justify-between mb-3 w-full">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                      style={{ background: gradient }}>
                      {contact.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                        {contact.name}
                      </p>
                      <p className="text-xs text-muted mt-0.5">
                        {new Date(contact.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 ml-2 text-right">
                    <button
                      onClick={(e) => { e.preventDefault(); startEdit(contact); }}
                      className="text-muted hover:text-primary p-2 rounded-lg cursor-pointer hover:bg-surface transition-all"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); if (confirm(`Delete \"${contact.name}\"?`)) deleteMutation.mutate(contact.id); }}
                      className="text-muted hover:text-danger p-2 rounded-lg cursor-pointer hover:bg-surface transition-all"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div>
                  <div className={`text-lg font-bold tabular-nums ${bal > 0 ? "text-success" : bal < 0 ? "text-danger" : "text-muted"
                    }`}>
                    {bal > 0 ? "+" : ""}₹{Math.abs(bal).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    {bal > 0 ? "owes you" : bal < 0 ? "you owe" : "settled"}
                  </p>
                </div>
              </Link>
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
                  <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-muted">Contact</th>
                  <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-muted">Created</th>
                  <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-muted text-right">Balance</th>
                  <th className="px-6 py-4 font-bold text-[10px] uppercase tracking-widest text-muted text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {filteredAndSortedContacts.map((contact, idx) => {
                  const bal = Number(contact.balance);
                  const gradient = avatarGradients[idx % avatarGradients.length];
                  return (
                    <tr key={contact.id} onClick={() => window.location.href = `/dashboard/contacts/${contact.id}`} className="hover:bg-background/40 cursor-pointer transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0" style={{ background: gradient }}>
                             {contact.name.slice(0, 2).toUpperCase()}
                           </div>
                           <span className="font-bold group-hover:text-primary transition-colors">{contact.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-muted text-xs">
                        {new Date(contact.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right font-black ${bal > 0 ? 'text-success' : bal < 0 ? 'text-danger' : 'text-muted'}`}>
                        ₹{Number(Math.abs(bal)).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex justify-end items-center gap-1">
                           <button onClick={(e) => { e.stopPropagation(); startEdit(contact); }} className="p-1.5 rounded-lg hover:bg-primary/10 text-primary transition-all">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                           </button>
                           <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete \"${contact.name}\"?`)) deleteMutation.mutate(contact.id); }} className="p-1.5 rounded-lg hover:bg-danger/10 text-danger transition-all">
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