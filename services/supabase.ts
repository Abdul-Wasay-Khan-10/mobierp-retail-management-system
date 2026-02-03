import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Database {
  categories: {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
  };
  products: {
    id: string;
    category_id: string;
    brand: string;
    model: string;
    sku: string;
    cost: number;
    stock: number;
    track_individually: boolean;
    created_at: string;
    updated_at: string;
  };
  users: {
    id: string;
    username: string;
    password_hash: string;
    name: string;
    role: 'OWNER' | 'STAFF';
    is_active: boolean;
    created_at: string;
    updated_at: string;
  };
  sales: {
    id: string;
    sale_number: string;
    total_amount: number;
    seller_id: string;
    created_at: string;
  };
  sale_items: {
    id: string;
    sale_id: string;
    product_id: string;
    quantity: number;
    unit_price: number;
    cost_price: number;
    subtotal: number;
    created_at: string;
  };
}
