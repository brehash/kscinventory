import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, where, limit, startAfter, getCountFromServer, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Order, OrderStatus } from '../../types';
import { Plus, Loader2, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OrderListFilters from './OrderListFilters';
import OrderTable from './OrderTable';
import OrderPagination from './OrderPagination';

const OrderList: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [sortField, setSortField] = useState<keyof Order>('orderDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [totalOrders, setTotalOrders] = useState(0);
  const [lastVisibleOrder, setLastVisibleOrder] = useState<any>(null);
  const [pageCount, setPageCount] = useState(0);
  
  useEffect(() => {
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
        
        if (selectedStatus) {
          filters.push(where('status', '==', selectedStatus));
        }
        
        // If we have filters, apply them to the baseQuery
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
          setFilteredOrders([]);
          setLoading(false);
          return;
        }
        
        // Save the last document for pagination
        setLastVisibleOrder(snapshot.docs[snapshot.docs.length - 1]);
        
        let ordersData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            orderDate: data.orderDate?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            ...(data.fulfilledAt ? { fulfilledAt: data.fulfilledAt.toDate() } : {})
          };
        }) as Order[];
        
        setOrders(ordersData);
        
        // Apply search filter (client-side)
        if (searchQuery) {
          const lowerCaseQuery = searchQuery.toLowerCase();
          ordersData = ordersData.filter(order => 
            (order.orderNumber?.toLowerCase() || '').includes(lowerCaseQuery) || 
            (order.customerName?.toLowerCase() || '').includes(lowerCaseQuery) ||
            (order.customerEmail?.toLowerCase() || '').includes(lowerCaseQuery)
          );
        }
        
        setFilteredOrders(ordersData);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching orders:', err);
        setError('Failed to load orders');
        setLoading(false);
      }
    };

    fetchOrders(currentPage);
  }, [selectedStatus, sortField, sortDirection, currentPage, itemsPerPage]);
  
  // Apply search filter immediately on searchQuery change
  useEffect(() => {
    if (!loading) {
      if (searchQuery) {
        const lowerCaseQuery = searchQuery.toLowerCase();
        const filtered = orders.filter(order => 
          (order.orderNumber?.toLowerCase() || '').includes(lowerCaseQuery) || 
          (order.customerName?.toLowerCase() || '').includes(lowerCaseQuery) ||
          (order.customerEmail?.toLowerCase() || '').includes(lowerCaseQuery)
        );
        setFilteredOrders(filtered);
      } else {
        setFilteredOrders(orders);
      }
    }
  }, [orders, searchQuery, loading]);
  
  // Handler for page change
  const handlePageClick = (event: { selected: number }) => {
    const newPage = event.selected;
    setCurrentPage(newPage);
    // fetchOrders will be called via the useEffect when currentPage changes
  };
  
  const handleSort = (field: keyof Order) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(0);
  };
  
  const clearFilters = () => {
    setSearchQuery('');
    setSelectedStatus('');
  };
  
  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 sm:p-6">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-500 mr-2" />
          <p className="text-sm sm:text-base text-red-700">{error}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Orders</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage your orders</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={() => navigate('/orders/packingslip')}
            className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 shadow-sm text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            Global Packing Slip
          </button>
          <button
            onClick={() => navigate('/orders/new')}
            className="inline-flex items-center bg-indigo-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-md hover:bg-indigo-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-1 sm:mr-2" />
            New Order
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <OrderListFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        clearFilters={clearFilters}
      />
      
      {/* Table */}
      <OrderTable
        filteredOrders={filteredOrders}
        handleSort={handleSort}
        sortField={sortField}
        sortDirection={sortDirection}
        loading={loading}
      />
      
      {/* Pagination */}
      {filteredOrders.length > 0 && (
        <OrderPagination
          currentPage={currentPage}
          pageCount={pageCount}
          itemsPerPage={itemsPerPage}
          totalOrders={totalOrders}
          handlePageClick={handlePageClick}
        />
      )}
      
      {/* Loading State */}
      {loading && filteredOrders.length === 0 && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-indigo-600 mr-2" />
          <span className="text-sm sm:text-base text-gray-600">Loading orders...</span>
        </div>
      )}
    </div>
  );
};

export default OrderList;