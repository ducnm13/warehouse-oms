import React, { useState, useEffect, useContext } from 'react';
import { Routes, Route, Navigate, useNavigate, Outlet } from 'react-router-dom';
import { AppToaster } from './components/ui/toast';
import Layout from './components/Layout';
import Profile from './components/Profile';
import Login from './pages/Login';
import AppLoading from './components/AppLoading';
import Transactions from './pages/Transactions';
import Stocktake from "./pages/Stocktake";
import Production from './pages/Production';
import ProductionManagement from './pages/ProductionManagement';
import Assembly from './pages/Assembly';
import Users from './pages/Users';
import Roles from './pages/Roles';
import ChatBox from './pages/ChatBox';
import ChatWidget from './components/ChatWidget';
import { ConfirmProvider } from './components/ui/confirm';
import Customers from './pages/Customers';
import OnlineOrders from './pages/OnlineOrders';
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
import OpeningInventory from './pages/OpeningInventory';
import CatalogProducts from './pages/CatalogProducts';
import CatalogImport from './pages/CatalogImport';
import WarehousesManager from './pages/WarehousesManager';
import PriceBooks from './pages/PriceBooks';
import { MaintenancePage, NotFoundPage, ServerErrorPage } from './pages/ErrorPages';
import { User } from './types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: User, refreshToken?: string) => void;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextType | null>(null);

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    try {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      // Legacy login doesn't provide refreshToken, so only require token + user
      if (storedToken && storedUser) {
        if (mounted) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
        }
      }
    } catch (e) {
      console.error('Auth init error:', e);
    } finally {
      if (mounted) setLoading(false);
    }
    return () => { mounted = false; };
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setLoading(false);
    setTimeout(() => navigate('/dashboard'), 0);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

const ProtectedRoute = () => {
  const { token, loading, user, logout } = useContext(AuthContext);
  if (loading) return <AppLoading />;
  if (!token) return <Navigate to="/login" replace />;
  return (
    <Layout user={user} onLogout={logout}>
      <Outlet />
    </Layout>
  );
};

const LoginPage = () => {
  const { login } = useContext(AuthContext);
  return <Login onLogin={login} />;
};

const AppRoutes = () => {
  const { user, token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

	return (
		<>
			<AppToaster />
			<ChatWidget visible={!!token && !!user} />
			<ConfirmProvider>
			<Routes>
          <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<FinancialDashboard />} />
          <Route path="/sales-orders" element={<SalesOrders />} />
          <Route path="/promotions" element={<Promotions />} />
          <Route path="/sales-returns" element={<SalesReturns />} />
          <Route path="/customers" element={<Customers initialTab="customers" />} />
          <Route path="/online-orders" element={<OnlineOrders />} />
          <Route path="/customer-groups" element={<Customers initialTab="groups" />} />
          <Route path="/debt" element={<Debt />} />
          <Route path="/warehouse-transfers" element={<WarehouseTransfers />} />
          <Route path="/purchases" element={<PurchasesV1 />} />
          <Route path="/suppliers" element={<Suppliers />} />
          <Route path="/inventory-import" element={<Transactions initialType="IMPORT" />} />
          <Route path="/inventory-export" element={<Transactions initialType="EXPORT" />} />
          <Route path="/inventory-report" element={<Reporting />} />
          <Route path="/production" element={<Production user={user!} onNavigate={(tab) => navigate(`/${tab}`)} />} />
          <Route path="/production-mgmt" element={<ProductionManagement user={user!} onNavigate={(tab) => navigate(`/${tab}`)} />} />
          <Route path="/assembly" element={<Assembly user={user!} />} />
          <Route path="/stock-take" element={<Stocktake />} />
          <Route path="/products" element={<CatalogProducts onOpenImport={() => navigate('/catalog-import')} />} />
          <Route path="/catalog-import" element={<CatalogImport onBack={() => navigate('/products')} />} />
          <Route path="/price-books" element={<PriceBooks />} />
          <Route path="/warehouses" element={<WarehousesManager />} />
          <Route path="/opening-inventory" element={<OpeningInventory />} />
          <Route path="/users" element={<Users />} />
          <Route path="/roles" element={<Roles />} />
          <Route path="/chat" element={<ChatBox />} />
          <Route path="/company-settings" element={<CompanySettings />} />
          <Route path="/audit-logs" element={<AuditLogs />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/error-404" element={<NotFoundPage onHome={() => navigate('/dashboard')} onBack={() => navigate('/dashboard')} />} />
          <Route path="/error-500" element={<ServerErrorPage onHome={() => navigate('/dashboard')} onBack={() => navigate('/dashboard')} />} />
          <Route path="/error-503" element={<MaintenancePage onHome={() => navigate('/dashboard')} onBack={() => navigate('/dashboard')} />} />
          <Route path="*" element={<NotFoundPage onHome={() => navigate('/dashboard')} onBack={() => navigate('/dashboard')} />} />
        </Route>
      </Routes>
      </ConfirmProvider>
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}