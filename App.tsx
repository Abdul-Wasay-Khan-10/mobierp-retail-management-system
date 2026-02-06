
import React, { useState, useEffect } from 'react';
import { User, UserRole } from './types';
import { db } from './services/supabase-db';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Inventory from './components/Inventory';
import POS from './components/POS';
import SalesHistory from './components/SalesHistory';
import Finance from './components/Finance';
import Settings from './components/Settings';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const currentUser = db.getCurrentUser();
      if (currentUser) {
        // Verify user still exists in database
        const isValid = await db.verifyCurrentUser();
        if (isValid) {
          setUser(currentUser);
        } else {
          setLoginError('Session expired. Please log in again.');
        }
      }
    };
    checkUser();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);
    
    try {
      const loggedInUser = await db.login(loginForm.username, loginForm.password);
      if (loggedInUser) {
        db.setCurrentUser(loggedInUser);
        setUser(loggedInUser);
      } else {
        setLoginError('Invalid username or password');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    db.logout();
    setUser(null);
    setActiveTab('dashboard');
    setLoginForm({ username: '', password: '' });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
          <div className="p-8 bg-indigo-600 text-white">
            <h1 className="text-3xl font-black mb-2 tracking-tighter">MobiERP</h1>
            <p className="text-indigo-100 opacity-80 text-sm font-medium">Retail Operations Portal</p>
          </div>
          <form onSubmit={handleLogin} className="p-8 space-y-6">
            {loginError && (
              <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl border border-red-100 font-bold flex items-center">
                <i className="fas fa-circle-exclamation mr-2"></i>
                {loginError}
              </div>
            )}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Username</label>
              <input 
                required
                type="text" 
                className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl ring-1 ring-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
                placeholder="e.g. hamza"
                value={loginForm.username}
                onChange={e => setLoginForm({...loginForm, username: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Security Key</label>
              <div className="relative">
                <input 
                  required
                  type={showPassword ? "text" : "password"} 
                  className="w-full px-4 py-3.5 pr-12 bg-slate-50 border-none rounded-2xl ring-1 ring-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={e => setLoginForm({...loginForm, password: e.target.value})}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors rounded-lg hover:bg-slate-100"
                  tabIndex={-1}
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                </button>
              </div>
            </div>
            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white py-4 rounded-2xl font-black transition-all shadow-xl shadow-slate-200 flex items-center justify-center disabled:opacity-50 active:scale-[0.98]"
            >
              {isLoggingIn ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : 'Access Terminal'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      userRole={user.role} 
      onLogout={handleLogout}
    >
      {activeTab === 'dashboard' && <Dashboard onNavigate={setActiveTab} />}
      {activeTab === 'pos' && <POS />}
      {activeTab === 'inventory' && <Inventory />}
      {activeTab === 'sales' && <SalesHistory />}
      {activeTab === 'finance' && <Finance />}
      {activeTab === 'settings' && user.role === UserRole.OWNER && (
        <Settings onLogout={handleLogout} currentUser={user} />
      )}
    </Layout>
  );
};

export default App;
