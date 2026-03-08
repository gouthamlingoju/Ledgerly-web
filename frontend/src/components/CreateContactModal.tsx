import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { contactsApi } from '@/lib/api';
import { Modal } from './Modal';

interface CreateContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (contactId: string) => void;
}

export const CreateContactModal: React.FC<CreateContactModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (newName: string) => contactsApi.create(newName),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['balances'] });
      setName('');
      setError('');
      if (onSuccess) onSuccess(response.data.id);
      onClose();
    },
    onError: () => setError('Failed to create contact'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate(name.trim());
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Contact">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-muted uppercase tracking-wider ml-1">Contact Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ramesh Kumar"
            className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/20 outline-none text-sm"
            autoFocus
          />
        </div>
        
        {error && <p className="text-danger text-xs font-bold">{error}</p>}
        
        <div className="flex gap-2 pt-2">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="flex-1 px-5 py-3 text-white text-sm font-bold rounded-xl disabled:opacity-50 hover:opacity-90 transition-all shadow-sm"
            style={{ background: 'var(--gradient-primary)' }}
          >
            {createMutation.isPending ? 'Creating...' : 'Create Contact'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 bg-background border border-border text-sm font-bold rounded-xl hover:bg-surface transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
};
