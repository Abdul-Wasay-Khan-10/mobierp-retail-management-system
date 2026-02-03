import { supabase } from './supabase';
import { Product, Sale, SaleItem, Category, User, UserRole } from '../types';

// =====================================================
// CATEGORIES
// =====================================================

export const getCategories = async (): Promise<Category[]> => {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');
  
  if (error) throw error;
  
  return data.map(cat => ({
    id: cat.id,
    name: cat.name
  }));
};

export const addCategory = async (name: string): Promise<Category> => {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name })
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    name: data.name
  };
};

// =====================================================
// PRODUCTS
// =====================================================

export const getProducts = async (): Promise<Product[]> => {
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories (
        id,
        name
      )
    `)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return data.map(product => ({
    id: product.id,
    categoryId: product.category_id,
    categoryName: product.categories?.name,
    brand: product.brand,
    model: product.model,
    sku: product.sku,
    cost: parseFloat(product.cost),
    stock: product.stock
  }));
};

export const addProduct = async (product: {
  categoryId: string;
  brand: string;
  model: string;
  cost: number;
  stock: number;
}): Promise<Product> => {
  // Get category name for SKU generation
  const { data: category } = await supabase
    .from('categories')
    .select('name')
    .eq('id', product.categoryId)
    .single();
  
  if (!category) throw new Error('Category not found');
  
  // Generate SKU using database function
  const { data: skuData, error: skuError } = await supabase
    .rpc('generate_sku', {
      p_category_name: category.name,
      p_brand: product.brand
    });
  
  if (skuError) throw skuError;
  
  // Insert product with generated SKU
  const { data, error } = await supabase
    .from('products')
    .insert({
      category_id: product.categoryId,
      brand: product.brand,
      model: product.model,
      sku: skuData,
      cost: product.cost,
      stock: product.stock
    })
    .select(`
      *,
      categories (
        id,
        name
      )
    `)
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    categoryId: data.category_id,
    categoryName: data.categories?.name,
    brand: data.brand,
    model: data.model,
    sku: data.sku,
    cost: parseFloat(data.cost),
    stock: data.stock
  };
};

export const updateProductStock = async (id: string, additionalStock: number): Promise<void> => {
  const { error } = await supabase.rpc('add_product_stock', {
    p_product_id: id,
    p_additional_stock: additionalStock
  });
  
  if (error) {
    // If RPC function doesn't exist, do it manually
    const { data: product } = await supabase
      .from('products')
      .select('stock')
      .eq('id', id)
      .single();
    
    if (!product) throw new Error('Product not found');
    
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: product.stock + additionalStock })
      .eq('id', id);
    
    if (updateError) throw updateError;
  }
};

export const deleteProduct = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

// =====================================================
// SALES
// =====================================================

export const getSales = async (): Promise<Sale[]> => {
  const { data, error } = await supabase
    .from('sales')
    .select(`
      *,
      seller:users!sales_seller_id_fkey (
        id,
        name,
        username
      ),
      sale_items (
        id,
        quantity,
        unit_price,
        cost_price,
        subtotal,
        product:products (
          id,
          brand,
          model,
          sku,
          categories (
            name
          )
        )
      )
    `)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return data.map(sale => ({
    id: sale.id,
    saleNumber: sale.sale_number,
    date: sale.created_at,
    total: parseFloat(sale.total_amount),
    seller: sale.seller.name,
    items: sale.sale_items.map((item: any) => ({
      id: item.id,
      productId: item.product.id,
      productName: `${item.product.brand} ${item.product.model}`,
      sku: item.product.sku,
      categoryName: item.product.categories?.name,
      quantity: item.quantity,
      price: parseFloat(item.unit_price),
      cost: parseFloat(item.cost_price),
      subtotal: parseFloat(item.subtotal)
    }))
  }));
};

export const recordSale = async (sale: {
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
    cost: number;
  }>;
  sellerId: string;
}): Promise<Sale> => {
  const total = sale.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Generate sale number: SALE-DDMMYYYY-XXXX
  const dateKey = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '');
  
  const { data: lastSale } = await supabase
    .from('sales')
    .select('sale_number')
    .ilike('sale_number', `SALE-${dateKey}-%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  let counter = 1;
  if (lastSale) {
    const lastCounter = parseInt(lastSale.sale_number.split('-').pop() || '0');
    counter = lastCounter + 1;
  }
  
  const saleNumber = `SALE-${dateKey}-${counter.toString().padStart(4, '0')}`;
  
  // Insert sale
  const { data: saleData, error: saleError } = await supabase
    .from('sales')
    .insert({
      sale_number: saleNumber,
      total_amount: total,
      seller_id: sale.sellerId
    })
    .select()
    .single();
  
  if (saleError) throw saleError;
  
  // Insert sale items (stock will be reduced automatically by trigger)
  const saleItems = sale.items.map(item => ({
    sale_id: saleData.id,
    product_id: item.productId,
    quantity: item.quantity,
    unit_price: item.price,
    cost_price: item.cost,
    subtotal: item.price * item.quantity
  }));
  
  const { error: itemsError } = await supabase
    .from('sale_items')
    .insert(saleItems);
  
  if (itemsError) throw itemsError;
  
  // Fetch complete sale data
  const { data: completeSale } = await supabase
    .from('sales')
    .select(`
      *,
      seller:users!sales_seller_id_fkey (
        id,
        name,
        username
      ),
      sale_items (
        id,
        quantity,
        unit_price,
        cost_price,
        subtotal,
        product:products (
          id,
          brand,
          model,
          sku,
          categories (
            name
          )
        )
      )
    `)
    .eq('id', saleData.id)
    .single();
  
  return {
    id: completeSale!.id,
    saleNumber: completeSale!.sale_number,
    date: completeSale!.created_at,
    total: parseFloat(completeSale!.total_amount),
    seller: completeSale!.seller.name,
    items: completeSale!.sale_items.map((item: any) => ({
      id: item.id,
      productId: item.product.id,
      productName: `${item.product.brand} ${item.product.model}`,
      sku: item.product.sku,
      categoryName: item.product.categories?.name,
      quantity: item.quantity,
      price: parseFloat(item.unit_price),
      cost: parseFloat(item.cost_price),
      subtotal: parseFloat(item.subtotal)
    }))
  };
};

// =====================================================
// USERS / AUTHENTICATION
// =====================================================

export const login = async (username: string, password: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .eq('is_active', true)
    .single();
  
  if (error || !data) return null;
  
  // Simple password check (for development - uses plain text)
  // In production, implement proper bcrypt hash comparison
  if (data.password_hash !== password) {
    return null;
  }
  
  return {
    id: data.id,
    username: data.username,
    name: data.name,
    role: data.role as UserRole
  };
};

export const getCurrentUser = (): User | null => {
  const userData = localStorage.getItem('erp_current_user');
  return userData ? JSON.parse(userData) : null;
};

export const setCurrentUser = (user: User | null): void => {
  if (user) {
    localStorage.setItem('erp_current_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('erp_current_user');
  }
};

export const logout = (): void => {
  setCurrentUser(null);
};

// Export all functions as db object for compatibility
export const db = {
  // Categories
  getCategories,
  addCategory,
  
  // Products
  getProducts,
  addProduct,
  updateProductStock,
  deleteProduct,
  
  // Sales
  getSales,
  recordSale,
  
  // Auth
  login,
  getCurrentUser,
  setCurrentUser,
  logout
};
