
import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { db } from '../services/supabase-db';
import { useUiLock } from './UiLock';

interface CartItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

const POS: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [showCartOnMobile, setShowCartOnMobile] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const { runWithLock } = useUiLock();

  useEffect(() => {
    loadProducts();
  }, [runWithLock]);

  const loadProducts = async () => {
    await runWithLock(async () => {
      try {
        setLoading(true);
        const prods = await db.getProducts();
        setProducts(prods);
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setLoading(false);
      }
    });
  };

  const filtered = products.filter(p => {
    const matchesSearch = p.model.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch && p.stock > 0;
  });

  const openPriceModal = (product: Product) => {
    setSelectedProduct(product);
    setSellingPrice(product.cost * 1.2); // Suggest 20% markup as default
    setShowPriceModal(true);
  };

  const addToCartWithPrice = () => {
    if (!selectedProduct || sellingPrice <= 0) return;
    
    const existing = cart.find(item => item.productId === selectedProduct.id);
    if (existing) {
      if (existing.quantity >= selectedProduct.stock) {
        alert("Maximum stock reached");
        setShowPriceModal(false);
        return;
      }
      setCart(cart.map(item => 
        item.productId === selectedProduct.id 
          ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitPrice }
          : item
      ));
    } else {
      setCart([...cart, { 
        productId: selectedProduct.id, 
        quantity: 1, 
        unitPrice: sellingPrice, 
        subtotal: sellingPrice 
      }]);
    }
    
    setShowPriceModal(false);
    setSelectedProduct(null);
    setSellingPrice(0);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter(i => i.productId !== id));
  };

  const increaseQuantity = (productId: string) => {
    const product = products.find(p => p.id === productId);
    const cartItem = cart.find(item => item.productId === productId);
    
    if (!product || !cartItem) return;
    
    if (cartItem.quantity >= product.stock) {
      alert("Maximum stock reached");
      return;
    }
    
    setCart(cart.map(item => 
      item.productId === productId 
        ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.unitPrice }
        : item
    ));
  };

  const decreaseQuantity = (productId: string) => {
    const cartItem = cart.find(item => item.productId === productId);
    
    if (!cartItem) return;
    
    if (cartItem.quantity === 1) {
      removeFromCart(productId);
    } else {
      setCart(cart.map(item => 
        item.productId === productId 
          ? { ...item, quantity: item.quantity - 1, subtotal: (item.quantity - 1) * item.unitPrice }
          : item
      ));
    }
  };

  const total = cart.reduce((acc, i) => acc + i.subtotal, 0);

  const currentDate = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!confirm(`Confirm sale for Rs ${total.toFixed(0)}?`)) {
      return;
    }
    
    try {
      await runWithLock(async () => {
        const currentUser = db.getCurrentUser();
        if (!currentUser) {
          setMessage({ type: 'error', text: 'User not logged in' });
          return;
        }

        await db.recordSale({
          items: cart.map(item => {
            const product = products.find(p => p.id === item.productId);
            return {
              productId: item.productId,
              quantity: item.quantity,
              price: item.unitPrice,
              cost: product?.cost || 0
            };
          }),
          sellerId: currentUser.id
        });

        setCart([]);
        await loadProducts();
        setMessage({ type: 'success', text: 'Order processed!' });
        window.dispatchEvent(new CustomEvent('erp:sale-recorded'));
        setTimeout(() => setMessage(null), 3000);
        if (showCartOnMobile) setShowCartOnMobile(false);
      });
    } catch (err: any) {
      console.error('Checkout error:', err);
      setMessage({ type: 'error', text: err.message || 'Error processing sale' });
      setTimeout(() => setMessage(null), 5000);
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
    <div className="relative">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection */}
        <div className={`lg:col-span-2 space-y-4 ${showCartOnMobile ? 'hidden lg:block' : 'block'}`}>
          <header className="mb-4">
            <h2 className="text-2xl font-bold text-slate-900">New Sale</h2>
            <div className="flex items-center space-x-2 text-sm text-slate-500 mt-1">
              <i className="fas fa-calendar text-indigo-600"></i>
              <p>{currentDate}</p>
            </div>
          </header>

          <div className="relative">
            <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            <input 
              type="text" 
              placeholder="Search by brand, model, or SKU..."
              className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {filtered.map(product => (
              <button 
                key={product.id}
                onClick={() => openPriceModal(product)}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-indigo-500 hover:shadow-md transition-all text-left flex justify-between items-center group active:scale-95"
              >
                <div>
                  <p className="font-bold text-slate-900 leading-tight">{product.model}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-bold mt-1 tracking-wider">{product.brand}</p>
                  <div className="flex items-center space-x-2 mt-2">
                    <span className="text-amber-600 font-black text-xs">Cost: Rs {product.cost}</span>
                    <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold">Qty: {product.stock}</span>
                  </div>
                </div>
                <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-shrink-0">
                  <i className="fas fa-plus"></i>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cart Sidebar (Collapsible on Mobile) */}
        <div className={`lg:col-span-1 bg-white lg:rounded-2xl rounded-t-3xl shadow-2xl lg:shadow-xl border border-slate-200 flex flex-col lg:sticky lg:top-8 transition-all ${
            showCartOnMobile 
            ? 'fixed inset-x-0 bottom-0 h-[60vh] rounded-b-none z-50 mb-16' 
            : 'hidden lg:flex lg:max-h-[calc(100vh-80px)] z-30'
        }`}>
          <div className="p-4 md:p-6 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <h3 className="text-lg font-bold flex items-center">
              <i className="fas fa-shopping-cart mr-2 text-indigo-600"></i>
              Order Details
            </h3>
            <button 
                onClick={() => setShowCartOnMobile(false)}
                className="lg:hidden w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-500"
            >
                <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-4 min-h-0 max-h-[50vh]">
            {cart.length === 0 ? (
              <div className="text-center py-12 text-slate-300">
                <i className="fas fa-bag-shopping text-5xl mb-4 block opacity-20"></i>
                <p className="font-medium">No items added yet</p>
              </div>
            ) : (
              cart.map(item => {
                const p = products.find(x => x.id === item.productId);
                const profit = item.subtotal - (p?.cost || 0) * item.quantity;
                return (
                  <div key={item.productId} className="bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0 pr-2">
                        <p className="font-bold text-sm text-slate-900 truncate">{p?.model}</p>
                        <div className="flex items-center space-x-2 mt-0.5">
                          <span className="text-xs text-slate-500">Rs {item.unitPrice} each</span>
                          <span className="text-indigo-600 font-bold text-xs">Rs {item.subtotal}</span>
                        </div>
                        <div className="text-[10px] mt-1">
                          <span className={`font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            Profit: Rs {profit.toFixed(0)}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeFromCart(item.productId)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                      >
                        <i className="fas fa-trash-can text-xs"></i>
                      </button>
                    </div>
                    <div className="flex items-center justify-between bg-white rounded-lg p-2 border border-slate-200">
                      <button
                        onClick={() => decreaseQuantity(item.productId)}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-red-100 text-slate-600 hover:text-red-600 flex items-center justify-center transition-colors font-bold active:scale-95"
                      >
                        <i className="fas fa-minus text-xs"></i>
                      </button>
                      <span className="font-black text-lg text-slate-900 px-3">{item.quantity}</span>
                      <button
                        onClick={() => increaseQuantity(item.productId)}
                        className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-600 flex items-center justify-center transition-colors font-bold active:scale-95"
                      >
                        <i className="fas fa-plus text-xs"></i>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-4 md:p-6 pb-6 md:pb-6 bg-slate-50 border-t border-slate-100 lg:rounded-b-2xl flex-shrink-0">
            <div className="flex justify-between items-center mb-3 md:mb-4">
              <span className="text-slate-500 font-bold uppercase text-xs tracking-widest">Grand Total</span>
              <span className="text-2xl md:text-3xl font-black text-slate-900">Rs {total}</span>
            </div>

            {message && (
              <div className={`p-3 rounded-lg mb-3 text-sm font-bold text-center animate-in zoom-in-95 duration-200 ${message.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                <i className={`fas ${message.type === 'success' ? 'fa-check-circle' : 'fa-circle-xmark'} mr-2`}></i>
                {message.text}
              </div>
            )}

            <button 
              disabled={cart.length === 0}
              onClick={handleCheckout}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none text-white py-3 md:py-4 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center space-x-2 active:scale-[0.98]"
            >
              <span>{cart.length === 0 ? 'Add Items' : 'Process Payment'}</span>
              <i className="fas fa-arrow-right text-xs"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Cart Button for Mobile */}
      {!showCartOnMobile && cart.length > 0 && (
        <button 
            onClick={() => setShowCartOnMobile(true)}
            className="lg:hidden fixed bottom-20 right-4 bg-indigo-600 text-white w-14 h-14 rounded-full shadow-xl z-50 flex items-center justify-center animate-bounce"
        >
            <i className="fas fa-cart-shopping"></i>
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full border-2 border-white flex items-center justify-center">
                {cart.length}
            </span>
        </button>
      )}

      {/* Price Input Modal */}
      {showPriceModal && selectedProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">Set Selling Price</h3>
              <p className="text-sm text-slate-500 mt-1">{selectedProduct.model}</p>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Cost Price</p>
                <p className="text-2xl font-black text-amber-700">Rs {selectedProduct.cost}</p>
              </div>
              
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest ml-1">Selling Price (Rs)</label>
                <input 
                  type="number" 
                  min={selectedProduct.cost}
                  step="1"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl outline-none ring-2 ring-indigo-500 transition-all font-black text-2xl text-indigo-600 text-center"
                  autoFocus
                />
                {sellingPrice > 0 && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">Profit per unit:</span>
                      <span className={`font-black ${sellingPrice >= selectedProduct.cost ? 'text-emerald-600' : 'text-red-600'}`}>
                        Rs {(sellingPrice - selectedProduct.cost).toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-2">
                      <span className="text-slate-600">Margin:</span>
                      <span className="font-bold text-slate-900">
                        {sellingPrice > 0 ? ((sellingPrice - selectedProduct.cost) / sellingPrice * 100).toFixed(1) : '0'}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowPriceModal(false)} 
                  className="flex-1 px-4 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={addToCartWithPrice}
                  disabled={sellingPrice <= 0}
                  className="flex-1 px-4 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 active:scale-[0.98] disabled:opacity-50"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
