
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Product, Sale, DashboardStats } from '../types';
import { db } from '../services/supabase-db';

interface DashboardProps {
  onNavigate: (tab: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const products = await db.getProducts();
        const sales = await db.getSales();

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const daily = sales
          .filter(s => s.date.startsWith(todayStr))
          .reduce((acc, s) => acc + s.total, 0);

        const weekly = sales
          .filter(s => new Date(s.date) >= lastWeek)
          .reduce((acc, s) => acc + s.total, 0);

        const totalValue = products.reduce((acc, p) => acc + p.stock * (p.cost * 1.2), 0);
        const lowStock = products.filter(p => p.stock < 5).length;
        
        const totalCapitalInvested = products.reduce((acc, p) => acc + p.stock * p.cost, 0);
        const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
        
        let costOfGoodsSold = 0;
        sales.forEach(sale => {
          sale.items.forEach(item => {
            costOfGoodsSold += item.cost * item.quantity;
          });
        });
        const grossProfit = totalRevenue - costOfGoodsSold;

        setStats({
          dailySales: daily,
          weeklySales: weekly,
          monthlySales: weekly * 4,
          totalInventoryValue: totalValue,
          lowStockCount: lowStock,
          totalCapitalInvested,
          totalRevenue,
          grossProfit
        });

        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() - (6 - i));
          const dateStr = d.toISOString().split('T')[0];
          const dayTotal = sales
            .filter(s => s.date.startsWith(dateStr))
            .reduce((acc, s) => acc + s.total, 0);
          return {
            name: d.toLocaleDateString('en-US', { weekday: 'short' }),
            sales: dayTotal
          };
        });
        setSalesData(last7Days);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!stats) return null;

  const currentDate = new Date();
  const formattedDate = currentDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6">
      <header className="mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-slate-900">Store Dashboard</h2>
        <div className="flex items-center space-x-2 text-sm text-slate-500 mt-1">
          <i className="fas fa-calendar-day text-indigo-600"></i>
          <p>{formattedDate}</p>
        </div>
      </header>

      {/* Stat Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <StatCard title={`Today (${currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`} value={`Rs ${stats.dailySales}`} icon="fa-dollar-sign" color="bg-emerald-500" />
        <StatCard title="Last 7 Days" value={`Rs ${stats.weeklySales}`} icon="fa-chart-line" color="bg-indigo-500" />
        <StatCard title="Low Stock" value={stats.lowStockCount} icon="fa-triangle-exclamation" color="bg-amber-500" />
      </div>

      {/* Financial Overview */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 text-white p-6 md:p-8 rounded-2xl shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg md:text-xl font-bold flex items-center">
              <i className="fas fa-chart-pie mr-3"></i>
              Financial Overview
            </h3>
            <p className="text-indigo-200 text-xs md:text-sm mt-1">Track your business capital & profitability</p>
          </div>
          <div className="hidden md:block w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
            <i className="fas fa-wallet text-2xl"></i>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-5 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs md:text-sm text-indigo-200 font-bold uppercase tracking-wide">Capital Invested</p>
              <i className="fas fa-sack-dollar text-indigo-300 text-lg"></i>
            </div>
            <p className="text-2xl md:text-3xl font-black">Rs {stats.totalCapitalInvested.toLocaleString()}</p>
            <p className="text-[10px] md:text-xs text-indigo-200 mt-2">Total cost of current inventory</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-5 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs md:text-sm text-indigo-200 font-bold uppercase tracking-wide">Total Revenue</p>
              <i className="fas fa-money-bill-wave text-indigo-300 text-lg"></i>
            </div>
            <p className="text-2xl md:text-3xl font-black">Rs {stats.totalRevenue.toLocaleString()}</p>
            <p className="text-[10px] md:text-xs text-indigo-200 mt-2">All-time sales earnings</p>
          </div>
          
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 md:p-5 border border-white/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs md:text-sm text-indigo-200 font-bold uppercase tracking-wide">Gross Profit</p>
              <i className="fas fa-chart-line text-emerald-300 text-lg"></i>
            </div>
            <p className={`text-2xl md:text-3xl font-black ${stats.grossProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              Rs {stats.grossProfit.toLocaleString()}
            </p>
            <p className="text-[10px] md:text-xs text-indigo-200 mt-2">
              {stats.totalRevenue > 0 ? `${((stats.grossProfit / stats.totalRevenue) * 100).toFixed(1)}% profit margin` : 'No sales yet'}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-bold mb-6 flex items-center justify-between">
          <span>Weekly Sales Volume</span>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 bg-indigo-500 rounded-full"></span>
            <span className="text-xs text-slate-400 font-normal">Gross Revenue</span>
          </div>
        </h3>
        <div className="h-64 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} dy={10} />
              <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `Rs ${val}`} />
              <Tooltip 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                formatter={(val) => [`Rs ${val}`, 'Sales']}
              />
              <Area type="monotone" dataKey="sales" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button 
          onClick={() => onNavigate('pos')}
          className="bg-slate-900 text-white p-6 rounded-xl shadow-md flex items-center justify-between hover:bg-slate-800 transition-all active:scale-[0.98] cursor-pointer"
        >
           <div className="text-left">
              <p className="text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">Quick Action</p>
              <h4 className="text-lg font-bold">New Transaction</h4>
              <p className="text-slate-400 text-sm mt-1">Ready to checkout a customer?</p>
           </div>
           <i className="fas fa-arrow-right-long text-2xl text-slate-700"></i>
        </button>
        <button 
          onClick={() => onNavigate('inventory')}
          className="bg-white p-6 rounded-xl border border-slate-200 flex items-center justify-between hover:border-indigo-300 hover:shadow-md transition-all active:scale-[0.98] cursor-pointer"
        >
           <div className="text-left">
              <p className="text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">Operational</p>
              <h4 className="text-lg font-bold text-slate-900">Inventory Status</h4>
              <p className="text-slate-500 text-sm mt-1">{stats.lowStockCount > 0 ? `${stats.lowStockCount} items need restocking.` : 'All stock levels healthy.'}</p>
           </div>
           <i className="fas fa-boxes-stacked text-2xl text-slate-100"></i>
        </button>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }: { title: string, value: string | number, icon: string, color: string }) => (
  <div className="bg-white p-3 md:p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
    <div className={`${color} w-10 h-10 md:w-12 md:h-12 rounded-lg flex items-center justify-center text-white text-lg md:text-xl shadow-lg flex-shrink-0`}>
      <i className={`fas ${icon}`}></i>
    </div>
    <div className="overflow-hidden">
      <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-wide truncate">{title}</p>
      <p className="text-lg md:text-2xl font-black text-slate-900 truncate">{value}</p>
    </div>
  </div>
);

export default Dashboard;
