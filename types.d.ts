interface InventoryItem {
    id?: number;
    name: string;
    description?: string | null;
    quantity: number;
    defective_qty?: number;
    available_qty?: number;
    price: string;
    cost?: string | null;
    category: number | null;
    category_name?: string;
    owner?: number;
    owner_username?: string | null;
    sku: string | null;
    location: string | null;
    min_stock_level?: number; // legacy name used in some parts of the code / backend
    low_stock_threshold?: number; // preferred unified name used by API and UI
    unit_base?: string;
    unit_package_factor?: number;
    unit_pallet_factor?: number;
    date_added?: string;
    last_updated?: string;
    is_active?: boolean;
    is_low_stock?: boolean;
    total_value?: number;
    // Neue Getränke-spezifische Felder
    brand?: string | null;
    beverage_type?: string | null;
    container_type?: string | null;
    volume_ml?: number | null;
    deposit_chf?: string;
    is_returnable?: boolean;
    is_alcoholic?: boolean;
    abv_percent?: string | null;
    country_of_origin?: string | null;
    ean_unit?: string | null;
    ean_pack?: string | null;
    vat_rate?: string;
  }
  
interface Supplier {
    id: number;
    name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    owner: User;
    created_at: string;
    updated_at: string;
  }

interface CreateSupplierData {
    name: string;
    contact_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    tax_id?: string | null;
    payment_terms?: string | null;
    notes?: string | null;
    is_active?: boolean;
  }

interface Customer {
    id?: number;
    name: string;
    customer_number: string;
    contact_name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    shipping_address?: string | null;
    tax_id?: string | null;
    credit_limit?: string | null;
    payment_terms?: string | null;
    notes?: string | null;
    owner?: number;
    created_at?: string;
    updated_at?: string;
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

interface InventoryValueReportItem {
  id?: number;
  name: string;
  sku: string | null;
  quantity: number;
  price: number;
  value: number;
  category: string;
}

interface LowStockReportItem {
  id?: number;
  name: string;
  sku: string | null;
  quantity: number;
  threshold: number;
  needed: number;
  category: string;
}

interface CategorySummaryReportItem {
  category: string;
  itemCount: number;
  totalValue: number;
  avgPrice: number;
}

interface ReportTotals {
  totalItems?: number;
  totalQuantity?: number;
  totalValue?: number;
  totalNeeded?: number;
  totalCategories?: number;
}

interface Expense {
  id?: number;
  date: string;
  description: string;
  amount: string;
  category: 'PURCHASE' | 'TRANSPORT' | 'UTILITIES' | 'MAINTENANCE' | 'OFFICE' | 'MARKETING' | 'OTHER';
  supplier?: number | null;
  supplier_name?: string;
  receipt_number?: string | null;
  notes?: string | null;
  owner?: number;
  created_at?: string;
  updated_at?: string;
}

interface CompanyProfile {
  id?: number;
  user?: number;
  name: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  email: string;
  phone: string;
  iban?: string | null;
  bank_name?: string | null;
  mwst_number?: string | null;
  currency: string;
  logo?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface SalesOrder {
  id?: number;
  order_number?: string;
  customer: number;
  customer_name?: string;
  status: 'DRAFT' | 'CONFIRMED' | 'DELIVERED' | 'CANCELLED';
  order_date?: string;
  delivery_date?: string | null;
  notes?: string | null;
  total_net?: string;
  total_tax?: string;
  total_gross?: string;
  currency?: string;
  created_at?: string;
  updated_at?: string;
}

interface SalesOrderItem {
  id?: number;
  order?: number;
  item: number;
  item_name?: string;
  item_sku?: string | null;
  qty_base: number;
  unit_price: string;
  tax_rate: string;
  line_total_net?: string;
  line_total_tax?: string;
  line_total_gross?: string;
}

interface Invoice {
  id?: number;
  invoice_number?: string;
  order: number;
  order_number?: string;
  customer_name?: string;
  issue_date?: string;
  due_date?: string;
  total_net: string;
  total_tax: string;
  total_gross: string;
  currency: string;
  pdf_file?: string;
  created_at?: string;
  updated_at?: string;
}
