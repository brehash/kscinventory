import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart2, 
  TrendingUp, 
  Package, 
  DollarSign, 
  Calendar, 
  Loader2,
  RefreshCw,
  AlertTriangle,
  Users,
  Download,
  ShoppingBag
} from 'lucide-react';
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Product, Order, LowStockAlert } from '../../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useAuth } from '../auth/AuthProvider';
import { exportDashboardAsPDF, domToImage } from '../../utils/reportUtils';
import ReportCard from './ReportCard';

/**
 * Reports Dashboard component to display key metrics and reports in a visual dashboard
 */
const ReportsDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  // State for date range
  const [startDate, setStartDate] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  
  // State for data loading
  const [loading, setLoading] = useState<boolean>(true);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for dashboard metrics
  const [totalProducts, setTotalProducts] = useState<number>(0);
  const [totalValue, setTotalValue] = useState<number>(0);
  const [totalSales, setTotalSales] = useState<number>(0);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [totalClients, setTotalClients] = useState<number>(0);
  
  // State for chart data
  const [salesByDayData, setSalesByDayData] = useState<any[]>([]);
  const [productCategoryData, setProductCategoryData] = useState<any[]>([]);
  const [salesTrendData, setSalesTrendData] = useState<any[]>([]);
  
  // Refs for chart DOM elements (for PDF export)
  const salesChartRef = useRef<HTMLDivElement>(null);
  const categoryChartRef = useRef<HTMLDivElement>(null);
  const trendChartRef = useRef<HTMLDivElement>(null);

  // Fetch dashboard data
  useEffect(() => {
    fetchDashboardData();
  }, []);
  
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch product data for inventory metrics
      const productsRef = collection(db, 'products');
      const productsSnapshot = await getDocs(productsRef);
      const products = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      
      // Calculate inventory metrics
      setTotalProducts(products.length);
      const totalInventoryValue = products.reduce((sum, product) => {
        return sum + (product.cost || 0) * product.quantity;
      }, 0);
      setTotalValue(totalInventoryValue);
      
      // Count low stock items
      const lowStockItems = products.filter(product => 
        product.quantity <= product.minQuantity
      );
      setLowStockCount(lowStockItems.length);
      
      // Prepare data for product category chart
      const categoryMap = new Map<string, { name: string, value: number }>();
      
      // Fetch categories first
      const categoriesRef = collection(db, 'categories');
      const categoriesSnapshot = await getDocs(categoriesRef);
      const categories = new Map();
      categoriesSnapshot.docs.forEach(doc => {
        categories.set(doc.id, doc.data().name);
      });
      
      // Group products by category
      products.forEach(product => {
        const categoryId = product.categoryId;
        const categoryName = categories.get(categoryId) || 'Unknown';
        
        if (categoryMap.has(categoryId)) {
          const category = categoryMap.get(categoryId)!;
          category.value += 1;
          categoryMap.set(categoryId, category);
        } else {
          categoryMap.set(categoryId, { name: categoryName, value: 1 });
        }
      });
      
      // Convert map to array for chart data
      setProductCategoryData(Array.from(categoryMap.values()));
      
      // Fetch order data for sales metrics
      const ordersRef = collection(db, 'orders');
      
      // Convert ISO date strings to Date objects for the query
      const startDateObj = new Date(startDate);
      startDateObj.setHours(0, 0, 0, 0); // Start of day
      
      const endDateObj = new Date(endDate);
      endDateObj.setHours(23, 59, 59, 999); // End of day
      
      const ordersQuery = query(
        ordersRef,
        where('orderDate', '>=', Timestamp.fromDate(startDateObj)),
        where('orderDate', '<=', Timestamp.fromDate(endDateObj)),
        orderBy('orderDate', 'desc')
      );
      
      const ordersSnapshot = await getDocs(ordersQuery);
      const orders = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderDate: doc.data().orderDate?.toDate() || new Date(),
      })) as Order[];
      
      // Calculate sales metrics
      setTotalOrders(orders.length);
      const totalOrdersValue = orders.reduce((sum, order) => sum + order.total, 0);
      setTotalSales(totalOrdersValue);
      
      // Prepare data for sales by day chart
      // Group orders by day for the chart
      const salesByDay = new Map<string, number>();
      
      // Get the last 7 days
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateString = date.toISOString().split('T')[0];
        salesByDay.set(dateString, 0);
      }
      
      // Fill in the sales data
      orders.forEach(order => {
        const orderDate = order.orderDate.toISOString().split('T')[0];
        if (salesByDay.has(orderDate)) {
          salesByDay.set(orderDate, (salesByDay.get(orderDate) || 0) + order.total);
        }
      });
      
      // Convert map to array for chart data
      const chartData = Array.from(salesByDay.entries()).map(([date, total]) => ({
        date,
        total
      }));
      
      setSalesByDayData(chartData);
      
      // Generate sales trend data (monthly)
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const salesByMonth = new Map<string, {revenue: number, count: number}>();
      
      // Initialize with last 6 months
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${months[date.getMonth()]} ${date.getFullYear()}`;
        salesByMonth.set(monthKey, {revenue: 0, count: 0});
      }
      
      // Get all orders from the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      sixMonthsAgo.setHours(0, 0, 0, 0);
      
      const trendQuery = query(
        ordersRef,
        where('orderDate', '>=', Timestamp.fromDate(sixMonthsAgo)),
        orderBy('orderDate', 'asc')
      );
      
      const trendSnapshot = await getDocs(trendQuery);
      const trendOrders = trendSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        orderDate: doc.data().orderDate?.toDate() || new Date(),
      })) as Order[];
      
      // Fill in monthly data
      trendOrders.forEach(order => {
        const orderDate = order.orderDate;
        const monthKey = `${months[orderDate.getMonth()]} ${orderDate.getFullYear()}`;
        
        if (salesByMonth.has(monthKey)) {
          const data = salesByMonth.get(monthKey)!;
          data.revenue += order.total;
          data.count += 1;
          salesByMonth.set(monthKey, data);
        }
      });
      
      // Convert to array for chart
      const trendData = Array.from(salesByMonth.entries()).map(([month, data]) => ({
        month,
        revenue: data.revenue,
        count: data.count
      }));
      
      setSalesTrendData(trendData);
      
      // Fetch client count
      const clientsRef = collection(db, 'clients');
      const clientsSnapshot = await getDocs(clientsRef);
      setTotalClients(clientsSnapshot.size);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Failed to load dashboard data');
      setLoading(false);
    }
  };
  
  // Export dashboard as PDF
  const exportDashboard = async () => {
    if (!currentUser) return;
    
    try {
      setExporting(true);
      
      // Capture chart images
      const chartImages: string[] = [];
      
      if (salesChartRef.current) {
        const salesChartImage = await domToImage(salesChartRef.current);
        chartImages.push(salesChartImage);
      }
      
      if (categoryChartRef.current) {
        const categoryChartImage = await domToImage(categoryChartRef.current);
        chartImages.push(categoryChartImage);
      }
      
      if (trendChartRef.current) {
        const trendChartImage = await domToImage(trendChartRef.current);
        chartImages.push(trendChartImage);
      }
      
      // Prepare dashboard data
      const dashboardData = {
        title: "Inventory Management System Dashboard",
        subtitle: `Report Period: ${startDate} to ${endDate}`,
        date: new Date().toLocaleString(),
        stats: {
          totalProducts,
          totalValue,
          lowStockCount,
          totalSales,
          totalOrders,
          totalClients
        },
        chartImages
      };
      
      // Generate and download the PDF
      await exportDashboardAsPDF(dashboardData, currentUser);
      
    } catch (error) {
      console.error('Error exporting dashboard:', error);
      setError('Failed to export dashboard. Please try again.');
    } finally {
      setExporting(false);
    }
  };
  
  // COLORS for pie chart
  const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mr-2" />
        <span className="text-gray-500">Loading dashboard data...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 sm:p-6">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500 mr-2" />
          <p className="text-sm sm:text-base text-red-700">{error}</p>
        </div>
        <button 
          onClick={fetchDashboardData}
          className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Reports Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600">Overview of key metrics and performance indicators</p>
        </div>
        
        <div className="flex items-center mt-3 sm:mt-0 space-x-2">
          <button
            onClick={fetchDashboardData}
            className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </button>
          
          <button
            onClick={exportDashboard}
            disabled={exporting}
            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-1.5" />
                Export to PDF
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Total Products */}
        <ReportCard
          title="Total Products"
          value={totalProducts}
          icon={<Package className="h-5 w-5" />}
          color="indigo"
          tooltip="The total number of unique product items in your inventory system"
        />
        
        {/* Inventory Value */}
        <ReportCard
          title="Inventory Value"
          value={`${totalValue.toLocaleString()} RON`}
          icon={<DollarSign className="h-5 w-5" />}
          color="green"
          tooltip="The total cost value of all items currently in your inventory, calculated using cost price"
        />
        
        {/* Low Stock Items */}
        <ReportCard
          title="Low Stock Items"
          value={lowStockCount}
          icon={<AlertTriangle className="h-5 w-5" />}
          color="yellow"
          tooltip="The number of products with quantity at or below their minimum stock threshold, requiring attention"
        />
        
        {/* Total Sales */}
        <ReportCard
          title="Total Sales"
          value={`${totalSales.toLocaleString()} RON`}
          icon={<DollarSign className="h-5 w-5" />}
          color="purple"
          tooltip="Total revenue from all orders within the selected date range"
        />
        
        {/* Total Orders */}
        <ReportCard
          title="Total Orders"
          value={totalOrders}
          icon={<ShoppingBag className="h-5 w-5" />}
          color="blue"
          tooltip="The number of orders processed within the selected date range"
        />
        
        {/* Total Clients */}
        <ReportCard
          title="Total Clients"
          value={totalClients}
          icon={<Users className="h-5 w-5" />}
          color="teal"
          tooltip="Total number of clients in your CRM system"
        />
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Sales Over Time Chart */}
        <div ref={salesChartRef} className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
          <h2 className="text-base font-semibold mb-4">Sales Last 7 Days</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={salesByDayData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value) => [`${value} RON`, 'Sales']} />
                <Bar dataKey="total" fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Product Categories Chart */}
        <div ref={categoryChartRef} className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
          <h2 className="text-base font-semibold mb-4">Products by Category</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={productCategoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  label={(entry) => entry.name}
                >
                  {productCategoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value} products`, 'Count']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Monthly Sales Trend */}
        <div ref={trendChartRef} className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-lg shadow-sm">
          <h2 className="text-base font-semibold mb-4">Monthly Sales Trend</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis yAxisId="left" orientation="left" stroke="#4f46e5" />
                <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                <Tooltip />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#4f46e5" name="Revenue (RON)" />
                <Line yAxisId="right" type="monotone" dataKey="count" stroke="#10b981" name="Order Count" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Date Filter */}
      <div className="bg-white p-4 rounded-lg shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center">
          <h2 className="text-base font-semibold mb-4 sm:mb-0">Date Range Filter</h2>
          
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center">
              <label htmlFor="dashboardStartDate" className="text-sm text-gray-500 mr-2">From:</label>
              <input
                type="date"
                id="dashboardStartDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <div className="flex items-center">
              <label htmlFor="dashboardEndDate" className="text-sm text-gray-500 mr-2">To:</label>
              <input
                type="date"
                id="dashboardEndDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            
            <button
              onClick={fetchDashboardData}
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportsDashboard;