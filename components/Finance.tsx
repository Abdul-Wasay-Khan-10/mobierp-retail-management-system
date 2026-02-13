
import React, { useState, useEffect } from 'react';
import { Product, Sale } from '../types';
import { db } from '../services/supabase-db';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useUiLock } from './UiLock';

interface FinancialMetrics {
  capitalInvested: number;
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  profitMargin: number;
  transactionCount: number;
  avgTransactionValue: number;
}

const Finance: React.FC = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { runWithLock } = useUiLock();

  useEffect(() => {
    // Set default date range (last 30 days)
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    setEndDate(today.toISOString().split('T')[0]);
    setStartDate(thirtyDaysAgo.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      calculateMetrics();
    }
  }, [startDate, endDate]);

  const calculateMetrics = async () => {
    await runWithLock(async () => {
      try {
        setLoading(true);
        const [allProducts, allSales, categories] = await Promise.all([
          db.getProducts(),
          db.getSales(),
          db.getCategories()
        ]);

        setProducts(allProducts);
        setSales(allSales);

        // Filter sales by date range
        const filteredSales = allSales.filter(sale => {
          const saleDate = new Date(sale.date);
          const start = new Date(startDate);
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          return saleDate >= start && saleDate <= end;
        });

        // Calculate revenue
        const revenue = filteredSales.reduce((acc, s) => acc + s.total, 0);
        const transactionCount = filteredSales.length;
        const avgTransactionValue = transactionCount > 0 ? revenue / transactionCount : 0;

        // Calculate cost of goods sold
        let costOfGoodsSold = 0;
        const categorySales: { [key: string]: { revenue: number; cost: number } } = {};

        filteredSales.forEach(sale => {
          sale.items.forEach(item => {
            // Cost is already stored in sale items from Supabase
            costOfGoodsSold += item.cost * item.quantity;

            // Track by category
            const catName = item.categoryName || 'Unknown';
            if (!categorySales[catName]) {
              categorySales[catName] = { revenue: 0, cost: 0 };
            }
            categorySales[catName].revenue += item.subtotal;
            categorySales[catName].cost += item.cost * item.quantity;
          });
        });

        // Current capital invested in inventory
        const capitalInvested = allProducts.reduce((acc, p) => acc + p.stock * p.cost, 0);
        const grossProfit = revenue - costOfGoodsSold;
        const profitMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

        setMetrics({
          capitalInvested,
          revenue,
          costOfGoodsSold,
          grossProfit,
          profitMargin,
          transactionCount,
          avgTransactionValue
        });

        // Prepare category breakdown
        const breakdown = Object.entries(categorySales).map(([catName, data]) => ({
          name: catName,
          revenue: data.revenue,
          profit: data.revenue - data.cost
        })).sort((a, b) => b.revenue - a.revenue);

        setCategoryBreakdown(breakdown);
      } catch (error) {
        console.error('Error calculating metrics:', error);
      } finally {
        setLoading(false);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!metrics) return null;

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl md:text-2xl font-bold text-slate-900">Financial Reports</h2>
        <p className="text-sm text-slate-500">Analyze business performance with date range filtering.</p>
      </header>

      {/* Date Range Filter */}
      <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
          <div className="flex items-center space-x-3">
            <i className="fas fa-calendar-range text-indigo-600 text-xl"></i>
            <h3 className="font-bold text-slate-900">Date Range</h3>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="flex-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">From</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">To</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold"
              />
            </div>
            <div className="flex items-end">
              <button 
                onClick={calculateMetrics}
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-100 active:scale-95"
              >
                <i className="fas fa-magnifying-glass-chart mr-2"></i>
                Generate Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Revenue" 
          value={`Rs ${metrics.revenue.toLocaleString()}`}
          subtitle={`${metrics.transactionCount} transactions`}
          icon="fa-money-bill-wave"
          color="bg-emerald-500"
        />
        <MetricCard 
          title="Gross Profit" 
          value={`Rs ${metrics.grossProfit.toLocaleString()}`}
          subtitle={`${metrics.profitMargin.toFixed(1)}% margin`}
          icon="fa-chart-line"
          color="bg-indigo-500"
          valueColor={metrics.grossProfit >= 0 ? 'text-slate-900' : 'text-red-600'}
        />
        <MetricCard 
          title="COGS" 
          value={`Rs ${metrics.costOfGoodsSold.toLocaleString()}`}
          subtitle="Cost of goods sold"
          icon="fa-box-open"
          color="bg-amber-500"
        />
        <MetricCard 
          title="Avg Transaction" 
          value={`Rs ${metrics.avgTransactionValue.toFixed(2)}`}
          subtitle="Per sale average"
          icon="fa-receipt"
          color="bg-sky-500"
        />
      </div>

      {/* Capital Status */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 md:p-8 rounded-2xl shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold flex items-center">
              <i className="fas fa-wallet mr-3"></i>
              Current Capital Status
            </h3>
            <p className="text-slate-400 text-xs mt-1">Money invested in current inventory</p>
          </div>
        </div>
        <div className="flex items-baseline space-x-2">
          <p className="text-4xl md:text-5xl font-black">Rs {metrics.capitalInvested.toLocaleString()}</p>
          <p className="text-slate-400 text-sm">tied up in stock</p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-bold mb-1">Total Products</p>
            <p className="text-2xl font-black">{products.length}</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-bold mb-1">Total Units</p>
            <p className="text-2xl font-black">{products.reduce((acc, p) => acc + p.stock, 0)}</p>
          </div>
        </div>
      </div>

      {/* Category Performance */}
      {categoryBreakdown.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold mb-6 flex items-center">
              <i className="fas fa-chart-pie text-indigo-600 mr-3"></i>
              Revenue by Category
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="revenue"
                  >
                    {categoryBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => `Rs ${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold mb-6 flex items-center">
              <i className="fas fa-chart-bar text-emerald-600 mr-3"></i>
              Profit by Category
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="name" fontSize={11} stroke="#94A3B8" />
                  <YAxis fontSize={11} stroke="#94A3B8" tickFormatter={(val) => `Rs ${val}`} />
                  <Tooltip formatter={(val: any) => [`Rs ${val.toLocaleString()}`, 'Profit']} />
                  <Bar dataKey="profit" fill="#10B981" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 flex items-center">
            <i className="fas fa-table-list text-indigo-600 mr-3"></i>
            Category Performance Details
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Revenue</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Profit</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {categoryBreakdown.map((cat, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                      <span className="font-bold text-slate-900">{cat.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-slate-900">Rs {cat.revenue.toLocaleString()}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`font-black ${cat.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      Rs {cat.profit.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2 py-1 rounded font-bold text-sm ${cat.profit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {cat.revenue > 0 ? ((cat.profit / cat.revenue) * 100).toFixed(1) : '0.0'}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, subtitle, icon, color, valueColor = 'text-slate-900' }: any) => (
  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
    <div className="flex items-start justify-between mb-3">
      <div className={`${color} w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-lg`}>
        <i className={`fas ${icon}`}></i>
      </div>
    </div>
    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mb-1">{title}</p>
    <p className={`text-2xl font-black ${valueColor} mb-1`}>{value}</p>
    <p className="text-xs text-slate-400">{subtitle}</p>
  </div>
);

export default Finance;
