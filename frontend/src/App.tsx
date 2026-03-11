import { Navigate, Route, Routes } from "react-router-dom";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardLayout from "./layouts/DashboardLayout";
import DashboardPage from "./pages/dashboard/DashboardPage";
import ContactsPage from "./pages/dashboard/ContactsPage";
import ContactDetailPage from "./pages/dashboard/ContactDetailPage";
import LedgerPage from "./pages/dashboard/LedgerPage";
import LendingDashboardPage from "./lending/pages/LendingDashboardPage";
import CounterpartiesPage from "./lending/pages/CounterpartiesPage";
import LoansPage from "./lending/pages/LoansPage";
import NewLoanPage from "./lending/pages/NewLoanPage";
import LoanDetailPage from "./lending/pages/LoanDetailPage";
import CounterpartyDetailPage from "./lending/pages/CounterpartyDetailPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<DashboardLayout />}>
        {/* Ledger Module Routes */}
        <Route path="/ledger" element={<DashboardPage />} />
        <Route path="/ledger/contacts" element={<ContactsPage />} />
        <Route path="/ledger/contacts/:id" element={<ContactDetailPage />} />
        <Route path="/ledger/transactions" element={<LedgerPage />} />

        {/* Lending Module Routes */}
        <Route path="/lending" element={<LendingDashboardPage />} />
        <Route path="/lending/counterparties" element={<CounterpartiesPage />} />
        <Route path="/lending/counterparties/:id" element={<CounterpartyDetailPage />} />
        <Route path="/lending/loans" element={<LoansPage />} />
        <Route path="/lending/loans/new" element={<NewLoanPage />} />
        <Route path="/lending/loans/:id" element={<LoanDetailPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}