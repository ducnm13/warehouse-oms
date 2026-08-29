import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Profile from './components/Profile';
import Login from './pages/Login';
import ProductList from './pages/ProductList';
import Materials from "./pages/Materials";
import MaterialTransactions from "./pages/MaterialTransactions";
import Transactions from './pages/Transactions';
import InventoryReport from './pages/InventoryReport';
import Stocktake from "./pages/Stocktake";
import Production from './pages/Production';
import ProductionReport from "./pages/ProductionReport";
import Users from './pages/Users';
import Customers from './pages/Customers';
import SalesReport from "./pages/SalesReport";
import AuditLogs from './pages/AuditLogs';
import UserGuide from './pages/UserGuide';
import SalesOrders from './pages/SalesOrdersV1';
import WarehouseTransfers from './pages/WarehouseTransfers';
import Suppliers from './pages/Suppliers';
import PurchasesV1 from './pages/PurchasesV1';
import FinancialDashboard from './pages/FinancialDashboard';
import Debt from './pages/Debt';

import { User } from './types';
import { useLocation, useNavigate } from 'react-router-dom';

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [activeItem, setActiveItem] = useState('dashboard');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const refreshToken = localStorage.getItem('refreshToken');
    if (savedUser && token && refreshToken) {
      setUser(JSON.parse(savedUser));
    } else if (token && !refreshToken) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setToken(null);
    }
    setLoading(false);
  }, [token]);

  const handleLogin = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setActiveItem('dashboard');
  };

  const handleLogout = () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) void fetch('/api/v1/auth/logout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken })
    }).catch(() => undefined);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
  };

  useEffect(() => {
    const routeToItem: Record<string, string> = { '/purchases': 'purchases' };
    const item = routeToItem[location.pathname];
    if (item && item !== activeItem) setActiveItem(item);
  }, [location.pathname]);

  const handleActiveItem = (item: string) => {
    setActiveItem(item);
    if (item === 'purchases') navigate('/purchases');
    else if (location.pathname !== '/') navigate('/');
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Đang tải...</div>;

  if (!token || !user) {
    return (
      <>
        <Toaster position="top-right" />
        <Login onLogin={handleLogin} />
      </>
    );
  }

  const renderContent = () => {
    switch (activeItem) {
      case "dashboard":
        return <FinancialDashboard />;
      case "products":
        return <ProductList />;
      case "transactions":
        return <Transactions />;
      case "sales-orders":
        return <SalesOrders />;
      case "warehouse-transfers":
        return <WarehouseTransfers />;
      case "purchases":
        return <PurchasesV1 />;
      case "suppliers":
        return <Suppliers />;
      case "debt":
        return <Debt />;
      case "materials":
        return <Materials />;
      case "material_transactions":
        return <MaterialTransactions />;
      case "inventory-report":
        return <InventoryReport />;
      case "archive":
        return <ProductList isArchive={true} />;
      case "production-report":
        return <ProductionReport />;
      case "production":
        return <Production user={user} />;
      case "customers":
        return <Customers />;
      case "users":
        return <Users />;
      case "profile":
        return <Profile />;
      case "sales-report":
        return <SalesReport />;
      case "audit-logs":
        return <AuditLogs />;
      case "user-guide":
        return <UserGuide />;
      case "stock-take":
        return <Stocktake />;
      default:
        return <div className="text-2xl font-bold">Dashboard</div>;
    }
  };

  return (
    <>
      <Toaster position="top-right" />
      <Layout
        user={user}
        onLogout={handleLogout}
        activeItem={activeItem}
        setActiveItem={handleActiveItem}
      >
        {renderContent()}
      </Layout>
    </>
  );
}
