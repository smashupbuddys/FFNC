import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';

// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Goals = lazy(() => import('./pages/Goals'));
const AIChat = lazy(() => import('./pages/AIChat'));
const Sales = lazy(() => import('./pages/Sales'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Parties = lazy(() => import('./pages/Parties'));
const AddParty = lazy(() => import('./pages/AddParty'));
const PartyDetails = lazy(() => import('./pages/PartyDetails'));
const BulkEntry = lazy(() => import('./pages/BulkEntry'));
const CreditSales = lazy(() => import('./pages/CreditSales'));
const CreditSaleDetails = lazy(() => import('./pages/CreditSaleDetails'));
const Staff = lazy(() => import('./pages/Staff'));
const PendingOrders = lazy(() => import('./pages/PendingOrders'));
const Report = lazy(() => import('./pages/Report'));

// Loading component
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-pulse space-y-4">
      <div className="h-12 w-48 bg-gray-200 rounded"></div>
      <div className="h-64 w-full max-w-4xl bg-gray-200 rounded"></div>
    </div>
  </div>
);

function App() {
  return (
    <Router>
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/ai-chat" element={<AIChat />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/parties" element={<Parties />} />
            <Route path="/parties/add" element={<AddParty />} />
            <Route path="/parties/:id" element={<PartyDetails />} />
            <Route path="/bulk-entry" element={<BulkEntry />} />
            <Route path="/credit-sales" element={<CreditSales />} />
            <Route path="/credit-sales/:id" element={<CreditSaleDetails />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/pending-orders" element={<PendingOrders />} />
            <Route path="/report" element={<Report />} />
          </Routes>
        </Suspense>
      </Layout>
    </Router>
  );
}

export default App;
