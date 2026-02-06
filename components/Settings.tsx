
import React, { useState, useEffect } from 'react';
import { db } from '../services/supabase-db';
import { UserRole } from '../types';

interface SettingsProps {
  onLogout: () => void;
  currentUser: any;
}

const Settings: React.FC<SettingsProps> = ({ onLogout, currentUser }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [displayOrder, setDisplayOrder] = useState<'FIFO' | 'LIFO'>('LIFO');
  const [savingOrder, setSavingOrder] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    name: '',
    role: UserRole.STAFF
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [usersData, order] = await Promise.all([
        db.getUsers(),
        db.getInventoryDisplayOrder()
      ]);
      setUsers(usersData);
      setDisplayOrder(order);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Failed to load settings: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const usersData = await db.getUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('Failed to load users: ' + (error as Error).message);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await db.addUser(newUser);
      await loadUsers();
      setShowAddUser(false);
      setNewUser({
        username: '',
        password: '',
        name: '',
        role: UserRole.STAFF
      });
      alert('User added successfully!');
    } catch (error) {
      console.error('Error adding user:', error);
      alert('Failed to add user: ' + (error as Error).message);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (id === currentUser.id) {
      alert("You cannot delete your own account.");
      return;
    }
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }
    try {
      await db.deleteUser(id);
      await loadUsers();
      alert('User deleted successfully!');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user: ' + (error as Error).message);
    }
  };

  const handleDisplayOrderChange = async (order: 'FIFO' | 'LIFO') => {
    try {
      setSavingOrder(true);
      await db.setInventoryDisplayOrder(order);
      setDisplayOrder(order);
      alert(`Inventory display order updated to ${order}! Products will now be sorted ${order === 'FIFO' ? 'oldest first' : 'newest first'}.`);
    } catch (error) {
      console.error('Error updating display order:', error);
      alert('Failed to update display order: ' + (error as Error).message);
    } finally {
      setSavingOrder(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h2 className="text-xl md:text-2xl font-bold text-slate-900">System Settings</h2>
        <p className="text-slate-500 text-sm">Configure inventory costing, staff access, and system preferences.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Left Column - Settings & User Management */}
        <div className="lg:col-span-2 space-y-6">
          {/* Inventory Display Order */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center text-sm md:text-base">
                <i className="fas fa-sort mr-2 text-indigo-600"></i>
                Inventory Display Order
              </h3>
              <p className="text-xs text-slate-500 mt-1">Choose how products are sorted in the inventory listing</p>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {[
                  { 
                    value: 'FIFO' as const, 
                    label: 'FIFO (First In, First Out)', 
                    description: 'Show oldest products first. Products added earlier appear at the top.',
                    icon: 'fa-arrow-down-1-9'
                  },
                  { 
                    value: 'LIFO' as const, 
                    label: 'LIFO (Last In, First Out)', 
                    description: 'Show newest products first. Recently added products appear at the top.',
                    icon: 'fa-arrow-down-9-1'
                  }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => handleDisplayOrderChange(option.value)}
                    disabled={savingOrder}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      displayOrder === option.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 bg-white hover:border-indigo-300'
                    } ${savingOrder ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        displayOrder === option.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                      }`}>
                        <i className={`fas ${option.icon}`}></i>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <p className={`font-bold ${displayOrder === option.value ? 'text-indigo-900' : 'text-slate-900'}`}>
                            {option.label}
                          </p>
                          {displayOrder === option.value && (
                            <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{option.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start space-x-2">
                  <i className="fas fa-circle-info text-blue-600 mt-0.5"></i>
                  <p className="text-xs text-blue-800">
                    <strong>Sorting Only:</strong> This setting only affects the order in which products appear in the Inventory page. 
                    It does not affect sales, reports, or product values.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* User Management */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 flex items-center text-sm md:text-base">
                <i className="fas fa-users-gear mr-2 text-indigo-600"></i>
                Authorized Staff
              </h3>
              <button 
                onClick={() => setShowAddUser(true)}
                className="text-[10px] md:text-xs bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-black uppercase tracking-wider hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95"
              >
                New Account
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[500px] lg:min-w-0">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Employee</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Username</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Access</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Manage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-[10px] font-black text-indigo-600 uppercase">
                            {u.name.charAt(0)}
                          </div>
                          <span className="text-sm font-bold text-slate-900 truncate max-w-[120px]">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-mono text-slate-400">{u.username}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider ${u.role === UserRole.OWNER ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => handleDeleteUser(u.id)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-colors ${u.id === currentUser.id ? 'opacity-10 cursor-not-allowed' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}
                        >
                          <i className="fas fa-trash-can text-sm"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Profile Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h3 className="font-bold text-slate-900 mb-6 flex items-center">
              <i className="fas fa-user-circle mr-2 text-indigo-600"></i>
              Active Profile
            </h3>
            <div className="flex items-center space-x-4 mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-100">
                {currentUser.name.charAt(0)}
              </div>
              <div>
                <p className="font-black text-slate-900 leading-tight">{currentUser.name}</p>
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-0.5">@{currentUser.username}</p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="w-full bg-red-50 text-red-600 py-4 rounded-2xl font-black text-sm hover:bg-red-100 transition-all flex items-center justify-center space-x-2 active:scale-[0.98] shadow-sm"
            >
              <i className="fas fa-power-off"></i>
              <span>Close Session</span>
            </button>
          </div>
        </div>
      </div>

      {/* New Staff Modal */}
      {showAddUser && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-6 duration-300 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Create Staff Access</h3>
              <button onClick={() => setShowAddUser(false)} className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 active:scale-90 transition-all">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-5">
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Employee Name</label>
                  <input required type="text" className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all font-bold" placeholder="e.g. John Doe" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Login Username</label>
                  <input required type="text" className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="username" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Secret Key</label>
                  <div className="relative">
                    <input 
                      required 
                      type={showPassword ? "text" : "password"} 
                      className="w-full px-4 py-3.5 pr-12 bg-slate-50 border-none rounded-2xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all font-mono" 
                      placeholder="••••••••" 
                      value={newUser.password} 
                      onChange={e => setNewUser({...newUser, password: e.target.value})} 
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
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 ml-1 tracking-widest">Access Protocol</label>
                  <select className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all font-bold" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                    <option value={UserRole.STAFF}>Retail Staff (Limited)</option>
                    <option value={UserRole.OWNER}>System Owner (Full)</option>
                  </select>
                </div>
              </div>
              <div className="pt-4 flex gap-3 pb-4 sm:pb-0">
                <button type="button" onClick={() => setShowAddUser(false)} className="flex-1 px-4 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors text-sm">Discard</button>
                <button type="submit" className="flex-1 px-4 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-[0.98]">Confirm Account</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
