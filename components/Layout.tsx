
import React, { useState } from 'react';
import { UserRole } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole: UserRole;
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, userRole, onLogout }) => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Home', icon: 'fa-house' },
    { id: 'pos', label: 'POS', icon: 'fa-cash-register' },
    { id: 'inventory', label: 'Stock', icon: 'fa-boxes-stacked' },
    { id: 'sales', label: 'Sales', icon: 'fa-receipt' },
    { id: 'finance', label: 'Finance', icon: 'fa-chart-pie', ownerOnly: true },
    { id: 'settings', label: 'Settings', icon: 'fa-gear', ownerOnly: true },
  ];

  const filteredNavItems = navItems.filter(item => !item.ownerOnly || userRole === UserRole.OWNER);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50">
      {/* Sidebar - Desktop Only */}
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col sticky top-0 h-screen">
        <div className="p-6">
          <h1 className="text-2xl font-bold tracking-tight text-indigo-400">MobiERP</h1>
          <p className="text-slate-400 text-xs mt-1 uppercase tracking-widest">Retail Pro System</p>
        </div>

        <nav className="mt-4 px-3 space-y-1 flex-1">
          {filteredNavItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === item.id 
                  ? 'bg-indigo-600 text-white' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <i className={`fas ${item.icon} w-5 mr-3 text-center`}></i>
              {item.label === 'Home' ? 'Dashboard' : item.label === 'Stock' ? 'Inventory' : item.label}
            </button>
          ))}
          
          <div className="pt-8 pb-4">
             <div className="h-px bg-slate-800 mx-4"></div>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg text-slate-400 hover:bg-red-900/20 hover:text-red-400 transition-colors"
          >
            <i className="fas fa-sign-out-alt w-5 mr-3 text-center"></i>
            Logout
          </button>
        </nav>

        <div className="p-4">
          <div className="bg-slate-800 rounded-lg p-3 flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center font-bold">
              {userRole === UserRole.OWNER ? 'H' : 'S'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold truncate">{userRole === UserRole.OWNER ? 'Hamza' : 'Staff'}</p>
              <p className="text-[10px] text-slate-400">Owner Access</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <h1 className="text-xl font-bold text-indigo-600">MobiERP</h1>
        <div className="relative">
          <button 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"
          >
            <i className="fas fa-user-circle text-xl"></i>
          </button>
          
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-1 z-50 animate-in fade-in slide-in-from-top-2">
               <div className="px-4 py-2 border-b border-slate-50">
                  <p className="text-xs font-bold text-slate-900">{userRole}</p>
                  <p className="text-[10px] text-slate-400">Connected</p>
               </div>
               <button 
                onClick={onLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
               >
                 Logout
               </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-4 pb-24 md:pb-8 md:p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around px-2 py-2 z-40 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        {filteredNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-all ${
              activeTab === item.id 
                ? 'text-indigo-600 scale-110' 
                : 'text-slate-400'
            }`}
          >
            <i className={`fas ${item.icon} text-lg mb-1`}></i>
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
