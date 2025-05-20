import React, { useState, useEffect } from 'react';
import { Calendar, Filter, Download, Loader2, LineChart, BarChart2, PieChart, AlertTriangle, CheckCircle } from 'lucide-react';
import { collection, getDocs, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Order } from '../../types';
import { exportOrders } from '../../utils/reportUtils';
import { useAuth } from '../auth/AuthProvider';
import ReportTooltip from './ReportTooltip';
import FilterTag from './FilterTag';

/**
 * Sales Reports component to generate and display various sales-related reports
 */
const SalesReports: React.FC = () => {
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
  
  // State for filters
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedReportType, setSelectedReportType] = useState<string>('sales-over-time');
  const [selectedExportFormat, setSelectedExportFormat] = useState<'csv' | 'xlsx' | 'pdf' | 'json'>('csv');
  const [minTotal, setMinTotal] = useState<string>('');
  const [maxTotal, setMaxTotal] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  
  // State for data loading
  const [loading, setLoading] = useState<boolean>(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // State for sales data
  const [salesData, setSalesData] = useState<Order[]>([]);
  const [clients, setClients] = useState<Array<{id: string, name: string}>>([]);
  
  // Load clients for filter dropdown
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const clientsRef = collection(db, 'clients');
        const clientsSnapshot = await getDocs(clientsRef);
        
        const clientsData = clientsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }));
        
        setClients(clientsData);
      } catch (error) {
        console.error('Error fetching clients:', error);
      }
    };
    
    fetchClients();
  }, []);
  
  // Fetch sales data based on filters
  const generateReport = () => {
    setLoading(true);
    setError(null);
    
    // Create the query
    const fetchSalesData = async () => {
      try {
        // Convert ISO date strings to Date objects
        const startDateObj = new Date(startDate);
        startDateObj.setHours(0, 0, 0, 0); // Start of day
        
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999); // End of day
        
        // Base query
        const ordersRef = collection(db, 'orders');
        let q = query(
          ordersRef, 
          where('orderDate', '>=', Timestamp.fromDate(startDateObj)),
          where('orderDate', '<=', Timestamp.fromDate(endDateObj)),
          orderBy('orderDate', 'desc')
        );
        
        // Apply additional filters if selected
        if (selectedStatus) {
          q = query(q, where('status', '==', selectedStatus));
        }
        
        if (selectedPaymentMethod) {
          q = query(q, where('paymentMethod', '==', selectedPaymentMethod));
        }
        
        if (selectedSource) {
          q = query(q, where('source', '==', selectedSource));
        }
        
        if (selectedClient) {
          q = query(q, where('clientId', '==', selectedClient));
        }
        
        const querySnapshot = await getDocs(q);
        let ordersData = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          orderDate: doc.data().orderDate?.toDate() || new Date(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          ...(doc.data().fulfilledAt ? { fulfilledAt: doc.data().fulfilledAt.toDate() } : {})
        })) as Order[];
        
        // Apply total filters if provided
        if (minTotal !== '') {
          const min = parseFloat(minTotal);
          if (!isNaN(min)) {
            ordersData = ordersData.filter(order => order.total >= min);
          }
        }
        
        if (maxTotal !== '') {
          const max = parseFloat(maxTotal);
          if (!isNaN(max)) {
            ordersData = ordersData.filter(order => order.total <= max);
          }
        }
        
        // Sort data based on report type
        if (selectedReportType === 'sales-by-product') {
          // For sales by product, we might need additional processing
          // This is just a placeholder - actual implementation would depend on requirements
          ordersData.sort((a, b) => b.total - a.total);
        }
        
        setSalesData(ordersData);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching sales data:', error);
        setError('Failed to load sales data');
        setLoading(false);
      }
    };
    
    fetchSalesData();
  };
  
  const handleExport = async () => {
    if (!currentUser) {
      setError('You must be logged in to export data');
      return;
    }
    
    setExporting(true);
    setError(null);
    setSuccess(null);
    
    try {
      await exportOrders(
        selectedExportFormat,
        true, // includeHeaders
        {
          status: selectedStatus || undefined,
          paymentMethod: selectedPaymentMethod || undefined,
          source: selectedSource || undefined,
          clientId: selectedClient || undefined,
          minTotal: minTotal ? parseFloat(minTotal) : undefined,
          maxTotal: maxTotal ? parseFloat(maxTotal) : undefined,
          startDate,
          endDate
        },
        currentUser
      );
      
      setSuccess(`Export completed successfully. Your ${selectedExportFormat.toUpperCase()} file has been downloaded.`);
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 5000);
    } catch (error) {
      console.error('Error exporting data:', error);
      setError('Failed to export data. Please try again.');
    } finally {
      setExporting(false);
    }
  };
  
  const clearFilters = () => {
    setSelectedPaymentMethod('');
    setSelectedStatus('');
    setSelectedSource('');
    setMinTotal('');
    setMaxTotal('');
    setSelectedClient('');
  };
  
  // Check if any filter is active
  const hasActiveFilters = () => {
    return selectedPaymentMethod !== '' || 
           selectedStatus !== '' || 
           selectedSource !== '' || 
           minTotal !== '' || 
           maxTotal !== '' ||
           selectedClient !== '';
  };
  
  // Report type options
  const reportTypes = [
    { id: 'sales-over-time', name: 'Sales Over Time', description: 'Track sales trends over daily, weekly, or monthly periods', icon: <LineChart className="h-5 w-5" /> },
    { id: 'sales-by-product', name: 'Sales by Product', description: 'Analyze which products are generating the most revenue', icon: <BarChart2 className="h-5 w-5" /> },
    { id: 'payment-methods', name: 'Payment Method Analysis', description: 'Breakdown of sales by payment method', icon: <PieChart className="h-5 w-5" /> }
  ];
  
  // Export format options
  const exportFormats = [
    { id: 'csv', name: 'CSV', description: 'Comma-separated values, opens with Excel or Numbers' },
    { id: 'xlsx', name: 'Excel', description: 'Native Microsoft Excel format with formatting' },
    { id: 'pdf', name: 'PDF', description: 'Portable Document Format for viewing and printing' },
    { id: 'json', name: 'JSON', description: 'Structured data format for developers' }
  ];
  
  // Payment method options
  const paymentMethods = [
    { id: 'card', name: 'Credit Card' },
    { id: 'cash', name: 'Cash' },
    { id: 'bank_transfer', name: 'Bank Transfer' },
    { id: 'cod', name: 'Cash on Delivery' }
  ];
  
  // Order status options
  const orderStatuses = [
    { id: 'completed', name: 'Completed' },
    { id: 'processing', name: 'Processing' },
    { id: 'on-hold', name: 'On Hold' },
    { id: 'cancelled', name: 'Cancelled' },
    { id: 'refunded', name: 'Refunded' },
    { id: 'failed', name: 'Failed' },
    { id: 'preluata', name: 'Preluata' },
    { id: 'pregatita', name: 'Pregatita' },
    { id: 'expediata', name: 'Expediata' }
  ];
  
  // Order source options
  const orderSources = [
    { id: 'manual', name: 'Manual' },
    { id: 'woocommerce', name: 'WooCommerce' }
  ];
  
  // Calculate total sales amount
  const calculateTotalSales = () => {
    return salesData.reduce((sum, order) => sum + order.total, 0).toFixed(2);
  };
  
  // Calculate average order value
  const calculateAverageOrderValue = () => {
    if (salesData.length === 0) return '0.00';
    return (salesData.reduce((sum, order) => sum + order.total, 0) / salesData.length).toFixed(2);
  };

  // Get client name by ID
  const getClientName = (clientId?: string) => {
    if (!clientId) return 'N/A';
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown';
  };
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Sales Reports</h1>
        <p className="text-sm sm:text-base text-gray-600">Analyze your sales data and identify trends</p>
      </div>
      
      {/* Error and Success Messages */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}
      
      {/* Report Type Selection */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <h2 className="text-base sm:text-lg font-semibold mb-4">Select Report Type</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {reportTypes.map((report) => (
            <div 
              key={report.id}
              className={`p-3 border rounded-lg cursor-pointer transition-all ${
                selectedReportType === report.id
                  ? 'bg-indigo-50 border-indigo-300'
                  : 'bg-white border-gray-200 hover:bg-gray-50'
              }`}
              onClick={() => setSelectedReportType(report.id)}
            >
              <div className="flex items-start">
                <div className={`p-2 rounded-full ${
                  selectedReportType === report.id
                    ? 'bg-indigo-100 text-indigo-600'
                    : 'bg-gray-100 text-gray-500'
                } mr-3`}>
                  {report.icon}
                </div>
                <div>
                  <h3 className="text-sm font-medium">{report.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{report.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Report Filters */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base sm:text-lg font-semibold">Report Filters</h2>
          
          {hasActiveFilters() && (
            <button
              onClick={clearFilters}
              className="text-sm text-indigo-600 hover:text-indigo-900"
            >
              Clear All Filters
            </button>
          )}
        </div>
        
        {/* Active Filters */}
        {hasActiveFilters() && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedPaymentMethod && (
              <FilterTag
                label="Payment Method"
                value={paymentMethods.find(m => m.id === selectedPaymentMethod)?.name}
                onRemove={() => setSelectedPaymentMethod('')}
                color="indigo"
              />
            )}
            
            {selectedStatus && (
              <FilterTag
                label="Status"
                value={orderStatuses.find(s => s.id === selectedStatus)?.name}
                onRemove={() => setSelectedStatus('')}
                color="blue"
              />
            )}
            
            {selectedSource && (
              <FilterTag
                label="Source"
                value={orderSources.find(s => s.id === selectedSource)?.name}
                onRemove={() => setSelectedSource('')}
                color="purple"
              />
            )}
            
            {minTotal && (
              <FilterTag
                label="Min Total"
                value={`${minTotal} RON`}
                onRemove={() => setMinTotal('')}
                color="green"
              />
            )}
            
            {maxTotal && (
              <FilterTag
                label="Max Total"
                value={`${maxTotal} RON`}
                onRemove={() => setMaxTotal('')}
                color="red"
              />
            )}
            
            {selectedClient && (
              <FilterTag
                label="Client"
                value={getClientName(selectedClient)}
                onRemove={() => setSelectedClient('')}
                color="amber"
              />
            )}
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">
                <Calendar className="inline h-4 w-4 mr-1 text-gray-500" />
                Start Date
              </label>
              <div className="ml-1">
                <ReportTooltip
                  content="The beginning date for the report period"
                  position="top"
                />
              </div>
            </div>
            <input
              type="date"
              id="startDate"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">
                <Calendar className="inline h-4 w-4 mr-1 text-gray-500" />
                End Date
              </label>
              <div className="ml-1">
                <ReportTooltip
                  content="The ending date for the report period"
                  position="top"
                />
              </div>
            </div>
            <input
              type="date"
              id="endDate"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">
                <Filter className="inline h-4 w-4 mr-1 text-gray-500" />
                Payment Method
              </label>
              <div className="ml-1">
                <ReportTooltip
                  content="Filter orders by how they were paid"
                  position="top"
                />
              </div>
            </div>
            <select
              id="paymentMethod"
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All Methods</option>
              {paymentMethods.map(method => (
                <option key={method.id} value={method.id}>{method.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                <Filter className="inline h-4 w-4 mr-1 text-gray-500" />
                Order Status
              </label>
              <div className="ml-1">
                <ReportTooltip
                  content="Filter orders by their current status"
                  position="top"
                />
              </div>
            </div>
            <select
              id="status"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All Statuses</option>
              {orderStatuses.map(status => (
                <option key={status.id} value={status.id}>{status.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="source" className="block text-sm font-medium text-gray-700">
                <Filter className="inline h-4 w-4 mr-1 text-gray-500" />
                Order Source
              </label>
              <div className="ml-1">
                <ReportTooltip
                  content="Filter by where the order originated"
                  position="top"
                />
              </div>
            </div>
            <select
              id="source"
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All Sources</option>
              {orderSources.map(source => (
                <option key={source.id} value={source.id}>{source.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="client" className="block text-sm font-medium text-gray-700">
                <Filter className="inline h-4 w-4 mr-1 text-gray-500" />
                Client
              </label>
              <div className="ml-1">
                <ReportTooltip
                  content="Filter orders by specific client"
                  position="top"
                />
              </div>
            </div>
            <select
              id="client"
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="">All Clients</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="minTotal" className="block text-sm font-medium text-gray-700">
                <Filter className="inline h-4 w-4 mr-1 text-gray-500" />
                Min Total (RON)
              </label>
              <div className="ml-1">
                <ReportTooltip
                  content="Show only orders with total at or above this value"
                  position="top"
                />
              </div>
            </div>
            <input
              type="number"
              id="minTotal"
              value={minTotal}
              onChange={(e) => setMinTotal(e.target.value)}
              min="0"
              step="0.01"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
          
          <div>
            <div className="flex items-center mb-1">
              <label htmlFor="maxTotal" className="block text-sm font-medium text-gray-700">
                <Filter className="inline h-4 w-4 mr-1 text-gray-500" />
                Max Total (RON)
              </label>
              <div className="ml-1">
                <ReportTooltip
                  content="Show only orders with total at or below this value"
                  position="top"
                />
              </div>
            </div>
            <input
              type="number"
              id="maxTotal"
              value={maxTotal}
              onChange={(e) => setMaxTotal(e.target.value)}
              min="0"
              step="0.01"
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
        
        <div className="border-t border-gray-200 pt-4 mb-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Export Format</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {exportFormats.map(format => (
              <div 
                key={format.id}
                className={`border rounded-lg p-2 text-center cursor-pointer ${
                  selectedExportFormat === format.id 
                    ? 'bg-indigo-50 border-indigo-300' 
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => setSelectedExportFormat(format.id as any)}
              >
                <div className="text-xs font-medium">{format.name}</div>
                <div className="text-xs text-gray-500 mt-1">{format.description}</div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={handleExport}
            disabled={exporting || salesData.length === 0}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {exporting ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </>
            )}
          </button>
          
          <button
            onClick={generateReport}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-4 w-4 mr-2" />
                Generating...
              </>
            ) : (
              <>
                <BarChart2 className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Report Results */}
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-base sm:text-lg font-semibold">Report Results</h2>
          <div className="text-sm text-gray-500">
            {salesData.length > 0 ? `${salesData.length} orders found` : 'No data to display'}
          </div>
        </div>
        
        {/* Summary Cards */}
        {salesData.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="text-sm font-medium text-blue-700">Total Orders</div>
              <div className="text-2xl font-bold text-blue-800 mt-1">{salesData.length}</div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg border border-green-100">
              <div className="text-sm font-medium text-green-700">Total Sales</div>
              <div className="text-2xl font-bold text-green-800 mt-1">{calculateTotalSales()} RON</div>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
              <div className="text-sm font-medium text-purple-700">Avg. Order Value</div>
              <div className="text-2xl font-bold text-purple-800 mt-1">{calculateAverageOrderValue()} RON</div>
            </div>
          </div>
        )}
        
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mr-2" />
            <span className="text-gray-500">Generating report...</span>
          </div>
        ) : salesData.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <BarChart2 className="h-12 w-12 text-gray-300 mb-3" />
            <p>No data to display. Please generate a report.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order #
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salesData.map((order) => (
                  <tr key={order.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                      #{order.orderNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.orderDate.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {order.customerName}
                      {order.customerEmail && (
                        <div className="text-xs text-gray-500">{order.customerEmail}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        order.status === 'completed' ? 'bg-green-100 text-green-800' :
                        order.status === 'processing' || order.status === 'preluata' ? 'bg-blue-100 text-blue-800' :
                        order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {order.paymentMethod}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        order.source === 'woocommerce' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {order.source}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {order.items.length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.total.toFixed(2)} RON
                    </td>
                  </tr>
                ))}
              </tbody>
              {salesData.length > 0 && (
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={7} className="px-6 py-3 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                      Total:
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-900">
                      {calculateTotalSales()} RON
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
      
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
        <h3 className="text-sm font-semibold text-blue-800 mb-2">About Sales Reports</h3>
        <p className="text-sm text-blue-700">
          Sales reports help you analyze your sales performance, identify trends, and make data-driven decisions. You can filter by date range, payment method, and order status to get the specific insights you need.
        </p>
      </div>
    </div>
  );
};

export default SalesReports;