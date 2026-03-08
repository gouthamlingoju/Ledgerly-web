import React, { useState } from 'react';
import { useLending } from '../lending/hooks/useLending';
import { Modal } from './Modal';

interface CreateCounterpartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (cpId: string) => void;
}

export const CreateCounterpartyModal: React.FC<CreateCounterpartyModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { useCreateCounterparty } = useLending();
  const createMutation = useCreateCounterparty();
  
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const data = { 
      name: name.trim(), 
      phone: phone.trim() || undefined, 
      notes: notes.trim() || undefined 
    };

    createMutation.mutate(data, {
      onSuccess: (response) => {
        setName("");
        setPhone("");
        setNotes("");
        setError("");
        if (onSuccess) onSuccess(response.data.id);
        onClose();
      },
      onError: (err: any) => setError(err.response?.data?.detail || "Failed to create counterparty")
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Counterparty">
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
            placeholder="Details about relationship..."
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20 outline-none text-sm"
            rows={2}
          />
        </div>
        
        {error && <p className="text-danger text-xs font-bold">{error}</p>}
        
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 px-8 py-3 text-white text-sm font-bold rounded-xl disabled:opacity-50 hover:opacity-90 transition-all shadow-sm"
            style={{ background: "var(--gradient-primary)" }}
          >
            {createMutation.isPending ? "Creating..." : "Create Counterparty"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-3 bg-background border border-border text-sm font-bold rounded-xl hover:bg-surface transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
};
