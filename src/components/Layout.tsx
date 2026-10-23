import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import GuidedTour from './GuidedTour';
import { User } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  onLogout: () => void;
}

const Layout = ({ children, user, onLogout }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="erp-shell flex h-screen overflow-hidden bg-[#f4f7fe]">
      <Sidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        role={user?.role}
        permissions={user?.permissions}
        onLogout={onLogout}
      />

      <div className="relative flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        <Header
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          user={user}
          onLogout={onLogout}
        />

        <main className="flex-1" data-tour="main">
          <div className="mx-auto max-w-screen-2xl px-4 pb-8 pt-5 md:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
      <GuidedTour user={user} />
    </div>
  );
};

export default Layout;
