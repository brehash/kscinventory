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
  Truck,
  Info
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
  scanned: number; // Changed from boolean to number to track progress
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
  
  // State for barcode scanning
  const [barcode, setBarcode] = useState<string>('');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{
    show: boolean;
    success: boolean;
    message: string;
  }>({
    show: false,
    success: false,
    message: ''
  });
  
  // State for marking orders as packed
  const [markedOrders, setMarkedOrders] = useState<Record<string, boolean>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResults, setUpdateResults] = useState<{
    success: number;
    failed: number;
    failedOrderIds: string[];
    productUpdates?: {
      success: number;
      failed: number;
      insufficientStock: { productName: string; needed: number; available: number }[];
    };
  }>({
    success: 0,
    failed: 0,
    failedOrderIds: [],
  });
  
  // Search functionality
  const [searchName, setSearchName] = useState('');
  const [filteredItems, setFilteredItems] = useState<GroupedItem[]>([]);
  
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
  
  // Filter items based on search term
  useEffect(() => {
    if (!searchName.trim()) {
      setFilteredItems(groupedItems);
      return;
    }
    
    const filtered = groupedItems.filter(item => 
      item.productName.toLowerCase().includes(searchName.toLowerCase()) ||
      (item.barcode && item.barcode.toLowerCase().includes(searchName.toLowerCase())) ||
      (item.sku && item.sku.toLowerCase().includes(searchName.toLowerCase()))
    );
    
    setFilteredItems(filtered);
  }, [searchName, groupedItems]);
  
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
            scanned: 0, // Start with 0 scanned
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
    setFilteredItems(groupedItemsArray);
  };
  
  // Handle barcode scanning - auto-submits with Enter key from scanner
  const handleBarcodeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!barcode.trim()) return;
    
    let scannedBarcode = barcode.trim();
    
    // Try to find the item with this barcode
    let itemIndex = groupedItems.findIndex(item => item.barcode === scannedBarcode);
    
    // If not found, try with/without leading zero
    if (itemIndex === -1 && /^\d+$/.test(scannedBarcode)) {
      if (scannedBarcode.startsWith('0') && scannedBarcode.length > 1) {
        // Try without leading zero
        const withoutLeadingZero = scannedBarcode.substring(1);
        itemIndex = groupedItems.findIndex(item => item.barcode === withoutLeadingZero);
        if (itemIndex !== -1) {
          scannedBarcode = withoutLeadingZero;
        }
      } else {
        // Try with leading zero
        const withLeadingZero = '0' + scannedBarcode;
        itemIndex = groupedItems.findIndex(item => item.barcode === withLeadingZero);
        if (itemIndex !== -1) {
          scannedBarcode = withLeadingZero;
        }
      }
    }
    
    if (itemIndex >= 0) {
      const updatedItems = [...groupedItems];
      const currentItem = updatedItems[itemIndex];
      
      // Check if we've already scanned all of this item
      if (currentItem.scanned >= currentItem.totalQuantity) {
        // Show error feedback
        setScanFeedback({
          show: true,
          success: false,
          message: `All units of ${currentItem.productName} have already been scanned!`
        });
      } else {
        // Increment the scanned count
        updatedItems[itemIndex] = {
          ...currentItem,
          scanned: currentItem.scanned + 1
        };
        
        setGroupedItems(updatedItems);
        setFilteredItems(updatedItems); // Update filtered items as well
        setLastScanned(scannedBarcode);
        
        // Show success feedback
        setScanFeedback({
          show: true,
          success: true,
          message: `Scanned ${currentItem.productName} (${currentItem.scanned + 1}/${currentItem.totalQuantity})`
        });
      }
    } else {
      // Item not found
      setScanFeedback({
        show: true,
        success: false,
        message: `Product not found with barcode: ${scannedBarcode}`
      });
    }
    
    // Clear the scan feedback after 3 seconds
    setTimeout(() => {
      setScanFeedback({
        show: false,
        success: false,
        message: ''
      });
    }, 3000);
    
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
    const item = updatedItems[index];
    
    // Toggle between fully scanned and not scanned
    if (item.scanned === item.totalQuantity) {
      updatedItems[index] = {
        ...item,
        scanned: 0
      };
    } else {
      updatedItems[index] = {
        ...item,
        scanned: item.totalQuantity
      };
    }
    
    setGroupedItems(updatedItems);
    setFilteredItems(
      searchName ? 
        updatedItems.filter(item => 
          item.productName.toLowerCase().includes(searchName.toLowerCase()) ||
          (item.barcode && item.barcode.toLowerCase().includes(searchName.toLowerCase()))
        ) : 
        updatedItems
    );
  };
  
  // Handle incrementing a product's scanned count
  const incrementScannedCount = (index: number) => {
    const updatedItems = [...groupedItems];
    const item = updatedItems[index];
    
    if (item.scanned < item.totalQuantity) {
      updatedItems[index] = {
        ...item,
        scanned: item.scanned + 1
      };
      
      setGroupedItems(updatedItems);
      setFilteredItems(
        searchName ? 
          updatedItems.filter(item => 
            item.productName.toLowerCase().includes(searchName.toLowerCase()) ||
            (item.barcode && item.barcode.toLowerCase().includes(searchName.toLowerCase()))
          ) : 
          updatedItems
      );
    }
  };
  
  // Handle decrementing a product's scanned count
  const decrementScannedCount = (index: number) => {
    const updatedItems = [...groupedItems];
    const item = updatedItems[index];
    
    if (item.scanned > 0) {
      updatedItems[index] = {
        ...item,
        scanned: item.scanned - 1
      };
      
      setGroupedItems(updatedItems);
      setFilteredItems(
        searchName ? 
          updatedItems.filter(item => 
            item.productName.toLowerCase().includes(searchName.toLowerCase()) ||
            (item.barcode && item.barcode.toLowerCase().includes(searchName.toLowerCase()))
          ) : 
          updatedItems
      );
    }
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
      return new Promise<void>((resolve) => {
        setTimeout(resolve, 500);
      });
    }
  });

  // Update product quantities for an order
  const updateProductQuantities = async (order: Order) => {
    if (!currentUser) return { success: 0, failed: 0, insufficientStock: [] };

    const results = {
      success: 0,
      failed: 0,
      insufficientStock: [] as { productName: string; needed: number; available: number }[]
    };

    // Process each order item
    for (const item of order.items) {
      try {
        // Get the current product data
        const productRef = doc(db, 'products', item.productId);
        const productDoc = await getDoc(productRef);
        
        if (!productDoc.exists()) {
          results.failed++;
          continue;
        }
        
        const productData = productDoc.data() as Product;
        
        // Check if we have enough stock
        if (productData.quantity < item.quantity) {
          // Not enough stock
          results.insufficientStock.push({
            productName: item.productName,
            needed: item.quantity,
            available: productData.quantity
          });
          results.failed++;
          continue;
        }
        
        // Update the product quantity
        const newQuantity = productData.quantity - item.quantity;
        await updateDoc(productRef, {
          quantity: newQuantity,
          updatedAt: new Date()
        });
        
        // Log the activity
        await logActivity(
          'removed',
          'product',
          item.productId,
          item.productName,
          currentUser,
          item.quantity
        );
        
        results.success++;
      } catch (error) {
        console.error(`Error updating product ${item.productId}:`, error);
        results.failed++;
      }
    }
    
    return results;
  };
  
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
        failedOrderIds: [] as string[],
        productUpdates: {
          success: 0,
          failed: 0,
          insufficientStock: [] as { productName: string; needed: number; available: number }[]
        }
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
          const order = { ...orderData, id: orderId };

          // Update product quantities first
          const productUpdateResults = await updateProductQuantities(order);
          
          // Accumulate product update results
          results.productUpdates.success += productUpdateResults.success;
          results.productUpdates.failed += productUpdateResults.failed;
          results.productUpdates.insufficientStock = [
            ...results.productUpdates.insufficientStock,
            ...productUpdateResults.insufficientStock
          ];
          
          // Only proceed with order update if there's sufficient stock for all items
          if (productUpdateResults.insufficientStock.length === 0) {
            // Update order status in Firestore - now using 'pregatita' instead of 'impachetata'
            await updateDoc(orderRef, {
              status: 'pregatita',
              updatedAt: new Date()
            });
            
            // Update order status in WooCommerce if it's a WooCommerce order
            if (orderData.source === 'woocommerce' && orderData.woocommerceId) {
              const wooResult = await updateOrderStatusOnWooCommerce(
                orderData.woocommerceId,
                'pregatita'
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
          } else {
            // Mark as failed if there was insufficient stock
            results.failed++;
            results.failedOrderIds.push(orderId);
          }
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
  
  // Function to get scanning progress class
  const getProgressClass = (item: GroupedItem) => {
    if (item.scanned === 0) return '';
    if (item.scanned === item.totalQuantity) return 'bg-green-50 line-through';
    return 'bg-amber-50'; // Partially scanned
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
          className="inline-flex items-center bg-indigo-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm rounded-md hover:bg-indigo-700 transition-colors"
        >
          <PrinterIcon className="h-4 w-4 mr-1 sm:mr-2" />
          Print Packing Slip
        </button>
      </div>
      
      {/* Scan feedback alert */}
      {scanFeedback.show && (
        <div className={`fixed top-4 right-4 z-50 p-3 rounded-md shadow-lg ${
          scanFeedback.success ? 'bg-green-100 border border-green-200' : 'bg-red-100 border border-red-200'
        }`}>
          <div className="flex items-center">
            {scanFeedback.success ? (
              <Check className="h-5 w-5 text-green-600 mr-2" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            )}
            <span className={scanFeedback.success ? 'text-green-800' : 'text-red-800'}>
              {scanFeedback.message}
            </span>
          </div>
        </div>
      )}
      
      {/* Hidden barcode input field - autofocused for scanner */}
      <form onSubmit={handleBarcodeSubmit} className="mb-4">
        <div className="flex items-center space-x-2">
          <div className="flex-1">
            <input
              ref={barcodeInputRef}
              type="text"
              value={barcode}
              onChange={handleBarcodeChange}
              className="block w-full rounded-md border-gray-500 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Scan barcode or enter manually..."
              aria-label="Barcode scanner input"
              autoFocus
            />
            <p className="mt-1 text-xs text-gray-500">
              Scan a product barcode to mark it as grabbed for packaging. 
              {lastScanned && (
                <span className="ml-1 text-green-600">
                  Last scanned: {lastScanned}
                </span>
              )}
            </p>
          </div>
          
          {/* Product search field */}
          <div className="flex-1">
            <input
              type="text"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="Search products by name..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Find products by typing their name or partial barcode
            </p>
          </div>
        </div>
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
                    <th scope="col" className="px-4 py-2 print:py-1">Qty</th>
                    <th scope="col" className="px-4 py-2 print:py-1 print:hidden">Progress</th>
                    <th scope="col" className="px-4 py-2 print:py-1 print:hidden">Barcode</th>
                    <th scope="col" className="px-4 py-2 print:py-1 print:hidden">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredItems.map((item, index) => {
                    const originalIndex = groupedItems.findIndex(
                      gi => gi.productId === item.productId
                    );
                    const progressPercent = (item.scanned / item.totalQuantity) * 100;
                    
                    return (
                      <tr 
                        key={item.productId} 
                        className={getProgressClass(item)}
                      >
                        <td className={`px-4 py-2 font-medium text-gray-900 ${item.scanned === item.totalQuantity ? 'line-through' : ''}`}>
                          {item.productName}
                        </td>
                        <td className="px-4 py-2">
                          {item.sku || `SKU-${item.productId.substring(0, 6)}`}
                        </td>
                        <td className="px-4 py-2 font-bold">
                          <span className={item.scanned === item.totalQuantity ? 'line-through' : ''}>
                            {item.scanned}/{item.totalQuantity}
                          </span>
                        </td>
                        <td className="px-4 py-2 print:hidden">
                          <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div 
                              className={`h-2.5 rounded-full ${
                                progressPercent === 100 ? 'bg-green-600' : 
                                progressPercent > 0 ? 'bg-amber-500' : 'bg-gray-400'
                              }`} 
                              style={{ width: `${progressPercent}%` }}
                            ></div>
                          </div>
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
                          <div className="flex space-x-2">
                            <button
                              onClick={() => decrementScannedCount(originalIndex)}
                              className="p-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200"
                              title="Decrement scanned count"
                            >
                              -
                            </button>
                            <button
                              onClick={() => incrementScannedCount(originalIndex)}
                              className="p-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200"
                              title="Increment scanned count"
                            >
                              +
                            </button>
                            <button
                              onClick={() => toggleItemScanned(originalIndex)}
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                item.scanned === item.totalQuantity 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {item.scanned === item.totalQuantity ? (
                                <>
                                  <CheckSquare className="h-3 w-3 mr-1" />
                                  Complete
                                </>
                              ) : (
                                <>
                                  <Square className="h-3 w-3 mr-1" />
                                  {item.scanned > 0 ? 'In Progress' : 'Not Started'}
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
              {orders.map((order) => {
                // Calculate if this order is fully picked
                const orderItems = order.items.map(item => ({
                  ...item,
                  groupedItem: groupedItems.find(gi => gi.productId === item.productId)
                }));
                
                const allItemsScanned = orderItems.every(item => 
                  item.groupedItem && item.groupedItem.scanned >= item.groupedItem.totalQuantity
                );
                
                const someItemsScanned = orderItems.some(item => 
                  item.groupedItem && item.groupedItem.scanned > 0
                );
                
                // Order status class
                const orderStatusClass = allItemsScanned 
                  ? 'bg-green-50 border-green-200' 
                  : someItemsScanned 
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-gray-50 border-gray-200';
                
                return (
                  <div key={order.id} className={`border rounded-lg overflow-hidden print:border-0 print:break-inside-avoid ${orderStatusClass}`}>
                    <div className="flex items-center justify-between bg-inherit px-4 py-3 border-b border-inherit print:bg-white">
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
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          allItemsScanned ? 'bg-green-100 text-green-800' : 
                          someItemsScanned ? 'bg-amber-100 text-amber-800' : 
                          'bg-blue-100 text-blue-800'
                        } print:hidden`}>
                          {allItemsScanned ? 'Ready' : 
                           someItemsScanned ? 'In Progress' : 
                           order.status.charAt(0).toUpperCase() + order.status.slice(1)}
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
                                <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase print:hidden">
                                  Status
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {order.items.map((item: OrderItem) => {
                                // Find corresponding grouped item
                                const groupedItem = groupedItems.find(gi => gi.productId === item.productId);
                                const scannedCount = groupedItem?.scanned || 0;
                                const totalCount = groupedItem?.totalQuantity || 0;
                                
                                // Calculate item status
                                const isFullyScanned = scannedCount >= totalCount;
                                const isPartiallyScanned = scannedCount > 0 && scannedCount < totalCount;
                                
                                return (
                                  <tr key={item.id} className={isFullyScanned ? 'bg-green-50' : isPartiallyScanned ? 'bg-amber-50' : ''}>
                                    <td className={`px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900 ${isFullyScanned ? 'line-through' : ''}`}>
                                      <div className="flex items-center">
                                        {isFullyScanned && (
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
                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-right print:hidden">
                                      {isFullyScanned ? (
                                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                          <Check className="h-3 w-3 mr-1" />
                                          Picked
                                        </span>
                                      ) : isPartiallyScanned ? (
                                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                                          In Progress
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                                          Not Started
                                        </span>
                                      )}
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
                );
              })}
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
          <div className="mt-2 text-xs text-indigo-600 flex items-center">
            <Info className="h-3.5 w-3.5 mr-1" />
            <span>This action will decrease product quantities in inventory</span>
          </div>
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
                Successfully updated {updateResults.success} order{updateResults.success !== 1 ? 's' : ''} to "pregatita" status
              </p>
              {updateResults.productUpdates && (
                <p className="text-sm text-green-700 mt-1">
                  Updated quantities for {updateResults.productUpdates.success} product{updateResults.productUpdates.success !== 1 ? 's' : ''}
                </p>
              )}
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
              {updateResults.productUpdates?.insufficientStock && updateResults.productUpdates.insufficientStock.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-red-700">Insufficient stock for:</p>
                  <ul className="list-disc pl-5 mt-1 text-sm text-red-700">
                    {updateResults.productUpdates.insufficientStock.map((item, index) => (
                      <li key={index}>
                        {item.productName} (needed: {item.needed}, available: {item.available})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalPackingSlip;