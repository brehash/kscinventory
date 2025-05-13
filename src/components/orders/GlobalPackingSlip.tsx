import React, { useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Order, Product, OrderItem } from '../../types';
import {
  ArrowLeft, 
  PrinterIcon, 
  Loader2, 
  AlertTriangle,
  Box,
  CheckSquare,
  Square,
  Package,
  Check,
  Truck
} from 'lucide-react';
import { format } from 'date-fns';
import { useReactToPrint } from 'react-to-print';
import { useAuth } from '../auth/AuthProvider';
import { logActivity } from '../../utils/activityLogger';
import { updateOrderStatusOnWooCommerce } from '../../utils/wooCommerceSync';

interface GroupedItem {
  productId: string;
  productName: string;
  barcode?: string;
  sku?: string;
  totalQuantity: number;
  scanned: boolean;
  orders: {
    orderId: string;
    orderNumber: string;
    quantity: number;
  }[];
}

const GlobalPackingSlip: React.FC = () => {
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useAuth();
  
  // State for all relevant orders
  const [orders, setOrders] = useState<Order[]>([]);
  // State for grouped items
  const [groupedItems, setGroupedItems] = useState<GroupedItem[]>([]);
  // Loading states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  
  // State for barcode scanning
  const [barcode, setBarcode] = useState<string>('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  
  // State for marking orders as packed
  const [markedOrders, setMarkedOrders] = useState<Record<string, boolean>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResults, setUpdateResults] = useState<{
    success: number;
    failed: number;
    failedOrderIds: string[];
  }>({
    success: 0,
    failed: 0,
    failedOrderIds: [],
  });
  
  // Reference to hidden input for barcode scanning
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  
  // Fetch all relevant orders (processing and preluata)
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Query for processing orders
        const processingQuery = query(collection(db, 'orders'), where('status', '==', 'processing'));
        const processingSnapshot = await getDocs(processingQuery);
        
        // Query for preluata orders
        const preluataQuery = query(collection(db, 'orders'), where('status', '==', 'preluata'));
        const preluataSnapshot = await getDocs(preluataQuery);
        
        // Combine results
        const ordersData: Order[] = [];
        
        // Process processing orders
        processingSnapshot.forEach((doc) => {
          ordersData.push({
            id: doc.id,
            ...doc.data(),
            orderDate: doc.data().orderDate?.toDate() || new Date(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date()
          } as Order);
        });
        
        // Process preluata orders
        preluataSnapshot.forEach((doc) => {
          ordersData.push({
            id: doc.id,
            ...doc.data(),
            orderDate: doc.data().orderDate?.toDate() || new Date(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date()
          } as Order);
        });
        
        // Sort by date
        ordersData.sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());
        
        setOrders(ordersData);
        
        // Create initial marked orders state
        const initialMarkedState: Record<string, boolean> = {};
        ordersData.forEach(order => {
          initialMarkedState[order.id] = false;
        });
        setMarkedOrders(initialMarkedState);
        
        // Group items for packing
        await groupItems(ordersData);
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching orders:', error);
        setError('Failed to load orders for packing slip.');
        setLoading(false);
      }
    };
    
    fetchOrders();
  }, []);
  
  // Focus barcode input on load and after scanning
  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [lastScanned]);
  
  // Group items from all orders
  const groupItems = async (ordersData: Order[]) => {
    // Create a map to hold grouped items
    const itemsMap: Map<string, GroupedItem> = new Map();
    
    // Get product details for additional info like barcode
    const productsMap: Map<string, Product> = new Map();
    
    // Process each order and its items
    for (const order of ordersData) {
      for (const item of order.items) {
        // Try to get product details if not already fetched
        if (!productsMap.has(item.productId)) {
          try {
            const productDoc = await getDoc(doc(db, 'products', item.productId));
            if (productDoc.exists()) {
              productsMap.set(item.productId, {
                id: productDoc.id,
                ...productDoc.data()
              } as Product);
            }
          } catch (error) {
            console.error(`Error fetching product ${item.productId}:`, error);
          }
        }
        
        // Get barcode from product if available
        const product = productsMap.get(item.productId);
        const barcode = product?.barcode || '';
        const sku = `SKU-${item.productId.substring(0, 6)}`;
        
        // Check if this product is already in our map
        if (itemsMap.has(item.productId)) {
          // Update existing entry
          const existingItem = itemsMap.get(item.productId)!;
          existingItem.totalQuantity += item.quantity;
          existingItem.orders.push({
            orderId: order.id,
            orderNumber: order.orderNumber,
            quantity: item.quantity
          });
        } else {
          // Create new entry
          itemsMap.set(item.productId, {
            productId: item.productId,
            productName: item.productName,
            barcode,
            sku,
            totalQuantity: item.quantity,
            scanned: false,
            orders: [{
              orderId: order.id,
              orderNumber: order.orderNumber,
              quantity: item.quantity
            }]
          });
        }
      }
    }
    
    // Convert map to array and sort by quantity (descending)
    const groupedItemsArray = Array.from(itemsMap.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity);
    
    setGroupedItems(groupedItemsArray);
  };
  
  // Handle barcode scanning
  const handleBarcodeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!barcode.trim()) return;
    
    const scannedBarcode = barcode.trim();
    
    // Find the item with this barcode
    const itemIndex = groupedItems.findIndex(item => item.barcode === scannedBarcode);
    
    if (itemIndex >= 0) {
      // Mark the item as scanned
      const updatedItems = [...groupedItems];
      updatedItems[itemIndex] = {
        ...updatedItems[itemIndex],
        scanned: true
      };
      
      setGroupedItems(updatedItems);
      setLastScanned(scannedBarcode);
      
      // Add a small notification or feedback
      // Could add a toast notification here
    }
    
    // Clear the barcode input
    setBarcode('');
  };
  
  // Handle barcode input change
  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBarcode(e.target.value);
  };
  
  // Handle toggling an item's scanned status manually
  const toggleItemScanned = (index: number) => {
    const updatedItems = [...groupedItems];
    updatedItems[index] = {
      ...updatedItems[index],
      scanned: !updatedItems[index].scanned
    };
    
    setGroupedItems(updatedItems);
  };
  
  // Handle toggling an order's marked status
  const toggleOrderMarked = (orderId: string) => {
    setMarkedOrders({
      ...markedOrders,
      [orderId]: !markedOrders[orderId]
    });
  };
  
  // Handle print action
  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    documentTitle: `Packing_Slip_${format(new Date(), 'yyyy-MM-dd')}`,
    onBeforeGetContent: () => {
      setIsPrinting(true);
      return new Promise<void>((resolve) => {
        setTimeout(resolve, 500);
      });
    },
    onAfterPrint: () => {
      setIsPrinting(false);
    }
  });
  
  // Update order statuses for marked orders
  const updateMarkedOrders = async () => {
    if (!currentUser) return;
    
    // Get the marked orders
    const ordersToUpdate = Object.entries(markedOrders)
      .filter(([_, isMarked]) => isMarked)
      .map(([orderId]) => orderId);
    
    if (ordersToUpdate.length === 0) {
      alert('Please select at least one order to mark as packed');
      return;
    }
    
    try {
      setIsUpdating(true);
      const results = {
        success: 0,
        failed: 0,
        failedOrderIds: [] as string[]
      };
      
      // Update each order
      for (const orderId of ordersToUpdate) {
        try {
          // Get the order
          const orderRef = doc(db, 'orders', orderId);
          const orderSnap = await getDoc(orderRef);
          
          if (!orderSnap.exists()) {
            results.failed++;
            results.failedOrderIds.push(orderId);
            continue;
          }
          
          const orderData = orderSnap.data() as Order;
          
          // Update order status in Firestore
          await updateDoc(orderRef, {
            status: 'impachetata',
            updatedAt: new Date()
          });
          
          // Update order status in WooCommerce if it's a WooCommerce order
          if (orderData.source === 'woocommerce' && orderData.woocommerceId) {
            const wooResult = await updateOrderStatusOnWooCommerce(
              orderData.woocommerceId,
              'impachetata'
            );
            
            if (!wooResult.success) {
              console.error(`Error updating WooCommerce order ${orderData.woocommerceId}:`, wooResult.error);
              // We still consider this a success since Firestore was updated
            }
          }
          
          // Log the activity
          await logActivity(
            'updated',
            'order',
            orderId,
            `Order #${orderData.orderNumber}`,
            currentUser
          );
          
          results.success++;
        } catch (error) {
          console.error(`Error updating order ${orderId}:`, error);
          results.failed++;
          results.failedOrderIds.push(orderId);
        }
      }
      
      setUpdateResults(results);
      
      // If any orders were updated successfully, refresh the orders list
      if (results.success > 0) {
        // Fetch orders again
        const processingQuery = query(collection(db, 'orders'), where('status', '==', 'processing'));
        const processingSnapshot = await getDocs(processingQuery);
        
        const preluataQuery = query(collection(db, 'orders'), where('status', '==', 'preluata'));
        const preluataSnapshot = await getDocs(preluataQuery);
        
        const ordersData: Order[] = [];
        
        processingSnapshot.forEach((doc) => {
          ordersData.push({
            id: doc.id,
            ...doc.data(),
            orderDate: doc.data().orderDate?.toDate() || new Date(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date()
          } as Order);
        });
        
        preluataSnapshot.forEach((doc) => {
          ordersData.push({
            id: doc.id,
            ...doc.data(),
            orderDate: doc.data().orderDate?.toDate() || new Date(),
            createdAt: doc.data().createdAt?.toDate() || new Date(),
            updatedAt: doc.data().updatedAt?.toDate() || new Date()
          } as Order);
        });
        
        // Sort by date
        ordersData.sort((a, b) => b.orderDate.getTime() - a.orderDate.getTime());
        
        setOrders(ordersData);
        
        // Reset marked orders
        const initialMarkedState: Record<string, boolean> = {};
        ordersData.forEach(order => {
          initialMarkedState[order.id] = false;
        });
        setMarkedOrders(initialMarkedState);
        
        // Regroup items
        await groupItems(ordersData);
      }
    } catch (error) {
      console.error('Error updating orders:', error);
      setError('Failed to update order statuses');
    } finally {
      setIsUpdating(false);
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
        <span className="ml-2 text-gray-600">Loading packing slip...</span>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-red-500" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-red-800">Error loading packing slip</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => navigate('/orders')}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Orders
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
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
              {orders.length} orders • {groupedItems.length} unique products • {groupedItems.reduce((sum, item) => sum + item.totalQuantity, 0)} total items
            </p>
          </div>
        </div>
        <button
          onClick={handlePrint}
          disabled={isPrinting}
          className="inline-flex items-center bg-indigo-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          {isPrinting ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 sm:mr-2 animate-spin" />
              Preparing...
            </>
          ) : (
            <>
              <PrinterIcon className="h-4 w-4 mr-1 sm:mr-2" />
              Print Packing Slip
            </>
          )}
        </button>
      </div>
      
      {/* Hidden barcode input field */}
      <form onSubmit={handleBarcodeSubmit} className="mb-4">
        <div className="flex items-center">
          <input
            ref={barcodeInputRef}
            type="text"
            value={barcode}
            onChange={handleBarcodeChange}
            className="block w-full max-w-sm rounded-l-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Scan barcode..."
            aria-label="Barcode scanner input"
            autoFocus
          />
          <button
            type="submit"
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-r-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Scan
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Scan a product barcode to mark it as grabbed for packaging. 
          {lastScanned && (
            <span className="ml-1 text-green-600">
              Last scanned: {lastScanned}
            </span>
          )}
        </p>
      </form>
      
      {/* Print area */}
      <div className="bg-white p-6 rounded-lg shadow-sm">
        <div ref={printRef}>
          {/* Document header - will appear in print */}
          <div className="mb-6 border-b border-gray-200 pb-6 print:mb-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold">PACKING SLIP</h2>
                <p className="text-sm text-gray-600">{format(new Date(), 'MMMM d, yyyy')}</p>
              </div>
              <div className="text-right">
                <h3 className="text-lg font-bold">Company Name</h3>
                <p className="text-sm text-gray-600">123 Street Address</p>
                <p className="text-sm text-gray-600">City, State, Zip</p>
              </div>
            </div>
          </div>
          
          {/* Items to pick */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-3 flex items-center">
              <Box className="h-5 w-5 mr-2 text-indigo-600" />
              Items to Pick & Pack
            </h3>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left rtl:text-right text-gray-500 min-w-full">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100">
                  <tr>
                    <th scope="col" className="px-4 py-2 print:py-1">Product</th>
                    <th scope="col" className="px-4 py-2 print:py-1">SKU</th>
                    <th scope="col" className="px-4 py-2 print:py-1">Quantity</th>
                    <th scope="col" className="px-4 py-2 print:py-1 print:hidden">Barcode</th>
                    <th scope="col" className="px-4 py-2 print:py-1 print:hidden">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {groupedItems.map((item, index) => (
                    <tr key={item.productId} className={item.scanned ? 'bg-green-50' : 'hover:bg-gray-50'}>
                      <td className="px-4 py-2 font-medium text-gray-900">
                        {item.productName}
                      </td>
                      <td className="px-4 py-2">
                        {item.sku || `SKU-${item.productId.substring(0, 6)}`}
                      </td>
                      <td className="px-4 py-2 font-bold">
                        {item.totalQuantity}
                      </td>
                      <td className="px-4 py-2 print:hidden">
                        {item.barcode ? (
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
                            {item.barcode}
                          </code>
                        ) : (
                          <span className="text-gray-400">No barcode</span>
                        )}
                      </td>
                      <td className="px-4 py-2 print:hidden">
                        <button
                          onClick={() => toggleItemScanned(index)}
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.scanned 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {item.scanned ? (
                            <>
                              <CheckSquare className="h-3 w-3 mr-1" />
                              Grabbed
                            </>
                          ) : (
                            <>
                              <Square className="h-3 w-3 mr-1" />
                              Not grabbed
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Orders */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center page-break-before">
              <Package className="h-5 w-5 mr-2 text-indigo-600" />
              Orders to Fulfill
            </h3>
            
            <div className="space-y-6 print:space-y-8">
              {orders.map((order) => (
                <div key={order.id} className="border border-gray-200 rounded-lg overflow-hidden print:border-0 print:break-inside-avoid">
                  <div className="flex items-center justify-between bg-gray-50 px-4 py-3 border-b border-gray-200 print:bg-white">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`order-${order.id}`}
                        checked={markedOrders[order.id] || false}
                        onChange={() => toggleOrderMarked(order.id)}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded print:hidden"
                      />
                      <label htmlFor={`order-${order.id}`} className="ml-2 text-sm font-medium text-gray-900 print:ml-0">
                        Order #{order.orderNumber}
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">
                        {format(order.orderDate, 'MMM d, yyyy')}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 print:hidden">
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="px-4 py-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                      {/* Shipping Details */}
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Shipping Details</h4>
                        <div className="text-sm">
                          <p className="font-medium">{order.shippingAddress.firstName} {order.shippingAddress.lastName}</p>
                          {order.shippingAddress.company && <p>{order.shippingAddress.company}</p>}
                          <p>{order.shippingAddress.address1}</p>
                          {order.shippingAddress.address2 && <p>{order.shippingAddress.address2}</p>}
                          <p>
                            {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postcode}
                          </p>
                          <p>{order.shippingAddress.country}</p>
                          {order.shippingAddress.phone && <p>Phone: {order.shippingAddress.phone}</p>}
                        </div>
                      </div>
                      
                      {/* Payment Details */}
                      <div>
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Payment Details</h4>
                        <div className="text-sm">
                          <p>Method: <span className="font-medium capitalize">{order.paymentMethod.replace('_', ' ')}</span></p>
                          <p>Subtotal: <span className="font-medium">{order.subtotal.toFixed(2)} RON</span></p>
                          <p>Shipping: <span className="font-medium">{order.shippingCost.toFixed(2)} RON</span></p>
                          <p>Tax: <span className="font-medium">{order.tax.toFixed(2)} RON</span></p>
                          <p className="font-medium">Total: {order.total.toFixed(2)} RON</p>
                        </div>
                      </div>
                    </div>
                    
                    {/* Order Items */}
                    <div>
                      <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Items</h4>
                      <div className="bg-gray-50 p-2 rounded">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Item
                              </th>
                              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Quantity
                              </th>
                              <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase print:hidden">
                                Price
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {order.items.map((item: OrderItem) => {
                              // Find if this item has been scanned in the grouped items
                              const groupedItem = groupedItems.find(gi => gi.productId === item.productId);
                              const isScanned = groupedItem?.scanned || false;
                              
                              return (
                                <tr key={item.id} className={isScanned ? 'bg-green-50' : ''}>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                    <div className="flex items-center">
                                      {isScanned && (
                                        <Check className="h-4 w-4 text-green-500 mr-2" />
                                      )}
                                      {item.productName}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                                    {item.quantity}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 text-right print:hidden">
                                    {item.price.toFixed(2)} RON
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    {/* Notes */}
                    {order.notes && (
                      <div className="mt-3">
                        <h4 className="text-xs font-medium text-gray-500 uppercase mb-1">Notes</h4>
                        <div className="bg-yellow-50 p-2 text-sm text-gray-700 rounded">
                          {order.notes}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Action buttons for updating orders */}
      <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
        <div>
          <h3 className="font-medium text-gray-900">Mark Orders as Packed</h3>
          <p className="text-sm text-gray-500">
            Select orders that have been packed and update their status
          </p>
        </div>
        <button
          onClick={updateMarkedOrders}
          disabled={isUpdating || Object.values(markedOrders).filter(Boolean).length === 0}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {isUpdating ? (
            <>
              <Loader2 className="animate-spin h-4 w-4 mr-2" />
              Updating...
            </>
          ) : (
            <>
              <Truck className="h-4 w-4 mr-2" />
              Mark Selected as Packed
            </>
          )}
        </button>
      </div>
      
      {updateResults.success > 0 && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Check className="h-5 w-5 text-green-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">
                Successfully updated {updateResults.success} order{updateResults.success !== 1 ? 's' : ''} to "impachetata" status
              </p>
            </div>
          </div>
        </div>
      )}
      
      {updateResults.failed > 0 && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                Failed to update {updateResults.failed} order{updateResults.failed !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalPackingSlip;