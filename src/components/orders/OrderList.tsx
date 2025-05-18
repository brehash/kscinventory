import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, orderBy, where, deleteDoc, doc, updateDoc, Timestamp, limit, startAfter, getCountFromServer } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Order, OrderStatus } from '../../types';
import { AlertTriangle, Loader2, ChevronLeft, ChevronRight, Trash } from 'lucide-react';
import Modal from '../ui/Modal';
import OrderStatusUpdateModal from './OrderStatusUpdateModal';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';
import ReactPaginate from 'react-paginate';
import { useSearchParams } from 'react-router-dom';
import OrderSyncModal from './OrderSyncModal';
import OrderDeleteConfirmation from './OrderDeleteConfirmation';
import OrderActionButtons from './OrderActionButtons';
import OrderFilters from './OrderFilters';
import OrderTable from './OrderTable';
import OrderDeleteModal from './OrderDeleteModal';

const OrderList: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  
  // State for orders and loading
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for selected orders
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  
  // State for pagination
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);
  const [lastVisibleOrder, setLastVisibleOrder] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  
  // State for sorting
  const [sortField, setSortField] = useState<keyof Order>('orderDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // State for filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');
  const [selectedSource, setSelectedSource] = useState<'manual' | 'woocommerce' | 'all'>('all');
  const [showUnidentifiedOnly, setShowUnidentifiedOnly] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // State for modals
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [orderToUpdate, setOrderToUpdate] = useState<Order | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [newStatus, setNewStatus] = useState<OrderStatus>('processing');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  // Initialize with query params if available
  useEffect(() => {
    const clientId = searchParams.get('clientId');
    if (clientId) {
      // We might update our filters to show only orders for this client
      console.log(`Filtering for client ID: ${clientId}`);
    }
  }, [searchParams]);
  
  // Fetch orders
  useEffect(() => {
    fetchOrders(0);
  }, [sortField, sortDirection, selectedStatus, selectedSource, showUnidentifiedOnly, startDate, endDate]);
  
  // Handler for search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        fetchOrders(0);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Handler for page change
  const handlePageClick = (event: { selected: number }) => {
    const newPage = event.selected;
    setCurrentPage(newPage);
    fetchOrders(newPage);
  };
  
  // Handler for row selection
  const handleCheckboxChange = (orderId: string, isChecked: boolean) => {
    const newSelectedIds = new Set(selectedOrderIds);
    
    if (isChecked) {
      newSelectedIds.add(orderId);
    } else {
      newSelectedIds.delete(orderId);
    }
    
    setSelectedOrderIds(newSelectedIds);
  };
  
  const fetchOrders = async (page = 0) => {
    try {
      setLoading(true);
      setError(null);
      
      // Create the base query collection
      let ordersRef = collection(db, 'orders');
      let baseQuery = query(ordersRef);
      
      // Apply filters
      const filters = [];
      
      if (selectedStatus) {
        filters.push(where('status', '==', selectedStatus));
      }
      
      if (selectedSource !== 'all') {
        filters.push(where('source', '==', selectedSource));
      }
      
      if (showUnidentifiedOnly) {
        filters.push(where('hasUnidentifiedItems', '==', true));
      }
      
      // Date range filters
      if (startDate) {
        const startTimestamp = Timestamp.fromDate(new Date(startDate));
        filters.push(where('orderDate', '>=', startTimestamp));
      }
      
      if (endDate) {
        const endDateObj = new Date(endDate);
        // Set to end of day
        endDateObj.setHours(23, 59, 59, 999);
        const endTimestamp = Timestamp.fromDate(endDateObj);
        filters.push(where('orderDate', '<=', endTimestamp));
      }
      
      // Search filter (only if query is provided)
      if (searchQuery) {
        // Search for order number (exact match is better than contains for order numbers)
        if (/^\d+$/.test(searchQuery)) {
          filters.push(where('orderNumber', '==', searchQuery));
        } else {
          // Search for customer name (case-insensitive contains is not directly supported in Firestore)
          // Instead, we'll fetch all orders matching other filters and filter by name client-side
        }
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
      
      // Apply sorting and pagination
      let ordersQuery;
      
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
      
      // Process orders
      let ordersData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          orderDate: data.orderDate?.toDate() || new Date(),
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          ...(data.fulfilledAt ? { fulfilledAt: data.fulfilledAt.toDate() } : {})
        } as Order;
      });
      
      // Apply client-side search for customer name if search query exists
      if (searchQuery && !/^\d+$/.test(searchQuery)) {
        const lowerCaseQuery = searchQuery.toLowerCase();
        ordersData = ordersData.filter(order => 
          order.customerName.toLowerCase().includes(lowerCaseQuery) ||
          (order.customerEmail && order.customerEmail.toLowerCase().includes(lowerCaseQuery))
        );
      }
      
      setOrders(ordersData);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Failed to load orders. Please try again.');
      setLoading(false);
    }
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
  
  // Handler for opening the edit status modal
  const handleOpenEditModal = (order: Order) => {
    setOrderToUpdate(order);
    setNewStatus(order.status);
    setShowStatusModal(true);
  };
  
  // Handler for opening the delete confirmation modal
  const confirmDelete = (order: Order) => {
    setOrderToDelete(order);
    setShowDeleteModal(true);
  };
  
  // Handler for selecting all orders
  const handleSelectAllOrders = (checked: boolean) => {
    if (checked) {
      // Create a new set with all current order IDs
      const allOrderIds = new Set<string>();
      orders.forEach(order => allOrderIds.add(order.id));
      setSelectedOrderIds(allOrderIds);
    } else {
      // Clear all selections
      setSelectedOrderIds(new Set());
    }
  };
  
  // Handler for bulk deleting orders
  const handleBulkDelete = async () => {
    if (selectedOrderIds.size === 0 || !currentUser) return;
    
    try {
      setLoading(true);
      
      // Delete each selected order
      for (const orderId of selectedOrderIds) {
        await deleteDoc(doc(db, 'orders', orderId));
        
        // Get order details for activity log
        const orderToLog = orders.find(order => order.id === orderId);
        
        // Log the activity
        if (orderToLog) {
          await logActivity(
            'deleted',
            'order',
            orderId,
            `Order #${orderToLog.orderNumber}`,
            currentUser
          );
        }
      }
      
      // Update total count
      setTotalOrders(prev => prev - selectedOrderIds.size);
      setPageCount(Math.ceil((totalOrders - selectedOrderIds.size) / itemsPerPage));
      
      // Clear selections
      setSelectedOrderIds(new Set());
      setShowBulkDeleteModal(false);
      
      // Refetch orders to update the UI
      fetchOrders(currentPage);
      
    } catch (error) {
      console.error('Error deleting orders:', error);
      setError('Failed to delete orders');
      setShowBulkDeleteModal(false);
      setLoading(false);
    }
  };
  
  // Handler for deleting an order
  const handleDelete = async () => {
    if (!orderToDelete || !currentUser) return;
    
    try {
      await deleteDoc(doc(db, 'orders', orderToDelete.id));
      
      // Log the activity
      await logActivity(
        'deleted',
        'order',
        orderToDelete.id,
        `Order #${orderToDelete.orderNumber}`,
        currentUser
      );
      
      // Remove from local state
      setOrders(orders.filter(o => o.id !== orderToDelete.id));
      
      // Reset state
      setShowDeleteModal(false);
      setOrderToDelete(null);
      
      // Decrement total count
      setTotalOrders(prev => prev - 1);
      setPageCount(Math.ceil((totalOrders - 1) / itemsPerPage));
      
      // Refetch if this was the last item on the page and not the first page
      if (orders.length === 1 && currentPage > 0) {
        setCurrentPage(prev => prev - 1);
        fetchOrders(currentPage - 1);
      }
      
    } catch (error) {
      console.error('Error deleting order:', error);
      setError('Failed to delete order');
    }
  };
  
  // Handler for updating order status
  const updateOrderStatus = async () => {
    if (!orderToUpdate || !currentUser) return;
    
    try {
      setUpdatingStatus(true);
      
      const orderRef = doc(db, 'orders', orderToUpdate.id);
      const updateData: Partial<Order> = {
        status: newStatus,
        updatedAt: new Date()
      };
      
      // If status is completed, set fulfilledAt and fulfilledBy
      if (newStatus === 'completed' && orderToUpdate.status !== 'completed') {
        updateData.fulfilledAt = new Date();
        updateData.fulfilledBy = currentUser.displayName || currentUser.email;
      }
      
      await updateDoc(orderRef, updateData);
      
      // Log the activity
      await logActivity(
        'updated',
        'order',
        orderToUpdate.id,
        `Order #${orderToUpdate.orderNumber}`,
        currentUser
      );
      
      // Update the local state
      setOrders(orders.map(order => {
        if (order.id === orderToUpdate.id) {
          return {
            ...order,
            status: newStatus,
            updatedAt: new Date(),
            ...(newStatus === 'completed' && order.status !== 'completed' ? {
              fulfilledAt: new Date(),
              fulfilledBy: currentUser.displayName || currentUser.email
            } : {})
          };
        }
        return order;
      }));
      
      // Reset state
      setShowStatusModal(false);
      setOrderToUpdate(null);
      setUpdatingStatus(false);
      
    } catch (error) {
      console.error('Error updating order status:', error);
      setUpdatingStatus(false);
    }
  };
  
  // Clear filters
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedStatus('');
    setSelectedSource('all');
    setShowUnidentifiedOnly(false);
    setStartDate('');
    setEndDate('');
  };
  
  // Check if any filter is active
  const hasActiveFilters = () => {
    return (
      searchQuery !== '' || 
      selectedStatus !== '' || 
      selectedSource !== 'all' || 
      showUnidentifiedOnly || 
      startDate !== '' || 
      endDate !== ''
    );
  };
  
  // Render the component
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Orders</h1>
          <p className="text-sm text-gray-600">Manage and fulfill customer orders</p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          {selectedOrderIds.size > 0 && (
            <button
              onClick={() => setShowBulkDeleteModal(true)}
              className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent shadow-sm text-xs sm:text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <Trash className="h-4 w-4 mr-1.5" />
              Delete Selected ({selectedOrderIds.size})
            </button>
          )}
          <OrderActionButtons openSyncModal={() => setShowSyncModal(true)} />
        </div>
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <OrderFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        selectedSource={selectedSource}
        setSelectedSource={setSelectedSource}
        showUnidentifiedOnly={showUnidentifiedOnly}
        setShowUnidentifiedOnly={setShowUnidentifiedOnly}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        clearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters()}
      />
      
      {/* Loading Indicator */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="animate-spin h-8 w-8 text-indigo-500" />
          <span className="ml-2 text-gray-500">Loading orders...</span>
        </div>
      ) : (
        <>
          {/* Orders Table */}
          <OrderTable
            orders={orders}
            handleCheckboxChange={handleCheckboxChange}
            selectedOrderIds={selectedOrderIds}
            sortField={sortField}
            sortDirection={sortDirection}
            handleSort={handleSort}
            handleOpenEditModal={handleOpenEditModal}
            confirmDelete={confirmDelete}
            handleSelectAllOrders={handleSelectAllOrders}
          />
          
          {/* Pagination */}
          {pageCount > 1 && (
            <div className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between border-t border-gray-200">
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
                    Showing <span className="font-medium">{totalOrders > 0 ? currentPage * itemsPerPage + 1 : 0}</span> to{' '}
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
        </>
      )}
      
      {/* Order Status Update Modal */}
      <OrderStatusUpdateModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        status={orderToUpdate?.status || 'processing'}
        newStatus={newStatus}
        setNewStatus={setNewStatus}
        updateOrderStatus={updateOrderStatus}
        updatingStatus={updatingStatus}
        orderNumber={orderToUpdate?.orderNumber || ''}
      />
      
      {/* Delete Confirmation Modal for Single Order */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Order"
      >
        <div className="sm:flex sm:items-start">
          <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
            <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
          </div>
          <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Delete Order</h3>
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                Are you sure you want to delete order #{orderToDelete?.orderNumber}? This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
            onClick={handleDelete}
          >
            Delete
          </button>
          <button
            type="button"
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            onClick={() => setShowDeleteModal(false)}
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* Delete Confirmation Modal for Bulk Deletion */}
      <Modal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        title="Delete Multiple Orders"
      >
        <div className="sm:flex sm:items-start">
          <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
            <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
          </div>
          <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Delete Multiple Orders</h3>
            <div className="mt-2">
              <p className="text-sm text-gray-500">
                Are you sure you want to delete {selectedOrderIds.size} selected orders? This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
          <button
            type="button"
            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
            onClick={handleBulkDelete}
          >
            Delete {selectedOrderIds.size} Orders
          </button>
          <button
            type="button"
            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            onClick={() => setShowBulkDeleteModal(false)}
          >
            Cancel
          </button>
        </div>
      </Modal>
      
      {/* WooCommerce Sync Modal */}
      <OrderSyncModal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        onSyncComplete={() => fetchOrders(currentPage)}
      />
    </div>
  );
};

export default OrderList;