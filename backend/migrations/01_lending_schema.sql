-- Lending Management Schema
-- Manually versioned schema for Supabase PostgreSQL

-- Counterparties Table
CREATE TABLE IF NOT EXISTS lending_counterparties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Loans Table
CREATE TABLE IF NOT EXISTS lending_loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    counterparty_id UUID NOT NULL REFERENCES lending_counterparties(id),
    type TEXT NOT NULL, -- 'lent' or 'borrowed'
    original_principal NUMERIC(14,2) NOT NULL,
    current_principal NUMERIC(14,2) NOT NULL,
    interest_rate NUMERIC(14,2) NOT NULL, -- Monthly rate in percentage
    duration_days INTEGER NOT NULL DEFAULT 30,
    start_date DATE NOT NULL,
    cycle_start_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    total_interest_paid NUMERIC(14,2) DEFAULT 0,
    total_interest_capitalized NUMERIC(14,2) DEFAULT 0,
    settlement_amount NUMERIC(14,2),
    settlement_difference NUMERIC(14,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    closed_at TIMESTAMP WITH TIME ZONE
);

-- Transactions Table (Disbursements, Repayments, Extensions/Capitalizations)
CREATE TABLE IF NOT EXISTS lending_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES lending_loans(id),
    user_id UUID NOT NULL,
    transaction_type TEXT NOT NULL, -- 'disbursement', 'repayment', 'capitalization', 'settlement'
    cash_flow_direction TEXT NOT NULL, -- 'in', 'out', 'none'
    total_amount NUMERIC(14,2) NOT NULL,
    principal_component NUMERIC(14,2) NOT NULL,
    interest_component NUMERIC(14,2) NOT NULL,
    transaction_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Basic indexes for performance and RLS support
CREATE INDEX IF NOT EXISTS idx_lending_cp_user ON lending_counterparties(user_id);
CREATE INDEX IF NOT EXISTS idx_lending_loans_user ON lending_loans(user_id);
CREATE INDEX IF NOT EXISTS idx_lending_trans_user ON lending_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_lending_trans_loan ON lending_transactions(loan_id);
