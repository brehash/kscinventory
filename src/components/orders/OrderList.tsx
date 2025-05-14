import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where, doc, updateDoc, getDoc, limit, startAfter, getCountFromServer } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Order, OrderStatus } from '../../types';
import { 
  Search, 
  Plus, 
  Filter, 
  CalendarIcon, 
  ArrowUp, 
  ArrowDown, 
  CheckCircle,
  Clock,
  Package,
  Truck,
  RefreshCw,
  XCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ReactPaginate from 'react-paginate';
import { format } from 'date-fns';
import { useAuth } from '../auth/AuthProvider';

const OrderList: React.FC = () => {
  const { currentUser } = useAuth();
  
  // State for orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for filters
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');
  const [selectedSource, setSelectedSource] = useState<'manual' | 'woocommerce' | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof Order>('orderDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);
  const [lastVisibleOrder, setLastVisibleOrder] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  
  // Date range filter
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Function to fetch orders
  useEffect(() => {
    fetchOrders(0);
  }, [sortDirection, sortField]);

  const fetchOrders = async (page = 0) => {
    if (page === 0) {
      setLastVisibleOrder(null);
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Create the base query collection
      let ordersRef = collection(db, 'orders');
      let baseQuery = ordersRef;
      
      // Apply filters
      const filters = [];
      
      // Status filter
      if (selectedStatus) {
        filters.push(where('status', '==', selectedStatus));
      }
      
      // Source filter
      if (selectedSource) {
        filters.push(where('source', '==', selectedSource));
      }
      
      // Date range filters
      if (startDate) {
        const startDateObj = new Date(startDate);
        startDateObj.setHours(0, 0, 0, 0); // Start of day
        filters.push(where('orderDate', '>=', startDateObj));
      }
      
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999); // End of day
        filters.push(where('orderDate', '<=', endDateObj));
      }
      
      // Apply filters to the base query
      if (filters.length > 0) {
        baseQuery = query(ordersRef, ...filters);
      }
      
      // Get total count for pagination
      const countSnapshot = await getCountFromServer(baseQuery);
      const totalCount = countSnapshot.data().count;
      setTotalOrders(totalCount);
      setPageCount(Math.ceil(totalCount / itemsPerPage));
      
      // Create the paged query
      let ordersQuery;
      
      // Set up pagination query
      if (page === 0) {
        // First page
        ordersQuery = query(
          baseQuery,
          orderBy(sortField, sortDirection),
          limit(itemsPerPage)
        );
      } else if (lastVisibleOrder) {
        // Subsequent pages
        ordersQuery = query(
          baseQuery,
          orderBy(sortField, sortDirection),
          startAfter(lastVisibleOrder),
          limit(itemsPerPage)
        );
      } else {
        // If we lost our lastVisibleOrder reference, start from beginning
        ordersQuery = query(
          baseQuery,
          orderBy(sortField, sortDirection),
          limit(itemsPerPage)
        );
        setCurrentPage(0);
      }
      
      const snapshot = await getDocs(ordersQuery);
      
      if (snapshot.empty) {
        setOrders([]);
        setLoading(false);
        return;
      }
      
      // Save the last document for pagination
      setLastVisibleOrder(snapshot.docs[snapshot.docs.length - 1]);
      
      const ordersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // Convert Firestore timestamps to Date objects
          orderDate: data.orderDate?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as Order;
      });
      
      // Apply search filter (client-side)
      let filteredOrders = ordersData;
      
      if (searchQuery) {
        const lowerCaseQuery = searchQuery.toLowerCase();
        filteredOrders = ordersData.filter(order => 
          order.orderNumber.toLowerCase().includes(lowerCaseQuery) || 
          order.customerName.toLowerCase().includes(lowerCaseQuery) || 
          (order.customerEmail && order.customerEmail.toLowerCase().includes(lowerCaseQuery))
        );
      }
      
      setOrders(filteredOrders);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders');
      setLoading(false);
    }
  };
  
  // Handle page change
  const handlePageClick = (event: { selected: number }) => {
    const newPage = event.selected;
    setCurrentPage(newPage);
    fetchOrders(newPage);
  };
  
  // Add keyboard navigation for pagination
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentPage > 0) {
        e.preventDefault();
        handlePageClick({ selected: currentPage - 1 });
      } else if (e.key === 'ArrowRight' && currentPage < pageCount - 1) {
        e.preventDefault();
        handlePageClick({ selected: currentPage + 1 });
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentPage, pageCount]);

  const handleToggleSortDirection = () => {
    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
  };
  
  const handleSortField = (field: keyof Order) => {
    if (field === sortField) {
      handleToggleSortDirection();
    } else {
      setSortField(field);
      setSortDirection('desc'); // Default to newest first when changing sort field
    }
  };
  
  const clearFilters = () => {
    setSelectedStatus('');
    setSelectedSource('');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
  };
  
  // Load orders when filters change
  useEffect(() => {
    if (!loading) {
      setCurrentPage(0);
      setLastVisibleOrder(null);
      fetchOrders(0);
    }
  }, [selectedStatus, selectedSource, startDate, endDate, searchQuery]);
  
  const getStatusBadge = (status: OrderStatus) => {
    const statusConfig: { [key in OrderStatus]: { bg: string, text: string, icon: JSX.Element } } = {
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock className="h-4 w-4 mr-1" /> },
      'processing': { bg: 'bg-blue-100', text: 'text-blue-800', icon: <RefreshCw className="h-4 w-4 mr-1" /> },
      'on-hold': { bg: 'bg-purple-100', text: 'text-purple-800', icon: <AlertTriangle className="h-4 w-4 mr-1" /> },
      'completed': { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle className="h-4 w-4 mr-1" /> },
      'cancelled': { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="h-4 w-4 mr-1" /> },
      'refunded': { bg: 'bg-gray-100', text: 'text-gray-800', icon: <RefreshCw className="h-4 w-4 mr-1" /> },
      'failed': { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="h-4 w-4 mr-1" /> },
      'preluata': { bg: 'bg-blue-100', text: 'text-blue-800', icon: <CheckCircle className="h-4 w-4 mr-1" /> },
      'impachetata': { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: <Package className="h-4 w-4 mr-1" /> },
      'expediata': { bg: 'bg-teal-100', text: 'text-teal-800', icon: <Truck className="h-4 w-4 mr-1" /> },
      'returnata': { bg: 'bg-amber-100', text: 'text-amber-800', icon: <RefreshCw className="h-4 w-4 mr-1" /> },
      'refuzata': { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="h-4 w-4 mr-1" /> }
    };
    
    const config = statusConfig[status];
    
    return (
      <span className={`${config.bg} ${config.text} px-2 py-1 rounded-full inline-flex items-center text-xs`}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Orders</h1>
          <p className="text-sm text-gray-600">Manage your customer orders</p>
        </div>
        <div className="flex space-x-2">
          <Link
            to="/orders/packingslip"
            className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Package className="h-4 w-4 mr-1.5" />
            Global Packing Slip
          </Link>
          <Link
            to="/orders/new"
            className="inline-flex items-center bg-indigo-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-md hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Order
          </Link>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-3 sm:p-4 border-b border-gray-200">
          <div className="flex flex-col space-y-3 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-9 sm:pl-10 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <div className="relative inline-block">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                </div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as OrderStatus)}
                  className="pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="preluata">Preluata</option>
                  <option value="impachetata">Impachetata</option>
                  <option value="expediata">Expediata</option>
                  <option value="returnata">Returnata</option>
                  <option value="refuzata">Refuzata</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded</option>
                  <option value="failed">Failed</option>
                  <option value="processing">Processing</option>
                </select>
              </div>
              
              <div className="relative inline-block">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                </div>
                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value as 'manual' | 'woocommerce' | '')}
                  className="pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">All Sources</option>
                  <option value="manual">Manual</option>
                  <option value="woocommerce">WooCommerce</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-2">
              <div className="relative flex items-center">
                <CalendarIcon className="h-4 w-4 text-gray-400 absolute left-3" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="Start date"
                />
              </div>
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="pl-3 pr-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="End date"
              />
            </div>
            
            <div className="flex items-center space-x-2 ml-auto">
              <button
                onClick={handleToggleSortDirection}
                className="inline-flex items-center px-2 py-1 bg-white border border-gray-300 rounded-md text-xs sm:text-sm text-gray-700 hover:bg-gray-50"
              >
                {sortDirection === 'desc' ? (
                  <>
                    <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">Newest First</span>
                  </>
                ) : (
                  <>
                    <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">Oldest First</span>
                  </>
                )}
              </button>
              
              {(selectedStatus || selectedSource || startDate || endDate || searchQuery) && (
                <button
                  onClick={clearFilters}
                  className="inline-flex items-center px-2 py-1 bg-indigo-50 border border-indigo-200 rounded-md text-xs sm:text-sm text-indigo-600 hover:bg-indigo-100"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  scope="col" 
                  className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSortField('orderNumber')}
                >
                  <div className="flex items-center">
                    <span>Order #</span>
                    {sortField === 'orderNumber' && (
                      sortDirection === 'asc' ? 
                      <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> : 
                      <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th 
                  scope="col" 
                  className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSortField('orderDate')}
                >
                  <div className="flex items-center">
                    <span>Date</span>
                    {sortField === 'orderDate' && (
                      sortDirection === 'asc' ? 
                      <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> : 
                      <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th 
                  scope="col" 
                  className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSortField('total')}
                >
                  <div className="flex items-center">
                    <span>Total</span>
                    {sortField === 'total' && (
                      sortDirection === 'asc' ? 
                      <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> : 
                      <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th scope="col" className="relative px-4 sm:px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders.length > 0 ? (
                orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <Link 
                        to={`/orders/${order.id}`}
                        className="font-medium text-indigo-600 hover:text-indigo-900"
                      >
                        #{order.orderNumber}
                      </Link>
                      {order.hasUnidentifiedItems && (
                        <span className="ml-1.5 inline-flex items-center">
                          <AlertTriangle className="h-4 w-4 text-amber-500" title="Has unidentified items" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm text-gray-500">
                      {format(order.orderDate, 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">{order.customerName}</div>
                      {order.customerEmail && (
                        <div className="text-xs text-gray-500">{order.customerEmail}</div>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        order.source === 'woocommerce' 
                          ? 'bg-teal-100 text-teal-800' 
                          : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {order.source === 'woocommerce' ? 'WooCommerce' : 'Manual'}
                      </span>
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-900">
                      {order.total.toFixed(2)} RON
                    </td>
                    <td className="px-4 sm:px-6 py-3 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Link
                          to={`/orders/${order.id}`}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 sm:px-6 py-4 text-center text-gray-500">
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {pageCount > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => handlePageClick({ selected: Math.max(0, currentPage - 1) })}
                disabled={currentPage === 0}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => handlePageClick({ selected: Math.min(pageCount - 1, currentPage + 1) })}
                disabled={currentPage === pageCount - 1}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{orders.length > 0 ? currentPage * itemsPerPage + 1 : 0}</span> to{' '}
                  <span className="font-medium">
                    {Math.min((currentPage + 1) * itemsPerPage, totalOrders)}
                  </span>{' '}
                  of <span className="font-medium">{totalOrders}</span> orders
                </p>
              </div>
              <div>
                <ReactPaginate
                  previousLabel={<ChevronLeft className="h-5 w-5" />}
                  nextLabel={<ChevronRight className="h-5 w-5" />}
                  breakLabel="..."
                  breakClassName="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700"
                  pageCount={pageCount}
                  marginPagesDisplayed={2}
                  pageRangeDisplayed={5}
                  onPageChange={handlePageClick}
                  containerClassName="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                  pageClassName="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  previousClassName="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  nextClassName="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50"
                  activeClassName="z-10 bg-indigo-50 border-indigo-500 text-indigo-600"
                  forcePage={currentPage}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderList;