import { supabase } from './supabase';
import { Product, Sale, SaleItem, Category, User, UserRole, InventoryMethod } from '../types';
import { buildSaleNumber } from '../utils/sales';

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
  // Get display order setting (FIFO or LIFO)
  const displayOrder = await getInventoryDisplayOrder();
  const ascending = displayOrder === 'FIFO'; // FIFO = oldest first (ascending)
  
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      categories (
        id,
        name
      )
    `)
    .eq('is_active', true)
    .order('created_at', { ascending });
  
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
  console.log('Updating stock for product:', id, 'adding:', additionalStock);
  
  // Get current user for tracking
  const { data: { user } } = await supabase.auth.getUser();
  
  const { error } = await supabase.rpc('add_product_stock', {
    p_product_id: id,
    p_additional_stock: additionalStock,
    p_user_id: user?.id || null
  });
  
  if (error) {
    console.warn('RPC function failed, trying manual update:', error.message);
    
    // Manual fallback with inventory_purchases support
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('stock, cost')
      .eq('id', id)
      .single();
    
    if (fetchError) throw new Error(`Failed to fetch product: ${fetchError.message}`);
    if (!product) throw new Error('Product not found');
    
    // Update product stock
    const { error: updateError } = await supabase
      .from('products')
      .update({ 
        stock: product.stock + additionalStock,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
    
    if (updateError) throw new Error(`Failed to update stock: ${updateError.message}`);
    
    // Create inventory purchase record for FIFO/LIFO
    const { error: purchaseError } = await supabase
      .from('inventory_purchases')
      .insert({
        product_id: id,
        quantity: additionalStock,
        unit_cost: product.cost,
        remaining_quantity: additionalStock,
        purchased_at: new Date().toISOString(),
        purchased_by: user?.id || null,
        notes: 'Stock added via inventory management'
      });
    
    if (purchaseError) {
      console.error('Failed to create inventory purchase record:', purchaseError.message);
      // Don't throw - stock was updated successfully, just log the issue
      console.warn('Stock updated but inventory purchase record not created. This may affect FIFO/LIFO calculations.');
    }
    
    console.log('Manual stock update successful');
  } else {
    console.log('Stock updated successfully via RPC');
  }
};

export const deleteProduct = async (id: string): Promise<void> => {
  // Soft delete - set is_active to false instead of deleting
  // This preserves sales history and referential integrity
  const { error } = await supabase
    .from('products')
    .update({ is_active: false, updated_at: new Date().toISOString() })
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
    seller: sale.seller?.name || null,
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
  // Validate seller exists
  const { data: seller, error: sellerError } = await supabase
    .from('users')
    .select('id, name')
    .eq('id', sale.sellerId)
    .eq('is_active', true)
    .single();
  
  if (sellerError || !seller) {
    throw new Error('Invalid seller ID. Please log out and log back in.');
  }
  
  const total = sale.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  // Generate sale number: SALE-DDMMYYYY-XXXX
  const dateKey = new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '');
  
  const { data: lastSale, error: lastSaleError } = await supabase
    .from('sales')
    .select('sale_number')
    .ilike('sale_number', `SALE-${dateKey}-%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastSaleError) throw lastSaleError;
  
  const saleNumber = buildSaleNumber(dateKey, lastSale?.sale_number || null);
  
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
    seller: completeSale!.seller?.name || null,
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
    .maybeSingle();
  
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

// Verify current user still exists in database
export const verifyCurrentUser = async (): Promise<boolean> => {
  const currentUser = getCurrentUser();
  if (!currentUser) return false;
  
  const { data, error } = await supabase
    .from('users')
    .select('id')
    .eq('id', currentUser.id)
    .eq('is_active', true)
    .maybeSingle();
  
  if (error || !data) {
    // User no longer exists, clear localStorage
    logout();
    return false;
  }
  
  return true;
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

export const getUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  return data.map(user => ({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role as UserRole
  }));
};

export const addUser = async (user: {
  username: string;
  password: string;
  name: string;
  role: UserRole;
}): Promise<User> => {
  // Check if username already exists
  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('id')
    .eq('username', user.username)
    .maybeSingle();

  if (existingError) throw existingError;
  
  if (existing) {
    throw new Error('Username already exists');
  }
  
  // Insert new user (using plain text password for development)
  // In production, use proper bcrypt hashing
  const { data, error } = await supabase
    .from('users')
    .insert({
      username: user.username,
      password_hash: user.password,
      name: user.name,
      role: user.role,
      is_active: true
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return {
    id: data.id,
    username: data.username,
    name: data.name,
    role: data.role as UserRole
  };
};

export const deleteUser = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
};

export const updateUser = async (user: {
  id: string;
  username: string;
  password?: string;
  name: string;
  role: UserRole;
}): Promise<User> => {
  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('id')
    .eq('username', user.username)
    .neq('id', user.id)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    throw new Error('Username already exists');
  }

  const updatePayload: any = {
    username: user.username,
    name: user.name,
    role: user.role,
    updated_at: new Date().toISOString()
  };

  if (user.password && user.password.trim().length > 0) {
    updatePayload.password_hash = user.password;
  }

  const { data, error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;

  return {
    id: data.id,
    username: data.username,
    name: data.name,
    role: data.role as UserRole
  };
};

// =====================================================
// INVENTORY DISPLAY ORDER SETTINGS
// =====================================================

export const getInventoryDisplayOrder = async (): Promise<'FIFO' | 'LIFO'> => {
  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'inventory_display_order')
    .single();
  
  if (error) {
    console.warn('Could not fetch inventory display order, defaulting to LIFO:', error);
    return 'LIFO';
  }
  
  return (data?.setting_value as 'FIFO' | 'LIFO') || 'LIFO';
};

export const setInventoryDisplayOrder = async (order: 'FIFO' | 'LIFO'): Promise<void> => {
  const { error } = await supabase
    .from('system_settings')
    .update({ 
      setting_value: order,
      updated_at: new Date().toISOString()
    })
    .eq('setting_key', 'inventory_display_order');
  
  if (error) throw error;
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
  
  // Auth & Users
  login,
  getCurrentUser,
  verifyCurrentUser,
  setCurrentUser,
  logout,
  getUsers,
  addUser,
  deleteUser,
  updateUser,
  
  // Settings
  getInventoryDisplayOrder,
  setInventoryDisplayOrder
};
