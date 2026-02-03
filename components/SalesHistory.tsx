
import React, { useState, useEffect } from 'react';
import { Sale, Product } from '../types';
import { db } from '../services/supabase-db';

const SalesHistory: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [salesData, productsData] = await Promise.all([
          db.getSales(),
          db.getProducts()
        ]);
        setSales(salesData); // Already sorted newest first from Supabase
        setProducts(productsData);
      } catch (error) {
        console.error('Error loading sales history:', error);
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

  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl md:text-2xl font-bold text-slate-900">Transaction History</h2>
        <div className="flex items-center space-x-2 text-sm text-slate-500 mt-1">
          <i className="fas fa-clock-rotate-left text-indigo-600"></i>
          <p>All-time records • As of {currentDate}</p>
        </div>
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="block lg:hidden divide-y divide-slate-100">
           {sales.length === 0 ? (
             <div className="p-12 text-center text-slate-400 text-sm italic">No sales found.</div>
           ) : (
             sales.map(sale => (
               <div key={sale.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                     <div>
                       <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">{sale.saleNumber}</div>
                       <div className="flex items-center text-[10px] font-bold text-slate-400 space-x-1">
                         <i className="fa-regular fa-calendar"></i>
                         <span>{new Date(sale.date).toLocaleDateString()}</span>
                         <i className="fa-regular fa-clock ml-2"></i>
                         <span>{new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                       </div>
                     </div>
                     <div className="text-lg font-black text-slate-900">Rs {sale.total}</div>
                  </div>
                  <div className="space-y-1 mb-3">
                     {sale.items.map((item, idx) => (
                        <div key={idx} className="text-xs text-slate-600 flex justify-between">
                           <span>{item.productName || 'Product'}</span>
                           <span className="font-bold">x{item.quantity}</span>
                        </div>
                     ))}
                  </div>

               </div>
             ))
           )}
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Timestamp</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Order ID</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contents</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic text-sm">
                    Sales ledger is currently empty.
                  </td>
                </tr>
              ) : (
                sales.map(sale => (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-bold text-slate-900">
                        {new Date(sale.date).toLocaleDateString()}
                      </div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">
                        {new Date(sale.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-[10px] text-slate-400 font-bold">{sale.saleNumber}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 max-w-xs">
                        {sale.items.map((item, idx) => (
                          <div key={idx} className="text-[11px] font-medium text-slate-700 truncate bg-slate-50 px-2 py-0.5 rounded">
                            <span className="font-black text-indigo-600 mr-2">{item.quantity}x</span>
                            {item.productName || 'Unknown Item'}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="text-lg font-black text-slate-900">Rs {sale.total.toLocaleString()}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalesHistory;
