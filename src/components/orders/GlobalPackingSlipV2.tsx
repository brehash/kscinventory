import React, { useRef, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, updateDoc, doc, orderBy, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Order, OrderItem, Product } from '../../types';
import { 
  ArrowLeft, 
  Printer, 
  AlertTriangle,
  Loader2,
  CheckSquare,
  Square,
  Package,
  CheckCircle,
  Users,
  Home,
  Phone,
  Search,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';
import { updateOrderStatusOnWooCommerce } from '../../utils/wooCommerceSync';

// Interface for a consolidated item (same product across multiple orders)
interface ConsolidatedItem extends OrderItem {
  orderIds: string[];
  orderNumbers: string[];
  isPicked: boolean;
}

// Interface for a group of orders by customer
interface OrderGroup {
  customerId?: string;
  customerName: string;
  orders: Order[];
  isProcessed: boolean;
  shippingAddress?: any;
  phone?: string;
}

const GlobalPackingSlipV2: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [consolidatedItems, setConsolidatedItems] = useState<ConsolidatedItem[]>([]);
  const [orderGroups, setOrderGroups] = useState<OrderGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Filter states
  const [productFilter, setProductFilter] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [showCompletedOrders, setShowCompletedOrders] = useState(false);
  
  // Function to format shipping address in the specified format
  const formatShippingAddress = (address: any, phone: string, order: Order) => {
    if (!address) return 'Address not available';
    
    // Get phone from billing if shipping phone is not available
    const displayPhone = address.phone || phone || '';
    
    // Format address components
    const fullName = `${address.firstName} ${address.lastName}`.trim();
    const postalCode = address.postcode || '';
    const city = address.city || '';
    const state = address.state || '';
    const addressLines = [address.address1 || '', address.address2 || ''].filter(Boolean).join(', ');
    
    // Only include total for COD orders
    const isCOD = order.paymentMethod === 'cod' || order.paymentMethod === 'cash_on_delivery';
    const totalAmount = isCOD ? `${order.total.toFixed(2)} RON` : '';
    
    // Format according to specification
    return [
      fullName,
      displayPhone,
      postalCode,
      city,
      state,
      addressLines,
      totalAmount
    ].filter(Boolean).join(' | ');
  };
  
  // Fetch orders with items to pick
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch orders that are in 'processing' status or similar
        const ordersRef = collection(db, 'orders');
        const q = query(
          ordersRef, 
          where('status', 'in', ['processing', 'preluata', 'on-hold']),
          orderBy('orderDate', 'asc')
        );
        
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          setOrders([]);
          setConsolidatedItems([]);
          setOrderGroups([]);
          setLoading(false);
          return;
        }
        
        // Parse orders data
        const ordersData = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            orderDate: data.orderDate?.toDate() || new Date(),
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date()
          } as Order;
        });
        
        setOrders(ordersData);
        
        // Group orders by customer
        const customersMap = new Map<string, OrderGroup>();
        
        ordersData.forEach(order => {
          // Use customerEmail as a unique identifier if available, otherwise use customerName
          const customerKey = order.customerEmail || order.customerName;
          
          if (!customersMap.has(customerKey)) {
            customersMap.set(customerKey, {
              customerId: order.clientId,
              customerName: order.customerName,
              orders: [order],
              isProcessed: false,
              shippingAddress: order.shippingAddress,
              phone: order.shippingAddress.phone || order.billingAddress.phone
            });
          } else {
            const group = customersMap.get(customerKey)!;
            group.orders.push(order);
          }
        });
        
        setOrderGroups(Array.from(customersMap.values()));
        
        // Group items from all orders into consolidated items
        // Map to store consolidated items by productId-productName key
        const itemsMap = new Map<string, ConsolidatedItem>();
        
        ordersData.forEach(order => {
          if (!order.items) return;
          
          order.items.forEach(item => {
            // Only include items that are not marked as picked yet
            if (item.picked === true) return;
            
            const key = `${item.productId}-${item.productName}`;
            
            if (itemsMap.has(key)) {
              const existingItem = itemsMap.get(key)!;
              existingItem.quantity += item.quantity;
              existingItem.total += item.total;
              
              // Only add the order ID and number if they're not already in the arrays
              if (!existingItem.orderIds.includes(order.id)) {
                existingItem.orderIds.push(order.id);
              }
              if (!existingItem.orderNumbers.includes(order.orderNumber)) {
                existingItem.orderNumbers.push(order.orderNumber);
              }
            } else {
              itemsMap.set(key, {
                ...item,
                orderIds: [order.id],
                orderNumbers: [order.orderNumber],
                isPicked: false
              });
            }
          });
        });
        
        setConsolidatedItems(Array.from(itemsMap.values()));
        setLoading(false);
      } catch (err) {
        console.error('Error fetching orders:', err);
        setError('Failed to load orders');
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, []);
  
  // Filter consolidated items based on search
  const filteredItems = consolidatedItems.filter(item => {
    return item.productName.toLowerCase().includes(productFilter.toLowerCase());
  });
  
  // Filter order groups based on search
  const filteredOrderGroups = orderGroups.filter(group => {
    // Filter by customer name
    const matchesName = group.customerName.toLowerCase().includes(customerFilter.toLowerCase());
    
    // Only show processed orders if showCompletedOrders is true
    const allOrdersProcessed = group.orders.every(order => order.status === 'pregatita');
    if (allOrdersProcessed && !showCompletedOrders) {
      return false;
    }
    
    return matchesName;
  });
  
  // Print handler
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: 'Global_Packing_Slip',
    onAfterPrint: () => console.log('Printed global packing slip')
  });
  
  // Handle toggling an item as picked
  const handleToggleItemPicked = (index: number) => {
    const updatedItems = [...consolidatedItems];
    updatedItems[index].isPicked = !updatedItems[index].isPicked;
    setConsolidatedItems(updatedItems);
  };
  
  // Handle marking an order as processed
  const handleProcessOrder = async (orderId: string) => {
    if (!currentUser) {
      setError('You must be logged in to process orders');
      return;
    }
    
    try {
      setIsProcessing(true);
      
      // Update order in Firestore
      const orderRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderRef);
      
      if (!orderDoc.exists()) {
        throw new Error(`Order ${orderId} not found`);
      }
      
      const orderData = orderDoc.data() as Order;
      
      // Mark all items as picked
      const updatedItems = orderData.items.map(item => ({
        ...item,
        picked: true
      }));
      
      // Update order in Firestore
      await updateDoc(orderRef, {
        items: updatedItems,
        status: 'pregatita', // Update status to pregatita (ready)
        updatedAt: new Date()
      });
      
      // Sync status to WooCommerce if applicable
      if (orderData.woocommerceId) {
        const syncResult = await updateOrderStatusOnWooCommerce(
          orderData.woocommerceId,
          'pregatita'
        );
        
        if (!syncResult.success) {
          console.warn(`WooCommerce sync failed for order ${orderData.orderNumber}:`, syncResult.error);
          // We don't throw here to allow the function to continue
        }
      }
      
      // Log activity
      await logActivity(
        'updated',
        'order',
        orderId,
        `Order #${orderData.orderNumber} - Marked as ready`,
        currentUser
      );
      
      // Update UI state - mark the order as processed in the order groups
      const updatedGroups = orderGroups.map(group => {
        const updatedOrders = group.orders.map(order => 
          order.id === orderId 
            ? { ...order, status: 'pregatita' } 
            : order
        );
        
        // Check if all orders in the group are now processed
        const allProcessed = updatedOrders.every(order => order.status === 'pregatita');
        
        return {
          ...group,
          orders: updatedOrders,
          isProcessed: allProcessed
        };
      });
      
      setOrderGroups(updatedGroups);
      
      // Update the orders array as well
      const updatedOrders = orders.map(order => 
        order.id === orderId 
          ? { ...order, status: 'pregatita' } 
          : order
      );
      setOrders(updatedOrders);
      
      // Show success message
      setSuccess(`Order ${orderData.orderNumber} processed successfully`);
      
      // Clear success message after a few seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
    } catch (err) {
      console.error('Error processing order:', err);
      setError(err instanceof Error ? err.message : 'Failed to process order');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle processing a customer group (all their orders)
  const handleProcessCustomerGroup = async (group: OrderGroup) => {
    if (!currentUser) {
      setError('You must be logged in to process orders');
      return;
    }
    
    try {
      setIsProcessing(true);
      
      // Process each order in the group
      for (const order of group.orders) {
        // Skip orders that are already processed
        if (order.status === 'pregatita') continue;
        
        await handleProcessOrder(order.id);
      }
      
      // Show success message
      setSuccess(`All orders for ${group.customerName} processed successfully`);
      
      // Clear success message after a few seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
      
    } catch (err) {
      console.error('Error processing customer group:', err);
      setError(err instanceof Error ? err.message : 'Failed to process customer group');
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Handle marking all items as picked
  const handleMarkAllItemsPicked = () => {
    const updatedItems = consolidatedItems.map(item => ({
      ...item,
      isPicked: true
    }));
    setConsolidatedItems(updatedItems);
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-indigo-600 mr-2" />
        <span className="text-sm sm:text-base text-gray-600">Loading orders to fulfill...</span>
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
      </div>
    );
  }
  
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
        <div className="flex items-center">
          <button
            onClick={() => navigate('/orders')}
            className="mr-3 sm:mr-4 p-1.5 sm:p-2 rounded-full hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg sm:text-2xl font-bold text-gray-800">
              Global Packing Slip
            </h1>
            <p className="text-xs sm:text-base text-gray-600">
              Consolidated pick list for {orders.length} orders ready to fulfill
            </p>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-gray-300 shadow-sm text-xs sm:text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Print Packing Slip
          </button>
          
          <button
            onClick={handleMarkAllItemsPicked}
            disabled={isProcessing || consolidatedItems.length === 0}
            className="inline-flex items-center px-3 py-1.5 sm:px-4 sm:py-2 border border-transparent shadow-sm text-xs sm:text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckSquare className="h-4 w-4 mr-1.5" />
            Mark All as Picked
          </button>
        </div>
      </div>
      
      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}
      
      {orders.length === 0 ? (
        <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm text-center py-8 sm:py-10">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">No Orders to Process</h2>
          <p className="text-gray-600 mb-4">There are no orders ready for fulfillment.</p>
          <button
            onClick={() => navigate('/orders')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Return to Orders
          </button>
        </div>
      ) : (
        <>
          {/* Filter Controls */}
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Filter Options</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Users className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              
              <div className="flex items-center">
                <input
                  id="showCompletedOrders"
                  type="checkbox"
                  checked={showCompletedOrders}
                  onChange={(e) => setShowCompletedOrders(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor="showCompletedOrders" className="ml-2 block text-sm text-gray-900">
                  Show processed orders
                </label>
              </div>
            </div>
          </div>
          
          {/* Main content area with print template */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Consolidated Items List */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm print:shadow-none">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <Package className="h-5 w-5 mr-2 text-indigo-500" />
                Consolidated Products
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({filteredItems.length} {filteredItems.length === 1 ? 'product' : 'products'})
                </span>
              </h2>
              
              {filteredItems.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No products found matching your search criteria.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-3 sm:px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          Picked
                        </th>
                        <th scope="col" className="px-3 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Product
                        </th>
                        <th scope="col" className="px-3 sm:px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                          Quantity
                        </th>
                        <th scope="col" className="px-3 sm:px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Order #
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredItems.map((item, index) => (
                        <tr key={`${item.productId}-${item.id}`} className="hover:bg-gray-50">
                          <td className="px-3 sm:px-4 py-2 text-center">
                            <button 
                              onClick={() => handleToggleItemPicked(index)}
                              className="focus:outline-none"
                            >
                              {item.isPicked ? (
                                <CheckSquare className="h-5 w-5 text-green-500" />
                              ) : (
                                <Square className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                              )}
                            </button>
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-gray-900">
                            <div className="flex items-center">
                              <div className="flex-shrink-0 h-8 w-8 bg-gray-100 rounded-md flex items-center justify-center mr-3">
                                <Package className="h-4 w-4 text-gray-500" />
                              </div>
                              {item.productName}
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-500 text-center">
                            <span className="font-semibold">{item.quantity}</span>
                          </td>
                          <td className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-500">
                            <div className="flex flex-wrap gap-1">
                              {item.orderNumbers.map((orderNumber, idx) => (
                                <span key={idx} className="inline-block bg-gray-100 px-2 py-1 rounded-md text-xs">
                                  #{orderNumber}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            {/* Order Groups List */}
            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm print:shadow-none">
              <h2 className="text-lg font-semibold mb-4 flex items-center">
                <Users className="h-5 w-5 mr-2 text-indigo-500" />
                Customer Orders
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({filteredOrderGroups.length} {filteredOrderGroups.length === 1 ? 'customer' : 'customers'})
                </span>
              </h2>
              
              {filteredOrderGroups.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No customers found matching your search criteria.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredOrderGroups.map((group, groupIndex) => {
                    // Check if all orders in this group are already processed
                    const allOrdersProcessed = group.orders.every(order => order.status === 'pregatita');
                    
                    return (
                      <div 
                        key={`${group.customerName}-${groupIndex}`}
                        className={`border rounded-lg ${
                          allOrdersProcessed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="p-4 border-b border-gray-200">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-base font-medium text-gray-900">{group.customerName}</h3>
                              {group.orders.length > 1 && (
                                <p className="text-sm text-gray-500">{group.orders.length} orders</p>
                              )}
                              
                              {/* Address in the new format */}
                              {group.orders[0] && group.shippingAddress && (
                                <div className="mt-2 text-sm text-gray-500">
                                  {formatShippingAddress(group.shippingAddress, group.phone || '', group.orders[0])}
                                </div>
                              )}
                            </div>
                            
                            <div>
                              {allOrdersProcessed ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Processed
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleProcessCustomerGroup(group)}
                                  disabled={isProcessing}
                                  className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                >
                                  {isProcessing ? (
                                    <>
                                      <Loader2 className="animate-spin h-3 w-3 mr-1" />
                                      Processing...
                                    </>
                                  ) : (
                                    <>
                                      <CheckSquare className="h-3 w-3 mr-1" />
                                      Process All
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Orders list */}
                        <div className="divide-y divide-gray-200">
                          {group.orders.map((order) => {
                            const isProcessed = order.status === 'pregatita';
                            
                            return (
                              <div key={order.id} className={`p-4 ${isProcessed ? 'bg-green-50' : 'bg-white'}`}>
                                <div className="flex justify-between items-center mb-3">
                                  
                                </div>
                                
                                {/* Order items */}
                                <div className="mt-2 space-y-1">
                                  {order.items.map((item) => {
                                    // Find the corresponding consolidated item to check if it's picked
                                    const consolidatedItem = consolidatedItems.find(
                                      ci => ci.productId === item.productId && ci.productName === item.productName
                                    );
                                    
                                    return (
                                      <div key={item.id} className="flex justify-between text-sm">
                                        <div className="flex items-center">
                                          {consolidatedItem?.isPicked ? (
                                            <CheckSquare className="h-3 w-3 text-green-500 mr-1" />
                                          ) : (
                                            <Square className="h-3 w-3 text-gray-400 mr-1" />
                                          )}
                                          <span className={`${consolidatedItem?.isPicked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                            {item.quantity} x {item.productName}
                                          </span>
                                        </div>
                                        <span className="text-gray-500">{item.price.toFixed(2)} RON</span>
                                      </div>
                                    );
                                  })}
                                </div>
                                
                                
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          {/* Print version template */}
          <div className="hidden">
            <div ref={printRef} className="p-8">
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold">GLOBAL PACKING SLIP</h1>
                <p className="text-gray-600 mt-1">Date: {format(new Date(), 'MMMM d, yyyy')}</p>
                <p className="text-gray-600">Orders: {orders.length}</p>
              </div>
              
              {/* Print version of consolidated items */}
              <h2 className="text-lg font-bold mb-2 border-b pb-2">Products to Pick</h2>
              <table className="w-full mb-6">
                <thead className="border-b">
                  <tr>
                    <th className="text-left py-2">Product</th>
                    <th className="text-center py-2">Quantity</th>
                    <th className="text-left py-2">Order Numbers</th>
                    <th className="text-center py-2">Picked</th>
                  </tr>
                </thead>
                <tbody>
                  {consolidatedItems.map((item, index) => (
                    <tr key={`print-${item.productId}-${index}`} className="border-b">
                      <td className="py-2">{item.productName}</td>
                      <td className="py-2 text-center">{item.quantity}</td>
                      <td className="py-2">{item.orderNumbers.map(num => `#${num}`).join(', ')}</td>
                      <td className="py-2 text-center">□</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Print version of order list */}
              <h2 className="text-lg font-bold mb-2 border-b pb-2">Customer Orders</h2>
              <div className="space-y-6">
                {orderGroups.map((group, i) => (
                  <div key={`print-customer-${i}`} className="mb-4 border p-4 rounded">
                    <h3 className="font-bold">{group.customerName}</h3>
                    
                    {/* Formatted shipping address for print */}
                    {group.orders[0] && group.shippingAddress && (
                      <p className="text-sm">
                        {formatShippingAddress(group.shippingAddress, group.phone || '', group.orders[0])}
                      </p>
                    )}
                    
                    <table className="w-full mt-2">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-1 text-sm">Order #</th>
                          <th className="text-left py-1 text-sm">Items</th>
                          <th className="text-right py-1 text-sm">Total</th>
                          <th className="text-center py-1 text-sm">Processed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.orders.map((order) => (
                          <tr key={`print-order-${order.id}`} className="border-b">
                            <td className="py-1 text-sm">#{order.orderNumber}</td>
                            <td className="py-1 text-sm">
                              {order.items.map((item, j) => (
                                <div key={`print-item-${j}`}>
                                  {item.quantity} x {item.productName}
                                </div>
                              ))}
                            </td>
                            <td className="py-1 text-sm text-right">{order.total.toFixed(2)} RON</td>
                            <td className="py-1 text-sm text-center">□</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 text-center text-sm text-gray-500">
                <p>Processed by: {currentUser?.displayName || 'Staff'}</p>
                <p>Date: {format(new Date(), 'MMMM d, yyyy')}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GlobalPackingSlipV2;
