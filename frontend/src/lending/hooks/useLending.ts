import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lendingApi } from "../api/lendingApi";

export const useLending = () => {
  const queryClient = useQueryClient();

  // Counterparties
  const useCounterparties = () => useQuery({
    queryKey: ["lending-counterparties"],
    queryFn: () => lendingApi.getCounterparties().then(r => r.data),
  });

  const useCounterpartyDetail = (id: string) => useQuery({
    queryKey: ["counterparty-detail", id],
    queryFn: () => lendingApi.getCounterpartyDetail(id).then(r => r.data),
    enabled: !!id,
  });

  const useCreateCounterparty = () => useMutation({
    mutationFn: lendingApi.createCounterparty,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lending-counterparties"] }),
  });

  const useUpdateCounterparty = () => useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => lendingApi.updateCounterparty(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lending-counterparties"] });
      queryClient.invalidateQueries({ queryKey: ["counterparty-detail", variables.id] });
    },
  });

  const useDeleteCounterparty = () => useMutation({
    mutationFn: (id: string) => lendingApi.deleteCounterparty(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lending-counterparties"] });
      queryClient.invalidateQueries({ queryKey: ["lending-dashboard"] });
    },
  });

  // Loans
  const useLoans = () => useQuery({
    queryKey: ["lending-loans"],
    queryFn: () => lendingApi.getLoans().then(r => r.data),
  });

  const useLoan = (id: string) => useQuery({
    queryKey: ["lending-loan", id],
    queryFn: () => lendingApi.getLoanById(id).then(r => r.data),
    enabled: !!id,
  });

  const useCreateLoan = () => useMutation({
    mutationFn: lendingApi.createLoan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lending-loans"] }),
  });

  const useUpdateLoan = () => useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => lendingApi.updateLoan(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["lending-loans"] });
      queryClient.invalidateQueries({ queryKey: ["lending-loan", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["lending-dashboard"] });
    },
  });

  const useDeleteLoan = () => useMutation({
    mutationFn: (id: string) => lendingApi.deleteLoan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lending-loans"] });
      queryClient.invalidateQueries({ queryKey: ["lending-dashboard"] });
    },
  });

  // Actions
  const useRepayment = (loanId: string) => useMutation({
    mutationFn: (data: any) => lendingApi.processRepayment(loanId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lending-loan", loanId] });
      queryClient.invalidateQueries({ queryKey: ["lending-dashboard"] });
    },
  });

  const useExtension = (loanId: string) => useMutation({
    mutationFn: (data: any) => lendingApi.processExtension(loanId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lending-loan", loanId] });
      queryClient.invalidateQueries({ queryKey: ["lending-dashboard"] });
    },
  });

  const useSettlement = (loanId: string) => useMutation({
    mutationFn: (data: any) => lendingApi.processSettlement(loanId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lending-loan", loanId] });
      queryClient.invalidateQueries({ queryKey: ["lending-dashboard"] });
    },
  });

  // Transactions
  const useUpdateTransaction = (loanId?: string) => useMutation({
    mutationFn: ({ id, data }: { id: string, data: any }) => lendingApi.updateTransaction(id, data),
    onSuccess: () => {
      if (loanId) queryClient.invalidateQueries({ queryKey: ["lending-loan", loanId] });
      queryClient.invalidateQueries({ queryKey: ["lending-dashboard"] });
    },
  });

  const useDeleteTransaction = (loanId?: string) => useMutation({
    mutationFn: (id: string) => lendingApi.deleteTransaction(id),
    onSuccess: () => {
      if (loanId) queryClient.invalidateQueries({ queryKey: ["lending-loan", loanId] });
      queryClient.invalidateQueries({ queryKey: ["lending-dashboard"] });
    },
  });

  // Dashboard
  const useDashboard = () => useQuery({
    queryKey: ["lending-dashboard"],
    queryFn: () => lendingApi.getDashboardMetrics().then(r => r.data),
  });

  return {
    useCounterparties,
    useCounterpartyDetail,
    useCreateCounterparty,
    useUpdateCounterparty,
    useDeleteCounterparty,
    useLoans,
    useLoan,
    useCreateLoan,
    useUpdateLoan,
    useDeleteLoan,
    useRepayment,
    useExtension,
    useSettlement,
    useUpdateTransaction,
    useDeleteTransaction,
    useDashboard,
  };
};
