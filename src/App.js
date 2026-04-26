import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from './store/appStore';
import Login from './pages/LoginBrand';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Products from './pages/ProductsPro';
import Categories from './pages/CategoriesPro';
import Inventory from './pages/Inventory';
import Contacts from './pages/Contacts';
import Quotations from './pages/Quotations';
import BOM from './pages/BOMPro';
import Orders from './pages/OrdersPro';
import Inward from './pages/InwardPro';
import Reports from './pages/ReportsPro';
import Settings from './pages/Settings';
import Notifications from './pages/Notifications';
import CRM from './pages/CRM';
import Accounting from './pages/Accounting';
import HR from './pages/HR';
import { getErpName } from './utils/branding';
import { canAccessModule, canAccessSettings, getFirstAccessiblePath } from './utils/modules';
import './styles/globals.css';

function ProtectedRoute({ children, moduleId = null, adminOnly = false }) {
  const isAuthenticated = useAppStore(s => s.isAuthenticated);
  const currentUser = useAppStore(s => s.currentUser);
  const settings = useAppStore(s => s.settings);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !canAccessSettings(currentUser)) {
    return <Navigate to={getFirstAccessiblePath(currentUser, settings)} replace />;
  }

  if (moduleId && !canAccessModule(currentUser, settings, moduleId)) {
    return <Navigate to={getFirstAccessiblePath(currentUser, settings)} replace />;
  }

  return children;
}

function HomeRedirect() {
  const currentUser = useAppStore(s => s.currentUser);
  const settings = useAppStore(s => s.settings);
  const firstPath = getFirstAccessiblePath(currentUser, settings);

  if (firstPath === '/') {
    return (
      <ProtectedRoute moduleId="dashboard">
        <Dashboard />
      </ProtectedRoute>
    );
  }

  return <Navigate to={firstPath} replace />;
}

function NoAccessPage() {
  return (
    <div className="page">
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: 520, width: '100%' }}>
          <div className="card-body" style={{ padding: 32, textAlign: 'center' }}>
            <h3 style={{ marginBottom: 10 }}>No Modules Assigned</h3>
            <p className="text-secondary" style={{ lineHeight: 1.7 }}>
              Your account currently does not have any modules enabled. Contact your administrator to assign module access.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const { isAuthenticated, loadSettings, theme, settings } = useAppStore();
  
  useEffect(() => {
    loadSettings();
  }, []);
  
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const appName = getErpName(settings);
    document.title = appName;

    if (window.electronAPI?.setWindowTitle) {
      window.electronAPI.setWindowTitle(appName);
    }
  }, [settings]);

  return (
    <Router>
      <div className={`app ${theme}`}>
        <Routes>
          <Route path="/login" element={
            isAuthenticated ? <Navigate to="/" replace /> : <Login />
          } />
          <Route path="/" element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }>
            <Route index element={<HomeRedirect />} />
            <Route path="no-access" element={<NoAccessPage />} />
            <Route path="products" element={<ProtectedRoute moduleId="products"><Products /></ProtectedRoute>} />
            <Route path="categories" element={<ProtectedRoute moduleId="categories"><Categories /></ProtectedRoute>} />
            <Route path="inventory" element={<ProtectedRoute moduleId="inventory"><Inventory /></ProtectedRoute>} />
            <Route path="contacts" element={<ProtectedRoute moduleId="contacts"><Contacts /></ProtectedRoute>} />
            <Route path="quotations" element={<ProtectedRoute moduleId="crm"><Quotations /></ProtectedRoute>} />
            <Route path="bom" element={<ProtectedRoute moduleId="bom"><BOM /></ProtectedRoute>} />
            <Route path="orders" element={<ProtectedRoute moduleId="orders"><Orders /></ProtectedRoute>} />
            <Route path="inward" element={<ProtectedRoute moduleId="inward"><Inward /></ProtectedRoute>} />
            <Route path="reports" element={<ProtectedRoute moduleId="reports"><Reports /></ProtectedRoute>} />
            <Route path="notifications" element={<ProtectedRoute moduleId="notifications"><Notifications /></ProtectedRoute>} />
            <Route path="settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
            <Route path="crm" element={<ProtectedRoute moduleId="crm"><CRM /></ProtectedRoute>} />
            <Route path="accounting" element={<ProtectedRoute moduleId="accounting"><Accounting /></ProtectedRoute>} />
            <Route path="hr" element={<ProtectedRoute moduleId="hr"><HR /></ProtectedRoute>} />
            <Route path="*" element={<HomeRedirect />} />
          </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;
