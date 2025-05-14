import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, getDocs, where, limit, startAfter, getCountFromServer } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { DashboardStats, Product, LowStockAlert, OrderStats, OrdersByStatusData, OrdersByMonthData, Order } from '../../types';
import { format, parseISO, isValid, isBefore, isAfter, isSameDay, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Calendar, Filter, ArrowUp, ArrowDown, User, Clock, Activity, AlertCircle, Loader2, Edit, Trash, Plus, Minus, ChevronLeft, ChevronRight, Package, DollarSign, AlertTriangle, TrendingUp, ShoppingBag } from 'lucide-react';
import StatCard from './StatCard';
import LowStockAlerts from './LowStockAlerts';
import InventoryChart from './InventoryChart';
import { format, parseISO, isValid, isBefore, isAfter, isSameDay } from 'date-fns';
import { Calendar, Filter, ArrowUp, ArrowDown, User, Clock, Activity, AlertCircle, Loader2, Edit, Trash, Plus, Minus, ChevronLeft, ChevronRight } from 'lucide-react';
import ReactPaginate from 'react-paginate';
import { useNavigate } from 'react-router-dom';
import ValueByCategory from './ValueByCategory';
import ValueByLocation from './ValueByLocation';
import ValueByProductType from './ValueByProductType';
import ValueByProvider from './ValueByProvider';
import SellingValueByCategory from './SellingValueByCategory';
import SellingValueByLocation from './SellingValueByLocation';
import SellingValueByProductType from './SellingValueByProductType';
import SellingValueByProvider from './SellingValueByProvider';
import RecentActivity from './RecentActivity';
import OrderStatistics from './OrderStatistics';
import OrdersChart from './OrdersChart';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  // State for activity logs
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType | ''>('');
  const [selectedEntityType, setSelectedEntityType] = useState<ActivityEntityType | ''>('');
  const [users, setUsers] = useState<{id: string, name: string}[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [entityTypes, setEntityTypes] = useState<ActivityEntityType[]>([]);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // State for inventory stats
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalValue: 0,
    totalSellingValue: 0,
    profitMargin: 0,
    lowStockItems: 0,
    categoriesCount: 0
  });
  
  // State for order stats
  const [orderStats, setOrderStats] = useState<OrderStats>({
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    processingOrders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    averageOrderValue: 0
  });
  const [ordersByStatus, setOrdersByStatus] = useState<OrdersByStatusData[]>([]);
  const [ordersByMonth, setOrdersByMonth] = useState<OrdersByMonthData[]>([]);
  
  // State for low stock alerts
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  
  // Cost-based values (using cost price)
  const [valueByCategory, setValueByCategory] = useState<{ name: string; value: number }[]>([]);
  const [valueByLocation, setValueByLocation] = useState<{ name: string; value: number }[]>([]);
  const [valueByProductType, setValueByProductType] = useState<{ name: string; value: number }[]>([]);
  const [valueByProvider, setValueByProvider] = useState<{ name: string; value: number }[]>([]);
  
  // Selling-based values (using selling price)
  const [sellingValueByCategory, setSellingValueByCategory] = useState<{ name: string; value: number }[]>([]);
  const [sellingValueByLocation, setSellingValueByLocation] = useState<{ name: string; value: number }[]>([]);
  const [sellingValueByProductType, setSellingValueByProductType] = useState<{ name: string; value: number }[]>([]);
  const [sellingValueByProvider, setSellingValueByProvider] = useState<{ name: string; value: number }[]>([]);
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Get products
        const productsRef = collection(db, 'products');
        const productsSnapshot = await getDocs(productsRef);
        const products = productsSnapshot.docs.map(doc => doc.data() as Product);
        
        // Get categories count
        const categoriesRef = collection(db, 'categories');
        const categoriesSnapshot = await getDocs(categoriesRef);
        const categories = categoriesSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }));
        
        // Get locations
        const locationsRef = collection(db, 'locations');
        const locationsSnapshot = await getDocs(locationsRef);
        const locations = locationsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }));
        
        // Get product types
        const productTypesRef = collection(db, 'productTypes');
        const productTypesSnapshot = await getDocs(productTypesRef);
        const productTypes = productTypesSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }));
        
        // Get providers
        const providersRef = collection(db, 'providers');
        const providersSnapshot = await getDocs(providersRef);
        const providers = providersSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }));
        
        // Calculate stats
        // Total cost value (based on cost price)
        const totalCostValue = products.reduce((sum, product) => sum + ((product.cost || 0) * product.quantity), 0);
        
        // Total selling value (based on selling price)
        const totalSellingValue = products.reduce((sum, product) => sum + (product.price * product.quantity), 0);
        
        // Calculate overall profit margin
        const profitMargin = totalCostValue > 0 
          ? ((totalSellingValue - totalCostValue) / totalCostValue) * 100 
          : 0;
        
        const lowStockItems = products.filter(product => product.quantity <= product.minQuantity);
        
        // Set dashboard stats
        setStats({
          totalProducts: products.length,
          totalValue: totalCostValue,
          totalSellingValue: totalSellingValue,
          profitMargin: profitMargin,
          lowStockItems: lowStockItems.length,
          categoriesCount: categoriesSnapshot.size
        });
        
        // Calculate value by category (cost-based)
        const categoryValues = new Map<string, number>();
        const categorySellingValues = new Map<string, number>();
        
        products.forEach(product => {
          const costValue = (product.cost || 0) * product.quantity;
          const sellingValue = product.price * product.quantity;
          
          // Cost values
          categoryValues.set(
            product.categoryId, 
            (categoryValues.get(product.categoryId) || 0) + costValue
          );
          
          // Selling values
          categorySellingValues.set(
            product.categoryId, 
            (categorySellingValues.get(product.categoryId) || 0) + sellingValue
          );
        });
        
        // Calculate value by location (cost-based)
        const locationValues = new Map<string, number>();
        const locationSellingValues = new Map<string, number>();
        
        products.forEach(product => {
          const costValue = (product.cost || 0) * product.quantity;
          const sellingValue = product.price * product.quantity;
          
          // Cost values
          locationValues.set(
            product.locationId, 
            (locationValues.get(product.locationId) || 0) + costValue
          );
          
          // Selling values
          locationSellingValues.set(
            product.locationId, 
            (locationSellingValues.get(product.locationId) || 0) + sellingValue
          );
        });
        
        // Calculate value by product type (cost-based)
        const productTypeValues = new Map<string, number>();
        const productTypeSellingValues = new Map<string, number>();
        
        products.forEach(product => {
          const costValue = (product.cost || 0) * product.quantity;
          const sellingValue = product.price * product.quantity;
          
          // Cost values
          productTypeValues.set(
            product.typeId, 
            (productTypeValues.get(product.typeId) || 0) + costValue
          );
          
          // Selling values
          productTypeSellingValues.set(
            product.typeId, 
            (productTypeSellingValues.get(product.typeId) || 0) + sellingValue
          );
        });
        
        // Calculate value by provider (cost-based)
        const providerValues = new Map<string, number>();
        const providerSellingValues = new Map<string, number>();
        
        products.forEach(product => {
          if (product.providerId) {
            const costValue = (product.cost || 0) * product.quantity;
            const sellingValue = product.price * product.quantity;
            
            // Cost values
            providerValues.set(
              product.providerId, 
              (providerValues.get(product.providerId) || 0) + costValue
            );
            
            // Selling values
            providerSellingValues.set(
              product.providerId, 
              (providerSellingValues.get(product.providerId) || 0) + sellingValue
            );
          }
        });
        
        // Format data for charts (cost-based)
        const categoryData = Array.from(categoryValues.entries()).map(([id, value]) => {
          const category = categories.find(c => c.id === id);
          return {
            name: category ? category.name : 'Unknown',
            value: value
          };
        }).sort((a, b) => b.value - a.value);
        
        const locationData = Array.from(locationValues.entries()).map(([id, value]) => {
          const location = locations.find(l => l.id === id);
          return {
            name: location ? location.name : 'Unknown',
            value: value
          };
        }).sort((a, b) => b.value - a.value);
        
        const productTypeData = Array.from(productTypeValues.entries()).map(([id, value]) => {
          const productType = productTypes.find(pt => pt.id === id);
          return {
            name: productType ? productType.name : 'Unknown',
            value: value
          };
        }).sort((a, b) => b.value - a.value);
        
        const providerData = Array.from(providerValues.entries()).map(([id, value]) => {
          const provider = providers.find(p => p.id === id);
          return {
            name: provider ? provider.name : 'Unknown',
            value: value
          };
        }).sort((a, b) => b.value - a.value);
        
        // Format data for charts (selling-based)
        const categorySellingData = Array.from(categorySellingValues.entries()).map(([id, value]) => {
          const category = categories.find(c => c.id === id);
          return {
            name: category ? category.name : 'Unknown',
            value: value
          };
        }).sort((a, b) => b.value - a.value);
        
        const locationSellingData = Array.from(locationSellingValues.entries()).map(([id, value]) => {
          const location = locations.find(l => l.id === id);
          return {
            name: location ? location.name : 'Unknown',
            value: value
          };
        }).sort((a, b) => b.value - a.value);
        
        const productTypeSellingData = Array.from(productTypeSellingValues.entries()).map(([id, value]) => {
          const productType = productTypes.find(pt => pt.id === id);
          return {
            name: productType ? productType.name : 'Unknown',
            value: value
          };
        }).sort((a, b) => b.value - a.value);
        
        const providerSellingData = Array.from(providerSellingValues.entries()).map(([id, value]) => {
          const provider = providers.find(p => p.id === id);
          return {
            name: provider ? provider.name : 'Unknown',
            value: value
          };
        }).sort((a, b) => b.value - a.value);
        
        // Set state for cost-based values
        setValueByCategory(categoryData);
        setValueByLocation(locationData);
        setValueByProductType(productTypeData);
        setValueByProvider(providerData);
        
        // Set state for selling-based values
        setSellingValueByCategory(categorySellingData);
        setSellingValueByLocation(locationSellingData);
        setSellingValueByProductType(productTypeSellingData);
        setSellingValueByProvider(providerSellingData);
        
        // Set low stock alerts
        const alerts: LowStockAlert[] = [];
        for (const product of lowStockItems) {
          // Get location name
          const locationRef = collection(db, 'locations');
          const q = query(locationRef, where('id', '==', product.locationId));
          const locationSnapshot = await getDocs(q);
          const locationName = locationSnapshot.empty ? 'Unknown' : locationSnapshot.docs[0].data().name;
          
          alerts.push({
            id: product.id,
            productId: product.id,
            productName: product.name,
            currentQuantity: product.quantity,
            minQuantity: product.minQuantity,
            locationName: locationName
          });
        }
        setLowStockAlerts(alerts);
        
        // Fetch order data for statistics
        await fetchOrderStats();
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        setLoading(false);
      }
    };

    const fetchOrderStats = async () => {
      try {
        const ordersRef = collection(db, 'orders');
        const ordersSnapshot = await getDocs(ordersRef);
        
        if (ordersSnapshot.empty) {
          return;
        }

        const orders = ordersSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            orderDate: data.orderDate?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          } as Order;
        });

        // Calculate order stats
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // Count orders by status
        const pendingOrders = orders.filter(order => 
          order.status === 'pending' || 
          order.status === 'on-hold'
        ).length;
        
        const processingOrders = orders.filter(order => 
          order.status === 'processing' || 
          order.status === 'preluata' || 
          order.status === 'pregatita' || 
          order.status === 'impachetata'
        ).length;
        
        const completedOrders = orders.filter(order => 
          order.status === 'completed' || 
          order.status === 'expediata'
        ).length;
        
        const cancelledOrders = orders.filter(order => 
          order.status === 'cancelled' || 
          order.status === 'refunded' || 
          order.status === 'failed' || 
          order.status === 'returnata' ||
          order.status === 'refuzata' ||
          order.status === 'neonorata'
        ).length;

        setOrderStats({
          totalOrders,
          totalRevenue,
          pendingOrders,
          processingOrders,
          completedOrders,
          cancelledOrders,
          averageOrderValue
        });

        // Prepare data for order status chart
        const ordersByStatusData: OrdersByStatusData[] = [
          { name: 'Pending', value: pendingOrders, color: '#f59e0b' },
          { name: 'Processing', value: processingOrders, color: '#3b82f6' },
          { name: 'Completed', value: completedOrders, color: '#10b981' },
          { name: 'Cancelled', value: cancelledOrders, color: '#ef4444' }
        ];
        
        setOrdersByStatus(ordersByStatusData);

        // Prepare data for orders by month chart
        // Get last 6 months
        const today = new Date();
        const last6Months: Date[] = [];
        
        for (let i = 0; i < 6; i++) {
          last6Months.push(startOfMonth(subMonths(today, i)));
        }
        
        // Reverse to get chronological order
        last6Months.reverse();
        
        const monthlyData: OrdersByMonthData[] = last6Months.map(monthStart => {
          const monthEnd = endOfMonth(monthStart);
          const monthName = format(monthStart, 'MMM');
          
          const monthOrders = orders.filter(order => 
            order.orderDate >= monthStart && order.orderDate <= monthEnd
          );
          
          const count = monthOrders.length;
          const revenue = monthOrders.reduce((sum, order) => sum + order.total, 0);
          
          return {
            name: monthName,
            count,
            revenue
          };
        });
        
        setOrdersByMonth(monthlyData);

      } catch (error) {
        console.error('Error fetching order statistics:', error);
      }
    };

    fetchDashboardData();
    
    // Set up real-time listener for products collection
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      fetchDashboardData(); // Refresh dashboard data when products change
    });
    
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm sm:text-base text-gray-600">Overview of your inventory status</p>
      </div>

      {/* Inventory Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
        <StatCard 
          title="Total Products" 
          value={stats.totalProducts} 
          icon={<Package className="h-5 w-5 sm:h-6 sm:w-6" />}
          iconBg="bg-blue-100"
          iconColor="text-blue-600"
          tooltipText="Shows the total number of unique products in your inventory system. This count reflects all products registered in the database, regardless of their current quantity."
        />
        <StatCard 
          title="Profit Margin" 
          value={`${stats.profitMargin.toFixed(2)}%`} 
          icon={<TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />}
          iconBg="bg-amber-100"
          iconColor="text-amber-600"
          tooltipText="The overall profit margin across all inventory items. Calculated as the percentage difference between the total selling value and the total cost value."
        />

        <StatCard 
          title="Low Stock Items" 
          value={stats.lowStockItems} 
          icon={<AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />}
          iconBg="bg-red-100"
          iconColor="text-red-600"
          tooltipText="Number of products with stock levels at or below their minimum quantity threshold. These items may need to be reordered soon to prevent stockouts."
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
        <StatCard 
          title="Inventory Cost Value" 
          value={`${stats.totalValue.toLocaleString()} RON`} 
          icon={<DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />}
          iconBg="bg-green-100"
          iconColor="text-green-600"
          tooltipText="The total cost value of all inventory items. Calculated by multiplying each product's cost price by its current quantity and summing across all products in stock."
        />
        <StatCard 
          title="Selling Value" 
          value={`${stats.totalSellingValue.toLocaleString()} RON`} 
          icon={<DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />}
          iconBg="bg-purple-100"
          iconColor="text-purple-600"
          tooltipText="The total selling value of all inventory items. Calculated by multiplying each product's selling price by its current quantity and summing across all products in stock."
        />
      </div>
      
      {/* Order Statistics */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">Order Statistics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <StatCard 
            title="Total Orders" 
            value={orderStats.totalOrders} 
            icon={<ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" />}
            iconBg="bg-indigo-100"
            iconColor="text-indigo-600"
            tooltipText="The total number of orders in the system."
          />
          <StatCard 
            title="Total Revenue" 
            value={`${orderStats.totalRevenue.toLocaleString()} RON`} 
            icon={<DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />}
            iconBg="bg-green-100"
            iconColor="text-green-600"
            tooltipText="The total revenue from all orders."
          />
          <StatCard 
            title="Average Order Value" 
            value={`${orderStats.averageOrderValue.toLocaleString()} RON`} 
            icon={<DollarSign className="h-5 w-5 sm:h-6 sm:w-6" />}
            iconBg="bg-amber-100"
            iconColor="text-amber-600"
            tooltipText="The average value of all orders."
          />
          <StatCard 
            title="Processing Orders" 
            value={orderStats.processingOrders} 
            icon={<ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" />}
            iconBg="bg-blue-100"
            iconColor="text-blue-600"
            tooltipText="The number of orders currently being processed."
          />
        </div>
      </div>
      
      {/* Order Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Orders by Status</h3>
          <OrderStatistics data={ordersByStatus} />
        </div>
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Orders by Month</h3>
          <OrdersChart data={ordersByMonth} />
        </div>
      </div>
      
      {/* Cost Value Analysis */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">Cost Value Analysis</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div>
            <div className="bg-white p-3 sm:p-6 rounded-lg border border-gray-200 h-full">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Cost by Location</h3>
              <ValueByLocation data={valueByLocation} />
            </div>
          </div>
          <div>
            <div className="bg-white p-3 sm:p-6 rounded-lg border border-gray-200 h-full">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Cost by Product Type</h3>
              <ValueByProductType data={valueByProductType} />
            </div>
          </div>
          <div>
            <div className="bg-white p-3 sm:p-6 rounded-lg border border-gray-200 h-full">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Cost by Category</h3>
              <ValueByCategory data={valueByCategory} />
            </div>
          </div>
          <div>
            <div className="bg-white p-3 sm:p-6 rounded-lg border border-gray-200 h-full">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Cost by Provider</h3>
              <ValueByProvider data={valueByProvider} />
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6">Selling Value Analysis</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <div>
            <div className="bg-white p-3 sm:p-6 rounded-lg border border-gray-200 h-full">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Selling by Location</h3>
              <SellingValueByLocation data={sellingValueByLocation} />
            </div>
          </div>
          <div>
            <div className="bg-white p-3 sm:p-6 rounded-lg border border-gray-200 h-full">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Selling by Product Type</h3>
              <SellingValueByProductType data={sellingValueByProductType} />
            </div>
          </div>
          <div>
            <div className="bg-white p-3 sm:p-6 rounded-lg border border-gray-200 h-full">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Selling by Category</h3>
              <SellingValueByCategory data={sellingValueByCategory} />
            </div>
          </div>
          <div>
            <div className="bg-white p-3 sm:p-6 rounded-lg border border-gray-200 h-full">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Selling by Provider</h3>
              <SellingValueByProvider data={sellingValueByProvider} />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm h-full">
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Inventory Overview</h2>
            <InventoryChart />
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
        <div>
          <LowStockAlerts alerts={lowStockAlerts} />
        </div>
        <div>
          <RecentActivity />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;