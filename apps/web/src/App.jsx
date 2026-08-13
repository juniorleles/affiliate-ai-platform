import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import Login from './components/Login';
import Layout from './components/Layout';
import { getAdminKey, getAuthToken } from './api/client';

import DashboardPage from './features/affiliate-ops/DashboardPage';
import CampaignsPage from './features/google-ads/CampaignsPage';
import AlertsPage from './features/monitoring/AlertsPage';
import ProductsPage from './features/discovery/ProductsPage';
import MarketIntelPage from './features/market-intel/MarketIntelPage';
import CompetitiveIntelPage from './features/competitive-intel/CompetitiveIntelPage';
import CampaignDraftsPage from './features/google-ads/CampaignDraftsPage';
import AccountsPage from './features/google-ads/AccountsPage';
import UsersPage from './features/users/UsersPage';

export default function App() {
  const [authenticated, setAuthenticated] = useState(!!getAdminKey() || !!getAuthToken());

  if (!authenticated) {
    return <Login onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/campaigns" element={<CampaignsPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/market-intel" element={<MarketIntelPage />} />
        <Route path="/competitive-intel" element={<CompetitiveIntelPage />} />
        <Route path="/campaign-drafts" element={<CampaignDraftsPage />} />
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/users" element={<UsersPage />} />
      </Routes>
    </Layout>
  );
}
