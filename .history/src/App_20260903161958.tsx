import React, { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Profile from './components/Profile';
import Login from './pages/Login';
import Transactions from './pages/Transactions';
import Stocktake from "./pages/Stocktake";
import Production from './pages/Production';
import Assembly from './pages/Assembly';
import Users from './pages/Users';
import Customers from './pages/Customers';
import AuditLogs from './pages/AuditLogs';
import SalesOrders from './pages/SalesOrdersV1';
import WarehouseTransfers from './pages/WarehouseTransfers';
import Suppliers from './pages/Suppliers';
import PurchasesV1 from './pages/PurchasesV1';
import FinancialDashboard from './pages/FinancialDashboard';
import Debt from './pages/Debt';
import Reporting from './pages/Reporting';
import Promotions from './pages/Promotions';
import SalesReturns from './pages/SalesReturns';
import CompanySettings from './pages/CompanySettings';
import Employees from './pages/Employees';
import OpeningInventory from './pages/OpeningInventory';
import CatalogProducts from './pages/CatalogProducts';
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

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-body">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
        <p className="text-slate-500 text-sm">Đang tải...</p>
      </div>
    </div>
  );

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
      case "dashboard":        return <FinancialDashboard />;
      case "sales-orders":     return <SalesOrders />;
      case "promotions":       return <Promotions />;
      case "sales-returns":    return <SalesReturns />;
      case "customers":        return <Customers />;
      case "debt":             return <Debt />;
      case "warehouse-transfers": return <WarehouseTransfers />;
      case "purchases":        return <PurchasesV1 />;
      case "suppliers":        return <Suppliers />;
      case "transactions":     return <Transactions />;
      case "inventory-report": return <Reporting />;
      case "production":       return <Production user={user} />;
      case "assembly":         return <Assembly user={user} />;
      case "stock-take":       return <Stocktake />;
      case "catalog":          return <CatalogProducts />;
      case "opening-inventory": return <OpeningInventory />;
      case "users":            return <Users />;
      case "employees":        return <Employees />;
      case "company-settings": return <CompanySettings />;
      case "audit-logs":       return <AuditLogs />;
      case "profile":          return <Profile />;
      default:                 return <FinancialDashboard />;
    }
  };

  return (
    <>
      <Toaster position="top-right" toastOptions={{ style: { fontSize: "13px", borderRadius: "8px" } }} />
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
