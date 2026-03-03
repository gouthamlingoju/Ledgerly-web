import api from "@/lib/api";
import { Counterparty, Loan, LendingDashboard, LoanTransaction } from "../types";

export const lendingApi = {
  // Counterparties
  getCounterparties: () => api.get<Counterparty[]>("/lending/counterparties"),
  createCounterparty: (data: { name: string; phone?: string; notes?: string }) => 
    api.post<Counterparty>("/lending/counterparties", data),
  updateCounterparty: (id: string, data: { name?: string; phone?: string; notes?: string; status?: string }) =>
    api.patch<Counterparty>(`/lending/counterparties/${id}`, data),
  deleteCounterparty: (id: string) =>
    api.delete(`/lending/counterparties/${id}`),
  getCounterpartyDetail: (id: string) =>
    api.get<import("../types").CounterpartyDetailResponse>(`/lending/counterparties/${id}/detail`),

  // Loans
  getLoans: () => api.get<Loan[]>("/lending/loans"),
  getLoanById: (id: string) => api.get<import("../types").LoanDetailResponse>(`/lending/loans/${id}`),
  createLoan: (data: any) => api.post<Loan>("/lending/loans", data),
  updateLoan: (id: string, data: any) => api.patch<Loan>(`/lending/loans/${id}`, data),
  deleteLoan: (id: string) => api.delete(`/lending/loans/${id}`),

  // Loan Actions
  processRepayment: (loanId: string, data: { amount: number; transaction_date: string; notes?: string }) =>
    api.post<Loan>(`/lending/loans/${loanId}/repayment`, data),
  processExtension: (loanId: string, data: { notes?: string }) =>
    api.post<Loan>(`/lending/loans/${loanId}/extend`, data),
  processSettlement: (loanId: string, data: { settlement_amount: number; transaction_date: string; notes?: string }) =>
    api.post<Loan>(`/lending/loans/${loanId}/settle`, data),

  // Transactions
  updateTransaction: (id: string, data: any) => api.patch<LoanTransaction>(`/lending/transactions/${id}`, data),
  deleteTransaction: (id: string) => api.delete(`/lending/transactions/${id}`),

  // Dashboard
  getDashboardMetrics: () => api.get<LendingDashboard>("/lending/dashboard"),
};
