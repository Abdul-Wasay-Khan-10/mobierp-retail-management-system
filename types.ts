
export enum UserRole {
  OWNER = 'OWNER',
  STAFF = 'STAFF'
}

export enum InventoryMethod {
  FIFO = 'FIFO',
  LIFO = 'LIFO',
  AVERAGE = 'AVERAGE'
}

export interface User {
  id: string;
  username: string;
  role: UserRole;
  name: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  categoryId: string;
  categoryName?: string;
  brand: string;
  model: string;
  price?: number; // Optional, for display purposes only
  cost: number;
  stock: number;
  sku: string;
}

export interface SaleItem {
  id?: string;
  productId: string;
  productName?: string;
  sku?: string;
  categoryName?: string;
  quantity: number;
  price: number;
  unitPrice?: number;
  cost: number;
  subtotal: number;
}

export interface Sale {
  id: string;
  saleNumber: string;
  date: string;
  total: number;
  seller: string | null;
  items: SaleItem[];
}

export interface DashboardStats {
  dailySales: number;
  weeklySales: number;
  monthlySales: number;
  totalInventoryValue: number;
  lowStockCount: number;
  totalCapitalInvested: number;
  totalRevenue: number;
  grossProfit: number;
}
