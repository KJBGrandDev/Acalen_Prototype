import React from 'react';
import { AcalenProvider, useAcalen } from './context/AcalenContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PosPage } from './pages/PosPage';
import { InventoryPage } from './pages/InventoryPage';
import { RulesPage } from './pages/RulesPage';
import { ForecastsPage } from './pages/ForecastsPage';
import { ReportsPage } from './pages/ReportsPage';

const AcalenRouter: React.FC = () => {
  const { currentUser, activeTab } = useAcalen();

  if (!currentUser) {
    return <LoginPage />;
  }

  // Enforce RBAC at route boundary: Cashier can only view POS
  const effectiveTab =
    currentUser.role_name === 'CASHIER' ? 'pos' : activeTab;

  return (
    <Layout>
      {effectiveTab === 'dashboard' && <DashboardPage />}
      {effectiveTab === 'pos' && <PosPage />}
      {effectiveTab === 'inventory' && <InventoryPage />}
      {effectiveTab === 'rules' && <RulesPage />}
      {effectiveTab === 'forecasts' && <ForecastsPage />}
      {effectiveTab === 'reports' && <ReportsPage />}
    </Layout>
  );
};

export const App: React.FC = () => {
  return (
    <AcalenProvider>
      <AcalenRouter />
    </AcalenProvider>
  );
};

export default App;
