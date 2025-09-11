interface InventoryItem {
    id?: number;
    name: string;
    description?: string | null;
    quantity: number;
    price: string;
    cost?: string;
    category: number | null;
    category_name?: string;
    owner_username?: string | null;
    sku: string | null;
    location: string | null;
    low_stock_threshold?: number;
    date_added?: string;
    last_updated?: string;
    is_low_stock?: boolean;
    // Phase 2 enhancements
    defective_qty?: number;
    available_qty?: number;
    min_stock_level?: number;
    unit_base?: string;
    unit_package_factor?: number;
    unit_pallet_factor?: number;
  }
  
interface Supplier {
    id: number;
    name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    tax_id?: string | null;
    payment_terms?: string | null;
    notes?: string | null;
    owner: number;
    created_at: string;
    updated_at: string;
    is_active?: boolean;
  }
  
interface InventoryLog {
    id: number;
    item: number;
    item_name?: string;
    user: number | null;
    username?: string;
    action: "ADD" | "REMOVE" | "UPDATE";
    quantity_change: number;
    previous_quantity: number;
    new_quantity: number;
    timestamp: string;
    notes: string | null;
  }
  
interface InventoryItemSupplier {
    id: number;
    item: number;
    supplier: number;
    supplier_name?: string;
    supplier_sku: string | null;
    supplier_price: string;
    lead_time_days: number | null;
    notes: string | null;
  }

interface User {
    id: number
    username: string
    email: string
    first_name?: string
    last_name?: string
  }
  
interface AuthTokens {
    access: string
    refresh: string
  }
  
interface AuthContextType {
    user: User | null
    tokens: AuthTokens | null
    isLoading: boolean
    login: (username: string, password: string) => Promise<void>
    register: (userData: RegisterData) => Promise<void>
    logout: () => Promise<void>
    changePassword: (currentPassword: string, newPassword: string) => Promise<void>
    updateProfile: (userData: Partial<User>) => Promise<void>
  }
  
interface RegisterData {
    username: string
    email: string
    password: string
    first_name?: string
    last_name?: string
  }

interface ChartConfig {
    [key: string]: {
      label: string
      color?: string
    }
  } 
  
interface Category {
  id: number
  name: string
  description: string | null
  created_at: string
  updated_at: string
}


interface InventoryLevel {
  item_id: number
  item_name: string
  current_quantity: number
  low_stock_threshold: number
  is_low_stock: boolean
  last_updated: string
}

interface LowStockAlertsProps {
  lowStockData: {
    name: string;
    Quantity: number;
    Threshold: number;
  }[];
}

interface InventoryByCategoryProps {
  categories: Category[];
  inventoryItems: InventoryItem[];
}

interface DashboardMetricsProps {
  totalItems: number;
  inventoryItems: InventoryItem[];
  lowStockItems: number;
  totalValue: number;
  totalCategories: number;
  activeCategories: number;
  lowStockData: { name: string; Quantity: number; Threshold: number; }[];
}

interface InventoryTrendChartProps {
  trendData: { month: string; stock: number; available: number; sold: number }[];
  currentYearValue: number;
  currentMonthValue: number;
};

// Phase 2 New Entities
interface Customer {
  id?: number;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  shipping_address?: string | null;
  tax_id?: string | null;
  credit_limit?: number | null;
  payment_terms?: string | null;
  notes?: string | null;
  owner?: number;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
}

interface Expense {
  id?: number;
  date: string;
  description: string;
  amount: string;
  category: string;
  supplier?: number | null;
  supplier_name?: string;
  receipt_number?: string | null;
  notes?: string | null;
  owner?: number;
  created_at?: string;
  updated_at?: string;
}

interface StockMovement {
  id?: number;
  item: number;
  item_name?: string;
  type: 'IN' | 'OUT' | 'RETURN' | 'DEFECT' | 'ADJUST';
  qty_base: number;
  qty_units?: string;
  supplier?: number | null;
  supplier_name?: string;
  customer?: number | null;
  customer_name?: string;
  note?: string | null;
  created_by?: number;
  created_by_username?: string;
  created_at?: string;
}

interface SalesOrder {
  id?: number;
  order_number?: string;
  customer: number;
  customer_name?: string;
  status: 'DRAFT' | 'CONFIRMED' | 'DELIVERED' | 'INVOICED';
  order_date: string;
  delivery_date?: string | null;
  net_amount?: string;
  tax_amount?: string;
  gross_amount?: string;
  notes?: string | null;
  created_by?: number;
  created_at?: string;
  updated_at?: string;
  items?: SalesOrderItem[];
}

interface SalesOrderItem {
  id?: number;
  order?: number;
  item: number;
  item_name?: string;
  quantity: number;
  unit_price: string;
  tax_rate?: number;
  net_amount?: string;
  tax_amount?: string;
  gross_amount?: string;
}

interface Invoice {
  id?: number;
  invoice_number?: string;
  order: number;
  order_number?: string;
  customer?: number;
  customer_name?: string;
  invoice_date: string;
  due_date?: string | null;
  net_amount?: string;
  tax_amount?: string;
  gross_amount?: string;
  notes?: string | null;
  created_at?: string;
}

// UoM Conversion Helper
interface UoMConversion {
  pallets: number;
  packages: number;
  singles: number;
  total_base: number;
}

// Stock Action Data
interface StockActionData {
  item: number;
  qty_base?: number;
  qty_pallets?: number;
  qty_packages?: number;
  qty_singles?: number;
  supplier?: number | null;
  customer?: number | null;
  note?: string;
}

// API List Response
interface APIListResponse<T> {
  results: T[];
  count: number;
  next: string | null;
  previous: string | null;
}

// Error Response
interface APIError {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
}

// Expense Categories
type ExpenseCategory = 'PURCHASE' | 'TRANSPORT' | 'UTILITIES' | 'MAINTENANCE' | 'OFFICE' | 'MARKETING' | 'OTHER';

// Unit Types
type UnitType = 'PIECE' | 'KG' | 'LITER' | 'METER' | 'PACK' | 'BOX';
  