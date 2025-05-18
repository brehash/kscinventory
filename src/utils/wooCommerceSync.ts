import WooCommerceRestApi from '@woocommerce/woocommerce-rest-api';
import { 
  collection, 
  getDocs, 
  query, 
  where, 
  addDoc, 
  updateDoc,
  doc,
  getDoc,
  Timestamp
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Order, User, OrderStatus, UnidentifiedItem, Product } from '../types';
import { logActivity } from './activityLogger';

// Initialize WooCommerce API
const initWooCommerceAPI = () => {
  // Get settings from localStorage
  const url = localStorage.getItem('wc_url') || '';
  const consumerKey = localStorage.getItem('wc_consumer_key') || '';
  const consumerSecret = localStorage.getItem('wc_consumer_secret') || '';
  
  const wooCommerceConfig = {
    url,
    consumerKey,
    consumerSecret,
    version: 'wc/v3'
  };
  
  return new WooCommerceRestApi(wooCommerceConfig);
};

// Test WooCommerce connection with provided credentials
export const testWooCommerceConnection = async (
  url: string,
  consumerKey: string,
  consumerSecret: string
): Promise<{success: boolean, message?: string, error?: string}> => {
  try {
    const api = new WooCommerceRestApi({
      url,
      consumerKey,
      consumerSecret,
      version: 'wc/v3'
    });
    
    // Test connection by getting store information
    const response = await api.get('');
    
    if (response && response.status === 200) {
      return {
        success: true,
        message: `Connected to ${response.data?.name || 'WooCommerce store'}`
      };
    }
    
    return {
      success: false,
      error: 'Unexpected response from WooCommerce API'
    };
  } catch (err) {
    console.error('WooCommerce connection test error:', err);
    let errorMessage = 'Connection failed';
    
    if (err instanceof Error) {
      if (err.message.includes('401')) {
        errorMessage = 'Authentication failed: Invalid credentials';
      } else if (err.message.includes('404')) {
        errorMessage = 'Store not found: Please check the URL';
      } else if (err.message.includes('CORS')) {
        errorMessage = 'CORS error: Your store needs to enable CORS for API access';
      } else if (err.message.includes('Network Error')) {
        errorMessage = 'Network error: Unable to connect to the server';
      } else {
        errorMessage = `Error: ${err.message}`;
      }
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
};

// Map WooCommerce order status to internal status
const mapOrderStatus = (wcStatus: string): OrderStatus => {
  console.log(`Mapping WooCommerce status: ${wcStatus}`);
  
  // Support both standard WooCommerce statuses and custom statuses with wc- prefix
  switch (wcStatus) {
    // Standard WooCommerce statuses
    case 'pending':
      return 'pending';
    case 'processing':
      return 'processing';
    case 'on-hold':
      return 'on-hold';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    case 'failed':
      return 'failed';
    case 'draft':
      return 'draft';
      
    // Custom statuses with wc- prefix  
    case 'wc-preluata':
      return 'preluata';
    case 'wc-pregatita':
      return 'pregatita';
    case 'wc-expediata':
      return 'expediata';
    case 'wc-refuzata':
      return 'refuzata';  
    case 'wc-neonorata':
      return 'neonorata';
    
    // Support for custom statuses without prefix too
    case 'preluata':
      return 'preluata';
    case 'pregatita':
      return 'pregatita';
    case 'expediata':
      return 'expediata';
    case 'refuzata':
      return 'refuzata';
    case 'neonorata':
      return 'neonorata';
      
    default:
      console.log(`Unknown WooCommerce status: ${wcStatus}, defaulting to 'processing'`);
      return 'processing';
  }
};

// Map internal order status to WooCommerce status
const mapInternalStatusToWooCommerce = (status: OrderStatus): string => {
  console.log(`Mapping internal status to WooCommerce: ${status}`);
  
  switch (status) {
    case 'preluata':
      return 'wc-preluata';
    case 'pregatita':
      return 'wc-pregatita';
    case 'expediata':
      return 'wc-expediata';
    case 'refuzata':
      return 'wc-refuzata';
    case 'neonorata':
      return 'wc-neonorata';
      
    // For backward compatibility, support the old status name
    case 'impachetata':
      return 'wc-pregatita';
      
    // Standard WooCommerce statuses
    case 'pending':
      return 'pending';
    case 'processing':
      return 'processing';
    case 'on-hold':
      return 'on-hold';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    case 'failed':
      return 'failed';
    default:
      console.log(`Unknown internal status: ${status}, defaulting to original status`);
      return status;
  }
};

// Update order status on WooCommerce
export const updateOrderStatusOnWooCommerce = async (
  woocommerceId: number,
  status: OrderStatus
): Promise<{success: boolean, error?: string}> => {
  try {
    // Check if credentials exist
    if (!localStorage.getItem('wc_url') || 
        !localStorage.getItem('wc_consumer_key') || 
        !localStorage.getItem('wc_consumer_secret')) {
      return { 
        success: false, 
        error: 'WooCommerce credentials not found. Please configure them in Settings > WooCommerce.' 
      };
    }
    
    const api = initWooCommerceAPI();
    
    // Map the internal status to a WooCommerce status
    const wcStatus = mapInternalStatusToWooCommerce(status);
    console.log(`Updating WooCommerce order ${woocommerceId} status to: ${wcStatus}`);
    
    // Update order status in WooCommerce
    const response = await api.put(`orders/${woocommerceId}`, {
      status: wcStatus
    });
    
    console.log(`WooCommerce update response status: ${response.status}`);
    
    if (response && response.status === 200) {
      console.log(`Successfully updated WooCommerce order ${woocommerceId}`);
      return { success: true };
    }
    
    console.error('Unexpected response when updating WooCommerce order:', response);
    return {
      success: false,
      error: 'Unexpected response from WooCommerce API'
    };
  } catch (error) {
    console.error('Error updating WooCommerce order status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Find product in Firestore by barcode (WooCommerce SKU)
const findProductByBarcode = async (sku: string): Promise<Product | null> => {
  if (!sku) return null;
  
  try {
    const productsRef = collection(db, 'products');
    const q = query(productsRef, where('barcode', '==', sku));
    const querySnapshot = await getDocs(q);
    
    if (!querySnapshot.empty) {
      const productDoc = querySnapshot.docs[0];
      return {
        id: productDoc.id,
        ...productDoc.data()
      } as Product;
    }
    
    return null;
  } catch (error) {
    console.error('Error finding product by barcode:', error);
    return null;
  }
};

// Convert WooCommerce order to internal Order format
const convertWooCommerceOrder = async (wcOrder: any): Promise<Omit<Order, 'id'>> => {
  console.log(`Converting WooCommerce order: #${wcOrder.number} (ID: ${wcOrder.id}) - Status: ${wcOrder.status}`);
  
  // Extract customer name
  const customerName = wcOrder.billing 
    ? `${wcOrder.billing.first_name} ${wcOrder.billing.last_name}`.trim()
    : 'Unknown Customer';
  
  // Extract customer email
  const customerEmail = wcOrder.billing?.email || null;
  
  // Create order items and track unidentified items
  const items: Array<any> = [];
  const unidentifiedItems: UnidentifiedItem[] = [];
  
  // Process each line item
  for (const item of wcOrder.line_items) {
    const sku = item.sku || '';
    console.log(`Processing line item: "${item.name}" (SKU: ${sku}, Quantity: ${item.quantity})`);
    
    // Try to find the product by barcode (sku)
    const product = await findProductByBarcode(sku);
    
    if (product) {
      console.log(`Found matching product in inventory for SKU ${sku}: ${product.name}`);
      // Product found in system - add it as a regular OrderItem
      items.push({
        id: item.id.toString(),
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        price: product.price,
        total: product.price * item.quantity
      });
    } else {
      console.log(`No matching product found for SKU ${sku}, adding to unidentified items`);
      // Product not found - add to unidentifiedItems
      unidentifiedItems.push({
        wcProductId: item.product_id,
        sku: sku,
        name: item.name,
        price: parseFloat(item.price),
        quantity: item.quantity,
        total: parseFloat(item.total)
      });
    }
  }
  
  // Create shipping address
  const shippingAddress = {
    firstName: wcOrder.shipping?.first_name || wcOrder.billing?.first_name || '',
    lastName: wcOrder.shipping?.last_name || wcOrder.billing?.last_name || '',
    company: wcOrder.shipping?.company || wcOrder.billing?.company || '',
    address1: wcOrder.shipping?.address_1 || wcOrder.billing?.address_1 || '',
    address2: wcOrder.shipping?.address_2 || wcOrder.billing?.address_2 || '',
    city: wcOrder.shipping?.city || wcOrder.billing?.city || '',
    state: wcOrder.shipping?.state || wcOrder.billing?.state || '',
    postcode: wcOrder.shipping?.postcode || wcOrder.billing?.postcode || '',
    country: wcOrder.shipping?.country || wcOrder.billing?.country || '',
    email: wcOrder.billing?.email || '',
    phone: wcOrder.billing?.phone || ''
  };
  
  // Create billing address
  const billingAddress = {
    firstName: wcOrder.billing?.first_name || '',
    lastName: wcOrder.billing?.last_name || '',
    company: wcOrder.billing?.company || '',
    address1: wcOrder.billing?.address_1 || '',
    address2: wcOrder.billing?.address_2 || '',
    city: wcOrder.billing?.city || '',
    state: wcOrder.billing?.state || '',
    postcode: wcOrder.billing?.postcode || '',
    country: wcOrder.billing?.country || '',
    email: wcOrder.billing?.email || '',
    phone: wcOrder.billing?.phone || ''
  };
  
  // Calculate subtotal, shipping cost, and tax
  const subtotal = parseFloat(wcOrder.subtotal || '0');
  const shippingCost = parseFloat(wcOrder.shipping_total || '0');
  const tax = parseFloat(wcOrder.total_tax || '0');
  const total = parseFloat(wcOrder.total || '0');
  
  // Parse order date
  const orderDate = new Date(wcOrder.date_created || new Date());
  
  // Map the status and log it
  const mappedStatus = mapOrderStatus(wcOrder.status);
  console.log(`Mapped WooCommerce status "${wcOrder.status}" to internal status "${mappedStatus}"`);
  
  return {
    orderNumber: wcOrder.number,
    customerName,
    customerEmail,
    orderDate,
    status: mappedStatus,
    items,
    ...(unidentifiedItems.length > 0 ? { unidentifiedItems } : {}),
    hasUnidentifiedItems: unidentifiedItems.length > 0,
    shippingAddress,
    billingAddress,
    subtotal,
    shippingCost,
    tax,
    total,
    paymentMethod: wcOrder.payment_method || 'other',
    notes: wcOrder.customer_note || null,
    source: 'woocommerce',
    woocommerceId: wcOrder.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    packingSlipPrinted: false
  };
};

// Sync WooCommerce orders
export const syncWooCommerceOrders = async (currentUser: User) => {
  try {
    console.log('Starting WooCommerce orders sync...');
    
    // Initialize WooCommerce API
    const api = initWooCommerceAPI();
    
    // Check if credentials exist
    if (!localStorage.getItem('wc_url') || 
        !localStorage.getItem('wc_consumer_key') || 
        !localStorage.getItem('wc_consumer_secret')) {
      console.error('WooCommerce credentials not found');
      return { 
        success: false, 
        error: 'WooCommerce credentials not found. Please configure them in Settings > WooCommerce.' 
      };
    }
    
    // Fetch orders from WooCommerce
    console.log('Fetching orders from WooCommerce API...');
    const response = await api.get('orders', {
      per_page: 100, // Adjust as needed
      orderby: 'date',
      order: 'desc'
    });
    
    if (!response || !response.data) {
      console.error('No response from WooCommerce API');
      return { 
        success: false, 
        error: 'No response from WooCommerce API' 
      };
    }
    
    // Log the full response in the console for debugging
    console.log('WooCommerce API Response:', response);
    console.log('WooCommerce Orders Data:', response.data);
    
    const wcOrders = response.data;
    console.log(`Retrieved ${wcOrders.length} orders from WooCommerce`);
    
    // Log statuses for debugging
    const statusCounts: Record<string, number> = {};
    wcOrders.forEach((order: any) => {
      const status = order.status;
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      console.log(`Order #${order.number} has WooCommerce status: ${status}`);
    });
    console.log('Status distribution from WooCommerce:', statusCounts);
    
    let newOrders = 0;
    let updatedOrders = 0;
    let ordersWithUnidentifiedItems = 0;
    
    // Process each WooCommerce order
    for (const wcOrder of wcOrders) {
      console.log(`Processing WooCommerce order #${wcOrder.number} (ID: ${wcOrder.id})`);
      
      // Check if order already exists
      const ordersRef = collection(db, 'orders');
      const q = query(
        ordersRef, 
        where('source', '==', 'woocommerce'),
        where('woocommerceId', '==', wcOrder.id)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log(`Order #${wcOrder.number} is new, creating in Firestore`);
        // Order doesn't exist, create it
        const newOrderData = await convertWooCommerceOrder(wcOrder);
        const docRef = await addDoc(ordersRef, newOrderData);
        
        // Log the activity
        await logActivity(
          'added',
          'order',
          docRef.id,
          `Order #${newOrderData.orderNumber}`,
          currentUser
        );
        
        if (newOrderData.hasUnidentifiedItems) {
          ordersWithUnidentifiedItems++;
          console.log(`Order #${wcOrder.number} has unidentified items`);
        }
        
        newOrders++;
      } else {
        // Order exists, update it
        const existingOrder = snapshot.docs[0];
        const existingOrderData = existingOrder.data() as Order;
        console.log(`Order #${wcOrder.number} already exists in Firestore with status: ${existingOrderData.status}`);
        
        // Convert WooCommerce order to our format
        const newOrderData = await convertWooCommerceOrder(wcOrder);
        
        // Only update if something has changed
        if (
          existingOrderData.status !== newOrderData.status ||
          JSON.stringify(existingOrderData.items) !== JSON.stringify(newOrderData.items) ||
          existingOrderData.total !== newOrderData.total ||
          existingOrderData.hasUnidentifiedItems !== newOrderData.hasUnidentifiedItems
        ) {
          console.log(`Order #${wcOrder.number} has changes, updating in Firestore`);
          console.log(`Status change: ${existingOrderData.status} -> ${newOrderData.status}`);
          
          const orderRef = doc(db, 'orders', existingOrder.id);
          
          // Update only what has changed
          await updateDoc(orderRef, {
            status: newOrderData.status,
            items: newOrderData.items,
            ...(newOrderData.hasUnidentifiedItems ? { unidentifiedItems: newOrderData.unidentifiedItems } : {}),
            hasUnidentifiedItems: newOrderData.hasUnidentifiedItems,
            subtotal: newOrderData.subtotal,
            shippingCost: newOrderData.shippingCost,
            tax: newOrderData.tax,
            total: newOrderData.total,
            updatedAt: new Date()
          });
          
          // Log the activity
          await logActivity(
            'updated',
            'order',
            existingOrder.id,
            `Order #${existingOrderData.orderNumber}`,
            currentUser
          );
          
          if (newOrderData.hasUnidentifiedItems && 
              (!existingOrderData.hasUnidentifiedItems || 
               JSON.stringify(existingOrderData.unidentifiedItems) !== JSON.stringify(newOrderData.unidentifiedItems))) {
            ordersWithUnidentifiedItems++;
            console.log(`Order #${wcOrder.number} has unidentified items after update`);
          }
          
          updatedOrders++;
        } else {
          console.log(`Order #${wcOrder.number} has no changes, skipping update`);
        }
      }
    }
    
    console.log(`Sync completed: ${newOrders} new orders, ${updatedOrders} updated orders, ${ordersWithUnidentifiedItems} orders with unidentified items`);
    
    return {
      success: true,
      newOrders,
      updatedOrders,
      ordersWithUnidentifiedItems
    };
  } catch (error) {
    console.error('Error syncing WooCommerce orders:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
};

// Create a script for scheduled sync (to be used with a cron job)
export const wooSyncScript = async () => {
  // This would be adapted to run from a Node.js script or Firebase Cloud Function
  try {
    console.log('Starting WooCommerce order sync...');
    
    // Initialize WooCommerce API
    const api = initWooCommerceAPI();
    
    // Check if credentials exist
    if (!localStorage.getItem('wc_url') || 
        !localStorage.getItem('wc_consumer_key') || 
        !localStorage.getItem('wc_consumer_secret')) {
      console.error('WooCommerce credentials not found.');
      return;
    }
    
    // Fetch orders from WooCommerce
    const response = await api.get('orders', {
      per_page: 100,
      orderby: 'date',
      order: 'desc'
    });
    
    if (!response || !response.data) {
      console.error('No response from WooCommerce API');
      return;
    }
    
    // Log response data
    console.log('WooCommerce API Response (Script):', response.data);
    
    const wcOrders = response.data;
    let newOrders = 0;
    let updatedOrders = 0;
    
    // Process each WooCommerce order
    for (const wcOrder of wcOrders) {
      // Check if order already exists
      const ordersRef = collection(db, 'orders');
      const q = query(
        ordersRef, 
        where('source', '==', 'woocommerce'),
        where('woocommerceId', '==', wcOrder.id)
      );
      
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Order doesn't exist, create it
        const newOrderData = await convertWooCommerceOrder(wcOrder);
        await addDoc(ordersRef, newOrderData);
        newOrders++;
      } else {
        // Order exists, update it if needed
        const existingOrder = snapshot.docs[0];
        const existingOrderData = existingOrder.data() as Order;
        
        // Convert WooCommerce order to our format
        const newOrderData = await convertWooCommerceOrder(wcOrder);
        
        // Only update if something has changed
        if (
          existingOrderData.status !== newOrderData.status ||
          JSON.stringify(existingOrderData.items) !== JSON.stringify(newOrderData.items) ||
          existingOrderData.total !== newOrderData.total ||
          existingOrderData.hasUnidentifiedItems !== newOrderData.hasUnidentifiedItems
        ) {
          const orderRef = doc(db, 'orders', existingOrder.id);
          
          // Update only what has changed
          await updateDoc(orderRef, {
            status: newOrderData.status,
            items: newOrderData.items,
            ...(newOrderData.hasUnidentifiedItems ? { unidentifiedItems: newOrderData.unidentifiedItems } : {}),
            hasUnidentifiedItems: newOrderData.hasUnidentifiedItems,
            subtotal: newOrderData.subtotal,
            shippingCost: newOrderData.shippingCost,
            tax: newOrderData.tax,
            total: newOrderData.total,
            updatedAt: new Date()
          });
          
          updatedOrders++;
        }
      }
    }
    
    console.log(`Sync completed: ${newOrders} new orders, ${updatedOrders} updated orders`);
  } catch (error) {
    console.error('Error in WooCommerce sync script:', error);
  }
};