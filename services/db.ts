
import { Product, Sale, Category, User, UserRole } from '../types';
import { INITIAL_CATEGORIES, INITIAL_PRODUCTS } from '../constants';

const DB_KEYS = {
  PRODUCTS: 'erp_products',
  SALES: 'erp_sales',
  CATEGORIES: 'erp_categories',
  USER: 'erp_current_user',
  USERS_LIST: 'erp_users_list'
};

const getStoredUsers = () => {
  const data = localStorage.getItem(DB_KEYS.USERS_LIST);
  if (data) return JSON.parse(data);
  const initialUsers = [
    { id: 'u1', username: 'hamza', password: 'hamza123', role: UserRole.OWNER, name: 'Hamza (Admin)' },
    { id: 'u2', username: 'staff', password: 'staff123', role: UserRole.STAFF, name: 'Store Staff' }
  ];
  localStorage.setItem(DB_KEYS.USERS_LIST, JSON.stringify(initialUsers));
  return initialUsers;
};

export const db = {
  getProducts: (): Product[] => {
    const data = localStorage.getItem(DB_KEYS.PRODUCTS);
    return data ? JSON.parse(data) : INITIAL_PRODUCTS;
  },

  saveProducts: (products: Product[]) => {
    localStorage.setItem(DB_KEYS.PRODUCTS, JSON.stringify(products));
  },

  addProduct: (product: Omit<Product, 'id'>): Product => {
    const products = db.getProducts();
    const newProduct = {
      ...product,
      id: `p_${Date.now()}`
    };
    db.saveProducts([...products, newProduct]);
    return newProduct;
  },

  deleteProduct: (id: string) => {
    const products = db.getProducts();
    const updated = products.filter(p => p.id !== id);
    db.saveProducts(updated);
  },

  updateProductStock: (id: string, newStock: number) => {
    const products = db.getProducts();
    const updated = products.map(p => p.id === id ? { ...p, stock: newStock } : p);
    db.saveProducts(updated);
  },

  getCategories: (): Category[] => {
    const data = localStorage.getItem(DB_KEYS.CATEGORIES);
    return data ? JSON.parse(data) : INITIAL_CATEGORIES;
  },

  addCategory: (name: string): Category => {
    const categories = db.getCategories();
    const newCategory: Category = {
      id: `cat_${Date.now()}`,
      name
    };
    localStorage.setItem(DB_KEYS.CATEGORIES, JSON.stringify([...categories, newCategory]));
    return newCategory;
  },

  getSales: (): Sale[] => {
    const data = localStorage.getItem(DB_KEYS.SALES);
    return data ? JSON.parse(data) : [];
  },

  recordSale: (saleData: Omit<Sale, 'id' | 'timestamp'>): Sale => {
    const products = db.getProducts();
    const sales = db.getSales();
    
    const updatedProducts = products.map(p => {
      const saleItem = saleData.items.find(item => item.productId === p.id);
      if (saleItem) {
        if (p.stock < saleItem.quantity) throw new Error(`Insufficient stock for ${p.model}`);
        return { ...p, stock: p.stock - saleItem.quantity };
      }
      return p;
    });

    const newSale: Sale = {
      ...saleData,
      id: `sale_${Date.now()}`,
      timestamp: new Date().toISOString()
    };

    db.saveProducts(updatedProducts);
    localStorage.setItem(DB_KEYS.SALES, JSON.stringify([...sales, newSale]));
    return newSale;
  },

  getCurrentUser: (): User | null => {
    const data = localStorage.getItem(DB_KEYS.USER);
    return data ? JSON.parse(data) : null;
  },

  getUsers: () => {
    return getStoredUsers();
  },

  addUser: (userData: any) => {
    const users = getStoredUsers();
    const newUser = {
      ...userData,
      id: `u_${Date.now()}`
    };
    const updated = [...users, newUser];
    localStorage.setItem(DB_KEYS.USERS_LIST, JSON.stringify(updated));
    return newUser;
  },

  deleteUser: (id: string) => {
    const users = getStoredUsers();
    const updated = users.filter((u: any) => u.id !== id);
    localStorage.setItem(DB_KEYS.USERS_LIST, JSON.stringify(updated));
  },

  login: (username: string, password: string): User => {
    const users = getStoredUsers();
    const user = users.find((u: any) => u.username === username && u.password === password);
    
    if (user) {
      const sessionUser = { id: user.id, username: user.username, role: user.role, name: user.name };
      localStorage.setItem(DB_KEYS.USER, JSON.stringify(sessionUser));
      return sessionUser;
    }

    throw new Error('Invalid username or password');
  },

  logout: () => {
    localStorage.removeItem(DB_KEYS.USER);
  }
};
