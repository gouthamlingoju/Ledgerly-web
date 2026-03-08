export type CounterpartyStatus = "active" | "inactive";
export type LoanType = "lent" | "borrowed";
export type LoanStatus = "active" | "due" | "overdue" | "closed" | "settled";
export type TransactionType =
  | "disbursement"
  | "repayment"
  | "capitalization"
  | "settlement"
  | "adjustment";
export type CashFlowDirection = "in" | "out" | "none";

export interface Counterparty {
  id: string;
  user_id: string;
  name: string;
  phone: string | null;
  notes: string | null;
  status: CounterpartyStatus;
  created_at: string;
}

export interface Loan {
  id: string;
  user_id: string;
  counterparty_id: string;
  type: LoanType;
  original_principal: string;
  current_principal: string;
  interest_rate: string;
  duration_months: number;
  start_date: string;
  cycle_start_date: string;
  due_date: string;
  status: LoanStatus;
  total_interest_paid: string;
  total_interest_capitalized: string;
  interest_paid_in_cycle: string;
  settlement_amount: string | null;
  settlement_difference: string | null;
  created_at: string;
  closed_at: string | null;
}

export interface LoanTransaction {
  id: string;
  loan_id: string;
  user_id: string;
  transaction_type: TransactionType;
  cash_flow_direction: CashFlowDirection;
  total_amount: string;
  principal_component: string;
  interest_component: string;
  transaction_date: string;
  notes: string | null;
  created_at: string;
}

export interface LendingDashboard {
  active_lent_principal: string;
  active_borrowed_principal: string;
  accrued_lent_interest: string;
  accrued_borrowed_interest: string;
  available_liquidity: string;
}

export interface LoanDetailResponse {
  loan: Loan & { counterparty_name: string };
  transactions: LoanTransaction[];
  counterparty: Counterparty;
}

export interface CounterpartyDetailResponse {
  counterparty: Counterparty;
  loans: Loan[];
}
