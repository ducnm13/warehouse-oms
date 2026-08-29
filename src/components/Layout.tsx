import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
  activeItem: string;
  setActiveItem: (item: string) => void;
}

const Layout = ({ children, user, onLogout, activeItem, setActiveItem }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="erp-shell flex h-screen overflow-hidden bg-body">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        role={user?.role}
        onLogout={onLogout}
        activeItem={activeItem}
        setActiveItem={setActiveItem}
      />

      <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          user={user}
          setActiveItem={setActiveItem}
          onLogout={onLogout}
        />

        <main className="flex-1">
          <div className="mx-auto max-w-screen-2xl p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
