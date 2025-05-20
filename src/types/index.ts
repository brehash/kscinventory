// User Types
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: 'admin' | 'manager' | 'staff';
  createdAt?: Date;
  updatedAt?: Date;
  lastLogin?: Date;
  createdBy?: string;
  updatedBy?: string;
}

// Product Types
export interface Product {
  id: string;
  name: string;
  description: string;
  barcode?: string;
  categoryId: string;
  typeId: string;
  locationId: string;
  providerId?: string; // Optional provider
  quantity: number;
  minQuantity: number;
  price: number;
  cost?: number; // Optional cost price
  lastCost?: number; // For price change tracking
  vatPercentage: number; // VAT percentage
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductCategory {
  id: string;
  name: string;
  description: string;
  default?: boolean; // Add default property
  createdAt: Date;
}

export interface ProductType {
  id: string;
  name: string;
  description: string;
  default?: boolean; // Add default property
  createdAt: Date;
}

export interface Location {
  id: string;
  name: string;
  description: string;
  default?: boolean; // Add default property
  createdAt: Date;
}

// Provider Types
export interface Provider {
  id: string;
  name: string;
  description: string;
  website?: string; // Optional website field
  phoneNumber?: string; // Optional phone number field
  createdAt: Date;
}

// Price History Type
export interface PriceHistory {
  id?: string;
  productId: string;
  oldCost: number;
  newCost: number;
  changeDate: Date;
  userId: string;
  userName: string;
  providerId: string;
  providerName: string;
  changePercentage: number;
}

// Item Movement Type
export interface ItemMovement {
  id?: string;
  productId: string;
  productName: string;
  sourceLocationId: string;
  sourceLocationName: string;
  destinationLocationId: string;
  destinationLocationName: string;
  quantity: number;
  movedAt: Date;
  movedBy: string;
  movedByName: string;
}

// Dashboard Types
export interface DashboardStats {
  totalProducts: number;
  totalValue: number;
  totalSellingValue?: number;
  profitMargin?: number;
  lowStockItems: number;
  categoriesCount: number;
}

export interface LowStockAlert {
  id: string;
  productId: string;
  productName: string;
  currentQuantity: number;
  minQuantity: number;
  locationName: string;
  locationId?: string; // Added for filtering
  categoryId?: string; // Added for filtering
}

// Activity Log Types
export type ActivityType = 'added' | 'removed' | 'updated' | 'deleted' | 'moved';
export type ActivityEntityType = 'product' | 'category' | 'location' | 'productType' | 'provider' | 'order' | 'user' | 'client' | 'note';

export interface ActivityLog {
  id: string;
  type: ActivityType;
  entityType: ActivityEntityType;
  entityId: string;
  entityName: string;
  quantity?: number | null;
  date: Date;
  userId: string;
  userName: string;
  sourceLocationId?: string; // For item movement
  destinationLocationId?: string; // For item movement
}

// Auth Context Types
export interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string, role?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

// Order Types
export interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  picked?: boolean;
  total: number;
  locationId?: string; // Optional field to track which location the item came from
}

// New interface for unidentified WooCommerce items
export interface UnidentifiedItem {
  wcProductId: number;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  orderDate: Date;
  status: OrderStatus;
  items: OrderItem[];
  unidentifiedItems?: UnidentifiedItem[]; // Added property for unidentified items from WooCommerce
  shippingAddress: Address;
  billingAddress: Address;
  subtotal: number;
  shippingCost: number;
  tax: number;
  total: number;
  paymentMethod: string;
  notes?: string;
  source: 'manual' | 'woocommerce';
  woocommerceId?: number;
  createdAt: Date;
  updatedAt: Date;
  packingSlipPrinted: boolean;
  fulfilledAt?: Date;
  fulfilledBy?: string;
  hasUnidentifiedItems?: boolean; // Flag to quickly check if order has unidentified items
  clientId?: string; // Reference to the client
}

export type OrderStatus = 
  | 'pending' 
  | 'processing' 
  | 'on-hold' 
  | 'completed' 
  | 'cancelled' 
  | 'refunded' 
  | 'failed'
  | 'draft'
  | 'checkout-draft'
  | 'preluata'
  | 'pregatita'  // New status replacing 'impachetata'
  | 'impachetata'
  | 'expediata'
  | 'returnata'
  | 'refuzata'
  | 'neonorata';  // New status

export interface OrderFilterOptions {
  status?: OrderStatus;
  dateRange?: {
    start: Date;
    end: Date;
  };
  source?: 'manual' | 'woocommerce' | 'all';
  search?: string;
}

// CRM Types
export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: Address;
  companyName?: string;
  taxId?: string;
  notes?: ClientNote[];
  contactPerson?: string;
  contactRole?: string;
  website?: string;
  source?: 'manual' | 'woocommerce';
  tags?: string[];
  isActive: boolean;
  totalOrders: number;
  totalSpent: number;
  averageOrderValue: number;
  lastOrderDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
}

export interface ClientNote {
  id: string;
  clientId: string;
  content: string;
  createdAt: Date;
  createdBy: string;
  createdByName: string;
  isPinned?: boolean;
  isPrivate?: boolean;
}

export interface ClientSummary {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  totalOrders: number;
  totalSpent: number;
  isActive: boolean;
  lastOrderDate?: Date;
}

export interface ClientFilterOptions {
  search?: string;
  isActive?: boolean;
  tags?: string[];
  minTotalOrders?: number;
  minTotalSpent?: number;
  dateRange?: {
    start: Date;
    end: Date;
  };
}