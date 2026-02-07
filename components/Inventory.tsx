
import React, { useState, useEffect } from 'react';
import { Product, Category } from '../types';
import { db } from '../services/supabase-db';

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAddCategoryModal, setShowAddCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null);
  const [stockToAdd, setStockToAdd] = useState(1);
  const [loading, setLoading] = useState(true);
  
  const [newProduct, setNewProduct] = useState({
    brand: '',
    model: '',
    categoryId: '',
    cost: '' as string | number,
    stock: '' as string | number,
    sku: ''
  });

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    try {
      setLoading(true);
      const prods = await db.getProducts();
      const cats = await db.getCategories();
      setProducts(prods); // Already sorted newest first from Supabase
      setCategories(cats);
      
      if (cats.length > 0 && !newProduct.categoryId) {
        setNewProduct(prev => ({ ...prev, categoryId: cats[0].id }));
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      alert('Error loading data from database');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.model.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await db.addProduct({
        categoryId: newProduct.categoryId,
        brand: newProduct.brand,
        model: newProduct.model,
        cost: Number(newProduct.cost),
        stock: Number(newProduct.stock)
      });
      setShowAddModal(false);
      setNewProduct({
        brand: '',
        model: '',
        categoryId: categories[0]?.id || '',
        cost: '',
        stock: '',
        sku: ''
      });
      await refreshData();
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Error adding product');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Delete ${name}? This action cannot be undone.`)) {
      try {
        await db.deleteProduct(id);
        await refreshData();
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Error deleting product');
      }
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      try {
        const newCategory = await db.addCategory(newCategoryName.trim());
        setShowAddCategoryModal(false);
        setNewCategoryName('');
        await refreshData();
        setNewProduct(prev => ({ ...prev, categoryId: newCategory.id }));
      } catch (error) {
        console.error('Error adding category:', error);
        alert('Error adding category');
      }
    }
  };

  const handleOpenAddStock = (product: Product) => {
    console.log('Opening add stock modal for:', product.sku, product.model);
    setSelectedProductForStock(product);
    setStockToAdd(1);
    setShowAddStockModal(true);
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProductForStock && stockToAdd > 0) {
      try {
        console.log('Adding stock:', stockToAdd, 'to product:', selectedProductForStock.sku);
        await db.updateProductStock(selectedProductForStock.id, stockToAdd);
        setShowAddStockModal(false);
        setSelectedProductForStock(null);
        setStockToAdd(1);
        await refreshData();
        console.log('Stock added successfully');
      } catch (error) {
        console.error('Error adding stock:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        alert(`Failed to add stock: ${errorMessage}\n\nPlease check the console for details.`);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900">Inventory Management</h2>
          <div className="flex items-center space-x-2 text-sm text-slate-500 mt-1">
            <i className="fas fa-warehouse text-indigo-600"></i>
            <p>{products.length} products • {products.reduce((acc, p) => acc + p.stock, 0)} total units</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button 
            onClick={() => setShowAddCategoryModal(true)}
            className="bg-slate-600 hover:bg-slate-700 text-white px-5 py-3 rounded-xl font-bold flex items-center transition-all shadow-lg shadow-slate-100 justify-center active:scale-95"
          >
            <i className="fas fa-folder-plus mr-2 text-sm"></i>
            Add Category
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold flex items-center transition-all shadow-lg shadow-indigo-100 justify-center active:scale-95"
          >
            <i className="fas fa-plus mr-2 text-sm"></i>
            Add New Product
          </button>
        </div>
      </header>

      {/* Responsive Filters */}
      <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
          <input 
            type="text" 
            placeholder="Search model, brand or SKU..."
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="md:w-64">
          <select 
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold transition-all"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Product List Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Mobile: Card Layout */}
        <div className="block lg:hidden divide-y divide-slate-100">
          {filteredProducts.length === 0 && (
            <div className="p-12 text-center text-slate-400 text-sm">No products found.</div>
          )}
          {filteredProducts.map(product => (
            <div key={product.id} className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-4">
                    <p className="font-black text-slate-900 truncate text-base">{product.model}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                        <span className="text-[10px] font-black bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded uppercase tracking-wider">
                           {categories.find(c => c.id === product.categoryId)?.name || 'Misc'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono font-bold">{product.sku}</span>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                      <p className="text-sm font-black text-amber-600">Cost: Rs {product.cost}</p>
                      <p className={`text-[11px] font-bold mt-0.5 ${product.stock < 5 ? 'text-red-500' : 'text-slate-500'}`}>
                          {product.stock} in stock
                      </p>
                  </div>
                  <button 
                    onClick={() => handleOpenAddStock(product)}
                    className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center active:scale-90 transition-transform"
                    title="Add Stock"
                  >
                    <i className="fas fa-plus text-sm"></i>
                  </button>
                  <button 
                    onClick={() => handleDelete(product.id, product.model)}
                    className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center active:scale-90 transition-transform"
                  >
                    <i className="fas fa-trash-can text-sm"></i>
                  </button>
                </div>
            </div>
          ))}
        </div>

        {/* Desktop: Table Layout */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Model & Brand</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Category</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Stock</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Cost Price</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{product.model}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase mt-0.5 tracking-wider font-mono">{product.sku}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                       {categories.find(c => c.id === product.categoryId)?.name || 'Misc'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2 py-1 rounded font-black text-sm ${product.stock < 5 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-amber-600">Rs {product.cost}</td>
                  <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <button 
                          onClick={() => handleOpenAddStock(product)}
                          className="w-10 h-10 rounded-xl hover:bg-emerald-50 text-slate-300 hover:text-emerald-600 transition-all flex items-center justify-center"
                          title="Add Stock"
                        >
                          <i className="fas fa-plus"></i>
                        </button>
                        <button 
                          onClick={() => handleDelete(product.id, product.model)}
                          className="w-10 h-10 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all flex items-center justify-center"
                        >
                          <i className="fas fa-trash-can"></i>
                        </button>
                      </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal (Responsive & Scrolling) */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300 max-h-[92vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Register New Stock</h3>
              <button onClick={() => setShowAddModal(false)} className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 active:scale-90 transition-all">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleAddProduct} className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                <div className="col-span-2">
                   <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Device Model Name</label>
                   <input required type="text" className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all font-bold" placeholder="e.g. Galaxy S24 Ultra" value={newProduct.model} onChange={e => setNewProduct({...newProduct, model: e.target.value})} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Brand</label>
                  <input required type="text" className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="Samsung, Apple..." value={newProduct.brand} onChange={e => setNewProduct({...newProduct, brand: e.target.value})} />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Category</label>
                  <select 
                    className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all font-bold"
                    value={newProduct.categoryId}
                    onChange={e => setNewProduct({...newProduct, categoryId: e.target.value})}
                  >
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Cost Price (Rs)</label>
                  <input required type="number" min="0" className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all font-black text-amber-600" value={newProduct.cost} onChange={e => setNewProduct({...newProduct, cost: e.target.value === '' ? '' : Number(e.target.value)})} onFocus={e => e.target.select()} />
                  <p className="text-xs text-slate-400 mt-2 ml-1">Selling price will be set at POS during sale</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Initial Stock Count</label>
                  <input required type="number" min="1" className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all font-black" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value === '' ? '' : Number(e.target.value)})} onFocus={e => e.target.select()} />
                </div>
              </div>
              <div className="pt-4 flex gap-3 pb-6 sm:pb-0">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors text-sm">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-[0.98]">Confirm Inventory</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {showAddCategoryModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Add New Category</h3>
              <button onClick={() => setShowAddCategoryModal(false)} className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 active:scale-90 transition-all">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleAddCategory} className="p-6 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Category Name</label>
                <input 
                  required 
                  type="text" 
                  className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all font-bold" 
                  placeholder="e.g. Smartphones, Tablets, Accessories" 
                  value={newCategoryName} 
                  onChange={e => setNewCategoryName(e.target.value)} 
                />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddCategoryModal(false)} className="flex-1 px-4 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors text-sm">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-4 bg-slate-600 text-white rounded-2xl font-black text-sm hover:bg-slate-700 transition-all shadow-xl shadow-slate-100 active:scale-[0.98]">Add Category</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddStockModal && selectedProductForStock && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-xl font-bold text-slate-900 tracking-tight">Add Stock</h3>
              <button onClick={() => setShowAddStockModal(false)} className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 active:scale-90 transition-all">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleAddStock} className="p-6 space-y-6">
              <div className="bg-slate-50 p-4 rounded-2xl">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Product</p>
                <p className="font-bold text-slate-900 text-lg">{selectedProductForStock.model}</p>
                <p className="text-xs text-slate-500 mt-1 font-mono">{selectedProductForStock.sku}</p>
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Current Stock</p>
                  <p className={`text-2xl font-black ${selectedProductForStock.stock < 5 ? 'text-red-600' : 'text-emerald-600'}`}>{selectedProductForStock.stock} units</p>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Quantity to Add</label>
                <input 
                  required 
                  type="number" 
                  min="1"
                  className="w-full px-4 py-3.5 bg-slate-50 border-none rounded-2xl outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-emerald-500 transition-all font-black text-2xl text-center text-emerald-600" 
                  value={stockToAdd} 
                  onChange={e => setStockToAdd(Number(e.target.value))} 
                  onFocus={e => e.target.select()} 
                />
                <p className="text-xs text-slate-400 mt-2 text-center">
                  New total: <span className="font-bold text-slate-700">{selectedProductForStock.stock + stockToAdd} units</span>
                </p>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddStockModal(false)} className="flex-1 px-4 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors text-sm">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-4 bg-emerald-600 text-white rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 active:scale-[0.98]">Confirm Restock</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
