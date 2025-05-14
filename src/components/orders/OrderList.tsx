import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  updateDoc, 
  writeBatch,
  Timestamp,
  limit,
  startAfter,
  getCountFromServer,
  deleteDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Order, OrderStatus, UnidentifiedItem } from '../../types';
import { 
  Plus, 
  Search, 
  Filter, 
  RefreshCw, 
  ShoppingBag, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  ArrowRight, 
  Printer,
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  Truck,
  Package,
  FileBox,
  Check,
  Loader2,
  AlertTriangle,
  Trash
} from 'lucide-react';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { useAuth } from '../auth/AuthProvider';
import Modal from '../ui/Modal';
import { syncWooCommerceOrders, updateOrderStatusOnWooCommerce } from '../../utils/wooCommerceSync';
import ReactPaginate from 'react-paginate';
import { logActivity } from '../../utils/activityLogger';

const OrderList: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<'manual' | 'woocommerce' | 'all'>('all');
  const [unidentifiedFilter, setUnidentifiedFilter] = useState<'all' | 'unidentified'>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [sortField, setSortField] = useState<keyof Order>('orderDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);
  const [lastVisibleOrder, setLastVisibleOrder] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  
  // Modal states
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{
    success: boolean, 
    message: string,
    ordersWithUnidentifiedItems?: number
  } | null>(null);
  
  // Bulk editing states
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>('processing');
  const [isUpdatingBulk, setIsUpdatingBulk] = useState(false);
  const [bulkUpdateResult, setBulkUpdateResult] = useState<{
    success: number;
    failed: number;
    errorMessage?: string;
  } | null>(null);
  
  // Bulk delete states
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const [bulkDeleteResult, setBulkDeleteResult] = useState<{
    success: number;
    failed: number;
    errorMessage?: string;
  } | null>(null);

  // Unidentified product modal
  const [showUnidentifiedItemModal, setShowUnidentifiedItemModal] = useState(false);
  const [selectedUnidentifiedItem, setSelectedUnidentifiedItem] = useState<UnidentifiedItem | null>(null);
  
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    fetchOrders(0);
  }, [sortField, sortDirection]);
  
  const fetchOrders = async (page = 0) => {
    try {
      setLoading(true);
      
      // Create a base query for filtering
      let ordersRef = collection(db, 'orders');
      let baseQuery = ordersRef;
      
      // Apply filters to base query
      const filters = [];
      
      if (statusFilter !== 'all') {
        filters.push(where('status', '==', statusFilter));
      }
      
      if (sourceFilter !== 'all') {
        filters.push(where('source', '==', sourceFilter));
      }
      
      if (unidentifiedFilter === 'unidentified') {
        filters.push(where('hasUnidentifiedItems', '==', true));
      }
      
      // Date range filters
      if (startDate) {
        const startDateObj = startOfDay(parseISO(startDate));
        filters.push(where('orderDate', '>=', startDateObj));
      }
      
      if (endDate) {
        const endDateObj = endOfDay(parseISO(endDate));
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
      
      const querySnapshot = await getDocs(ordersQuery);
      
      if (querySnapshot.empty) {
        setOrders([]);
        setFilteredOrders([]);
        setLastVisibleOrder(null);
        setLoading(false);
        return;
      }
      
      // Save the last document for pagination
      setLastVisibleOrder(querySnapshot.docs[querySnapshot.docs.length - 1]);
      
      // Process the orders data
      const ordersData = querySnapshot.docs.map(doc => {
        const data = doc.data();
        
        // Convert Firestore timestamps to Date objects
        return {
          ...data,
          id: doc.id,
          orderDate: data.orderDate?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          fulfilledAt: data.fulfilledAt?.toDate() || undefined
        } as Order;
      });
      
      setOrders(ordersData);
      
      // Apply search filter (client-side)
      if (searchQuery) {
        const lowerCaseQuery = searchQuery.toLowerCase();
        const filtered = ordersData.filter(order => 
          order.orderNumber.toLowerCase().includes(lowerCaseQuery) ||
          order.customerName.toLowerCase().includes(lowerCaseQuery) ||
          (order.customerEmail && order.customerEmail.toLowerCase().includes(lowerCaseQuery))
        );
        setFilteredOrders(filtered);
      } else {
        setFilteredOrders(ordersData);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders. Please try again.');
      setLoading(false);
    }
  };
  
  // Handler for page change
  const handlePageClick = (event: { selected: number }) => {
    const newPage = event.selected;
    setCurrentPage(newPage);
    fetchOrders(newPage);
  };
  
  // Handler for sorting
  const handleSort = (field: keyof Order) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Apply filters
  useEffect(() => {
    if (!loading) {
      setCurrentPage(0);
      setLastVisibleOrder(null);
      fetchOrders(0);
    }
  }, [statusFilter, sourceFilter, unidentifiedFilter, startDate, endDate]);
  
  // Apply search filter client-side
  useEffect(() => {
    if (searchQuery) {
      const lowerCaseQuery = searchQuery.toLowerCase();
      const filtered = orders.filter(order => 
        order.orderNumber.toLowerCase().includes(lowerCaseQuery) ||
        order.customerName.toLowerCase().includes(lowerCaseQuery) ||
        (order.customerEmail && order.customerEmail.toLowerCase().includes(lowerCaseQuery))
      );
      setFilteredOrders(filtered);
    } else {
      setFilteredOrders(orders);
    }
  }, [orders, searchQuery]);
  
  // Handle WooCommerce sync
  const handleSyncOrders = async () => {
    if (!currentUser) return;
    
    try {
      setSyncing(true);
      setSyncResult(null);
      
      // Sync WooCommerce orders
      const result = await syncWooCommerceOrders(currentUser);
      
      if (result.success) {
        // Refresh orders after sync
        setCurrentPage(0);
        setLastVisibleOrder(null);
        await fetchOrders(0);
        
        setSyncResult({
          success: true,
          message: `Successfully synced ${result.newOrders} new orders and updated ${result.updatedOrders} existing orders.`,
          ordersWithUnidentifiedItems: result.ordersWithUnidentifiedItems
        });
      } else {
        setSyncResult({
          success: false,
          message: result.error || 'Error syncing orders.'
        });
      }
    } catch (err) {
      console.error('Error syncing orders:', err);
      setSyncResult({
        success: false,
        message: 'An unexpected error occurred while syncing orders.'
      });
    } finally {
      setSyncing(false);
    }
  };
  
  // Mark an order as fulfilled
  const markAsFulfilled = async (orderId: string) => {
    if (!currentUser) return;
    
    try {
      const orderRef = doc(db, 'orders', orderId);
      
      await updateDoc(orderRef, {
        status: 'completed',
        fulfilledAt: new Date(),
        fulfilledBy: currentUser.displayName || currentUser.email,
        updatedAt: new Date()
      });
      
      // Update the order in the local state
      setOrders(orders.map(order => {
        if (order.id === orderId) {
          return {
            ...order,
            status: 'completed',
            fulfilledAt: new Date(),
            fulfilledBy: currentUser.displayName || currentUser.email,
            updatedAt: new Date()
          };
        }
        return order;
      }));
      
      // Also update filtered orders
      setFilteredOrders(filteredOrders.map(order => {
        if (order.id === orderId) {
          return {
            ...order,
            status: 'completed',
            fulfilledAt: new Date(),
            fulfilledBy: currentUser.displayName || currentUser.email,
            updatedAt: new Date()
          };
        }
        return order;
      }));
      
    } catch (err) {
      console.error('Error marking order as fulfilled:', err);
      setError('Failed to update order status. Please try again.');
    }
  };
  
  // Bulk Actions
  
  // Toggle selection of a single order
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders(prevSelected => {
      if (prevSelected.includes(orderId)) {
        return prevSelected.filter(id => id !== orderId);
      } else {
        return [...prevSelected, orderId];
      }
    });
  };
  
  // Toggle selection of all orders on current page
  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      // If all are selected, unselect all
      setSelectedOrders([]);
    } else {
      // Otherwise select all
      setSelectedOrders(filteredOrders.map(order => order.id));
    }
  };
  
  // Perform bulk status update
  const performBulkStatusUpdate = async () => {
    if (!currentUser || selectedOrders.length === 0) return;
    
    setIsUpdatingBulk(true);
    setBulkUpdateResult(null);
    
    try {
      const batch = writeBatch(db);
      let successCount = 0;
      let failedCount = 0;
      
      // For WooCommerce orders that need to be updated
      const wooCommerceUpdates = [];
      
      // Process each selected order
      for (const orderId of selectedOrders) {
        try {
          // Get the order to check if it's from WooCommerce
          const orderDoc = await doc(db, 'orders', orderId);
          const orderSnap = await doc(db, 'orders', orderId);
          const orderData = (await getDocs(query(collection(db, 'orders'), where('__name__', '==', orderId)))).docs[0]?.data() as Order;
          
          if (orderData) {
            // Update order in Firestore batch
            batch.update(doc(db, 'orders', orderId), {
              status: bulkStatus,
              updatedAt: new Date()
            });
            
            // If it's a WooCommerce order, queue up the API update
            if (orderData.source === 'woocommerce' && orderData.woocommerceId) {
              wooCommerceUpdates.push({
                id: orderId,
                woocommerceId: orderData.woocommerceId,
                orderNumber: orderData.orderNumber
              });
            }
          } else {
            failedCount++;
          }
        } catch (error) {
          console.error(`Error preparing update for order ${orderId}:`, error);
          failedCount++;
        }
      }
      
      // Commit the batch update
      await batch.commit();
      successCount = selectedOrders.length - failedCount;
      
      // Update WooCommerce orders
      for (const order of wooCommerceUpdates) {
        try {
          await updateOrderStatusOnWooCommerce(order.woocommerceId, bulkStatus);
          
          // Log activity for each successfully updated order
          await logActivity(
            'updated',
            'order',
            order.id,
            `Order #${order.orderNumber}`,
            currentUser
          );
        } catch (error) {
          console.error(`Error updating WooCommerce order ${order.woocommerceId}:`, error);
          // We don't count this as a failure since Firestore was updated successfully
        }
      }
      
      // Refresh the order list
      await fetchOrders(currentPage);
      
      // Set the result
      setBulkUpdateResult({
        success: successCount,
        failed: failedCount
      });
      
      // Clear selections after successful update
      if (successCount > 0) {
        setSelectedOrders([]);
        setShowBulkEditModal(false);
      }
    } catch (error) {
      console.error('Error in bulk update:', error);
      setBulkUpdateResult({
        success: 0,
        failed: selectedOrders.length,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsUpdatingBulk(false);
    }
  };
  
  // Perform bulk delete
  const performBulkDelete = async () => {
    if (!currentUser || selectedOrders.length === 0) return;
    
    setIsDeletingBulk(true);
    setBulkDeleteResult(null);
    
    try {
      const batch = writeBatch(db);
      let successCount = 0;
      let failedCount = 0;
      
      // Process each selected order
      for (const orderId of selectedOrders) {
        try {
          // Get order details for logging
          const orderDoc = await getDoc(doc(db, 'orders', orderId));
          
          if (orderDoc.exists()) {
            const orderData = orderDoc.data() as Order;
            
            // Add delete operation to batch
            batch.delete(doc(db, 'orders', orderId));
            
            // Log activity
            await logActivity(
              'deleted',
              'order',
              orderId,
              `Order #${orderData.orderNumber}`,
              currentUser
            );
            
            successCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          console.error(`Error preparing delete for order ${orderId}:`, error);
          failedCount++;
        }
      }
      
      // Commit the batch
      await batch.commit();
      
      // Update UI state
      setOrders(orders.filter(order => !selectedOrders.includes(order.id)));
      setFilteredOrders(filteredOrders.filter(order => !selectedOrders.includes(order.id)));
      
      // Update total count
      setTotalOrders(prevTotal => prevTotal - successCount);
      
      // Recalculate page count
      setPageCount(Math.ceil((totalOrders - successCount) / itemsPerPage));
      
      // Set result for user feedback
      setBulkDeleteResult({
        success: successCount,
        failed: failedCount
      });
      
      // Clear selections after successful delete
      if (successCount > 0) {
        setSelectedOrders([]);
        setShowBulkDeleteModal(false);
        
        // If we deleted all items on the current page and we're not on the first page,
        // go to the previous page
        if (filteredOrders.length === successCount && currentPage > 0) {
          setCurrentPage(currentPage - 1);
          fetchOrders(currentPage - 1);
        } else {
          // Otherwise refresh the current page
          fetchOrders(currentPage);
        }
      }
    } catch (error) {
      console.error('Error in bulk delete:', error);
      setBulkDeleteResult({
        success: 0,
        failed: selectedOrders.length,
        errorMessage: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setIsDeletingBulk(false);
    }
  };
  
  // Reset bulk update state
  const resetBulkUpdate = () => {
    setShowBulkEditModal(false);
    setBulkStatus('processing');
    setBulkUpdateResult(null);
  };

  // Reset bulk delete state
  const resetBulkDelete = () => {
    setShowBulkDeleteModal(false);
    setBulkDeleteResult(null);
  };

  // Handle unidentified item selection for product creation
  const handleCreateProductFromUnidentifiedItem = (item: UnidentifiedItem) => {
    setSelectedUnidentifiedItem(item);
    setShowUnidentifiedItemModal(true);
  };

  // Navigate to create product page with unidentified item data
  const navigateToCreateProduct = () => {
    if (!selectedUnidentifiedItem) return;
    
    // Create query params with item details
    const params = new URLSearchParams();
    params.append('name', selectedUnidentifiedItem.name);
    params.append('barcode', selectedUnidentifiedItem.sku);
    params.append('price', selectedUnidentifiedItem.price.toString());
    
    // Navigate to product creation page with params
    navigate(`/products/new?${params.toString()}`);
    
    // Close modal
    setShowUnidentifiedItemModal(false);
    setSelectedUnidentifiedItem(null);
  };
  
  // Get status badge component
  const getStatusBadge = (status: OrderStatus) => {
    const statusConfig = {
      'pending': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: <Clock className="h-3 w-3 mr-1" /> },
      'processing': { bg: 'bg-blue-100', text: 'text-blue-800', icon: <RefreshCw className="h-3 w-3 mr-1" /> },
      'on-hold': { bg: 'bg-purple-100', text: 'text-purple-800', icon: <AlertCircle className="h-3 w-3 mr-1" /> },
      'completed': { bg: 'bg-green-100', text: 'text-green-800', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      'cancelled': { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="h-3 w-3 mr-1" /> },
      'refunded': { bg: 'bg-gray-100', text: 'text-gray-800', icon: <ArrowDown className="h-3 w-3 mr-1" /> },
      'failed': { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="h-3 w-3 mr-1" /> },
      'preluata': { bg: 'bg-blue-100', text: 'text-blue-800', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      'impachetata': { bg: 'bg-indigo-100', text: 'text-indigo-800', icon: <Package className="h-3 w-3 mr-1" /> },
      'expediata': { bg: 'bg-teal-100', text: 'text-teal-800', icon: <Truck className="h-3 w-3 mr-1" /> },
      'returnata': { bg: 'bg-amber-100', text: 'text-amber-800', icon: <RefreshCw className="h-3 w-3 mr-1" /> },
      'refuzata': { bg: 'bg-red-100', text: 'text-red-800', icon: <XCircle className="h-3 w-3 mr-1" /> }
    };
    
    const config = statusConfig[status];
    
    return (
      <span className={`${config.bg} ${config.text} text-xs px-2 py-1 rounded-full flex items-center`}>
        {config.icon}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };
  
  // Get source badge component
  const getSourceBadge = (source: 'manual' | 'woocommerce') => {
    return source === 'manual' 
      ? <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">Manual</span>
      : <span className="bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded-full">WooCommerce</span>;
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  // Check if we have any orders that need packaging
  const hasOrdersToPackage = filteredOrders.some(order => 
    order.status === 'processing' || order.status === 'preluata'
  );
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Orders</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage and fulfill customer orders</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          {hasOrdersToPackage && (
            <Link
              to="/orders/packingslip"
              className="inline-flex items-center bg-green-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-md hover:bg-green-700 transition-colors"
            >
              <FileBox className="h-4 w-4 mr-1 sm:mr-2" />
              Global Packing Slip
            </Link>
          )}
          <button
            onClick={() => setShowSyncModal(true)}
            className="inline-flex items-center bg-teal-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-md hover:bg-teal-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-1 sm:mr-2" />
            Sync WooCommerce
          </button>
          <button
            onClick={() => navigate('/orders/new')}
            className="inline-flex items-center bg-indigo-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-md hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-1 sm:mr-2" />
            Create Order
          </button>
        </div>
      </div>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
      
      <div className="bg-white rounded-lg shadow-sm">
        <div className="p-3 sm:p-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search orders by number or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-9 sm:pl-10 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative inline-block w-full sm:w-auto">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as OrderStatus | 'all')}
                  className="pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="on-hold">On Hold</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="refunded">Refunded</option>
                  <option value="failed">Failed</option>
                  <option value="preluata">Preluata</option>
                  <option value="impachetata">Impachetata</option>
                  <option value="expediata">Expediata</option>
                  <option value="returnata">Returnata</option>
                  <option value="refuzata">Refuzata</option>
                </select>
              </div>
              
              <div className="relative inline-block w-full sm:w-auto">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Filter className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                </div>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value as 'manual' | 'woocommerce' | 'all')}
                  className="pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All Sources</option>
                  <option value="manual">Manual</option>
                  <option value="woocommerce">WooCommerce</option>
                </select>
              </div>
              
              <div className="relative inline-block w-full sm:w-auto">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-gray-400" />
                </div>
                <select
                  value={unidentifiedFilter}
                  onChange={(e) => setUnidentifiedFilter(e.target.value as 'all' | 'unidentified')}
                  className="pl-8 sm:pl-9 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="all">All Orders</option>
                  <option value="unidentified">With Unidentified Products</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex items-center">
              <label htmlFor="startDate" className="block text-xs sm:text-sm text-gray-700 mr-2">
                From:
              </label>
              <input
                type="date"
                id="startDate"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center">
              <label htmlFor="endDate" className="block text-xs sm:text-sm text-gray-700 mr-2">
                To:
              </label>
              <input
                type="date"
                id="endDate"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="block w-full px-3 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
        
        {/* Bulk Actions Bar */}
        {selectedOrders.length > 0 && (
          <div className="bg-indigo-50 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-xs sm:text-sm font-medium text-indigo-700">
                {selectedOrders.length} {selectedOrders.length === 1 ? 'order' : 'orders'} selected
              </span>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowBulkEditModal(true)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                <Check className="h-3 w-3 mr-1" />
                Update Status
              </button>
              <button
                onClick={() => setShowBulkDeleteModal(true)}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
              >
                <Trash className="h-3 w-3 mr-1" />
                Delete
              </button>
            </div>
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 sm:px-4 py-2 sm:py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedOrders.length > 0 && selectedOrders.length === filteredOrders.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                </th>
                <th 
                  scope="col" 
                  className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('orderNumber')}
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
                  className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('orderDate')}
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
                <th 
                  scope="col" 
                  className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('customerName')}
                >
                  <div className="flex items-center">
                    <span>Customer</span>
                    {sortField === 'customerName' && (
                      sortDirection === 'asc' ? 
                      <ArrowUp className="h-3 w-3 sm:h-4 sm:w-4 ml-1" /> : 
                      <ArrowDown className="h-3 w-3 sm:h-4 sm:w-4 ml-1" />
                    )}
                  </div>
                </th>
                <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th 
                  scope="col" 
                  className="px-4 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                  onClick={() => handleSort('total')}
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
                <th scope="col" className="relative px-4 sm:px-6 py-2 sm:py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <tr key={order.id} className={`hover:bg-gray-50 ${selectedOrders.includes(order.id) ? 'bg-indigo-50' : ''}`}>
                    <td className="px-3 sm:px-4 py-2 sm:py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Link to={`/orders/${order.id}`} className="text-indigo-600 hover:text-indigo-900 font-medium">
                          #{order.orderNumber}
                        </Link>
                        {/* Show unidentified product indicator */}
                        {order.hasUnidentifiedItems && (
                          <div 
                            title="Contains unidentified products" 
                            className="ml-2 flex-shrink-0"
                          >
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm text-gray-500">
                        {format(order.orderDate, 'MMM d, yyyy')}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-2 sm:py-4">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">{order.customerName}</div>
                      {order.customerEmail && (
                        <div className="text-xs text-gray-500">{order.customerEmail}</div>
                      )}
                    </td>
                    <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      {getSourceBadge(order.source)}
                    </td>
                    <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap">
                      <div className="text-xs sm:text-sm font-medium text-gray-900">
                        {order.total.toFixed(2)} RON
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-2 sm:py-4 whitespace-nowrap text-right text-xs sm:text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Link
                          to={`/orders/${order.id}/packingslip`}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Print Packing Slip"
                        >
                          <Printer className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Link>
                        {order.status !== 'completed' && (
                          <button
                            onClick={() => markAsFulfilled(order.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Mark as Fulfilled"
                          >
                            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                        )}
                        <Link
                          to={`/orders/${order.id}`}
                          className="text-gray-600 hover:text-gray-900"
                          title="View Details"
                        >
                          <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 sm:px-6 py-4 text-center text-gray-500">
                    {searchQuery || statusFilter !== 'all' || sourceFilter !== 'all' || unidentifiedFilter !== 'all' || startDate || endDate
                      ? 'No orders match your filters'
                      : 'No orders found'}
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
                  Showing <span className="font-medium">{filteredOrders.length > 0 ? currentPage * itemsPerPage + 1 : 0}</span> to{' '}
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
      
      {/* WooCommerce Sync Modal */}
      <Modal
        isOpen={showSyncModal}
        onClose={() => {
          setShowSyncModal(false);
          setSyncResult(null);
        }}
        title="Sync WooCommerce Orders"
      >
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-md">
            <div className="flex items-start mb-3">
              <ShoppingBag className="h-5 w-5 text-indigo-500 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-gray-900">WooCommerce Synchronization</h3>
                <p className="mt-1 text-xs text-gray-500">
                  This will fetch the latest orders from your WooCommerce store and sync them with your inventory management system.
                </p>
              </div>
            </div>
            <p className="text-xs text-gray-600">
              New orders will be created automatically, and existing orders will be updated with the latest information.
              Products will be matched by WooCommerce SKU to product barcodes in your system.
            </p>
          </div>
          
          {syncResult && (
            <div className={`p-4 rounded-md ${syncResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {syncResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400" />
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">
                    {syncResult.message}
                  </p>
                  {syncResult.success && syncResult.ordersWithUnidentifiedItems && syncResult.ordersWithUnidentifiedItems > 0 && (
                    <p className="mt-1 text-sm font-medium text-amber-600">
                      {syncResult.ordersWithUnidentifiedItems} {syncResult.ordersWithUnidentifiedItems === 1 ? 'order has' : 'orders have'} unidentified products.
                      <button 
                        onClick={() => {
                          setShowSyncModal(false);
                          setUnidentifiedFilter('unidentified');
                          fetchOrders(0);
                        }}
                        className="ml-2 underline hover:no-underline"
                      >
                        View them
                      </button>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowSyncModal(false);
                setSyncResult(null);
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSyncOrders}
              disabled={syncing}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center"
            >
              {syncing ? (
                <>
                  <RefreshCw className="animate-spin h-4 w-4 mr-2" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Now
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
      
      {/* Bulk Edit Status Modal */}
      <Modal
        isOpen={showBulkEditModal}
        onClose={resetBulkUpdate}
        title="Update Order Status"
      >
        <div className="space-y-4">
          <div className="bg-indigo-50 p-4 rounded-md">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <Package className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-gray-900">Bulk Update Order Status</h3>
                <p className="mt-1 text-xs text-gray-500">
                  You are about to update the status of {selectedOrders.length} {selectedOrders.length === 1 ? 'order' : 'orders'}.
                </p>
              </div>
            </div>
          </div>
          
          <div>
            <label htmlFor="bulkStatus" className="block text-sm font-medium text-gray-700 mb-1">
              New Status
            </label>
            <select
              id="bulkStatus"
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="on-hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
              <option value="failed">Failed</option>
              <option value="preluata">Preluata</option>
              <option value="impachetata">Impachetata</option>
              <option value="expediata">Expediata</option>
              <option value="returnata">Returnata</option>
              <option value="refuzata">Refuzata</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              WooCommerce orders will be updated both locally and in your WooCommerce store.
            </p>
          </div>
          
          {bulkUpdateResult && (
            <div className={`p-4 rounded-md ${
              bulkUpdateResult.success > 0 
                ? 'bg-green-50 text-green-800' 
                : 'bg-red-50 text-red-800'
            }`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {bulkUpdateResult.success > 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400" />
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">
                    {bulkUpdateResult.success > 0 
                      ? `Successfully updated ${bulkUpdateResult.success} order${bulkUpdateResult.success !== 1 ? 's' : ''}` 
                      : 'Failed to update orders'}
                  </p>
                  {bulkUpdateResult.failed > 0 && (
                    <p className="mt-1 text-xs">
                      {bulkUpdateResult.failed} order{bulkUpdateResult.failed !== 1 ? 's' : ''} could not be updated
                    </p>
                  )}
                  {bulkUpdateResult.errorMessage && (
                    <p className="mt-1 text-xs">
                      Error: {bulkUpdateResult.errorMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={resetBulkUpdate}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={performBulkStatusUpdate}
              disabled={isUpdatingBulk || selectedOrders.length === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isUpdatingBulk ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Updating...
                </>
              ) : (
                'Update Status'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Modal */}
      <Modal
        isOpen={showBulkDeleteModal}
        onClose={resetBulkDelete}
        title="Delete Orders"
      >
        <div className="space-y-4">
          <div className="bg-red-50 p-4 rounded-md">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <Trash className="h-5 w-5 text-red-500" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-gray-900">Confirm Bulk Deletion</h3>
                <p className="mt-1 text-xs text-gray-500">
                  You are about to permanently delete {selectedOrders.length} {selectedOrders.length === 1 ? 'order' : 'orders'}.
                  This action cannot be undone.
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-amber-50 border-l-4 border-amber-400 p-3 flex items-start">
            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 mr-2" />
            <div>
              <p className="text-sm text-amber-700 font-medium">Warning</p>
              <p className="text-xs text-amber-600 mt-1">
                Deleting orders can affect inventory tracking and reporting. Make sure you have backups of any important data.
              </p>
            </div>
          </div>
          
          {bulkDeleteResult && (
            <div className={`p-4 rounded-md ${
              bulkDeleteResult.success > 0 
                ? 'bg-green-50 text-green-800' 
                : 'bg-red-50 text-red-800'
            }`}>
              <div className="flex">
                <div className="flex-shrink-0">
                  {bulkDeleteResult.success > 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400" />
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium">
                    {bulkDeleteResult.success > 0 
                      ? `Successfully deleted ${bulkDeleteResult.success} order${bulkDeleteResult.success !== 1 ? 's' : ''}` 
                      : 'Failed to delete orders'}
                  </p>
                  {bulkDeleteResult.failed > 0 && (
                    <p className="mt-1 text-xs">
                      {bulkDeleteResult.failed} order{bulkDeleteResult.failed !== 1 ? 's' : ''} could not be deleted
                    </p>
                  )}
                  {bulkDeleteResult.errorMessage && (
                    <p className="mt-1 text-xs">
                      Error: {bulkDeleteResult.errorMessage}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={resetBulkDelete}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={performBulkDelete}
              disabled={isDeletingBulk || selectedOrders.length === 0}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              {isDeletingBulk ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Deleting...
                </>
              ) : (
                'Delete Orders'
              )}
            </button>
          </div>
        </div>
      </Modal>
      
      {/* Unidentified Item Modal */}
      <Modal
        isOpen={showUnidentifiedItemModal}
        onClose={() => setShowUnidentifiedItemModal(false)}
        title="Create Product from WooCommerce"
      >
        {selectedUnidentifiedItem && (
          <div className="space-y-4">
            <div className="bg-amber-50 p-4 rounded-md">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 mr-2" />
                <div>
                  <h3 className="text-sm font-medium text-amber-800">Unidentified Product</h3>
                  <p className="mt-1 text-xs text-amber-700">
                    This product from WooCommerce doesn't match any products in your inventory system.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-4 border border-gray-200 rounded-md">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Product Details from WooCommerce:</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-gray-500">Name:</dt>
                <dd className="text-gray-900 font-medium">{selectedUnidentifiedItem.name}</dd>
                
                <dt className="text-gray-500">SKU/Barcode:</dt>
                <dd className="text-gray-900 font-medium">{selectedUnidentifiedItem.sku || "No SKU"}</dd>
                
                <dt className="text-gray-500">Price:</dt>
                <dd className="text-gray-900 font-medium">{selectedUnidentifiedItem.price.toFixed(2)} RON</dd>
                
                <dt className="text-gray-500">Quantity:</dt>
                <dd className="text-gray-900 font-medium">{selectedUnidentifiedItem.quantity}</dd>
              </dl>
            </div>
            
            <p className="text-sm text-gray-600">
              Would you like to create a new product in your inventory system using these details? This will allow you to track stock for this product.
            </p>
            
            <div className="flex justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowUnidentifiedItemModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={navigateToCreateProduct}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <Plus className="h-4 w-4 inline mr-1" /> 
                Create Product
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default OrderList;